use super::{controls, ready, scene};
use crate::{model::InputMode, renderer::Draw, state::Target};
use std::time::{Duration, Instant};

#[test]
fn an_auto_input_reserves_space_before_becoming_interactive() {
    let mut state = ready();
    state.preferences.home_rows = 2;
    state.preferences.favorites = Some(
        state
            .inventory
            .apps
            .iter()
            .take(12)
            .map(|a| a.id.clone())
            .collect(),
    );
    let mut inputs = state.inventory.inputs.clone();
    for input in &mut inputs {
        input.signal = Some(false);
    }
    state.set_inputs(inputs.clone());
    state.home_layout.settle(false);
    let favorite_y = |state: &crate::state::State| {
        controls(state)
            .iter()
            .find(|c| matches!(c.target, Target::App(_)))
            .unwrap()
            .rect
            .y
    };
    assert_eq!(favorite_y(&state), 544.8);
    let now = Instant::now();
    inputs[0].signal = Some(true);
    let id = inputs[0].id.clone();
    state.set_inputs(inputs);
    state.home_layout.update(true, true, false, now);
    state
        .home_layout
        .update(true, true, false, now + Duration::from_millis(160));
    assert_eq!(favorite_y(&state), 514.8);
    assert!(
        !controls(&state)
            .iter()
            .any(|c| c.target == Target::Input(id.clone()))
    );
    state
        .home_layout
        .update(true, true, false, now + Duration::from_millis(380));
    assert_eq!(favorite_y(&state), 484.8);
    let card = controls(&state)
        .into_iter()
        .find(|c| c.target == Target::Input(id.clone()))
        .unwrap();
    assert!(card.rect.y + card.rect.h <= 1041.6);
    state
        .home_layout
        .update(true, true, false, now + Duration::from_millis(440));
    assert!(!state.animating());
    let focus = state.focus.clone();
    let mut inputs = state.inventory.inputs.clone();
    inputs[0].signal = Some(false);
    state.set_inputs(inputs);
    assert!(
        !controls(&state)
            .iter()
            .any(|c| c.target == Target::Input(id.clone()))
    );
    assert_eq!(state.focus, focus);
    state
        .home_layout
        .update(false, true, false, now + Duration::from_secs(1));
    state
        .home_layout
        .update(false, true, false, now + Duration::from_millis(1320));
    assert_eq!(favorite_y(&state), 544.8);
}

#[test]
fn forced_visible_inputs_keep_the_row_and_returning_home_is_already_settled() {
    let mut state = ready();
    state.preferences.home_rows = 2;
    for input in &mut state.inventory.inputs {
        input.signal = Some(false);
    }
    state
        .preferences
        .input_modes
        .insert(state.inventory.inputs[0].id.clone(), InputMode::On);
    assert!(state.home_inputs_visible());
    state.home_layout.settle(false);
    state.open(0);
    assert_eq!(state.home_layout.space(true), 1.);
    assert_eq!(state.home_layout.alpha(), 1.);
    assert!(!state.animating());
    let card = controls(&state)
        .into_iter()
        .find(|c| matches!(c.target, Target::Input(_)))
        .unwrap();
    assert!(card.rect.y + card.rect.h <= 1041.6);
}

#[test]
fn reserving_input_space_does_not_dim_favorites_or_the_wallpaper() {
    let mut state = ready();
    state.preferences.home_rows = 2;
    state.home_layout.settle(false);
    let now = Instant::now();
    state.home_layout.update(true, true, false, now);
    state
        .home_layout
        .update(true, true, false, now + Duration::from_millis(160));
    let frame = scene(&state);
    assert!(matches!(&frame.draw[0], Draw::Image(..)));
    assert!(frame.draw.iter().any(
        |d| matches!(d, Draw::Text(label, _, _, color, _) if label == "Favorites" && color[3] == 1.)
    ));
    assert!(frame.draw.iter().any(
        |d| matches!(d, Draw::Text(label, _, _, color, _) if label == "Inputs" && color[3] == 0.)
    ));
}
