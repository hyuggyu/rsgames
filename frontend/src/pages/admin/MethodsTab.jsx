import { useEffect, useRef, useState } from "react";
import { ImagePlus, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { currencies } from "../../data/store";
import { Empty, Field, Modal, Switch, inputCls, btnGold, btnGhost } from "./ui";

const fieldsText = (items = []) => items.map((x) => x.key + " | " + x.label + " | " + (x.required ? "required" : "optional")).join("\n");
const parseFields = (text) => text.split("\n").map((x) => x.trim()).filter(Boolean).map((line) => { const [key, label, mode] = line.split("|").map((x) => x.trim()); return { key, label, required: mode === "required" }; });

function MethodForm({ initial, onSaved, onClose }) {
    const iconRef = useRef(null), walletRef = useRef(null);
    const [form, setForm] = useState({ slug: initial.slug || "", name: initial.name || "", account: initial.account || "", hint: initial.hint || "", currencies: initial.currencies || [], minimums: initial.minimums || { USD: 1, SYP: 10000, TRY: 50 }, appIcon: initial.appIcon || "", walletImage: initial.walletImage || "", fields: fieldsText(initial.extraFields), active: initial.active !== false });
    const [error, setError] = useState(""), [busy, setBusy] = useState(false);
    const upload = async (file, key) => { if (!file) return; const body = new FormData(); body.append("file", file); setBusy(true); try { const result = await api("/admin/product-image", { method: "POST", body }); setForm((old) => ({ ...old, [key]: result.url })); } catch (e) { setError(e.message); } finally { setBusy(false); } };
    const toggleCurrency = (code) => setForm({ ...form, currencies: form.currencies.includes(code) ? form.currencies.filter((x) => x !== code) : [...form.currencies, code] });
    const submit = async (e) => {
        e.preventDefault(); setError("");
        if (!/^[a-z0-9-]{2,30}$/.test(form.slug) || form.name.trim().length < 2 || form.account.trim().length < 3 || !form.currencies.length) return setError("تحقق من الاسم والمعرّف والحساب والعملات.");
        const extraFields = parseFields(form.fields);
        if (extraFields.some((x) => !/^[a-zA-Z0-9_]{2,30}$/.test(x.key) || !x.label)) return setError("صيغة الحقول الإضافية غير صحيحة.");
        setBusy(true);
        try {
            const payload = { ...form, name: form.name.trim(), account: form.account.trim(), minimums: Object.fromEntries(form.currencies.map((code) => [code, Number(form.minimums[code] || 0)])), extraFields };
            delete payload.fields;
            const result = await api("/admin/payment-methods" + (initial._id ? "/" + initial._id : ""), { method: initial._id ? "PATCH" : "POST", body: JSON.stringify(payload) });
            onSaved(result); onClose();
        } catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    return <Modal title={initial._id ? "تعديل طريقة الإيداع" : "إضافة طريقة إيداع"} onClose={onClose}><form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><Field label="اسم الطريقة"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls()}/></Field><Field label="المعرّف الإنجليزي"><input disabled={Boolean(initial._id)} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })} className={inputCls()} dir="ltr"/></Field></div>
        <Field label="رقم الحساب أو عنوان المحفظة"><input value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} className={inputCls()} dir="ltr"/></Field>
        <Field label="تعليمات للمستخدم"><textarea value={form.hint} onChange={(e) => setForm({ ...form, hint: e.target.value })} rows="2" className={inputCls()}/></Field>
        <fieldset><legend className="mb-2 text-sm">العملات وحدود الإيداع</legend><div className="space-y-2">{currencies.map((c) => <div key={c.code} className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-xl bg-ink-800 p-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.currencies.includes(c.code)} onChange={() => toggleCurrency(c.code)} className="accent-[#d4a22a]"/>{c.label}</label><input disabled={!form.currencies.includes(c.code)} type="number" min="0" value={form.minimums[c.code] ?? ""} onChange={(e) => setForm({ ...form, minimums: { ...form.minimums, [c.code]: e.target.value } })} placeholder="الحد الأدنى" className={inputCls()} dir="ltr"/></div>)}</div></fieldset>
        <div className="grid grid-cols-2 gap-3"><div><p className="mb-2 text-sm">أيقونة التطبيق</p><div className="flex items-center gap-2">{form.appIcon ? <img src={form.appIcon} alt="" className="size-14 rounded-xl object-cover"/> : <ImagePlus className="size-10 text-mute"/>}<input ref={iconRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0], "appIcon")}/><button type="button" onClick={() => iconRef.current?.click()} className={btnGhost}>رفع</button></div></div><div><p className="mb-2 text-sm">صورة المحفظة</p><div className="flex items-center gap-2">{form.walletImage ? <img src={form.walletImage} alt="" className="size-14 rounded-xl object-cover"/> : <ImagePlus className="size-10 text-mute"/>}<input ref={walletRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0], "walletImage")}/><button type="button" onClick={() => walletRef.current?.click()} className={btnGhost}>رفع</button></div></div></div>
        <Field label="حقول إضافية" hint="كل سطر: field_key | اسم الحقل | required أو optional"><textarea value={form.fields} onChange={(e) => setForm({ ...form, fields: e.target.value })} rows="3" placeholder="sender_phone | رقم هاتف المرسل | required" className={inputCls()} dir="auto"/></Field>
        {error && <p className="text-sm text-red-400">{error}</p>}<div className="flex gap-2"><button disabled={busy} className={btnGold + " flex-1"}>{busy ? "جارٍ الحفظ..." : "حفظ"}</button><button type="button" onClick={onClose} className={btnGhost}>إلغاء</button></div>
    </form></Modal>;
}

export default function MethodsTab() {
    const [methods, setMethods] = useState([]), [editing, setEditing] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
    const load = async () => { setBusy(true); setError(""); try { setMethods(await api("/admin/payment-methods")); } catch (e) { setError(e.message); } finally { setBusy(false); } };
    useEffect(() => { load(); }, []);
    const saved = (method) => setMethods((list) => list.some((x) => x._id === method._id) ? list.map((x) => x._id === method._id ? method : x) : [...list, method]);
    const toggle = async (method, active) => { try { saved(await api("/admin/payment-methods/" + method._id, { method: "PATCH", body: JSON.stringify({ active }) })); } catch (e) { setError(e.message); } };
    const remove = async (method) => { if (!window.confirm("إخفاء طريقة «" + method.name + "»؟")) return; try { await api("/admin/payment-methods/" + method._id, { method: "DELETE" }); setMethods((list) => list.map((x) => x._id === method._id ? { ...x, active: false } : x)); } catch (e) { setError(e.message); } };
    return <section><div className="mb-4 flex items-center justify-between"><p className="text-sm text-mute">طرق التحويل وحدود الإيداع وصور المحافظ.</p><div className="flex gap-2"><button type="button" onClick={load} className={btnGhost}><RefreshCw className={"size-4 " + (busy ? "animate-spin" : "")}/></button><button type="button" onClick={() => setEditing({})} className={btnGold + " flex items-center gap-2"}><Plus className="size-4"/>إضافة</button></div></div>{error && <p className="mb-3 text-sm text-red-400">{error}</p>}{!methods.length && <Empty>{busy ? "جارٍ التحميل..." : "لا توجد طرق إيداع."}</Empty>}<div className="space-y-2">{methods.map((method) => <article key={method._id} className={"flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4 " + (method.active ? "" : "opacity-60")}>{method.appIcon ? <img src={method.appIcon} alt="" className="size-12 rounded-xl object-cover"/> : <ImagePlus className="size-10 text-gold-400"/>}<div className="min-w-0 flex-1"><p className="font-bold">{method.name}</p><p className="truncate text-xs text-gold-300" dir="ltr">{method.account}</p><p className="mt-1 text-xs text-mute">{method.currencies.join(" · ")}</p></div><Switch on={method.active} onChange={(value) => toggle(method, value)} label="تفعيل"/><button type="button" onClick={() => setEditing(method)} className="p-2 text-gold-400"><Pencil className="size-5"/></button><button type="button" onClick={() => remove(method)} className="p-2 text-red-400"><Trash2 className="size-5"/></button></article>)}</div>{editing && <MethodForm initial={editing} onSaved={saved} onClose={() => setEditing(null)}/>}</section>;
}
