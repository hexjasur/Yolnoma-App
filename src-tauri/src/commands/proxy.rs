/// URL tekshiruvi:
/// - Faqat http/https schemasi
/// - Cloud metadata endpointlar taqiqlangan
/// - Localhost (port 3000/1420), api.yolnoma.uz va barcha tashqi API lari to'liq ruxsat etiladi
fn validate_proxy_url(url: &str) -> Result<(), String> {
    let parsed = url
        .parse::<reqwest::Url>()
        .map_err(|_| format!("Invalid URL format: {}", url))?;

    let scheme = parsed.scheme();
    if scheme != "https" && scheme != "http" {
        return Err(format!("Only HTTP/HTTPS URLs are allowed, got: {}", scheme));
    }

    let host = parsed.host_str().unwrap_or("").to_lowercase();

    // We block only malicious cloud metadata IPs (AWS/GCP/Azure IMDS).
    let blocked: &[&str] = &[
        "169.254.169.254",
        "metadata.google.internal",
        "metadata.google",
    ];
    if blocked.contains(&host.as_str()) {
        return Err(format!("Requests to '{}' are not allowed", host));
    }

    Ok(())
}

#[tauri::command]
pub async fn proxy_ep(url: String) -> Result<serde_json::Value, String> {
    validate_proxy_url(&url)?;

    let client = reqwest::Client::builder()
        // danger_accept_invalid_certs REMOVED — SSL certificate will be verified.
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let res = client
        .get(&url)
        .header("Accept", "application/json")
        .header(
            "Referer",
            crate::embedded_api_key::referer()
                .map_err(|e| format!("Referer configuration error: {}", e))?,
        )
        .send()
        .await
        .map_err(|e| format!("Network error ({}): {}", url, e))?;

    let status = res.status();
    if !status.is_success() {
        return Err(format!("HTTP {} from {}", status, url));
    }

    let json = res
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;

    Ok(json)
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ProxyResponse {
    pub status: u16,
    pub body: serde_json::Value,
}

#[tauri::command]
pub async fn proxy_request(
    method: String,
    url: String,
    headers: std::collections::HashMap<String, String>,
    body: Option<serde_json::Value>,
) -> Result<ProxyResponse, String> {
    // SSRF protection — URL validation
    validate_proxy_url(&url)?;

    let client = reqwest::Client::new();
    let mut req = match method.to_uppercase().as_str() {
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "PATCH" => client.patch(&url),
        "DELETE" => client.delete(&url),
        _ => client.get(&url),
    };

    // Filtering dangerous headers
    let blocked_headers = ["host", "x-forwarded-for", "x-real-ip", "forwarded"];
    for (k, v) in headers {
        if !blocked_headers.contains(&k.to_lowercase().as_str()) {
            req = req.header(k, v);
        }
    }

    if let Some(b) = body {
        req = req.json(&b);
    }

    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let text = res.text().await.map_err(|e| e.to_string())?;

    // Try parsing as JSON, fallback to raw string in a JSON object
    let body_json: serde_json::Value =
        serde_json::from_str(&text).unwrap_or(serde_json::json!({ "text": text }));

    Ok(ProxyResponse {
        status,
        body: body_json,
    })
}
