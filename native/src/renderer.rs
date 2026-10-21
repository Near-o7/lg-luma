//! A small GLES2-compatible GPU painter. Rust owns the draw list and glyph atlas;
//! SDL only supplies the context. No browser, LVGL, Qt or copied PlxNative code.
use crate::{
    raster::{Shelf, Size, Viewport, glyph_size, recyclable_page},
    state::Rect,
};
use fontdue::{Font, Metrics};
use gl::types::*;
use serde::Serialize;
use std::{
    collections::HashMap,
    ffi::{CStr, CString},
    path::Path,
    time::Instant,
};

pub type Color = [f32; 4];
pub const WHITE: Color = [0.96, 0.96, 0.96, 1.];
const ATLAS: usize = 1024;
const CACHED_ATLASES: usize = 4;
const TEXTURE_BUDGET: usize = 48 * 1024 * 1024;

#[derive(Clone, Copy, Debug)]
pub struct TextStyle {
    pub size: f32,
    pub weight: u16,
    /// CSS letter-spacing in em, not pixels.
    pub tracking: f32,
    pub line_height: f32,
    pub align_right: bool,
}
impl TextStyle {
    pub const fn new(size: f32) -> Self {
        Self {
            size,
            weight: 400,
            tracking: 0.,
            line_height: 1.2,
            align_right: false,
        }
    }
    pub const fn weight(mut self, weight: u16) -> Self {
        self.weight = weight;
        self
    }
    pub const fn tracking(mut self, tracking: f32) -> Self {
        self.tracking = tracking;
        self
    }
    pub const fn leading(mut self, height: f32) -> Self {
        self.line_height = height;
        self
    }
    pub const fn right(mut self) -> Self {
        self.align_right = true;
        self
    }
}

#[derive(Clone)]
pub enum Draw {
    Shape(Rect, f32, f32, Color),
    RoundedGradient(Rect, f32, Color, Color),
    Shadow(Rect, f32, f32, Color),
    Text(String, Rect, TextStyle, Color, bool),
    Image(String, Rect, f32, bool),
    TintedImage(String, Rect, f32, bool, Color),
    Clip(Option<Rect>),
}

struct Texture {
    id: GLuint,
    width: u32,
    height: u32,
    frame: u64,
}
impl Drop for Texture {
    fn drop(&mut self) {
        unsafe {
            gl::DeleteTextures(1, &self.id);
        }
    }
}

#[derive(Clone, Copy)]
struct Glyph {
    metrics: Metrics,
    uv: [f32; 4],
    page: Option<usize>,
}

struct GlyphAtlas {
    texture: Texture,
    shelf: Shelf,
    used: u64,
}

#[derive(Clone, Serialize)]
pub struct GraphicsInfo {
    pub vendor: String,
    pub renderer: String,
    pub version: String,
    pub max_texture_size: u32,
    pub max_viewport: [i32; 2],
    pub fragment_highp: bool,
}

#[derive(Clone, Serialize)]
pub struct RenderStats {
    pub target: Size,
    pub viewport: Viewport,
    pub font_antialiasing: &'static str,
    pub max_logical_font_px: f32,
    pub max_physical_font_px: f32,
    pub cached_glyphs: usize,
    pub glyph_rasterizations: usize,
    pub glyph_failures: usize,
    pub glyph_atlas_pages: usize,
    pub glyph_atlas_bytes: usize,
    pub artwork_bytes: usize,
    pub high_resolution_wallpaper: bool,
    pub draw_calls: usize,
    pub cpu_submission_ms: f64,
}
impl RenderStats {
    fn new(target: Size) -> Self {
        Self {
            target,
            viewport: Viewport::new(target),
            font_antialiasing: "grayscale coverage",
            max_logical_font_px: 0.,
            max_physical_font_px: 0.,
            cached_glyphs: 0,
            glyph_rasterizations: 0,
            glyph_failures: 0,
            glyph_atlas_pages: 0,
            glyph_atlas_bytes: 0,
            artwork_bytes: 0,
            high_resolution_wallpaper: false,
            draw_calls: 0,
            cpu_submission_ms: 0.,
        }
    }
}

struct Batch {
    texture: GLuint,
    start: usize,
    count: usize,
    clip: Option<Rect>,
}

pub struct Renderer {
    program: GLuint,
    buffer: GLuint,
    vao: GLuint,
    white: Texture,
    atlases: Vec<GlyphAtlas>,
    fonts: HashMap<u16, Font>,
    glyphs: HashMap<(char, u16, u16), Glyph>,
    textures: HashMap<String, Option<Texture>>,
    artwork_variants: HashMap<String, String>,
    vertices: Vec<f32>,
    batches: Vec<Batch>,
    clip: Option<Rect>,
    frame: u64,
    stats: RenderStats,
    pub info: GraphicsInfo,
}

impl Renderer {
    pub fn new(font: &Path, gles: bool) -> Result<Self, String> {
        let directory = font.parent().ok_or("Invalid font path")?;
        let mut fonts = HashMap::new();
        for weight in [350, 400, 450, 500, 550, 600, 650, 800] {
            for display in [false, true] {
                let path = directory.join(format!(
                    "font-{}{weight}.ttf",
                    if display { "display-" } else { "" }
                ));
                let bytes = std::fs::read(&path).map_err(|e| {
                    format!("Font {}: {e}. Regenerate native assets.", path.display())
                })?;
                fonts.insert(
                    weight + if display { 1000 } else { 0 },
                    Font::from_bytes(bytes, fontdue::FontSettings::default())
                        .map_err(str::to_string)?,
                );
            }
        }
        let mut max_texture_size = 0;
        let mut max_viewport = [0; 2];
        let mut precision = 0;
        unsafe {
            gl::GetIntegerv(gl::MAX_TEXTURE_SIZE, &mut max_texture_size);
            gl::GetIntegerv(gl::MAX_VIEWPORT_DIMS, max_viewport.as_mut_ptr());
            if gles && gl::GetShaderPrecisionFormat::is_loaded() {
                let mut range = [0; 2];
                gl::GetShaderPrecisionFormat(
                    gl::FRAGMENT_SHADER,
                    gl::HIGH_FLOAT,
                    range.as_mut_ptr(),
                    &mut precision,
                );
            }
        }
        let fragment_highp = !gles || precision > 0;
        let qualifier = if fragment_highp { "highp" } else { "mediump" };
        let vertex = if gles {
            format!("#version 100\nprecision highp float;\n#define PAINT_PRECISION {qualifier}\n")
        } else {
            "#version 150\n#define attribute in\n#define varying out\n#define PAINT_PRECISION\n"
                .into()
        } + include_str!("shaders/paint.vert");
        let fragment = if gles {
            format!(
                "#version 100\nprecision {qualifier} float;\n#define PAINT_PRECISION {qualifier}\n"
            )
        } else {
            "#version 150\n#define varying in\n#define texture2D texture\nout vec4 out_color;\n#define gl_FragColor out_color\n#define PAINT_PRECISION\n".into()
        } + include_str!("shaders/paint.frag");
        let program = link(&vertex, &fragment)?;
        let mut buffer = 0;
        let mut vao = 0;
        unsafe {
            if !gles {
                gl::GenVertexArrays(1, &mut vao);
                gl::BindVertexArray(vao);
            }
            gl::GenBuffers(1, &mut buffer);
            gl::Enable(gl::BLEND);
            // Preserve an opaque destination alpha. Using BlendFunc for both
            // channels makes translucent UI darken again in PNG/window compositing.
            gl::BlendFuncSeparate(
                gl::SRC_ALPHA,
                gl::ONE_MINUS_SRC_ALPHA,
                gl::ONE,
                gl::ONE_MINUS_SRC_ALPHA,
            );
            gl::Disable(gl::DEPTH_TEST);
            gl::PixelStorei(gl::UNPACK_ALIGNMENT, 1);
        }
        let white = texture(1, 1, &[255; 4]);
        Ok(Self {
            program,
            buffer,
            vao,
            white,
            atlases: Vec::new(),
            fonts,
            glyphs: HashMap::new(),
            textures: HashMap::new(),
            artwork_variants: HashMap::new(),
            vertices: Vec::with_capacity(65536),
            batches: Vec::new(),
            clip: None,
            frame: 0,
            stats: RenderStats::new(Size::HD),
            info: GraphicsInfo {
                vendor: gl_string(gl::VENDOR),
                renderer: gl_string(gl::RENDERER),
                version: gl_string(gl::VERSION),
                max_texture_size: max_texture_size.max(0) as u32,
                max_viewport,
                fragment_highp,
            },
        })
    }

    fn glyph(&mut self, c: char, size: u16, font: u16) -> Option<Glyph> {
        if let Some(glyph) = self.glyphs.get(&(c, size, font)) {
            if let Some(page) = glyph.page {
                self.atlases[page].used = self.frame;
            }
            return Some(*glyph);
        }
        let (metrics, bitmap) = self.fonts[&font].rasterize(c, f32::from(size) / 4.);
        self.stats.glyph_rasterizations += 1;
        if bitmap.is_empty() {
            let glyph = Glyph {
                metrics,
                uv: [0.; 4],
                page: None,
            };
            self.glyphs.insert((c, size, font), glyph);
            return Some(glyph);
        }
        let (page, x, y) = self.reserve_glyph(metrics.width, metrics.height)?;
        let atlas = &mut self.atlases[page];
        atlas.used = self.frame;
        let pixels: Vec<u8> = bitmap
            .iter()
            .flat_map(|alpha| [255, 255, 255, *alpha])
            .collect();
        if !pixels.is_empty() {
            unsafe {
                gl::BindTexture(gl::TEXTURE_2D, atlas.texture.id);
                gl::TexSubImage2D(
                    gl::TEXTURE_2D,
                    0,
                    x as i32,
                    y as i32,
                    metrics.width as i32,
                    metrics.height as i32,
                    gl::RGBA,
                    gl::UNSIGNED_BYTE,
                    pixels.as_ptr().cast(),
                );
            }
        }
        let glyph = Glyph {
            metrics,
            page: Some(page),
            uv: [
                x as f32 / atlas.texture.width as f32,
                y as f32 / atlas.texture.height as f32,
                (x + metrics.width) as f32 / atlas.texture.width as f32,
                (y + metrics.height) as f32 / atlas.texture.height as f32,
            ],
        };
        self.glyphs.insert((c, size, font), glyph);
        Some(glyph)
    }

    fn reserve_glyph(&mut self, width: usize, height: usize) -> Option<(usize, usize, usize)> {
        for (index, atlas) in self.atlases.iter_mut().enumerate() {
            if let Some((x, y)) = atlas
                .shelf
                .reserve(width, height, atlas.texture.width as usize)
            {
                return Some((index, x, y));
            }
        }
        let size = ATLAS
            .min(self.info.max_texture_size as usize)
            .max((width + 2).next_power_of_two())
            .max((height + 2).next_power_of_two());
        if size > self.info.max_texture_size as usize {
            self.stats.glyph_failures += 1;
            return None;
        }
        // Never recycle an atlas referenced by this frame's queued geometry.
        let recycle = if self.atlases.len() >= CACHED_ATLASES {
            recyclable_page(
                self.atlases
                    .iter()
                    .enumerate()
                    .map(|(index, page)| (index, page.used)),
                self.frame,
            )
        } else {
            None
        };
        let atlas = GlyphAtlas {
            texture: glyph_texture(size),
            shelf: Shelf::default(),
            used: self.frame,
        };
        let index = if let Some(index) = recycle {
            self.glyphs.retain(|_, glyph| glyph.page != Some(index));
            self.atlases[index] = atlas;
            index
        } else {
            self.atlases.push(atlas);
            self.atlases.len() - 1
        };
        let (x, y) = self.atlases[index].shelf.reserve(width, height, size)?;
        Some((index, x, y))
    }

    fn trim_atlases(&mut self) {
        for index in (0..self.atlases.len()).rev() {
            if self.atlases.len() <= CACHED_ATLASES {
                break;
            }
            if self.atlases[index].used == self.frame {
                continue;
            }
            let last = self.atlases.len() - 1;
            self.glyphs.retain(|_, glyph| glyph.page != Some(index));
            self.atlases.swap_remove(index);
            for glyph in self.glyphs.values_mut() {
                if glyph.page == Some(last) {
                    glyph.page = Some(index);
                }
            }
        }
    }

    fn quad(
        &mut self,
        rect: Rect,
        uv: [f32; 4],
        radius: f32,
        border: f32,
        color: Color,
        texture: GLuint,
    ) {
        self.gradient_quad(rect, uv, radius, border, [color, color], texture);
    }

    fn gradient_quad(
        &mut self,
        rect: Rect,
        uv: [f32; 4],
        radius: f32,
        border: f32,
        colors: [Color; 2],
        texture: GLuint,
    ) {
        if rect.w <= 0. || rect.h <= 0. {
            return;
        }
        let start = self.vertices.len() / 14;
        for (x, y) in [(0., 0.), (1., 0.), (0., 1.), (0., 1.), (1., 0.), (1., 1.)] {
            let color = colors[y as usize];
            self.vertices.extend_from_slice(&[
                rect.x + x * rect.w,
                rect.y + y * rect.h,
                uv[0] + x * (uv[2] - uv[0]),
                uv[1] + y * (uv[3] - uv[1]),
                color[0],
                color[1],
                color[2],
                color[3],
                (x - 0.5) * rect.w,
                (y - 0.5) * rect.h,
                rect.w / 2.,
                rect.h / 2.,
                radius,
                border,
            ]);
        }
        if let Some(batch) = self.batches.last_mut() {
            let same_clip = match (batch.clip, self.clip) {
                (None, None) => true,
                (Some(a), Some(b)) => a.x == b.x && a.y == b.y && a.w == b.w && a.h == b.h,
                _ => false,
            };
            if batch.texture == texture && same_clip {
                batch.count += 6;
                return;
            }
        }
        self.batches.push(Batch {
            texture,
            start,
            count: 6,
            clip: self.clip,
        });
    }

    fn text(&mut self, text: &str, rect: Rect, style: TextStyle, color: Color, centered: bool) {
        // Layout/kerning retain the exact logical CSS size. Only the physical
        // bitmap size is quantized for the glyph cache.
        let size_f = style.size;
        let viewport = self.stats.viewport;
        let physical_size = glyph_size(size_f, viewport.text_scale());
        self.stats.max_logical_font_px = self.stats.max_logical_font_px.max(size_f);
        self.stats.max_physical_font_px = self
            .stats
            .max_physical_font_px
            .max(f32::from(physical_size) / 4.);
        let font_id = style.weight + if style.size >= 32. { 1000 } else { 0 };
        let font = &self.fonts[&font_id];
        let line_height = size_f * style.line_height;
        let baseline = font.horizontal_line_metrics(size_f).map_or(size_f, |m| {
            (line_height - m.ascent + m.descent) / 2. + m.ascent
        });
        let tracking = style.tracking * size_f;
        let advance = |c| {
            if c == '\n' {
                0.
            } else {
                font.metrics(c, size_f).advance_width + tracking
            }
        };
        let mut lines: Vec<String> = Vec::new();
        let mut line = String::new();
        let mut width = 0.;
        // Word wrapping, with character fallback for a title wider than the tile.
        for word in text.split_inclusive(char::is_whitespace) {
            let word_width: f32 = word.chars().map(advance).sum();
            if width > 0. && width + word_width > rect.w {
                lines.push(line.trim_end().into());
                line.clear();
                width = 0.;
            }
            for c in word.chars() {
                if c == '\n' {
                    lines.push(line.trim_end().into());
                    line.clear();
                    width = 0.;
                    continue;
                }
                let w = advance(c);
                if width > 0. && width + w > rect.w {
                    lines.push(line.trim_end().into());
                    line.clear();
                    width = 0.;
                }
                line.push(c);
                width += w;
            }
        }
        if !line.is_empty() {
            lines.push(line.trim_end().into());
        }
        let mut placed = Vec::new();
        for (index, line) in lines.iter().enumerate() {
            let top = rect.y + index as f32 * line_height;
            if index > 0 && top + line_height > rect.y + rect.h + 1. {
                break;
            }
            let mut previous = None;
            let width: f32 = line
                .chars()
                .map(|c| {
                    let kern = previous
                        .and_then(|p| font.horizontal_kern(p, c, size_f))
                        .unwrap_or(0.);
                    previous = Some(c);
                    advance(c) + kern
                })
                .sum();
            let mut x = rect.x
                + if style.align_right {
                    rect.w - width
                } else if centered {
                    (rect.w - width) / 2.
                } else {
                    0.
                };
            let mut previous = None;
            for c in line.chars() {
                if let Some(previous) = previous {
                    x += font.horizontal_kern(previous, c, size_f).unwrap_or(0.);
                }
                placed.push((c, x, top + baseline));
                x += advance(c);
                previous = Some(c);
            }
        }
        for (c, x, baseline) in placed {
            if let Some(glyph) = self.glyph(c, physical_size, font_id)
                && let Some(page) = glyph.page
            {
                let m = glyph.metrics;
                self.quad(
                    viewport.glyph_rect(x, baseline, m),
                    glyph.uv,
                    -1., // Coverage is already antialiased; don't apply shape AA a second time.
                    0.,
                    color,
                    self.atlases[page].texture.id,
                );
            }
        }
    }

    fn image(&mut self, path: &str, mut rect: Rect, radius: f32, contain: bool, tint: Color) {
        let path = if self.stats.viewport.scale > 1.
            && self.info.max_texture_size >= 3840
            && Path::new(path)
                .parent()
                .and_then(Path::file_name)
                .is_some_and(|p| p == "wallpapers")
        {
            self.artwork_variants
                .entry(path.into())
                .or_insert_with(|| {
                    let original = Path::new(path);
                    let variant = original.with_file_name(format!(
                        "{}@2x.jpg",
                        original.file_stem().unwrap_or_default().to_string_lossy()
                    ));
                    if variant.is_file() {
                        variant.to_string_lossy().into_owned()
                    } else {
                        path.into()
                    }
                })
                .clone()
        } else {
            path.into()
        };
        if path.ends_with("@2x.jpg") {
            self.stats.high_resolution_wallpaper = true;
        }
        let frame = self.frame;
        let entry = self
            .textures
            .entry(path.clone())
            .or_insert_with(|| match image::open(&path) {
                Ok(image) => {
                    let image = image.into_rgba8();
                    Some(texture(image.width(), image.height(), image.as_raw()))
                }
                Err(error) => {
                    eprintln!("Artwork {path}: {error}");
                    None
                }
            });
        let Some(texture) = entry else {
            return;
        };
        texture.frame = frame;
        let id = texture.id;
        if contain {
            let scale = (rect.w / texture.width as f32).min(rect.h / texture.height as f32);
            let w = texture.width as f32 * scale;
            let h = texture.height as f32 * scale;
            rect = Rect::new(rect.x + (rect.w - w) / 2., rect.y + (rect.h - h) / 2., w, h);
        }
        self.quad(rect, [0., 0., 1., 1.], radius, 0., tint, id);
    }

    pub fn render(&mut self, commands: &[Draw], width: u32, height: u32) {
        let started = Instant::now();
        self.stats = RenderStats::new(Size::new(width, height));
        self.frame += 1;
        self.vertices.clear();
        self.batches.clear();
        self.clip = None;
        for command in commands {
            match command {
                Draw::Shape(rect, radius, border, color) => self.quad(
                    *rect,
                    [0., 0., 1., 1.],
                    *radius,
                    *border,
                    *color,
                    self.white.id,
                ),
                Draw::RoundedGradient(rect, radius, top, bottom) => self.gradient_quad(
                    *rect,
                    [0., 0., 1., 1.],
                    *radius,
                    0.,
                    [*top, *bottom],
                    self.white.id,
                ),
                Draw::Shadow(rect, radius, blur, color) => self.quad(
                    rect.inset(-*blur),
                    [0., 0., 1., 1.],
                    *radius,
                    -*blur,
                    *color,
                    self.white.id,
                ),
                Draw::Text(text, rect, size, color, centered) => {
                    self.text(text, *rect, *size, *color, *centered)
                }
                Draw::Image(path, rect, radius, contain) => {
                    self.image(path, *rect, *radius, *contain, [1.; 4])
                }
                Draw::TintedImage(path, rect, radius, contain, tint) => {
                    self.image(path, *rect, *radius, *contain, *tint)
                }
                Draw::Clip(clip) => self.clip = *clip,
            }
        }
        let Viewport {
            x: vx,
            y: vy,
            width: vw,
            height: vh,
            scale,
        } = self.stats.viewport;
        unsafe {
            gl::Disable(gl::SCISSOR_TEST);
            gl::Viewport(0, 0, width as i32, height as i32);
            gl::ClearColor(0.04, 0.04, 0.05, 1.);
            gl::Clear(gl::COLOR_BUFFER_BIT);
            gl::Viewport(vx, vy, vw, vh);
            gl::UseProgram(self.program);
            if self.vao != 0 {
                gl::BindVertexArray(self.vao);
            }
            gl::BindBuffer(gl::ARRAY_BUFFER, self.buffer);
            gl::BufferData(
                gl::ARRAY_BUFFER,
                (self.vertices.len() * size_of::<f32>()) as isize,
                self.vertices.as_ptr().cast(),
                gl::DYNAMIC_DRAW,
            );
            let mut offset = 0;
            for (index, size) in [2, 2, 4, 4, 2].into_iter().enumerate() {
                gl::EnableVertexAttribArray(index as u32);
                gl::VertexAttribPointer(
                    index as u32,
                    size,
                    gl::FLOAT,
                    gl::FALSE,
                    56,
                    (offset * size_of::<f32>()) as *const _,
                );
                offset += size as usize;
            }
            gl::Uniform1f(
                gl::GetUniformLocation(self.program, c"u_aa".as_ptr()),
                0.85 / scale.max(0.01),
            );
            gl::Uniform1i(
                gl::GetUniformLocation(self.program, c"u_texture".as_ptr()),
                0,
            );
            gl::ActiveTexture(gl::TEXTURE0);
            for batch in &self.batches {
                if let Some(clip) = batch.clip {
                    gl::Enable(gl::SCISSOR_TEST);
                    gl::Scissor(
                        vx + (clip.x * vw as f32 / 1920.).round() as i32,
                        vy + ((1080. - clip.y - clip.h) * vh as f32 / 1080.).round() as i32,
                        (clip.w * vw as f32 / 1920.).round() as i32,
                        (clip.h * vh as f32 / 1080.).round() as i32,
                    );
                } else {
                    gl::Disable(gl::SCISSOR_TEST);
                }
                gl::BindTexture(gl::TEXTURE_2D, batch.texture);
                gl::DrawArrays(gl::TRIANGLES, batch.start as i32, batch.count as i32);
            }
            gl::Disable(gl::SCISSOR_TEST);
        }
        // Keep the current scene, evict old full-resolution wallpapers before memory grows.
        let mut bytes: usize = self
            .textures
            .values()
            .flatten()
            .map(|t| t.width as usize * t.height as usize * 4)
            .sum();
        if bytes > TEXTURE_BUDGET {
            let mut old: Vec<_> = self
                .textures
                .iter()
                .filter_map(|(path, t)| {
                    t.as_ref()
                        .filter(|t| t.frame != self.frame)
                        .map(|t| (path.clone(), t.frame))
                })
                .collect();
            old.sort_by_key(|(_, frame)| *frame);
            for (path, _) in old {
                if bytes <= TEXTURE_BUDGET {
                    break;
                }
                if let Some(Some(t)) = self.textures.remove(&path) {
                    bytes -= t.width as usize * t.height as usize * 4;
                }
            }
        }
        self.trim_atlases();
        self.stats.cached_glyphs = self.glyphs.len();
        self.stats.glyph_atlas_pages = self.atlases.len();
        self.stats.glyph_atlas_bytes = self
            .atlases
            .iter()
            .map(|page| page.texture.width as usize * page.texture.height as usize * 4)
            .sum();
        self.stats.artwork_bytes = bytes;
        self.stats.draw_calls = self.batches.len();
        self.stats.cpu_submission_ms = started.elapsed().as_secs_f64() * 1000.;
    }

    pub fn stats(&self) -> &RenderStats {
        &self.stats
    }

    pub fn screenshot(&self, path: &Path, width: u32, height: u32) -> Result<(), String> {
        let mut pixels = vec![0; width as usize * height as usize * 4];
        unsafe {
            gl::ReadPixels(
                0,
                0,
                width as i32,
                height as i32,
                gl::RGBA,
                gl::UNSIGNED_BYTE,
                pixels.as_mut_ptr().cast(),
            );
        }
        let mut image = image::RgbaImage::from_raw(width, height, pixels)
            .ok_or("Invalid framebuffer dimensions")?;
        image::imageops::flip_vertical_in_place(&mut image);
        image.save(path).map_err(|e| e.to_string())
    }

    /// Capture the authored TV surface, independent of desktop HiDPI/window limits.
    pub fn capture(
        &mut self,
        commands: &[Draw],
        path: &Path,
        size: Size,
    ) -> Result<RenderStats, String> {
        if size.width > self.info.max_texture_size || size.height > self.info.max_texture_size
            || size.width > self.info.max_viewport[0] as u32 || size.height > self.info.max_viewport[1] as u32 {
            return Err(format!(
                "Capture {}x{} exceeds GPU limits: {}px texture, {:?} viewport",
                size.width, size.height, self.info.max_texture_size, self.info.max_viewport
            ));
        }
        let image = texture(size.width, size.height, &[]);
        let mut framebuffer = 0;
        unsafe {
            gl::GenFramebuffers(1, &mut framebuffer);
            gl::BindFramebuffer(gl::FRAMEBUFFER, framebuffer);
            gl::FramebufferTexture2D(
                gl::FRAMEBUFFER,
                gl::COLOR_ATTACHMENT0,
                gl::TEXTURE_2D,
                image.id,
                0,
            );
            if gl::CheckFramebufferStatus(gl::FRAMEBUFFER) != gl::FRAMEBUFFER_COMPLETE {
                gl::BindFramebuffer(gl::FRAMEBUFFER, 0);
                gl::DeleteFramebuffers(1, &framebuffer);
                return Err("Screenshot framebuffer is incomplete".into());
            }
        }
        self.render(commands, size.width, size.height);
        let stats = self.stats.clone();
        let result = self.screenshot(path, size.width, size.height);
        unsafe {
            gl::BindFramebuffer(gl::FRAMEBUFFER, 0);
            gl::DeleteFramebuffers(1, &framebuffer);
        }
        result.map(|_| stats)
    }
}

impl Drop for Renderer {
    fn drop(&mut self) {
        unsafe {
            gl::DeleteBuffers(1, &self.buffer);
            gl::DeleteProgram(self.program);
            if self.vao != 0 {
                gl::DeleteVertexArrays(1, &self.vao);
            }
        }
    }
}

fn texture(width: u32, height: u32, pixels: &[u8]) -> Texture {
    let mut id = 0;
    unsafe {
        gl::GenTextures(1, &mut id);
        gl::BindTexture(gl::TEXTURE_2D, id);
        gl::TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_MIN_FILTER, gl::LINEAR as i32);
        gl::TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_MAG_FILTER, gl::LINEAR as i32);
        gl::TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_WRAP_S, gl::CLAMP_TO_EDGE as i32);
        gl::TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_WRAP_T, gl::CLAMP_TO_EDGE as i32);
        gl::TexImage2D(
            gl::TEXTURE_2D,
            0,
            gl::RGBA as i32,
            width as i32,
            height as i32,
            0,
            gl::RGBA,
            gl::UNSIGNED_BYTE,
            if pixels.is_empty() {
                std::ptr::null()
            } else {
                pixels.as_ptr().cast()
            },
        );
    }
    Texture {
        id,
        width,
        height,
        frame: 0,
    }
}

fn glyph_texture(size: usize) -> Texture {
    // White RGB in transparent gutters prevents dark fringes under linear
    // filtering. Only alpha encodes grayscale glyph coverage.
    let pixels: Vec<u8> = [255, 255, 255, 0].repeat(size * size);
    texture(size as u32, size as u32, &pixels)
}

fn gl_string(name: GLenum) -> String {
    unsafe {
        let value = gl::GetString(name);
        if value.is_null() {
            "unknown".into()
        } else {
            CStr::from_ptr(value.cast()).to_string_lossy().into_owned()
        }
    }
}

fn compile(kind: GLenum, source: &str) -> Result<GLuint, String> {
    let source = CString::new(source).map_err(|e| e.to_string())?;
    unsafe {
        let shader = gl::CreateShader(kind);
        gl::ShaderSource(shader, 1, &source.as_ptr(), std::ptr::null());
        gl::CompileShader(shader);
        let mut success = 0;
        gl::GetShaderiv(shader, gl::COMPILE_STATUS, &mut success);
        if success == 0 {
            let mut log = vec![0u8; 4096];
            let mut len = 0;
            gl::GetShaderInfoLog(shader, log.len() as i32, &mut len, log.as_mut_ptr().cast());
            gl::DeleteShader(shader);
            return Err(format!(
                "Shader compilation: {}",
                String::from_utf8_lossy(&log[..len as usize])
            ));
        }
        Ok(shader)
    }
}

fn link(vertex: &str, fragment: &str) -> Result<GLuint, String> {
    let vertex = compile(gl::VERTEX_SHADER, vertex)?;
    let fragment = match compile(gl::FRAGMENT_SHADER, fragment) {
        Ok(fragment) => fragment,
        Err(error) => {
            unsafe {
                gl::DeleteShader(vertex);
            }
            return Err(error);
        }
    };
    unsafe {
        let program = gl::CreateProgram();
        gl::AttachShader(program, vertex);
        gl::AttachShader(program, fragment);
        for (index, name) in [c"a_position", c"a_uv", c"a_color", c"a_shape", c"a_params"]
            .iter()
            .enumerate()
        {
            gl::BindAttribLocation(program, index as u32, name.as_ptr());
        }
        gl::LinkProgram(program);
        gl::DeleteShader(vertex);
        gl::DeleteShader(fragment);
        let mut success = 0;
        gl::GetProgramiv(program, gl::LINK_STATUS, &mut success);
        if success == 0 {
            let mut log = vec![0u8; 4096];
            let mut len = 0;
            gl::GetProgramInfoLog(program, log.len() as i32, &mut len, log.as_mut_ptr().cast());
            gl::DeleteProgram(program);
            return Err(format!(
                "Shader linking: {}",
                String::from_utf8_lossy(&log[..len as usize])
            ));
        }
        Ok(program)
    }
}
