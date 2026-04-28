use keyring::{Entry, Error as KeyringError};

const SERVICE_NAME: &str = "linup-io";

#[tauri::command]
pub fn set_secret(provider: String, key: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, &provider)
        .map_err(|e| format!("Keychain unavailable: {e}"))?;
    entry.set_password(&key)
        .map_err(|e| format!("Failed to set secret: {e}"))
}

#[tauri::command]
pub fn get_secret_masked(provider: String) -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, &provider)
        .map_err(|e| format!("Keychain unavailable: {e}"))?;
    match entry.get_password() {
        Ok(password) if password.len() > 4 => {
            Ok(format!("........{}", &password[password.len() - 4..]))
        }
        Ok(_) => Ok("........".to_string()),
        Err(KeyringError::NoEntry) => Ok("Not set".to_string()),
        Err(e) => Err(format!("Failed to get secret: {e}")),
    }
}

#[tauri::command]
pub fn delete_secret(provider: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, &provider)
        .map_err(|e| format!("Keychain unavailable: {e}"))?;
    entry.delete_credential()
        .map_err(|e| format!("Failed to delete secret: {e}"))
}

#[tauri::command]
pub async fn test_secret(provider: String) -> Result<bool, String> {
    let entry = Entry::new(SERVICE_NAME, &provider)
        .map_err(|e| format!("Keychain unavailable: {e}"))?;
    let key = entry.get_password()
        .map_err(|_| "No API key stored for this provider".to_string())?;

    match provider.as_str() {
        "anthropic" => {
            let client = reqwest::Client::new();
            let res = client
                .get("https://api.anthropic.com/v1/models")
                .header("x-api-key", &key)
                .header("anthropic-version", "2023-06-01")
                .send()
                .await
                .map_err(|e| format!("Network error: {e}"))?;
            if res.status().is_success() {
                Ok(true)
            } else {
                Err(format!("HTTP {}", res.status()))
            }
        }
        _ => Err(format!("Unknown provider: {provider}")),
    }
}
