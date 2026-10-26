use crate::{
    app_artwork,
    model::demo_inventory,
    motion_view::Presenter,
    renderer::Draw,
    state::{Page, State, Target},
    view::{self, Assets},
};
use std::{
    collections::BTreeMap,
    path::PathBuf,
    time::{Duration, Instant},
};

fn setup() -> (State, Assets) {
    let mut state = State::new(Default::default());
    state.set_inventory(demo_inventory(), None);
    state.preferences.home_rows = 2;
    state.preferences.favorites = Some(
        state
            .inventory
            .apps
            .iter()
            .filter(|a| a.id != "com.webos.app.livetv")
            .take(18)
            .map(|a| a.id.clone())
            .collect(),
    );
    let assets = Assets {
        root: PathBuf::new(),
        version: "test".into(),
        metrics: BTreeMap::new(),
        artwork: app_artwork::Service::new(false),
    };
    (state, assets)
}
fn frame(state: &State, assets: &Assets) -> view::Scene {
    let nav = view::navigation(assets, state.preferences.language);
    let pill = nav.items[state.page_index()];
    view::scene_animated(
        state,
        assets,
        pill.x,
        pill.w,
        time::OffsetDateTime::UNIX_EPOCH,
    )
}
fn text(frame: &view::Scene) -> Vec<(String, u32, u32, u32)> {
    frame.draw[frame.content_draw.clone()]
        .iter()
        .filter_map(|d| match d {
            Draw::Text(t, r, _, c, _) if c[3] > 0.003 => {
                Some((t.clone(), r.x.to_bits(), r.y.to_bits(), c[3].to_bits()))
            }
            _ => None,
        })
        .collect()
}
#[test]
fn horizontal_motion_keeps_displayed_hit_targets_and_logical_reveal_independent() {
    let (mut state, assets) = setup();
    let now = Instant::now();
    state.sync_motion(now);
    let ids = state.preferences.favorites.clone().unwrap();
    state.home_scroll = 281.6;
    state.focus = Target::App(ids[12].clone());
    state.sync_motion(now + Duration::from_millis(1));
    let scene = frame(&state, &assets);
    let displayed = scene
        .controls
        .iter()
        .find(|c| c.target == Target::App(ids[0].clone()))
        .unwrap();
    let logical = scene
        .layout_controls
        .iter()
        .find(|c| c.target == Target::App(ids[0].clone()))
        .unwrap();
    assert!((displayed.rect.x - 84.).abs() < 0.01);
    assert!((logical.rect.x + 197.6).abs() < 0.01);
    assert_eq!(
        state.hit_test(&scene.controls, 200., displayed.rect.y + 50.),
        Some(Target::App(ids[0].clone()))
    );
    assert!(!state.reveal_focus(&scene.layout_controls));
    assert!((state.home_scroll - 281.6).abs() < 0.01);
    // A card at its old displayed position must not be culled using its target position.
    assert!(scene.draw.iter().any(|d|matches!(d,Draw::Image(p,r,_,_) if p.ends_with("surfaces/netflix.png") && (r.x-84.).abs()<0.01)));
    state.sync_motion(now + Duration::from_millis(91));
    assert!(state.motion.horizontal.value(0.) > 0. && state.motion.horizontal.value(0.) < 281.6);
    state.sync_motion(now + Duration::from_millis(181));
    assert_eq!(state.motion.horizontal.value(0.), 281.6);
}
#[test]
fn a_pointer_down_stops_vertical_motion_at_the_displayed_position() {
    let (mut state, assets) = setup();
    state.open(1);
    let now = Instant::now();
    state.sync_motion(now);
    let before = frame(&state, &assets);
    let id = state.apps()[0].id.clone();
    let y = before
        .controls
        .iter()
        .find(|c| c.target == Target::App(id.clone()))
        .unwrap()
        .rect
        .y;
    state.scroll = 500.;
    state.sync_motion(now + Duration::from_millis(1));
    let moving = frame(&state, &assets);
    assert_eq!(
        moving
            .controls
            .iter()
            .find(|c| c.target == Target::App(id.clone()))
            .unwrap()
            .rect
            .y,
        y
    );
    assert_eq!(
        moving
            .layout_controls
            .iter()
            .find(|c| c.target == Target::App(id.clone()))
            .unwrap()
            .rect
            .y,
        y - 500.
    );
    state.sync_motion(now + Duration::from_millis(91));
    let displayed = state.motion.vertical.value(0.);
    state.stop_presented_scroll();
    assert_eq!(state.scroll, displayed);
    assert!(!state.motion.vertical.active());
    let stopped = frame(&state, &assets);
    let card = stopped
        .controls
        .iter()
        .find(|c| c.target == Target::App(id.clone()))
        .unwrap();
    assert!((card.rect.y - (y - displayed)).abs() < 0.01);
}
#[test]
fn focus_and_press_feedback_change_color_without_moving_the_control() {
    let (mut state, assets) = setup();
    let ids = state.preferences.favorites.clone().unwrap();
    state.focus = Target::App(ids[0].clone());
    let now = Instant::now();
    state.sync_motion(now);
    let rect = frame(&state, &assets)
        .controls
        .iter()
        .find(|c| c.target == Target::App(ids[1].clone()))
        .unwrap()
        .rect;
    state.focus = Target::App(ids[1].clone());
    state.sync_motion(now + Duration::from_millis(1));
    state.sync_motion(now + Duration::from_millis(61));
    assert!(
        state.motion.focus(&state.focus, true) > 0. && state.motion.focus(&state.focus, true) < 1.
    );
    let next = frame(&state, &assets);
    let after = next
        .controls
        .iter()
        .find(|c| c.target == state.focus)
        .unwrap()
        .rect;
    assert_eq!(
        (rect.x, rect.y, rect.w, rect.h),
        (after.x, after.y, after.w, after.h)
    );
    state.pressed = Some(state.focus.clone());
    state.sync_motion(now + Duration::from_millis(62));
    assert_eq!(state.motion.press(&state.focus), 0.);
    state.sync_motion(now + Duration::from_millis(100));
    assert!(state.motion.press(&state.focus) > 0. && state.motion.press(&state.focus) < 1.);
}
#[test]
fn page_changes_preserve_the_last_painted_content_when_interrupted() {
    let (mut state, assets) = setup();
    let now = Instant::now();
    let mut presenter = Presenter::default();
    state.sync_motion(now);
    let mut home = frame(&state, &assets);
    presenter.apply(&mut home, &state);
    presenter.presented(&home, &state);
    state.open(1);
    state.sync_motion(now + Duration::from_millis(1));
    let mut apps = frame(&state, &assets);
    presenter.apply(&mut apps, &state);
    assert!(
        apps.controls
            .iter()
            .all(|c| !matches!(c.target, Target::App(_)))
    );
    assert!(
        apps.layout_controls
            .iter()
            .any(|c| matches!(c.target, Target::App(_)))
    );
    state.sync_motion(now + Duration::from_millis(81));
    let mut middle = frame(&state, &assets);
    presenter.apply(&mut middle, &state);
    let painted = text(&middle);
    presenter.presented(&middle, &state);
    state.open(2);
    state.sync_motion(now + Duration::from_millis(81));
    let mut interrupted = frame(&state, &assets);
    presenter.apply(&mut interrupted, &state);
    assert_eq!(text(&interrupted), painted);
    assert!(
        interrupted
            .controls
            .iter()
            .any(|c| c.target == Target::Nav(2))
    );
}
#[test]
fn an_unpainted_page_never_replaces_the_last_displayed_snapshot() {
    let (mut state, assets) = setup();
    let now = Instant::now();
    let mut presenter = Presenter::default();
    state.sync_motion(now);
    let mut home = frame(&state, &assets);
    presenter.apply(&mut home, &state);
    presenter.presented(&home, &state);
    let painted = text(&home);
    state.open(1);
    state.sync_motion(now + Duration::from_millis(1));
    let mut apps = frame(&state, &assets);
    presenter.apply(&mut apps, &state);
    // No swap occurred before the next queued navigation event.
    state.open(2);
    state.sync_motion(now + Duration::from_millis(2));
    let mut settings = frame(&state, &assets);
    presenter.apply(&mut settings, &state);
    assert_eq!(text(&settings), painted);
}
#[test]
fn repeated_page_interruptions_keep_snapshots_bounded_and_eventually_release_them() {
    let (mut state, assets) = setup();
    let now = Instant::now();
    let mut presenter = Presenter::default();
    state.sync_motion(now);
    for i in 0..160 {
        let mut scene = frame(&state, &assets);
        let original_len = scene.draw.len();
        presenter.apply(&mut scene, &state);
        assert!(scene.draw.len() <= original_len + 4096);
        presenter.presented(&scene, &state);
        state.open((i + 1) % 3);
        state.sync_motion(now + Duration::from_millis(i as u64 * 12 + 1));
        state.sync_motion(now + Duration::from_millis(i as u64 * 12 + 9));
    }
    state.sync_motion(now + Duration::from_secs(3));
    let mut settled = frame(&state, &assets);
    let original = text(&settled);
    presenter.apply(&mut settled, &state);
    assert_eq!(text(&settled), original);
    assert!(!state.motion.animating());
}
#[test]
fn reduced_motion_settles_scroll_focus_pages_and_wallpaper_immediately() {
    let (mut state, assets) = setup();
    state.preferences.home_shading = 50;
    state.preferences.reduced_motion = true;
    let now = Instant::now();
    let mut presenter = Presenter::default();
    state.sync_motion(now);
    let mut old = frame(&state, &assets);
    presenter.apply(&mut old, &state);
    presenter.presented(&old, &state);
    state.open(1);
    state.scroll = 300.;
    state.sync_motion(now + Duration::from_millis(1));
    let mut next = frame(&state, &assets);
    presenter.apply(&mut next, &state);
    assert_eq!(state.motion.vertical.value(0.), 300.);
    assert_eq!(state.motion.page.value(0.), 1.);
    assert_eq!(state.motion.shading(0.), 1.);
    assert!(!state.motion.animating());
    assert!(!text(&next).iter().any(|(t, ..)| t == "Favorites"));
    assert_eq!(state.page, Page::Apps);
}
