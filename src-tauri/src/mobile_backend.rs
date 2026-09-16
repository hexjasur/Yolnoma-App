use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherLocation {
    pub latitude: f64,
    pub longitude: f64,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountConfig {
    #[serde(default)]
    pub system_monitoring: bool,
    #[serde(default)]
    pub saved_tools: Vec<String>,
    #[serde(default)]
    pub weather_location: Option<WeatherLocation>,
}

impl Default for AccountConfig {
    fn default() -> Self {
        Self {
            system_monitoring: false,
            saved_tools: Vec::new(),
            weather_location: None,
        }
    }
}

pub struct MobileStorage {
    pub configs: Mutex<HashMap<String, AccountConfig>>,
    pub api_keys: Mutex<HashMap<String, String>>,
}

impl MobileStorage {
    pub fn new() -> Self {
        Self {
            configs: Mutex::new(HashMap::new()),
            api_keys: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub fn set_current_user(
    user_id: String,
    state: tauri::State<'_, crate::AuthState>,
) -> Result<(), String> {
    let mut current = state.user_id.lock().map_err(|e| e.to_string())?;
    *current = (!user_id.is_empty()).then_some(user_id);
    Ok(())
}

#[tauri::command]
pub fn get_account_config(
    user_id: String,
    storage: tauri::State<'_, MobileStorage>,
) -> Result<AccountConfig, String> {
    let configs = storage.configs.lock().map_err(|e| e.to_string())?;
    Ok(configs.get(&user_id).cloned().unwrap_or_default())
}

#[tauri::command]
pub fn save_account_config(
    user_id: String,
    config: AccountConfig,
    storage: tauri::State<'_, MobileStorage>,
) -> Result<(), String> {
    if user_id.is_empty() {
        return Err("user_id cannot be empty".to_string());
    }
    storage
        .configs
        .lock()
        .map_err(|e| e.to_string())?
        .insert(user_id, config);
    Ok(())
}

#[tauri::command]
pub fn get_api_key(
    user_id: String,
    storage: tauri::State<'_, MobileStorage>,
) -> Result<Option<String>, String> {
    Ok(storage
        .api_keys
        .lock()
        .map_err(|e| e.to_string())?
        .get(&user_id)
        .cloned())
}

#[tauri::command]
pub fn set_api_key(
    user_id: String,
    api_key: String,
    storage: tauri::State<'_, MobileStorage>,
) -> Result<(), String> {
    if user_id.is_empty() {
        return Err("user_id cannot be empty".to_string());
    }
    storage
        .api_keys
        .lock()
        .map_err(|e| e.to_string())?
        .insert(user_id, api_key);
    Ok(())
}

#[tauri::command]
pub fn clear_api_key(
    user_id: String,
    storage: tauri::State<'_, MobileStorage>,
) -> Result<(), String> {
    storage
        .api_keys
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&user_id);
    Ok(())
}
