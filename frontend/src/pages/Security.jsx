import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, KeyRound, Laptop, Lock, LogOut, MailCheck, Monitor, RefreshCw, ShieldCheck, Smartphone, Tablet } from "lucide-react";
import { api } from "../lib/api";
import { signOut } from "../lib/wallet";
import Page, { fieldCls, btnPrimary, card, Label, Notice } from "../components/Page";

const deviceIcon = (device) => device === "هاتف" ? Smartphone : device === "جهاز لوحي" ? Tablet : device === "كمبيوتر" ? Laptop : Monitor;

export default function Security() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ old: "", next: "", again: "" });
    const [errors, setErrors] = useState({});
    const [message, setMessage] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [hasPin, setHasPin] = useState(false);
    const [busy, setBusy] = useState(false);
    const [twoFactor, setTwoFactor] = useState(false);
    const [twoFactorForm, setTwoFactorForm] = useState({ open: false, target: true, code: "", password: "" });

    const load = async () => {
        setBusy(true);
        try { const [sessionList, pin, me] = await Promise.all([api("/security/sessions"), api("/pin/status"), api("/auth/me")]); setSessions(sessionList); setHasPin(pin.hasPin); setTwoFactor(Boolean(me.twoFactorEnabled)); }
        catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };
    useEffect(() => { load(); }, []);
    const set = (key) => (event) => { setForm({ ...form, [key]: event.target.value }); setMessage(null); };

    const changePassword = async (event) => {
        event.preventDefault();
        const nextErrors = {};
        if (!form.old) nextErrors.old = "أدخل كلمة المرور الحالية.";
        if (form.next.length < 8) nextErrors.next = "كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.";
        else if (form.next === form.old) nextErrors.next = "اختر كلمة مرور مختلفة عن الحالية.";
        if (form.again !== form.next) nextErrors.again = "كلمتا المرور غير متطابقتين.";
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length) return;
        setBusy(true); setMessage(null);
        try { await api("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: form.old, newPassword: form.next }) }); setForm({ old: "", next: "", again: "" }); setMessage({ text: "تم تغيير كلمة المرور وإنهاء جميع الجلسات الأخرى." }); await load(); }
        catch (error) { setErrors({ old: error.message }); }
        finally { setBusy(false); }
    };
    const revoke = async (session) => {
        if (!window.confirm(session.current ? "تسجيل الخروج من هذا الجهاز؟" : "إنهاء هذه الجلسة؟")) return;
        try {
            await api("/security/sessions/" + session._id, { method: "DELETE" });
            if (session.current) { await signOut(); navigate("/login", { replace: true }); return; }
            setSessions((list) => list.filter((item) => item._id !== session._id));
        } catch (error) { setMessage({ bad: true, text: error.message }); }
    };
    const revokeOthers = async () => {
        if (!window.confirm("إنهاء جميع الجلسات الأخرى؟")) return;
        try { const result = await api("/security/sessions/revoke-others", { method: "POST" }); setSessions((list) => list.filter((item) => item.current)); setMessage({ text: "تم إنهاء " + result.revoked + " جلسة أخرى." }); }
        catch (error) { setMessage({ bad: true, text: error.message }); }
    };
    const requestTwoFactorCode = async () => {
        const target = !twoFactor;
        setBusy(true); setMessage(null);
        try { await api("/security/2fa/send", { method: "POST", body: JSON.stringify({ enabled: target }) }); setTwoFactorForm({ open: true, target, code: "", password: "" }); setMessage({ text: "تم إرسال رمز الأمان إلى بريدك الإلكتروني." }); }
        catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };
    const saveTwoFactor = async (event) => {
        event.preventDefault();
        setBusy(true); setMessage(null);
        try {
            await api("/security/2fa", { method: "POST", body: JSON.stringify({ enabled: twoFactorForm.target, code: twoFactorForm.code, password: twoFactorForm.password }) });
            setTwoFactor(twoFactorForm.target); setTwoFactorForm({ open: false, target: true, code: "", password: "" });
            setMessage({ text: twoFactorForm.target ? "تم تفعيل التحقق بخطوتين." : "تم إيقاف التحقق بخطوتين." });
        } catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };

    return (
        <Page title="مركز الأمان">
            <section className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className={card + " flex items-center gap-3 p-4"}><Lock className="size-7 text-gold-400"/><div><p className="font-semibold">كلمة المرور</p><p className="text-xs text-emerald-300">مفعّلة</p></div></div>
                <Link to="/pin" className={card + " flex items-center gap-3 p-4 hover:border-gold-500"}><KeyRound className="size-7 text-gold-400"/><div className="flex-1"><p className="font-semibold">البين كود</p><p className={(hasPin ? "text-emerald-300" : "text-gold-300") + " text-xs"}>{hasPin ? "مفعّل" : "غير مفعّل — فعّله الآن"}</p></div><ChevronLeft className="size-5 text-mute"/></Link>
            </section>

            {message && <div className="mt-4"><Notice bad={message.bad}>{message.text}</Notice></div>}

            <section className={card + " mt-5 p-4"}>
                <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-gold-500/15 text-gold-400"><MailCheck className="size-6" /></span><div className="flex-1"><h2 className="font-bold">التحقق بخطوتين عبر البريد</h2><p className="text-xs text-mute">يطلب رمزًا إضافيًا عند تسجيل الدخول بكلمة المرور.</p></div><span className={(twoFactor ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-700 text-mute") + " rounded-full px-2.5 py-1 text-xs"}>{twoFactor ? "مفعّل" : "متوقف"}</span></div>
                {!twoFactorForm.open ? <button type="button" onClick={requestTwoFactorCode} disabled={busy} className={(twoFactor ? "border-red-500/40 text-red-300" : "border-gold-500/40 text-gold-300") + " mt-4 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold"}>{twoFactor ? "إيقاف التحقق بخطوتين" : "تفعيل التحقق بخطوتين"}</button> :
                <form onSubmit={saveTwoFactor} className="mt-4 space-y-3">
                    <Label id="two-factor-code" label="رمز الأمان" error={null}><input id="two-factor-code" value={twoFactorForm.code} onChange={(event) => setTwoFactorForm({ ...twoFactorForm, code: event.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" dir="ltr" className={fieldCls()} /></Label>
                    {!twoFactorForm.target && <Label id="two-factor-password" label="كلمة المرور للتأكيد" error={null}><input id="two-factor-password" type="password" value={twoFactorForm.password} onChange={(event) => setTwoFactorForm({ ...twoFactorForm, password: event.target.value })} autoComplete="current-password" dir="ltr" className={fieldCls()} /></Label>}
                    <div className="grid grid-cols-2 gap-2"><button disabled={busy || twoFactorForm.code.length !== 6} className={btnPrimary}>تأكيد</button><button type="button" onClick={() => setTwoFactorForm({ open: false, target: true, code: "", password: "" })} className="rounded-xl border border-ink-700 text-sm text-mute">إلغاء</button></div>
                </form>}
            </section>

            <section className={card + " mt-5 p-4"}>
                <div className="mb-4 flex items-center gap-3"><ShieldCheck className="size-6 text-gold-400"/><div className="flex-1"><h2 className="font-bold">الأجهزة والجلسات</h2><p className="text-xs text-mute">راجع الأجهزة التي يمكنها الوصول إلى حسابك.</p></div><button type="button" onClick={load} disabled={busy} className="rounded-lg p-2 text-gold-400"><RefreshCw className={(busy ? "animate-spin " : "") + "size-4"}/></button></div>
                <div className="space-y-2">{sessions.map((session) => { const Icon = deviceIcon(session.device); return <div key={session._id} className={(session.current ? "border-gold-500/50 bg-gold-500/10" : "border-ink-700 bg-ink-800") + " flex items-center gap-3 rounded-xl border p-3"}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-black/30 text-gold-400"><Icon className="size-5"/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-semibold">{session.device} · {session.browser}</p>{session.current && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">هذا الجهاز</span>}</div><p className="mt-1 text-xs text-mute" dir="ltr">IP: {session.ip || "—"}</p><p className="text-xs text-mute">آخر نشاط: {new Date(session.lastSeenAt).toLocaleString("ar-SY")}</p></div><button type="button" onClick={() => revoke(session)} className="rounded-lg p-2 text-red-400" aria-label="إنهاء الجلسة"><LogOut className="size-4"/></button></div>; })}</div>
                {sessions.length > 1 && <button type="button" onClick={revokeOthers} className="mt-3 w-full rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-semibold text-red-300">إنهاء جميع الجلسات الأخرى</button>}
            </section>

            <form onSubmit={changePassword} noValidate className={card + " mt-5 space-y-4 p-4"}>
                <h2 className="font-bold">تغيير كلمة المرور</h2>
                <Label id="o" label="كلمة المرور الحالية" error={errors.old}><input id="o" type="password" autoComplete="current-password" value={form.old} onChange={set("old")} dir="ltr" className={fieldCls(errors.old)}/></Label>
                <Label id="n" label="كلمة المرور الجديدة" error={errors.next}><input id="n" type="password" autoComplete="new-password" value={form.next} onChange={set("next")} dir="ltr" className={fieldCls(errors.next)}/></Label>
                <Label id="a" label="تأكيد كلمة المرور الجديدة" error={errors.again}><input id="a" type="password" autoComplete="new-password" value={form.again} onChange={set("again")} dir="ltr" className={fieldCls(errors.again)}/></Label>
                <button disabled={busy} className={btnPrimary}>{busy ? "جارٍ التحديث..." : "تحديث كلمة المرور"}</button>
            </form>

            <section className={card + " mt-5 p-4"}><h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="size-5 text-gold-400"/>نصائح للحماية</h2><ul className="mt-3 list-disc space-y-1.5 ps-5 text-sm leading-relaxed text-mute"><li>لا تشارك كلمة المرور أو البين كود مع أي شخص.</li><li>أنه الجلسة فورًا إذا لم تتعرف على الجهاز أو عنوان IP.</li><li>لا تحوّل أموالًا إلا إلى الحسابات الظاهرة في صفحة الإيداع.</li></ul></section>
        </Page>
    );
}
