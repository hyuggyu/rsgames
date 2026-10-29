import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Save, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { api } from "../../lib/api";
import { refreshPublicSettings } from "../../lib/db";
import { Field, Switch, inputCls, btnGold, btnGhost } from "./ui";

const defaultControls = {
    registration: true,
    orders: true,
    deposits: true,
    support: true,
    reviews: true,
    verification: true,
    affiliates: true,
    liveChat: true,
};

const defaultPolicies = {
    requireEmailForOrders: false,
    requirePhoneForOrders: false,
    requireIdentityForOrders: false,
    requirePinForOrders: false,
    maximumOrderUSD: 0,
    maximumDepositUSD: 0,
    maximumPendingOrders: 0,
};

const modules = [
    ["registration", "تسجيل حسابات جديدة", "السماح للزوار بإنشاء حساب جديد."],
    ["orders", "استقبال الطلبات", "تشغيل أو إيقاف عمليات شراء المنتجات."],
    ["deposits", "طلبات الإيداع", "السماح للمستخدمين بإرسال طلبات شحن الرصيد."],
    ["support", "تذاكر الدعم", "السماح بإنشاء تذاكر دعم جديدة."],
    ["liveChat", "المحادثة المباشرة", "السماح بإرسال رسائل المحادثة المباشرة."],
    ["verification", "طلبات توثيق الحساب", "السماح للمستخدمين برفع طلبات التوثيق."],
    ["reviews", "تقييمات المنتجات", "السماح للمشترين بإرسال تقييمات جديدة."],
    ["affiliates", "استبدال نقاط الوكلاء", "السماح للوكلاء بتحويل النقاط إلى رصيد."],
];

const policySwitches = [
    ["requireEmailForOrders", "اشتراط توثيق البريد", "لن يستطيع المستخدم الشراء قبل توثيق بريده الإلكتروني."],
    ["requirePhoneForOrders", "اشتراط توثيق الهاتف", "لن يستطيع المستخدم الشراء قبل توثيق رقم الهاتف السوري."],
    ["requireIdentityForOrders", "اشتراط توثيق الهوية", "يُسمح بالشراء للحسابات التي وافقت الإدارة على توثيقها فقط."],
    ["requirePinForOrders", "اشتراط رمز PIN", "يجب على المستخدم تعيين رمز PIN قبل تنفيذ أي طلب."],
];

function ToggleRow({ title, description, value, onChange, danger }) {
    return <div className={"flex items-center justify-between gap-4 rounded-xl border p-3 " + (!value && danger ? "border-red-500/40 bg-red-500/5" : "border-ink-700 bg-ink-800/40")}>
        <div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs text-mute">{description}</p></div>
        <Switch on={value} onChange={onChange} label={title} />
    </div>;
}

export default function ControlCenterTab() {
    const [owner, setOwner] = useState(null);
    const [controls, setControls] = useState(defaultControls);
    const [policies, setPolicies] = useState(defaultPolicies);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);
    const [pin, setPin] = useState("");

    const load = async () => {
        setBusy(true); setMessage(null);
        try {
            const [settings, account] = await Promise.all([api("/settings"), api("/auth/me")]);
            setControls({ ...defaultControls, ...(settings.site?.controls || {}) });
            setPolicies({ ...defaultPolicies, ...(settings.site?.policies || {}) });
            setOwner(account);
        } catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };
    useEffect(() => { load(); }, []);

    const save = async (event) => {
        event.preventDefault(); setBusy(true); setMessage(null);
        const normalized = {
            ...policies,
            maximumOrderUSD: Number(policies.maximumOrderUSD || 0),
            maximumDepositUSD: Number(policies.maximumDepositUSD || 0),
            maximumPendingOrders: Math.floor(Number(policies.maximumPendingOrders || 0)),
        };
        if (Object.values(normalized).some((value) => typeof value === "number" && (!Number.isFinite(value) || value < 0))) {
            setBusy(false); return setMessage({ bad: true, text: "يجب أن تكون جميع الحدود أرقامًا صحيحة غير سالبة." });
        }
        try {
            const result = await api("/admin/settings", { method: "PATCH", body: JSON.stringify({ site: { controls, policies: normalized } }) });
            setControls({ ...defaultControls, ...result.site.controls });
            setPolicies({ ...defaultPolicies, ...result.site.policies });
            await refreshPublicSettings(true);
            setMessage({ text: "تم حفظ مركز التحكم وتطبيق الخيارات على الخادم فورًا." });
        } catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };

    const revokeSessions = async () => {
        if (owner?.hasPin && !/^\d{4,8}$/.test(pin)) return setMessage({ bad: true, text: "أدخل رمز PIN الخاص بالمالك أولًا." });
        if (!window.confirm("سيتم تسجيل خروج جميع المستخدمين من كل الأجهزة. هل تريد المتابعة؟")) return;
        setBusy(true); setMessage(null);
        try {
            const result = await api("/admin/security/revoke-customer-sessions", { method: "POST", body: JSON.stringify({ pin }) });
            setPin("");
            setMessage({ text: `تم إغلاق ${result.revoked} جلسة مستخدم بنجاح.` });
        } catch (error) {
            setMessage({ bad: true, text: error.message === "Incorrect owner PIN" ? "رمز PIN الخاص بالمالك غير صحيح." : error.message });
        } finally { setBusy(false); }
    };

    return <form onSubmit={save} className="space-y-5">
        <section className="rounded-2xl border border-gold-500/30 bg-gradient-to-l from-gold-500/10 to-transparent p-5">
            <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold-500/15 text-gold-400"><SlidersHorizontal className="size-6" /></span>
                <div className="flex-1"><h2 className="font-extrabold">مركز التحكم بالمتجر</h2><p className="mt-1 text-sm text-mute">كل تغيير هنا يُطبّق مباشرة على الواجهات الخلفية للمتجر.</p></div>
                <button type="button" onClick={load} className={btnGhost} aria-label="تحديث"><RefreshCw className={"size-4 " + (busy ? "animate-spin" : "")} /></button>
            </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-ink-700 bg-ink-900 p-5">
            <div><h3 className="font-bold">تشغيل وإيقاف الخدمات</h3><p className="mt-1 text-xs text-mute">يمكن إيقاف أي خدمة مؤقتًا دون حذف بياناتها.</p></div>
            <div className="grid gap-2 lg:grid-cols-2">
                {modules.map(([key, title, description]) => <ToggleRow key={key} title={title} description={description} value={controls[key]} danger onChange={(value) => setControls({ ...controls, [key]: value })} />)}
            </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-ink-700 bg-ink-900 p-5">
            <div><h3 className="font-bold">شروط تنفيذ الطلب</h3><p className="mt-1 text-xs text-mute">حدد مستوى الحماية المطلوب قبل السماح للمستخدم بالشراء.</p></div>
            <div className="grid gap-2 lg:grid-cols-2">
                {policySwitches.map(([key, title, description]) => <ToggleRow key={key} title={title} description={description} value={policies[key]} onChange={(value) => setPolicies({ ...policies, [key]: value })} />)}
            </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-5">
            <div><h3 className="font-bold">الحدود المالية والتشغيلية</h3><p className="mt-1 text-xs text-mute">القيمة 0 تعني عدم وجود حد.</p></div>
            <div className="grid gap-3 md:grid-cols-3">
                <Field label="أعلى قيمة للطلب بالدولار"><input type="number" min="0" step="0.01" value={policies.maximumOrderUSD} onChange={(event) => setPolicies({ ...policies, maximumOrderUSD: event.target.value })} className={inputCls()} dir="ltr" /></Field>
                <Field label="أعلى قيمة للإيداع بالدولار"><input type="number" min="0" step="0.01" value={policies.maximumDepositUSD} onChange={(event) => setPolicies({ ...policies, maximumDepositUSD: event.target.value })} className={inputCls()} dir="ltr" /></Field>
                <Field label="أقصى طلبات معلّقة للمستخدم"><input type="number" min="0" step="1" value={policies.maximumPendingOrders} onChange={(event) => setPolicies({ ...policies, maximumPendingOrders: event.target.value })} className={inputCls()} dir="ltr" /></Field>
            </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-red-500/35 bg-red-500/5 p-5">
            <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 size-6 shrink-0 text-red-400" /><div><h3 className="font-bold text-red-300">إجراء أمني طارئ</h3><p className="mt-1 text-xs text-mute">يسجّل خروج جميع المستخدمين من كل الأجهزة، مع إبقاء جلسة المالك الحالية مفتوحة.</p></div></div>
            {owner?.hasPin && <Field label="رمز PIN الخاص بالمالك"><input type="password" inputMode="numeric" maxLength="8" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} className={inputCls()} dir="ltr" placeholder="••••" /></Field>}
            <button type="button" disabled={busy} onClick={revokeSessions} className="flex items-center gap-2 rounded-xl border border-red-500/50 px-4 py-2.5 text-sm font-bold text-red-300 hover:bg-red-500/10"><AlertTriangle className="size-4" />تسجيل خروج جميع المستخدمين</button>
        </section>

        {message && <p className={"flex items-center gap-2 rounded-xl border p-3 text-sm " + (message.bad ? "border-red-500/40 text-red-300" : "border-emerald-500/40 text-emerald-300")}>{!message.bad && <CheckCircle2 className="size-4" />}{message.text}</p>}
        <button disabled={busy} className={btnGold + " flex w-full items-center justify-center gap-2 py-3"}><Save className="size-4" />{busy ? "جارٍ الحفظ..." : "حفظ وتطبيق جميع الخيارات"}</button>
    </form>;
}
