//! Bounded HDMI polling: cable/signal changes must arrive without reopening Home.
use std::time::{Duration, Instant};

#[derive(Default)]
pub struct Refresh {
    next: Option<Instant>,
    in_flight: bool,
    urgent: bool,
    pending_signal: bool,
    fast_until: Option<Instant>,
}

impl Refresh {
    const INTERVAL: Duration = Duration::from_secs(2);
    const RETRY: Duration = Duration::from_secs(10);
    const FAST: Duration = Duration::from_millis(250);
    const HANDSHAKE: Duration = Duration::from_secs(10);

    /// An EIM event invalidates the inventory, without trusting an old snapshot.
    pub fn request_now(&mut self, now: Instant) {
        self.urgent = true;
        self.next = Some(now);
    }

    /// EIM activation arrives before signal and does not always notify signal
    /// changes. Briefly read more often, then return to the normal idle cadence.
    pub fn observe(&mut self, now: Instant, pending_signal: bool) {
        if pending_signal && !self.pending_signal {
            self.fast_until = Some(now + Self::HANDSHAKE);
        } else if !pending_signal {
            self.fast_until = None;
        }
        self.pending_signal = pending_signal;
    }

    /// The worker is shared with launches. Never queue a second poll behind a
    /// slow service call, and do no background work while Home is unfocused.
    pub fn due(&mut self, now: Instant, active: bool) -> bool {
        if !active {
            self.next = None;
            self.urgent = false;
            self.pending_signal = false;
            self.fast_until = None;
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
        self.urgent = false;
        true
    }

    pub fn completed(&mut self, now: Instant, success: bool) {
        self.in_flight = false;
        let delay = if self.urgent {
            Duration::ZERO
        } else if !success {
            Self::RETRY
        } else if self.fast_until.is_some_and(|until| now < until) {
            Self::FAST
        } else {
            Self::INTERVAL
        };
        self.next = Some(now + delay);
    }
}

#[derive(Default)]
pub struct Watch {
    generation: u64,
    active: bool,
    retry: Option<Instant>,
}

impl Watch {
    pub fn command(&mut self, now: Instant, enabled: bool) -> Option<(u64, bool)> {
        if !enabled {
            self.retry = None;
            if !self.active {
                return None;
            }
            self.active = false;
        } else {
            if self.active || self.retry.is_some_and(|at| now < at) {
                return None;
            }
            self.active = true;
            self.retry = None;
        }
        self.generation += 1;
        Some((self.generation, enabled))
    }

    pub fn accepts(&self, generation: u64) -> bool {
        self.active && self.generation == generation
    }

    pub fn ended(&mut self, now: Instant, generation: u64) -> bool {
        if !self.accepts(generation) {
            return false;
        }
        self.active = false;
        self.retry = Some(now + Duration::from_secs(30));
        true
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
    #[test]
    fn an_event_during_a_read_requests_one_fresh_read_after_it() {
        let now = Instant::now();
        let mut refresh = Refresh::default();
        refresh.request_now(now);
        assert!(refresh.due(now, true));
        refresh.request_now(now + Duration::from_millis(20));
        assert!(!refresh.due(now + Duration::from_millis(20), true));
        refresh.completed(now + Duration::from_millis(50), true);
        assert!(refresh.due(now + Duration::from_millis(50), true));
        assert!(!refresh.due(now + Duration::from_millis(60), true));
    }

    #[test]
    fn negotiation_polling_is_fast_but_never_extends_itself_forever() {
        let now = Instant::now();
        let mut refresh = Refresh::default();
        refresh.observe(now, true);
        refresh.completed(now, true);
        assert!(!refresh.due(now + Duration::from_millis(249), true));
        assert!(refresh.due(now + Duration::from_millis(250), true));
        refresh.observe(now + Duration::from_secs(9), true);
        refresh.completed(now + Duration::from_secs(11), true);
        assert!(!refresh.due(now + Duration::from_secs(12), true));
        assert!(refresh.due(now + Duration::from_secs(13), true));
    }

    #[test]
    fn real_signal_restores_the_idle_cadence_and_new_activation_can_burst_again() {
        let now = Instant::now();
        let mut refresh = Refresh::default();
        refresh.observe(now, true);
        refresh.observe(now + Duration::from_secs(1), false);
        refresh.completed(now + Duration::from_secs(1), true);
        assert!(!refresh.due(now + Duration::from_millis(1250), true));
        assert!(refresh.due(now + Duration::from_secs(3), true));
        refresh.observe(now + Duration::from_secs(4), true);
        refresh.completed(now + Duration::from_secs(4), true);
        assert!(refresh.due(now + Duration::from_millis(4250), true));
        refresh.completed(now + Duration::from_secs(5), false);
        assert!(!refresh.due(now + Duration::from_secs(6), true));
        assert!(refresh.due(now + Duration::from_secs(15), true));
    }

    #[test]
    fn hidden_home_cancels_an_urgent_read() {
        let now = Instant::now();
        let mut refresh = Refresh::default();
        refresh.request_now(now);
        assert!(!refresh.due(now, false));
        assert!(!refresh.due(now + Duration::from_secs(1), true));
        assert!(refresh.due(now + Duration::from_secs(3), true));
    }

    #[test]
    fn watcher_is_visibility_scoped_and_rejects_messages_after_stop_or_restart() {
        let now = Instant::now();
        let mut watch = Watch::default();
        assert_eq!(watch.command(now, false), None);
        let (first, start) = watch.command(now, true).unwrap();
        assert!(start && watch.accepts(first));
        assert_eq!(watch.command(now, true), None);
        let (stopped, start) = watch.command(now, false).unwrap();
        assert!(!start && stopped != first);
        assert!(!watch.accepts(first));
        assert!(!watch.ended(now, first));
        let (second, _) = watch.command(now, true).unwrap();
        assert!(watch.accepts(second));
        assert!(!watch.accepts(first));
        assert!(!watch.accepts(stopped));
    }

    #[test]
    fn watcher_failure_keeps_a_bounded_retry_independent_of_polling() {
        let now = Instant::now();
        let mut watch = Watch::default();
        let (first, _) = watch.command(now, true).unwrap();
        assert!(watch.ended(now, first));
        assert_eq!(watch.command(now + Duration::from_secs(29), true), None);
        let (second, _) = watch.command(now + Duration::from_secs(30), true).unwrap();
        assert_ne!(first, second);
        assert!(!watch.ended(now, first));
    }
}
