use super::{controls, ready, scene};
use crate::{
    model::Preferences,
    renderer::Draw,
    state::{Direction, Effect, Subpage, Target},
};
use serde_json::json;

#[test]
fn global_gradient_off_overrides_personal_strength_on_every_page() {
    let mut state = ready();
    state.preferences.home_shading = 75;
    state.preferences.wallpaper_gradient = false;
    for page in [0, 1, 2] {
        state.open(page);
        assert!(
            matches!(&scene(&state).draw[0],Draw::Image(path,..) if path.ends_with("dunes-plain.jpg"))
        );
    }
}

#[test]
fn uploaded_wallpapers_use_their_real_original_and_shaded_paths() {
    let mut state = ready();
    let id = format!("custom-{}", "a".repeat(32));
    state.wallpapers.push(crate::wallpapers::Wallpaper {
        id: id.clone(),
        directory: "/tmp/luma-test-upload".into(),
        has_original: true,
    });
    state.preferences.background = id;
    state.preferences.home_shading = 50;
    let frame = scene(&state);
    assert!(
        matches!(&frame.draw[0],Draw::Image(path,..) if path=="/tmp/luma-test-upload/original.jpg")
    );
    assert!(
        matches!(&frame.draw[1],Draw::TintedImage(path,_,_,_,color) if path=="/tmp/luma-test-upload/wallpaper.jpg" && color[3]==0.5)
    );
}

#[test]
fn existing_preferences_keep_original_shading_and_values_are_bounded() {
    let mut preferences: Preferences =
        serde_json::from_value(json!({"home_rows":2,"favorites":["netflix"]})).unwrap();
    assert_eq!(preferences.home_shading, 100);
    preferences.home_shading = 255;
    preferences.sanitize();
    assert_eq!(preferences.home_shading, 100);
    preferences.home_shading = 0;
    preferences.sanitize();
    assert_eq!(preferences.home_shading, 0);
    assert_eq!(preferences.home_rows, 2);
    assert_eq!(preferences.favorites.unwrap(), ["netflix"]);
}

#[test]
fn home_uses_only_the_plain_wallpaper_when_shading_is_off() {
    let mut state = ready();
    state.preferences.home_shading = 0;
    let scene = scene(&state);
    assert!(matches!(&scene.draw[0], Draw::Image(path, ..) if path.ends_with("dunes-plain.jpg")));
    assert!(!scene.draw.iter().any(|draw| matches!(draw, Draw::Image(path, ..) | Draw::TintedImage(path, ..) if path.ends_with("wallpapers/dunes.jpg"))));
}

#[test]
fn intermediate_shading_blends_with_the_original_and_default_uses_one_image() {
    let mut state = ready();
    let original = scene(&state);
    assert!(
        matches!(&original.draw[0], Draw::Image(path, ..) if path.ends_with("wallpapers/dunes.jpg"))
    );
    assert!(matches!(&original.draw[1], Draw::Clip(_)));
    state.preferences.home_shading = 50;
    let half = scene(&state);
    assert!(matches!(&half.draw[0], Draw::Image(path, ..) if path.ends_with("dunes-plain.jpg")));
    assert!(
        matches!(&half.draw[1], Draw::TintedImage(path, _, _, _, tint) if path.ends_with("wallpapers/dunes.jpg") && tint[3] == 0.5)
    );
}

#[test]
fn home_shading_does_not_change_the_apps_or_settings_wallpaper() {
    let mut state = ready();
    state.preferences.home_shading = 0;
    for page in [1, 2] {
        state.open(page);
        let scene = scene(&state);
        assert!(
            matches!(&scene.draw[0], Draw::Image(path, ..) if path.ends_with("wallpapers/dunes.jpg"))
        );
        assert!(
            !scene
                .draw
                .iter()
                .any(|draw| matches!(draw, Draw::Clip(Some(_))))
        );
    }
}

#[test]
fn all_five_levels_are_reachable_and_save_without_changing_favorites() {
    let mut state = ready();
    state.preferences.home_rows = 2;
    state.open(2);
    state.focus = Target::HomeShading;
    state.direction(Direction::Right, &controls(&state));
    assert_eq!(state.subpage, Some(Subpage::HomeShading));
    assert_eq!(state.focus, Target::Choice(4));
    state.direction(Direction::Down, &controls(&state));
    assert_eq!(state.focus, Target::Choice(0));
    for (index, amount) in [0, 25, 50, 75, 100].into_iter().enumerate() {
        state.focus = Target::HomeShading;
        state.activate();
        state.focus = Target::Choice(index);
        assert_eq!(state.activate(), vec![Effect::Save]);
        assert_eq!(state.preferences.home_shading, amount);
        assert_eq!(state.focus, Target::HomeShading);
        assert_eq!(state.preferences.home_rows, 2);
        let restored: Preferences =
            serde_json::from_value(serde_json::to_value(&state.preferences).unwrap()).unwrap();
        assert_eq!(restored.home_shading, amount);
    }
}
