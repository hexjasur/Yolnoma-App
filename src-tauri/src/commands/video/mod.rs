use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Emitter, Manager, Window};
use tokio::fs;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
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
    pub library_download_cancel: Mutex<Option<Arc<AtomicBool>>>,
}

impl DownloadState {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(HashMap::new()),
            library_download_cancel: Mutex::new(None),
        }
    }
}

/// Resolves the runtime resources directory:
/// %LOCALAPPDATA%\Yolnoma\resources\
pub fn get_runtime_resources_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let local_dir = app
        .path()
        .local_data_dir()
        .map_err(|e| format!("Failed to get local data directory: {}", e))?;
    Ok(local_dir.join("Yolnoma").join("resources"))
}

fn bundled_binary_any(app: Option<&AppHandle>, names: &[&str]) -> Option<PathBuf> {
    for name in names {
        let candidates = [
            // 1. Existing runtime media directory: %LOCALAPPDATA%\Yolnoma\resources\<name>
            app.and_then(|handle| get_runtime_resources_dir(handle).ok())
                .map(|dir| dir.join(name)),
            std::env::var("LOCALAPPDATA")
                .ok()
                .map(PathBuf::from)
                .map(|dir| dir.join("Yolnoma").join("resources").join(name)),
            // 2. Bundled resource directory (if bundled)
            app.and_then(|handle| handle.path().resource_dir().ok())
                .map(|dir| dir.join("resources").join(name)),
            app.and_then(|handle| handle.path().resource_dir().ok())
                .map(|dir| dir.join(name)),
            // 3. Dev environment fallback
            Some(
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("resources")
                    .join(name),
            ),
        ];

        if let Some(path) = candidates.into_iter().flatten().find(|path| path.is_file()) {
            return Some(path);
        }
    }
    None
}

fn yt_dlp_command(app: Option<&AppHandle>) -> Command {
    let names = if cfg!(windows) {
        vec!["yolnoma_dl.dat", "yt-dlp.dat", "yt-dlp.exe", "yt-dlp"]
    } else {
        vec!["yolnoma_dl.dat", "yt-dlp.dat", "yt-dlp"]
    };

    if let Some(path) = bundled_binary_any(app, &names) {
        return Command::new(path);
    }

    Command::new("yt-dlp")
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VideoLibrariesStatus {
    pub yolnoma_dl: bool,
    pub yolnoma_codec: bool,
    pub all_installed: bool,
    pub resources_dir: String,
}

#[tauri::command]
pub fn check_youtube_libraries(app: AppHandle) -> Result<VideoLibrariesStatus, String> {
    let resources_dir = get_runtime_resources_dir(&app)?;
    let dl_path = resources_dir.join("yolnoma_dl.dat");
    let codec_path = resources_dir.join("yolnoma_codec.dat");

    let yolnoma_dl = dl_path.is_file() && dl_path.metadata().map(|m| m.len() > 0).unwrap_or(false);
    let yolnoma_codec =
        codec_path.is_file() && codec_path.metadata().map(|m| m.len() > 0).unwrap_or(false);
    let all_installed = yolnoma_dl && yolnoma_codec;

    Ok(VideoLibrariesStatus {
        yolnoma_dl,
        yolnoma_codec,
        all_installed,
        resources_dir: resources_dir.to_string_lossy().to_string(),
    })
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LibraryDownloadProgress {
    pub current_file: String,
    pub file_display_name: String,
    pub current_file_index: usize,
    pub total_files: usize,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percent: f32,
    pub overall_downloaded_bytes: u64,
    pub overall_total_bytes: u64,
    pub overall_percent: f32,
    pub speed: String,
    pub status: String,
    pub error_message: Option<String>,
}

struct LibraryTarget {
    filename: &'static str,
    display_name: &'static str,
    url: &'static str,
    estimated_size: u64,
}

const REQUIRED_LIBRARIES: [LibraryTarget; 2] = [
    LibraryTarget {
        filename: "yolnoma_dl.dat",
        display_name: "Video Engine (yolnoma_dl.dat)",
        url: "https://pub-d8a8117039ad4bce82f370cd66382c61.r2.dev/yolnoma_dl.dat",
        estimated_size: 17_840_399,
    },
    LibraryTarget {
        filename: "yolnoma_codec.dat",
        display_name: "FFmpeg Codec (yolnoma_codec.dat)",
        url: "https://pub-d8a8117039ad4bce82f370cd66382c61.r2.dev/yolnoma_codec.dat",
        estimated_size: 126_518_784,
    },
];

fn format_speed(bps: f64) -> String {
    if bps < 1024.0 {
        format!("{:.0} B/s", bps)
    } else if bps < 1024.0 * 1024.0 {
        format!("{:.1} KB/s", bps / 1024.0)
    } else {
        format!("{:.1} MB/s", bps / (1024.0 * 1024.0))
    }
}

#[tauri::command]
pub async fn download_youtube_libraries(
    window: Window,
    app: AppHandle,
    state: tauri::State<'_, DownloadState>,
) -> Result<(), String> {
    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let mut lib_lock = state
            .library_download_cancel
            .lock()
            .map_err(|_| "Download state unavailable".to_string())?;
        if lib_lock.is_some() {
            return Err("Library download is already running".to_string());
        }
        *lib_lock = Some(cancel_flag.clone());
    }

    let result = download_youtube_libraries_inner(window, app, cancel_flag).await;

    if let Ok(mut lib_lock) = state.library_download_cancel.lock() {
        *lib_lock = None;
    }

    result
}

async fn download_youtube_libraries_inner(
    _window: Window,
    app: AppHandle,
    cancel_flag: Arc<AtomicBool>,
) -> Result<(), String> {
    let resources_dir = get_runtime_resources_dir(&app)?;
    fs::create_dir_all(&resources_dir)
        .await
        .map_err(|e| format!("Failed to create resources directory: {}", e))?;

    let client = reqwest::Client::builder()
        .user_agent("Yolnoma-App/1.0")
        .connect_timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {}", e))?;

    let total_files = REQUIRED_LIBRARIES.len();
    let mut total_estimated_bytes: u64 = REQUIRED_LIBRARIES.iter().map(|l| l.estimated_size).sum();
    let mut cumulative_completed_bytes: u64 = 0;

    for (index, target) in REQUIRED_LIBRARIES.iter().enumerate() {
        if cancel_flag.load(Ordering::Relaxed) {
            return Err("Library download cancelled".to_string());
        }

        let final_path = resources_dir.join(target.filename);
        let temp_path = resources_dir.join(format!("{}.tmp", target.filename));

        // 1. Check if already completely downloaded and exists
        if final_path.is_file() {
            let file_size = final_path.metadata().map(|m| m.len()).unwrap_or(0);
            if file_size > 0 {
                cumulative_completed_bytes += file_size;
                let _ = app.emit(
                    "youtube-library-download-progress",
                    LibraryDownloadProgress {
                        current_file: target.filename.to_string(),
                        file_display_name: target.display_name.to_string(),
                        current_file_index: index + 1,
                        total_files,
                        downloaded_bytes: file_size,
                        total_bytes: file_size,
                        percent: 100.0,
                        overall_downloaded_bytes: cumulative_completed_bytes,
                        overall_total_bytes: total_estimated_bytes,
                        overall_percent: ((cumulative_completed_bytes as f64
                            / total_estimated_bytes.max(1) as f64)
                            * 100.0)
                            .min(100.0) as f32,
                        speed: "—".to_string(),
                        status: "downloading".to_string(),
                        error_message: None,
                    },
                );
                continue;
            }
        }

        // 2. Clean up any leftover temporary file
        if temp_path.exists() {
            let _ = fs::remove_file(&temp_path).await;
        }

        // 3. Initiate download request
        let mut response = match client.get(target.url).send().await {
            Ok(res) => {
                if !res.status().is_success() {
                    let err_msg = format!(
                        "Download failed for {} (HTTP {})",
                        target.filename,
                        res.status()
                    );
                    let _ = app.emit(
                        "youtube-library-download-progress",
                        LibraryDownloadProgress {
                            current_file: target.filename.to_string(),
                            file_display_name: target.display_name.to_string(),
                            current_file_index: index + 1,
                            total_files,
                            downloaded_bytes: 0,
                            total_bytes: target.estimated_size,
                            percent: 0.0,
                            overall_downloaded_bytes: cumulative_completed_bytes,
                            overall_total_bytes: total_estimated_bytes,
                            overall_percent: ((cumulative_completed_bytes as f64
                                / total_estimated_bytes.max(1) as f64)
                                * 100.0)
                                .min(100.0) as f32,
                            speed: "—".to_string(),
                            status: "error".to_string(),
                            error_message: Some(err_msg.clone()),
                        },
                    );
                    return Err(err_msg);
                }
                res
            }
            Err(e) => {
                let err_msg = format!("Network error while downloading {}: {}", target.filename, e);
                let _ = app.emit(
                    "youtube-library-download-progress",
                    LibraryDownloadProgress {
                        current_file: target.filename.to_string(),
                        file_display_name: target.display_name.to_string(),
                        current_file_index: index + 1,
                        total_files,
                        downloaded_bytes: 0,
                        total_bytes: target.estimated_size,
                        percent: 0.0,
                        overall_downloaded_bytes: cumulative_completed_bytes,
                        overall_total_bytes: total_estimated_bytes,
                        overall_percent: ((cumulative_completed_bytes as f64
                            / total_estimated_bytes.max(1) as f64)
                            * 100.0)
                            .min(100.0) as f32,
                        speed: "—".to_string(),
                        status: "error".to_string(),
                        error_message: Some(err_msg.clone()),
                    },
                );
                return Err(err_msg);
            }
        };

        let file_total_bytes = response.content_length().unwrap_or(target.estimated_size);
        if response.content_length().is_some() {
            total_estimated_bytes = total_estimated_bytes
                .saturating_sub(target.estimated_size)
                .saturating_add(file_total_bytes);
        }

        // 4. Create temporary file
        let mut temp_file = match fs::File::create(&temp_path).await {
            Ok(f) => f,
            Err(e) => {
                let err_msg = format!("Failed to create temporary file {}: {}", target.filename, e);
                return Err(err_msg);
            }
        };

        let mut file_downloaded: u64 = 0;
        let mut last_emit = std::time::Instant::now();
        let mut last_speed_sample_time = std::time::Instant::now();
        let mut last_speed_sample_bytes: u64 = 0;
        let mut current_speed = "—".to_string();

        // 5. Stream chunks
        loop {
            if cancel_flag.load(Ordering::Relaxed) {
                drop(temp_file);
                let _ = fs::remove_file(&temp_path).await;
                return Err("Library download cancelled".to_string());
            }

            match response.chunk().await {
                Ok(Some(chunk)) => {
                    if let Err(e) = temp_file.write_all(&chunk).await {
                        drop(temp_file);
                        let _ = fs::remove_file(&temp_path).await;
                        let err_msg = format!("Disk write error on {}: {}", target.filename, e);
                        return Err(err_msg);
                    }
                    file_downloaded += chunk.len() as u64;

                    // Compute speed
                    if last_speed_sample_time.elapsed() >= std::time::Duration::from_millis(400) {
                        let elapsed_secs = last_speed_sample_time.elapsed().as_secs_f64();
                        let bytes_diff = file_downloaded.saturating_sub(last_speed_sample_bytes);
                        if elapsed_secs > 0.0 {
                            let bps = (bytes_diff as f64) / elapsed_secs;
                            current_speed = format_speed(bps);
                        }
                        last_speed_sample_bytes = file_downloaded;
                        last_speed_sample_time = std::time::Instant::now();
                    }

                    // Throttle UI event emissions to 100ms
                    if last_emit.elapsed() >= std::time::Duration::from_millis(100) {
                        let file_pct = if file_total_bytes > 0 {
                            ((file_downloaded as f64 / file_total_bytes as f64) * 100.0) as f32
                        } else {
                            0.0
                        };

                        let current_total_down = cumulative_completed_bytes + file_downloaded;
                        let overall_pct = if total_estimated_bytes > 0 {
                            ((current_total_down as f64 / total_estimated_bytes as f64) * 100.0)
                                as f32
                        } else {
                            file_pct
                        };

                        let _ = app.emit(
                            "youtube-library-download-progress",
                            LibraryDownloadProgress {
                                current_file: target.filename.to_string(),
                                file_display_name: target.display_name.to_string(),
                                current_file_index: index + 1,
                                total_files,
                                downloaded_bytes: file_downloaded,
                                total_bytes: file_total_bytes,
                                percent: file_pct.min(99.9),
                                overall_downloaded_bytes: current_total_down,
                                overall_total_bytes: total_estimated_bytes,
                                overall_percent: overall_pct.min(99.9),
                                speed: current_speed.clone(),
                                status: "downloading".to_string(),
                                error_message: None,
                            },
                        );
                        last_emit = std::time::Instant::now();
                    }
                }
                Ok(None) => {
                    break;
                }
                Err(e) => {
                    drop(temp_file);
                    let _ = fs::remove_file(&temp_path).await;
                    let err_msg = format!("Download error for {}: {}", target.filename, e);
                    let _ = app.emit(
                        "youtube-library-download-progress",
                        LibraryDownloadProgress {
                            current_file: target.filename.to_string(),
                            file_display_name: target.display_name.to_string(),
                            current_file_index: index + 1,
                            total_files,
                            downloaded_bytes: file_downloaded,
                            total_bytes: file_total_bytes,
                            percent: 0.0,
                            overall_downloaded_bytes: cumulative_completed_bytes + file_downloaded,
                            overall_total_bytes: total_estimated_bytes,
                            overall_percent: 0.0,
                            speed: "—".to_string(),
                            status: "error".to_string(),
                            error_message: Some(err_msg.clone()),
                        },
                    );
                    return Err(err_msg);
                }
            }
        }

        // 6. Flush and finalize file
        if let Err(e) = temp_file.flush().await {
            drop(temp_file);
            let _ = fs::remove_file(&temp_path).await;
            return Err(format!("Flush failed on {}: {}", target.filename, e));
        }
        drop(temp_file);

        if cancel_flag.load(Ordering::Relaxed) {
            let _ = fs::remove_file(&temp_path).await;
            return Err("Library download cancelled".to_string());
        }

        // 7. Atomic move to destination filename
        if let Err(e) = fs::rename(&temp_path, &final_path).await {
            let _ = fs::remove_file(&temp_path).await;
            return Err(format!(
                "Failed to finalize library file {}: {}",
                target.filename, e
            ));
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&final_path, std::fs::Permissions::from_mode(0o755));
        }

        cumulative_completed_bytes += file_downloaded;
    }

    // 8. All libraries downloaded successfully
    let _ = app.emit(
        "youtube-library-download-progress",
        LibraryDownloadProgress {
            current_file: "complete".to_string(),
            file_display_name: "All libraries installed".to_string(),
            current_file_index: total_files,
            total_files,
            downloaded_bytes: cumulative_completed_bytes,
            total_bytes: cumulative_completed_bytes,
            percent: 100.0,
            overall_downloaded_bytes: cumulative_completed_bytes,
            overall_total_bytes: cumulative_completed_bytes,
            overall_percent: 100.0,
            speed: "—".to_string(),
            status: "completed".to_string(),
            error_message: None,
        },
    );

    Ok(())
}

#[tauri::command]
pub fn cancel_youtube_library_download(
    state: tauri::State<'_, DownloadState>,
) -> Result<(), String> {
    let lib_lock = state
        .library_download_cancel
        .lock()
        .map_err(|_| "Download state unavailable".to_string())?;
    if let Some(ref flag) = *lib_lock {
        flag.store(true, Ordering::Relaxed);
        Ok(())
    } else {
        Err("No library download is active".to_string())
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
        let mut active = state
            .active
            .lock()
            .map_err(|_| "Download state unavailable".to_string())?;
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

    let ffmpeg_names = if cfg!(windows) {
        vec!["yolnoma_codec.dat", "ffmpeg.dat", "ffmpeg.exe", "ffmpeg"]
    } else {
        vec!["yolnoma_codec.dat", "ffmpeg.dat", "ffmpeg"]
    };

    if ffmpeg_installed(Some(&app_handle)) {
        if let Some(ffmpeg_path) = bundled_binary_any(Some(&app_handle), &ffmpeg_names) {
            command.arg("--ffmpeg-location").arg(&ffmpeg_path);
        }
        command.arg("--merge-output-format").arg("mp4");
    }

    let mut child = command
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "Required media engine library is missing. Please download libraries to continue."
                    .to_string()
            } else {
                format!("Failed to start video downloader:\n{}", e)
            }
        })?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "yt-dlp output unavailable".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "yt-dlp error output unavailable".to_string())?;
    let mut reader = BufReader::new(stdout).lines();
    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut text = String::new();
        let _ = reader.read_to_string(&mut text).await;
        text
    });
    let app_for_emit = window.app_handle().clone();
    let mut last_percent = 0.0_f32;

    while let Ok(Some(line)) = reader.next_line().await {
        if cancel_flag.load(Ordering::Relaxed) {
            let _ = child.kill().await;
            return Err("Download cancelled".to_string());
        }

        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // 1. Custom template format: download:45.0%|2.5MiB/s|00:10|1024|2048
        if let Some(rest) = line.strip_prefix("download:") {
            let parts: Vec<&str> = rest.split('|').collect();
            if parts.len() >= 5 {
                let percent = parts[0]
                    .trim()
                    .trim_end_matches('%')
                    .parse::<f32>()
                    .unwrap_or(0.0);
                last_percent = last_percent.max(percent).min(99.9);
                let speed = parts[1].trim().to_string();
                let eta = parts[2].trim().to_string();
                let downloaded = parts[3].trim().parse::<u64>().unwrap_or(0);
                let total = parts[4].trim().parse::<u64>().unwrap_or(0);

                let _ = app_for_emit.emit(
                    "video-download-progress",
                    DownloadProgress {
                        task_id,
                        percent: last_percent,
                        speed: if speed.is_empty() {
                            "—".to_string()
                        } else {
                            speed
                        },
                        eta: if eta.is_empty() {
                            "—".to_string()
                        } else {
                            eta
                        },
                        filename: "downloading".to_string(),
                        downloaded_bytes: downloaded,
                        total_bytes: total,
                    },
                );
            }
        }
        // 2. Standard yt-dlp progress line fallback: [download]  45.2% of ~10.50MiB at 2.50MiB/s ETA 00:05
        else if line.contains("[download]") && line.contains('%') {
            let tokens: Vec<&str> = line.split_whitespace().collect();
            for (i, token) in tokens.iter().enumerate() {
                if token.ends_with('%') {
                    if let Ok(pct) = token.trim_end_matches('%').parse::<f32>() {
                        last_percent = last_percent.max(pct).min(99.9);
                        let mut speed = "—".to_string();
                        let mut eta = "—".to_string();

                        for j in i + 1..tokens.len() {
                            if tokens[j] == "at" && j + 1 < tokens.len() {
                                speed = tokens[j + 1].to_string();
                            }
                            if tokens[j] == "ETA" && j + 1 < tokens.len() {
                                eta = tokens[j + 1].to_string();
                            }
                        }

                        let _ = app_for_emit.emit(
                            "video-download-progress",
                            DownloadProgress {
                                task_id,
                                percent: last_percent,
                                speed,
                                eta,
                                filename: "downloading".to_string(),
                                downloaded_bytes: 0,
                                total_bytes: 0,
                            },
                        );
                    }
                    break;
                }
            }
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
        Some(entry) => Ok(format!(
            "✅ {} downloaded",
            entry.file_name().to_str().unwrap_or("video")
        )),
        None => Err("Downloaded file was not found".to_string()),
    }
}

#[tauri::command]
pub fn cancel_youtube_download(
    task_id: u64,
    state: tauri::State<'_, DownloadState>,
) -> Result<(), String> {
    let active = state
        .active
        .lock()
        .map_err(|_| "Download state unavailable".to_string())?;
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
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "Required media engine library is missing. Please download libraries to continue."
                    .to_string()
            } else {
                format!("yt-dlp error: {}", e)
            }
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let formats: Vec<String> = stdout
        .lines()
        .filter(|l| {
            l.contains('x')
                && (l.contains("video") || l.contains("audio"))
                && !l.contains("---")
                && !l.trim().is_empty()
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
    let names = if cfg!(windows) {
        vec!["yolnoma_codec.dat", "ffmpeg.dat", "ffmpeg.exe", "ffmpeg"]
    } else {
        vec!["yolnoma_codec.dat", "ffmpeg.dat", "ffmpeg"]
    };

    let mut command = bundled_binary_any(app, &names)
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
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "Required media engine library is missing. Please download libraries to continue."
                    .to_string()
            } else {
                format!("Could not load video metadata: {}", e)
            }
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Could not load video metadata".to_string()
        } else {
            stderr
        });
    }

    let metadata: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Could not read video metadata: {}", e))?;

    Ok(VideoPreview {
        title: metadata["title"]
            .as_str()
            .unwrap_or("Unknown title")
            .to_string(),
        uploader: metadata["uploader"]
            .as_str()
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
