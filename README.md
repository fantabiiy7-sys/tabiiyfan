# Tabiiy fan — Science

5–6-sinflar uchun fanlararo integratsiya asosidagi o‘quv platformasi: dars ishlanmalari katalogi, interaktiv metodlar, virtual laboratoriyalar, animatsiyalar, testlar, **HTML Studio** va boshqaruv paneli. Interfeys: o‘zbek / rus / ingliz, yorug‘ va tungi mavzu.

> **Muhim:** platformadagi barcha materiallar **namunaviy (demo)** va `Namuna` belgisi bilan ajratilgan. Ular rasmiy o‘quv dasturi/darslik bilan solishtirilmagan va rasmiy tasdiqlanmagan. Mavzular ro‘yxati ham namunaviy (`is_verified = 0`).

## Tez ishga tushirish

Talab: **Node.js ≥ 22.13** (ichki `node:sqlite` ishlatiladi). Tashqi ma’lumotlar bazasi serveri kerak emas.

```bash
npm install                      # dev-bog‘liqliklar (typescript, esbuild, react, zod, prettier, highlight.js, acorn)
npm run build                    # web/dist va server/dist
ADMIN_EMAIL=siz@maktab.uz ADMIN_PASSWORD='kamida-10-belgi-1' npm run seed   # bazani yaratish + namunaviy kontent
PORT=3000 npm start              # http://localhost:3000
```

* `ADMIN_PASSWORD` berilmasa, tasodifiy parol **bir marta** konsolga chiqariladi — uni saqlab qo‘ying.
* `SEED_EXTRA_USERS=1` namunaviy muharrir va o‘qituvchi hisoblarini ham yaratadi (tasodifiy parollar, faqat sinov uchun).
* Seed faqat **bo‘sh** bazada ishlaydi; qayta boshlash uchun `data/app.db` ni o‘chiring.
* Kodda hech qanday parol/kalit yo‘q. Muhit o‘zgaruvchilari:

| O‘zgaruvchi | Ma’nosi | Standart |
|---|---|---|
| `PORT`, `HOST` | server porti / interfeysi | `3000`, `0.0.0.0` |
| `DATA_DIR` | baza va yuklangan fayllar papkasi | `./data` |
| `DB_FILE` | baza fayli | `$DATA_DIR/app.db` |
| `COOKIE_SECURE` | `1` — cookie faqat HTTPS orqali (**productionda majburiy**) | `0` |
| `TRUST_PROXY` | `1` — IP ni `X-Forwarded-For` dan olish (reverse proxy orqasida) | `0` |
| `LOGIN_RATE_MAX` | bir IP dan daqiqasiga login urinishlari | `10` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SEED_EXTRA_USERS` | faqat `npm run seed` uchun | — |

## Buyruqlar

| Buyruq | Vazifasi |
|---|---|
| `npm run build` | frontend (esbuild) + backend (tsc) |
| `npm test` | 12 ta backend integratsiya testi (auth, CSRF, RBAC, workflow, Studio xavfsizligi, media, test baholash, audit) |
| `npm run check:i18n` | 3 tildagi kalitlar mosligi va koddagi `t('…')` kalitlari lug‘atda borligini tekshiradi |
| `npm run check:web` | frontend TypeScript tekshiruvi |
| `npm run backup` | baza (VACUUM INTO) + yuklangan fayllar → `backups/<vaqt>/` |
| `npm run verify` | yuqoridagilarning hammasi |

## Tuzilma

```
server/src      Node http + TypeScript: API, auth, RBAC, sandbox/CSP, seed, testlar
web/src         React 19 + TSX: sahifalar, admin panel, HTML Studio, i18n lug‘atlari, CSS tokenlar
db/postgres     PostgreSQL 16 sxemasi + Row-Level Security (ishlab chiqarish nishoni)
docs            ARCHITECTURE, SECURITY, DEPLOY, STAGES
scripts         build-web, check-i18n, backup
```

## Rollar

`super_admin`, `republic_editor`, `regional_moderator`, `district_moderator`, `school_admin`, `teacher`, `student`, `guest`. Ruxsatlar matritsasi: `server/src/permissions.ts`; admin panelda “Rollar va ruxsatlar” sahifasida ko‘rinadi. Ruxsatlar **serverda har so‘rovda** tekshiriladi.

## Kontent ish jarayoni

`qoralama → ko‘rib chiqish → tasdiqlangan → nashr etilgan → arxiv`. Muallif, ko‘rib chiquvchi va tasdiqlovchi yoziladi, har o‘tish `content_reviews` va audit jurnaliga tushadi. “Tasdiqlangan” holati faqat tasdiqlash huquqi bor foydalanuvchi bergan materialga qo‘yiladi.

## Qo‘shimcha hujjatlar

[docs/STAGES.md](docs/STAGES.md) (bajarilgan/qolgan ishlar va taxminlar) · [docs/SECURITY.md](docs/SECURITY.md) · [docs/DEPLOY.md](docs/DEPLOY.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
