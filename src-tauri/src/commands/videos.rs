use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Window};
use std::process::Command;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex};
use tokio::fs;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::Command as TokioCommand;

#[derive(Deserialize)]
pub struct VideoDownloadPayload {
    pub url: String,
    pub quality: Option<String>,
    pub task_id: u64,
}

#[derive(Serialize, Clone)]
pub struct DownloadProgress {
    pub task_id: u64,
    pub percent: f32,
    pub speed: String,
    pub eta: String,
    pub filename: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
}

pub struct DownloadState {
    pub active: Mutex<HashMap<u64, Arc<AtomicBool>>>,
}

impl DownloadState {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(HashMap::new()),
        }
    }
}

fn bundled_binary(app: Option<&AppHandle>, name: &str) -> Option<PathBuf> {
    let candidates = [
        app.and_then(|handle| handle.path().resource_dir().ok())
            .map(|dir| dir.join("resources").join(name)),
        Some(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources").join(name)),
    ];

    candidates.into_iter().flatten().find(|path| path.is_file())
}

fn yt_dlp_command(app: Option<&AppHandle>) -> Command {
    if let Some(path) = bundled_binary(app, if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" }) {
        return Command::new(path);
    }

    let direct_works = Command::new("yt-dlp")
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false);

    if direct_works {
        Command::new("yt-dlp")
    } else {
        Command::new("yt-dlp")
    }
}

#[tauri::command]
pub async fn download_youtube_video(
    payload: VideoDownloadPayload,
    window: Window,
    state: tauri::State<'_, DownloadState>,
) -> Result<String, String> {
    let task_id = payload.task_id;
    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let mut active = state.active.lock().map_err(|_| "Download state unavailable".to_string())?;
        if active.len() >= 3 {
            return Err("Maximum 3 downloads can run at the same time".to_string());
        }
        if active.contains_key(&task_id) {
            return Err("This download is already running".to_string());
        }
        active.insert(task_id, cancel_flag.clone());
    }

    let result = download_youtube_video_inner(payload, window, cancel_flag).await;
    if let Ok(mut active) = state.active.lock() {
        active.remove(&task_id);
    }
    result
}

async fn download_youtube_video_inner(
    payload: VideoDownloadPayload,
    window: Window,
    cancel_flag: Arc<AtomicBool>,
) -> Result<String, String> {
    let url = payload.url;
    let quality = payload.quality.unwrap_or_else(|| "best".to_string());
    let task_id = payload.task_id;
    
    let download_path = window
        .app_handle()
        .path()
        .download_dir()
        .map_err(|e| format!("Download folder was not found: {}", e))?
        .join("YolnomaDownloads")
        .join("Videos");
    
    fs::create_dir_all(&download_path)
        .await
        .map_err(|e| e.to_string())?;
    
    let output_template = download_path
        .join("%(id)s-%(title)s.%(ext)s")
        .to_str()
        .ok_or_else(|| "Invalid download path".to_string())?
        .to_string();
    
    let max_height = match quality.as_str() {
        "2160p" => 2160,
        "1080p" => 1080,
        "720p" => 720,
        "480p" => 480,
        _ => 2160,
    };
    let app_handle = window.app_handle();
    let quality_flag = if ffmpeg_installed(Some(&app_handle)) {
        format!("bestvideo[height<={max_height}]+bestaudio/bestvideo+bestaudio/best")
    } else {
        format!("best[height<={max_height}]/best")
    };
    
    let mut command = TokioCommand::from(yt_dlp_command(Some(&app_handle)));
    command
        .arg("-f")
        .arg(&quality_flag)
        .arg("-o")
        .arg(&output_template)
        .arg("--progress")
        .arg("--newline")
        .arg("--progress-template")
        .arg("stdout:download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s")
        .arg("--no-playlist")
        .arg("--no-warnings")
        .arg(&url);

    if ffmpeg_installed(Some(&app_handle)) {
        if let Some(ffmpeg_path) = bundled_binary(
            Some(&app_handle),
            if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" },
        ) {
            if let Some(ffmpeg_dir) = ffmpeg_path.parent() {
                command.arg("--ffmpeg-location").arg(ffmpeg_dir);
            }
        }
        command.arg("--merge-output-format").arg("mp4");
    }

    let mut child = command
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Bundled yt-dlp.exe was not found in src-tauri/resources.\n{}", e))?;
    
    let stdout = child.stdout.take().ok_or_else(|| "yt-dlp output unavailable".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "yt-dlp error output unavailable".to_string())?;
    let mut reader = BufReader::new(stdout).lines();
    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut text = String::new();
        let _ = reader.read_to_string(&mut text).await;
        text
    });
    let mut last_percent = 0.0_f32;

    loop {
        let next_line = tokio::select! {
            _ = tokio::time::sleep(std::time::Duration::from_millis(250)) => {
                if cancel_flag.load(Ordering::Relaxed) {
                    let _ = child.kill().await;
                    return Err("Download cancelled".to_string());
                }
                continue;
            }
            line = reader.next_line() => line.map_err(|e| e.to_string())?,
        };

        let Some(line) = next_line else { break };
        let line = line.trim();
        let parts: Vec<&str> = line.strip_prefix("download:").unwrap_or("").split('|').collect();
        if parts.len() == 5 {
            let percent = parts[0].trim().trim_end_matches('%').parse::<f32>().unwrap_or(0.0);
            last_percent = last_percent.max(percent).min(99.9);
            let downloaded = parts[3].trim().parse::<u64>().unwrap_or(0);
            let total = parts[4].trim().parse::<u64>().unwrap_or(0);
            let _ = window.emit("video-download-progress", DownloadProgress {
                task_id,
                percent: last_percent,
                speed: parts[1].trim().to_string(),
                eta: parts[2].trim().to_string(),
                filename: "downloading".to_string(),
                downloaded_bytes: downloaded,
                total_bytes: total,
            });
        }
    }

    if cancel_flag.load(Ordering::Relaxed) {
        let _ = child.kill().await;
        return Err("Download cancelled".to_string());
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;
    let stderr_text = stderr_task.await.unwrap_or_default();
    if !status.success() {
        return Err(format!("Download failed: {}", stderr_text));
    }
    
    let entries = std::fs::read_dir(&download_path).map_err(|e| e.to_string())?;
    let latest = entries
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().ok().map(|t| t.is_file()).unwrap_or(false))
        .max_by_key(|e| e.metadata().ok().and_then(|m| m.modified().ok()));
    
    match latest {
        Some(entry) => Ok(format!("✅ {} downloaded", entry.file_name().to_str().unwrap_or("video"))),
        None => Err("Downloaded file was not found".to_string()),
    }
}

#[tauri::command]
pub fn cancel_youtube_download(
    task_id: u64,
    state: tauri::State<'_, DownloadState>,
) -> Result<(), String> {
    let active = state.active.lock().map_err(|_| "Download state unavailable".to_string())?;
    match active.get(&task_id) {
        Some(flag) => {
            flag.store(true, Ordering::Relaxed);
            Ok(())
        }
        None => Err("Download is no longer active".to_string()),
    }
}

#[tauri::command]
pub fn get_youtube_formats(url: String, app: AppHandle) -> Result<Vec<String>, String> {
    let output = yt_dlp_command(Some(&app))
        .arg("-F")
        .arg(&url)
        .arg("--no-playlist")
        .arg("--no-warnings")
        .output()
        .map_err(|e| format!("yt-dlp error: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let formats: Vec<String> = stdout
        .lines()
        .filter(|l| {
            l.contains('x') && 
            (l.contains("video") || l.contains("audio")) &&
            !l.contains("---") &&
            !l.trim().is_empty()
        })
        .take(20)
        .map(|l| l.to_string())
        .collect();
    
    Ok(formats)
}

#[tauri::command]
pub fn check_yt_dlp_installed(app: AppHandle) -> bool {
    yt_dlp_command(Some(&app))
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn ffmpeg_installed(app: Option<&AppHandle>) -> bool {
    let mut command = bundled_binary(app, if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" })
        .map(Command::new)
        .unwrap_or_else(|| Command::new("ffmpeg"));
    command
        .arg("-version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[tauri::command]
pub fn check_ffmpeg_installed(app: AppHandle) -> bool {
    ffmpeg_installed(Some(&app))
}

#[derive(Serialize)]
pub struct VideoPreview {
    pub title: String,
    pub uploader: String,
    pub duration: Option<f64>,
    pub thumbnail: Option<String>,
    pub webpage_url: Option<String>,
    pub view_count: Option<u64>,
}

#[tauri::command]
pub fn preview_youtube_video(url: String, app: AppHandle) -> Result<VideoPreview, String> {
    let output = yt_dlp_command(Some(&app))
        .arg("--dump-single-json")
        .arg("--no-download")
        .arg("--no-playlist")
        .arg("--no-warnings")
        .arg(&url)
        .output()
        .map_err(|e| format!("Could not load video metadata: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let metadata: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Could not read video metadata: {}", e))?;

    Ok(VideoPreview {
        title: metadata["title"].as_str().unwrap_or("Unknown title").to_string(),
        uploader: metadata["uploader"].as_str()
            .or_else(|| metadata["channel"].as_str())
            .unwrap_or("Unknown channel")
            .to_string(),
        duration: metadata["duration"].as_f64(),
        thumbnail: metadata["thumbnail"].as_str().map(String::from),
        webpage_url: metadata["webpage_url"].as_str().map(String::from),
        view_count: metadata["view_count"].as_u64(),
    })
}

#[tauri::command]
pub fn open_youtube_download_folder(window: Window) -> Result<(), String> {
    let path = window
        .app_handle()
        .path()
        .download_dir()
        .map_err(|e| format!("Download folder was not found: {}", e))?
        .join("YolnomaDownloads")
        .join("Videos");

    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Could not open download folder: {}", e))?;

    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Could not open download folder: {}", e))?;

    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Could not open download folder: {}", e))?;

    Ok(())
}