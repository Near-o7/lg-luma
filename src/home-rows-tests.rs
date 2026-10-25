use super::{controls, ready};
use crate::{
    model::Preferences,
    state::{Direction, Effect, Page, Subpage, Target},
};
use serde_json::json;

fn with_favorites(count: usize) -> crate::state::State {
    let mut state = ready();
    state.preferences.home_rows = 2;
    state.preferences.favorites = Some(
        state
            .inventory
            .apps
            .iter()
            .take(count)
            .map(|app| app.id.clone())
            .collect(),
    );
    assert_eq!(state.apps().len(), count);
    state
}

#[test]
fn two_rows_preserve_row_major_order_and_reveal_the_next_page() {
    let mut state = with_favorites(18);
    let ids = state.preferences.favorites.clone().unwrap();
    let layout = controls(&state);
    let rect = |index: usize| {
        layout
            .iter()
            .find(|c| c.target == Target::App(ids[index].clone()))
            .unwrap()
            .rect
    };
    assert_eq!(rect(0).x, rect(6).x);
    assert!(rect(6).y > rect(0).y + rect(0).h);
    assert_eq!(rect(5).y, rect(12).y);
    assert!(rect(12).x > rect(5).x);
    state.focus = Target::App(ids[5].clone());
    state.direction(Direction::Right, &controls(&state));
    assert_eq!(state.focus, Target::App(ids[12].clone()));
    assert!(state.home_scroll > 0.);
    state.direction(Direction::Left, &controls(&state));
    assert_eq!(state.focus, Target::App(ids[5].clone()));
    state.direction(Direction::Down, &controls(&state));
    assert_eq!(state.focus, Target::App(ids[11].clone()));
    state.direction(Direction::Up, &controls(&state));
    assert_eq!(state.focus, Target::App(ids[5].clone()));
}

#[test]
fn incomplete_second_row_uses_its_last_card_without_leaving_the_grid() {
    let mut state = with_favorites(8);
    let ids = state.preferences.favorites.clone().unwrap();
    state.focus = Target::App(ids[5].clone());
    state.direction(Direction::Down, &controls(&state));
    assert_eq!(state.focus, Target::App(ids[7].clone()));
    state.direction(Direction::Right, &controls(&state));
    assert_eq!(state.focus, Target::App(ids[7].clone()));
    state.direction(Direction::Up, &controls(&state));
    assert_eq!(state.focus, Target::App(ids[1].clone()));
    assert_eq!(state.home_scroll, 0.);
}

#[test]
fn two_row_reorder_skips_hidden_and_missing_entries_vertically() {
    let mut state = with_favorites(12);
    let ids = state.preferences.favorites.clone().unwrap();
    state
        .preferences
        .favorites
        .as_mut()
        .unwrap()
        .insert(2, "missing".into());
    state.preferences.hidden.push(ids[2].clone());
    let lower = state.apps()[6].id.clone();
    state.focus = Target::App(ids[0].clone());
    state.hold();
    assert_eq!(
        state.direction(Direction::Down, &controls(&state)),
        vec![Effect::Save]
    );
    let saved = state.preferences.favorites.as_ref().unwrap();
    assert_eq!(saved[0], lower);
    assert_eq!(saved[2], "missing");
    assert_eq!(saved[3], ids[2]);
    assert_eq!(state.focus, Target::App(ids[0].clone()));
}

#[test]
fn favorite_rows_setting_saves_and_back_returns_to_its_parent() {
    let mut state = ready();
    state.open(2);
    state.focus = Target::Setting(7);
    state.activate();
    assert_eq!(state.subpage, Some(Subpage::HomeRows));
    state.back();
    assert_eq!(state.focus, Target::Setting(7));
    state.activate();
    state.focus = Target::Choice(1);
    assert_eq!(state.activate(), vec![Effect::Save]);
    assert_eq!(state.preferences.home_rows, 2);
    assert_eq!(state.focus, Target::Setting(7));
    assert_eq!(state.page, Page::Settings);
    let saved = serde_json::to_value(&state.preferences).unwrap();
    let restored: Preferences = serde_json::from_value(saved).unwrap();
    assert_eq!(restored.home_rows, 2);
}

#[test]
fn old_preferences_keep_the_original_strip_and_row_count_is_bounded() {
    let mut preferences: Preferences =
        serde_json::from_value(json!({"favorites":["netflix"]})).unwrap();
    assert_eq!(preferences.home_rows, 1);
    assert_eq!(preferences.favorites.as_ref().unwrap(), &["netflix"]);
    preferences.home_rows = 255;
    preferences.sanitize();
    assert_eq!(preferences.home_rows, 2);
    preferences.home_rows = 0;
    preferences.sanitize();
    assert_eq!(preferences.home_rows, 1);
}
