// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    #[cfg(not(target_os = "android"))]
    if args.get(1).map(String::as_str) == Some("--yolnoma-network-monitor") {
        let address = args.get(2).map(String::as_str).unwrap_or_default();
        let token = args.get(3).map(String::as_str).unwrap_or_default();
        std::process::exit(yolnoma_lib::run_network_monitor_helper(address, token));
    }

    yolnoma_lib::run()
}
