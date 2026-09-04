use std::fs;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=../.env");
    println!("cargo:rerun-if-changed=./.env");

    // Check .env files
    let paths = ["./.env", "../.env"];
    let mut api_key = None;
    let mut frontend_key = None;

    for path in &paths {
        if let Ok(content) = fs::read_to_string(Path::new(path)) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("STEAM_API_KEY=") {
                    let val = trimmed["STEAM_API_KEY=".len()..].trim().trim_matches('"').trim_matches('\'');
                    if !val.is_empty() {
                        api_key = Some(val.to_string());
                    }
                }
                if trimmed.starts_with("VITE_ABC_KEY=") {
                    let val = trimmed["VITE_ABC_KEY=".len()..].trim().trim_matches('"').trim_matches('\'');
                    if !val.is_empty() {
                        frontend_key = Some(val.to_string());
                    }
                }
            }
        }
        if api_key.is_some() && frontend_key.is_some() {
            break;
        }
    }

    if let Some(key) = api_key {
        println!("cargo:rustc-env=STEAM_API_KEY={}", key);
    }

    if let Some(key) = frontend_key {
        println!("cargo:rustc-env=VITE_ABC_KEY={}", key);
    }

    tauri_build::build();
}
