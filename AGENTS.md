# AGENTS.md — Yolnoma App

This file is a mandatory guide for any AI agent working on this project (Claude, Cursor, Copilot, etc.). Read this file before starting any task and follow it strictly.

## About the project

- **Name:** Yolnoma
- **Stack:** React + TypeScript (TSX) + Tauri v2 (desktop app)
- **Core features:** AI Chat (OpenRouter), Codebase Agent, Database Gen, Profile, Image Converter, Cleaner, Crosshair, Steam tools, Archive Explorer, Port Scanner, Currency Converter, Video Downloader

## Core principles

### 1. DRY (Don't Repeat Yourself)

- One function, one piece of logic — written **only once**. If it's needed elsewhere, import and reuse it; never duplicate it.
- Before writing new code, check whether a similar function or component already exists in the project. If it does, import and extend it instead of rewriting it from scratch.
- The moment a piece of logic is duplicated a second time, extract it into a shared function under `utils/`, `hooks/`, or `helpers/`.

### 2. Reuse components

- Before building a new UI piece, check `src/components/` first — a similar component likely already exists.
- Never rewrite a UI pattern (button, modal, card, input, etc.) from scratch — import the existing component and adapt it through props.
- Shared components live in `src/components/common/` or `src/components/ui/`.

### 3. File and folder structure

- Every major feature (e.g. Codebase Agent, CSS Tools) gets its own folder: `src/features/<feature-name>/`.
- If a feature is actually a workspace with tabs, the tabs must be implemented using `useHashTab.ts` — tab logic must never be duplicated across tabs.
- If a `.tsx` file exceeds ~700 lines, don't silently keep growing it — warn the user and propose splitting it into logical files (components, hooks, types, utils).
- Types and interfaces live in a separate `types.ts` file, not inline in components (except for small, purely local types).

### 4. Best practices

- Always write in TypeScript strict mode — avoid `any`.
- Follow the state management pattern already used in the project; don't introduce a new pattern.
- Tauri API calls (`invoke`, filesystem, dialogs, etc.) go through wrapper functions in `src/lib/tauri/` (or similar) — never call them directly inside a component.
- After adding or changing a function/component, check every place that imports it to make sure no stale/duplicate version is left behind.
- Extract side effects and API calls into custom hooks (`useXxx.ts`) — keep components as a "view" layer, not a "smart" layer.
- Never silently swallow errors — every async operation and tool call must have proper error handling.

### 5. Before making changes

- Read and understand the existing code before modifying it — don't overwrite blindly.
- If the needed logic already exists elsewhere in the codebase, import it — don't duplicate it.
- For larger refactors, briefly explain what will change before making the change.

### 6. Git Rules

- Consider the existing Git history and commit style.
- Check changed files before creating a commit.
- Commit messages must follow the project's existing Conventional Commit style.
- Create a commit only when explicitly requested by the user.
- Push changes only when explicitly requested by the user.
- Do not use destructive commands such as `git reset`, `git checkout`, `git restore`, or `git clean` unless explicitly requested by the user.

### 7. Security

- Never commit secrets to the Git repository.
- Do not add `.env` or secret files to version control.
- Consider path traversal and other security issues when performing file system operations.
- Do not send user API keys anywhere they are not required.

### 8. Dependencies

- Do not add a large library for a single small task.
- Do not change dependency versions without a valid reason.
- Do not leave unused dependencies in the project.

### 9. AI Agent Workflow

Perform every task in the following order:

1. **Understand** — Fully understand the task.
2. **Inspect** — Read the relevant files and directories.
3. **Search** — Search for existing components, hooks, utilities, types, and logic.
4. **Reuse** — Reuse existing code where possible.
5. **Plan** — Create an implementation plan for architecture-related changes.
6. **Review** — Check for duplicate code, unused code, and architecture issues.
7. **Validate** — Check TypeScript, lint, tests, or build as appropriate.
8. **Report** — Briefly explain what was changed and the validation results.

## Forbidden

- ❌ Writing the same function twice under a different name
- ❌ Copy-pasting an existing component with minor tweaks into a new file
- ❌ Using `any` as a "temporary" fix
- ❌ Cramming everything (UI + logic + API calls) into a single file

---

**Context version:** 0.3

**Updated:** 2026-09-25
**by Yolnoma**
