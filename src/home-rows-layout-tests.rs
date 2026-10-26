use super::{controls, ready, scene};
use crate::{
    model::{Input, InputMode},
    renderer::Draw,
    state::{State, Target},
};
use std::time::{Duration, Instant};

fn two_rows(names: bool, weather: bool) -> State {
    let mut state = ready();
    state.preferences.home_rows = 2;
    state.preferences.show_home_names = names;
    state.preferences.show_weather = weather;
    state.preferences.favorites = Some(
        state
            .inventory
            .apps
            .iter()
            .take(12)
            .map(|a| a.id.clone())
            .collect(),
    );
    state.inventory.inputs.push(Input {
        id: "com.webos.app.hdmi4".into(),
        title: "HDMI 4".into(),
        port: "HDMI 4".into(),
        connected: Some(true),
    });
    for input in &mut state.inventory.inputs {
        input.connected = Some(true);
    }
    state.home_layout.settle(true);
    state
}

#[test]
fn default_one_row_keeps_its_original_card_geometry_and_input_reflow() {
    let mut state = two_rows(false, false);
    state.preferences.home_rows = 1;
    let layout = controls(&state);
    let favorite = layout
        .iter()
        .find(|c| matches!(c.target, Target::App(_)))
        .unwrap();
    let inputs: Vec<_> = layout
        .iter()
        .filter(|c| matches!(c.target, Target::Input(_)))
        .collect();
    assert!((favorite.rect.y - 544.8).abs() < 0.01);
    assert!((inputs[0].rect.y - 799.2).abs() < 0.01);
    assert_eq!(inputs[0].rect.w, 569.1);
    assert!((inputs[1].rect.x - inputs[0].rect.x - 591.45).abs() < 0.01);
    assert!(inputs[3].rect.y > inputs[0].rect.y + inputs[0].rect.h);
    for input in &mut state.inventory.inputs {
        input.connected = Some(false);
    }
    state.tick();
    assert!(!state.animating());
    let first = controls(&state)
        .into_iter()
        .find(|c| matches!(c.target, Target::App(_)))
        .unwrap();
    assert!((first.rect.y - 544.8).abs() < 0.01);
}

#[test]
fn four_inputs_fit_completely_without_scrolling_with_names_and_weather_on_or_off() {
    for names in [false, true] {
        for weather in [false, true] {
            let mut state = two_rows(names, weather);
            let layout = controls(&state);
            let inputs: Vec<_> = layout
                .iter()
                .filter(|c| matches!(c.target, Target::Input(_)))
                .collect();
            assert_eq!(inputs.len(), 4);
            for card in &inputs {
                assert_eq!(card.rect.y, inputs[0].rect.y);
                assert!(card.rect.y + card.rect.h <= 1041.6);
                assert!(card.rect.y + card.rect.h >= 1000.);
                assert!(card.rect.x + card.rect.w <= 1836.1);
            }
            let id = inputs[1].target.clone();
            state.focus = id.clone();
            assert!(!state.reveal_focus(&layout));
            assert_eq!(state.scroll, 0.);
            let original = inputs[1].rect;
            state.inventory.inputs[0].connected = Some(false);
            let remaining = controls(&state);
            let next = remaining.iter().find(|c| c.target == id).unwrap();
            assert_eq!(next.rect.w, original.w);
        }
    }
}

#[test]
fn hidden_inputs_release_space_but_forced_on_inputs_keep_it() {
    let mut state = two_rows(false, false);
    for input in &mut state.inventory.inputs {
        input.connected = Some(false);
    }
    state.home_layout.settle(false);
    let first_y = |state: &State| {
        controls(state)
            .into_iter()
            .find(|c| matches!(c.target, Target::App(_)))
            .unwrap()
            .rect
            .y
    };
    assert!((first_y(&state) - 544.8).abs() < 0.01);
    state
        .preferences
        .input_modes
        .insert(state.inventory.inputs[0].id.clone(), InputMode::On);
    state.open(0);
    assert!((first_y(&state) - 484.8).abs() < 0.01);
    assert!(!state.animating());
}

#[test]
fn refreshed_inventory_makes_room_before_new_inputs_become_interactive() {
    let mut state = two_rows(false, false);
    for input in &mut state.inventory.inputs {
        input.connected = Some(false);
    }
    state.home_layout.settle(false);
    let mut inventory = state.inventory.clone();
    inventory.inputs[0].connected = Some(true);
    let id = inventory.inputs[0].id.clone();
    state.set_inventory(inventory, None);
    let now = Instant::now();
    state
        .home_layout
        .update(state.home_inputs_visible(), true, false, now);
    state
        .home_layout
        .update(true, true, false, now + Duration::from_millis(160));
    let layout = controls(&state);
    assert!(!layout.iter().any(|c| c.target == Target::Input(id.clone())));
    let first = layout
        .iter()
        .find(|c| matches!(c.target, Target::App(_)))
        .unwrap();
    assert!((first.rect.y - 514.8).abs() < 0.01);
    state
        .home_layout
        .update(true, true, false, now + Duration::from_millis(440));
    let layout = controls(&state);
    let input = layout
        .iter()
        .find(|c| c.target == Target::Input(id.clone()))
        .unwrap();
    assert!(input.rect.y + input.rect.h <= 1041.6);
    assert!(!state.animating());
    state.inventory.inputs[0].connected = Some(false);
    assert!(
        !controls(&state)
            .iter()
            .any(|c| c.target == Target::Input(id.clone()))
    );
}

#[test]
fn input_reveal_does_not_dim_favorites_or_the_wallpaper() {
    let mut state = two_rows(false, false);
    state.home_layout.settle(false);
    let now = Instant::now();
    state.home_layout.update(true, true, false, now);
    state
        .home_layout
        .update(true, true, false, now + Duration::from_millis(160));
    let frame = scene(&state);
    assert!(matches!(&frame.draw[0], Draw::Image(..)));
    assert!(
        frame
            .draw
            .iter()
            .any(|d| matches!(d,Draw::Text(t,_,_,c,_) if t=="Favorites" && c[3]==1.))
    );
    assert!(
        frame
            .draw
            .iter()
            .any(|d| matches!(d,Draw::Text(t,_,_,c,_) if t=="Inputs" && c[3]==0.))
    );
}

#[test]
fn reduced_motion_and_returning_home_start_at_the_settled_position() {
    let mut state = two_rows(true, true);
    state.home_layout.settle(false);
    state.preferences.reduced_motion = true;
    state.tick();
    assert_eq!(state.home_layout.alpha(), 1.);
    assert!(!state.animating());
    state.open(2);
    state.preferences.reduced_motion = false;
    state.home_layout.settle(false);
    state.open(0);
    assert_eq!(state.home_layout.space(true), 1.);
    assert_eq!(state.home_layout.alpha(), 1.);
    assert!(!state.animating());
}

#[test]
fn empty_and_short_favorite_lists_do_not_reserve_a_second_row() {
    for count in [0, 1, 6] {
        let mut state = two_rows(true, false);
        state
            .preferences
            .favorites
            .as_mut()
            .unwrap()
            .truncate(count);
        let layout = controls(&state);
        let favorites: Vec<_> = layout
            .iter()
            .filter(|c| matches!(c.target, Target::App(_)))
            .collect();
        assert_eq!(favorites.len(), count);
        for favorite in favorites {
            assert!((favorite.rect.y - 544.8).abs() < 0.01);
        }
        for input in layout
            .iter()
            .filter(|c| matches!(c.target, Target::Input(_)))
        {
            assert!(input.rect.y + input.rect.h <= 1041.6);
        }
    }
}
