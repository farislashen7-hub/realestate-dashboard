# لوحة إدارة الوسيط العقاري — Next.js

## تشغيل
```bash
npm install
cp .env.local.example .env.local   # حط رابط webhook بتاع "Dashboard: Data API" في n8n
npm run dev
```
افتح http://localhost:3000

## البنية
- `app/page.js` — الداشبورد كله (تبويبات، فلاتر، جداول، charts). كومبوننت واحد client-side، بيجيب البيانات من `/api/dashboard-data`.
- `app/api/dashboard-data/route.js` — proxy سيرفر-سايد لـ webhook n8n (بيحل مشكلة CORS ويخفي الرابط الداخلي عن المتصفح).
- `app/globals.css` — نفس تصميم النسخة الأصلية HTML بالظبط (نفس الألوان/الخطوط/الكروت).
- `.env.local.example` — انسخه لـ `.env.local` وحط فيه `N8N_DASHBOARD_URL`.

## Deploy
أي استضافة Next.js عادية (Vercel، Node server، إلخ). لازم يبقى env var `N8N_DASHBOARD_URL` متظبط في بيئة الإنتاج برضو.
