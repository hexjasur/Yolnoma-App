use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, RefreshKind, System};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStats {
    #[serde(rename = "cpuPercent")]
    pub cpu_percent: f32,

    #[serde(rename = "ramUsedGb")]
    pub ram_used_gb: f64,
    #[serde(rename = "ramTotalGb")]
    pub ram_total_gb: f64,

    #[serde(rename = "diskUsedGb")]
    pub disk_used_gb: f64,
    #[serde(rename = "diskTotalGb")]
    pub disk_total_gb: f64,

    #[serde(rename = "gpuPercent")]
    pub gpu_percent: Option<f32>,

    #[serde(rename = "cpuModel")]
    pub cpu_model: Option<String>,
    #[serde(rename = "cpuCores")]
    pub cpu_cores: usize,
    #[serde(rename = "osName")]
    pub os_name: Option<String>,
    #[serde(rename = "hostName")]
    pub host_name: Option<String>,
}

pub struct SystemMonitorState {
    pub sys: Mutex<System>,
    pub disks: Mutex<Disks>,
    pub cpu_model: Option<String>,
    pub cpu_cores: usize,
    pub os_name: Option<String>,
    pub host_name: Option<String>,
}

impl SystemMonitorState {
    pub fn new() -> Self {
        let refresh_kind = RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything());
        let mut sys = System::new_with_specifics(refresh_kind);

        // Initial CPU measurement
        sys.refresh_cpu_specifics(CpuRefreshKind::everything());
        sys.refresh_memory();

        let disks = Disks::new_with_refreshed_list();

        let cpu_model = sys
            .cpus()
            .first()
            .map(|c| c.brand().trim().to_string())
            .filter(|s| !s.is_empty());
        let cpu_cores = sys.cpus().len();
        let os_name = System::name();
        let host_name = System::host_name();

        Self {
            sys: Mutex::new(sys),
            disks: Mutex::new(disks),
            cpu_model,
            cpu_cores,
            os_name,
            host_name,
        }
    }
}

/// Lightweight native system metrics gathering
#[tauri::command]
pub async fn get_system_stats(
    state: tauri::State<'_, SystemMonitorState>,
) -> Result<SystemStats, String> {
    let (cpu_percent, ram_used_gb, ram_total_gb) = {
        let mut sys = state.sys.lock().map_err(|e| e.to_string())?;

        // Refresh only cpu usage and memory for ultra-fast, lightweight polling
        sys.refresh_cpu_specifics(CpuRefreshKind::everything());
        sys.refresh_memory();

        let cpu = sys.global_cpu_info().cpu_usage();

        // Convert bytes to GiB (1024^3)
        let ram_total = sys.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0);
        let ram_used = sys.used_memory() as f64 / (1024.0 * 1024.0 * 1024.0);

        (cpu, ram_used, ram_total)
    };

    let (disk_used_gb, disk_total_gb) = {
        let mut disks = state.disks.lock().map_err(|e| e.to_string())?;
        disks.refresh_list();

        let mut total_bytes: u64 = 0;
        let mut avail_bytes: u64 = 0;

        for disk in disks.iter() {
            total_bytes += disk.total_space();
            avail_bytes += disk.available_space();
        }

        let used_bytes = total_bytes.saturating_sub(avail_bytes);
        let total_gb = total_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
        let used_gb = used_bytes as f64 / (1024.0 * 1024.0 * 1024.0);

        (used_gb, total_gb)
    };

    Ok(SystemStats {
        cpu_percent: (cpu_percent * 10.0).round() / 10.0,
        ram_used_gb: (ram_used_gb * 10.0).round() / 10.0,
        ram_total_gb: (ram_total_gb * 10.0).round() / 10.0,
        disk_used_gb: (disk_used_gb * 10.0).round() / 10.0,
        disk_total_gb: (disk_total_gb * 10.0).round() / 10.0,
        gpu_percent: None, // Available for future GPU plugin architecture
        cpu_model: state.cpu_model.clone(),
        cpu_cores: state.cpu_cores,
        os_name: state.os_name.clone(),
        host_name: state.host_name.clone(),
    })
}
