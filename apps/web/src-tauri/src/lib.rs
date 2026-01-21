use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{async_runtime::spawn_blocking, AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command as TokioCommand};
use tokio::sync::Mutex;

type ProcessMap = Arc<Mutex<HashMap<String, Child>>>;

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

#[derive(Deserialize)]
struct ClaudeStreamEvent {
    #[serde(rename = "type")]
    event_type: Option<String>,
    delta: Option<ClaudeDelta>,
    content_block: Option<ClaudeContentBlock>,
}

#[derive(Deserialize)]
struct ClaudeDelta {
    #[serde(rename = "type")]
    delta_type: Option<String>,
    text: Option<String>,
    thinking: Option<String>,
}

#[derive(Deserialize)]
struct ClaudeContentBlock {
    #[serde(rename = "type")]
    block_type: Option<String>,
    text: Option<String>,
    thinking: Option<String>,
}

fn is_metadata_json(value: &Value) -> bool {
    if value.get("mcp_servers").is_some() { return true; }
    if value.get("session").is_some() || value.get("session_id").is_some() { return true; }
    if value.get("tools").is_some() && value.get("type").is_none() { return true; }
    if value.get("plugins").is_some() { return true; }
    if value.get("uuid").is_some() && value.get("type").is_none() { return true; }
    if let Some(t) = value.get("type").and_then(|v| v.as_str()) {
        matches!(t, "system" | "init" | "ping" | "session")
    } else {
        false
    }
}

fn extract_events_from_line(event: &ClaudeStreamEvent) -> Vec<(String, String)> {
    let mut events = Vec::new();
    let event_type = event.event_type.as_deref().unwrap_or("");

    if event_type == "content_block_start" {
        if let Some(block) = &event.content_block {
            let block_type = block.block_type.as_deref().unwrap_or("");
            if block_type == "thinking" {
                events.push(("thinking_start".to_string(), String::new()));
            }
        }
    }

    if event_type == "content_block_stop" {
        events.push(("block_stop".to_string(), String::new()));
    }

    if let Some(delta) = &event.delta {
        if let Some(text) = &delta.thinking {
            if !text.is_empty() {
                events.push(("thinking_delta".to_string(), text.clone()));
            }
        }
        if let Some(text) = &delta.text {
            if !text.is_empty() {
                events.push(("text_delta".to_string(), text.clone()));
            }
        }
    }

    if let Some(block) = &event.content_block {
        if let Some(text) = &block.thinking {
            if !text.is_empty() {
                events.push(("thinking_delta".to_string(), text.clone()));
            }
        }
        if let Some(text) = &block.text {
            if !text.is_empty() {
                events.push(("text_delta".to_string(), text.clone()));
            }
        }
    }

    events
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
    app: AppHandle,
    state: State<'_, AIProcessState>,
) -> Result<String, String> {
    let process_id = uuid::Uuid::new_v4().to_string();
    let process_id_clone = process_id.clone();

    let mut child = TokioCommand::new(&command)
        .args(&args)
        .stdin(if stdin_input.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
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

    let processes = state.processes.clone();
    {
        let mut map = processes.lock().await;
        map.insert(process_id.clone(), child);
    }

    // Use channels to signal when stdout/stderr readers are done
    let (stdout_done_tx, stdout_done_rx) = tokio::sync::oneshot::channel::<()>();
    let (stderr_done_tx, stderr_done_rx) = tokio::sync::oneshot::channel::<()>();

    let stdout_process_id = process_id.clone();
    let stdout_app = app.clone();
    tokio::spawn(async move {
        use tokio::io::AsyncReadExt;
        let mut stdout_reader = stdout;
        let mut buffer = Vec::new();

        // Read all stdout into buffer
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

    let stderr_process_id = process_id.clone();
    let stderr_app = app.clone();
    tokio::spawn(async move {
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

    let complete_process_id = process_id.clone();
    let complete_app = app;
    let processes_for_cleanup = processes;
    tokio::spawn(async move {
        // Wait for process to complete
        let exit_status = loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

            let mut map = processes_for_cleanup.lock().await;
            if let Some(child) = map.get_mut(&complete_process_id) {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        map.remove(&complete_process_id);
                        break Some(status);
                    }
                    Ok(None) => continue,
                    Err(e) => {
                        let _ = complete_app.emit(
                            "ai-stream",
                            AIStreamEvent {
                                process_id: complete_process_id.clone(),
                                event_type: "error".to_string(),
                                data: format!("Error waiting for process: {}", e),
                            },
                        );
                        map.remove(&complete_process_id);
                        break None;
                    }
                }
            } else {
                break None;
            }
        };

        // Wait for stdout and stderr readers to finish (with timeout)
        let _ = tokio::time::timeout(
            tokio::time::Duration::from_secs(5),
            async {
                let _ = stdout_done_rx.await;
                let _ = stderr_done_rx.await;
            }
        ).await;

        // Now emit completion event
        if let Some(status) = exit_status {
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
    });

    Ok(process_id_clone)
}

#[tauri::command]
async fn cancel_ai_stream(
    process_id: String,
    app: AppHandle,
    state: State<'_, AIProcessState>,
) -> Result<(), String> {
    let mut processes = state.processes.lock().await;

    if let Some(mut child) = processes.remove(&process_id) {
        child
            .kill()
            .await
            .map_err(|e| format!("Failed to kill process: {}", e))?;

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
        Err("Process not found".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AIProcessState::default())
        .invoke_handler(tauri::generate_handler![
            run_gh_command,
            run_shell_command,
            start_ai_stream,
            cancel_ai_stream
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
