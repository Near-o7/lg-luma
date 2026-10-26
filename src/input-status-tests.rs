use super::{ready, scene};
use crate::{
    i18n::Language,
    model::{InputMode, Preferences},
    platform::normalize_inputs,
    renderer::Draw,
    state::{Page, Target},
    view::input_status,
};
use serde_json::json;

#[test]
fn powered_dongle_without_source_is_not_an_available_auto_input() {
    let mut input = normalize_inputs(&json!([{
        "appId":"com.webos.app.hdmi1", "id":"HDMI_1", "port":1,
        "connected":true, "hdmiPlugIn":true, "hdmiSignalExist":true
    }]))
    .unwrap()
    .remove(0);
    let mut preferences = Preferences::default();
    assert!(preferences.input_visible(&input));
    assert_eq!(input_status(&input, false, Language::Es), "Conectado");
    input.signal = Some(false);
    assert_eq!(input.connected, Some(true));
    assert!(!preferences.input_visible(&input));
    assert_eq!(input_status(&input, false, Language::Es), "Sin señal");
    preferences
        .input_modes
        .insert(input.id.clone(), InputMode::On);
    assert!(preferences.input_visible(&input));
    input.connected = Some(false);
    assert_eq!(
        input_status(&input, false, Language::En),
        Language::En.t("noDevice")
    );
    input.signal = Some(true);
    assert!(preferences.input_visible(&input));
    assert_eq!(input_status(&input, false, Language::En), "Connected");
    preferences
        .input_modes
        .insert(input.id.clone(), InputMode::Off);
    assert!(!preferences.input_visible(&input));
}

#[test]
fn missing_or_malformed_signal_falls_back_to_cable_status() {
    let inputs = normalize_inputs(&json!([
        {"appId":"com.webos.app.hdmi1","hdmiPlugIn":true,"hdmiSignalExist":"false"},
        {"appId":"com.webos.app.hdmi2","hdmiPlugIn":false},
        {"appId":"com.webos.app.hdmi3","connected":true},
        {"appId":"com.webos.app.hdmi4","hdmiSignalExist":false}
    ]))
    .unwrap();
    let preferences = Preferences::default();
    assert_eq!(
        inputs
            .iter()
            .map(|i| preferences.input_visible(i))
            .collect::<Vec<_>>(),
        [true, false, true, false]
    );
    assert_eq!(inputs[0].signal, None);
}

#[test]
fn live_input_update_reconciles_hidden_focus_without_resetting_apps_or_preferences() {
    let mut state = ready();
    let mut inputs = state.inventory.inputs.clone();
    let id = inputs[0].id.clone();
    state.focus = Target::Input(id.clone());
    let preferences = serde_json::to_value(&state.preferences).unwrap();
    let apps = state
        .inventory
        .apps
        .iter()
        .map(|a| a.id.clone())
        .collect::<Vec<_>>();
    state.dirty = false;
    assert!(!state.set_inputs(inputs.clone()));
    assert!(!state.dirty);
    inputs[0].signal = Some(false);
    assert!(state.set_inputs(inputs.clone()));
    assert!(state.dirty);
    assert_ne!(state.focus, Target::Input(id.clone()));
    assert!(
        !scene(&state)
            .controls
            .iter()
            .any(|c| c.target == Target::Input(id.clone()))
    );
    assert_eq!(
        serde_json::to_value(&state.preferences).unwrap(),
        preferences
    );
    assert_eq!(
        state
            .inventory
            .apps
            .iter()
            .map(|a| a.id.clone())
            .collect::<Vec<_>>(),
        apps
    );
    inputs[0].signal = Some(true);
    assert!(state.set_inputs(inputs));
    assert!(
        scene(&state)
            .controls
            .iter()
            .any(|c| c.target == Target::Input(id.clone()))
    );
}

#[test]
fn live_status_also_changes_inside_settings() {
    let mut state = ready();
    state.open(2);
    state.section = crate::state::INPUTS_SECTION;
    state.preferences.language = Language::Es;
    let mut inputs = state.inventory.inputs.clone();
    inputs[0].signal = Some(false);
    state.set_inputs(inputs);
    assert_eq!(state.page, Page::Settings);
    assert!(
        scene(&state)
            .draw
            .iter()
            .any(|d| matches!(d, Draw::Text(label, ..) if label.contains("Sin señal")))
    );
}

#[test]
fn an_active_source_is_visible_before_signal_but_a_powered_empty_dongle_stays_hidden() {
    let inputs = normalize_inputs(&json!([
        {"appId":"com.webos.app.hdmi1","hdmiPlugIn":true,"hdmiSignalExist":false,"activate":true},
        {"appId":"com.webos.app.hdmi2","hdmiPlugIn":true,"hdmiSignalExist":false,"activate":false},
        {"appId":"com.webos.app.hdmi3","hdmiPlugIn":false,"hdmiSignalExist":false,"activate":true},
        {"appId":"com.webos.app.hdmi4","hdmiPlugIn":false,"hdmiSignalExist":true,"activate":false}
    ]))
    .unwrap();
    let mut preferences = Preferences::default();
    assert_eq!(
        inputs
            .iter()
            .map(|i| preferences.input_visible(i))
            .collect::<Vec<_>>(),
        [true, false, false, true]
    );
    assert_eq!(inputs[0].active, Some(true));
    assert_eq!(inputs[2].active, Some(true));
    let malformed = normalize_inputs(&json!([{"appId":"com.webos.app.hdmi1","hdmiPlugIn":true,"hdmiSignalExist":false,"activate":"true"}])).unwrap();
    assert_eq!(malformed[0].active, None);
    assert!(!preferences.input_visible(&malformed[0]));
    assert!(!inputs[2].awaiting_signal());
    assert_eq!(input_status(&inputs[0], false, Language::Es), "Sin señal");
    assert_eq!(input_status(&inputs[3], false, Language::Es), "Conectado");
    preferences
        .input_modes
        .insert(inputs[0].id.clone(), InputMode::Off);
    assert!(!preferences.input_visible(&inputs[0]));
    preferences
        .input_modes
        .insert(inputs[1].id.clone(), InputMode::On);
    assert!(preferences.input_visible(&inputs[1]));
}
