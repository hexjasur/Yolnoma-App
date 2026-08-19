# 🚀 Yolnoma — Future Roadmap

> **Oliy maqsad:** Yolnoma'ni Windows uchun yengil, modular va
> plugin-based utility hub'ga aylantirish.

Asosiy prinsip:

> Core kichik va yengil qoladi. Kerakli funksiyalar esa plugin sifatida o'rnatiladi.

Foydalanuvchiga kerak bo'lmagan narsa dasturga yuk bo'lmaydi.

---

# 🧩 1. Plugin System — ASOSIY MAQSAD

Bu Yolnoma'ning eng muhim future architecture'si.

### Maqsad

Foydalanuvchi Yolnoma'ni o'rnatadi:

```text
Yolnoma
```

Keyin:

```text
Plugins
├── Background Remover
├── Steam Idler
├── Performance
├── Stream
├── GitHub
├── RAR Explorer
├── Pomodoro
└── ...
```

Keraklisini:

```text
[ Install ]
```

bosadi va plugin Yolnoma ichida paydo bo'ladi.

### Plugin tizimida

* Install
* Uninstall
* Enable / Disable
* Update
* Version management
* Plugin permissions
* Plugin settings
* Plugin manifest
* Plugin dependencies
* Plugin storage
* Plugin auto-update
* Local/developer plugin
* Plugin Store

### Muhim prinsip

Core:

```text
Yolnoma Core
├── UI Shell
├── Authentication
├── Plugin Manager
├── Settings
├── Update Manager
└── Shared Services
```

Plugin:

```text
Plugin
├── UI
├── Logic
├── Assets
├── Settings
└── Optional backend/service
```

---

# 📦 2. RAR Explorer

RAR/ZIP/7Z va boshqa archive formatlarni Yolnoma ichida ko'rish.

### Maqsad

Masalan:

```text
file.rar
```

ustiga bosilganda Windows Explorer emas, Yolnoma ichidagi explorer ochilishi.

### UI

```text
Archive
├── 📁 Images
│   ├── image1.png
│   ├── image2.jpg
│   └── logo.webp
│
├── 📁 Documents
│   ├── README.md
│   └── info.txt
│
└── 📄 config.json
```

### Funksiyalar

* Browse archive
* Extract
* Extract selected
* Create archive
* Delete file
* Rename
* Preview image
* Preview text
* Search
* File size
* Compression information

---

# 🍅 3. Pomodoro Timer

Pomodoro — ishni vaqt bo'yicha bo'lib ishlash tizimi.

Masalan:

```text
25 min  → Ish
5 min   → Break

25 min  → Ish
5 min   → Break

25 min  → Ish
5 min   → Break

25 min  → Ish
15-30 min → Long Break
```

Yolnoma'da bu oddiy timer emas, productivity plugin bo'lishi mumkin.

### Future

* Custom timer
* Work sessions
* Break sessions
* Daily statistics
* Weekly statistics
* Focus time
* Notifications
* Tray mode
* Global hotkey
* Session history

Masalan:

```text
TODAY

Focus time
03h 42m

Sessions
████████████ 12

Completed
9 / 12

Current
FOCUS — 18:42
```

---

# 🌐 4. API Tester

Postman'ga o'xshash, lekin Yolnoma ichidagi yengil API client.

### Request

```text
GET
https://api.example.com/users
```

Headers:

```text
Authorization: Bearer ...
Content-Type: application/json
```

Body:

```json
{
  "name": "Jasur"
}
```

### Response

```text
Status      200 OK
Time        142 ms
Size        4.2 KB
```

```json
{
  "success": true,
  "users": []
}
```

### Future

* GET
* POST
* PUT
* PATCH
* DELETE
* Headers
* Query params
* JSON body
* Form-data
* Auth
* Collections
* Environment variables
* Request history
* Response viewer
* Export / Import

---

# 🔎 5. Port Scanner

Bu developer/system diagnostics plugin bo'ladi.

### Maqsad

Masalan:

```text
localhost
```

beriladi.

Natija:

```text
PORT    STATUS      SERVICE

22      OPEN        SSH
80      OPEN        HTTP
443     OPEN        HTTPS
3000    OPEN        Node
5173    OPEN        Vite
7777    OPEN        API
```

### Qo'shimcha

Port → process:

```text
7777
↓
node.exe
↓
PID 14232
```

Bu ayniqsa developerlar uchun juda foydali.

> Faqat o'z qurilmalari yoki ruxsat berilgan tizimlarni diagnostika qilishga yo'naltiriladi.

---

# 🐙 6. GitHub / Git Dashboard

Bu eng qiziq pluginlardan biri bo'lishi mumkin.

Oddiy Git client emas.

### Asosiy g'oya

Foydalanuvchi:

```text
Continue with GitHub
```

qiladi.

GitHub OAuth orqali account ulanadi.

Keyin Yolnoma GitHub'dan repository'larni olib keladi.

---

## GitHub Dashboard

```text
GitHub

Hex:Jasur

Repositories
────────────────────────────────────

⭐ yolnoma
TypeScript • Rust

⭐ api
Node.js

   qardu-scholars
React

   website
TypeScript
```

---

## Repository Detail

Repo ochilganda:

```text
yolnoma
────────────────────────────────────

⭐ Favorite

TypeScript      62%
Rust            31%
Other            7%

⭐ Stars       12
🍴 Forks        3
🐛 Issues       4
🔀 PRs          7

Last commit
8 minutes ago
```

---

## Git History

```text
COMMITS

● fix: desktop oauth flow
│  8 min ago
│
● feat: github authentication
│  2 hours ago
│
● refactor: plugin manager
│  yesterday
│
● feat: dashboard
│  2 days ago
```

Commit ochilganda:

```text
fix: desktop oauth flow

Author
Hex:Jasur

Files changed
+142
-37

Files
├── auth.service.js
├── desktop-auth.ctrl.js
└── callback.js
```

---

## ⭐ Favorites

Foydalanuvchi repo'ni:

```text
☆ Favorite
```

bosadi.

Keyin:

```text
Yolnoma
└── GitHub
    └── Favorites

    ⭐ yolnoma
    ⭐ qardu-scholars
    ⭐ api
```

Dashboard'da favorite repo'lar alohida ko'rinadi.

---

## 📊 Repository Statistics

Har bir repo uchun:

* Stars
* Forks
* Issues
* Pull Requests
* Contributors
* Languages
* Commits
* Releases
* Repository size
* Last update
* Branches
* Tags
* Commit activity

### Keyinchalik

```text
Contribution Graph

Mon Tue Wed Thu Fri Sat Sun
███ ████ ██  ████ █   ██  ███
```

va:

```text
Commits this year

Jan  ███████
Feb  ███████████
Mar  ████
Apr  ███████████████
...
```

---

## 🔐 GitHub Authentication

Buni GitHub OAuth orqali qilish juda mos.

Flow:

```text
Yolnoma
   ↓
Continue with GitHub
   ↓
GitHub OAuth
   ↓
User authorization
   ↓
Yolnoma
   ↓
GitHub API
   ↓
Repositories
```

GitHub plugin quyidagilarni ham qila oladi:

* Repository browser
* Issues
* Pull Requests
* Releases
* Commits
* Branches
* Tags
* Contributors
* Stars
* Watch status
* Favorite repositories
* Repository activity

---

# 🔊 7. AI Text-to-Speech

AI bilan text → voice.

### Oddiy

```text
Enter text...

"Hello, welcome to Yolnoma."

[ Generate Voice ]
```

### Future

* Multiple voices
* Languages
* Speed
* Pitch
* Voice preview
* Audio export
* MP3/WAV
* History
* Favorite voices
* Batch generation

Keyinchalik AI pluginlar uchun umumiy:

```text
AI Core
```

qilib, boshqa pluginlar ham undan foydalanishi mumkin.

---

# 🖥️ 8. Yolnoma Dashboard — CORE FEATURE

Dashboard maksimal foydali, lekin **minimal va yengil** bo'lishi kerak.

Dashboard foydalanuvchining kompyuterini real-time ko'rsatadi.

## System Overview

```text
┌─────────────────────────────────────────────┐
│ Yolnoma                                     │
│                                             │
│ SYSTEM                                      │
│                                             │
│ CPU                  GPU                    │
│ 34%                  27%                    │
│ ███████░░░░░         █████░░░░░             │
│                                             │
│ RAM                  DISK                   │
│ 8.2 / 16 GB         421 GB / 1 TB          │
│ ███████░░░░░         █████░░░░░             │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│ RECENT                                      │
│                                             │
│ 🎮 GTA V                  Launch             │
│ 🖼 Background Remover    Open               │
│ ⚡ Performance             Open              │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│ QUICK ACTIONS                               │
│                                             │
│ [ Screenshot ] [ Cleaner ] [ Steam ]        │
│ [ Performance ] [ Files ] [ Plugins ]      │
│                                             │
└─────────────────────────────────────────────┘
```

---

# ⚡ Dashboard optimizatsiyasi

Dashboardning o'zi kompyuterni zo'riqtirmasligi kerak.

Shuning uchun:

* Lightweight polling
* Keraksiz API call yo'q
* CPU/GPU monitoring faqat kerak bo'lganda
* Lazy loading
* Pluginlarni faqat kerak bo'lganda load qilish
* Heavy pluginlarni alohida processda ishlatish imkoniyati
* Cache
* Minimal background activity
* Tray mode
* Auto suspend
* Resource-aware monitoring

### Muhim prinsip

> Dashboard kompyuter resurslarini ko'rsatadi,
> lekin o'zi kompyuter resurslarini yeb qo'ymasligi kerak.

---

# 🧠 9. Universal Command Palette

Keyinchalik Yolnoma'da:

```text
Ctrl + K
```

bosiladi.

```text
╭──────────────────────────────────────╮
│ Search Yolnoma...                    │
├──────────────────────────────────────┤
│                                      │
│ 🔎 background remover                │
│ 🎮 launch GTA V                      │
│ ⚡ performance                       │
│ 📦 plugins                           │
│ 🐙 GitHub                            │
│ 📸 screenshot                        │
│ 🧹 clean cache                       │
│                                      │
╰──────────────────────────────────────╯
```

Bu barcha pluginlarni birlashtiradi.

Plugin o'rnatilganda uning commandlari ham Command Palette'ga avtomatik qo'shiladi.

---

# 🔌 10. Yakuniy Yolnoma Architecture

Uzoq muddatda:

```text
                    YOLNOMA
                       │
             ┌─────────┴─────────┐
             │                   │
         Yolnoma Core       Plugin Manager
             │                   │
             │             ┌─────┴─────┐
             │             │           │
             │          Install      Update
             │             │           │
             └─────────────┴───────────┘
                           │
                    Plugin Ecosystem
                           │
       ┌────────┬─────────┼────────┬──────────┐
       │        │         │        │          │
     Steam   GitHub    Images   System     AI
       │        │         │        │          │
   SteamIdler Git       Remover  Monitor    TTS
             Dashboard
```

---

# 🏆 Yakuniy Vision

Yolnoma oddiy:

> "bir nechta utility bor desktop app"

bo'lib qolmaydi.

U:

> **Windows uchun modular personal utility platform**

bo'ladi.

Foydalanuvchi faqat o'ziga kerakli narsalarni o'rnatadi:

```text
Yolnoma
│
├── Core
│
├── Plugins
│   ├── GitHub
│   ├── Steam
│   ├── Performance
│   ├── Background Remover
│   ├── RAR Explorer
│   ├── Pomodoro
│   ├── API Tester
│   ├── Stream
│   └── AI
│
└── Settings
```

Va eng muhim qoida:

> **Avval Core va Plugin System mukammal qilinadi.
> Keyin qolgan feature'lar asta-sekin plugin sifatida qo'shiladi.**

Shoshilmaymiz.

**Plugin System → Plugin Store → Core Dashboard → keyin ecosystem.**

Shu yo'l bilan Yolnoma kattalashgani sari og'irlashib ketmaydi.
