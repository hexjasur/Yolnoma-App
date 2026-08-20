use std::fs;
use std::path::Path;

fn main() {
    // .env fayllarini tekshiramiz (src-tauri ichida yoki bitta yuqorida)
    let paths = ["./.env", "../.env"];
    let mut api_key = None;

    for path in &paths {
        if let Ok(content) = fs::read_to_string(Path::new(path)) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("STEAM_API_KEY=") {
                    let val = trimmed["STEAM_API_KEY=".len()..].trim().trim_matches('"').trim_matches('\'');
                    if !val.is_empty() {
                        api_key = Some(val.to_string());
                        break;
                    }
                }
            }
        }
        if api_key.is_some() {
            break;
        }
    }

    if let Some(key) = api_key {
        println!("cargo:rustc-env=STEAM_API_KEY={}", key);
    }

    tauri_build::build();
}
