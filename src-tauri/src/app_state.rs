use std::sync::Mutex;

/// Shared application state that is intentionally kept separate from command
/// implementations so the Tauri bootstrap remains easy to audit.
pub struct AuthState {
    pub user_id: Mutex<Option<String>>,
}

impl AuthState {
    pub fn new() -> Self {
        Self {
            user_id: Mutex::new(None),
        }
    }
}

impl Default for AuthState {
    fn default() -> Self {
        Self::new()
    }
}
