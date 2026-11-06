import { Link } from "react-router-dom";

export default function NotFound() {
    return (
        <main className="mx-auto grid min-h-screen max-w-md place-items-center px-6 pb-24 text-center">
            <div>
                <p className="text-6xl font-extrabold text-gold-400" dir="ltr">404</p>
                <h1 className="mt-3 text-xl font-bold">الصفحة غير موجودة</h1>
                <p className="mt-2 text-mute">قد يكون الرابط خاطئًا أو الصفحة نُقلت.</p>
                <Link to="/" className="mt-6 inline-block rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-6 py-3 font-bold text-ink-950">العودة للرئيسية</Link>
            </div>
        </main>
    );
}
