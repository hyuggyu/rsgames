import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Wallet, Smartphone, Coins, Copy, Check, Upload } from "lucide-react";
import { currencies } from "../data/store";
import { getUser, money, uploadFileApi, createDepositApi } from "../lib/wallet";
import { api } from "../lib/api";

const icons = { shamcash: Wallet, syriatel: Smartphone, usdt: Coins };

export default function Charge() {
    const [depositMethods, setDepositMethods] = useState([]);
    const navigate = useNavigate();
    const user = getUser();
    const [cur, setCur] = useState("USD");
    const [methodId, setMethodId] = useState(null);
    const [form, setForm] = useState({ amount: "", ref: "", extraData: {} });
    const [file, setFile] = useState(null);
    const [errors, setErrors] = useState({});
    const [copied, setCopied] = useState(false);
    useEffect(() => { api("/payment-methods").then(setDepositMethods).catch(() => {}); }, []);

    const currency = currencies.find((c) => c.code === cur);
    const methods = depositMethods.filter((m) => m.currencies.includes(cur));
    const method = methods.find((m) => m.slug === methodId);

    const pickCurrency = (code) => { setCur(code); setMethodId(null); setErrors({}); };
    const copy = async () => {
        await navigator.clipboard.writeText(method.account);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    const submit = async (e) => {
        e.preventDefault();
        const err = {};
        const amount = Number(form.amount);
        const minimum = Number(method?.minimums?.[cur] ?? currency.min);
        if (!amount || amount < minimum) err.amount = `الحد الأدنى للإيداع ${money(minimum, currency)}.`;
        if (form.ref.trim().length < 4) err.ref = "أدخل رقم العملية كما يظهر في إيصال التحويل.";
        if (!file) err.file = "أرفق صورة إيصال التحويل.";
        else if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) err.file = "الملف يجب أن يكون صورة بحجم أقل من 5 ميغابايت.";
        if (user.banned) err.file = "حسابك موقوف. تواصل مع الدعم.";
        (method.extraFields || []).forEach((field) => { if (field.required && !String(form.extraData[field.key] || "").trim()) err[field.key] = "هذا الحقل مطلوب."; });
        setErrors(err);
        if (Object.keys(err).length) return;
        try { const uploaded = await uploadFileApi(file); await createDepositApi({ method: method.slug, currency: cur, amount, reference: form.ref.trim(), receiptUrl: uploaded.url, extraData: form.extraData }); } catch (x) { return setErrors({ file: x.message }); }
        navigate("/wallet", { state: { notice: "تم إرسال طلب الإيداع. سيُضاف الرصيد إلى محفظتك بعد مراجعة الإيصال." } });
    };

    const inputCls = (bad) => `w-full rounded-xl border bg-ink-800 px-4 py-3.5 text-sm text-sand placeholder:text-mute focus:border-gold-500 focus:outline-none ${bad ? "border-red-500" : "border-ink-700"}`;

    return (
        <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
            <Link to="/wallet" className="mb-3 flex w-fit items-center gap-1 text-sm text-mute hover:text-sand"><ArrowRight className="size-4" /> محفظتي</Link>
            <h1 className="text-xl font-extrabold">إيداع رصيد</h1>

            <h2 className="mb-2 mt-6 text-sm font-semibold text-mute">اختر عملة الإيداع</h2>
            <div className="grid grid-cols-3 gap-2" role="tablist">
                {currencies.map((c) => (
                    <button key={c.code} type="button" role="tab" aria-selected={cur === c.code} onClick={() => pickCurrency(c.code)}
                        className={`rounded-xl border py-3 text-sm font-semibold transition-colors ${cur === c.code ? "border-gold-500 bg-gold-500 text-ink-950" : "border-ink-700 bg-ink-900 text-sand"}`}>
                        {c.label} <span className="font-normal opacity-80">{c.symbol}</span>
                    </button>
                ))}
            </div>

            <h2 className="mb-2 mt-6 text-sm font-semibold text-mute">اختر طريقة الإيداع</h2>
            <div className="space-y-2.5" role="radiogroup">
                {methods.map((m) => {
                    const Icon = icons[m.slug] ?? Wallet;
                    const on = methodId === m.slug;
                    return (
                        <button key={m._id} type="button" role="radio" aria-checked={on} onClick={() => { setMethodId(m.slug); setErrors({}); }}
                            className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-start transition-colors ${on ? "border-gold-500 bg-gold-500/10" : "border-ink-700 bg-ink-900 hover:border-gold-600/60"}`}>
                            <span className="grid size-12 place-items-center overflow-hidden rounded-xl bg-gold-500/15 text-gold-400">{m.appIcon ? <img src={m.appIcon} alt="" className="size-full object-cover"/> : <Icon className="size-6" />}</span>
                            <span className="flex-1 font-semibold" dir="auto">{m.name}</span>
                            <span className={`grid size-5 place-items-center rounded-full border-2 ${on ? "border-gold-400" : "border-ink-700"}`}>{on && <span className="size-2.5 rounded-full bg-gold-400" />}</span>
                        </button>
                    );
                })}
            </div>

            {method && (
                <form onSubmit={submit} noValidate className="mt-6 space-y-4 rounded-2xl border border-gold-600/40 bg-ink-900 p-5">
                    <div>
                        <p className="text-sm text-mute">{method.hint}</p>
                        {method.walletImage && <img src={method.walletImage} alt={method.name} className="mt-3 max-h-44 w-full rounded-xl object-contain bg-white/5"/>}
                        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-dashed border-gold-500/60 bg-ink-800 px-4 py-3">
                            <p className="break-all font-mono text-sm font-bold text-gold-300" dir="ltr">{method.account}</p>
                            <button type="button" onClick={copy} aria-label="نسخ" className="shrink-0 text-gold-400">{copied ? <Check className="size-5" /> : <Copy className="size-5" />}</button>
                        </div>
                    </div>

                    {(method.extraFields || []).map((field) => <div key={field.key}><label className="mb-1.5 block text-sm">{field.label}{field.required && " *"}</label><input value={form.extraData[field.key] || ""} onChange={(e) => setForm({ ...form, extraData: { ...form.extraData, [field.key]: e.target.value } })} className={inputCls(errors[field.key])}/>{errors[field.key] && <p className="mt-1.5 text-xs text-red-400">{errors[field.key]}</p>}</div>)}

                    <div>
                        <label htmlFor="amount" className="mb-1.5 block text-sm">المبلغ المحوّل ({currency.symbol})</label>
                        <input id="amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={`الحد الأدنى ${money(Number(method.minimums?.[cur] ?? currency.min), currency)}`} className={inputCls(errors.amount)} dir="auto" />
                        {errors.amount && <p className="mt-1.5 text-xs text-red-400">{errors.amount}</p>}
                    </div>
                    <div>
                        <label htmlFor="ref" className="mb-1.5 block text-sm">رقم العملية</label>
                        <input id="ref" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="رقم العملية أو TxID" className={inputCls(errors.ref)} dir="auto" />
                        {errors.ref && <p className="mt-1.5 text-xs text-red-400">{errors.ref}</p>}
                    </div>
                    <div>
                        <span className="mb-1.5 block text-sm">صورة الإيصال</span>
                        <label className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3.5 text-sm text-mute hover:border-gold-500 ${errors.file ? "border-red-500" : "border-ink-700"}`}>
                            <Upload className="size-5 text-gold-400" />
                            <span className="truncate">{file ? file.name : "اختر صورة من جهازك"}</span>
                            <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                        </label>
                        {errors.file && <p className="mt-1.5 text-xs text-red-400">{errors.file}</p>}
                    </div>

                    <button type="submit" className="w-full rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 py-3.5 font-bold text-ink-950">إرسال طلب الإيداع</button>
                </form>
            )}
        </main>
    );
}
