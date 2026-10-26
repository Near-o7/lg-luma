//! Reserve HDMI space only while at least one Home input is visible.
use std::time::{Duration, Instant};

#[derive(Default)]
pub struct Layout {
    target: Option<bool>,
    space: f32,
    from: f32,
    alpha: f32,
    elapsed: Duration,
    updated: Option<Instant>,
}

impl Layout {
    const MOVE: Duration = Duration::from_millis(320);
    const REVEAL: Duration = Duration::from_millis(120);

    pub fn space(&self, visible: bool) -> f32 {
        self.target.map_or(f32::from(visible), |_| self.space)
    }

    pub fn alpha(&self) -> f32 {
        self.target.map_or(1., |_| self.alpha)
    }

    /// Initial inventory and off-screen changes start settled, avoiding a startup bounce.
    pub fn settle(&mut self, visible: bool) {
        self.target = Some(visible);
        self.space = f32::from(visible);
        self.from = self.space;
        self.alpha = self.space;
        self.elapsed = Self::MOVE + Self::REVEAL;
        self.updated = None;
    }

    pub fn animating(&self) -> bool {
        self.target
            .is_some_and(|target| self.space != f32::from(target) || (target && self.alpha < 1.))
    }

    pub fn update(&mut self, visible: bool, animate: bool, paused: bool, now: Instant) -> bool {
        let previous = (self.space, self.alpha);
        if paused && self.target.is_some() {
            self.updated = Some(now);
            return false;
        }
        if self.target.is_none() || !animate {
            self.settle(visible);
            self.updated = Some(now);
            return previous != (self.space, self.alpha);
        }
        let dt = self
            .updated
            .map_or(Duration::ZERO, |last| now.saturating_duration_since(last));
        self.updated = Some(now);
        if self.target != Some(visible) {
            self.target = Some(visible);
            self.from = self.space;
            self.elapsed = Duration::ZERO;
            self.alpha = 0.;
        } else {
            self.elapsed = (self.elapsed + dt).min(Self::MOVE + Self::REVEAL);
        }
        let ease = |value: f32| {
            let t = value.clamp(0., 1.);
            t * t * (3. - 2. * t)
        };
        let amount = ease(self.elapsed.as_secs_f32() / Self::MOVE.as_secs_f32());
        self.space = self.from + (f32::from(visible) - self.from) * amount;
        // Reveal cards only after their complete rectangles fit. Disconnected
        // cards leave immediately and cannot be activated while the grid expands.
        self.alpha = if visible {
            ease(self.elapsed.saturating_sub(Self::MOVE).as_secs_f32() / Self::REVEAL.as_secs_f32())
        } else {
            0.
        };
        previous != (self.space, self.alpha)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_inventory_is_settled_and_idle_does_not_animate() {
        let mut layout = Layout::default();
        layout.update(true, true, false, Instant::now());
        assert_eq!(layout.space(true), 1.);
        assert_eq!(layout.alpha(), 1.);
        assert!(!layout.animating());
    }

    #[test]
    fn connection_makes_room_before_revealing_complete_cards() {
        let now = Instant::now();
        let mut layout = Layout::default();
        layout.settle(false);
        layout.update(true, true, false, now);
        assert!(layout.animating());
        layout.update(true, true, false, now + Duration::from_millis(160));
        assert_eq!(layout.space(true), 0.5);
        assert_eq!(layout.alpha(), 0.);
        layout.update(true, true, false, now + Layout::MOVE);
        assert_eq!(layout.space(true), 1.);
        assert_eq!(layout.alpha(), 0.);
        layout.update(true, true, false, now + Duration::from_millis(380));
        assert_eq!(layout.alpha(), 0.5);
        layout.update(true, true, false, now + Duration::from_millis(440));
        assert_eq!(layout.alpha(), 1.);
        assert!(!layout.animating());
    }

    #[test]
    fn disconnection_releases_space_smoothly_and_removes_interaction_immediately() {
        let now = Instant::now();
        let mut layout = Layout::default();
        layout.settle(true);
        layout.update(false, true, false, now);
        assert_eq!(layout.space(false), 1.);
        assert_eq!(layout.alpha(), 0.);
        layout.update(false, true, false, now + Duration::from_millis(160));
        assert_eq!(layout.space(false), 0.5);
        layout.update(false, true, false, now + Duration::from_millis(320));
        assert_eq!(layout.space(false), 0.);
        assert!(!layout.animating());
    }

    #[test]
    fn a_reversed_transition_starts_from_the_current_position() {
        let now = Instant::now();
        let mut layout = Layout::default();
        layout.settle(false);
        layout.update(true, true, false, now);
        layout.update(true, true, false, now + Duration::from_millis(160));
        layout.update(false, true, false, now + Duration::from_millis(160));
        assert_eq!(layout.space(false), 0.5);
        layout.update(false, true, false, now + Duration::from_millis(320));
        assert_eq!(layout.space(false), 0.25);
    }

    #[test]
    fn pointer_holds_pause_geometry_without_a_catch_up_jump() {
        let now = Instant::now();
        let mut layout = Layout::default();
        layout.settle(false);
        layout.update(true, true, false, now);
        layout.update(true, true, false, now + Duration::from_millis(160));
        assert_eq!(layout.space(true), 0.5);
        layout.update(true, true, true, now + Duration::from_secs(5));
        assert_eq!(layout.space(true), 0.5);
        layout.update(true, true, false, now + Duration::from_secs(5));
        assert_eq!(layout.space(true), 0.5);
        layout.update(false, false, true, now + Duration::from_secs(6));
        assert_eq!(layout.space(false), 0.5);
        layout.update(false, false, false, now + Duration::from_secs(6));
        assert_eq!(layout.space(false), 0.);
    }

    #[test]
    fn reduced_motion_or_other_pages_snap_to_the_target() {
        let now = Instant::now();
        let mut layout = Layout::default();
        layout.settle(false);
        layout.update(true, false, false, now);
        assert_eq!(layout.space(true), 1.);
        assert_eq!(layout.alpha(), 1.);
        assert!(!layout.animating());
        layout.update(false, false, false, now);
        assert_eq!(layout.space(false), 0.);
        assert!(!layout.animating());
    }
}
