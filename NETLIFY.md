# Netlify'ga joylash (demo, faqat ko'rish rejimi)

1. Loyihani GitHub'ga yuklang (`netlify.toml` tayyor).
2. Netlify → **Add new site → Import from Git** → repozitoriyni tanlang. Sozlamalarga tegmang, hammasi `netlify.toml` da.
3. Deploy tugagach sayt ochiladi.

Cheklov: baza deploy bilan birga keladi, saytdan turib o'zgartirib bo'lmaydi (login/admin o'chirilgan; testlarni tekshirish ishlaydi).

O'z kontentingiz bilan chiqarish: kompyuterda `npm start` bilan admin paneldan tahrirlang →
`data/app.db` ni `netlify/snapshot/app.db` ga, `data/uploads/` ni `netlify/snapshot/uploads/` ga nusxalang → commit → Netlify qayta deploy qiladi.

Xato: funksiya logida `No such built-in module: node:sqlite` chiqsa — Netlify → Site configuration → Environment variables ga
`AWS_LAMBDA_JS_RUNTIME = nodejs22.x` qo'shib qayta deploy qiling.
