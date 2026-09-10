use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ArchiveEntry {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub compressed_size: u64,
    pub modified: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ArchiveSummary {
    pub archive_name: String,
    pub archive_size: u64,
    pub total_files: usize,
    pub total_folders: usize,
    pub uncompressed_size: u64,
    pub format: String,
    pub entries: Vec<ArchiveEntry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ArchiveFileData {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub kind: String, // "text" | "image" | "video" | "audio" | "binary"
    pub mime_type: String,
    pub text_content: Option<String>,
    pub data_url: Option<String>,
}

fn get_file_kind_and_mime(name: &str) -> (&'static str, &'static str) {
    let ext = name.split('.').last().unwrap_or("").to_lowercase();

    match ext.as_str() {
        "txt" => ("text", "text/plain;charset=utf-8"),
        "md" => ("text", "text/markdown;charset=utf-8"),
        "json" => ("text", "application/json;charset=utf-8"),
        "js" | "mjs" | "cjs" => ("text", "application/javascript;charset=utf-8"),
        "ts" | "tsx" => ("text", "text/typescript;charset=utf-8"),
        "jsx" => ("text", "text/jsx;charset=utf-8"),
        "rs" => ("text", "text/x-rust;charset=utf-8"),
        "py" => ("text", "text/x-python;charset=utf-8"),
        "html" | "htm" => ("text", "text/html;charset=utf-8"),
        "css" | "scss" | "less" => ("text", "text/css;charset=utf-8"),
        "xml" | "svg" => ("text", "text/xml;charset=utf-8"),
        "csv" => ("text", "text/csv;charset=utf-8"),
        "log" => ("text", "text/plain;charset=utf-8"),
        "yaml" | "yml" => ("text", "text/yaml;charset=utf-8"),
        "toml" => ("text", "text/toml;charset=utf-8"),
        "ini" | "env" | "conf" => ("text", "text/plain;charset=utf-8"),
        "png" => ("image", "image/png"),
        "jpg" | "jpeg" => ("image", "image/jpeg"),
        "webp" => ("image", "image/webp"),
        "gif" => ("image", "image/gif"),
        "bmp" => ("image", "image/bmp"),
        "ico" => ("image", "image/x-icon"),
        "mp4" => ("video", "video/mp4"),
        "webm" => ("video", "video/webm"),
        "avi" => ("video", "video/x-msvideo"),
        "mov" => ("video", "video/quicktime"),
        "mkv" => ("video", "video/x-matroska"),
        "mp3" => ("audio", "audio/mpeg"),
        "wav" => ("audio", "audio/wav"),
        "ogg" => ("audio", "audio/ogg"),
        "flac" => ("audio", "audio/flac"),
        "m4a" => ("audio", "audio/mp4"),
        _ => ("binary", "application/octet-stream"),
    }
}

#[tauri::command]
pub async fn list_archive_entries(file_path: String) -> Result<ArchiveSummary, String> {
    let path = PathBuf::from(&file_path);
    if !path.is_file() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let file_metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let archive_size = file_metadata.len();
    let archive_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "archive".to_string());

    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "zip" => read_zip_archive(&path, archive_name, archive_size),
        "7z" => read_7z_archive(&path, archive_name, archive_size),
        _ => Err("Unsupported archive format. Supported formats: .zip, .7z".to_string()),
    }
}

fn read_zip_archive(
    path: &Path,
    archive_name: String,
    archive_size: u64,
) -> Result<ArchiveSummary, String> {
    let file = File::open(path).map_err(|e| format!("Could not open file: {}", e))?;
    let reader = BufReader::new(file);
    let mut zip =
        zip::ZipArchive::new(reader).map_err(|e| format!("Invalid ZIP archive: {}", e))?;

    let mut entries = Vec::new();
    let mut total_files = 0;
    let mut total_folders = 0;
    let mut uncompressed_size = 0;

    for i in 0..zip.len() {
        let file = zip.by_index(i).map_err(|e| e.to_string())?;
        let is_dir = file.is_dir();
        let full_path = file.name().trim_end_matches('/').to_string();
        let name = full_path
            .split('/')
            .last()
            .unwrap_or(&full_path)
            .to_string();

        let size = file.size();
        let compressed_size = file.compressed_size();

        if is_dir {
            total_folders += 1;
        } else {
            total_files += 1;
            uncompressed_size += size;
        }

        let modified = file.last_modified().map(|dt| {
            format!(
                "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
                dt.year(),
                dt.month(),
                dt.day(),
                dt.hour(),
                dt.minute(),
                dt.second()
            )
        });

        entries.push(ArchiveEntry {
            path: full_path,
            name,
            is_dir,
            size,
            compressed_size,
            modified,
        });
    }

    Ok(ArchiveSummary {
        archive_name,
        archive_size,
        total_files,
        total_folders,
        uncompressed_size,
        format: "ZIP".to_string(),
        entries,
    })
}

fn read_7z_archive(
    path: &Path,
    archive_name: String,
    archive_size: u64,
) -> Result<ArchiveSummary, String> {
    let mut entries = Vec::new();
    let mut total_files = 0;
    let mut total_folders = 0;
    let mut uncompressed_size = 0;

    sevenz_rust::decompress_file_with_extract_fn(
        path,
        &PathBuf::from(""),
        |entry, _reader, _dest| {
            let is_dir = entry.is_directory();
            let full_path = entry
                .name()
                .trim_end_matches('/')
                .trim_end_matches('\\')
                .replace('\\', "/");
            let name = full_path
                .split('/')
                .last()
                .unwrap_or(&full_path)
                .to_string();
            let size = entry.size();

            if is_dir {
                total_folders += 1;
            } else {
                total_files += 1;
                uncompressed_size += size;
            }

            entries.push(ArchiveEntry {
                path: full_path,
                name,
                is_dir,
                size,
                compressed_size: size,
                modified: None,
            });

            Ok(false) // Don't actually extract to disk, just inspect headers
        },
    )
    .map_err(|e| format!("Could not read 7z archive: {}", e))?;

    Ok(ArchiveSummary {
        archive_name,
        archive_size,
        total_files,
        total_folders,
        uncompressed_size,
        format: "7z".to_string(),
        entries,
    })
}

#[tauri::command]
pub async fn read_archive_entry_content(
    archive_path: String,
    entry_path: String,
) -> Result<ArchiveFileData, String> {
    let src = PathBuf::from(&archive_path);
    if !src.is_file() {
        return Err("Archive file not found".to_string());
    }

    let ext = src
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    let name = entry_path
        .split('/')
        .last()
        .unwrap_or(&entry_path)
        .to_string();
    let (kind, mime_type) = get_file_kind_and_mime(&name);

    let mut bytes = Vec::new();

    if ext == "zip" {
        let file = File::open(&src).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipArchive::new(BufReader::new(file)).map_err(|e| e.to_string())?;

        let index = zip
            .index_for_name(&entry_path)
            .or_else(|| zip.index_for_name(&format!("{}/", entry_path)))
            .ok_or_else(|| format!("File '{}' not found inside ZIP archive", entry_path))?;

        let mut zip_file = zip.by_index(index).map_err(|e| e.to_string())?;

        if zip_file.size() > 30 * 1024 * 1024 {
            return Err(
                "File exceeds 30MB preview limit. Please extract the file instead.".to_string(),
            );
        }

        zip_file
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
    } else if ext == "7z" {
        let mut found = false;
        sevenz_rust::decompress_file_with_extract_fn(
            &src,
            &PathBuf::from(""),
            |entry, reader, _dest| {
                let normalized = entry
                    .name()
                    .trim_end_matches('/')
                    .trim_end_matches('\\')
                    .replace('\\', "/");
                if normalized == entry_path {
                    found = true;
                    if entry.size() > 30 * 1024 * 1024 {
                        return Err(sevenz_rust::Error::other("File exceeds 30MB limit"));
                    }
                    reader.read_to_end(&mut bytes)?;
                }
                Ok(false)
            },
        )
        .map_err(|e| format!("Could not read from 7z archive: {}", e))?;

        if !found {
            return Err(format!("File '{}' not found inside 7z archive", entry_path));
        }
    } else {
        return Err("Unsupported archive format".to_string());
    }

    let size = bytes.len() as u64;

    if kind == "text" {
        let text_content = String::from_utf8_lossy(&bytes).to_string();
        Ok(ArchiveFileData {
            name,
            path: entry_path,
            size,
            kind: kind.to_string(),
            mime_type: mime_type.to_string(),
            text_content: Some(text_content),
            data_url: None,
        })
    } else {
        let base64_str = BASE64.encode(&bytes);
        let data_url = format!("data:{};base64,{}", mime_type, base64_str);
        Ok(ArchiveFileData {
            name,
            path: entry_path,
            size,
            kind: kind.to_string(),
            mime_type: mime_type.to_string(),
            text_content: None,
            data_url: Some(data_url),
        })
    }
}

#[tauri::command]
pub async fn extract_single_entry(
    archive_path: String,
    entry_path: String,
    dest_dir: String,
) -> Result<String, String> {
    let src = PathBuf::from(&archive_path);
    let dest = PathBuf::from(&dest_dir);

    if !src.is_file() {
        return Err("Archive file not found".to_string());
    }

    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;

    let ext = src
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    let file_name = entry_path.split('/').last().unwrap_or("file");
    let out_file_path = dest.join(file_name);

    if ext == "zip" {
        let file = File::open(&src).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipArchive::new(BufReader::new(file)).map_err(|e| e.to_string())?;
        let mut zip_file = zip.by_name(&entry_path).map_err(|e| e.to_string())?;

        let mut out_file = File::create(&out_file_path).map_err(|e| e.to_string())?;
        std::io::copy(&mut zip_file, &mut out_file).map_err(|e| e.to_string())?;
        Ok(format!("Extracted to {}", out_file_path.display()))
    } else if ext == "7z" {
        let mut found = false;
        sevenz_rust::decompress_file_with_extract_fn(&src, &dest, |entry, reader, dest_path| {
            let normalized = entry
                .name()
                .trim_end_matches('/')
                .trim_end_matches('\\')
                .replace('\\', "/");
            if normalized == entry_path {
                found = true;
                let target = dest_path.join(file_name);
                let mut out = File::create(target)?;
                std::io::copy(reader, &mut out)?;
            }
            Ok(false)
        })
        .map_err(|e| e.to_string())?;

        if !found {
            return Err("File not found in 7z archive".to_string());
        }
        Ok(format!("Extracted to {}", out_file_path.display()))
    } else {
        Err("Unsupported archive format".to_string())
    }
}

#[tauri::command]
pub async fn extract_archive(archive_path: String, dest_dir: String) -> Result<String, String> {
    let src = PathBuf::from(&archive_path);
    let dest = PathBuf::from(&dest_dir);

    if !src.is_file() {
        return Err("Archive file not found".to_string());
    }

    std::fs::create_dir_all(&dest)
        .map_err(|e| format!("Could not create destination directory: {}", e))?;

    let ext = src
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "zip" => {
            let file = File::open(&src).map_err(|e| e.to_string())?;
            let mut zip = zip::ZipArchive::new(BufReader::new(file)).map_err(|e| e.to_string())?;
            zip.extract(&dest)
                .map_err(|e| format!("Extraction failed: {}", e))?;
            Ok(format!("Successfully extracted to {}", dest.display()))
        }
        "7z" => {
            sevenz_rust::decompress_file(&src, &dest)
                .map_err(|e| format!("7z extraction failed: {}", e))?;
            Ok(format!("Successfully extracted to {}", dest.display()))
        }
        _ => Err("Unsupported archive format".to_string()),
    }
}
