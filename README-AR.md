# RS Store — التشغيل والنشر

المشروع يحتوي على واجهة React/Vite وخلفية Node/Express وقاعدة PostgreSQL عبر Prisma. الملفات الجديدة تُخزّن في Cloudflare R2، مع دعم مؤقت لملفات Supabase Storage القديمة.

## التشغيل محليًا

1. ثبّت Node.js 20 أو أحدث.
2. انسخ `.env.example` إلى `.env` واملأ القيم الحقيقية محليًا فقط.
3. نفّذ:

```powershell
npm install --include=dev
npm --prefix frontend install --include=dev
npm run db:deploy
npm run storage:setup
npm run seed
```

4. شغّل نافذتين:

```powershell
npm run dev
```

```powershell
npm --prefix frontend run dev
```

الواجهة: `http://localhost:5173` والخلفية: `http://localhost:4000`.

## تسجيل الدخول عبر Google

1. افتح Google Cloud Console وأنشئ OAuth Client من نوع Web application.
2. أضف روابط موقعك إلى Authorized JavaScript origins، مثل `https://rsgames.vercel.app`.
3. أضف `http://localhost:5173` للاختبار المحلي.
4. ضع Client ID نفسه في `GOOGLE_CLIENT_ID` و`VITE_GOOGLE_CLIENT_ID` داخل Vercel.

السيرفر يتحقق من توقيع Google ومن الجمهور وتاريخ انتهاء الرمز قبل إنشاء الجلسة.

## كود التحقق عبر البريد

التطبيق يستخدم Resend. أنشئ حسابًا مجانيًا، تحقّق من نطاقك، ثم أضف:

- `RESEND_API_KEY`
- `EMAIL_FROM` مثل `RS Store <noreply@your-domain.com>`

لا تضع مفتاح Resend في متغير يبدأ بـ `VITE_`.

## Cloudflare R2

1. أنشئ Bucket خاصًا باسم `private-uploads` وآخر عامًا باسم `public-assets`.
2. أنشئ R2 API Token بصلاحية Object Read & Write على هذين الـBucket.
3. اربط نطاقًا عامًا مع `public-assets` وضع رابطه في `R2_PUBLIC_URL`.
4. أضف متغيرات R2 الموجودة في `.env.example` إلى Vercel.
5. يمكن التحقق من الحاويات محليًا عبر `npm run storage:setup`.

## النشر على Vercel

- Root Directory: `./`
- Framework Preset: `Other`
- Install Command: اتركه فارغًا ليقرأ `vercel.json`
- Build Command: اتركه فارغًا ليقرأ `vercel.json`
- Output Directory: اتركه فارغًا

أضف المتغيرات في Settings > Environment Variables ثم نفّذ Redeploy. أمر البناء يطبّق migrations ويولّد Prisma Client ويبني الواجهة.

## الأمان

- لا ترفع `.env` إلى GitHub.
- بدّل فورًا أي مفتاح Supabase أو كلمة مرور قاعدة بيانات ظهرت سابقًا في GitHub أو المحادثات.
- استخدم أسرارًا مختلفة لـ `JWT_SECRET` و`CODE_ENCRYPTION_KEY` و`CRON_SECRET`.
- افحص `/api/health` بعد النشر للتأكد من اتصال PostgreSQL.
