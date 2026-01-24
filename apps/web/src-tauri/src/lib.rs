use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;

use serde::Serialize;
use serde_json::Value;
use tauri::{async_runtime::spawn_blocking, AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as TokioCommand;
use tokio::sync::Mutex;

// Store process handle along with abort handles for cleanup
struct ProcessHandle {
    abort_handles: Vec<tokio::task::AbortHandle>,
    cancel_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

type ProcessMap = Arc<Mutex<HashMap<String, ProcessHandle>>>;

pub struct AIProcessState {
    processes: ProcessMap,
}

impl Default for AIProcessState {
    fn default() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[derive(Clone, Serialize)]
struct AIStreamEvent {
    process_id: String,
    event_type: String,
    data: String,
}

#[derive(Clone, Serialize)]
struct AIContentEvent {
    process_id: String,
    event_type: String,
    text: String,
}

#[tauri::command]
async fn run_gh_command(args: Vec<String>) -> Result<String, String> {
    spawn_blocking(move || {
        let output = std::process::Command::new("gh")
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to execute gh command: {}", e))?;

        if output.status.success() {
            String::from_utf8(output.stdout).map_err(|e| format!("Failed to parse output: {}", e))
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Command failed: {}", stderr))
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn run_gh_command_with_input(args: Vec<String>, input: String) -> Result<String, String> {
    use std::io::Write;
    spawn_blocking(move || {
        let mut child = std::process::Command::new("gh")
            .args(&args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to execute gh command: {}", e))?;

        // Write input to stdin
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(input.as_bytes())
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        }

        let output = child.wait_with_output()
            .map_err(|e| format!("Failed to wait for command: {}", e))?;

        if output.status.success() {
            String::from_utf8(output.stdout).map_err(|e| format!("Failed to parse output: {}", e))
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Include both stderr and stdout in error for better debugging
            if stdout.is_empty() {
                Err(format!("Command failed: {}", stderr))
            } else {
                Err(format!("Command failed: {} | Response: {}", stderr, stdout))
            }
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn run_shell_command(command: String, args: Vec<String>) -> Result<String, String> {
    spawn_blocking(move || {
        let output = std::process::Command::new(&command)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to execute command: {}", e))?;

        if output.status.success() {
            String::from_utf8(output.stdout).map_err(|e| format!("Failed to parse output: {}", e))
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Command failed: {}", stderr))
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn start_ai_stream(
    command: String,
    args: Vec<String>,
    stdin_input: Option<String>,
    process_id: Option<String>,
    app: AppHandle,
    state: State<'_, AIProcessState>,
) -> Result<String, String> {
    let process_id = process_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let process_id_clone = process_id.clone();

    let mut child = TokioCommand::new(&command)
        .args(&args)
        .stdin(if stdin_input.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true) // Ensure process is killed when dropped
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", command, e))?;

    if let Some(input) = stdin_input {
        if let Some(mut stdin) = child.stdin.take() {
            use tokio::io::AsyncWriteExt;
            let _ = stdin.write_all(input.as_bytes()).await;
            let _ = stdin.shutdown().await;
        }
    }

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let (cancel_tx, cancel_rx) = tokio::sync::oneshot::channel::<()>();

    // Channels to signal when readers are done
    let (stdout_done_tx, stdout_done_rx) = tokio::sync::oneshot::channel::<()>();
    let (stderr_done_tx, stderr_done_rx) = tokio::sync::oneshot::channel::<()>();

    // Collect abort handles to cancel tasks on cleanup
    let mut abort_handles = Vec::new();

    // Stdout reader task
    let stdout_process_id = process_id.clone();
    let stdout_app = app.clone();
    let stdout_task = tokio::spawn(async move {
        use tokio::io::AsyncReadExt;
        let mut stdout_reader = stdout;
        let mut buffer = Vec::new();

        if let Ok(_) = stdout_reader.read_to_end(&mut buffer).await {
            let output = String::from_utf8_lossy(&buffer).to_string();

            if !output.trim().is_empty() {
                // Try to parse as single JSON first (Claude format)
                if let Ok(json_value) = serde_json::from_str::<Value>(&output) {
                    // Handle --output-format json: extract "result" field
                    if let Some(result_text) = json_value.get("result").and_then(|v| v.as_str()) {
                        let _ = stdout_app.emit(
                            "ai-content",
                            AIContentEvent {
                                process_id: stdout_process_id.clone(),
                                event_type: "text_delta".to_string(),
                                text: result_text.to_string(),
                            },
                        );
                    } else if let Some(content) = json_value.get("content").and_then(|v| v.as_array()) {
                        // Handle content array format
                        for item in content {
                            if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                                let _ = stdout_app.emit(
                                    "ai-content",
                                    AIContentEvent {
                                        process_id: stdout_process_id.clone(),
                                        event_type: "text_delta".to_string(),
                                        text: text.to_string(),
                                    },
                                );
                            }
                        }
                    } else {
                        // Unknown JSON structure, emit raw
                        let _ = stdout_app.emit(
                            "ai-content",
                            AIContentEvent {
                                process_id: stdout_process_id.clone(),
                                event_type: "text_delta".to_string(),
                                text: output,
                            },
                        );
                    }
                } else {
                    // Try parsing as JSONL (Codex format: one JSON per line)
                    let mut extracted_text = String::new();
                    for line in output.lines() {
                        if let Ok(json_value) = serde_json::from_str::<Value>(line) {
                            // Codex format: {"type":"item.completed","item":{"type":"agent_message","text":"..."}}
                            if let Some(item) = json_value.get("item") {
                                if item.get("type").and_then(|v| v.as_str()) == Some("agent_message") {
                                    if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                                        extracted_text.push_str(text);
                                        extracted_text.push('\n');
                                    }
                                }
                            }
                        }
                    }

                    if !extracted_text.is_empty() {
                        let _ = stdout_app.emit(
                            "ai-content",
                            AIContentEvent {
                                process_id: stdout_process_id.clone(),
                                event_type: "text_delta".to_string(),
                                text: extracted_text.trim().to_string(),
                            },
                        );
                    } else {
                        // Fallback: emit raw output
                        let _ = stdout_app.emit(
                            "ai-content",
                            AIContentEvent {
                                process_id: stdout_process_id.clone(),
                                event_type: "text_delta".to_string(),
                                text: output,
                            },
                        );
                    }
                }
            }
        }
        let _ = stdout_done_tx.send(());
    });
    abort_handles.push(stdout_task.abort_handle());

    // Stderr reader task
    let stderr_process_id = process_id.clone();
    let stderr_app = app.clone();
    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = stderr_app.emit(
                "ai-stream",
                AIStreamEvent {
                    process_id: stderr_process_id.clone(),
                    event_type: "stderr".to_string(),
                    data: line,
                },
            );
        }
        let _ = stderr_done_tx.send(());
    });
    abort_handles.push(stderr_task.abort_handle());

    // Store process handle in state
    let processes = state.processes.clone();
    {
        let mut map = processes.lock().await;
        map.insert(process_id.clone(), ProcessHandle {
            abort_handles: abort_handles.clone(),
            cancel_tx: Some(cancel_tx),
        });
    }

    // Completion monitoring task
    let complete_process_id = process_id.clone();
    let complete_app = app;
    let processes_for_cleanup = processes;
    let completion_task = tokio::spawn(async move {
        let cancel_rx = cancel_rx;
        let exit_status = tokio::select! {
            status = child.wait() => Some(status),
            _ = cancel_rx => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                None
            }
        };

        let exit_status = match exit_status {
            Some(status) => status,
            None => return,
        };

        // Wait for stdout and stderr readers to finish (with timeout)
        let _ = tokio::time::timeout(
            tokio::time::Duration::from_secs(5),
            async {
                let _ = stdout_done_rx.await;
                let _ = stderr_done_rx.await;
            }
        ).await;

        // Remove from process map
        {
            let mut map = processes_for_cleanup.lock().await;
            map.remove(&complete_process_id);
        }

        // Emit completion event
        match exit_status {
            Ok(status) => {
                let exit_code = status.code().unwrap_or(-1);
                let event_type = if status.success() { "complete" } else { "error" };
                let _ = complete_app.emit(
                    "ai-stream",
                    AIStreamEvent {
                        process_id: complete_process_id.clone(),
                        event_type: event_type.to_string(),
                        data: format!("Process exited with code {}", exit_code),
                    },
                );
            }
            Err(e) => {
                let _ = complete_app.emit(
                    "ai-stream",
                    AIStreamEvent {
                        process_id: complete_process_id.clone(),
                        event_type: "error".to_string(),
                        data: format!("Error waiting for process: {}", e),
                    },
                );
            }
        }
    });

    // We don't store the completion task abort handle since we want it to run to completion
    // But we could add a timeout if needed
    drop(completion_task);

    Ok(process_id_clone)
}

#[tauri::command]
async fn cancel_ai_stream(
    process_id: String,
    app: AppHandle,
    state: State<'_, AIProcessState>,
) -> Result<(), String> {
    let mut processes = state.processes.lock().await;

    if let Some(handle) = processes.remove(&process_id) {
        // Abort all associated tasks
        for abort_handle in handle.abort_handles {
            abort_handle.abort();
        }

        // Signal completion task to terminate the process
        if let Some(cancel_tx) = handle.cancel_tx {
            let _ = cancel_tx.send(());
        }

        let _ = app.emit(
            "ai-stream",
            AIStreamEvent {
                process_id: process_id.clone(),
                event_type: "cancelled".to_string(),
                data: "Process cancelled by user".to_string(),
            },
        );

        Ok(())
    } else {
        // Process might have already completed, that's okay
        Ok(())
    }
}

#[tauri::command]
async fn set_tray_badge(count: Option<i32>, app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Some(tray) = app.tray_by_id("main-tray") {
            let title = match count {
                Some(c) if c > 0 => Some(c.to_string()),
                _ => None,
            };
            tray.set_title(title.as_deref())
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder};
    use tauri::tray::TrayIconBuilder;

    let open_item = MenuItemBuilder::with_id("open", "Open Lyon").build(app)?;
    let refresh_item = MenuItemBuilder::with_id("refresh", "Refresh PRs")
        .accelerator("CmdOrCtrl+R")
        .build(app)?;
    let settings_item = MenuItemBuilder::with_id("settings", "Settings...")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit Lyon")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&open_item)
        .item(&refresh_item)
        .separator()
        .item(&settings_item)
        .separator()
        .item(&quit_item)
        .build()?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("Lyon - PR Review")
        .icon(tauri::include_image!("icons/tray-template@2x.png"))
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quit" => {
                app.exit(0);
            }
            "open" | "settings" | "refresh" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _: Result<(), _> = app.emit(&format!("menu-{}", event.id().as_ref()), ());
                }
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn setup_app_menu(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

    let app_menu = SubmenuBuilder::new(app, "Lyon")
        .about(None)
        .separator()
        .item(
            &MenuItemBuilder::with_id("preferences", "Preferences...")
                .accelerator("CmdOrCtrl+,")
                .build(app)?,
        )
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(
            &MenuItemBuilder::with_id("new-repo", "Add Repository...")
                .accelerator("CmdOrCtrl+N")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("refresh-prs", "Refresh")
                .accelerator("CmdOrCtrl+R")
                .build(app)?,
        )
        .separator()
        .close_window()
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(
            &MenuItemBuilder::with_id("toggle-fullscreen-diff", "Toggle Fullscreen Diff")
                .accelerator("CmdOrCtrl+Shift+F")
                .build(app)?,
        )
        .separator()
        .fullscreen()
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .separator()
        .close_window()
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .build()?;

    app.set_menu(menu)?;

    app.on_menu_event(|app, event| {
        if let Some(window) = app.get_webview_window("main") {
            let _: Result<(), _> = window.emit(&format!("menu-{}", event.id().as_ref()), ());
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_process::init())
        .manage(AIProcessState::default())
        .invoke_handler(tauri::generate_handler![
            run_gh_command,
            run_gh_command_with_input,
            run_shell_command,
            start_ai_stream,
            cancel_ai_stream,
            set_tray_badge
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
            }

            setup_tray(app)?;
            setup_app_menu(app)?;

            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
