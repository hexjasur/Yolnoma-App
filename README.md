# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Dashboard weather

Dashboard’dagi haftalik ob-havo **Open-Meteo** servisidan foydalanadi. Ushbu servis uchun API key talab qilinmaydi, shuning uchun `.env` fayliga yoki ilova sozlamalariga hech qanday maxfiy kalit kiritish shart emas.

Ilova ishga tushganda Toshkent uchun prognoz ko‘rsatiladi. Aniq joriy joylashuvni olish uchun dashboard’dagi **Joylashuvim** tugmasini bosing va operatsion tizimning geolokatsiya ruxsatini bering. Ruxsat berilmasa, ilova Toshkent prognoziga qaytadi. Weather so‘rovlari internet ulanishini talab qiladi.

## Utility workspaces

**File Intelligence** bitta workspace ichida papka skaneri, katta fayllar ro‘yxati, content hash asosidagi duplicate finder va bo‘sh papkalarni ko‘rsatadi. Skan lokal bajariladi; `node_modules`, `.git`, `target`, `dist` va `build` kataloglari tezlik va xavfsizlik uchun chetlab o‘tiladi.

**Developer Tools** ichida JSON formatter/validator, JWT decoder, UUID generator, real-time Markdown preview, color picker va QR generator mavjud. JWT tokenlar faqat lokal decode qilinadi va signature tekshiruvi bajarilmaydi. QR rasmni tayyorlash uchun QRServer public endpoint ishlatiladi.
