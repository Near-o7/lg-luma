//! Blocking platform work runs on one worker, never in the SDL/UI thread.
//! TV calls originate from this native executable's LS2 connection, not a CLI
//! process trying to impersonate its application identity.
use crate::model::{App, Input, Inventory, demo_inventory, valid_app_id};
use serde_json::{Value, json};
use std::{collections::HashSet, sync::mpsc, thread};

pub const APP_ID: &str = "com.luma.launcher.native";
pub enum Request {
    Refresh,
    Launch(String),
}
pub enum Response {
    Inventory(Result<(Inventory, Option<String>), String>),
    Launched(Result<(), String>),
}

pub struct Platform {
    sender: mpsc::Sender<Request>,
    pub receiver: mpsc::Receiver<Response>,
    pub webos: bool,
}

impl Platform {
    pub fn new(webos: bool) -> Self {
        let (sender, requests) = mpsc::channel();
        let (responses, receiver) = mpsc::channel();
        thread::spawn(move || {
            while let Ok(request) = requests.recv() {
                let response = match request {
                    Request::Refresh => Response::Inventory(if webos {
                        inventory()
                    } else {
                        Ok((demo_inventory(), None))
                    }),
                    Request::Launch(id) => Response::Launched(if webos {
                        if !valid_app_id(&id) {
                            Err("Invalid application identifier".into())
                        } else {
                            call(
                                "luna://com.webos.applicationManager/launch",
                                json!({"id": id}),
                            )
                            .map(|_| ())
                        }
                    } else {
                        Ok(())
                    }),
                };
                if responses.send(response).is_err() {
                    break;
                }
            }
        });
        Self {
            sender,
            receiver,
            webos,
        }
    }

    pub fn send(&self, request: Request) {
        let _ = self.sender.send(request);
    }
}

fn call(uri: &str, payload: Value) -> Result<Value, String> {
    #[cfg(all(feature = "webos", target_os = "linux", target_arch = "arm"))]
    let response = crate::luna::call(uri, &payload);
    #[cfg(not(all(feature = "webos", target_os = "linux", target_arch = "arm")))]
    let response: Result<Value, String> = {
        let _ = payload;
        Err("Native Luna services are only available in an ARM webOS build".into())
    };
    response.and_then(checked_response).map_err(|error| {
        let error = format!("{uri}: {error}");
        eprintln!("Luma TV service: {error}");
        error
    })
}

fn checked_response(value: Value) -> Result<Value, String> {
    if value.get("returnValue").and_then(Value::as_bool) != Some(true) {
        return Err(value
            .get("errorText")
            .and_then(Value::as_str)
            .unwrap_or("The TV denied this action")
            .chars()
            .take(240)
            .collect());
    }
    Ok(value)
}

fn inventory_read(uri: &str, field: &str) -> Result<Value, String> {
    // Only these fixed inventory commands use Homebrew's elevated service.
    let command = format!(
        "if [ \"$(id -u)\" = 0 ]; then MODE=-n; case \"$(cat /etc/starfish-release 2>/dev/null)\" in *\" 10.\"*|*\" 11.\"*) MODE=-t;; esac; /usr/bin/luna-send \"$MODE\" 1 -w 4000 {uri} '{{}}'; else printf '%s\\n' '{{\"returnValue\":false,\"errorText\":\"Homebrew Channel needs root access\"}}'; fi"
    );
    let envelope = call(
        "luna://org.webosbrew.hbchannel.service/exec",
        json!({"command": command}),
    )?;
    for key in ["returnCode", "exitCode"] {
        if let Some(code) = envelope.get(key)
            && code != 0
            && code != "0"
        {
            return Err("Homebrew could not read the inventory".into());
        }
    }
    let stdout = envelope
        .get("stdoutString")
        .and_then(Value::as_str)
        .ok_or("Homebrew returned no inventory")?;
    let response = checked_response(
        stdout
            .lines()
            .find_map(|line| serde_json::from_str::<Value>(line).ok())
            .ok_or("Homebrew returned an unreadable inventory")?,
    )?;
    response
        .get(field)
        .cloned()
        .ok_or_else(|| format!("Missing TV inventory field: {field}"))
}

fn inventory() -> Result<(Inventory, Option<String>), String> {
    let apps = normalize_apps(&inventory_read(
        "luna://com.webos.applicationManager/listApps",
        "apps",
    )?)?;
    let inputs = inventory_read("luna://com.webos.service.eim/getAllInputStatus", "devices")
        .and_then(|raw| normalize_inputs(&raw));
    match inputs {
        Ok(inputs) => Ok((Inventory { apps, inputs }, None)),
        Err(error) => Ok((
            Inventory {
                apps,
                inputs: vec![],
            },
            Some(format!("Inputs could not be refreshed: {error}")),
        )),
    }
}

fn title(value: Option<&str>, fallback: &str) -> String {
    let clean: String = value
        .unwrap_or("")
        .chars()
        .filter(|c| !c.is_control())
        .take(120)
        .collect();
    if clean.trim().is_empty() {
        fallback.into()
    } else {
        clean.trim().into()
    }
}

pub fn normalize_apps(raw: &Value) -> Result<Vec<App>, String> {
    let entries = raw
        .as_array()
        .filter(|a| a.len() <= 1000)
        .ok_or("Invalid app inventory")?;
    let mut seen = HashSet::new();
    let mut apps = Vec::new();
    for entry in entries {
        let Some(id) = entry
            .get("id")
            .and_then(Value::as_str)
            .filter(|id| valid_app_id(id))
        else {
            continue;
        };
        let live = id == "com.webos.app.livetv";
        let visible = entry.get("visible");
        if id == APP_ID
            || id == "com.luma.launcher"
            || id == "com.webos.app.home"
            || id.starts_with("com.webos.app.hdmi")
            || id.starts_with("com.webos.app.externalinput.")
            || (!live && (visible == Some(&json!(false)) || visible == Some(&json!("false"))))
            || (!live
                && ["com.webos.", "com.palm.", "com.lge."]
                    .iter()
                    .any(|prefix| id.starts_with(prefix))
                && visible != Some(&json!(true)))
            || !seen.insert(id)
        {
            continue;
        }
        apps.push(App::new(
            id,
            &title(entry.get("title").and_then(Value::as_str), id),
        ));
    }
    apps.sort_by_key(|a| a.title.to_lowercase());
    Ok(apps)
}

pub fn normalize_inputs(raw: &Value) -> Result<Vec<Input>, String> {
    let entries = raw
        .as_array()
        .filter(|a| a.len() <= 128)
        .ok_or("Invalid input inventory")?;
    let mut inputs = Vec::new();
    for entry in entries {
        let Some(id) = entry.get("appId").and_then(Value::as_str) else {
            continue;
        };
        let Some(number) = id
            .strip_prefix("com.webos.app.hdmi")
            .and_then(|s| s.parse::<u8>().ok())
            .filter(|n| *n > 0 && *n < 100)
        else {
            continue;
        };
        if id != format!("com.webos.app.hdmi{number}")
            || entries
                .iter()
                .filter(|e| e.get("appId").and_then(Value::as_str) == Some(id))
                .count()
                != 1
        {
            continue;
        }
        if entry
            .get("id")
            .is_some_and(|v| v != &format!("HDMI_{number}"))
        {
            continue;
        }
        if entry
            .get("port")
            .is_some_and(|v| v != &json!(number) && v != &number.to_string())
        {
            continue;
        }
        let port = format!("HDMI {number}");
        inputs.push(Input {
            id: id.into(),
            title: title(entry.get("label").and_then(Value::as_str), &port),
            port,
            connected: entry.get("connected").and_then(Value::as_bool),
        });
    }
    Ok(inputs)
}
