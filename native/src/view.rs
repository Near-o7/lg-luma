use crate::{
    model::{App, BACKGROUNDS, CATEGORIES},
    renderer::{Color, Draw, MUTED, WHITE},
    state::{Control, KEYS, Overlay, Page, Rect, State, Target},
};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
};
use time::OffsetDateTime;

pub struct Assets {
    pub root: PathBuf,
    pub icons: BTreeMap<String, String>,
}
impl Assets {
    pub fn load(root: PathBuf) -> Result<Self, String> {
        let icons =
            serde_json::from_slice(&std::fs::read(root.join("icons.json")).map_err(|e| {
                format!("Native assets are missing: {e}. Run node native/tools/assets.mjs.")
            })?)
            .map_err(|e| e.to_string())?;
        Ok(Self { root, icons })
    }
    fn path(&self, path: impl AsRef<Path>) -> String {
        self.root.join(path).to_string_lossy().into_owned()
    }
}

pub struct Scene {
    pub draw: Vec<Draw>,
    pub controls: Vec<Control>,
}
impl Scene {
    fn new() -> Self {
        Self {
            draw: Vec::new(),
            controls: Vec::new(),
        }
    }
    fn shape(&mut self, rect: Rect, radius: f32, fill: Color) {
        self.draw.push(Draw::Shape(rect, radius, 0., fill));
    }
    fn text(&mut self, text: impl Into<String>, rect: Rect, size: f32, color: Color, center: bool) {
        self.draw
            .push(Draw::Text(text.into(), rect, size, color, center));
    }
    fn image(&mut self, path: String, rect: Rect, radius: f32, contain: bool) {
        self.draw.push(Draw::Image(path, rect, radius, contain));
    }
    fn control(&mut self, state: &State, target: Target, rect: Rect, scrollable: bool) {
        if state.focus == target {
            self.draw.push(Draw::Shape(rect.inset(-5.), 22., 3., WHITE));
        }
        self.controls.push(Control {
            target,
            rect,
            scrollable,
        });
    }
    fn button(
        &mut self,
        state: &State,
        target: Target,
        rect: Rect,
        label: &str,
        fill: Color,
        scrollable: bool,
    ) {
        self.shape(rect, 18., fill);
        self.control(state, target, rect, scrollable);
        self.text(
            label,
            Rect::new(
                rect.x + 20.,
                rect.y + (rect.h - 30.) / 2.,
                rect.w - 40.,
                38.,
            ),
            26.,
            WHITE,
            false,
        );
    }
}

pub fn scene(
    state: &State,
    assets: &Assets,
    pill_x: f32,
    now: OffsetDateTime,
    desktop: bool,
) -> Scene {
    let mut out = Scene::new();
    out.image(
        assets.path(format!("wallpapers/{}.jpg", state.preferences.background)),
        Rect::new(0., 0., 1920., 1080.),
        0.,
        false,
    );
    out.draw.push(Draw::Gradient(
        Rect::new(0., 0., 1920., 1080.),
        [0.04, 0.05, 0.06, 0.20],
        [0.06, 0.07, 0.08, 0.98],
    ));
    header(&mut out, state, now, pill_x);
    match state.page {
        Page::Home => home(&mut out, state, assets, now),
        Page::Apps => library(&mut out, state, assets),
        Page::Settings => settings(&mut out, state, assets),
    }
    if desktop {
        out.text(
            "LUMA NATIVE / DESKTOP PREVIEW",
            Rect::new(84., 1032., 700., 28.),
            17.,
            [0.8, 0.8, 0.8, 0.5],
            false,
        );
    }
    if let Some(error) = &state.error {
        out.shape(
            Rect::new(84., 930., 1752., 66.),
            16.,
            [0.24, 0.10, 0.12, 0.98],
        );
        out.text(error, Rect::new(106., 945., 1700., 40.), 22., WHITE, false);
    }
    if let Some((notice, _)) = &state.notice {
        out.shape(
            Rect::new(430., 948., 1060., 70.),
            22.,
            [0.12, 0.13, 0.15, 0.98],
        );
        out.text(notice, Rect::new(450., 967., 1020., 38.), 23., WHITE, true);
    }
    if let Some(overlay) = &state.overlay {
        out.controls.clear();
        out.shape(Rect::new(0., 0., 1920., 1080.), 0., [0., 0., 0., 0.65]);
        match overlay {
            Overlay::Options { id, .. } => options(&mut out, state, id),
            Overlay::Keyboard => keyboard(&mut out, state),
        }
    }
    out
}

pub fn pill_target(page: usize) -> f32 {
    [778., 900., 1022.][page]
}

fn header(out: &mut Scene, state: &State, now: OffsetDateTime, pill_x: f32) {
    let hour = if state.preferences.hour_24 {
        now.hour()
    } else {
        match now.hour() % 12 {
            0 => 12,
            hour => hour,
        }
    };
    let clock = if state.preferences.hour_24 {
        format!("{hour:02}:{:02}", now.minute())
    } else {
        format!(
            "{hour}:{:02} {}",
            now.minute(),
            if now.hour() >= 12 { "PM" } else { "AM" }
        )
    };
    out.text(clock, Rect::new(84., 61., 300., 42.), 28., WHITE, false);
    out.shape(
        Rect::new(766., 43., 430., 72.),
        36.,
        [0.07, 0.09, 0.11, 0.82],
    );
    let widths = [116., 116., 158.];
    out.shape(
        Rect::new(pill_x, 52., widths[state.page_index()], 54.),
        27.,
        [0.94, 0.94, 0.94, 1.],
    );
    for (index, label) in ["Home", "Apps", "Settings"].into_iter().enumerate() {
        let rect = Rect::new(pill_target(index), 52., widths[index], 54.);
        out.text(
            label,
            Rect::new(rect.x, 64., rect.w, 36.),
            25.,
            if state.page_index() == index {
                [0.12, 0.12, 0.13, 1.]
            } else {
                MUTED
            },
            true,
        );
        out.control(state, Target::Nav(index), rect, false);
    }
    out.button(
        state,
        Target::TvSettings,
        Rect::new(1635., 52., 201., 54.),
        "TV settings",
        [0.10, 0.12, 0.14, 0.65],
        false,
    );
}

fn tile(out: &mut Scene, state: &State, assets: &Assets, app: &App, rect: Rect, names: bool) {
    if rect.y + rect.h < 180. || rect.y > 1000. {
        out.controls.push(Control {
            target: Target::App(app.id.clone()),
            rect,
            scrollable: true,
        });
        return;
    }
    out.shape(
        Rect::new(rect.x, rect.y + 8., rect.w, rect.h),
        22.,
        [0., 0., 0., 0.18],
    );
    let fill = match app.brand.as_str() {
        "disney-plus" => [0.04, 0.12, 0.26, 1.],
        "prime-video" => [0.00, 0.39, 0.65, 1.],
        "live-tv" => [0.82, 0.24, 0.38, 1.],
        "jellyfin" => [0.11, 0.12, 0.23, 1.],
        "spotify" => [0.07, 0.19, 0.12, 1.],
        "plex" => [0.16, 0.15, 0.12, 1.],
        _ => [0.055, 0.06, 0.065, 1.],
    };
    out.shape(rect, 22., fill);
    if [
        "netflix",
        "youtube",
        "apple-tv",
        "disney-plus",
        "prime-video",
        "jellyfin",
        "arte",
        "zdf",
        "das-erste",
    ]
    .contains(&app.brand.as_str())
    {
        out.image(
            assets.path(format!("logos/{}.png", app.brand)),
            Rect::new(rect.x + 32., rect.y + 32., rect.w - 64., rect.h - 64.),
            0.,
            true,
        );
    } else if let Some(icon) = assets.icons.get(&app.id) {
        out.image(assets.path(icon), rect.inset(22.), 12., true);
    } else {
        out.text(
            &app.title,
            Rect::new(rect.x + 16., rect.y + rect.h / 2. - 22., rect.w - 32., 86.),
            36.,
            WHITE,
            true,
        );
    }
    if state
        .preferences
        .favorites(&state.inventory.apps)
        .contains(&app.id)
        && state.page == Page::Apps
    {
        out.shape(
            Rect::new(rect.x + rect.w - 24., rect.y + 14., 10., 10.),
            5.,
            WHITE,
        );
    }
    if state.moving.as_ref() == Some(&app.id) {
        out.shape(
            Rect::new(rect.x + 58., rect.y + rect.h - 34., rect.w - 116., 28.),
            14.,
            [0.94, 0.94, 0.94, 0.95],
        );
        out.text(
            "<  MOVE  >",
            Rect::new(rect.x + 60., rect.y + rect.h - 31., rect.w - 120., 26.),
            18.,
            [0.12, 0.12, 0.12, 1.],
            true,
        );
    }
    out.control(state, Target::App(app.id.clone()), rect, true);
    if names {
        out.text(
            &app.title,
            Rect::new(rect.x, rect.y + rect.h + 13., rect.w, 68.),
            24.,
            WHITE,
            true,
        );
    }
}

fn home(out: &mut Scene, state: &State, assets: &Assets, now: OffsetDateTime) {
    out.draw
        .push(Draw::Clip(Some(Rect::new(64., 170., 1792., 816.))));
    let scroll = state.scroll;
    let date = format!("{:?}, {:?} {}", now.weekday(), now.month(), now.day()).to_uppercase();
    out.text(
        date,
        Rect::new(84., 199. - scroll, 1200., 36.),
        20.,
        MUTED,
        false,
    );
    let greeting = match now.hour() {
        5..=11 => "Good morning.",
        12..=17 => "Good afternoon.",
        _ => "Good evening.",
    };
    out.text(
        greeting,
        Rect::new(80., 236. - scroll, 1500., 126.),
        88.,
        WHITE,
        false,
    );
    out.text(
        if state.loading {
            "Reading your TV…"
        } else {
            "Your apps. Your home."
        },
        Rect::new(84., 364. - scroll, 1000., 48.),
        27.,
        MUTED,
        false,
    );
    out.text(
        "Favorites",
        Rect::new(84., 479. - scroll, 1000., 42.),
        28.,
        WHITE,
        false,
    );
    let apps = state.apps();
    if apps.is_empty() {
        out.button(
            state,
            Target::Browse,
            Rect::new(84., 547. - scroll, 400., 95.),
            "Choose your favorites",
            [0.16, 0.17, 0.19, 0.95],
            true,
        );
    }
    for (index, app) in apps.iter().enumerate() {
        tile(
            out,
            state,
            assets,
            app,
            Rect::new(
                84. + (index % 6) as f32 * 296.,
                545. + (index / 6) as f32 * 234. - scroll,
                270.,
                154.,
            ),
            state.preferences.show_names,
        );
    }
    let input_y =
        745. + apps.len().saturating_sub(1).checked_div(6).unwrap_or(0) as f32 * 234. - scroll;
    out.text(
        "Inputs",
        Rect::new(84., input_y, 1000., 42.),
        28.,
        WHITE,
        false,
    );
    let inputs: Vec<_> = state
        .inventory
        .inputs
        .iter()
        .filter(|input| state.preferences.input_visible(input))
        .collect();
    if inputs.is_empty() {
        out.text(
            "No visible inputs. Configure them in Settings.",
            Rect::new(84., input_y + 62., 1200., 42.),
            25.,
            MUTED,
            false,
        );
    }
    for (index, input) in inputs.iter().enumerate() {
        let rect = Rect::new(
            84. + (index % 3) as f32 * 592.,
            input_y + 58. + (index / 3) as f32 * 130.,
            568.,
            102.,
        );
        out.shape(rect, 20., [0.13, 0.14, 0.16, 0.8]);
        out.shape(
            Rect::new(rect.x + 21., rect.y + 23., 56., 56.),
            14.,
            [0.25, 0.26, 0.28, 0.8],
        );
        out.text(
            "IN",
            Rect::new(rect.x + 21., rect.y + 38., 56., 35.),
            22.,
            WHITE,
            true,
        );
        out.text(
            &input.title,
            Rect::new(rect.x + 94., rect.y + 22., 450., 37.),
            27.,
            WHITE,
            false,
        );
        out.text(
            format!(
                "{}  /  {}",
                input.port,
                if input.connected == Some(true) {
                    "Connected"
                } else {
                    "Not connected"
                }
            ),
            Rect::new(rect.x + 94., rect.y + 64., 450., 28.),
            18.,
            MUTED,
            false,
        );
        out.control(state, Target::Input(input.id.clone()), rect, true);
    }
    out.draw.push(Draw::Clip(None));
}

fn library(out: &mut Scene, state: &State, assets: &Assets) {
    out.text("Apps", Rect::new(84., 181., 1100., 76.), 54., WHITE, false);
    let labels = [
        "All",
        CATEGORIES[0],
        CATEGORIES[1],
        CATEGORIES[2],
        CATEGORIES[3],
        "Hidden",
    ];
    let widths = [90., 182., 128., 146., 148., 138.];
    let mut x = 84.;
    for (index, label) in labels.into_iter().enumerate() {
        let rect = Rect::new(x, 278., widths[index], 52.);
        out.shape(
            rect,
            26.,
            if state.filter == index {
                [0.9, 0.9, 0.9, 0.95]
            } else {
                [0.16, 0.17, 0.19, 0.85]
            },
        );
        out.text(
            label,
            Rect::new(x, 291., widths[index], 32.),
            23.,
            if state.filter == index {
                [0.12, 0.12, 0.13, 1.]
            } else {
                WHITE
            },
            true,
        );
        out.control(state, Target::Filter(index), rect, false);
        x += widths[index] + 16.;
    }
    out.button(
        state,
        Target::Search,
        Rect::new(1160., 278., 676., 52.),
        if state.query.is_empty() {
            "Search apps…"
        } else {
            &state.query
        },
        [0.12, 0.13, 0.15, 0.9],
        false,
    );
    let apps = state.apps();
    out.text(
        format!("{} apps", apps.len()),
        Rect::new(1576., 200., 260., 40.),
        24.,
        MUTED,
        false,
    );
    out.draw
        .push(Draw::Clip(Some(Rect::new(64., 352., 1792., 642.))));
    if apps.is_empty() {
        out.text(
            if state.loading {
                "Reading your TV…"
            } else {
                "No apps found."
            },
            Rect::new(84., 415., 1400., 65.),
            35.,
            MUTED,
            false,
        );
    }
    for (index, app) in apps.iter().enumerate() {
        tile(
            out,
            state,
            assets,
            app,
            Rect::new(
                84. + (index % 6) as f32 * 296.,
                382. + (index / 6) as f32 * 252. - state.scroll,
                270.,
                154.,
            ),
            true,
        );
    }
    out.draw.push(Draw::Clip(None));
}

fn settings(out: &mut Scene, state: &State, assets: &Assets) {
    out.text(
        "Settings",
        Rect::new(84., 181., 1100., 76.),
        54.,
        WHITE,
        false,
    );
    for (index, label) in ["General", "Background", "Inputs"].into_iter().enumerate() {
        out.button(
            state,
            Target::Sidebar(index),
            Rect::new(84., 302. + index as f32 * 86., 340., 66.),
            label,
            if state.section == index {
                [0.26, 0.27, 0.29, 0.95]
            } else {
                [0.12, 0.13, 0.15, 0.65]
            },
            false,
        );
    }
    out.draw
        .push(Draw::Clip(Some(Rect::new(486., 275., 1370., 715.))));
    match state.section {
        0 => {
            let rows = [
                (
                    "Show app names",
                    if state.preferences.show_names {
                        "On"
                    } else {
                        "Off"
                    },
                ),
                (
                    "24-hour time",
                    if state.preferences.hour_24 {
                        "On"
                    } else {
                        "Off"
                    },
                ),
                (
                    "Reduced motion",
                    if state.preferences.reduced_motion {
                        "On"
                    } else {
                        "Off"
                    },
                ),
                (
                    "Refresh apps and inputs",
                    if state.loading {
                        "Refreshing…"
                    } else {
                        "Refresh"
                    },
                ),
            ];
            for (index, (label, value)) in rows.into_iter().enumerate() {
                let rect = Rect::new(516., 302. + index as f32 * 104. - state.scroll, 1320., 82.);
                out.button(
                    state,
                    Target::Setting(index),
                    rect,
                    label,
                    [0.14, 0.15, 0.17, 0.92],
                    true,
                );
                out.text(
                    value,
                    Rect::new(rect.x + rect.w - 240., rect.y + 26., 212., 40.),
                    25.,
                    MUTED,
                    true,
                );
            }
            out.text("Native preview: Rust + SDL2 + OpenGL.\nWeather and language settings are not ported yet.", Rect::new(536., 774. - state.scroll, 1250., 120.), 23., MUTED, false);
        }
        1 => {
            for (index, (id, title)) in BACKGROUNDS.iter().enumerate() {
                let rect = Rect::new(
                    516. + (index % 3) as f32 * 448.,
                    302. + (index / 3) as f32 * 242. - state.scroll,
                    424.,
                    188.,
                );
                out.image(
                    assets.path(format!("thumbnails/{id}.jpg")),
                    rect,
                    18.,
                    false,
                );
                out.shape(
                    Rect::new(rect.x, rect.y + 134., rect.w, 54.),
                    0.,
                    [0.06, 0.07, 0.08, 0.88],
                );
                out.text(
                    format!(
                        "{title}{}",
                        if state.preferences.background == *id {
                            "  /  Applied"
                        } else {
                            ""
                        }
                    ),
                    Rect::new(rect.x + 16., rect.y + 148., rect.w - 32., 34.),
                    23.,
                    WHITE,
                    false,
                );
                out.control(state, Target::Background(index), rect, true);
            }
        }
        _ => {
            for (index, input) in state.inventory.inputs.iter().enumerate() {
                let rect = Rect::new(516., 302. + index as f32 * 104. - state.scroll, 1320., 82.);
                out.button(
                    state,
                    Target::InputMode(input.id.clone()),
                    rect,
                    &format!("{}  /  {}", input.title, input.port),
                    [0.14, 0.15, 0.17, 0.92],
                    true,
                );
                let mode = state
                    .preferences
                    .input_modes
                    .get(&input.id)
                    .copied()
                    .unwrap_or_default();
                out.text(
                    mode.label(),
                    Rect::new(rect.x + rect.w - 160., rect.y + 26., 140., 40.),
                    25.,
                    MUTED,
                    true,
                );
            }
            let y = 302. + state.inventory.inputs.len() as f32 * 104. - state.scroll;
            out.button(
                state,
                Target::Setting(3),
                Rect::new(516., y, 1320., 82.),
                "Refresh inputs",
                [0.14, 0.15, 0.17, 0.92],
                true,
            );
            out.text(
                "Select an input to cycle Auto / On / Off. Auto requires a connected device.",
                Rect::new(536., y + 116., 1250., 100.),
                23.,
                MUTED,
                false,
            );
        }
    }
    out.draw.push(Draw::Clip(None));
    out.text(
        "Luma / native prototype",
        Rect::new(1386., 1030., 450., 30.),
        19.,
        MUTED,
        false,
    );
}

fn options(out: &mut Scene, state: &State, id: &str) {
    let title = state
        .inventory
        .apps
        .iter()
        .find(|app| app.id == id)
        .map_or(id, |app| app.title.as_str());
    out.shape(
        Rect::new(590., 300., 740., 480.),
        30.,
        [0.10, 0.11, 0.13, 1.],
    );
    out.text(title, Rect::new(638., 340., 644., 90.), 40., WHITE, false);
    let favorite = state
        .preferences
        .favorites(&state.inventory.apps)
        .iter()
        .any(|item| item == id);
    let hidden = state.preferences.hidden.iter().any(|item| item == id);
    for (index, label) in [
        if favorite {
            "Remove from favorites"
        } else {
            "Add to favorites"
        },
        if hidden { "Restore app" } else { "Hide app" },
        "Cancel",
    ]
    .into_iter()
    .enumerate()
    {
        out.button(
            state,
            Target::Option(index),
            Rect::new(638., 460. + index as f32 * 88., 644., 68.),
            label,
            [0.19, 0.20, 0.22, 1.],
            false,
        );
    }
}

fn keyboard(out: &mut Scene, state: &State) {
    out.shape(
        Rect::new(250., 250., 1420., 650.),
        30.,
        [0.10, 0.11, 0.13, 1.],
    );
    out.text(
        "Search apps",
        Rect::new(298., 288., 1250., 60.),
        38.,
        WHITE,
        false,
    );
    out.shape(
        Rect::new(298., 363., 1324., 72.),
        16.,
        [0.18, 0.19, 0.21, 1.],
    );
    out.text(
        format!("{}|", state.query),
        Rect::new(320., 384., 1270., 42.),
        28.,
        WHITE,
        false,
    );
    for (index, key) in KEYS.iter().enumerate() {
        let rect = Rect::new(
            298. + (index % 10) as f32 * 134.,
            481. + (index / 10) as f32 * 91.,
            118.,
            70.,
        );
        out.shape(rect, 16., [0.20, 0.21, 0.23, 1.]);
        out.text(
            *key,
            Rect::new(rect.x, rect.y + 22., rect.w, 34.),
            23.,
            WHITE,
            true,
        );
        out.control(state, Target::Key(index), rect, false);
    }
}
