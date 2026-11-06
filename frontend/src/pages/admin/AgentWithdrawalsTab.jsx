import { useEffect, useState } from "react";
import { Check, Landmark, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { api } from "../../lib/api";
import { btnGhost, btnGold, Field, inputCls } from "./ui";

const box = "rounded-2xl border border-ink-700 bg-ink-900 p-5";
const initial = { name: "", slug: "", instructions: "", minAmount: 5, maxAmount: 0, feePercent: 0, active: true, sortOrder: 0, fields: [{ key: "account", label: "رقم الحساب أو المحفظة", type: "text", required: true }] };

export default function AgentWithdrawalsTab() {
    const [methods, setMethods] = useState([]);
    const [requests, setRequests] = useState([]);
    const [form, setForm] = useState(initial);
    const [editing, setEditing] = useState(null);
    const [filter, setFilter] = useState("pending");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);
    const load = async (status = filter) => {
        setBusy(true);
        try { const [methodRows, requestRows] = await Promise.all([api("/admin/withdrawal-methods"), api(`/admin/agent-withdrawals?status=${status}`)]); setMethods(methodRows); setRequests(requestRows); }
        catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };
    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const save = async (e) => {
        e.preventDefault(); setBusy(true); setMessage(null);
        try { await api(editing ? `/admin/withdrawal-methods/${editing}` : "/admin/withdrawal-methods", { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) }); setForm(initial); setEditing(null); setMessage({ text: "تم حفظ طريقة السحب." }); await load(); }
        catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };
    const review = async (id, status) => {
        const adminNote = window.prompt(status === "approved" ? "ملاحظة التحويل (اختياري)" : "سبب الرفض") ?? null;
        if (adminNote === null) return;
        setBusy(true); setMessage(null);
        try { await api(`/admin/agent-withdrawals/${id}/review`, { method: "POST", body: JSON.stringify({ status, adminNote }) }); setMessage({ text: status === "approved" ? "تم اعتماد السحب." : "تم الرفض وإعادة النقاط للوكيل." }); await load(); }
        catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };
    const removeMethod = async (id) => { if (!window.confirm("حذف طريقة السحب؟ إذا كانت مستخدمة سيتم تعطيلها فقط.")) return; await api(`/admin/withdrawal-methods/${id}`, { method: "DELETE" }); await load(); };
    const editMethod = (method) => { setEditing(method.id); setForm({ ...method, minAmount: Number(method.minAmount), maxAmount: Number(method.maxAmount), feePercent: Number(method.feePercent), fields: method.fields || [] }); };
    const changeFilter = (status) => { setFilter(status); load(status); };
    return <div className="space-y-5">
        <form onSubmit={save} className={box}><div className="flex items-center justify-between"><div><h2 className="flex items-center gap-2 font-bold"><Landmark className="size-5 text-gold-400"/>طرق سحب أرباح الوكلاء</h2><p className="mt-1 text-sm text-mute">تحكم بالحدود والعمولة والبيانات المطلوبة للتحويل.</p></div>{editing && <button type="button" onClick={() => { setEditing(null); setForm(initial); }} className={btnGhost}>إلغاء</button>}</div>
            <div className="mt-4 grid gap-3 md:grid-cols-3"><Field label="اسم الطريقة"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls()}/></Field><Field label="المعرّف الإنجليزي"><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="syriatel-cash" className={inputCls()} dir="ltr"/></Field><Field label="العمولة %"><input type="number" min="0" max="100" step="0.01" value={form.feePercent} onChange={(e) => setForm({ ...form, feePercent: e.target.value })} className={inputCls()} dir="ltr"/></Field><Field label="الحد الأدنى $"><input type="number" min="0" step="0.01" value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} className={inputCls()} dir="ltr"/></Field><Field label="الحد الأعلى $ (0 بلا حد)"><input type="number" min="0" step="0.01" value={form.maxAmount} onChange={(e) => setForm({ ...form, maxAmount: e.target.value })} className={inputCls()} dir="ltr"/></Field><Field label="الترتيب"><input type="number" min="0" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={inputCls()} dir="ltr"/></Field></div>
            <Field label="التعليمات"><textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className={inputCls() + " mt-3 min-h-20"}/></Field>
            <div className="mt-3 space-y-2">{form.fields.map((field, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input value={field.key} onChange={(e) => setForm({ ...form, fields: form.fields.map((x, i) => i === index ? { ...x, key: e.target.value } : x) })} placeholder="field_key" className={inputCls()} dir="ltr"/><input value={field.label} onChange={(e) => setForm({ ...form, fields: form.fields.map((x, i) => i === index ? { ...x, label: e.target.value } : x) })} placeholder="اسم الحقل للمستخدم" className={inputCls()}/><button type="button" onClick={() => setForm({ ...form, fields: form.fields.filter((_, i) => i !== index) })} className={btnGhost}><X className="size-4"/></button></div>)}</div>
            <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setForm({ ...form, fields: [...form.fields, { key: "", label: "", type: "text", required: true }] })} className={`${btnGhost} flex items-center gap-2`}><Plus className="size-4"/>إضافة حقل</button><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}/>فعّالة</label><button disabled={busy} className={btnGold}>{editing ? "حفظ التعديلات" : "إضافة الطريقة"}</button></div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">{methods.map((method) => <div key={method.id} className="flex items-center gap-3 rounded-xl bg-ink-800 p-3"><div className="min-w-0 flex-1"><p className="font-medium">{method.name} {!method.active && <span className="text-xs text-red-300">(معطلة)</span>}</p><p className="text-xs text-mute">{method.feePercent}% · {method.minAmount}$ إلى {Number(method.maxAmount) ? `${method.maxAmount}$` : "بلا حد"}</p></div><button type="button" onClick={() => editMethod(method)} className={btnGhost}>تعديل</button><button type="button" onClick={() => removeMethod(method.id)} className="text-red-400"><Trash2 className="size-4"/></button></div>)}</div>
        </form>
        <section className={box}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">طلبات السحب</h2><div className="flex gap-2">{[["pending","قيد المراجعة"],["approved","المقبولة"],["rejected","المرفوضة"],["all","الكل"]].map(([key,label]) => <button key={key} type="button" onClick={() => changeFilter(key)} className={filter === key ? btnGold : btnGhost}>{label}</button>)}<button type="button" onClick={() => load()} className={btnGhost}><RefreshCw className={(busy ? "animate-spin " : "") + "size-4"}/></button></div></div>
            <div className="mt-4 space-y-3">{requests.map((item) => <article key={item.id} className="rounded-xl border border-ink-700 bg-ink-800 p-4"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="font-bold">{item.user.name} <span className="text-xs text-mute" dir="ltr">{item.requestNumber}</span></p><p className="text-xs text-mute">{item.method.name} · {new Date(item.createdAt).toLocaleString("ar-SY")}</p></div><div className="text-end"><p className="font-bold text-gold-300" dir="ltr">{Number(item.netAmount).toFixed(2)} USD</p><p className="text-xs text-mute">قبل العمولة {Number(item.grossAmount).toFixed(2)}$</p></div></div><div className="mt-3 rounded-lg bg-ink-900 p-3 text-xs">{Object.entries(item.payoutData || {}).map(([key,value]) => <p key={key}><span className="text-mute" dir="ltr">{key}:</span> {value}</p>)}</div>{item.status === "pending" && <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => review(item.id, "approved")} className={`${btnGold} flex items-center gap-1`}><Check className="size-4"/>اعتماد</button><button type="button" disabled={busy} onClick={() => review(item.id, "rejected")} className="flex items-center gap-1 rounded-xl border border-red-500/40 px-4 py-2 text-red-300"><X className="size-4"/>رفض وإعادة النقاط</button></div>}</article>)}{!requests.length && <p className="py-8 text-center text-sm text-mute">لا توجد طلبات ضمن هذا التصنيف.</p>}</div>
        </section>
        {message && <p className={(message.bad ? "border-red-500/40 text-red-300" : "border-emerald-500/40 text-emerald-300") + " rounded-xl border p-3 text-sm"}>{message.text}</p>}
    </div>;
}
