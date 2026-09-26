use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time::timeout;

const DNS_RECORD_TYPES: &[(&str, u16)] = &[
    ("A", 1),
    ("AAAA", 28),
    ("CNAME", 5),
    ("MX", 15),
    ("NS", 2),
    ("TXT", 16),
    ("CAA", 257),
    ("SOA", 6),
];

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DnsRecord {
    pub name: String,
    pub record_type: String,
    pub ttl: u32,
    pub data: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DnsQueryResult {
    pub resolver: String,
    pub record_type: String,
    pub status: String,
    pub status_code: u8,
    pub duration_ms: u64,
    pub answers: Vec<DnsRecord>,
    pub error: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct DohResponse {
    status: u8,
    #[serde(default)]
    answer: Vec<DohAnswer>,
}

#[derive(Deserialize)]
struct DohAnswer {
    name: String,
    #[serde(rename = "type")]
    type_code: u16,
    #[serde(rename = "TTL")]
    ttl: u32,
    data: String,
}

fn dns_status_name(code: u8) -> &'static str {
    match code {
        0 => "NOERROR",
        1 => "FORMERR",
        2 => "SERVFAIL",
        3 => "NXDOMAIN",
        4 => "NOTIMP",
        5 => "REFUSED",
        _ => "UNKNOWN",
    }
}

fn dns_record_type_name(code: u16) -> &'static str {
    DNS_RECORD_TYPES
        .iter()
        .find_map(|(name, value)| (*value == code).then_some(*name))
        .unwrap_or("UNKNOWN")
}

fn validate_dns_domain(value: &str) -> Result<String, String> {
    let domain = value.trim().trim_end_matches('.').to_ascii_lowercase();
    if domain.is_empty() || domain.len() > 253 {
        return Err("Enter a valid domain name.".to_string());
    }
    if domain.split('.').any(|label| {
        label.is_empty()
            || label.len() > 63
            || label.starts_with('-')
            || label.ends_with('-')
            || !label.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    }) {
        return Err("Domain names may only contain letters, numbers, and hyphens.".to_string());
    }
    Ok(domain)
}

async fn query_dns_record(
    client: reqwest::Client,
    resolver: String,
    endpoint: String,
    domain: String,
    record_type: String,
) -> DnsQueryResult {
    let started = Instant::now();
    let response = client
        .get(endpoint)
        .query(&[("name", domain.as_str()), ("type", record_type.as_str())])
        .header(reqwest::header::ACCEPT, "application/dns-json")
        .send()
        .await;
    let response = match response {
        Ok(response) if response.status().is_success() => response,
        Ok(response) => {
            return DnsQueryResult {
                resolver,
                record_type,
                status: "ERROR".to_string(),
                status_code: 0,
                duration_ms: started.elapsed().as_millis() as u64,
                answers: Vec::new(),
                error: Some(format!("DNS resolver returned HTTP {}.", response.status())),
            };
        }
        Err(error) => {
            return DnsQueryResult {
                resolver,
                record_type,
                status: "ERROR".to_string(),
                status_code: 0,
                duration_ms: started.elapsed().as_millis() as u64,
                answers: Vec::new(),
                error: Some(error.to_string()),
            };
        }
    };

    match response.json::<DohResponse>().await {
        Ok(payload) => DnsQueryResult {
            resolver,
            record_type,
            status: dns_status_name(payload.status).to_string(),
            status_code: payload.status,
            duration_ms: started.elapsed().as_millis() as u64,
            answers: payload
                .answer
                .into_iter()
                .map(|answer| DnsRecord {
                    name: answer.name,
                    record_type: dns_record_type_name(answer.type_code).to_string(),
                    ttl: answer.ttl,
                    data: answer.data,
                })
                .collect(),
            error: None,
        },
        Err(error) => DnsQueryResult {
            resolver,
            record_type,
            status: "ERROR".to_string(),
            status_code: 0,
            duration_ms: started.elapsed().as_millis() as u64,
            answers: Vec::new(),
            error: Some(format!("Could not parse DNS response: {error}")),
        },
    }
}

#[tauri::command]
pub async fn diagnose_dns(
    domain: String,
    record_types: Vec<String>,
    resolver: String,
) -> Result<Vec<DnsQueryResult>, String> {
    let domain = validate_dns_domain(&domain)?;
    let (resolver_name, endpoint) = match resolver.as_str() {
        "cloudflare" => ("Cloudflare", "https://cloudflare-dns.com/dns-query"),
        "google" => ("Google", "https://dns.google/resolve"),
        _ => return Err("Choose Cloudflare or Google DNS.".to_string()),
    };
    let mut selected_types = Vec::new();
    for record_type in record_types {
        let record_type = record_type.trim().to_ascii_uppercase();
        if !DNS_RECORD_TYPES.iter().any(|(name, _)| *name == record_type) {
            return Err(format!("Unsupported DNS record type: {record_type}"));
        }
        if !selected_types.contains(&record_type) {
            selected_types.push(record_type);
        }
    }
    if selected_types.is_empty() {
        return Err("Select at least one DNS record type.".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|error| format!("Could not create DNS client: {error}"))?;
    let mut queries = tokio::task::JoinSet::new();
    for record_type in selected_types {
        queries.spawn(query_dns_record(
            client.clone(),
            resolver_name.to_string(),
            endpoint.to_string(),
            domain.clone(),
            record_type,
        ));
    }

    let mut results = Vec::new();
    while let Some(result) = queries.join_next().await {
        results.push(result.map_err(|error| format!("DNS query task failed: {error}"))?);
    }
    results.sort_by_key(|result| {
        DNS_RECORD_TYPES
            .iter()
            .position(|(name, _)| *name == result.record_type)
            .unwrap_or(usize::MAX)
    });
    Ok(results)
}

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
