use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::State;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkTrafficRate {
    pub exe_path: String,
    pub download_bytes_per_second: u64,
    pub upload_bytes_per_second: u64,
}

#[derive(Clone, Copy, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TrafficMonitorStatus {
    #[default]
    Idle,
    Starting,
    Running,
    Error,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrafficMonitorSnapshot {
    pub status: TrafficMonitorStatus,
    pub error: Option<String>,
    pub apps: Vec<NetworkTrafficRate>,
    pub observed_event_count: u64,
    pub decoded_event_count: u64,
    pub unattributed_bytes: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum HelperMessage {
    Ready,
    Error {
        message: String,
    },
    Snapshot {
        apps: Vec<NetworkTrafficRate>,
        observed_event_count: u64,
        decoded_event_count: u64,
        unattributed_bytes: u64,
    },
}

fn traffic_direction(opcode: u8) -> Option<bool> {
    match opcode {
        10 | 42 => Some(false),
        11 | 43 => Some(true),
        _ => None,
    }
}

#[derive(Clone, Default)]
pub struct TrafficMonitorState {
    started: Arc<AtomicBool>,
    status: Arc<Mutex<TrafficMonitorStatus>>,
    error: Arc<Mutex<Option<String>>>,
    apps: Arc<Mutex<Vec<NetworkTrafficRate>>>,
    observed_event_count: Arc<AtomicU64>,
    decoded_event_count: Arc<AtomicU64>,
    unattributed_bytes: Arc<AtomicU64>,
}

impl TrafficMonitorState {
    fn set_error(&self, message: String) {
        *self.status.lock().expect("monitor status lock poisoned") = TrafficMonitorStatus::Error;
        *self.error.lock().expect("monitor error lock poisoned") = Some(message);
        self.started.store(false, Ordering::Release);
    }

    fn apply_message(&self, message: HelperMessage) {
        match message {
            HelperMessage::Ready => {
                *self.status.lock().expect("monitor status lock poisoned") =
                    TrafficMonitorStatus::Running;
                *self.error.lock().expect("monitor error lock poisoned") = None;
            }
            HelperMessage::Error { message } => self.set_error(message),
            HelperMessage::Snapshot {
                apps,
                observed_event_count,
                decoded_event_count,
                unattributed_bytes,
            } => {
                *self.apps.lock().expect("monitor apps lock poisoned") = apps;
                *self.status.lock().expect("monitor status lock poisoned") =
                    TrafficMonitorStatus::Running;
                self.observed_event_count
                    .store(observed_event_count, Ordering::Release);
                self.decoded_event_count
                    .store(decoded_event_count, Ordering::Release);
                self.unattributed_bytes
                    .store(unattributed_bytes, Ordering::Release);
            }
        }
    }
}

#[tauri::command]
pub fn start_network_traffic_monitor(state: State<'_, TrafficMonitorState>) -> Result<(), String> {
    #[cfg(windows)]
    {
        start_monitor(state.inner().clone())
    }

    #[cfg(not(windows))]
    {
        let _ = state;
        Err("Live per-app traffic monitoring is available only on Windows.".to_string())
    }
}

#[tauri::command]
pub fn get_network_traffic_snapshot(
    state: State<'_, TrafficMonitorState>,
) -> Result<TrafficMonitorSnapshot, String> {
    let status = *state
        .status
        .lock()
        .map_err(|_| "Traffic monitor status is unavailable.".to_string())?;
    let error = state
        .error
        .lock()
        .map_err(|_| "Traffic monitor status is unavailable.".to_string())?
        .clone();
    let mut apps = state
        .apps
        .lock()
        .map_err(|_| "Traffic monitor data is unavailable.".to_string())?
        .clone();
    apps.sort_by(|left, right| {
        left.exe_path
            .to_lowercase()
            .cmp(&right.exe_path.to_lowercase())
    });

    Ok(TrafficMonitorSnapshot {
        status,
        error,
        apps,
        observed_event_count: state.observed_event_count.load(Ordering::Acquire),
        decoded_event_count: state.decoded_event_count.load(Ordering::Acquire),
        unattributed_bytes: state.unattributed_bytes.load(Ordering::Acquire),
    })
}

#[cfg(windows)]
fn start_monitor(state: TrafficMonitorState) -> Result<(), String> {
    use rand::Rng;

    if state.started.swap(true, Ordering::AcqRel) {
        return Ok(());
    }

    *state
        .status
        .lock()
        .map_err(|_| "Traffic monitor status is unavailable.".to_string())? =
        TrafficMonitorStatus::Starting;
    *state
        .error
        .lock()
        .map_err(|_| "Traffic monitor status is unavailable.".to_string())? = None;
    state
        .apps
        .lock()
        .map_err(|_| "Traffic monitor data is unavailable.".to_string())?
        .clear();
    state.observed_event_count.store(0, Ordering::Release);
    state.decoded_event_count.store(0, Ordering::Release);
    state.unattributed_bytes.store(0, Ordering::Release);

    let listener = match TcpListener::bind(("127.0.0.1", 0)) {
        Ok(listener) => listener,
        Err(error) => {
            let message = format!("Could not prepare the traffic monitor: {error}");
            state.set_error(message.clone());
            return Err(message);
        }
    };
    if let Err(error) = listener.set_nonblocking(true) {
        let message = format!("Could not prepare the traffic monitor: {error}");
        state.set_error(message.clone());
        return Err(message);
    }
    let address = match listener.local_addr() {
        Ok(address) => address,
        Err(error) => {
            let message = format!("Could not prepare the traffic monitor: {error}");
            state.set_error(message.clone());
            return Err(message);
        }
    };
    let token = format!(
        "{:016x}{:016x}",
        rand::thread_rng().gen::<u64>(),
        rand::thread_rng().gen::<u64>()
    );
    let executable = match std::env::current_exe() {
        Ok(executable) => executable,
        Err(error) => {
            let message = format!("Could not locate Yolnoma: {error}");
            state.set_error(message.clone());
            return Err(message);
        }
    };
    let launcher_finished = Arc::new(AtomicBool::new(false));

    let listener_state = state.clone();
    let listener_finished = Arc::clone(&launcher_finished);
    let expected_token = token.clone();
    thread::spawn(move || {
        listen_for_monitor(listener, &expected_token, listener_state, listener_finished);
    });

    let launcher_state = state;
    let finished = launcher_finished;
    thread::spawn(move || {
        let result = launch_elevated_monitor(&executable, address, &token);
        finished.store(true, Ordering::Release);
        if let Err(error) = result {
            let status = launcher_state
                .status
                .lock()
                .expect("monitor status lock poisoned");
            if matches!(*status, TrafficMonitorStatus::Starting) {
                drop(status);
                launcher_state.set_error(error);
            }
        }
    });

    Ok(())
}

#[cfg(windows)]
fn listen_for_monitor(
    listener: TcpListener,
    token: &str,
    state: TrafficMonitorState,
    launcher_finished: Arc<AtomicBool>,
) {
    loop {
        match listener.accept() {
            Ok((stream, _)) => match receive_monitor_messages(stream, token, &state) {
                Ok(()) => continue,
                Err(error) => {
                    let status = *state.status.lock().expect("monitor status lock poisoned");
                    if !matches!(status, TrafficMonitorStatus::Error) {
                        state.set_error(error);
                    }
                    return;
                }
            },
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                if launcher_finished.load(Ordering::Acquire) {
                    let status = *state.status.lock().expect("monitor status lock poisoned");
                    if matches!(status, TrafficMonitorStatus::Starting) {
                        state.set_error(
                            "Traffic monitoring was cancelled or the helper could not start."
                                .to_string(),
                        );
                    }
                    return;
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(error) => {
                state.set_error(format!("Could not receive traffic data: {error}"));
                return;
            }
        }
    }
}

#[cfg(windows)]
fn receive_monitor_messages(
    stream: TcpStream,
    expected_token: &str,
    state: &TrafficMonitorState,
) -> Result<(), String> {
    let mut reader = BufReader::new(stream);
    let mut handshake = String::new();
    reader
        .read_line(&mut handshake)
        .map_err(|error| format!("Traffic monitor handshake failed: {error}"))?;
    if handshake.trim_end() != expected_token {
        return Ok(());
    }

    loop {
        let mut line = String::new();
        let bytes_read = reader
            .read_line(&mut line)
            .map_err(|error| format!("Traffic monitor connection failed: {error}"))?;
        if bytes_read == 0 {
            return Err("Traffic monitor connection closed.".to_string());
        }

        let message: HelperMessage = serde_json::from_str(line.trim_end())
            .map_err(|error| format!("Traffic monitor returned invalid data: {error}"))?;
        state.apply_message(message);
    }
}

#[cfg(windows)]
fn launch_elevated_monitor(
    executable: &std::path::Path,
    address: SocketAddr,
    token: &str,
) -> Result<(), String> {
    use base64::Engine;
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let argument_list = format!(
        "@({}, {}, {})",
        powershell_quote("--yolnoma-network-monitor"),
        powershell_quote(&address.to_string()),
        powershell_quote(token)
    );
    let script = format!(
        "try {{ $p = Start-Process -FilePath {} -ArgumentList {} -Verb RunAs -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode }} catch {{ exit 9 }}",
        powershell_quote(&executable.to_string_lossy()),
        argument_list
    );
    let encoded = base64::engine::general_purpose::STANDARD.encode(
        script
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .collect::<Vec<_>>(),
    );

    let status = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-EncodedCommand",
            &encoded,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|error| format!("Could not request administrator permission: {error}"))?;

    match status.code() {
        Some(0) => Ok(()),
        Some(9) => Err(
            "Administrator permission was not granted. Allow the Windows prompt to start live traffic monitoring."
                .to_string(),
        ),
        Some(code) => Err(format!(
            "The live traffic monitor exited unexpectedly (code {code})."
        )),
        None => Err("The live traffic monitor did not exit normally.".to_string()),
    }
}

#[cfg(windows)]
fn powershell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(windows)]
fn run_monitor_helper(address: &str, token: &str) -> Result<(), String> {
    use ferrisetw::parser::Parser;
    use ferrisetw::provider::Provider;
    use ferrisetw::schema_locator::SchemaLocator;
    use ferrisetw::trace::{TraceTrait, UserTrace};

    #[derive(Default)]
    struct ProcessBytes {
        downloaded: u64,
        uploaded: u64,
    }

    let address: SocketAddr = address
        .parse()
        .map_err(|_| "Invalid traffic monitor address.".to_string())?;
    if !address.ip().is_loopback()
        || token.len() != 32
        || !token.chars().all(|character| character.is_ascii_hexdigit())
    {
        return Err("Invalid traffic monitor connection parameters.".to_string());
    }

    let mut stream = TcpStream::connect_timeout(&address, Duration::from_secs(10))
        .map_err(|error| format!("Could not connect to the traffic monitor: {error}"))?;
    writeln!(stream, "{token}")
        .map_err(|error| format!("Could not authenticate with Yolnoma: {error}"))?;
    stream
        .flush()
        .map_err(|error| format!("Could not authenticate with Yolnoma: {error}"))?;

    let counters = Arc::new(Mutex::new(HashMap::<u32, ProcessBytes>::new()));
    let callback_counters = Arc::clone(&counters);
    let observed_events = Arc::new(AtomicU64::new(0));
    let decoded_events = Arc::new(AtomicU64::new(0));
    let callback_observed_events = Arc::clone(&observed_events);
    let callback_decoded_events = Arc::clone(&decoded_events);
    let provider = Provider::by_guid("7dd42a49-5329-4832-8dfd-43d979153a88")
        .any(0x10 | 0x20)
        .level(5)
        .add_callback(
            move |record: &ferrisetw::EventRecord, locator: &SchemaLocator| {
                callback_observed_events.fetch_add(1, Ordering::Relaxed);
                let Some(direction) = traffic_direction(record.opcode()) else {
                    return;
                };
                let Ok(schema) = locator.event_schema(record) else {
                    return;
                };
                let parser = Parser::create(record, &schema);
                let (Ok(pid), Ok(size)) = (
                    parser.try_parse::<u32>("PID"),
                    parser.try_parse::<u32>("size"),
                ) else {
                    return;
                };
                callback_decoded_events.fetch_add(1, Ordering::Relaxed);
                let mut counts = callback_counters
                    .lock()
                    .expect("network counter lock poisoned");
                let process = counts.entry(pid).or_default();
                if direction {
                    process.downloaded = process.downloaded.saturating_add(u64::from(size));
                } else {
                    process.uploaded = process.uploaded.saturating_add(u64::from(size));
                }
            },
        )
        .build();

    let session_name = format!("YolnomaAppNetwork-{}", std::process::id());
    let session = UserTrace::new()
        .named(session_name)
        .enable(provider)
        .start();
    let (trace, handle) = match session {
        Ok(session) => session,
        Err(error) => {
            let message = format!("Could not start Windows network tracing: {error:?}");
            let _ = write_helper_message(
                &mut stream,
                &HelperMessage::Error {
                    message: message.clone(),
                },
            );
            return Err(message);
        }
    };
    let trace_thread = thread::spawn(move || UserTrace::process_from_handle(handle));

    write_helper_message(&mut stream, &HelperMessage::Ready)?;

    let mut system = sysinfo::System::new_all();
    let mut previous_sample = std::time::Instant::now();
    let unattributed_bytes = AtomicU64::new(0);
    loop {
        thread::sleep(Duration::from_secs(1));
        system.refresh_processes();

        let elapsed = previous_sample.elapsed().as_secs_f64().max(0.001);
        previous_sample = std::time::Instant::now();
        let counts = std::mem::take(&mut *counters.lock().expect("network counter lock poisoned"));
        let process_paths: HashMap<u32, String> = system
            .processes()
            .values()
            .filter_map(|process| {
                process
                    .exe()
                    .map(|path| (process.pid().as_u32(), path.to_string_lossy().into_owned()))
            })
            .collect();
        let mut by_path = HashMap::<String, NetworkTrafficRate>::new();
        for (pid, counts) in counts {
            let Some(path) = process_paths.get(&pid) else {
                unattributed_bytes.fetch_add(
                    counts.downloaded.saturating_add(counts.uploaded),
                    Ordering::Relaxed,
                );
                continue;
            };
            let key = path.to_lowercase();
            let rate = by_path.entry(key).or_insert_with(|| NetworkTrafficRate {
                exe_path: path.clone(),
                download_bytes_per_second: 0,
                upload_bytes_per_second: 0,
            });
            rate.download_bytes_per_second = rate
                .download_bytes_per_second
                .saturating_add((counts.downloaded as f64 / elapsed) as u64);
            rate.upload_bytes_per_second = rate
                .upload_bytes_per_second
                .saturating_add((counts.uploaded as f64 / elapsed) as u64);
        }

        let message = HelperMessage::Snapshot {
            apps: by_path.into_values().collect(),
            observed_event_count: observed_events.load(Ordering::Acquire),
            decoded_event_count: decoded_events.load(Ordering::Acquire),
            unattributed_bytes: unattributed_bytes.load(Ordering::Acquire),
        };
        if write_helper_message(&mut stream, &message).is_err() {
            break;
        }
    }

    drop(trace);
    let _ = trace_thread.join();
    Ok(())
}

#[cfg(windows)]
fn write_helper_message(stream: &mut TcpStream, message: &HelperMessage) -> Result<(), String> {
    let json = serde_json::to_string(message)
        .map_err(|error| format!("Could not encode traffic monitor data: {error}"))?;
    writeln!(stream, "{json}")
        .map_err(|error| format!("Could not send traffic monitor data: {error}"))?;
    stream
        .flush()
        .map_err(|error| format!("Could not send traffic monitor data: {error}"))
}

#[cfg(windows)]
pub fn run_network_monitor_helper(address: &str, token: &str) -> i32 {
    match run_monitor_helper(address, token) {
        Ok(()) => 0,
        Err(_) => 1,
    }
}

#[cfg(not(windows))]
pub fn run_network_monitor_helper(_address: &str, _token: &str) -> i32 {
    1
}

#[cfg(test)]
mod tests {
    use super::traffic_direction;

    #[test]
    fn counts_only_tcp_and_udp_payload_directions() {
        assert_eq!(traffic_direction(10), Some(false));
        assert_eq!(traffic_direction(42), Some(false));
        assert_eq!(traffic_direction(11), Some(true));
        assert_eq!(traffic_direction(43), Some(true));
        assert_eq!(traffic_direction(12), None);
        assert_eq!(traffic_direction(15), None);
    }
}
