# Joylashtirish (deploy)

## 1. Bitta server (tavsiya etilgan boshlanish)
1. Node.js ≥ 22.13 o‘rnating. Kodni nusxalang: `npm install && npm run build`.
2. Alohida tizim foydalanuvchisi yarating; `DATA_DIR=/var/lib/tabiiy-fan` (faqat shu foydalanuvchiga yozish huquqi).
3. Birinchi marta: `ADMIN_EMAIL=… ADMIN_PASSWORD=… DATA_DIR=… npm run seed`.
   **Production uchun:** namunaviy kontent kerak bo‘lmasa, kirgach admin paneldan “Namunaviy” belgili materiallarni o‘chiring (Dashboard sonini ko‘rsatadi) va “Sozlamalar”da demo bannerni o‘chiring.
4. systemd xizmati (misol):
   ```ini
   [Service]
   User=tabiiy
   Environment=NODE_ENV=production PORT=3000 HOST=127.0.0.1 DATA_DIR=/var/lib/tabiiy-fan COOKIE_SECURE=1 TRUST_PROXY=1
   WorkingDirectory=/opt/tabiiy-fan
   ExecStart=/usr/bin/node --no-warnings server/dist/index.js
   Restart=on-failure
   NoNewPrivileges=true
   ```
5. Reverse proxy (nginx/Caddy) HTTPS bilan: `proxy_set_header X-Forwarded-For $remote_addr;`, `client_max_body_size 11m;`. **HTTPS bo‘lmasa `COOKIE_SECURE=1` ishlamaydi** — HTTPS’ni majburiy qiling.
6. Sirlar (parollar) repozitoriyga tushmasin: `.env` `.gitignore` da; xizmat sozlamalari orqali bering.

## 2. Zaxira va tiklash
* `npm run backup` (cron: kuniga 1 marta) → `backups/<vaqt>/app.db` + `uploads/`. Zaxirani serverdan tashqariga ko‘chiring.
* Tiklash: xizmatni to‘xtating → `app.db` va `uploads/` ni `DATA_DIR` ga qaytaring → ishga tushiring.
* Kontent JSON eksporti: admin panel → “Zaxira va eksport” (parol xeshlari va sessiyalarsiz; to‘liq zaxira o‘rnini bosmaydi).

## 3. Yangilash
`git pull && npm install && npm run build` → xizmatni qayta ishga tushiring. Sxema `CREATE TABLE IF NOT EXISTS` bilan; sxema o‘zgargan versiyalarda migratsiya qaydi CHANGELOG’da bo‘lishi kerak (hozircha migratsiya tizimi yo‘q — **ochiq vazifa**).

## 4. Kengaytirish (PostgreSQL’ga o‘tish)
Maqsad: ko‘p foydalanuvchi, ko‘p nusxali server, RLS.
1. `db/postgres/schema.sql` ni `psql` bilan qo‘llang (rol `tf_app` yaratiladi).
2. Ilovadagi `server/src/db.ts` (`all/get/run/tx`) ni PostgreSQL drayveri (`pg`) ustiga qayta yozing: so‘rovlarda `?` → `$1…`, `datetime('now')` → `now()`, `INTEGER` mantiqiy maydonlar → `boolean`.
3. Har tranzaksiya boshida `set_config('app.user_id', …, true)` va `set_config('app.role', …, true)` chaqiring (RLS shunga tayanadi).
4. Rate limit va sessiya keshini umumiy saqlashga ko‘chiring.
5. Yuklangan fayllarni obyekt saqlashga (S3-mos) o‘tkazing.
Bu ish hali **bajarilmagan**; sxema va RLS tayyor va sinalgan.

## 5. Production oldi tekshiruv ro‘yxati
- [ ] HTTPS va `COOKIE_SECURE=1`
- [ ] Standart/seed parollari almashtirilgan, `SEED_EXTRA_USERS` ishlatilmagan
- [ ] Namunaviy materiallar o‘chirilgan yoki tasdiqdan o‘tgan; mavzular rasmiy dastur bilan solishtirib `verified` qilingan
- [ ] Studio uchun ruxsat etilgan domenlar ro‘yxati minimal
- [ ] Zaxira jadvali va tiklash sinovdan o‘tgan
- [ ] Tashqi xavfsizlik auditi (ayniqsa Studio sandboxi)
