//! Logical layout is independent of drawable density. Only glyph bitmaps,
//! pixel alignment and the viewport use physical pixels.
use crate::state::Rect;
use fontdue::Metrics;
use serde::Serialize;
use std::str::FromStr;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub struct Size {
    pub width: u32,
    pub height: u32,
}
impl Size {
    pub const HD: Self = Self {
        width: 1920,
        height: 1080,
    };
    pub const UHD: Self = Self {
        width: 3840,
        height: 2160,
    };
    pub const fn new(width: u32, height: u32) -> Self {
        Self { width, height }
    }
    pub fn scale(self) -> f32 {
        (self.width as f32 / 1920.).min(self.height as f32 / 1080.)
    }
    pub fn is_4k(self) -> bool {
        self.width >= 3840 && self.height >= 2160
    }
}
impl FromStr for Size {
    type Err = String;
    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "1080p" => return Ok(Self::HD),
            "4k" => return Ok(Self::UHD),
            _ => {}
        }
        let (w, h) = value
            .split_once('x')
            .ok_or("Resolution must be 1080p, 4k, or WIDTHxHEIGHT")?;
        let width = w.parse::<u32>().map_err(|e| e.to_string())?;
        let height = h.parse::<u32>().map_err(|e| e.to_string())?;
        if !(640..=7680).contains(&width) || !(360..=4320).contains(&height) {
            return Err("Requested window must be between 640x360 and 7680x4320".into());
        }
        Ok(Self { width, height })
    }
}

#[derive(Clone, Copy, Debug, Serialize)]
pub struct Viewport {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub scale: f32,
}
impl Viewport {
    pub fn new(size: Size) -> Self {
        let scale = size.scale();
        let width = (1920. * scale).round() as i32;
        let height = (1080. * scale).round() as i32;
        Self {
            x: (size.width as i32 - width) / 2,
            y: (size.height as i32 - height) / 2,
            width,
            height,
            scale,
        }
    }
    pub fn text_scale(self) -> f32 {
        self.height as f32 / 1080.
    }
    pub fn glyph_rect(self, x: f32, baseline: f32, metrics: Metrics) -> Rect {
        // Integer GL viewport dimensions can differ fractionally from the fitted
        // scale on odd-sized windows. Align against each actual viewport axis.
        let sx = self.width as f32 / 1920.;
        let sy = self.text_scale();
        Rect::new(
            ((x * sx).round() + metrics.xmin as f32) / sx,
            ((baseline * sy).round() - metrics.height as f32 - metrics.ymin as f32) / sy,
            metrics.width as f32 / sx,
            metrics.height as f32 / sy,
        )
    }
}

/// Cache quarter-physical-pixel raster sizes, not quarter-logical-pixel sizes.
pub fn glyph_size(logical_size: f32, scale: f32) -> u16 {
    (logical_size * scale * 4.)
        .round()
        .clamp(1., u16::MAX as f32) as u16
}

pub fn recyclable_page(used: impl Iterator<Item = (usize, u64)>, current: u64) -> Option<usize> {
    used.filter(|(_, frame)| *frame != current)
        .min_by_key(|(_, frame)| *frame)
        .map(|(index, _)| index)
}

/// A shelf reserves transparent gutters so bilinear sampling never reaches a
/// neighboring glyph. Failed reservations leave the allocator unchanged.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Shelf {
    x: usize,
    y: usize,
    row: usize,
}
impl Shelf {
    pub fn reserve(&mut self, width: usize, height: usize, size: usize) -> Option<(usize, usize)> {
        if width + 2 > size || height + 2 > size {
            return None;
        }
        let mut next = *self;
        if next.x == 0 {
            next.x = 1;
            next.y = 1;
        }
        if next.x + width + 1 > size {
            next.x = 1;
            next.y += next.row + 2;
            next.row = 0;
        }
        if next.y + height + 1 > size {
            return None;
        }
        let position = (next.x, next.y);
        next.x += width + 2;
        next.row = next.row.max(height);
        *self = next;
        Some(position)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn density_changes_bitmaps_without_changing_logical_layout() {
        assert_eq!(glyph_size(20., Size::HD.scale()), 80);
        assert_eq!(glyph_size(20., Size::UHD.scale()), 160);
        let one = Viewport::new(Size::HD).glyph_rect(
            10.,
            40.,
            Metrics {
                width: 12,
                height: 18,
                xmin: 1,
                ymin: -3,
                ..Metrics::default()
            },
        );
        let two = Viewport::new(Size::UHD).glyph_rect(
            10.,
            40.,
            Metrics {
                width: 24,
                height: 36,
                xmin: 2,
                ymin: -6,
                ..Metrics::default()
            },
        );
        assert_eq!((one.x, one.y, one.w, one.h), (two.x, two.y, two.w, two.h));
    }
    #[test]
    fn fractional_density_preserves_pixel_aligned_bitmap_origins() {
        let viewport = Viewport::new(Size::new(2400, 1350));
        let rect = viewport.glyph_rect(
            12.3,
            42.7,
            Metrics {
                width: 15,
                height: 23,
                xmin: 1,
                ymin: -4,
                ..Metrics::default()
            },
        );
        assert!((rect.x * viewport.scale).fract().abs() < 0.0001);
        assert!((rect.y * viewport.scale).fract().abs() < 0.0001);
        assert_eq!(rect.w * viewport.scale, 15.);
    }
    #[test]
    fn a_letterboxed_drawable_uses_its_fitted_density() {
        let viewport = Viewport::new(Size::new(3840, 2400));
        assert_eq!(viewport.scale, 2.);
        assert_eq!(viewport.y, 120);
        assert_eq!(viewport.width, 3840);
        assert_eq!(viewport.height, 2160);
    }
    #[test]
    fn odd_viewport_sizes_do_not_blur_glyphs_on_the_rounded_axis() {
        let viewport = Viewport::new(Size::new(1281, 721));
        let rect = viewport.glyph_rect(
            12.3,
            42.7,
            Metrics {
                width: 10,
                height: 14,
                xmin: 1,
                ymin: -3,
                ..Metrics::default()
            },
        );
        for value in [
            rect.x * viewport.width as f32 / 1920.,
            rect.y * viewport.text_scale(),
        ] {
            assert!((value - value.round()).abs() < 0.0001);
        }
    }
    #[test]
    fn atlas_gutters_and_failed_allocations_are_stable() {
        let mut shelf = Shelf::default();
        assert_eq!(shelf.reserve(4, 4, 16), Some((1, 1)));
        assert_eq!(shelf.reserve(4, 4, 16), Some((7, 1)));
        assert_eq!(shelf.reserve(4, 4, 16), Some((1, 7)));
        let before = shelf;
        assert_eq!(shelf.reserve(20, 4, 16), None);
        assert_eq!(shelf, before);
    }
    #[test]
    fn requested_resolution_is_validated_separately_from_the_actual_drawable() {
        assert_eq!("4k".parse::<Size>().unwrap(), Size::UHD);
        assert_eq!("1280x720".parse::<Size>().unwrap(), Size::new(1280, 720));
        for invalid in ["0x0", "100000x2160", "3840", "-1x1080"] {
            assert!(invalid.parse::<Size>().is_err());
        }
        assert!(!Size::HD.is_4k());
        assert!(Size::UHD.is_4k());
    }
    #[test]
    fn recycling_does_not_invalidate_this_frames_queued_text() {
        assert_eq!(
            recyclable_page([10, 7, 8, 10].into_iter().enumerate(), 10),
            Some(1)
        );
        assert_eq!(
            recyclable_page([10, 10, 10, 10].into_iter().enumerate(), 10),
            None
        );
    }
}
