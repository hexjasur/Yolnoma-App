// ============================================================
// steam_idler.rs — Steam o'yinlarini idling qilish moduli
// SteamUtility.exe idle <app_id> <name> buyrug'i orqali ishlaydi
// ============================================================

use std::collections::{HashMap, HashSet};
use std::sync::atomic::AtomicBool;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sysinfo::System;
use tauri::State;
use tokio::process::Child;
use tokio::sync::Mutex;

/// Steam bir vaqtda qabul qiladigan maksimal o'yinlar soni (protokol chegarasi)
const MAX_CONCURRENT_GAMES: usize = 32;

/// Jarayon ishga tushgandan keyin kutish vaqti
const STARTUP_TIMEOUT: Duration = Duration::from_secs(5);

/// Har bir idling qilinayotgan o'yin haqida ma'lumot
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamGame {
    pub app_id: u32,
    pub name: String,
    pub playtime_forever: u64, // daqiqada
}

/// loginusers.vdf dan o'qilgan akkaunt ma'lumoti
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamUser {
    pub steam_id: String,
    pub persona_name: String,
    pub most_recent: bool,
}

/// Idling natijasi
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdleResult {
    pub running: Vec<u32>,
    pub failed: Vec<u32>,
}

/// Bir o'yin uchun jarayon
pub struct IdleHandle {
    pub child: Child,
}

/// Barcha idling jarayonlarini boshqaradigan holat
pub struct IdlingState {
    pub processes: Mutex<HashMap<u32, IdleHandle>>,
    #[allow(dead_code)]
    poller_started: AtomicBool,
}

impl IdlingState {
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
            poller_started: AtomicBool::new(false),
        }
    }
}

// ── SteamUtility.exe joylashuvini topish ──────────────────────────────
fn locate_steam_utility() -> Result<std::path::PathBuf, String> {
    let current_dir = std::env::current_exe()
        .map_err(|e| format!("current_exe error: {e}"))?
        .parent()
        .map(std::path::Path::to_path_buf)
        .ok_or_else(|| "Could not determine application directory".to_string())?;
    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    let candidates = [
        current_dir.join("resources").join("steam-utility").join("SteamUtility.exe"),
        current_dir.join("resources").join("SteamUtility.exe"),
        manifest_dir
            .join("..")
            .join("libs")
            .join("SteamUtility")
            .join("bin")
            .join("Release")
            .join("SteamUtility.exe"),
    ];

    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "SteamUtility.exe not found. Checked bundled resources and {}.",
        manifest_dir.display()
    ))
}

// ── Steam ishlayotganini tekshirish ───────────────────────────────────
#[tauri::command]
pub fn steam_is_running() -> bool {
    let mut sys = System::new();
    sys.refresh_processes();
    sys.processes()
        .values()
        .any(|p| p.name().eq_ignore_ascii_case("steam.exe"))
}

// ── loginusers.vdf dan akkauntlarni o'qish ────────────────────────────
#[tauri::command]
pub fn get_steam_accounts() -> Result<Vec<SteamUser>, String> {
    // Steam o'rnatilgan papkasini steamlocate orqali topamiz
    let steam_dir = steamlocate::SteamDir::locate()
        .map_err(|e| format!("Steam not found: {e}"))?;
    let vdf_path = steam_dir.path().join("config").join("loginusers.vdf");

    let content = std::fs::read_to_string(&vdf_path)
        .map_err(|e| format!("loginusers.vdf o'qilmadi: {e}"))?;

    parse_login_users(&content)
}

fn parse_login_users(content: &str) -> Result<Vec<SteamUser>, String> {
    use regex::Regex;

    let re = Regex::new(
        r#""(\d{17})"\s*\{[^}]*"(?i:PersonaName)"\s*"([^"]*)""#,
    ).map_err(|e| e.to_string())?;

    let re_recent = Regex::new(
        r#""(?i:MostRecent|AutoLogin)"\s*"(\d+)""#
    ).map_err(|e| e.to_string())?;

    let mut users = Vec::new();
    // Bloklar bo'yicha ajratish
    let block_re = Regex::new(r#""(\d{17})"\s*\{([^}]+)\}"#)
        .map_err(|e| e.to_string())?;

    for cap in block_re.captures_iter(content) {
        let steam_id = cap[1].to_string();
        let block = &cap[2];

        let persona_name = re.captures(block)
            .map(|c| c[2].to_string())
            .unwrap_or_else(|| {
                // fallback: blok ichidan alohida topamiz
                let pn_re = Regex::new(r#""(?i:PersonaName)"\s*"([^"]*)""#).unwrap();
                pn_re.captures(block)
                    .map(|c| c[1].to_string())
                    .unwrap_or_default()
            });

        let most_recent = re_recent.captures_iter(block)
            .any(|c| c[1].parse::<u32>().unwrap_or(0) != 0);

        users.push(SteamUser {
            steam_id,
            persona_name,
            most_recent,
        });
    }

    Ok(users)
}

// ── Steam Web API orqali o'yinlar ro'yxatini olish ────────────────────
// API key binary ichiga embed qilingan — foydalanuvchidan so'ralmayd
#[tauri::command]
pub async fn get_steam_games(steam_id: String) -> Result<Vec<SteamGame>, String> {
    let api_key = crate::embedded_api_key::decode()
        .ok_or_else(|| "Steam API key not found. Rebuild the program.".to_string())?;

    let url = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/\
         ?key={api_key}&steamid={steam_id}&include_appinfo=true\
         &include_played_free_games=true&include_free_sub=true\
         &skip_unvetted_apps=false&format=json"
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| format!("HTTP client xatosi: {e}"))?;

    let resp = client.get(&url).send().await
        .map_err(|e| format!("Network xatosi: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Steam API error: HTTP {}", resp.status()));
    }

    let json: serde_json::Value = resp.json().await
        .map_err(|e| format!("JSON parse error: {e}"))?;

    // game_count yo'q = profil yopiq
    if json.pointer("/response/game_count").is_none() {
        return Err(
            "Steam profile is private. Steam → Profile → Privacy Settings → \
             Game data: Make visible to everyone.".to_string()
        );
    }

    let games_arr = json
        .pointer("/response/games")
        .and_then(|g| g.as_array())
        .ok_or_else(|| "O'yinlar ro'yxati bo'sh.".to_string())?;

    let games: Vec<SteamGame> = games_arr
        .iter()
        .filter_map(|g| {
            let app_id = g.get("appid")?.as_u64()? as u32;
            let name = g.get("name")?.as_str()?.to_string();
            let playtime = g.get("playtime_forever")
                .and_then(|p| p.as_u64())
                .unwrap_or(0);
            Some(SteamGame { app_id, name, playtime_forever: playtime })
        })
        .collect();

    Ok(games)
}

// ── O'yin(lar)ni idling boshlash ──────────────────────────────────────
#[tauri::command]
pub async fn start_idling(
    targets: Vec<SteamGame>,
    state: State<'_, IdlingState>,
) -> Result<IdleResult, String> {
    let exe = locate_steam_utility()?;

    // 32 ta chegarasi
    let targets: Vec<SteamGame> = {
        let mut seen = HashSet::new();
        targets.into_iter()
            .filter(|t| seen.insert(t.app_id))
            .take(MAX_CONCURRENT_GAMES)
            .collect()
    };

    let desired: HashSet<u32> = targets.iter().map(|t| t.app_id).collect();
    let mut processes = state.processes.lock().await;

    // Stop unnecessary processes.
    let to_remove: Vec<u32> = processes.keys()
        .filter(|id| !desired.contains(*id))
        .copied()
        .collect();
    for app_id in to_remove {
        if let Some(mut h) = processes.remove(&app_id) {
            let _ = h.child.kill().await;
        }
    }

    let mut failed = Vec::new();

    // Launching new games.
    for target in &targets {
        if processes.contains_key(&target.app_id) {
            continue; // It is already working.
        }

        match spawn_idle(&exe, target).await {
            Ok(child) => {
                processes.insert(target.app_id, IdleHandle { child });
            }
            Err(e) => {
                eprintln!("Idling boshlashda xato ({}): {e}", target.app_id);
                failed.push(target.app_id);
            }
        }
    }

    let running: Vec<u32> = processes.keys().copied().collect();
    Ok(IdleResult { running, failed })
}

async fn spawn_idle(
    exe: &std::path::Path,
    game: &SteamGame,
) -> Result<Child, String> {
    use tokio::process::Command;

    #[cfg(windows)]
    #[allow(unused_imports)]
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let mut cmd = Command::new(exe);
    cmd.arg("idle")
        .arg(game.app_id.to_string())
        .arg(&game.name)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true);

    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd.spawn()
        .map_err(|e| format!("Jarayon ishga tushmadi: {e}"))?;

    // Startup output ni kutamiz (muvaffaqiyat yoki muvaffaqiyatsizlik)
    if let Some(stdout) = child.stdout.take() {
        use tokio::io::{AsyncBufReadExt, BufReader};
        let mut lines = BufReader::new(stdout).lines();
        match tokio::time::timeout(STARTUP_TIMEOUT, lines.next_line()).await {
            Ok(Ok(Some(line))) => {
                // {"ok":false,...} bo'lsa xato
                if line.contains("\"ok\":false") || line.contains("\"ok\": false") {
                    let _ = child.kill().await;
                    return Err(format!("SteamUtility xatosi: {line}"));
                }
            }
            _ => {
                // Timeout yoki stdout yo'q — agar jarayon hali ishlasa, ok
                if let Ok(Some(_)) = child.try_wait() {
                    return Err("Jarayon darhol chiqib ketdi".to_string());
                }
            }
        }
    }

    Ok(child)
}

// ── Bitta o'yinni to'xtatish ──────────────────────────────────────────
#[tauri::command]
pub async fn stop_idling(
    app_id: u32,
    state: State<'_, IdlingState>,
) -> Result<(), String> {
    let mut processes = state.processes.lock().await;
    if let Some(mut h) = processes.remove(&app_id) {
        h.child.kill().await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── Barcha o'yinlarni to'xtatish ─────────────────────────────────────
#[tauri::command]
pub async fn stop_all_idling(state: State<'_, IdlingState>) -> Result<(), String> {
    let mut processes = state.processes.lock().await;
    for (_, mut h) in processes.drain() {
        let _ = h.child.kill().await;
    }
    Ok(())
}

// ── Hozir idling qilinayotgan o'yinlar ───────────────────────────────
#[tauri::command]
pub async fn get_idle_state(state: State<'_, IdlingState>) -> Result<Vec<u32>, String> {
    let processes = state.processes.lock().await;
    Ok(processes.keys().copied().collect())
}

// ============================================================
// SAM — Steam Achievement Manager commands
// All commands reuse locate_steam_utility() and spawn SteamUtility.exe
// Output: {"ok":true,"result":{...}} or {"ok":false,"error":"..."}
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Achievement {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon_normal: String,
    pub icon_locked: String,
    pub achieved: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub percent: Option<f64>,
    pub hidden: bool,
    pub protected_achievement: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stat {
    pub id: String,
    pub name: String,
    pub stat_type: String,
    pub value: serde_json::Value,
    pub increment_only: bool,
    pub protected_stat: bool,
}

/// Spawn SteamUtility.exe with given args and return parsed JSON result.
async fn run_steam_utility(args: &[&str]) -> Result<serde_json::Value, String> {
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::process::Command;

    let exe = locate_steam_utility()?;

    #[cfg(windows)]
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let mut cmd = Command::new(&exe);
    for arg in args {
        cmd.arg(arg);
    }
    cmd.stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true);

    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start SteamUtility: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "No stdout from SteamUtility".to_string())?;

    let mut lines = BufReader::new(stdout).lines();
    let line = tokio::time::timeout(Duration::from_secs(30), lines.next_line())
        .await
        .map_err(|_| "SteamUtility timed out".to_string())?
        .map_err(|e| format!("Read error: {e}"))?
        .ok_or_else(|| "SteamUtility returned no output".to_string())?;

    let _ = child.wait().await;

    let json: serde_json::Value =
        serde_json::from_str(&line).map_err(|e| format!("JSON parse error: {e} — output: {line}"))?;

    if json.get("ok").and_then(|v| v.as_bool()) == Some(false) {
        let err = json
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown SteamUtility error");
        return Err(err.to_string());
    }

    Ok(json)
}

// ── Get achievement + stat data for a game ───────────────────────────
#[tauri::command]
pub async fn get_achievement_data(app_id: u32) -> Result<serde_json::Value, String> {
    let id = app_id.to_string();
    let json = run_steam_utility(&["get_achievement_data", &id]).await?;
    Ok(json.get("result").cloned().unwrap_or(json))
}

// ── Unlock or lock a single achievement ──────────────────────────────
#[tauri::command]
pub async fn set_achievement(app_id: u32, ach_id: String, unlock: bool) -> Result<(), String> {
    let id = app_id.to_string();
    let cmd = if unlock { "unlock_achievement" } else { "lock_achievement" };
    run_steam_utility(&[cmd, &id, &ach_id]).await?;
    Ok(())
}

// ── Unlock all achievements for a game ───────────────────────────────
#[tauri::command]
pub async fn unlock_all_achievements(app_id: u32) -> Result<(), String> {
    let id = app_id.to_string();
    run_steam_utility(&["unlock_all_achievements", &id]).await?;
    Ok(())
}

// ── Lock all achievements for a game ─────────────────────────────────
#[tauri::command]
pub async fn lock_all_achievements(app_id: u32) -> Result<(), String> {
    let id = app_id.to_string();
    run_steam_utility(&["lock_all_achievements", &id]).await?;
    Ok(())
}

// ── Update stats for a game ───────────────────────────────────────────
// stats_json: JSON array of stat update objects
#[tauri::command]
pub async fn update_stats(app_id: u32, stats_json: String) -> Result<(), String> {
    let id = app_id.to_string();
    run_steam_utility(&["update_stats", &id, &stats_json]).await?;
    Ok(())
}

// ── Reset all stats for a game ────────────────────────────────────────
#[tauri::command]
pub async fn reset_all_stats(app_id: u32) -> Result<(), String> {
    let id = app_id.to_string();
    run_steam_utility(&["reset_all_stats", &id]).await?;
    Ok(())
}
