// Aetheria GM desktop shell (dev tooling — see plan.md "Dev Tooling").
//
// A native window on the same server and UI the browser uses. The web path stays
// canonical; this exists so local testing doesn't need a browser. On startup the
// shell reuses an already-running server on SERVER_PORT (the `npm start` workflow)
// or spawns `node server.js` itself, waits for the port, then opens the window.
// A server the shell spawned is killed on exit; a reused one is left alone.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

const SERVER_PORT: u16 = 3000;
const STARTUP_TIMEOUT_SECS: u64 = 30;

struct ServerProcess(Mutex<Option<Child>>);

fn port_open() -> bool {
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], SERVER_PORT));
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

fn server_dir() -> String {
    // The repo root. Overridable for a relocated server; the compile-time default
    // points at this repo, which is where a dev-tool build lives anyway.
    std::env::var("AETHERIA_SERVER_DIR")
        .unwrap_or_else(|_| concat!(env!("CARGO_MANIFEST_DIR"), "/../..").to_string())
}

fn spawn_server(dir: &str) -> std::io::Result<Child> {
    let mut cmd = Command::new("node");
    cmd.arg("server.js")
        .current_dir(dir)
        .env("PORT", SERVER_PORT.to_string());

    // Kill the server with the shell no matter how the shell dies (SIGKILL, crash):
    // the RunEvent::Exit handler only runs on a normal window close.
    #[cfg(target_os = "linux")]
    unsafe {
        use std::os::unix::process::CommandExt;
        cmd.pre_exec(|| {
            libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGTERM);
            Ok(())
        });
    }

    cmd.spawn()
}

fn main() {
    // WebKitGTK's dmabuf renderer crashes with a Wayland protocol error on NVIDIA
    // (observed on this project's KDE Wayland + RTX dev machine). Respect an
    // explicit user setting if one exists.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            if port_open() {
                println!("[desktop] Reusing running Aetheria server on port {SERVER_PORT}.");
            } else {
                let dir = server_dir();
                println!("[desktop] Launching `node server.js` in {dir}...");
                let child = spawn_server(&dir).map_err(|e| {
                    format!("failed to launch `node server.js` in {dir}: {e}. Is Node installed? Set AETHERIA_SERVER_DIR if the repo moved.")
                })?;
                *app.state::<ServerProcess>().0.lock().unwrap() = Some(child);
            }

            let deadline = Instant::now() + Duration::from_secs(STARTUP_TIMEOUT_SECS);
            while !port_open() {
                if Instant::now() > deadline {
                    return Err(format!(
                        "Aetheria server did not become ready on port {SERVER_PORT} within {STARTUP_TIMEOUT_SECS}s"
                    )
                    .into());
                }
                std::thread::sleep(Duration::from_millis(250));
            }

            let url = format!("http://localhost:{SERVER_PORT}")
                .parse()
                .expect("static localhost URL must parse");
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("Aetheria GM")
                .inner_size(1440.0, 900.0)
                .build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(mut child) = app.state::<ServerProcess>().0.lock().unwrap().take() {
                    println!("[desktop] Stopping the Aetheria server this shell launched...");
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        });
}
