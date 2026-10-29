import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useUser } from "../lib/wallet";
import { api } from "../lib/api";
import { notify } from "../lib/orders";
import Page, { fieldCls, btnPrimary, card, Label, Notice } from "../components/Page";

const digits = (set) => (e) => set(e.target.value.replace(/\D/g, "").slice(0, 6));

export default function Pin() {
    const user = useUser();
    const [pw, setPw] = useState("");
    const [currentPin, setCurrentPin] = useState("");
    const [pin, setPin] = useState("");
    const [again, setAgain] = useState("");
    const [err, setErr] = useState({});
    const [msg, setMsg] = useState("");

    const check = async () => {
        const er = {};
        if (!pw) er.pw = "أدخل كلمة المرور للتأكيد.";
        setErr(er);
        return !er.pw;
    };

    const save = async (e) => {
        e.preventDefault();
        setMsg("");
        const er = {};
        if (!pw) er.pw = "أدخل كلمة المرور للتأكيد.";
        if (!/^\d{4,6}$/.test(pin)) er.pin = "البين كود من 4 إلى 6 أرقام.";
        if (again !== pin) er.again = "الرمزان غير متطابقين.";
        setErr(er);
        if (Object.keys(er).length) return;
        try { await api("/pin/set", { method: "POST", body: JSON.stringify({ pin, currentPin: user.pin ? currentPin : undefined }) }); }
        catch (x) { setErr({ pw: x.message }); return; }
        notify(user.walletId, user.pin ? "تم تغيير البين كود" : "تم تفعيل البين كود", "سيُطلب منك عند كل عملية شراء.");
        setPw(""); setPin(""); setAgain(""); setMsg("تم حفظ البين كود.");
    };

    const remove = async () => {
        setMsg("");
        if (!(await check()) || !window.confirm("إلغاء البين كود؟ ستقل حماية محفظتك.")) return;
        setPw(""); setMsg("إلغاء البين كود يحتاج تفعيل مسار الحذف في الباكند.");
    };

    return (
        <Page title="البين كود" back="/security" backLabel="مركز الأمان">
            <div className={`${card} mt-5 flex items-start gap-3 p-4`}>
                <KeyRound className="mt-0.5 size-6 shrink-0 text-gold-400" />
                <p className="text-sm leading-relaxed text-mute">رمز سري من 4 إلى 6 أرقام يُطلب عند كل عملية شراء، فلا يستطيع أحد استخدام رصيدك حتى لو فتح حسابك. الحالة الحالية: <b className={user.pin ? "text-emerald-300" : "text-gold-300"}>{user.pin ? "مفعّل" : "غير مفعّل"}</b>.</p>
            </div>
            <form onSubmit={save} noValidate className={`${card} mt-5 space-y-4 p-4`}>
                {user.pin ? <Label id="current-pin" label="البين كود الحالي" error={err.pw}><input id="current-pin" type="password" inputMode="numeric" value={currentPin} onChange={digits(setCurrentPin)} dir="ltr" className={fieldCls(err.pw)} /></Label> : <Label id="pw" label="كلمة مرور الحساب (للتأكيد)" error={err.pw}><input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" className={fieldCls(err.pw)} /></Label>}
                <Label id="pin" label={user.pin ? "البين كود الجديد" : "البين كود"} error={err.pin}><input id="pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={digits(setPin)} dir="ltr" className={fieldCls(err.pin)} /></Label>
                <Label id="pin2" label="تأكيد البين كود" error={err.again}><input id="pin2" type="password" inputMode="numeric" autoComplete="off" value={again} onChange={digits(setAgain)} dir="ltr" className={fieldCls(err.again)} /></Label>
                <button className={btnPrimary}>{user.pin ? "تغيير البين كود" : "تفعيل البين كود"}</button>
                {user.pin && <button type="button" onClick={remove} className="w-full rounded-xl border border-red-500/40 py-3 text-sm font-semibold text-red-400">إلغاء البين كود</button>}
                {msg && <Notice>{msg}</Notice>}
            </form>
        </Page>
    );
}
