# RS Store — النسخة النهائية لـ Vercel وSupabase

المشروع يحتوي على واجهة React/Vite وخلفية Node.js/Express وقاعدة PostgreSQL عبر Prisma، مع تخزين الملفات في Supabase Storage.

## المتطلبات

- Node.js 20 أو أحدث.
- حساب Vercel مجاني.
- مشروع Supabase مجاني.

## التشغيل المحلي

1. انسخ `.env.example` إلى `.env` واملأ القيم.
2. ثبّت الاعتماديات:

```powershell
npm install
npm --prefix frontend install
```

3. أنشئ الجداول وحاويات التخزين والبيانات الأولية:

```powershell
npm run db:deploy
npm run storage:setup
npm run seed
```

4. شغّل الخلفية والواجهة في نافذتين:

```powershell
npm run dev
npm --prefix frontend run dev
```

الواجهة: `http://localhost:5173` — API: `http://localhost:4000`.

## تجهيز Supabase

- أنشئ مشروعًا جديدًا.
- من **Connect** انسخ رابط Transaction Pooler وضعه في `DATABASE_URL` للتشغيل على Vercel، وأضف `pgbouncer=true&connection_limit=1&sslmode=require`.
- انسخ رابط Direct connection وضعه في `DIRECT_URL` لتشغيل migrations بأمان.
- من **Project Settings > API** انسخ Project URL إلى `SUPABASE_URL` وService Role Secret إلى `SUPABASE_SERVICE_ROLE_KEY`.
- لا تضع Service Role Secret في متغير يبدأ بـ `VITE_` ولا تشاركه داخل الواجهة.
- شغّل `npm run storage:setup` مرة واحدة لإنشاء `private-uploads` و`public-assets`.

## الرفع على Vercel

1. ارفع محتويات هذا المجلد إلى مستودع GitHub.
2. في Vercel اختر **Add New > Project** واستورد المستودع.
3. اترك Root Directory على جذر المشروع؛ ملف `vercel.json` يضبط البناء تلقائيًا.
4. أضف جميع متغيرات `.env.example` في **Settings > Environment Variables**.
5. قبل أول نشر شغّل محليًا مع بيانات Supabase الحقيقية:

```powershell
npm run db:deploy
npm run storage:setup
npm run seed
```

6. اضغط Deploy. بعد ظهور الرابط حدّث `CLIENT_ORIGIN` إلى رابط Vercel وأعد النشر.

## التنفيذ التلقائي عبر API على Vercel

الدوال على Vercel لا تعمل كخدمة دائمة، لذلك أُضيف مسار `/api/cron/fulfillments` محمي بـ `CRON_SECRET`، ومعه Cron يومي في `vercel.json` (حد خطة Hobby مرة يوميًا). أضف `CRON_SECRET` في متغيرات Vercel. للتنفيذ الأسرع استخدم خطة Pro أو استضافة منفصلة للخلفية.

## الفحوصات

```powershell
npm run check
npm audit --omit=dev
npm --prefix frontend audit
```

ملاحظة: لا ترفع `.env` أو `node_modules`. الحد الأقصى للملف المرفوع مباشرة هو 4MB.
