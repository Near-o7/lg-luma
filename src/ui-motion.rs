//! Presentation-only motion. Logical destinations stay immediate for navigation.
use crate::state::{Page, State, Subpage, Target};
use std::time::{Duration, Instant};

#[derive(Default)]
pub struct Tween {
    value: f32,
    from: f32,
    target: f32,
    elapsed: Duration,
    duration: Duration,
    updated: Option<Instant>,
}

impl Tween {
    pub fn value(&self, fallback: f32) -> f32 {
        if self.updated.is_some() {
            self.value
        } else {
            fallback
        }
    }
    pub fn active(&self) -> bool {
        self.updated.is_some() && self.value != self.target
    }
    pub fn snap(&mut self, value: f32, now: Instant) {
        self.value = value;
        self.from = value;
        self.target = value;
        self.elapsed = Duration::ZERO;
        self.updated = Some(now);
    }
    pub fn sync(
        &mut self,
        target: f32,
        now: Instant,
        duration: Duration,
        snap: bool,
        paused: bool,
    ) {
        if self.updated.is_none() || snap {
            self.snap(target, now);
            return;
        }
        let dt = now.saturating_duration_since(self.updated.unwrap());
        self.updated = Some(now);
        if self.target != target {
            self.from = self.value;
            self.target = target;
            self.elapsed = Duration::ZERO;
            self.duration = duration;
        } else if !paused {
            self.elapsed = (self.elapsed + dt).min(self.duration);
        }
        if !paused {
            let t = (self.elapsed.as_secs_f32() / self.duration.as_secs_f32().max(0.001)).min(1.);
            let eased = 1. - (1. - t).powi(3);
            self.value = self.from + (self.target - self.from) * eased;
        }
    }
}

#[derive(Clone, PartialEq)]
pub struct Screen {
    pub page: Page,
    section: usize,
    subpage: Option<Subpage>,
    filter: usize,
}
impl Screen {
    pub fn of(state: &State) -> Self {
        Self {
            page: state.page,
            section: if state.page == Page::Settings {
                state.section
            } else {
                0
            },
            subpage: if state.page == Page::Settings {
                state.subpage.clone()
            } else {
                None
            },
            filter: if state.page == Page::Apps {
                state.filter
            } else {
                0
            },
        }
    }
    pub fn direction_from(&self, old: &Self) -> f32 {
        let index = |page| match page {
            Page::Home => 0,
            Page::Apps => 1,
            Page::Settings => 2,
        };
        if index(self.page) > index(old.page)
            || (self.page == old.page
                && (self.section > old.section
                    || (self.subpage.is_some() && old.subpage.is_none())))
        {
            1.
        } else {
            -1.
        }
    }
}

#[derive(Default)]
struct Highlights(Vec<(Target, Tween)>);
impl Highlights {
    fn sync(
        &mut self,
        target: Option<&Target>,
        now: Instant,
        duration: Duration,
        reduced: bool,
        initial_focus: bool,
    ) {
        if let Some(target) = target
            && !self.0.iter().any(|(key, _)| key == target)
        {
            let mut value = Tween::default();
            value.snap(
                if initial_focus && self.0.is_empty() {
                    1.
                } else {
                    0.
                },
                now,
            );
            self.0.push((target.clone(), value));
        }
        for (key, tween) in &mut self.0 {
            tween.sync(
                f32::from(Some(&*key) == target),
                now,
                duration,
                reduced,
                false,
            );
        }
        self.0
            .retain(|(key, tween)| Some(key) == target || tween.value(0.) > 0.);
        // Rapid input cannot retain an unbounded history of old selections.
        while self.0.len() > 8 {
            self.0.remove(0);
        }
    }
    fn level(&self, target: &Target, fallback: f32) -> f32 {
        if self.0.is_empty() {
            fallback
        } else {
            self.0
                .iter()
                .find(|(key, _)| key == target)
                .map_or(0., |(_, tween)| tween.value(0.))
        }
    }
    fn active(&self) -> bool {
        self.0.iter().any(|(_, tween)| tween.active())
    }
}

pub struct Frame<'a> {
    pub screen: Screen,
    pub scroll: [f32; 2],
    pub focus: &'a Target,
    pub pressed: Option<&'a Target>,
    pub shading: f32,
    pub reduced: bool,
    pub blocked: bool,
    pub held: bool,
}

#[derive(Default)]
pub struct Motion {
    screen: Option<Screen>,
    pub vertical: Tween,
    pub horizontal: Tween,
    pub page: Tween,
    shading: Tween,
    focus: Highlights,
    press: Highlights,
    pub direction: f32,
    paused: bool,
}
impl Motion {
    pub fn sync(&mut self, frame: Frame<'_>, now: Instant) {
        let Frame {
            screen,
            scroll,
            focus,
            pressed,
            shading,
            reduced,
            blocked,
            held,
        } = frame;
        let changed = self.screen.as_ref() != Some(&screen);
        let first = self.screen.is_none();
        if changed {
            self.direction = self
                .screen
                .as_ref()
                .map_or(1., |old| screen.direction_from(old));
            self.screen = Some(screen);
            self.page
                .snap(if first || reduced || blocked { 1. } else { 0. }, now);
        }
        self.paused = held;
        self.vertical.sync(
            scroll[0],
            now,
            Duration::from_millis(180),
            reduced || changed || blocked,
            held,
        );
        self.horizontal.sync(
            scroll[1],
            now,
            Duration::from_millis(180),
            reduced || changed || blocked,
            held,
        );
        self.page.sync(
            1.,
            now,
            Duration::from_millis(190),
            reduced || blocked,
            held,
        );
        self.shading
            .sync(shading, now, Duration::from_millis(220), reduced, false);
        self.focus
            .sync(Some(focus), now, Duration::from_millis(120), reduced, true);
        self.press
            .sync(pressed, now, Duration::from_millis(85), reduced, false);
    }
    pub fn focus(&self, target: &Target, focused: bool) -> f32 {
        self.focus.level(target, f32::from(focused))
    }
    pub fn press(&self, target: &Target) -> f32 {
        self.press.level(target, 0.)
    }
    pub fn shading(&self, fallback: f32) -> f32 {
        self.shading.value(fallback)
    }
    pub fn animating(&self) -> bool {
        (!self.paused && (self.vertical.active() || self.horizontal.active() || self.page.active()))
            || self.shading.active()
            || self.focus.active()
            || self.press.active()
    }
    pub fn screen(&self) -> Option<&Screen> {
        self.screen.as_ref()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn retargeting_scroll_is_continuous_and_finishes_at_the_logical_destination() {
        let now = Instant::now();
        let mut tween = Tween::default();
        tween.snap(0., now);
        tween.sync(200., now, Duration::from_millis(180), false, false);
        tween.sync(
            200.,
            now + Duration::from_millis(90),
            Duration::from_millis(180),
            false,
            false,
        );
        let before = tween.value(0.);
        assert!(before > 0. && before < 200.);
        tween.sync(
            400.,
            now + Duration::from_millis(90),
            Duration::from_millis(180),
            false,
            false,
        );
        assert_eq!(tween.value(0.), before);
        tween.sync(
            400.,
            now + Duration::from_millis(270),
            Duration::from_millis(180),
            false,
            false,
        );
        assert_eq!(tween.value(0.), 400.);
        assert!(!tween.active());
    }
    #[test]
    fn a_held_pointer_freezes_scroll_without_accumulating_time() {
        let now = Instant::now();
        let mut tween = Tween::default();
        tween.snap(0., now);
        tween.sync(300., now, Duration::from_millis(180), false, false);
        tween.sync(
            300.,
            now + Duration::from_millis(90),
            Duration::from_millis(180),
            false,
            false,
        );
        let frozen = tween.value(0.);
        tween.sync(
            300.,
            now + Duration::from_secs(5),
            Duration::from_millis(180),
            false,
            true,
        );
        tween.sync(
            300.,
            now + Duration::from_secs(5),
            Duration::from_millis(180),
            false,
            false,
        );
        assert_eq!(tween.value(0.), frozen);
    }
    #[test]
    fn rapid_focus_changes_keep_a_bounded_fading_history() {
        let now = Instant::now();
        let mut values = Highlights::default();
        for i in 0..100 {
            values.sync(
                Some(&Target::Choice(i)),
                now + Duration::from_millis(i as u64 * 3),
                Duration::from_millis(120),
                false,
                true,
            );
            assert!(values.0.len() <= 8);
        }
        values.sync(
            Some(&Target::Choice(99)),
            now + Duration::from_secs(1),
            Duration::from_millis(120),
            false,
            true,
        );
        assert_eq!(values.0.len(), 1);
        assert!(!values.active());
    }
}
