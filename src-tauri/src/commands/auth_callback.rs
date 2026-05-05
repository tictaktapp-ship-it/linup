use std::io::{Read, Write};
use std::net::TcpListener;
use tauri::AppHandle;
use tauri::Emitter;

#[derive(Clone, serde::Serialize)]
struct AuthCallbackPayload {
    url: String,
}

#[tauri::command]
pub async fn start_auth_callback_server(app: AppHandle) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind: {e}"))?;
    let port = listener.local_addr()
        .map_err(|e| format!("Failed to get port: {e}"))?.port();

    let app_clone = app.clone();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(mut stream) => {
                    let mut buf = vec![0u8; 8192];
                    if let Ok(n) = stream.read(&mut buf) {
                        let request = String::from_utf8_lossy(&buf[..n]);
                        if let Some(line) = request.lines().next() {
                            if let Some(path) = line.split_whitespace().nth(1) {
                                let full_url = format!("http://127.0.0.1:{}{}", port, path);
                                let _ = app_clone.emit("auth-callback", AuthCallbackPayload { url: full_url });
                                let html = "<!DOCTYPE html><html><head><title>LINUP</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#F9F9F8;}div{text-align:center;}</style></head><body><div><h2 style='color:#1A1A18'>You are signed in to LINUP!</h2><p style='color:#6B6B66'>You can close this tab and return to the LINUP app.</p></div></body></html>";
                                let response = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", html.len(), html);
                                let _ = stream.write_all(response.as_bytes());
                                break;
                            }
                        }
                    }
                }
                Err(_) => break,
            }
        }
    });

    Ok(port)
}