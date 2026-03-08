use std::fs::OpenOptions;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::{path::PathBuf, time::Duration};
use tauri::Manager;

struct BackendState {
    child: Mutex<Option<Child>>,
}

impl BackendState {
    fn new(child: Child) -> Self {
        Self {
            child: Mutex::new(Some(child)),
        }
    }

    fn stop(&self) {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(child) = guard.as_mut() {
                let _ = child.kill();
                let _ = child.wait();
            }
            *guard = None;
        }
    }
}

fn resolve_backend_entry(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        // Tauri places bundled resources under Contents/Resources/resources/
        for sub in ["resources/dist", "dist"] {
            let candidate = resource_dir.join(sub).join("index.js");
            if candidate.exists() {
                return candidate;
            }
        }
    }
    PathBuf::from("dist").join("index.js")
}

fn find_node(app: &tauri::AppHandle) -> PathBuf {
    // Use the bundled node binary — it matches the native addon ABI exactly.
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled = resource_dir.join("resources").join("bundled-node").join("node");
        if bundled.exists() {
            return bundled;
        }
    }
    PathBuf::from("node") // last resort: rely on PATH
}

/// Kill any existing process listening on the given port so the new backend can bind.
fn kill_stale_backend(port: &str) {
    // Use lsof to find the PID of the process occupying our port.
    let output = Command::new("lsof")
        .args(["-ti", &format!("tcp:{port}")])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output();
    if let Ok(out) = output {
        let pids = String::from_utf8_lossy(&out.stdout);
        for tok in pids.split_whitespace() {
            if let Ok(pid) = tok.trim().parse::<i32>() {
                // SIGTERM first for graceful shutdown
                unsafe { libc::kill(pid, libc::SIGTERM); }
            }
        }
        // Brief wait for the process to exit
        if !pids.trim().is_empty() {
            std::thread::sleep(Duration::from_millis(500));
        }
    }
}

fn spawn_local_backend(app: &tauri::AppHandle) -> Result<Child, String> {
    let port = std::env::var("ASSISTMEM_DESKTOP_PORT")
        .or_else(|_| std::env::var("ASSISTANT_MEMORY_DESKTOP_PORT"))
        .unwrap_or_else(|_| "3939".to_string());
    kill_stale_backend(&port);
    let entry = resolve_backend_entry(app);
    let entry_str = entry
        .to_str()
        .ok_or_else(|| "backend entry path is not valid UTF-8".to_string())?
        .to_string();
    let node = find_node(app);
    let log_path = std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/tmp"))
        .join(".assistmem-backend.log");
    let log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .ok();
    let stdout_file = log_file
        .as_ref()
        .and_then(|f| f.try_clone().ok());
    let mut cmd = Command::new(&node);
    cmd.args([entry_str.as_str(), "serve", "--port", &port])
        .stdin(Stdio::null())
        .stdout(stdout_file.map(Stdio::from).unwrap_or_else(Stdio::null))
        .stderr(log_file.map(Stdio::from).unwrap_or_else(Stdio::null));

    if let Ok(db_path) = std::env::var("ASSISTMEM_DB_PATH")
        .or_else(|_| std::env::var("ASSISTANT_MEMORY_DB_PATH"))
    {
        cmd.env("ASSISTMEM_DB_PATH", db_path);
    }

    cmd.spawn()
        .map_err(|e| format!("failed to start assistmem backend (node={node:?}): {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            } else {
                let child = spawn_local_backend(&app.handle())?;
                app.manage(BackendState::new(child));
                // Let backend process start before UI polling begins.
                std::thread::sleep(Duration::from_millis(350));
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                if let Some(state) = app.try_state::<BackendState>() {
                    state.stop();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
