import { useMemo, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Box,
  Broom,
  Check,
  Code2,
  Copy,
  FileWarning,
  Package,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '@/shared/ui';

type CleanupId =
  | 'temp-files'
  | 'recycle-bin'
  | 'windows-update-cache'
  | 'directx-shader-cache'
  | 'npm-cache'
  | 'pnpm-cache'
  | 'yarn-cache'
  | 'cargo-cache';
type CleanupCategory = 'windows' | 'developer';
type RunState = 'idle' | 'running' | 'success' | 'error';

interface CleanupTask {
  id: CleanupId;
  category: CleanupCategory;
  name: string;
  description: string;
  note: string;
  requiresAdmin?: boolean;
  icon: typeof Broom;
  script: string;
}

interface CleanerRunResult {
  completedActions: number;
  message: string;
}

const CLEANUP_TASKS: CleanupTask[] = [
  {
    id: 'temp-files',
    category: 'windows',
    name: 'Clear Windows Temp',
    description: 'Clears temporary files from your profile and Windows Temp.',
    note: 'Locked system files are safely skipped.',
    icon: Broom,
    script: `# Remove temporary files from the current user and Windows Temp folders.
$paths = @($env:TEMP, "$env:LOCALAPPDATA\\Temp", "$env:WINDIR\\Temp") | Select-Object -Unique
foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) {
        Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
}`,
  },
  {
    id: 'recycle-bin',
    category: 'windows',
    name: 'Empty Recycle Bin',
    description: 'Permanently removes files currently held in the Recycle Bin.',
    note: 'Files in the bin cannot be restored afterward.',
    icon: Trash2,
    script: `# Only check fixed local drives; unavailable or mapped drives are not touched.
$drives = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType = 3" |
    ForEach-Object { $_.DeviceID.TrimEnd(':') }
$failures = @()
foreach ($drive in $drives) {
    try {
        Clear-RecycleBin -DriveLetter $drive -Force -ErrorAction Stop
    } catch {
        # Windows creates a Recycle Bin folder only after a drive needs one.
        if ($_.Exception.Message -notmatch 'cannot find the path|system cannot find the path') {
            $failures += "\${drive}: $($_.Exception.Message)"
        }
    }
}
if ($failures.Count -gt 0) {
    throw "Could not clear the Recycle Bin on: $($failures -join '; ')"
}`,
  },
  {
    id: 'windows-update-cache',
    category: 'windows',
    name: 'Clear Windows Update Cache',
    description: 'Removes downloaded update packages, not installed updates.',
    note: 'Windows Update is paused, then restored to its original state.',
    requiresAdmin: true,
    icon: RefreshCw,
    script: `# Pause Windows Update, clear its downloaded packages, then restore its prior state.
$updateService = Get-Service -Name 'wuauserv' -ErrorAction Stop
$wasRunning = $updateService.Status -eq 'Running'
if ($wasRunning) { Stop-Service -Name 'wuauserv' -Force -ErrorAction Stop }
try {
    $path = Join-Path $env:WINDIR 'SoftwareDistribution\\Download'
    if (Test-Path -LiteralPath $path) {
        Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
} finally {
    if ($wasRunning) { Start-Service -Name 'wuauserv' -ErrorAction Stop }
}`,
  },
  {
    id: 'directx-shader-cache',
    category: 'windows',
    name: 'Clear DirectX Shader Cache',
    description: 'Removes DirectX shader files stored for this user profile.',
    note: 'Games rebuild shaders automatically when they need them.',
    icon: Sparkles,
    script: `# Remove DirectX's per-user shader cache. Games recreate these files when needed.
$path = Join-Path $env:LOCALAPPDATA 'D3DSCache'
if (Test-Path -LiteralPath $path) {
    Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}`,
  },
  {
    id: 'npm-cache',
    category: 'developer',
    name: 'Clean npm Cache',
    description: 'Clears npm’s downloaded package cache.',
    note: 'Skipped automatically when npm is not installed.',
    icon: Package,
    script: `# Run only when npm is installed. The --force flag is required by npm for cache cleanup.
if ($null -eq (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Output 'npm is not installed; cache cleanup skipped.'
} else {
    npm cache clean --force
    if ($LASTEXITCODE -ne 0) { throw 'npm cache cleanup failed.' }
}`,
  },
  {
    id: 'pnpm-cache',
    category: 'developer',
    name: 'Clean pnpm Cache',
    description: 'Prunes unused packages from pnpm’s shared store.',
    note: 'Project dependencies are not removed.',
    icon: Box,
    script: `# Prune unreferenced packages from pnpm's shared content-addressable store.
if ($null -eq (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Output 'pnpm is not installed; cache cleanup skipped.'
} else {
    pnpm store prune
    if ($LASTEXITCODE -ne 0) { throw 'pnpm cache cleanup failed.' }
}`,
  },
  {
    id: 'yarn-cache',
    category: 'developer',
    name: 'Clean Yarn Cache',
    description: 'Clears Yarn’s downloaded package cache.',
    note: 'Skipped automatically when Yarn is not installed.',
    icon: Code2,
    script: `# Clear Yarn's cache when Yarn is available on this device.
if ($null -eq (Get-Command yarn -ErrorAction SilentlyContinue)) {
    Write-Output 'Yarn is not installed; cache cleanup skipped.'
} else {
    yarn cache clean
    if ($LASTEXITCODE -ne 0) { throw 'Yarn cache cleanup failed.' }
}`,
  },
  {
    id: 'cargo-cache',
    category: 'developer',
    name: 'Clean Cargo Cache',
    description: 'Removes downloaded Cargo registry and Git dependency caches.',
    note: 'Rust dependencies will download again when required.',
    icon: Box,
    script: `# Remove downloaded Cargo registry and Git dependency caches, not your Cargo configuration.
$paths = @(
    (Join-Path $env:USERPROFILE '.cargo\\registry\\cache'),
    (Join-Path $env:USERPROFILE '.cargo\\registry\\src'),
    (Join-Path $env:USERPROFILE '.cargo\\git\\db'),
    (Join-Path $env:USERPROFILE '.cargo\\git\\checkouts')
)
foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) {
        Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
}`,
  },
];

const CLEANUP_GROUPS: Array<{ id: CleanupCategory; eyebrow: string; title: string; description: string }> = [
  {
    id: 'windows',
    eyebrow: 'System space',
    title: 'Windows care',
    description: 'Safe cleanup for files Windows and games can recreate.',
  },
  {
    id: 'developer',
    eyebrow: 'Toolchain reset',
    title: 'Developer maintenance',
    description: 'Remove package caches without touching your source projects.',
  },
];

const ADMIN_PREFLIGHT = `# Windows Update cache cleanup requires an elevated Yolnoma session.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Administrator rights are required to clear Windows Update Cache.'
}`;

const POWERSHELL_COMMANDS = new Set([
  'Clear-RecycleBin',
  'ForEach-Object',
  'Get-ChildItem',
  'Get-CimInstance',
  'Get-Command',
  'Get-Service',
  'Join-Path',
  'New-Object',
  'Remove-Item',
  'Select-Object',
  'Start-Service',
  'Stop-Service',
  'Test-Path',
  'Write-Output',
]);

const POWERSHELL_KEYWORDS = new Set(['catch', 'else', 'finally', 'foreach', 'if', 'in', 'throw', 'try']);
const POWERSHELL_LITERALS = new Set(['Administrator', 'Continue', 'Force', 'Running', 'SilentlyContinue', 'Stop']);
const POWERSHELL_TOKEN = /"(?:[^"`]|`.)*"|'(?:[^']|'')*'|\$[\w:]+|-\w+|\b[\w-]+\b/g;

function highlightPowerShellFragment(source: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let tokenNumber = 0;

  for (const match of source.matchAll(POWERSHELL_TOKEN)) {
    const token = match[0];
    const start = match.index;
    if (start === undefined) continue;

    if (start > cursor) nodes.push(source.slice(cursor, start));

    let className = '';
    if (token.startsWith('$')) className = 'syntax-variable';
    else if (token.startsWith('-')) className = 'syntax-parameter';
    else if (token.startsWith('"') || token.startsWith("'")) className = 'syntax-string';
    else if (POWERSHELL_COMMANDS.has(token)) className = 'syntax-command';
    else if (POWERSHELL_KEYWORDS.has(token)) className = 'syntax-keyword';
    else if (POWERSHELL_LITERALS.has(token) || /^\d+$/.test(token)) className = 'syntax-literal';

    nodes.push(className ? <span className={className} key={`${start}-${tokenNumber}`}>{token}</span> : token);
    cursor = start + token.length;
    tokenNumber += 1;
  }

  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes;
}

function highlightPowerShellLine(line: string): ReactNode {
  const commentStart = line.indexOf('#');
  const command = commentStart === -1 ? line : line.slice(0, commentStart);
  const comment = commentStart === -1 ? '' : line.slice(commentStart);

  return (
    <>
      {highlightPowerShellFragment(command)}
      {comment && <span className="syntax-comment">{comment}</span>}
    </>
  );
}

function CleanerPage() {
  const [selected, setSelected] = useState<CleanupId[]>([]);
  const [runState, setRunState] = useState<RunState>('idle');
  const [statusMessage, setStatusMessage] = useState('Select a task to review its exact PowerShell command.');
  const [copied, setCopied] = useState(false);

  const selectedTasks = CLEANUP_GROUPS.flatMap((group) => (
    CLEANUP_TASKS.filter((task) => task.category === group.id && selected.includes(task.id))
  ));
  const selectedCount = selectedTasks.length;
  const requiresAdmin = selectedTasks.some((task) => task.requiresAdmin);

  const previewScript = useMemo(() => {
    const header = [
      '# Yolnoma Cleaner - generated from reviewed, allow-listed tasks.',
      "$ErrorActionPreference = 'Continue'",
      '',
    ];

    if (selectedTasks.length === 0) {
      return [...header, '# No cleanup task selected yet.', '# Enable an option above to inspect it here.'].join('\n');
    }

    return [
      ...header,
      ...(requiresAdmin ? [ADMIN_PREFLIGHT, ''] : []),
      ...CLEANUP_GROUPS.flatMap((group) => {
        const groupTasks = selectedTasks.filter((task) => task.category === group.id);
        if (groupTasks.length === 0) return [];

        return [
          `# ══ ${group.title.toUpperCase()} ══`,
          ...groupTasks.flatMap((task, index) => [
            `# ── ${String(index + 1).padStart(2, '0')} · ${task.name} ──`,
            task.script,
            '',
          ]),
        ];
      }),
    ].join('\n').trimEnd();
  }, [requiresAdmin, selectedTasks]);

  const toggleTask = (id: CleanupId) => {
    setSelected((current) => (
      current.includes(id)
        ? current.filter((taskId) => taskId !== id)
        : [...current, id]
    ));
    setRunState('idle');
    setStatusMessage('Changes are reflected in the preview. Nothing has run yet.');
  };

  const copyPreview = async () => {
    try {
      await navigator.clipboard.writeText(previewScript);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setStatusMessage('Could not copy the preview. Select the code to copy it manually.');
      setRunState('error');
    }
  };

  const runCleaner = async () => {
    if (selectedCount === 0) return;

    setRunState('running');
    setStatusMessage('Running selected tasks quietly — no terminal window will open.');

    try {
      const result = await invoke<CleanerRunResult>('run_cleaner', { actions: selectedTasks.map((task) => task.id) });
      setRunState('success');
      setStatusMessage(`${result.completedActions} ${result.completedActions === 1 ? 'task' : 'tasks'} completed. ${result.message}`);
    } catch (error) {
      setRunState('error');
      setStatusMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const statusColor = runState === 'error' ? '#F2A8A8' : runState === 'success' ? '#8BD4AD' : 'var(--text-muted)';
  const statusBorder = runState === 'error'
    ? 'rgba(220,80,80,0.28)'
    : runState === 'success'
      ? 'rgba(91,183,127,0.28)'
      : 'var(--border)';

  return (
    <div className="cleaner-page">
      <header className="cleaner-header">
        <div>
          <p className="cleaner-eyebrow"><Sparkles size={13} /> System care</p>
          <h1>Cleaner</h1>
          <p className="cleaner-subtitle">
            Build a transparent cleanup plan, inspect every command, then run it quietly.
          </p>
        </div>

        <div className="cleaner-header-badge">
          <ShieldCheck size={17} />
          <span>Preview first</span>
        </div>
      </header>

      <div className="cleaner-safety-note">
        <ShieldCheck size={19} />
        <div>
          <strong>Transparent by design</strong>
          <span>Only the selected, allow-listed commands can run. Yolnoma never executes typed or downloaded scripts here.</span>
        </div>
      </div>

      <div className="cleaner-layout">
        <section className="cleaner-section cleaner-task-section" aria-labelledby="cleanup-tasks-heading">
          <div className="cleaner-section-heading">
            <div>
              <p className="section-kicker">01 · Choose</p>
              <h2 id="cleanup-tasks-heading">Cleanup tasks</h2>
            </div>
            <span className="task-count">{selectedCount} selected</span>
          </div>

          <div className="cleaner-task-groups">
            {CLEANUP_GROUPS.map((group) => {
              const tasks = CLEANUP_TASKS.filter((task) => task.category === group.id);
              const activeCount = tasks.filter((task) => selected.includes(task.id)).length;

              return (
                <section className={`cleaner-task-group is-${group.id}`} key={group.id} aria-labelledby={`${group.id}-group-heading`}>
                  <div className="task-group-heading">
                    <div>
                      <p>{group.eyebrow}</p>
                      <h3 id={`${group.id}-group-heading`}>{group.title}</h3>
                      <span>{group.description}</span>
                    </div>
                    <span className="group-selected-count">{activeCount}/{tasks.length}</span>
                  </div>

                  <div className="cleaner-task-grid">
                    {tasks.map((task) => {
                      const enabled = selected.includes(task.id);
                      const Icon = task.icon;

                      return (
                        <button
                          key={task.id}
                          type="button"
                          className={`cleaner-task${enabled ? ' is-enabled' : ''}`}
                          onClick={() => toggleTask(task.id)}
                          aria-pressed={enabled}
                        >
                          <span className="task-card-top">
                            <span className="task-icon"><Icon size={17} strokeWidth={1.8} /></span>
                            <span className={`cleaner-toggle${enabled ? ' is-on' : ''}`} aria-hidden="true"><span /></span>
                          </span>
                          <span className="task-content">
                            <span className="task-title-row">
                              <span className="task-name">{task.name}</span>
                              {task.requiresAdmin && <span className="task-risk is-admin">Admin</span>}
                              {task.id === 'recycle-bin' && <span className="task-risk">Permanent</span>}
                            </span>
                            <span className="task-description">{task.description}</span>
                            <span className="task-note"><FileWarning size={11} /> {task.note}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="cleaner-action-row">
            <p>{selectedCount === 0
              ? 'Choose at least one task to continue.'
              : requiresAdmin
                ? 'Windows Update Cache needs Yolnoma to be started as Administrator.'
                : 'Review the generated script before running it.'}
            </p>
            <Button
              onClick={runCleaner}
              loading={runState === 'running'}
              disabled={selectedCount === 0}
              title={selectedCount === 0
                ? 'Select a task first'
                : requiresAdmin
                  ? 'Run Yolnoma as Administrator before selecting this task'
                  : 'Run selected cleanup tasks without opening a terminal'}
            >
              <Play size={15} fill="currentColor" />
              Run quietly
            </Button>
          </div>

          <div
            className={`cleaner-status is-${runState}`}
            style={{ color: statusColor, borderColor: statusBorder }}
            aria-live="polite"
          >
            {runState === 'success' ? <Check size={16} /> : <ShieldCheck size={16} />}
            <span>{statusMessage}</span>
          </div>
        </section>

        <section className="cleaner-section cleaner-preview-section" aria-labelledby="preview-heading">
          <div className="cleaner-section-heading">
            <div>
              <p className="section-kicker">02 · Inspect</p>
              <h2 id="preview-heading">Script preview</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={copyPreview} title="Copy preview code">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <div className="code-window">
            <div className="code-window-topbar">
              <div className="window-dots"><span /><span /><span /></div>
              <div className="code-language"><Code2 size={13} /> PowerShell</div>
              <span className="code-line-count">{previewScript.split('\n').length} lines</span>
            </div>
            <pre aria-label="Generated PowerShell preview"><code>{previewScript.split('\n').map((line, index) => (
              <span className="code-line" key={`${index}-${line}`}>
                <span className="code-line-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="code-line-content">{highlightPowerShellLine(line)}</span>
              </span>
            ))}</code></pre>
          </div>

          <p className="preview-footnote">
            The command preview is generated from the same restricted task list that the desktop command validates before execution.
          </p>
        </section>
      </div>

      <style>{`
        .cleaner-page { max-width: 1320px; margin: 0 auto; padding: 4px 0 36px; color: var(--text-primary); }
        .cleaner-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 27px; border-bottom: 1px solid var(--border); }
        .cleaner-eyebrow, .section-kicker { display: flex; align-items: center; gap: 7px; margin: 0 0 9px; color: var(--accent); font-size: 10px; font-weight: 700; letter-spacing: .17em; line-height: 1; text-transform: uppercase; }
        .cleaner-header h1 { margin: 0; font: 500 40px/1.04 var(--font-serif); letter-spacing: -.025em; }
        .cleaner-subtitle { max-width: 570px; margin: 10px 0 0; color: var(--text-muted); font-size: 14px; line-height: 1.6; }
        .cleaner-header-badge { display: inline-flex; align-items: center; gap: 8px; margin-top: 7px; padding: 9px 12px; border: 1px solid var(--accent-border); border-radius: 999px; background: var(--accent-glow); color: var(--accent); font-size: 12px; font-weight: 650; white-space: nowrap; }
        .cleaner-safety-note { display: flex; gap: 11px; align-items: flex-start; margin: 24px 0; padding: 14px 16px; border: 1px solid rgba(139, 212, 173, .18); border-radius: var(--radius-md); background: rgba(91, 183, 127, .055); color: #8BD4AD; }
        .cleaner-safety-note div { display: flex; flex-direction: column; gap: 3px; }
        .cleaner-safety-note strong { font-size: 12px; font-weight: 700; }
        .cleaner-safety-note span { color: var(--text-muted); font-size: 12px; line-height: 1.45; }
        .cleaner-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 22px; }
        .cleaner-section { min-width: 0; padding: 22px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: linear-gradient(145deg, rgba(255,255,255,.026), rgba(255,255,255,.01)), var(--bg-card); box-shadow: var(--shadow-sm); }
        .cleaner-section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 19px; }
        .cleaner-section-heading h2 { margin: 0; font: 500 22px/1.1 var(--font-serif); letter-spacing: -.01em; }
        .section-kicker { color: var(--text-faint); margin-bottom: 7px; font-size: 9px; }
        .task-count { padding: 5px 9px; border: 1px solid var(--border); border-radius: 99px; color: var(--text-muted); background: rgba(255,255,255,.025); font: 600 11px/1.1 var(--font-mono); white-space: nowrap; }
        .cleaner-task-groups { display: grid; gap: 14px; }
        .cleaner-task-group { padding: 14px; border: 1px solid rgba(242,237,230,.075); border-radius: 16px; background: rgba(0,0,0,.09); }
        .cleaner-task-group.is-developer { border-color: rgba(178, 119, 255, .18); background: linear-gradient(125deg, rgba(115, 55, 177, .1), rgba(31, 22, 48, .05)); }
        .task-group-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 0 1px 12px; }
        .task-group-heading p { margin: 0 0 5px; color: var(--text-faint); font-size: 9px; font-weight: 700; letter-spacing: .15em; line-height: 1; text-transform: uppercase; }
        .is-developer .task-group-heading p { color: #C59CFF; }
        .task-group-heading h3 { margin: 0; color: var(--text-primary); font-size: 14px; font-weight: 650; line-height: 1.15; }
        .task-group-heading > div > span { display: block; max-width: 370px; margin-top: 4px; color: var(--text-muted); font-size: 10px; line-height: 1.4; }
        .group-selected-count { padding: 5px 7px; border: 1px solid var(--border); border-radius: 7px; color: var(--text-faint); background: rgba(255,255,255,.025); font: 600 10px/1 var(--font-mono); }
        .is-developer .group-selected-count { border-color: rgba(178, 119, 255, .2); color: #CDB6FF; background: rgba(178, 119, 255, .07); }
        .cleaner-task-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(195px, 1fr)); gap: 9px; }
        .cleaner-task { display: flex; width: 100%; min-height: 145px; flex-direction: column; justify-content: space-between; gap: 11px; padding: 12px; color: inherit; text-align: left; background: rgba(255,255,255,.018); border: 1px solid var(--border); border-radius: 12px; transition: border-color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast); }
        .cleaner-task:hover { border-color: var(--border-hover); background: rgba(255,255,255,.04); transform: translateY(-1px); }
        .cleaner-task:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .cleaner-task.is-enabled { border-color: var(--accent-border); background: linear-gradient(110deg, rgba(217,119,87,.1), rgba(217,119,87,.025)); }
        .is-developer .cleaner-task.is-enabled { border-color: rgba(193, 119, 255, .42); background: linear-gradient(110deg, rgba(154, 92, 226, .15), rgba(82, 45, 145, .045)); }
        .task-card-top { display: flex; align-items: center; justify-content: space-between; }
        .task-icon { display: grid; flex: 0 0 auto; width: 32px; height: 32px; place-items: center; border: 1px solid var(--border); border-radius: 9px; color: var(--text-muted); background: rgba(0,0,0,.12); transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast); }
        .is-enabled .task-icon { border-color: var(--accent-border); background: var(--accent-dim); color: var(--accent); }
        .is-developer .is-enabled .task-icon { border-color: rgba(193, 119, 255, .38); background: rgba(166, 106, 245, .15); color: #D1A7FF; }
        .task-content { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 4px; }
        .task-title-row { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 5px; }
        .task-name { color: var(--text-primary); font-size: 12px; font-weight: 650; line-height: 1.25; }
        .task-risk { padding: 2px 5px; border: 1px solid rgba(220,80,80,.24); border-radius: 4px; color: #E7A195; background: rgba(220,80,80,.08); font-size: 9px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
        .task-risk.is-admin { border-color: rgba(246, 199, 125, .25); color: #F6C77D; background: rgba(246, 199, 125, .08); }
        .task-description { color: var(--text-muted); font-size: 10px; line-height: 1.4; }
        .task-note { display: inline-flex; align-items: flex-start; gap: 4px; color: var(--text-faint); font-size: 9px; line-height: 1.35; }
        .cleaner-toggle { display: flex; flex: 0 0 auto; align-items: center; width: 38px; height: 22px; padding: 3px; border: 1px solid var(--border-hover); border-radius: 99px; background: rgba(0,0,0,.25); transition: background var(--transition-fast), border-color var(--transition-fast); }
        .cleaner-toggle span { width: 14px; height: 14px; border-radius: 50%; background: var(--text-faint); transition: transform var(--transition-fast), background var(--transition-fast); }
        .cleaner-toggle.is-on { border-color: var(--accent-border); background: var(--accent); }
        .cleaner-toggle.is-on span { background: #fff5ef; transform: translateX(16px); }
        .cleaner-action-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 18px; padding-top: 17px; border-top: 1px solid var(--border); }
        .cleaner-action-row p { max-width: 255px; margin: 0; color: var(--text-muted); font-size: 11px; line-height: 1.45; }
        .cleaner-status { display: flex; align-items: flex-start; gap: 8px; margin-top: 12px; padding: 10px 12px; border: 1px solid; border-radius: 10px; background: rgba(255,255,255,.018); font-size: 11px; line-height: 1.45; }
        .cleaner-status.is-running { color: var(--accent) !important; }
        .cleaner-preview-section { display: flex; flex-direction: column; border-color: rgba(190, 119, 255, .22); background: radial-gradient(circle at 100% 0, rgba(201, 91, 255, .08), transparent 36%), linear-gradient(145deg, rgba(72, 28, 100, .13), rgba(255,255,255,.01)), var(--bg-card); }
        .code-window { display: flex; min-height: 375px; flex: 1; flex-direction: column; overflow: hidden; border: 1px solid rgba(182, 118, 255, .32); border-radius: 14px; background: radial-gradient(ellipse at 10% 0, rgba(57, 160, 255, .09), transparent 45%), radial-gradient(ellipse at 100% 100%, rgba(242, 79, 199, .09), transparent 48%), #0D0A16; box-shadow: inset 0 1px 0 rgba(255,255,255,.045), 0 12px 34px rgba(45, 12, 63, .2); }
        .code-window-topbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-bottom: 1px solid rgba(189, 129, 255, .18); background: linear-gradient(90deg, rgba(114, 61, 182, .18), rgba(45, 154, 230, .08), rgba(243, 85, 192, .12)); }
        .window-dots { display: flex; gap: 5px; }
        .window-dots span { width: 7px; height: 7px; border-radius: 99px; background: rgba(242,237,230,.18); }
        .window-dots span:first-child { background: #F566C8; box-shadow: 0 0 8px rgba(245,102,200,.75); }
        .window-dots span:nth-child(2) { background: #9B7BFF; box-shadow: 0 0 8px rgba(155,123,255,.65); }
        .window-dots span:nth-child(3) { background: #67D9F2; box-shadow: 0 0 8px rgba(103,217,242,.65); }
        .code-language { display: inline-flex; align-items: center; gap: 5px; color: #E8B5FF; font: 650 10px/1 var(--font-mono); text-shadow: 0 0 14px rgba(232,181,255,.45); }
        .code-line-count { color: rgba(211, 191, 244, .55); font: 10px/1 var(--font-mono); }
        .code-window pre { flex: 1; max-height: 440px; margin: 0; padding: 14px 0; overflow: auto; color: #DED7E8; font: 11.5px/1.72 var(--font-mono); tab-size: 2; white-space: pre; }
        .code-window code { display: block; min-width: max-content; font-family: inherit; }
        .code-line { display: grid; grid-template-columns: 40px auto; min-height: 1.72em; }
        .code-line:hover { background: rgba(180, 116, 255, .06); }
        .code-line-number { padding-right: 11px; border-right: 1px solid rgba(189, 129, 255, .12); color: rgba(211, 191, 244, .28); font-size: 10px; text-align: right; user-select: none; }
        .code-line-content { padding: 0 17px; }
        .syntax-comment { color: rgba(222, 215, 232, .48); font-style: italic; }
        .syntax-command { color: #F3A3FF; text-shadow: 0 0 12px rgba(243, 163, 255, .24); }
        .syntax-keyword { color: #A990FF; }
        .syntax-variable { color: #74E7D2; }
        .syntax-parameter { color: #7FC4FF; }
        .syntax-string { color: #F6C77D; }
        .syntax-literal { color: #FF91C6; }
        .preview-footnote { margin: 12px 2px 0; color: var(--text-faint); font-size: 10px; line-height: 1.45; }
        @media (max-width: 960px) { .code-window { min-height: 310px; } }
        @media (max-width: 600px) { .cleaner-header { flex-direction: column; } .cleaner-header h1 { font-size: 34px; } .cleaner-section { padding: 17px; } .cleaner-task-group { padding: 11px; } .cleaner-task-grid { grid-template-columns: 1fr; } .cleaner-task { min-height: 118px; } .cleaner-action-row { align-items: flex-start; flex-direction: column; } .cleaner-action-row p { max-width: none; } .cleaner-action-row .btn { width: 100%; justify-content: center; } }
      `}</style>
    </div>
  );
}

export default CleanerPage;
