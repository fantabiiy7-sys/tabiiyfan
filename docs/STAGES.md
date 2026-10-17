# Bosqichlar bo‘yicha hisobot

Texnik vazifada 6 bosqich belgilangan edi. Quyida har bosqichda **nima bajarilgani**, **nima qolgani** va **qabul qilingan taxminlar**.

## 1-bosqich — Arxitektura, ma’lumotlar modeli, xavfsizlik asosi ✅
**Bajarildi:** universal kontent modeli (8 tur, 3 til, holat va versiyalar), 8 rol × 26 ruxsat matritsasi, scrypt + server sessiyalari + CSRF + lockout + rate limit, audit jurnali, PostgreSQL sxemasi va RLS (psql’da sinalgan), arxitektura hujjati.
**Qolgan:** ilovani PostgreSQL drayveriga o‘tkazish (sxema tayyor); sxema migratsiyalari tizimi; Redis/umumiy rate-limit.
**Taxmin:** muhitda npm registri yopiq edi → tashqi kutubxonalarsiz (Node `http`, `node:sqlite`, qo‘lda router/i18n) qurildi. Supabase tanlovi sizga qoldirilgan edi; hozirgi yechim Supabase’ga bog‘liq emas.

## 2-bosqich — Dizayn tizimi va navigatsiya ✅
**Bajarildi:** CSS tokenlar (yorug‘/tungi), 13 bandli chap menyu (accordion, mobil drawer, DB’dan boshqariladi), yuqori panel (qidiruv, til, mavzu, profil, bildirishnoma), yuklanish/bo‘sh/xato holatlari, klaviatura fokus, `skip-link`, 4.5:1 kontrast tekshiruvi (admin brend ranglari serverda ham tekshiriladi).
**Qolgan:** avtomatlashtirilgan (axe) auditi va ekran o‘qish dasturlari bilan qo‘lda sinov; tashqi shriftlar yo‘q (tizim shrifti).

## 3-bosqich — Ommaviy sahifalar va kontent ✅
**Bajarildi:** bosh sahifa, 8 turdagi katalog (sinf, mavzu, bo‘lim, fan, dars turi, metod, format, kalit so‘z filtrlari), 20 bo‘limli dars sahifasi (chop etish/PDF — brauzer orqali, tahrirlash tarixi, oxirgi yangilanish), 12 interaktiv metod, mavzular, integratsiya, qidiruv, test (server tomonda baholanadi), o‘qituvchilar/qo‘llanmalar/loyiha haqida. 6 ta namunaviy dars, 12 metod, 4 interaktiv model (3 tilda), 2 test.
**Qolgan:** Word (.docx) eksport (spetsifikatsiyada keyingi bosqich); dars matnlari faqat o‘zbek tilida (RU/EN uchun sarlavha va qisqacha mazmun bor); haqiqiy rasmiy mavzular ro‘yxati.
**Taxmin:** 20 bo‘lim nomlari spetsifikatsiyada alohida berilmagani uchun metodik odatga ko‘ra tuzildi (`lesson.sec.s1…s20`) — `Tarjimalar` sahifasidan o‘zgartiriladi.

## 4-bosqich — HTML Studio ✅
**Bajarildi:** kod muharriri (HTML/CSS/JS, rangli sintaksis, qator raqamlari, undo/redo, formatlash — prettier, JS/CSS sintaksis xatolari — acorn/postcss, ish vaqti xatolari konsoli), jonli preview (sandbox iframe, kompyuter/planshet/telefon, to‘liq ekran), avtosaqlash (oxirgi 20) + qo‘lda versiyalar va tiklash, qoralama/nashr, materialga biriktirish, **vizual bloklar** (sarlavha, matn, rasm, video, HTML, test, animatsiya, fayl havolasi, jadval, 2 ustun) → HTML/CSS/JS kompilyatsiyasi, xavfsizlik skaneri.
**Qolgan:** blokli rejimdan kodga o‘tish bir tomonlama; “Fayl” bloki faqat https havola (yuklangan faylni to‘g‘ridan-to‘g‘ri biriktirib bo‘lmaydi: sandbox o‘z saytingiz fayllariga kira olmaydi — kichik rasmlar kodga joylanadi); bloklar uchun sudrab-tashlash (hozir yuqoriga/pastga tugmalari).

## 5-bosqich — Boshqaruv paneli ✅ (qisman)
**Bajarildi:** dashboard, kontent CRUD (uch til tabi, bo‘limlar, media kiritish, ish jarayoni tugmalari, ko‘rib chiqish jurnali, versiyalar), moderatsiya navbati, mavzu/fanlar, foydalanuvchilar va rollar matritsasi, tarjimalar (interfeys matnlarini tahrirlash), media kutubxona (alt matn, tur/hajm/magic-byte tekshiruvi), sozlamalar (nomlar, standart til, demo banner, brend ranglar, Studio domenlari), bosh sahifa va yangiliklar, menyu, audit, versiyalar tarixi, zaxira/eksport.
**Qolgan:** spetsifikatsiyadagi 24 bo‘limning bir qismi alohida sahifa emas (masalan, viloyat/tuman/maktab boshqaruvi, statistika/hisobotlar, xatolar jurnali sahifasi, bildirishnoma sozlamalari): jadvallar bor, interfeysi yo‘q. Rollarning hammasi UI orqali sinalmagan (admin to‘liq; o‘qituvchi/muharrir API testlarida).
**Taxmin:** `teacher`, `student`, `guest`, `school_admin` rollari hozir faqat ko‘rish huquqiga ega (admin panelga kira olmaydi); muharrir/moderator rollari kontent yaratadi. Bu `server/src/permissions.ts` da bitta joydan o‘zgartiriladi.

## 6-bosqich — Sinov, hujjatlar, joylashtirish ✅ (qisman)
**Bajarildi:** 12 backend integratsiya testi (hammasi o‘tadi), i18n mosligi tekshiruvi (637 kalit × 3 til), frontend TypeScript tekshiruvi, Chromium’da qo‘lda sinov (bosh sahifa/katalog/dars/Studio/admin; 3 til; yorug‘/tungi; mobil), README, SECURITY, DEPLOY, zaxira skripti.
**Qolgan:** frontend avtomatik (e2e) testlari repozitoriyaga kiritilmagan; yuklama sinovi; tashqi xavfsizlik auditi; real foydalanuvchilar bilan foydalanish sinovi; `@types/react` o‘rnatilgach `web/src/react-shim.d.ts` ni o‘chirib, qat’iy tip tekshiruviga o‘tish.

## Umumiy halol xulosa
* Ma’lumotlar bazasi: **SQLite (`node:sqlite`)**, PostgreSQL emas. PostgreSQL sxemasi/RLS tayyor va sinalgan, lekin ilova unga ulanmagan.
* Barcha materiallar — **namunaviy**; rasmiy tasdiq, statistika yoki me’yoriy havolalar o‘ylab topilmagan. Raqamli faktlar (masalan, suvning 97%/3% taqsimoti) yaxlitlangan va dars ichidagi izohda ko‘rsatilgan — nashrdan oldin mutaxassis tekshirishi kerak.
* Autentifikatsiya haqiqiy (server sessiyalari, parol xeshi); demo-kirish yo‘q.
