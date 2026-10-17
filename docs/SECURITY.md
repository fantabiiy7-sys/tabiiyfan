# Xavfsizlik

## Autentifikatsiya va sessiyalar
* Parol: `scrypt` (tasodifiy tuz), kamida 10 belgi, harf + raqam.
* Sessiya serverda saqlanadi (token **sha256 xeshi** bazada), cookie `tf_session`: `HttpOnly`, `SameSite=Lax`, productionda `Secure` (`COOKIE_SECURE=1`), muddati 12 soat.
* 5 ta xato urinishdan so‘ng hisob 15 daqiqaga bloklanadi; login uchun IP bo‘yicha rate limit; umumiy API uchun 600/daq/IP.
* O‘z-o‘zidan ro‘yxatdan o‘tish yo‘q: hisoblarni administrator yaratadi.
* **CSRF:** barcha o‘zgartiruvchi so‘rovlar `X-CSRF-Token` (sessiyaga bog‘langan) va `Origin` tekshiruvidan o‘tadi.

## Ruxsatlar (RBAC)
Har API yo‘lida `requireActor(permission)`. Interfeysdagi tugmalarni yashirish xavfsizlik chorasi emas, faqat qulaylik. Foydalanuvchilarni boshqarishda foydalanuvchi o‘zidan yuqori yoki teng rolni bera olmaydi; o‘zini bloklay yoki rolini o‘zgartira olmaydi. Mavzuning “rasmiy dasturga mos” belgisini faqat tasdiqlash huquqi bor rol qo‘yadi.

## HTML Studio (ishonchsiz kod)
Foydalanuvchi kodi **hech qachon serverda bajarilmaydi**.
* Preview/nashr etilgan material `sandbox="allow-scripts"` iframe ichida (`allow-same-origin` **yo‘q**) — cookie, localStorage va sayt DOM iga kira olmaydi.
* Alohida manzildan (`/embed/…`) beriladigan hujjat o‘z **CSP** sarlavhasi bilan keladi: `default-src 'none'`, `connect-src 'none'`, `form-action 'none'`, `frame-src 'none'`, `base-uri 'none'`; skript/rasm/media faqat administrator ruxsat bergan https domenlaridan.
* Nashr etishdan oldin statik skaner: tashqi skript, `iframe/object/embed`, `form action`, `meta refresh`, `<base>`, tashqi `@import`, dinamik `import()` — **bloklaydi** (HTTP 422); `eval`, tarmoq chaqiruvlari, inline handler — **ogohlantiradi**.
* Preview kodi serverda faqat 10 daqiqaga, egasi uchun saqlanadi (bajarilmaydi).
* Loyiha egasi yoki tasdiqlash huquqi bor rolgina loyihani ko‘radi/o‘zgartiradi; nashr alohida `studio.publish` ruxsati.
* **Cheklov:** vizual “Test” blokidagi to‘g‘ri javob sahifa kodida bo‘ladi (client-side). Rasmiy baholash uchun serverda tekshiriladigan “Test va topshiriqlar” bo‘limidan foydalaning.

## Fayl yuklash
Ruxsat etilgan turlar ro‘yxati, **magic-byte** tekshiruvi (kengaytma/Content-Type yolg‘on bo‘lsa rad etiladi), 10 MB limit, tasodifiy saqlash nomi, SVG’da skript/handler taqiqlangan, `nosniff` + sandbox CSP bilan beriladi, yuklash uchun rate limit.

## Test baholash
To‘g‘ri javoblar mijozga hech qachon yuborilmaydi; natija serverda hisoblanadi.

## Ma’lumotlar bazasi
SQL so‘rovlari parametrlangan (satrlarni birlashtirish yo‘q); qidiruv SQL-injection sinovidan o‘tgan. `db/postgres/schema.sql` — PostgreSQL uchun RLS siyosatlari (mehmon faqat nashr etilganini ko‘radi, muallif o‘zinikini, audit jurnali o‘zgarmas). RLS siyosatlari `psql` da sinovdan o‘tkazilgan, lekin ilova hozircha PostgreSQL’ga ulanmagan.

## Sarlavhalar
Sayt: `Content-Security-Policy` (`script-src 'self'`), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy`. Xeshlangan statik fayllar uzoq keshlanadi, HTML — yo‘q.

## Audit
Kirish, kontent o‘zgarishlari, holat o‘tishlari, Studio, media, foydalanuvchi/rol, sozlama va eksport harakatlari `audit_logs` ga yoziladi (admin panel → “Audit jurnali”). Parollar va maxfiy qiymatlar yozilmaydi.

## Ma’lum cheklovlar (halol ro‘yxat)
* Rate limit va bloklash xotirada (bitta server jarayoni uchun). Ko‘p nusxali joylashtirishda umumiy saqlash (Redis/PostgreSQL) kerak.
* MFA yo‘q; parolni tiklash (email orqali) yo‘q — administrator yangi parol beradi.
* Antivirus skaneri yo‘q (faqat tur/mazmun tekshiruvi).
* Tashqi penetratsion test o‘tkazilmagan.
