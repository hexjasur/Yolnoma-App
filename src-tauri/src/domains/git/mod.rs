use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;

const MAX_FILES: usize = 60;
const MAX_DIFF_CHARS: usize = 20_000;

#[derive(Debug, Serialize)]
pub struct GitChange {
    pub path: String,
    pub status: String,
    pub diff: String,
}

#[derive(Debug, Serialize)]
pub struct GitCommit {
    pub hash: String,
    pub short_hash: String,
    pub author: String,
    pub date: String,
    pub subject: String,
    pub parents: Vec<String>,
    pub refs: Vec<String>,
}

fn run_git(root: &Path, args: &[&str]) -> Result<std::process::Output, String> {
    let root_string = root.to_string_lossy().to_string();
    // Git 2.35+ can reject repositories created by another Windows user with
    // "detected dubious ownership". Scope the exception to this canonical,
    // user-selected repository and this single command instead of mutating the
    // user's global Git configuration.
    let safe_directory = format!("safe.directory={root_string}");
    Command::new("git")
        .args(["-c", safe_directory.as_str()])
        .args(["-C", root_string.as_str()])
        .args(args)
        .output()
        .map_err(|error| format!("Could not run Git: {error}"))
}

fn truncate_diff(value: String) -> String {
    if value.chars().count() <= MAX_DIFF_CHARS {
        return value;
    }
    let truncated: String = value.chars().take(MAX_DIFF_CHARS).collect();
    format!("{truncated}\n\n... diff truncated for this file ...")
}

fn untracked_diff(root: &Path, relative_path: &str) -> String {
    let file = root.join(relative_path);
    let Ok(bytes) = std::fs::read(&file) else {
        return "[Could not read new file]".to_string();
    };
    if bytes.contains(&0) {
        return "[Binary file omitted]".to_string();
    }
    let content = String::from_utf8_lossy(&bytes);
    let line_count = content.lines().count().max(1);
    truncate_diff(format!(
        "--- /dev/null\n+++ b/{relative_path}\n@@ -0,0 +1,{line_count} @@\n{}",
        content
            .lines()
            .map(|line| format!("+{line}"))
            .collect::<Vec<_>>()
            .join("\n")
    ))
}

#[tauri::command]
pub fn get_git_changes(root_path: String) -> Result<Vec<GitChange>, String> {
    let root = PathBuf::from(root_path)
        .canonicalize()
        .map_err(|error| format!("Could not access selected folder: {error}"))?;
    if !root.is_dir() {
        return Err("The selected path is not a folder.".to_string());
    }
    let status_output = run_git(
        &root,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    )?;
    if !status_output.status.success() {
        let message = String::from_utf8_lossy(&status_output.stderr)
            .trim()
            .to_string();
        return Err(if message.is_empty() {
            "The selected folder is not a Git repository.".to_string()
        } else {
            message
        });
    }
    let raw = String::from_utf8_lossy(&status_output.stdout);
    let entries: Vec<&str> = raw.split('\0').filter(|entry| !entry.is_empty()).collect();
    let mut changes = Vec::new();
    for entry in entries.into_iter().take(MAX_FILES) {
        if entry.len() < 4 {
            continue;
        }
        let status = entry[..2].trim().to_string();
        let relative_path = entry[3..].replace('\\', "/");
        let diff = if status == "??" {
            untracked_diff(&root, &relative_path)
        } else {
            let output = run_git(
                &root,
                &[
                    "diff",
                    "HEAD",
                    "--no-ext-diff",
                    "--unified=80",
                    "--",
                    &relative_path,
                ],
            )?;
            let diff = String::from_utf8_lossy(&output.stdout).into_owned();
            truncate_diff(if diff.trim().is_empty() {
                "[No textual diff available]".to_string()
            } else {
                diff
            })
        };
        changes.push(GitChange {
            path: relative_path,
            status,
            diff,
        });
    }
    Ok(changes)
}

#[tauri::command]
pub fn get_git_history(root_path: String, limit: Option<u32>) -> Result<Vec<GitCommit>, String> {
    let root = PathBuf::from(root_path)
        .canonicalize()
        .map_err(|error| format!("Could not access selected folder: {error}"))?;
    if !root.is_dir() {
        return Err("The selected path is not a folder.".to_string());
    }
    let count = limit.unwrap_or(80).clamp(1, 200).to_string();
    let count_arg = format!("-{count}");
    let output = run_git(
        &root,
        &[
            "log",
            "--all",
            "--date=short",
            &count_arg,
            "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s%x1f%P%x1e",
        ],
    )?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if message.is_empty() {
            "Could not read Git history.".to_string()
        } else {
            message
        });
    }
    let refs_output = run_git(&root, &["show-ref"])?;
    let mut refs_by_hash: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for line in String::from_utf8_lossy(&refs_output.stdout).lines() {
        let Some((hash, name)) = line.split_once(' ') else {
            continue;
        };
        let short_name = name
            .strip_prefix("refs/heads/")
            .or_else(|| name.strip_prefix("refs/tags/"))
            .unwrap_or(name);
        refs_by_hash
            .entry(hash.to_string())
            .or_default()
            .push(short_name.to_string());
    }
    let mut commits = Vec::new();
    for record in String::from_utf8_lossy(&output.stdout)
        .split('\x1e')
        .filter(|record| !record.is_empty())
    {
        let fields: Vec<&str> = record.split('\x1f').collect();
        if fields.len() < 6 {
            continue;
        }
        let hash = fields[0].to_string();
        commits.push(GitCommit {
            short_hash: fields[1].to_string(),
            author: fields[2].to_string(),
            date: fields[3].to_string(),
            subject: fields[4].to_string(),
            parents: fields[5].split_whitespace().map(str::to_string).collect(),
            refs: refs_by_hash.remove(&hash).unwrap_or_default(),
            hash,
        });
    }
    Ok(commits)
}
