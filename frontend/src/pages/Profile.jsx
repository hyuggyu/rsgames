import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, CircleAlert, LogOut, ShieldCheck } from "lucide-react";
import { useUser, updateUser, signOut } from "../lib/wallet";
import Page, { fieldCls, btnPrimary, card, Label, Notice } from "../components/Page";
import { api } from "../lib/api";

export default function Profile() {
    const localUser = useUser();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(localUser);
    const [orders, setOrders] = useState([]);
    const [hasPin, setHasPin] = useState(false);
    const [name, setName] = useState(localUser.name || "");
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const [phone, setPhone] = useState(localUser.phone || "");
    const [phoneCode, setPhoneCode] = useState("");
    const [phoneSent, setPhoneSent] = useState(false);
    const [phoneMessage, setPhoneMessage] = useState("");
    const [emailCode, setEmailCode] = useState("");
    const [emailSent, setEmailSent] = useState(false);
    const [emailMessage, setEmailMessage] = useState("");

    const refresh = async () => {
        const [account, orderList, pin] = await Promise.all([api("/auth/me"), api("/orders/my"), api("/pin/status")]);
        setProfile(account); setName(account.name); setPhone(account.phone || ""); setOrders(orderList); setHasPin(pin.hasPin);
    };
    useEffect(() => { refresh().catch(() => {}); }, []);

    const completed = orders.filter((order) => order.status === "completed");
    const spent = completed.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const save = async (event) => {
        event.preventDefault(); setError(""); setSaved(false);
        if (name.trim().length < 2) return setError("الاسم يجب أن يتكون من حرفين على الأقل.");
        try {
            const account = await api("/auth/profile", { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
            setProfile(account); updateUser(localUser.id, (user) => ({ ...user, name: account.name })); setSaved(true);
        } catch (err) { setError(err.message); }
    };
    const logout = () => { signOut(); navigate("/login"); };

    return <Page title="الملف الشخصي">
        <div className="mt-5 flex items-center gap-4"><div className="grid size-16 place-items-center rounded-full border-2 border-gold-500 bg-gold-500/15 text-2xl font-extrabold text-gold-300">{String(profile.name || "R").trim().charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate font-bold">{profile.name}</p><p className="truncate text-sm text-mute" dir="ltr">{profile.email}</p><p className="mt-1 font-mono text-xs text-gold-300" dir="ltr">{profile.walletId}</p></div></div>

        <section className={`${card} mt-5 grid grid-cols-2 gap-3 p-4`}>
            <Status icon={CheckCircle2} ok={profile.emailVerified} label="البريد الإلكتروني" value={profile.emailVerified ? "مؤكد" : "بانتظار التأكيد"}/>
            <Status icon={CheckCircle2} ok={profile.phoneVerified} label="رقم الهاتف" value={profile.phoneVerified ? "مؤكد" : "غير مؤكد"}/>
            <Status icon={ShieldCheck} ok={profile.verified} label="توثيق الهوية" value={profile.verified ? "موثق" : "غير موثق"}/>
            <Status icon={CircleAlert} ok={hasPin} label="رمز الأمان" value={hasPin ? "PIN مفعّل" : "بدون PIN"}/>
        </section>
        <Link to="/verification" className="mt-3 block rounded-xl border border-gold-500/40 py-3 text-center text-sm font-bold text-gold-300">{profile.verified ? "عرض حالة التوثيق" : "توثيق الحساب الآن"}</Link>

        <section className="mt-5 grid grid-cols-3 gap-3 text-center">{[["الطلبات", orders.length], ["المكتملة", completed.length], ["إجمالي الشراء", `$${spent.toFixed(2)}`]].map(([label, value]) => <div key={label} className={`${card} p-3`}><p className="text-xs text-mute">{label}</p><p className="mt-1 font-extrabold text-gold-300" dir="ltr">{value}</p></div>)}</section>

        <form onSubmit={save} className={`${card} mt-5 space-y-4 p-4`}><Label id="profile-name" label="الاسم" error={error}><input id="profile-name" value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} maxLength={60} className={fieldCls(Boolean(error))}/></Label><button className={btnPrimary}>حفظ الاسم</button>{saved && <Notice>تم حفظ الاسم.</Notice>}</form>

        {!profile.emailVerified && <section className={`${card} mt-5 space-y-4 p-4`}>
            <div><h2 className="font-bold">تأكيد البريد الإلكتروني</h2><p className="mt-1 text-xs text-mute" dir="ltr">{profile.email}</p></div>
            <button type="button" onClick={async () => { try { const result = await api("/email/send", { method: "POST" }); setEmailSent(!result.alreadyVerified); setEmailMessage(result.alreadyVerified ? "البريد مؤكد مسبقاً." : "تم إرسال رمز التأكيد إلى بريدك."); } catch (err) { setEmailMessage(err.message); } }} className="rounded-xl bg-gold-500 px-4 py-3 text-sm font-bold text-ink-950">إرسال رمز البريد</button>
            {emailSent && <div className="flex gap-2"><input value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="رمز التأكيد" dir="ltr" inputMode="numeric" className={fieldCls(false)}/><button type="button" onClick={async () => { try { const result = await api("/email/verify", { method: "POST", body: JSON.stringify({ code: emailCode }) }); setProfile(result.user); setEmailSent(false); setEmailMessage("تم تأكيد البريد الإلكتروني بنجاح."); } catch (err) { setEmailMessage(err.message); } }} className="shrink-0 rounded-xl border border-gold-500 px-4 text-sm font-bold text-gold-300">تأكيد</button></div>}
            {emailMessage && <Notice>{emailMessage}</Notice>}
        </section>}

        <section className={`${card} mt-5 space-y-4 p-4`}>
            <div><h2 className="font-bold">تأكيد رقم الهاتف السوري</h2><p className="mt-1 text-xs text-mute">استخدم 09xxxxxxxx أو +9639xxxxxxxx</p></div>
            <div className="flex gap-2"><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09xxxxxxxx" dir="ltr" inputMode="tel" className={fieldCls(false)}/><button type="button" onClick={async () => { try { await api("/phone/send", { method: "POST", body: JSON.stringify({ phone }) }); setPhoneSent(true); setPhoneMessage("تم إرسال رمز الهاتف."); } catch (err) { setPhoneMessage(err.message); } }} className="shrink-0 rounded-xl bg-gold-500 px-3 text-sm font-bold text-ink-950">إرسال الرمز</button></div>
            {phoneSent && <div className="flex gap-2"><input value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="رمز التأكيد" dir="ltr" inputMode="numeric" className={fieldCls(false)}/><button type="button" onClick={async () => { try { await api("/phone/verify", { method: "POST", body: JSON.stringify({ code: phoneCode }) }); await refresh(); setPhoneSent(false); setPhoneMessage("تم تأكيد رقم الهاتف بنجاح."); } catch (err) { setPhoneMessage(err.message); } }} className="shrink-0 rounded-xl border border-gold-500 px-3 text-sm font-bold text-gold-300">تأكيد</button></div>}
            {phoneMessage && <Notice>{phoneMessage}</Notice>}
        </section>

        <button type="button" onClick={logout} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 py-3 text-sm font-semibold text-red-400"><LogOut className="size-4"/>تسجيل الخروج</button>
    </Page>;
}

function Status({ icon: Icon, ok, label, value }) {
    return <div className="flex items-center gap-2"><Icon className={`size-5 ${ok ? "text-emerald-400" : "text-gold-400"}`}/><div><p className="text-xs text-mute">{label}</p><p className="text-sm font-semibold">{value}</p></div></div>;
}
