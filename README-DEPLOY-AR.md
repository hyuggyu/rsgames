# رفع RS Store على Vercel (خطوة بخطوة)

## 0) المتطلبات
- حساب GitHub وحساب Vercel وحساب Supabase (مشروع في أوروبا).
- Node.js 20+ على جهازك، وVPN مطفأ أثناء أوامر قاعدة البيانات.

## 1) جهّز `.env` على جهازك (للاختبار المحلي والـ seed)
انسخ `.env.example` إلى `.env` واملأه. لا ترفع `.env` إلى GitHub أبداً (مستثنى في `.gitignore`).
- `DATABASE_URL` و`DIRECT_URL`: من Supabase ثم Connect (Transaction pooler للأول 6543، Session pooler للثاني 5432). كلمة المرور بأحرف وأرقام فقط. أبقِ `uselibpqcompat=true` في الرابطين.
- الأسرار الثلاثة: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` ثلاث مرات.
- `ADMIN_EMAIL` بريد وهمي مثل `admin@rs-store.local`، و`ADMIN_PASSWORD` كلمة مؤقتة عشوائية (12 حرفاً فأكثر). ستُجبَر على تغييرها عند أول دخول.
- `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY`، وأنشئ في Storage: `private-uploads` (خاص) و`public-assets` (عام).

## 2) اختبر محلياً
```
npm install
npm run db:deploy
npm run seed
npm run build:web
npm start
```
افتح http://localhost:4000/api/health ثم http://localhost:4000/admin.

## 3) ارفع إلى GitHub (مستودع Private)
```
git add .
git commit -m "RS Store"
git push
```

## 4) أنشئ المشروع في Vercel
Add New > Project > اختر المستودع.
- Framework Preset: Other
- Root Directory: ./
- اترك Build/Install/Output فارغة (تُقرأ من vercel.json).

## 5) أضف Environment Variables (قبل Deploy)
`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CODE_ENCRYPTION_KEY`, `CRON_SECRET`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PRIVATE_BUCKET`, `SUPABASE_PUBLIC_BUCKET`,
`WEB_ROOT=public`, `CLIENT_ORIGIN=https://رابط-موقعك` (بدون / في آخره).
لا تضف `ADMIN_PASSWORD` هنا.

## 6) Deploy
البناء يطبّق الـ migrations ثم يبني الواجهة. بعد النجاح صحّح `CLIENT_ORIGIN` برابطك الفعلي ثم Redeploy.

## 7) أنشئ حساب المدير (مرة واحدة من جهازك)
```
npm run seed
```
## 8) تحقق
- /api/health يعطي JSON فيه ok.
- /admin: ادخل بالبريد والكلمة المؤقتة وستظهر شاشة تغيير كلمة المرور.

## ملاحظات
- المراقبة التلقائية (مؤقتات الطلبات والمخزون) لا تعمل على Vercel؛ يبقى الـ cron اليومي فقط.
- البريد (RESEND_API_KEY أو SMTP) غير مضبوط افتراضياً: تأكيد البريد واستعادة كلمة المرور لن تعمل حتى تضبطه.
- إن فشل البناء عند خطوة migrate فافتح سجل البناء، وبديلها تشغيل `npm run db:deploy` من جهازك ثم Redeploy.


## Admin entry code
Set `ADMIN_SETUP_CODE=1234` in Vercel Environment Variables and redeploy. The code is requested only before the first admin account is saved; after the database records setup, the code screen disappears and future visits show email/password login. The setup API rejects a second account-setup request. A fixed four-digit code is weak; use a long random value before exposing the site publicly.

## إصلاح خطأ 404 على /api/auth/register و/api/auth/login
- كل طلبات `/api/*` تُحوَّل الآن عبر `vercel.json` إلى دالة واحدة `api/index.js` (تم حذف `api/[...route].js`).
- في Vercel: Settings ← General ← Framework Preset = **Other**، وRoot Directory = `./`، وOutput Directory فارغ (يُقرأ من vercel.json).
- بعد النشر افتح `/api/health`: إن ظهر JSON فيه `ok` فالـ API يعمل. إن ظهر خطأ قاعدة بيانات فراجع `DATABASE_URL`.

## تسجيل الدخول عبر Google (خطأ "The given client ID is not found")
أضف المتغيرين بنفس قيمة Client ID (ينتهي بـ `.apps.googleusercontent.com`) في Vercel، ثم **Redeploy** (متغير VITE يُدمج وقت البناء):
- `VITE_GOOGLE_CLIENT_ID` (للواجهة)
- `GOOGLE_CLIENT_ID` (للتحقق في السيرفر)
وفي Google Cloud Console ← Credentials ← OAuth Client (Web) ← Authorized JavaScript origins أضف رابط موقعك `https://rsgames.vercel.app` (وأي دومين مخصص).
