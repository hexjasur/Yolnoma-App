use regex::Regex;
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::sync::OnceLock;
use std::time::Duration;

use crate::commands::proxy::validate_proxy_url;

const MAX_BODY_BYTES: usize = 2 * 1024 * 1024;
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TechDetection {
    pub name: String,
    pub category: String,
    pub evidence: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TechScanResult {
    pub url: String,
    pub host: String,
    pub status: u16,
    pub generator: Option<String>,
    pub technologies: Vec<TechDetection>,
    pub hosting: Vec<TechDetection>,
    pub headers: BTreeMap<String, String>,
    pub name_servers: Vec<String>,
    pub cname_records: Vec<String>,
}

struct HtmlRule {
    name: &'static str,
    category: &'static str,
    pattern: &'static str,
}

struct HeaderRule {
    header: &'static str,
    pattern: &'static str,
    name: &'static str,
    category: &'static str,
}

const HTML_RULES: &[HtmlRule] = &[
    HtmlRule { name: "WordPress", category: "CMS", pattern: r"wp-content/|wp-includes/" },
    HtmlRule { name: "Drupal", category: "CMS", pattern: r#"name="generator" content="drupal|Drupal\.settings"# },
    HtmlRule { name: "Joomla", category: "CMS", pattern: r#"name="generator" content="joomla"# },
    HtmlRule { name: "Ghost", category: "CMS", pattern: r#"name="generator" content="ghost"# },
    HtmlRule { name: "Shopify", category: "E-commerce", pattern: r"cdn\.shopify\.com|Shopify\.theme" },
    HtmlRule { name: "Wix", category: "Website builder", pattern: r"static\.wixstatic\.com|wix\.com/" },
    HtmlRule { name: "Squarespace", category: "Website builder", pattern: r"squarespace\.com|static1\.squarespace" },
    HtmlRule { name: "Next.js", category: "Framework", pattern: r"/_next/static/|__NEXT_DATA__" },
    HtmlRule { name: "Nuxt", category: "Framework", pattern: r"/_nuxt/|window\.__NUXT__" },
    HtmlRule { name: "Gatsby", category: "Framework", pattern: r"___gatsby|/gatsby-" },
    HtmlRule { name: "Remix", category: "Framework", pattern: r"__remixContext" },
    HtmlRule { name: "Astro", category: "Framework", pattern: r"astro-island|/_astro/" },
    HtmlRule { name: "Angular", category: "Framework", pattern: r"ng-version=" },
    HtmlRule { name: "Vue.js", category: "Framework", pattern: r"data-v-app|__VUE__" },
    HtmlRule { name: "React", category: "Library", pattern: r"data-reactroot|__reactFiber|id=.__next." },
    HtmlRule { name: "jQuery", category: "Library", pattern: r"jquery(\.min)?\.js" },
    HtmlRule { name: "Bootstrap", category: "Library", pattern: r"bootstrap(\.min)?\.(css|js)" },
    HtmlRule { name: "Google Analytics", category: "Analytics", pattern: r"googletagmanager\.com/gtag|google-analytics\.com/(analytics|ga)\.js" },
    HtmlRule { name: "Google Tag Manager", category: "Analytics", pattern: r"googletagmanager\.com/gtm\.js" },
    HtmlRule { name: "Facebook Pixel", category: "Analytics", pattern: r#"connect\.facebook\.net/[^\s"']+/fbevents\.js"# },
    HtmlRule { name: "Hotjar", category: "Analytics", pattern: r"static\.hotjar\.com" },
    HtmlRule { name: "Yandex Metrika", category: "Analytics", pattern: r"mc\.yandex\.(ru|com)/metrika" },
];

const HEADER_RULES: &[HeaderRule] = &[
    HeaderRule { header: "server", pattern: r"(?i)cloudflare", name: "Cloudflare", category: "CDN" },
    HeaderRule { header: "server", pattern: r"(?i)nginx", name: "Nginx", category: "Web server" },
    HeaderRule { header: "server", pattern: r"(?i)apache", name: "Apache", category: "Web server" },
    HeaderRule { header: "server", pattern: r"(?i)microsoft-iis", name: "Microsoft IIS", category: "Web server" },
    HeaderRule { header: "server", pattern: r"(?i)litespeed", name: "LiteSpeed", category: "Web server" },
    HeaderRule { header: "server", pattern: r"(?i)vercel", name: "Vercel", category: "Hosting" },
    HeaderRule { header: "server", pattern: r"(?i)netlify", name: "Netlify", category: "Hosting" },
    HeaderRule { header: "server", pattern: r"(?i)^gws|gse", name: "Google Web Server", category: "Web server" },
    HeaderRule { header: "server", pattern: r"(?i)amazons3", name: "Amazon S3", category: "Hosting" },
    HeaderRule { header: "x-powered-by", pattern: r"(?i)php", name: "PHP", category: "Language" },
    HeaderRule { header: "x-powered-by", pattern: r"(?i)express", name: "Express", category: "Framework" },
    HeaderRule { header: "x-powered-by", pattern: r"(?i)asp\.net", name: "ASP.NET", category: "Framework" },
    HeaderRule { header: "x-powered-by", pattern: r"(?i)next\.js", name: "Next.js", category: "Framework" },
    HeaderRule { header: "x-powered-by", pattern: r"(?i)wp engine", name: "WP Engine", category: "Hosting" },
    HeaderRule { header: "cf-ray", pattern: r".+", name: "Cloudflare", category: "CDN" },
    HeaderRule { header: "x-vercel-id", pattern: r".+", name: "Vercel", category: "Hosting" },
    HeaderRule { header: "x-nf-request-id", pattern: r".+", name: "Netlify", category: "Hosting" },
    HeaderRule { header: "x-github-request-id", pattern: r".+", name: "GitHub Pages", category: "Hosting" },
    HeaderRule { header: "x-amz-cf-id", pattern: r".+", name: "Amazon CloudFront", category: "CDN" },
    HeaderRule { header: "x-azure-ref", pattern: r".+", name: "Azure Front Door", category: "CDN" },
    HeaderRule { header: "fly-request-id", pattern: r".+", name: "Fly.io", category: "Hosting" },
    HeaderRule { header: "x-render-origin-server", pattern: r".+", name: "Render", category: "Hosting" },
    HeaderRule { header: "x-served-by", pattern: r"(?i)cache-", name: "Fastly", category: "CDN" },
    HeaderRule { header: "via", pattern: r"(?i)varnish", name: "Varnish", category: "Cache" },
];

const COOKIE_RULES: &[(&str, &str, &str)] = &[
    ("PHPSESSID", "PHP", "Language"),
    ("ASP.NET_SessionId", "ASP.NET", "Framework"),
    ("wordpress_", "WordPress", "CMS"),
    ("laravel_session", "Laravel", "Framework"),
    ("csrftoken", "Django", "Framework"),
    ("connect.sid", "Express", "Framework"),
];

const NS_RULES: &[(&str, &str)] = &[
    ("cloudflare.com", "Cloudflare DNS"),
    ("vercel-dns.com", "Vercel DNS"),
    ("domaincontrol.com", "GoDaddy DNS"),
    ("registrar-servers.com", "Namecheap DNS"),
    ("awsdns", "AWS Route 53"),
    ("googledomains.com", "Google Cloud DNS"),
];

const CNAME_RULES: &[(&str, &str, &str)] = &[
    ("vercel-dns", "Vercel", "Hosting"),
    ("netlify", "Netlify", "Hosting"),
    ("github.io", "GitHub Pages", "Hosting"),
    ("pages.dev", "Cloudflare Pages", "Hosting"),
    ("herokudns", "Heroku", "Hosting"),
    ("fly.dev", "Fly.io", "Hosting"),
    ("onrender.com", "Render", "Hosting"),
    ("amazonaws.com", "AWS", "Hosting"),
    ("azurewebsites", "Azure App Service", "Hosting"),
    ("cloudfront.net", "Amazon CloudFront", "CDN"),
];

fn compiled_html_rules() -> &'static Vec<(&'static HtmlRule, Regex)> {
    static CACHE: OnceLock<Vec<(&'static HtmlRule, Regex)>> = OnceLock::new();
    CACHE.get_or_init(|| {
        HTML_RULES
            .iter()
            .filter_map(|rule| Regex::new(rule.pattern).ok().map(|re| (rule, re)))
            .collect()
    })
}

fn compiled_header_rules() -> &'static Vec<(&'static HeaderRule, Regex)> {
    static CACHE: OnceLock<Vec<(&'static HeaderRule, Regex)>> = OnceLock::new();
    CACHE.get_or_init(|| {
        HEADER_RULES
            .iter()
            .filter_map(|rule| Regex::new(rule.pattern).ok().map(|re| (rule, re)))
            .collect()
    })
}

fn generator_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"(?i)<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']"#)
            .expect("valid generator regex")
    })
}

fn normalize_url(input: &str) -> Result<String, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Enter a website URL.".to_string());
    }
    let with_scheme = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };
    validate_proxy_url(&with_scheme)?;
    Ok(with_scheme)
}

async fn resolve_dns(host: &str, record_type: &str) -> Vec<String> {
    let response = match crate::commands::dns::query_dns_records(
        "cloudflare".to_string(),
        host.to_string(),
        record_type.to_string(),
    )
    .await
    {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };

    response
        .get("Answer")
        .and_then(Value::as_array)
        .map(|answers| {
            answers
                .iter()
                .filter_map(|answer| answer.get("data").and_then(Value::as_str))
                .map(|data| data.trim_end_matches('.').to_lowercase())
                .collect()
        })
        .unwrap_or_default()
}

fn push_unique(list: &mut Vec<TechDetection>, detection: TechDetection) {
    let exists = list
        .iter()
        .any(|item| item.name == detection.name && item.category == detection.category);
    if !exists {
        list.push(detection);
    }
}

fn detect_from_headers(headers: &BTreeMap<String, String>, technologies: &mut Vec<TechDetection>, hosting: &mut Vec<TechDetection>) {
    for (rule, re) in compiled_header_rules() {
        let Some(value) = headers.get(rule.header) else { continue };
        if !re.is_match(value) {
            continue;
        }
        let detection = TechDetection {
            name: rule.name.to_string(),
            category: rule.category.to_string(),
            evidence: format!("{}: {}", rule.header, truncate(value, 60)),
        };
        if matches!(rule.category, "Hosting" | "CDN") {
            push_unique(hosting, detection);
        } else {
            push_unique(technologies, detection);
        }
    }

    if let Some(cookie) = headers.get("set-cookie") {
        for (cookie_name, name, category) in COOKIE_RULES {
            if cookie.contains(cookie_name) {
                push_unique(
                    technologies,
                    TechDetection {
                        name: name.to_string(),
                        category: category.to_string(),
                        evidence: format!("cookie: {cookie_name}"),
                    },
                );
            }
        }
    }
}

fn detect_from_html(html: &str, technologies: &mut Vec<TechDetection>) -> Option<String> {
    for (rule, re) in compiled_html_rules() {
        if let Some(found) = re.find(html) {
            push_unique(
                technologies,
                TechDetection {
                    name: rule.name.to_string(),
                    category: rule.category.to_string(),
                    evidence: format!("html: {}", truncate(found.as_str(), 60)),
                },
            );
        }
    }

    generator_regex()
        .captures(html)
        .and_then(|captures| captures.get(1))
        .map(|value| value.as_str().trim().to_string())
}

fn detect_from_dns(
    name_servers: &[String],
    cname_records: &[String],
    hosting: &mut Vec<TechDetection>,
) {
    for ns in name_servers {
        if let Some((_, label)) = NS_RULES.iter().find(|(needle, _)| ns.contains(*needle)) {
            push_unique(
                hosting,
                TechDetection {
                    name: label.to_string(),
                    category: "DNS".to_string(),
                    evidence: format!("NS: {ns}"),
                },
            );
        }
    }
    for cname in cname_records {
        if let Some((_, name, category)) = CNAME_RULES.iter().find(|(needle, _, _)| cname.contains(*needle)) {
            push_unique(
                hosting,
                TechDetection {
                    name: name.to_string(),
                    category: category.to_string(),
                    evidence: format!("CNAME: {cname}"),
                },
            );
        }
    }
}

fn truncate(value: &str, max: usize) -> String {
    if value.chars().count() <= max {
        value.to_string()
    } else {
        format!("{}…", value.chars().take(max).collect::<String>())
    }
}

#[tauri::command]
pub async fn scan_website_tech(url: String) -> Result<TechScanResult, String> {
    let target = normalize_url(&url)?;

    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| format!("HTTP client initialization failed: {error}"))?;

    let response = client
        .get(&target)
        .header("Accept", "text/html,application/xhtml+xml,*/*;q=0.8")
        .send()
        .await
        .map_err(|error| format!("Unable to reach {target}: {error}"))?;

    let final_url = response.url().clone();
    let host = final_url.host_str().unwrap_or_default().to_lowercase();
    let status = response.status().as_u16();

    let mut headers = BTreeMap::new();
    for (name, value) in response.headers() {
        if let Ok(value) = value.to_str() {
            let key = name.as_str().to_lowercase();
            headers
                .entry(key)
                .and_modify(|existing: &mut String| {
                    existing.push_str(", ");
                    existing.push_str(value);
                })
                .or_insert_with(|| value.to_string());
        }
    }

    let is_html = headers
        .get("content-type")
        .map(|value| value.contains("html"))
        .unwrap_or(true);

    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Unable to read response body: {error}"))?;
    let body_slice = &bytes[..bytes.len().min(MAX_BODY_BYTES)];
    let html = if is_html {
        String::from_utf8_lossy(body_slice).into_owned()
    } else {
        String::new()
    };

    let (name_servers, cname_records) = tokio::join!(
        resolve_dns(&host, "NS"),
        resolve_dns(&host, "CNAME"),
    );

    let mut technologies: Vec<TechDetection> = Vec::new();
    let mut hosting: Vec<TechDetection> = Vec::new();

    detect_from_headers(&headers, &mut technologies, &mut hosting);
    let generator = detect_from_html(&html, &mut technologies);
    detect_from_dns(&name_servers, &cname_records, &mut hosting);

    if let Some(generator_value) = generator.as_deref() {
        let lowered = generator_value.to_lowercase();
        let already_detected = technologies
            .iter()
            .any(|item| lowered.contains(&item.name.to_lowercase()));
        if !already_detected {
            technologies.push(TechDetection {
                name: generator_value.to_string(),
                category: "Generator".to_string(),
                evidence: "meta name=generator".to_string(),
            });
        }
    }

    Ok(TechScanResult {
        url: final_url.to_string(),
        host,
        status,
        generator,
        technologies,
        hosting,
        headers,
        name_servers,
        cname_records,
    })
}
