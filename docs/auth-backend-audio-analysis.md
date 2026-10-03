
## 6. AI chatni login talab qilmaydigan qilish

### Hozirgi koddagi muhim cheklovlar

Hozir `AiChatPage` ham `ProtectedLayout` ichidagi route hisoblanadi. Shuning uchun login bo‘lmagan user AI chat sahifasiga kira olmaydi.

Bundan tashqari, `src/features/ai/storage.ts`da `user?.id ?? ""` account identity sifatida ishlatiladi. Rust tarafidagi `src-tauri/src/domains/ai_chat.rs` esa bo‘sh user IDni rad etadi:

```text
%LOCALAPPDATA%/Yolnoma/accounts/{user_id}/ai-chat/sessions
```

Demak `user = null` holatida mavjud kod avtomatik ravishda `guest` folderga yozmaydi; aksincha `Invalid user id` qaytaradi. AI chatni guestga ochish uchun guest identity alohida, aniq va valid namespace sifatida qo‘shilishi kerak.

### Tavsiya qilinadigan local storage modeli

Guest chatlar uchun quyidagi yo‘l mos:

```text
%LOCALAPPDATA%/Yolnoma/guest/ai-chat/sessions/{session-id}.json
%LOCALAPPDATA%/Yolnoma/accounts/{supabase-user-id}/ai-chat/sessions/{session-id}.json
```

Rust APIga oddiy `user_id` emas, masalan `ChatOwner`/`StorageScope` tushunchasini kiritish xavfsizroq:

- `Guest` → faqat literal `guest` namespace;
- `Account { user_id }` → faqat serverdan olingan va UUID formatida valid user ID;
- arbitrary path yoki frontend yuborgan `../../...` qiymatlari rad etiladi.

Minimal variantda `guest`ni allowlistga qo‘shish mumkin, lekin `guest` stringini oddiy user ID sifatida qabul qilish kelajakda account storage bilan chalkashmasligi uchun alohida scope modeli yaxshiroq.

### Guestdan login qilinganga migration

Eng muhim UX va data-loss masalasi shu. User guest sifatida bir nechta chat yaratib, keyin login qilsa:

1. Guest sessionlar ro‘yxati ko‘rsatiladi.
2. Userga `Guest chatlarni accountga ko‘chirish` yoki `Faqat yangi account storage ishlatish` tanlovi beriladi.
3. Ko‘chirish atomic tarzda bajariladi: avval yangi account folderga copy, checksum/parse tekshiruvi, keyin guest faylini o‘chirish.
4. Bir xil ID collision bo‘lsa yangi ID beriladi.
5. Migration muvaffaqiyatsiz bo‘lsa guest chat o‘chirilmaydi.
6. Logoutdan keyin account chatlari guest folderga ko‘chirilmaydi va ko‘rinmaydi.

Agar guest chatlarni hech qachon accountga qo‘shmaslik qarori qilinsa, buni UI’da aniq yozish kerak; aks holda user chatlari “login qilgandan keyin yo‘qolgan” deb qabul qiladi.

### Session ID va URL xavfsizligi

Chat session ID URLdagi `?sessionId=...` orqali ishlatilmoqda. ID random bo‘lishi yaxshi, lekin guest scope bilan birga tekshirish shart:

- guest session faqat guest directorydan o‘qilsin;
- authenticated user guest yoki boshqa user directorysiga kira olmasin;
- session ID faqat 32 hex belgidan iborat bo‘lsin;
- URLga chat matni, API key yoki token yozilmasin;
- chat title va message uzunligiga limit qo‘yilsin;
- JSON file o‘qish/yozish atomic va corruption-safe bo‘lsin.

### Guest API key masalasi

AI requestlar bu branchda to‘g‘ridan-to‘g‘ri Supabase orqali emas, Tauri `proxy_request` orqali OpenRouterga yuboriladi. OpenRouter API key accountga bog‘langan encrypted storage’da saqlanadi. Hozir `getApiKey("")` `null` qaytaradi va `saveApiKey("")` hech narsa saqlamaydi.

Shu sababli guest AI uchun alohida siyosat kerak:

- **Eng xavfsiz variant:** guest user o‘z OpenRouter keyini kiritadi; key `guest` scope’da encrypted saqlanadi yoki faqat current session memory’da turadi.
- **Markaziy Yolnoma keyi:** keyni client binary/source ichiga qo‘ymaslik; backend proxy orqali server-side secret bilan ishlatish, per-device/per-IP quota va abuse protection qo‘shish.
- **Keyni localStoragega yozmaslik:** hozirgi Tauri encrypted storage mexanizmini guest namespace bilan kengaytirish.
- Logoutdan keyin boshqa userning API keyi guest scope orqali tasodifan ko‘rinmasligi uchun login/logout transition testlari bo‘lishi kerak.

Markaziy API key bilan guest AI ochilsa, loginni olib tashlash server xarajatini kamaytirmaydi; aksincha anonim traffic server/OpenRouter quota va billingni tez tugatishi mumkin. Shuning uchun model allowlist, max token, request size, image size, concurrency va per-device quota shart.

### Supabase bilan chegarani to‘g‘ri ajratish

Client kodida Supabase SDK bilan to‘g‘ridan-to‘g‘ri ishlash ko‘rinmadi; `saved-videos` kabi endpointlar backend orqali Supabase `savev` ma’lumotlariga murojaat qiladi. Login qilganda asosan quyidagi authenticated operatsiyalar saqlanadi:

- Supabase user identity va account ID;
- saved videos;
- profile va role;
- session management;
- account-specific settings;
- server-side RLS/authorization konteksti.

AI chatning local JSON historysi esa Supabase ma’lumoti emas. Uni guest folderga yozish Supabase authni o‘chirib qo‘ymaydi; faqat local AI history uchun login dependencyni olib tashlaydi. Agar keyinchalik AI chatlarni cloud sync qilish rejalashtirilsa, guest uchun anonim identity, ownership transfer, RLS policy, delete/export va retention siyosati alohida ishlab chiqilishi kerak.

### Route va component migration checklist

AI guest mode uchun quyidagilarni o‘zgartirish kerak:

1. AI chat route’ni barcha app uchun ochish, lekin admin/agent va code-writing funksiyalarini alohida guardda qoldirish.
2. `AiChatPage`dagi `if (!userId) return` oqimini guest scope bilan almashtirish.
3. `create/load/save/delete` Tauri commandlariga guest/account scope qo‘shish.
4. `AiAgentPage`, `ReadmeGeneratorTool` va `DatabaseGenWorkspace`ni AI chatdan alohida baholash: ular filesystem write, source-code generation yoki project access qilgani uchun guestga avtomatik ochilmasin.
5. Sidebar/Navbar’da user null holatida AI chat ko‘rinsin, profile/saved/session tugmalari esa login CTA ko‘rsatsin.
6. Guest → login migration va logout isolation testlarini qo‘shish.
7. Backend/OpenRouter proxy uchun quota, rate limit, abuse log va cost monitoring qo‘shish.

### Yakuniy tavsiya

AI chatni login talab qilmaydigan qilish mumkin va bu arxitektura jihatidan mantiqli. Lekin `guest`ni shunchaki `userId = ""` qilib qo‘yish noto‘g‘ri. `guest` alohida storage scope, alohida API-key policy, guest-to-account migration va qat’iy route/feature guardlar bilan amalga oshirilishi kerak. Login qilinganda Supabase bilan bog‘liq user data va server-side permissions ishlashi davom etadi; local AI history esa migration tanlovi asosida account folderga ko‘chiriladi.
