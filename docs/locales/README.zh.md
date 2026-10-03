<div align="center">
<img src="../../.github/images/logo.png" alt="Yolnoma 徽标" width="88" />
  <h1>Yolnoma-App</h1>
  <p><strong>面向开发者、创作者及高级用户的专注桌面一体化工作区。</strong></p>
  <p>
    <a href="https://github.com/hexjasur/Yolnoma-App/releases">版本发布</a> ·
    <a href="https://github.com/hexjasur/Yolnoma-App/issues">问题与反馈</a> ·
    <a href="../../CONTRIBUTING.md">参与贡献</a>
  </p>
  <p align="center">
    <a href="../../README.md">English</a> ·
    <a href="README.ru.md">Русский</a> ·
    <a href="README.zh.md"><b>中文</b></a>
  </p>
</div>

<p align="center">
  <img src="../../.github/images/brand.jpg" alt="Yolnoma 桌面工作区" width="100%" />
</p>

**Yolnoma-App** 将实用的开发者工具、网络检测、媒体实用程序、图像工作流、AI 工作区以及 Steam 相关工具整合到一个原生桌面应用程序中。无需在数十个浏览器标签页之间反复切换，即可在基于 [Tauri](https://tauri.app/) 构建的统一工作空间中处理日常高频任务。

> Yolnoma-App 是 Jasurbek Haydarov 在 JK Software 旗下开发的独立项目。本应用与 Valve Corporation 或 Steam 无任何隶属、赞助或背书关系。

# 为什么选择 Yolnoma？

大多数实用工具分散在浏览器标签、独立脚本和单一用途的工具中。Yolnoma 基于全新的理念构建：打造一个随着您的工作方式一同扩展的实用桌面工具箱。

- **一个应用，多种工作流** — 开发者工具、网络、媒体、图像、AI、文件及游戏工具汇聚一处。
- **原生桌面架构** — 前端基于 React 和 TypeScript，底层由 Tauri v2 和 Rust 强力驱动。
- **工作区导向的导航** — 工具按工作区分类管理，告别杂乱拥挤的单页面。
- **本地优先的数据策略** — 账号配置及 AI 聊天历史均保存在本地；外部 AI 请求仅发送至所选提供商。
- **持续活跃迭代** — 随着版本演进持续引入新工具、新集成与体验优化。

# 功能与工作区

| 工作区             | 包含功能                                                                    |
| ------------------ | --------------------------------------------------------------------------- |
| **开发者工具**     | JSON 格式化、JWT 解码、cURL 转换、文本对比 (Diff)、Git 提交管理及编码工具。 |
| **网络与域名**     | DNS 记录查询、子域名发现、HTTP 标头检测、SSL 评分及授权目标端口扫描。       |
| **系统与实用工具** | 缓存清理、实时系统资源监控、汇率转换、游戏准星浮层及 Yolnoma 3D 探索。      |
| **AI 工作区**      | 连接 OpenRouter 强大模型进行对话、生成数据库架构图及自动生成项目 README。   |
| **Steam 与游戏**   | Steam 挂机工具 (Steam Idler)、游戏信息查询及成就管理 (SAM)。                |

---

## 技术架构

| 架构层   | 技术选型                              |
| -------- | ------------------------------------- |
| 桌面引擎 | [Tauri v2](https://tauri.app/)        |
| 前端框架 | React, TypeScript, Vite               |
| 样式系统 | Tailwind CSS                          |
| 系统底层 | Rust                                  |
| 状态管理 | Zustand, TanStack Query, 本地应用存储 |
| 包管理器 | [Bun](https://bun.sh/)                |
| 测试框架 | Vitest 和 Testing Library             |

详细架构说明请参阅 [ARCHITECTURE.md](../ARCHITECTURE.md)。

---

## 目录

- [核心亮点](#核心亮点)
- [支持语言](#支持语言)
- [应用截图](#应用截图)
- [运行要求](#运行要求)
- [快速开始](#快速开始)
- [常用命令](#常用命令)
- [隐私与数据安全](#隐私与数据安全)
- [项目声明](#项目声明)
- [致谢](#致谢)
- [安全政策](#安全政策)
- [参与贡献](#参与贡献)
- [开源协议](#开源协议)
- [关于作者](#关于作者)

## 核心亮点

- 🖥️ **一体化桌面应用**，集成开发、媒体与日常实用工具。
- ⚡ **轻量疾速的原生内核**，基于 Tauri、React 和 Bun 构建。
- 🌐 **多语言支持** — 原生支持英语、俄语、西班牙语和中文。
- 🔐 **本地数据优先** — AI 聊天记录与用户配置安全存储于本地。
- 🧩 **高可扩展性** — 持续发布新功能与工具集成。
- 🤖 **自带 AI API 密钥** — 无共享服务器密钥，无厂商绑定。

## 支持语言

Yolnoma-App 支持在顶部导航栏 (Navbar) 中即时切换界面语言：

- **English** (`en` / 英语) — 默认语言（完整界面）
- **Русский** (`ru` / 俄语) — 完整界面本地化
- **Español** (`es` / 西班牙语) — 导航栏、侧边栏及仪表盘
- **中文** (`zh`) — 导航栏、侧边栏及仪表盘

## 应用截图

| 仪表盘                                                                          | 开发者工作区                                                                    | 图像背景消除                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| <img src="../../.github/images/app/dashboard.png" alt="dashboard" width="100%"> | <img src="../../.github/images/app/workspace.png" alt="workspace" width="100%"> | <img src="../../.github/images/app/bg_remover.png" alt="background remover" width="100%"> |

## 运行要求

在本地运行或编译 Yolnoma-App 之前，请确保环境满足以下要求：

### 操作系统

- 推荐 **Windows 10 / 11** (64 位) 以获得完整的系统功能支持。

### 开发工具链

1. **[Bun](https://bun.sh/) (v1.4+)** 或 **Node.js (v18+)**
2. **[Rust 工具链](https://www.rust-lang.org/tools/install)** (`rustc`, `cargo`，推荐 stable 分支)
3. **[Tauri v2 环境依赖](https://v2.tauri.app/start/prerequisites/)** (Visual Studio C++ Build Tools & WebView2 Runtime)

## 快速开始

```bash
# 1. 安装依赖
bun install

# 2. 复制环境配置文件
cp .env.example .env

# 3. 启动开发模式桌面应用
bun run tauri dev
```

## 常用命令

| 命令                | 用途                              |
| ------------------- | --------------------------------- |
| `bun run td`        | 在开发模式下启动 Tauri 桌面应用。 |
| `bun run dev`       | 启动 Vite 前端开发服务器。        |
| `bun run typecheck` | 执行 TypeScript 类型检查。        |
| `bun run lint`      | 运行 ESLint 静态代码检查。        |
| `bun run test`      | 运行 Vitest 测试套件。            |
| `bun run build`     | 构建前端生产资源包。              |
| `bun run tb`        | 构建打包桌面应用程序。            |
| `bun run check`     | 运行项目的完整验证命令。          |

## 隐私与数据安全

AI 聊天记录保存在本地计算机：

```text
%LOCALAPPDATA%\Yolnoma\accounts\<user-id>\ai-chat\sessions\<session-id>.json
```

发送提示词时，内容将直接传输至配置的 AI 提供商（如 **OpenRouter**）。对话数据不会上传至任何 Yolnoma 服务器。

详见 [SECURITY.md](../../SECURITY.md)。

## 项目声明

Yolnoma-App 包含基于 **zevnda** 的开源项目 [Steam Game Idler](https://github.com/zevnda/steam-game-idler) 衍生和集成的 Steam 工具。相关第三方许可证与版权说明已妥善保留，详见 [THIRD-PARTY-NOTICES.md](../../src-tauri/THIRD-PARTY-NOTICES.md)。

## 致谢

特别感谢 Steam Game Idler、SteamKit2、Tauri、React 等优秀开源项目的作者与维护者。

## 关于作者

Jasurbek Haydarov — Yolnoma-App 创始人与核心开发者。

- GitHub: [@hexjasur](https://github.com/hexjasur)
- 项目主页: [hexjasur/Yolnoma-App](https://github.com/hexjasur/Yolnoma-App)
