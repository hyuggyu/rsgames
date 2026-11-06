import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { changeAdminPassword, refreshPublicSettings } from "../../lib/db";
import { Field, inputCls, btnGold } from "./ui";
import { api } from "../../lib/api";
import { readCurrency, saveCurrency } from "../../lib/currency";

export default function SettingsTab() {
    const [f, setF] = useState({ whatsapp: "", telegram: "", supportName: "الدعم", welcome: "" });
    const [err, setErr] = useState({});
    const [saved, setSaved] = useState(false);
    const [pw, setPw] = useState({ old: "", next: "" });
    const [pwMsg, setPwMsg] = useState(null);
    const initialCurrency = readCurrency();
    const [currency, setCurrency] = useState(initialCurrency);
    const [currencyMsg, setCurrencyMsg] = useState(null);
    useEffect(() => { api("/settings").then((data) => { if (data.currency) { setCurrency(data.currency); saveCurrency(data.currency); } if (data.contact) setF(data.contact); }).catch(() => {}); }, []);
    const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setSaved(false); };

    const save = async (e) => {
        e.preventDefault();
        const er = {};
        const digits = f.whatsapp.replace(/\D/g, "");
        if (f.whatsapp.trim() && (digits.length < 8 || digits.length > 15)) er.whatsapp = "أدخل الرقم بصيغة دولية، 8 إلى 15 رقمًا (مثال: 963912345678).";
        if (f.telegram.trim() && !/^https:\/\/(t\.me|telegram\.me)\/\S+$/.test(f.telegram.trim())) er.telegram = "الرابط يجب أن يبدأ بـ https://t.me/";
        setErr(er);
        if (Object.keys(er).length) return;
        try { const result = await api("/admin/settings", { method: "PATCH", body: JSON.stringify({ contact: { whatsapp: digits, telegram: f.telegram.trim(), supportName: f.supportName.trim() || "الدعم", welcome: f.welcome.trim() } }) }); setF(result.contact); await refreshPublicSettings(true); setSaved(true); }
        catch (error) { setErr({ whatsapp: error.message }); }
    };

    const changePw = async (e) => {
        e.preventDefault();
        if (pw.next.length < 8) return setPwMsg({ bad: true, t: "كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف." });
        const ok = await changeAdminPassword(pw.old, pw.next);
        setPwMsg(ok ? { t: "تم تغيير كلمة المرور." } : { bad: true, t: "كلمة المرور الحالية غير صحيحة." });
        if (ok) setPw({ old: "", next: "" });
    };
    const saveRates = async (e) => {
        e.preventDefault(); setCurrencyMsg(null);
        const payload = { selected: currency.selected, rates: { USD: 1, SYP: Number(currency.rates.SYP), TRY: Number(currency.rates.TRY) } };
        if (!(payload.rates.SYP > 0) || !(payload.rates.TRY > 0)) return setCurrencyMsg({ bad: true, t: "أدخل أسعار صرف صحيحة أكبر من صفر." });
        try { const result = await api("/admin/settings", { method: "PATCH", body: JSON.stringify({ currency: payload }) }); setCurrency(result.currency); saveCurrency(result.currency); setCurrencyMsg({ t: "تم تحديث أسعار الصرف لجميع المستخدمين." }); }
        catch (error) { setCurrencyMsg({ bad: true, t: error.message }); }
    };

    return (
        <div className="space-y-8">
            <form onSubmit={save} className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-5" noValidate>
                <h2 className="font-bold">الدعم والتواصل</h2>
                <Field label="رقم واتساب الدعم" error={err.whatsapp} hint="مع رمز الدولة وبدون + أو أصفار، يُستخدم في زر واتساب على الموقع."><input value={f.whatsapp} onChange={set("whatsapp")} dir="ltr" inputMode="tel" placeholder="963912345678" className={inputCls(err.whatsapp)} /></Field>
                <Field label="رابط تليغرام" error={err.telegram}><input value={f.telegram} onChange={set("telegram")} dir="ltr" placeholder="https://t.me/your_channel" className={inputCls(err.telegram)} /></Field>
                <Field label="اسم الدعم في المحادثة"><input value={f.supportName} onChange={set("supportName")} className={inputCls()} /></Field>
                <Field label="رسالة الترحيب في المحادثة"><textarea value={f.welcome} onChange={set("welcome")} rows={2} className={inputCls()} /></Field>
                <div className="flex items-center gap-3"><button className={btnGold}>حفظ الإعدادات</button>{saved && <span className="flex items-center gap-1 text-sm text-emerald-400"><Check className="size-4" /> تم الحفظ</span>}</div>
            </form>

            <form onSubmit={saveRates} className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-5">
                <div><h2 className="font-bold">أسعار صرف العملات</h2><p className="mt-1 text-sm text-mute">أسعار المنتجات محفوظة بالدولار وتظهر للمستخدم بما يعادلها.</p></div>
                <Field label="عملة العرض الافتراضية"><select value={currency.selected} onChange={(e) => setCurrency({ ...currency, selected: e.target.value })} className={inputCls()}><option value="SYP">الليرة السورية</option><option value="TRY">الليرة التركية</option><option value="USD">الدولار</option></select></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="1 دولار = ليرة سورية"><input type="number" min="1" value={currency.rates.SYP} onChange={(e) => setCurrency({ ...currency, rates: { ...currency.rates, SYP: e.target.value } })} className={inputCls()} dir="ltr"/></Field>
                    <Field label="1 دولار = ليرة تركية"><input type="number" min="0.01" step="0.01" value={currency.rates.TRY} onChange={(e) => setCurrency({ ...currency, rates: { ...currency.rates, TRY: e.target.value } })} className={inputCls()} dir="ltr"/></Field>
                </div>
                <div className="rounded-xl border border-gold-500/30 bg-gold-500/10 p-3 text-sm"><p className="text-mute">مثال لسعر خدمة قيمتها 1$</p><p className="mt-1 font-bold text-gold-300">{Number(currency.rates.SYP || 0).toLocaleString("en-US")} ل.س · {Number(currency.rates.TRY || 0).toLocaleString("en-US")} ₺</p></div>
                <div className="flex items-center gap-3"><button className={btnGold}>حفظ أسعار الصرف</button>{currencyMsg && <span className={"text-sm " + (currencyMsg.bad ? "text-red-400" : "text-emerald-400")}>{currencyMsg.t}</span>}</div>
            </form>

            <form onSubmit={changePw} className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-5">
                <h2 className="font-bold">كلمة مرور لوحة التحكم</h2>
                <Field label="الحالية"><input type="password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} autoComplete="current-password" dir="ltr" className={inputCls()} /></Field>
                <Field label="الجديدة"><input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" dir="ltr" className={inputCls()} /></Field>
                <div className="flex items-center gap-3"><button className={btnGold}>تغيير</button>{pwMsg && <span className={`text-sm ${pwMsg.bad ? "text-red-400" : "text-emerald-400"}`}>{pwMsg.t}</span>}</div>
            </form>

        </div>
    );
}
