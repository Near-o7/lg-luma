//! Bounded HDMI polling: cable/signal changes must arrive without reopening Home.
use std::time::{Duration, Instant};

#[derive(Default)]
pub struct Refresh {
    next: Option<Instant>,
    in_flight: bool,
}

impl Refresh {
    const INTERVAL: Duration = Duration::from_secs(2);
    const RETRY: Duration = Duration::from_secs(10);

    /// The worker is shared with launches. Never queue a second poll behind a
    /// slow service call, and do no background work while Home is unfocused.
    pub fn due(&mut self, now: Instant, active: bool) -> bool {
        if !active {
            self.next = None;
            return false;
        }
        if self.in_flight {
            return false;
        }
        let next = self.next.get_or_insert(now + Self::INTERVAL);
        if now < *next {
            return false;
        }
        self.in_flight = true;
        true
    }

    pub fn completed(&mut self, now: Instant, success: bool) {
        self.in_flight = false;
        self.next = Some(now + if success { Self::INTERVAL } else { Self::RETRY });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_one_request_can_wait_on_the_worker() {
        let now = Instant::now();
        let mut refresh = Refresh::default();
        assert!(!refresh.due(now, true));
        assert!(refresh.due(now + Duration::from_secs(2), true));
        assert!(!refresh.due(now + Duration::from_secs(60), true));
        refresh.completed(now + Duration::from_secs(60), true);
        assert!(!refresh.due(now + Duration::from_secs(61), true));
        assert!(refresh.due(now + Duration::from_secs(62), true));
    }

    #[test]
    fn hidden_and_unfocused_home_waits_until_it_is_visible_again() {
        let now = Instant::now();
        let mut refresh = Refresh::default();
        assert!(!refresh.due(now, true));
        assert!(!refresh.due(now + Duration::from_secs(5), false));
        assert!(!refresh.due(now + Duration::from_secs(60), false));
        assert!(!refresh.due(now + Duration::from_secs(61), true));
        assert!(refresh.due(now + Duration::from_secs(63), true));
        assert!(!refresh.due(now + Duration::from_secs(64), false));
        assert!(!refresh.due(now + Duration::from_secs(65), true));
        refresh.completed(now + Duration::from_secs(65), true);
        assert!(refresh.due(now + Duration::from_secs(67), true));
    }

    #[test]
    fn errors_back_off_before_trying_again() {
        let now = Instant::now();
        let mut refresh = Refresh::default();
        assert!(!refresh.due(now, true));
        assert!(refresh.due(now + Duration::from_secs(2), true));
        refresh.completed(now + Duration::from_secs(3), false);
        assert!(!refresh.due(now + Duration::from_secs(5), true));
        assert!(!refresh.due(now + Duration::from_secs(12), true));
        assert!(refresh.due(now + Duration::from_secs(13), true));
    }
}
