# Arxitektura (qisqa)

Muhit cheklovi: dastlabki qurish muhitida npm registry yopiq edi, shuning uchun tashqi paketlarsiz, mavjud vositalar (Node 22, TypeScript, React 19, esbuild, prettier, highlight.js, DOMPurify) bilan qurildi.

- `server/` — Node `http` + TypeScript. Ma'lumotlar bazasi: `node:sqlite` (ishlaydigan dev/kichik o'rnatish). Parollar scrypt bilan, sessiyalar server tomonda, RBAC har bir API so'rovida tekshiriladi, audit jurnali.
- `db/postgres/` — ishlab chiqarish uchun PostgreSQL sxemasi va RLS siyosatlari (hozircha ulanmagan, taxmin sifatida belgilangan).
- `web/` — React 19 + TSX, esbuild bilan yig'iladi, qo'lda yozilgan CSS dizayn tizimi (tokenlar).
- HTML Studio preview — sandboxlangan iframe + CSP, kod serverda bajarilmaydi.
