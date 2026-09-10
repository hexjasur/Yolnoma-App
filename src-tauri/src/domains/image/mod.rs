use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use image::{DynamicImage, ImageFormat};
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::path::{Path, PathBuf};

/// Information about an image file including dimensions, format, size, and base64 preview.
#[derive(Debug, Serialize, Deserialize)]
pub struct ImageInfo {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub file_size: u64,
    pub file_name: String,
    pub thumbnail: Option<String>,
}

/// Result of a single conversion with output preview.
#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertResult {
    pub input_path: String,
    pub output_path: String,
    pub success: bool,
    pub error: Option<String>,
    pub file_size: Option<u64>,
    pub thumbnail: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// A single conversion task for batch processing.
#[derive(Debug, Serialize, Deserialize)]
pub struct ConversionTask {
    pub input_path: String,
    pub output_dir: Option<String>,
    pub output_format: String,
    pub quality: Option<u8>,
}

fn format_from_str(s: &str) -> Option<ImageFormat> {
    match s.to_lowercase().as_str() {
        "png" => Some(ImageFormat::Png),
        "jpg" | "jpeg" => Some(ImageFormat::Jpeg),
        "bmp" => Some(ImageFormat::Bmp),
        "webp" => Some(ImageFormat::WebP),
        "gif" => Some(ImageFormat::Gif),
        "ico" => Some(ImageFormat::Ico),
        "tiff" | "tif" => Some(ImageFormat::Tiff),
        _ => None,
    }
}

fn format_to_str(fmt: ImageFormat) -> &'static str {
    match fmt {
        ImageFormat::Png => "png",
        ImageFormat::Jpeg => "jpeg",
        ImageFormat::Bmp => "bmp",
        ImageFormat::WebP => "webp",
        ImageFormat::Gif => "gif",
        ImageFormat::Ico => "ico",
        ImageFormat::Tiff => "tiff",
        _ => "unknown",
    }
}

fn generate_thumbnail_base64(img: &DynamicImage, max_dim: u32) -> Option<String> {
    let thumb = img.thumbnail(max_dim, max_dim);
    let mut bytes: Vec<u8> = Vec::new();
    let mut cursor = Cursor::new(&mut bytes);
    if thumb.write_to(&mut cursor, ImageFormat::Png).is_ok() {
        let b64 = BASE64_STANDARD.encode(&bytes);
        Some(format!("data:image/png;base64,{}", b64))
    } else {
        None
    }
}

fn get_default_download_dir_path() -> PathBuf {
    dirs::download_dir()
        .map(|d| d.join("YolnomaDownloads").join("Images"))
        .unwrap_or_else(|| PathBuf::from("./Downloads/YolnomaDownloads/Images"))
}

fn do_convert(
    img: &DynamicImage,
    output_path: &Path,
    format: ImageFormat,
    quality: Option<u8>,
) -> Result<(), String> {
    match format {
        ImageFormat::Jpeg => {
            use image::codecs::jpeg::JpegEncoder;
            use std::fs::File;
            use std::io::BufWriter;
            let file = File::create(output_path).map_err(|e| e.to_string())?;
            let writer = BufWriter::new(file);
            let q = quality.unwrap_or(90).clamp(1, 100);
            let encoder = JpegEncoder::new_with_quality(writer, q);
            img.write_with_encoder(encoder).map_err(|e| e.to_string())
        }
        ImageFormat::Ico => {
            // ICO format supports dimensions up to 256x256
            if img.width() > 256 || img.height() > 256 {
                let resized = img.resize(256, 256, image::imageops::FilterType::Lanczos3);
                resized
                    .save_with_format(output_path, format)
                    .map_err(|e| e.to_string())
            } else {
                img.save_with_format(output_path, format)
                    .map_err(|e| e.to_string())
            }
        }
        _ => img
            .save_with_format(output_path, format)
            .map_err(|e| e.to_string()),
    }
}

/// Returns the default download directory path for converted images.
#[tauri::command]
pub fn get_default_output_dir() -> String {
    let path = get_default_download_dir_path();
    let _ = std::fs::create_dir_all(&path);
    path.to_string_lossy().to_string()
}

/// Opens the specified or default output folder in the OS file explorer.
#[tauri::command]
pub fn open_output_folder(path: Option<String>) -> Result<(), String> {
    let folder_path = match path {
        Some(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => get_default_download_dir_path(),
    };

    if !folder_path.exists() {
        let _ = std::fs::create_dir_all(&folder_path);
    }

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&folder_path)
        .spawn()
        .map_err(|e| format!("Could not open folder: {}", e))?;

    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&folder_path)
        .spawn()
        .map_err(|e| format!("Could not open folder: {}", e))?;

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&folder_path)
        .spawn()
        .map_err(|e| format!("Could not open folder: {}", e))?;

    Ok(())
}

/// Get basic information and a thumbnail preview of an image file.
#[tauri::command]
pub async fn get_image_info(input_path: String) -> Result<ImageInfo, String> {
    let path = Path::new(&input_path);

    let file_size = std::fs::metadata(&input_path).map(|m| m.len()).unwrap_or(0);

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let img = image::open(&input_path).map_err(|e| format!("Failed to open image: {e}"))?;

    let format = image::ImageFormat::from_path(&input_path)
        .ok()
        .map(format_to_str)
        .unwrap_or_else(|| {
            // fallback check extension
            path.extension()
                .and_then(|e| e.to_str())
                .unwrap_or("unknown")
        })
        .to_string();

    let thumbnail = generate_thumbnail_base64(&img, 300);

    Ok(ImageInfo {
        width: img.width(),
        height: img.height(),
        format,
        file_size,
        file_name,
        thumbnail,
    })
}

/// Convert a single image with automatic timestamping in the target folder.
#[tauri::command]
pub async fn convert_image(
    input_path: String,
    output_dir: Option<String>,
    output_format: String,
    quality: Option<u8>,
) -> Result<ConvertResult, String> {
    let fmt = format_from_str(&output_format)
        .ok_or_else(|| format!("Unsupported output format: {output_format}"))?;

    let img = image::open(&input_path)
        .map_err(|e| format!("Failed to open image '{input_path}': {e}"))?;

    let target_dir = match output_dir {
        Some(d) if !d.trim().is_empty() => PathBuf::from(d),
        _ => get_default_download_dir_path(),
    };

    let _ = std::fs::create_dir_all(&target_dir);

    let input_p = Path::new(&input_path);
    let stem = input_p
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image");

    let ext_lower = output_format.to_lowercase();
    let ext = match ext_lower.as_str() {
        "jpeg" | "jpg" => "jpg",
        _ => ext_lower.as_str(),
    };

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let output_filename = format!("{}_{}.{}", stem, timestamp, ext);
    let output_path = target_dir.join(output_filename);
    let output_path_str = output_path.to_string_lossy().to_string();

    match do_convert(&img, &output_path, fmt, quality) {
        Ok(()) => {
            let file_size = std::fs::metadata(&output_path).map(|m| m.len()).ok();
            let output_img = image::open(&output_path).ok();
            let thumbnail = output_img
                .as_ref()
                .and_then(|o| generate_thumbnail_base64(o, 300));
            let width = output_img.as_ref().map(|o| o.width()).or(Some(img.width()));
            let height = output_img
                .as_ref()
                .map(|o| o.height())
                .or(Some(img.height()));

            Ok(ConvertResult {
                input_path,
                output_path: output_path_str,
                success: true,
                error: None,
                file_size,
                thumbnail,
                width,
                height,
            })
        }
        Err(e) => Ok(ConvertResult {
            input_path,
            output_path: output_path_str,
            success: false,
            error: Some(e),
            file_size: None,
            thumbnail: None,
            width: None,
            height: None,
        }),
    }
}

/// Batch convert multiple images with timestamping.
#[tauri::command]
pub async fn convert_images_batch(
    conversions: Vec<ConversionTask>,
) -> Result<Vec<ConvertResult>, String> {
    let mut results = Vec::with_capacity(conversions.len());

    for task in conversions {
        let fmt = match format_from_str(&task.output_format) {
            Some(f) => f,
            None => {
                results.push(ConvertResult {
                    input_path: task.input_path.clone(),
                    output_path: String::new(),
                    success: false,
                    error: Some(format!("Unsupported format: {}", task.output_format)),
                    file_size: None,
                    thumbnail: None,
                    width: None,
                    height: None,
                });
                continue;
            }
        };

        let result = match image::open(&task.input_path) {
            Err(e) => ConvertResult {
                input_path: task.input_path.clone(),
                output_path: String::new(),
                success: false,
                error: Some(format!("Failed to open: {e}")),
                file_size: None,
                thumbnail: None,
                width: None,
                height: None,
            },
            Ok(img) => {
                let target_dir = match task.output_dir {
                    Some(d) if !d.trim().is_empty() => PathBuf::from(d),
                    _ => get_default_download_dir_path(),
                };
                let _ = std::fs::create_dir_all(&target_dir);

                let input_p = Path::new(&task.input_path);
                let stem = input_p
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("image");

                let ext_lower = task.output_format.to_lowercase();
                let ext = match ext_lower.as_str() {
                    "jpeg" | "jpg" => "jpg",
                    _ => ext_lower.as_str(),
                };

                let timestamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0);

                let output_filename = format!("{}_{}.{}", stem, timestamp, ext);
                let output_path = target_dir.join(output_filename);
                let output_path_str = output_path.to_string_lossy().to_string();

                match do_convert(&img, &output_path, fmt, task.quality) {
                    Ok(()) => {
                        let file_size = std::fs::metadata(&output_path).map(|m| m.len()).ok();
                        let output_img = image::open(&output_path).ok();
                        let thumbnail = output_img
                            .as_ref()
                            .and_then(|o| generate_thumbnail_base64(o, 300));
                        let width = output_img.as_ref().map(|o| o.width()).or(Some(img.width()));
                        let height = output_img
                            .as_ref()
                            .map(|o| o.height())
                            .or(Some(img.height()));

                        ConvertResult {
                            input_path: task.input_path,
                            output_path: output_path_str,
                            success: true,
                            error: None,
                            file_size,
                            thumbnail,
                            width,
                            height,
                        }
                    }
                    Err(e) => ConvertResult {
                        input_path: task.input_path,
                        output_path: output_path_str,
                        success: false,
                        error: Some(e),
                        file_size: None,
                        thumbnail: None,
                        width: None,
                        height: None,
                    },
                }
            }
        };

        results.push(result);
    }

    Ok(results)
}
