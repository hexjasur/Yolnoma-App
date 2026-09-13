use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSessionMessage {
    pub role: String,
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSession {
    pub version: u8,
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    pub messages: Vec<ChatSessionMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSessionSummary {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub message_count: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

fn now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let millis = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    format!("{millis}")
}

fn root() -> Result<PathBuf, String> {
    let local = std::env::var("LOCALAPPDATA").map_err(|_| "LOCALAPPDATA environment variable not found".to_string())?;
    Ok(PathBuf::from(local).join("Yolnoma"))
}

fn validate_user_id(value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > 64 || !value.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') || value.contains("..") {
        return Err("Invalid user id".to_string());
    }
    Ok(())
}

fn validate_session_id(value: &str) -> Result<(), String> {
    if value.len() != 32 || !value.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Invalid session id".to_string());
    }
    Ok(())
}

fn sessions_dir(user_id: &str) -> Result<PathBuf, String> {
    validate_user_id(user_id)?;
    Ok(root()?.join("accounts").join(user_id).join("ai-chat").join("sessions"))
}

fn session_path(user_id: &str, session_id: &str) -> Result<PathBuf, String> {
    validate_session_id(session_id)?;
    Ok(sessions_dir(user_id)?.join(format!("{session_id}.json")))
}

fn write_json_atomic(path: &Path, value: &impl Serialize) -> Result<(), String> {
    let content = serde_json::to_string_pretty(value).map_err(|e| format!("Could not serialize session: {e}"))?;
    let temp = path.with_extension("json.tmp");
    std::fs::write(&temp, content).map_err(|e| format!("Could not write temporary session: {e}"))?;
    std::fs::rename(&temp, path).map_err(|e| format!("Could not finalize session: {e}"))
}

fn make_id() -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[tauri::command]
pub fn list_ai_chat_sessions(user_id: String) -> Result<Vec<ChatSessionSummary>, String> {
    let dir = sessions_dir(&user_id)?;
    if !dir.exists() { return Ok(vec![]); }
    let mut result = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| format!("Could not list sessions: {e}"))? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|x| x.to_str()) != Some("json") { continue; }
        let content = match std::fs::read_to_string(&path) { Ok(value) => value, Err(_) => continue };
        if let Ok(session) = serde_json::from_str::<ChatSession>(&content) {
            result.push(ChatSessionSummary { id: session.id, title: session.title, created_at: session.created_at, updated_at: session.updated_at, message_count: session.messages.len(), model: session.model });
        }
    }
    result.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(result)
}

#[tauri::command]
pub fn get_ai_chat_session(user_id: String, session_id: String) -> Result<ChatSession, String> {
    let path = session_path(&user_id, &session_id)?;
    let content = std::fs::read_to_string(&path).map_err(|e| format!("Could not read session: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("Could not parse session: {e}"))
}

#[tauri::command]
pub fn save_ai_chat_session(user_id: String, mut session: ChatSession) -> Result<(), String> {
    if session.id.is_empty() { session.id = make_id(); }
    validate_session_id(&session.id)?;
    if session.version == 0 { session.version = 1; }
    if session.created_at.is_empty() { session.created_at = now(); }
    session.updated_at = now();
    let dir = sessions_dir(&user_id)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create sessions directory: {e}"))?;
    write_json_atomic(&session_path(&user_id, &session.id)?, &session)
}

#[tauri::command]
pub fn delete_ai_chat_session(user_id: String, session_id: String) -> Result<(), String> {
    let path = session_path(&user_id, &session_id)?;
    if path.exists() { std::fs::remove_file(path).map_err(|e| format!("Could not delete session: {e}"))?; }
    Ok(())
}

#[tauri::command]
pub fn create_ai_chat_session(user_id: String, title: Option<String>) -> Result<ChatSession, String> {
    let session = ChatSession { version: 1, id: make_id(), title: title.unwrap_or_else(|| "New chat".to_string()), created_at: now(), updated_at: now(), model: None, messages: vec![] };
    save_ai_chat_session(user_id, session.clone())?;
    Ok(session)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn generated_ids_are_safe() { let id = make_id(); assert_eq!(id.len(), 32); assert!(validate_session_id(&id).is_ok()); }
}
