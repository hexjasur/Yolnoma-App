//! Account-specific local storage for Yolnoma.
//!
//! Paths:
//!   %LOCALAPPDATA%\Yolnoma\master.key          — DPAPI-protected random master secret
//!   %LOCALAPPDATA%\Yolnoma\accounts\{id}\config.json
//!   %LOCALAPPDATA%\Yolnoma\accounts\{id}\secrets.dat
//!
//! secrets.dat layout: [ nonce(12) | user_id_sha256(32) | aes-gcm-ciphertext ]
//! Encryption key = HKDF-SHA256(master, salt="yolnoma-account-key", info=userId)
//! This makes secrets.dat cryptographically bound to the userId.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use hkdf::Hkdf;
use rand::RngCore;
use sha2::{Digest, Sha256};

// ── In-memory cache ──────────────────────────────────────────────────────────

pub struct ApiKeyCache {
    pub cache: Mutex<HashMap<String, String>>,
}

impl ApiKeyCache {
    pub fn new() -> Self {
        ApiKeyCache {
            cache: Mutex::new(HashMap::new()),
        }
    }
}

// ── Config struct ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherLocation {
    pub latitude: f64,
    pub longitude: f64,
    pub label: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
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
        AccountConfig {
            system_monitoring: false,
            saved_tools: vec![],
            weather_location: None,
        }
    }
}

// ── Path helpers ─────────────────────────────────────────────────────────────

fn yolnoma_root() -> Result<PathBuf, String> {
    let local = std::env::var("LOCALAPPDATA")
        .map_err(|_| "LOCALAPPDATA environment variable not found".to_string())?;
    Ok(PathBuf::from(local).join("Yolnoma"))
}

fn account_dir(user_id: &str) -> Result<PathBuf, String> {
    Ok(yolnoma_root()?.join("accounts").join(user_id))
}

// ── Windows DPAPI ────────────────────────────────────────────────────────────

#[link(name = "kernel32")]
extern "system" {
    fn LocalFree(hmem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
}

fn dpapi_protect(data: &[u8]) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::Security::Cryptography::{CryptProtectData, CRYPT_INTEGER_BLOB};

    let mut input = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    let ok = unsafe {
        CryptProtectData(
            &mut input,
            std::ptr::null(),      // description (optional)
            std::ptr::null_mut(),  // optional entropy
            std::ptr::null_mut(),  // reserved
            std::ptr::null_mut(),  // prompt struct
            0,                     // flags
            &mut output,
        )
    };

    if ok == 0 {
        return Err(format!(
            "CryptProtectData failed (error {})",
            unsafe { windows_sys::Win32::Foundation::GetLastError() }
        ));
    }

    let protected =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { LocalFree(output.pbData as _) };
    Ok(protected)
}

fn dpapi_unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB};

    let mut input = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    let ok = unsafe {
        CryptUnprotectData(
            &mut input,
            std::ptr::null_mut(), // description out (ignored)
            std::ptr::null_mut(), // optional entropy
            std::ptr::null_mut(), // reserved
            std::ptr::null_mut(), // prompt struct
            0,                    // flags
            &mut output,
        )
    };

    if ok == 0 {
        return Err(format!(
            "CryptUnprotectData failed (error {})",
            unsafe { windows_sys::Win32::Foundation::GetLastError() }
        ));
    }

    let plain =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { LocalFree(output.pbData as _) };
    Ok(plain)
}

// ── Master key (DPAPI-protected random secret) ───────────────────────────────

fn get_or_create_master() -> Result<Vec<u8>, String> {
    let root = yolnoma_root()?;
    std::fs::create_dir_all(&root)
        .map_err(|e| format!("Failed to create Yolnoma dir: {}", e))?;

    let master_path = root.join("master.key");

    if master_path.exists() {
        let protected = std::fs::read(&master_path)
            .map_err(|e| format!("Failed to read master.key: {}", e))?;
        dpapi_unprotect(&protected)
    } else {
        // Generate a fresh random 32-byte master secret
        let mut master = vec![0u8; 32];
        rand::thread_rng().fill_bytes(&mut master);

        let protected = dpapi_protect(&master)?;
        std::fs::write(&master_path, &protected)
            .map_err(|e| format!("Failed to write master.key: {}", e))?;

        Ok(master)
    }
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

/// Derive a 256-bit AES key from the master secret, bound to `user_id`.
fn derive_key(master: &[u8], user_id: &str) -> [u8; 32] {
    let hk = Hkdf::<Sha256>::new(Some(b"yolnoma-account-key"), master);
    let mut okm = [0u8; 32];
    hk.expand(user_id.as_bytes(), &mut okm)
        .expect("HKDF expand should not fail for 32-byte output");
    okm
}

fn sha256_bytes(data: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().into()
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Tell the backend which user is currently logged in.
/// Called by the frontend after a successful login / on initAuth.
#[tauri::command]
pub fn set_current_user(
    user_id: String,
    state: tauri::State<'_, crate::AuthState>,
) -> Result<(), String> {
    let mut guard = state
        .user_id
        .lock()
        .map_err(|e| format!("Mutex error: {}", e))?;
    *guard = if user_id.is_empty() { None } else { Some(user_id) };
    Ok(())
}

/// Read config.json for the given account.
#[tauri::command]
pub fn get_account_config(user_id: String) -> Result<AccountConfig, String> {
    if user_id.is_empty() {
        return Ok(AccountConfig::default());
    }
    let path = account_dir(&user_id)?.join("config.json");
    if !path.exists() {
        return Ok(AccountConfig::default());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config.json: {}", e))?;
    serde_json::from_str::<AccountConfig>(&content)
        .map_err(|e| format!("Failed to parse config.json: {}", e))
}

/// Write config.json for the given account.
#[tauri::command]
pub fn save_account_config(user_id: String, config: AccountConfig) -> Result<(), String> {
    if user_id.is_empty() {
        return Err("user_id cannot be empty".to_string());
    }
    let dir = account_dir(&user_id)?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create account dir: {}", e))?;

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    std::fs::write(dir.join("config.json"), content)
        .map_err(|e| format!("Failed to write config.json: {}", e))
}

/// Decrypt and return the API key for the given account.
/// Returns `null` if no secrets.dat exists.
/// Fails if the file was created for a different userId.
#[tauri::command]
pub fn get_api_key(
    user_id: String,
    cache: tauri::State<'_, ApiKeyCache>,
) -> Result<Option<String>, String> {
    if user_id.is_empty() {
        return Ok(None);
    }

    // ── 1. Memory cache hit ──
    {
        let guard = cache.cache.lock().map_err(|e| format!("Cache lock error: {}", e))?;
        if let Some(key) = guard.get(&user_id) {
            return Ok(Some(key.clone()));
        }
    }

    // ── 2. Read secrets.dat ──
    let secrets_path = account_dir(&user_id)?.join("secrets.dat");
    if !secrets_path.exists() {
        return Ok(None);
    }

    let data = std::fs::read(&secrets_path)
        .map_err(|e| format!("Failed to read secrets.dat: {}", e))?;

    // Layout: [nonce 12b][user_id sha256 32b][ciphertext …]
    if data.len() < 12 + 32 + 1 {
        return Err("secrets.dat is corrupted (too short)".to_string());
    }

    let nonce_bytes = &data[..12];
    let stored_hash = &data[12..44];
    let ciphertext = &data[44..];

    // ── 3. Verify userId binding ──
    let expected_hash = sha256_bytes(user_id.as_bytes());
    if stored_hash != expected_hash {
        return Err(
            "secrets.dat is not bound to this account — decryption refused".to_string(),
        );
    }

    // ── 4. Derive key & decrypt ──
    let master = get_or_create_master()?;
    let derived = derive_key(&master, &user_id);

    let key = Key::<Aes256Gcm>::from_slice(&derived);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "AES-GCM decryption failed — key mismatch or data corrupted".to_string())?;

    let api_key = String::from_utf8(plaintext)
        .map_err(|e| format!("Decrypted data is not valid UTF-8: {}", e))?;

    // ── 5. Populate cache ──
    {
        let mut guard = cache.cache.lock().map_err(|e| format!("Cache lock error: {}", e))?;
        guard.insert(user_id, api_key.clone());
    }

    Ok(Some(api_key))
}

/// Encrypt and persist the API key for the given account.
#[tauri::command]
pub fn set_api_key(
    user_id: String,
    api_key: String,
    cache: tauri::State<'_, ApiKeyCache>,
) -> Result<(), String> {
    if user_id.is_empty() {
        return Err("user_id cannot be empty".to_string());
    }

    let dir = account_dir(&user_id)?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create account dir: {}", e))?;

    let master = get_or_create_master()?;
    let derived = derive_key(&master, &user_id);

    let key = Key::<Aes256Gcm>::from_slice(&derived);
    let cipher = Aes256Gcm::new(key);

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, api_key.as_bytes())
        .map_err(|_| "AES-GCM encryption failed".to_string())?;

    let user_hash = sha256_bytes(user_id.as_bytes());

    // Layout: [nonce 12b][user_id_sha256 32b][ciphertext]
    let mut out = Vec::with_capacity(12 + 32 + ciphertext.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&user_hash);
    out.extend_from_slice(&ciphertext);

    std::fs::write(dir.join("secrets.dat"), &out)
        .map_err(|e| format!("Failed to write secrets.dat: {}", e))?;

    // Update cache
    {
        let mut guard = cache.cache.lock().map_err(|e| format!("Cache lock error: {}", e))?;
        guard.insert(user_id, api_key);
    }

    Ok(())
}

/// Remove the API key for the given account from disk and memory cache.
#[tauri::command]
pub fn clear_api_key(
    user_id: String,
    cache: tauri::State<'_, ApiKeyCache>,
) -> Result<(), String> {
    // Evict from cache
    {
        let mut guard = cache.cache.lock().map_err(|e| format!("Cache lock error: {}", e))?;
        guard.remove(&user_id);
    }

    let secrets_path = account_dir(&user_id)?.join("secrets.dat");
    if secrets_path.exists() {
        std::fs::remove_file(&secrets_path)
            .map_err(|e| format!("Failed to remove secrets.dat: {}", e))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_serde_camel_case() {
        let config = AccountConfig {
            system_monitoring: true,
            saved_tools: vec!["ai-chat".to_string(), "cleaner".to_string()],
            weather_location: None,
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"systemMonitoring\":true"));
        assert!(json.contains("\"savedTools\":[\"ai-chat\",\"cleaner\"]"));

        let deserialized: AccountConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.system_monitoring, true);
        assert_eq!(deserialized.saved_tools.len(), 2);
    }

    #[test]
    fn test_derive_key_uniqueness() {
        let master = b"01234567890123456789012345678901";
        let key_user1 = derive_key(master, "user_123");
        let key_user2 = derive_key(master, "user_1234");
        assert_ne!(key_user1, key_user2);
    }

    #[test]
    fn test_cryptographic_binding_simulation() {
        let master = b"01234567890123456789012345678901";
        let user_id = "user_123";
        let wrong_user_id = "user_1234";
        let secret = "sk-or-v1-my-secret-openrouter-key-99999";

        // Encrypt for user_id
        let derived = derive_key(master, user_id);
        let key = Key::<Aes256Gcm>::from_slice(&derived);
        let cipher = Aes256Gcm::new(key);
        let nonce_bytes = [7u8; 12];
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher.encrypt(nonce, secret.as_bytes()).unwrap();
        let user_hash = sha256_bytes(user_id.as_bytes());

        let mut blob = Vec::new();
        blob.extend_from_slice(&nonce_bytes);
        blob.extend_from_slice(&user_hash);
        blob.extend_from_slice(&ciphertext);

        // Try to decrypt with correct user_id
        let extracted_nonce = &blob[..12];
        let extracted_hash = &blob[12..44];
        let extracted_ciphertext = &blob[44..];

        let expected_hash = sha256_bytes(user_id.as_bytes());
        assert_eq!(extracted_hash, expected_hash);

        let derived_correct = derive_key(master, user_id);
        let key_correct = Key::<Aes256Gcm>::from_slice(&derived_correct);
        let cipher_correct = Aes256Gcm::new(key_correct);
        let decrypted = cipher_correct
            .decrypt(Nonce::from_slice(extracted_nonce), extracted_ciphertext)
            .unwrap();
        assert_eq!(String::from_utf8(decrypted).unwrap(), secret);

        // Try to decrypt with wrong user_id -> hash check fails immediately
        let wrong_expected_hash = sha256_bytes(wrong_user_id.as_bytes());
        assert_ne!(extracted_hash, wrong_expected_hash);

        // Even if hash check was skipped, wrong key fails AES-GCM decryption
        let derived_wrong = derive_key(master, wrong_user_id);
        let key_wrong = Key::<Aes256Gcm>::from_slice(&derived_wrong);
        let cipher_wrong = Aes256Gcm::new(key_wrong);
        let decrypt_result = cipher_wrong
            .decrypt(Nonce::from_slice(extracted_nonce), extracted_ciphertext);
        assert!(decrypt_result.is_err());
    }
}
