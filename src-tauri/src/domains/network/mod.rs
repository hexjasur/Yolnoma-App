use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time::timeout;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PortScanResult {
    pub port: u16,
    pub status: String, // "open" | "closed" | "timeout"
    pub service: String,
    pub latency_ms: Option<u64>,
}

fn get_service_name(port: u16) -> &'static str {
    match port {
        20 => "FTP Data",
        21 => "FTP Control",
        22 => "SSH",
        23 => "Telnet",
        25 => "SMTP",
        53 => "DNS",
        80 => "HTTP",
        110 => "POP3",
        111 => "RPCBind",
        135 => "MSRPC",
        139 => "NetBIOS",
        143 => "IMAP",
        443 => "HTTPS",
        445 => "Microsoft-DS / SMB",
        465 => "SMTPS",
        587 => "SMTP Submission",
        993 => "IMAPS",
        995 => "POP3S",
        1433 => "MS SQL",
        1434 => "MS SQL Monitor",
        1521 => "Oracle DB",
        2049 => "NFS",
        2181 => "ZooKeeper",
        2375 => "Docker Plain",
        2376 => "Docker SSL",
        3000 => "Dev Server / Node.js",
        3306 => "MySQL / MariaDB",
        3389 => "RDP",
        5000 => "Flask / ASP.NET",
        5432 => "PostgreSQL",
        5672 => "RabbitMQ",
        5900 => "VNC",
        6379 => "Redis",
        8000 => "HTTP Dev / Alt",
        8080 => "HTTP Proxy / Alt",
        8443 => "HTTPS Alt",
        8888 => "HTTP Alt / Jupyter",
        9000 => "SonarQube / PHP-FPM",
        9200 => "Elasticsearch",
        9300 => "Elasticsearch Cluster",
        11211 => "Memcached",
        27017 => "MongoDB",
        _ => "Unknown",
    }
}

async fn scan_single_port(host: &str, port: u16, timeout_duration: Duration) -> PortScanResult {
    let service = get_service_name(port).to_string();

    let mut addrs_to_try: Vec<SocketAddr> = Vec::new();

    if host.eq_ignore_ascii_case("localhost") || host == "127.0.0.1" || host == "::1" {
        if let Ok(v4) = format!("127.0.0.1:{}", port).parse::<SocketAddr>() {
            addrs_to_try.push(v4);
        }
        if let Ok(v6) = format!("[::1]:{}", port).parse::<SocketAddr>() {
            addrs_to_try.push(v6);
        }
    } else if let Ok(addrs) = tokio::net::lookup_host((host, port)).await {
        for addr in addrs {
            addrs_to_try.push(addr);
        }
    }

    if addrs_to_try.is_empty() {
        return PortScanResult {
            port,
            status: "closed".to_string(),
            service,
            latency_ms: None,
        };
    }

    let start = Instant::now();
    let mut any_timeout = false;

    for target_addr in addrs_to_try {
        match timeout(timeout_duration, TcpStream::connect(target_addr)).await {
            Ok(Ok(_stream)) => {
                let latency = start.elapsed().as_millis() as u64;
                return PortScanResult {
                    port,
                    status: "open".to_string(),
                    service,
                    latency_ms: Some(latency),
                };
            }
            Ok(Err(_)) => {
                // Connection refused on this address, continue to next address
            }
            Err(_) => {
                any_timeout = true;
            }
        }
    }

    PortScanResult {
        port,
        status: if any_timeout {
            "timeout".to_string()
        } else {
            "closed".to_string()
        },
        service,
        latency_ms: None,
    }
}

#[tauri::command]
pub async fn scan_ports(
    host: String,
    ports: Vec<u16>,
    timeout_ms: Option<u64>,
) -> Result<Vec<PortScanResult>, String> {
    let host = host.trim().to_string();
    if host.is_empty() {
        return Err("Host cannot be empty".to_string());
    }

    // ===================================================================================
    // ===================================================================================
    // ===================================================================================
    // TODO: Allow scanning only of localhost — SSRF / network reconnaissance protection
    let allowed_hosts: &[&str] = &["localhost", "127.0.0.1", "::1"];
    if !allowed_hosts.contains(&host.as_str()) {
        return Err("Port scanning is only allowed for localhost (127.0.0.1 / ::1)".to_string());
    }
    // ===================================================================================
    // ===================================================================================
    // ===================================================================================

    if ports.is_empty() {
        return Err("No ports specified for scanning".to_string());
    }

    let timeout_duration = Duration::from_millis(timeout_ms.unwrap_or(800).clamp(100, 5000));
    let chunk_size = 64;
    let mut results = Vec::new();

    for chunk in ports.chunks(chunk_size) {
        let mut set = tokio::task::JoinSet::new();
        for &port in chunk {
            let h = host.clone();
            set.spawn(async move { scan_single_port(&h, port, timeout_duration).await });
        }

        while let Some(res) = set.join_next().await {
            if let Ok(scan_res) = res {
                results.push(scan_res);
            }
        }
    }

    results.sort_by_key(|r| r.port);
    Ok(results)
}

#[tauri::command]
pub async fn get_common_ports() -> Result<Vec<u16>, String> {
    Ok(vec![
        21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 465, 587, 993, 995, 1433, 1521, 2049,
        2181, 2375, 2376, 3000, 3306, 3389, 5000, 5432, 5672, 5900, 6379, 8000, 8080, 8443, 8888,
        9000, 9200, 11211, 27017,
    ])
}
