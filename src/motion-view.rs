//! A bounded snapshot of displayed content for interruptible screen transitions.
use crate::{
    renderer::{Color, Draw},
    state::State,
    ui_motion::Screen,
    view::Scene,
};

pub fn translate(draws: &mut [Draw], dx: f32, dy: f32) {
    for draw in draws {
        let rect = match draw {
            Draw::Shape(r, ..)
            | Draw::RoundedGradient(r, ..)
            | Draw::Shadow(r, ..)
            | Draw::Text(_, r, ..)
            | Draw::Image(_, r, ..)
            | Draw::TintedImage(_, r, ..)
            | Draw::AppImage(_, r, ..) => r,
            // Clips and edge fades remain attached to the screen viewport.
            Draw::Clip(_) | Draw::EdgeFade(_) | Draw::EdgeFadeX(_) => continue,
        };
        rect.x += dx;
        rect.y += dy;
    }
}

pub fn fade(draws: &mut [Draw], alpha: f32, brightness: f32) {
    for draw in draws {
        let apply = |color: &mut Color| {
            for channel in &mut color[..3] {
                *channel *= brightness;
            }
            color[3] *= alpha;
        };
        match draw {
            Draw::Shape(_, _, _, color)
            | Draw::Shadow(_, _, _, color)
            | Draw::Text(_, _, _, color, _)
            | Draw::TintedImage(_, _, _, _, color)
            | Draw::AppImage(_, _, color) => apply(color),
            Draw::RoundedGradient(_, _, a, b) => {
                apply(a);
                apply(b);
            }
            Draw::Image(path, rect, radius, contain) => {
                *draw = Draw::TintedImage(
                    path.clone(),
                    *rect,
                    *radius,
                    *contain,
                    [brightness, brightness, brightness, alpha],
                );
            }
            Draw::Clip(_) | Draw::EdgeFade(_) | Draw::EdgeFadeX(_) => {}
        }
    }
}

pub fn mix(a: Color, b: Color, t: f32) -> Color {
    std::array::from_fn(|i| a[i] + (b[i] - a[i]) * t)
}

fn visible(draw: &Draw) -> bool {
    match draw {
        Draw::Shape(_, _, _, c)
        | Draw::Shadow(_, _, _, c)
        | Draw::Text(_, _, _, c, _)
        | Draw::TintedImage(_, _, _, _, c)
        | Draw::AppImage(_, _, c) => c[3] > 0.003,
        Draw::RoundedGradient(_, _, a, b) => a[3].max(b[3]) > 0.003,
        _ => true,
    }
}

#[derive(Default)]
pub struct Presenter {
    key: Option<Screen>,
    last_displayed: Vec<Draw>,
    outgoing: Vec<Draw>,
}
impl Presenter {
    const MAX_COMMANDS: usize = 4096;

    pub fn apply(&mut self, scene: &mut Scene, state: &State) {
        let key = state
            .motion
            .screen()
            .cloned()
            .unwrap_or_else(|| Screen::of(state));
        let blocked = state.preferences.reduced_motion
            || state.overlay.is_some()
            || state.recents.visibility > 0.;
        if self.key.as_ref() != Some(&key) {
            self.outgoing = if blocked {
                vec![]
            } else {
                self.last_displayed.clone()
            };
            self.key = Some(key);
        }
        let progress = state.motion.page.value(1.);
        if blocked || progress >= 1. {
            self.outgoing.clear();
        }
        if self.outgoing.is_empty() {
            return;
        }
        let range = scene.content_draw.clone();
        let incoming_dx = state.motion.direction * 18. * (1. - progress);
        translate(&mut scene.draw[range.clone()], incoming_dx, 0.);
        fade(&mut scene.draw[range.clone()], progress, 1.);
        if progress <= 0.1 {
            scene.controls.drain(scene.content_controls.clone());
        } else {
            for control in &mut scene.controls[scene.content_controls.clone()] {
                control.rect.x += incoming_dx;
            }
        }
        let mut previous = self.outgoing.clone();
        translate(&mut previous, -state.motion.direction * 10. * progress, 0.);
        fade(&mut previous, 1. - progress, 1.);
        let length = previous.len();
        scene.draw.splice(range.start..range.start, previous);
        scene.content_draw.end += length;
    }

    /// Only retain content that was actually presented, never an unpainted intermediate layout.
    pub fn presented(&mut self, scene: &Scene, state: &State) {
        if state.overlay.is_some() || state.recents.visibility > 0. {
            self.last_displayed.clear();
            return;
        }
        let content = &scene.draw[scene.content_draw.clone()];
        if content.len() > Self::MAX_COMMANDS {
            self.last_displayed.clear();
            self.outgoing.clear();
            return;
        }
        self.last_displayed = content.iter().filter(|d| visible(d)).cloned().collect();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::Rect;
    #[test]
    fn moving_content_does_not_move_its_clip_or_fade_boundaries() {
        let rect = Rect::new(10., 20., 100., 40.);
        let mut draw = vec![
            Draw::Clip(Some(rect)),
            Draw::Shape(rect, 4., 0., [1.; 4]),
            Draw::EdgeFadeX(Some([0., 10., 90., 100.])),
        ];
        translate(&mut draw, 12., 30.);
        assert!(matches!(draw[0],Draw::Clip(Some(r)) if r.x==10. && r.y==20.));
        assert!(matches!(draw[1],Draw::Shape(r,..) if r.x==22. && r.y==50.));
        assert!(matches!(draw[2],Draw::EdgeFadeX(Some(v)) if v[1]==10.));
    }
}
