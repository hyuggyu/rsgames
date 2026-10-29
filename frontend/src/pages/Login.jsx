import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, UserRound, ArrowRight } from "lucide-react";
import { useContact, useSite } from "../lib/db";
import { signIn } from "../lib/wallet";

const idPattern = /^\S+@\S+\.\S+$|^\+?\d{8,15}$/;

function Field({ icon: Icon, error, children }) {
    return (
        <div>
            <div className={`flex items-center gap-3 rounded-xl border bg-ink-800 px-4 focus-within:border-gold-500 ${error ? "border-red-500" : "border-ink-700"}`}>
                <Icon className="size-5 shrink-0 text-gold-400" />
                {children}
            </div>
            {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
        </div>
    );
}

export default function Login() {
    const contact = useContact();
    const site = useSite();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from ?? new URLSearchParams(location.search).get("from") ?? "/";
    const referralCode = new URLSearchParams(location.search).get("ref")?.trim().toUpperCase() || "";
    const [signup, setSignup] = useState(false);
    const [show, setShow] = useState(false);
    const [form, setForm] = useState({ name: "", id: "", password: "" });
    const [errors, setErrors] = useState({});
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    const inputCls = "w-full bg-transparent py-3.5 text-sm text-sand placeholder:text-mute focus:outline-none";

    const submit = async (e) => {
        e.preventDefault();
        const err = {};
        if (signup && form.name.trim().length < 2) err.name = "أدخل اسمك الكامل.";
        if (!idPattern.test(form.id.trim())) err.id = "أدخل بريدًا إلكترونيًا أو رقم هاتف صحيحًا.";
        if (form.password.length < 8) err.password = "كلمة المرور يجب ألا تقل عن 8 أحرف.";
        setErrors(err);
        if (Object.keys(err).length) return;
        // تجريبي: استبدله بطلب إلى API الحقيقي. كل حساب جديد تُنشأ له محفظة برقم وباركود خاصين.
        const res = await signIn(form.id.trim(), form.name.trim(), form.password, signup, referralCode);
        if (res.error) return setErrors(res.error);
        navigate(from, { replace: true });
    };

    return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-8">
            <Link to="/" className="mb-4 flex w-fit items-center gap-1 text-sm text-mute hover:text-sand"><ArrowRight className="size-4" /> الرئيسية</Link>
            <div className="rounded-3xl border border-gold-600/40 bg-ink-900 p-6 shadow-2xl shadow-black/60">
                <img src={site.logoUrl || "/assets/rs-logo.jpg"} alt={site.name || "RS Store"} className="mx-auto size-28 rounded-full border-2 border-gold-500 object-cover" />
                <h1 className="mt-4 text-center text-2xl font-extrabold">{signup ? "إنشاء حساب جديد" : "أهلًا بعودتك"}</h1>
                <p className="mt-1 text-center text-sm text-mute">{signup ? "سجّل لتتابع طلباتك وتشحن رصيدك." : "سجّل الدخول لمتابعة طلباتك وشحن رصيدك."}</p>
                {signup && referralCode && <p className="mt-3 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2 text-center text-xs text-gold-300">التسجيل عبر الوكيل: <span dir="ltr">{referralCode}</span></p>}

                <div className="mt-5 grid grid-cols-2 rounded-xl bg-ink-800 p-1 text-sm font-semibold" role="tablist">
                    {[["تسجيل الدخول", false], ["حساب جديد", true]].map(([label, val]) => (
                        <button key={label} type="button" role="tab" aria-selected={signup === val} onClick={() => { setSignup(val); setErrors({}); }}
                            className={`rounded-lg py-2.5 transition-colors ${signup === val ? "bg-gold-500 text-ink-950" : "text-mute"}`}>{label}</button>
                    ))}
                </div>

                <form onSubmit={submit} noValidate className="mt-5 space-y-3.5">
                    {signup && (
                        <Field icon={UserRound} error={errors.name}>
                            <input value={form.name} onChange={set("name")} placeholder="الاسم الكامل" autoComplete="name" className={inputCls} />
                        </Field>
                    )}
                    <Field icon={Mail} error={errors.id}>
                        <input value={form.id} onChange={set("id")} placeholder="البريد الإلكتروني أو رقم الهاتف" autoComplete="username" className={inputCls} dir="auto" />
                    </Field>
                    <Field icon={Lock} error={errors.password}>
                        <input value={form.password} onChange={set("password")} type={show ? "text" : "password"} placeholder="كلمة المرور" autoComplete={signup ? "new-password" : "current-password"} className={inputCls} dir="auto" />
                        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="text-mute hover:text-sand">
                            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                        </button>
                    </Field>

                    {!signup && (
                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 text-mute"><input type="checkbox" className="size-4 accent-[#d4a22a]" /> تذكرني</label>
                            <Link to="/forgot-password" className="text-gold-400 hover:underline">نسيت كلمة المرور؟</Link>
                        </div>
                    )}

                    <button type="submit" className="w-full rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 py-3.5 font-bold text-ink-950 transition-opacity hover:opacity-90">
                        {signup ? "إنشاء الحساب" : "تسجيل الدخول"}
                    </button>
                </form>

                <p className="mt-5 text-center text-sm text-mute">
                    تحتاج مساعدة؟ <a href={contact.telegram} target="_blank" rel="noreferrer" className="text-gold-400 hover:underline">تليغرام</a> أو <a href={contact.whatsappUrl} target="_blank" rel="noreferrer" className="text-gold-400 hover:underline">واتساب</a>
                </p>
            </div>
        </main>
    );
}
