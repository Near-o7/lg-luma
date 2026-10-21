//! A small GLES2-compatible GPU painter. Rust owns the draw list and glyph atlas;
//! SDL only supplies the context. No browser, LVGL, Qt or copied PlxNative code.
use crate::state::Rect;
use fontdue::{Font, Metrics};
use gl::types::*;
use std::{collections::HashMap, ffi::CString, path::Path};

pub type Color = [f32; 4];
pub const WHITE: Color = [0.96, 0.96, 0.96, 1.];
pub const MUTED: Color = [0.72, 0.73, 0.75, 1.];
const ATLAS: usize = 2048;
const TEXTURE_BUDGET: usize = 48 * 1024 * 1024;

#[derive(Clone)]
pub enum Draw {
    Shape(Rect, f32, f32, Color),
    Gradient(Rect, Color, Color),
    Text(String, Rect, f32, Color, bool),
    Image(String, Rect, f32, bool),
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
    atlas: Texture,
    font: Font,
    glyphs: HashMap<(char, u16), Glyph>,
    atlas_cursor: (usize, usize, usize),
    textures: HashMap<String, Option<Texture>>,
    vertices: Vec<f32>,
    batches: Vec<Batch>,
    clip: Option<Rect>,
    frame: u64,
}

impl Renderer {
    pub fn new(font: &Path, gles: bool) -> Result<Self, String> {
        let font = Font::from_bytes(
            std::fs::read(font).map_err(|e| {
                format!(
                    "Font {}: {e}. Run node native/tools/assets.mjs first.",
                    font.display()
                )
            })?,
            fontdue::FontSettings::default(),
        )
        .map_err(str::to_string)?;
        let vertex = if gles {
            "#version 100\n"
        } else {
            "#version 150\n#define attribute in\n#define varying out\n"
        }
        .to_owned()
            + include_str!("shaders/paint.vert");
        let fragment = if gles { "#version 100\nprecision mediump float;\n" } else { "#version 150\n#define varying in\n#define texture2D texture\nout vec4 out_color;\n#define gl_FragColor out_color\n" }.to_owned() + include_str!("shaders/paint.frag");
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
            gl::BlendFunc(gl::SRC_ALPHA, gl::ONE_MINUS_SRC_ALPHA);
            gl::Disable(gl::DEPTH_TEST);
            gl::PixelStorei(gl::UNPACK_ALIGNMENT, 1);
        }
        let white = texture(1, 1, &[255; 4]);
        let atlas = texture(ATLAS as u32, ATLAS as u32, &vec![0; ATLAS * ATLAS * 4]);
        Ok(Self {
            program,
            buffer,
            vao,
            white,
            atlas,
            font,
            glyphs: HashMap::new(),
            atlas_cursor: (1, 1, 0),
            textures: HashMap::new(),
            vertices: Vec::with_capacity(65536),
            batches: Vec::new(),
            clip: None,
            frame: 0,
        })
    }

    fn glyph(&mut self, c: char, size: u16) -> Option<Glyph> {
        if let Some(glyph) = self.glyphs.get(&(c, size)) {
            return Some(*glyph);
        }
        let (metrics, bitmap) = self.font.rasterize(c, f32::from(size));
        let (mut x, mut y, mut row) = self.atlas_cursor;
        if x + metrics.width + 1 >= ATLAS {
            x = 1;
            y += row + 2;
            row = 0;
        }
        if y + metrics.height + 1 >= ATLAS {
            return None;
        }
        let pixels: Vec<u8> = bitmap
            .iter()
            .flat_map(|alpha| [255, 255, 255, *alpha])
            .collect();
        if !pixels.is_empty() {
            unsafe {
                gl::BindTexture(gl::TEXTURE_2D, self.atlas.id);
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
            uv: [
                x as f32 / ATLAS as f32,
                y as f32 / ATLAS as f32,
                (x + metrics.width) as f32 / ATLAS as f32,
                (y + metrics.height) as f32 / ATLAS as f32,
            ],
        };
        self.atlas_cursor = (x + metrics.width + 2, y, row.max(metrics.height));
        self.glyphs.insert((c, size), glyph);
        Some(glyph)
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

    fn text(&mut self, text: &str, rect: Rect, size: f32, color: Color, centered: bool) {
        let size = size.round() as u16;
        let size_f = f32::from(size);
        let ascent = self
            .font
            .horizontal_line_metrics(size_f)
            .map_or(size_f, |m| m.ascent);
        let advance = |c| {
            if c == '\n' {
                0.
            } else {
                self.font.metrics(c, size_f).advance_width
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
        for (index, line) in lines.iter().enumerate() {
            let top = rect.y + index as f32 * size_f * 1.25;
            if top + size_f > rect.y + rect.h + 1. {
                break;
            }
            let width: f32 = line
                .chars()
                .map(|c| self.font.metrics(c, size_f).advance_width)
                .sum();
            let mut x = rect.x + if centered { (rect.w - width) / 2. } else { 0. };
            for c in line.chars() {
                if let Some(glyph) = self.glyph(c, size) {
                    let m = glyph.metrics;
                    self.quad(
                        Rect::new(
                            x + m.xmin as f32,
                            top + ascent - (m.height as f32 + m.ymin as f32),
                            m.width as f32,
                            m.height as f32,
                        ),
                        glyph.uv,
                        0.,
                        0.,
                        color,
                        self.atlas.id,
                    );
                    x += m.advance_width;
                }
            }
        }
    }

    fn image(&mut self, path: &str, mut rect: Rect, radius: f32, contain: bool) {
        let frame = self.frame;
        let entry = self
            .textures
            .entry(path.into())
            .or_insert_with(|| match image::open(path) {
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
        self.quad(rect, [0., 0., 1., 1.], radius, 0., WHITE, id);
    }

    pub fn render(&mut self, commands: &[Draw], width: u32, height: u32) {
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
                Draw::Gradient(rect, top, bottom) => self.gradient_quad(
                    *rect,
                    [0., 0., 1., 1.],
                    0.,
                    0.,
                    [*top, *bottom],
                    self.white.id,
                ),
                Draw::Text(text, rect, size, color, centered) => {
                    self.text(text, *rect, *size, *color, *centered)
                }
                Draw::Image(path, rect, radius, contain) => {
                    self.image(path, *rect, *radius, *contain)
                }
                Draw::Clip(clip) => self.clip = *clip,
            }
        }
        let scale = (width as f32 / 1920.).min(height as f32 / 1080.);
        let vw = (1920. * scale).round() as i32;
        let vh = (1080. * scale).round() as i32;
        let vx = (width as i32 - vw) / 2;
        let vy = (height as i32 - vh) / 2;
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
                        vx + (clip.x * scale).round() as i32,
                        vy + ((1080. - clip.y - clip.h) * scale).round() as i32,
                        (clip.w * scale).round() as i32,
                        (clip.h * scale).round() as i32,
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
            pixels.as_ptr().cast(),
        );
    }
    Texture {
        id,
        width,
        height,
        frame: 0,
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
