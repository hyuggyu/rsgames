import { useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Empty, Field, Modal, Switch, inputCls, btnGold, btnGhost } from "./ui";

const blank = { code: "", type: "percent", value: "", minOrder: "", maxUses: "", expiresAt: "", firstOnly: false, active: true };

function CouponForm({ initial, onSaved, onClose }) {
    const [form, setForm] = useState({ ...blank, ...initial, expiresAt: initial.expiresAt ? String(initial.expiresAt).slice(0, 10) : "" });
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
    const submit = async (e) => {
        e.preventDefault(); setError("");
        const code = form.code.trim().toUpperCase(), value = Number(form.value);
        if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return setError("الكود يجب أن يكون 3–20 حرفًا إنجليزيًا أو رقمًا.");
        if (!(value > 0) || (form.type === "percent" && value > 100)) return setError("قيمة الخصم غير صحيحة.");
        setBusy(true);
        try {
            const payload = { code, type: form.type, value, minOrder: Number(form.minOrder || 0), maxUses: Math.floor(Number(form.maxUses || 0)), expiresAt: form.expiresAt || null, firstOnly: form.firstOnly, active: form.active };
            const result = await api("/admin/coupons" + (initial._id ? "/" + initial._id : ""), { method: initial._id ? "PATCH" : "POST", body: JSON.stringify(payload) });
            onSaved(result); onClose();
        } catch (x) { setError(x.message); }
        finally { setBusy(false); }
    };
    return <Modal title={initial._id ? "تعديل كود الخصم" : "إنشاء كود خصم"} onClose={onClose}>
        <form onSubmit={submit} className="space-y-4">
            <Field label="الكود"><input value={form.code} onChange={set("code")} placeholder="RS20" className={inputCls()} dir="ltr"/></Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label="نوع الخصم"><select value={form.type} onChange={set("type")} className={inputCls()}><option value="percent">نسبة مئوية</option><option value="fixed">مبلغ ثابت بالدولار</option></select></Field>
                <Field label="قيمة الخصم"><input type="number" min="0.01" step="0.01" value={form.value} onChange={set("value")} className={inputCls()} dir="ltr"/></Field>
                <Field label="أدنى طلب ($)"><input type="number" min="0" step="0.01" value={form.minOrder} onChange={set("minOrder")} className={inputCls()} dir="ltr"/></Field>
                <Field label="أقصى استخدام"><input type="number" min="0" step="1" value={form.maxUses} onChange={set("maxUses")} placeholder="0 = غير محدود" className={inputCls()} dir="ltr"/></Field>
            </div>
            <Field label="تاريخ الانتهاء"><input type="date" value={form.expiresAt} onChange={set("expiresAt")} className={inputCls()} dir="ltr"/></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.firstOnly} onChange={(e) => setForm({ ...form, firstOnly: e.target.checked })} className="size-4 accent-[#d4a22a]"/>استخدام مرة واحدة لكل مستخدم</label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2"><button disabled={busy} className={btnGold + " flex-1"}>{busy ? "جارٍ الحفظ..." : "حفظ"}</button><button type="button" onClick={onClose} className={btnGhost}>إلغاء</button></div>
        </form>
    </Modal>;
}

export default function CouponsTab() {
    const [items, setItems] = useState([]);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const load = async () => { setBusy(true); setError(""); try { setItems(await api("/admin/coupons")); } catch (e) { setError(e.message); } finally { setBusy(false); } };
    useEffect(() => { load(); }, []);
    const saved = (coupon) => setItems((list) => list.some((x) => x._id === coupon._id) ? list.map((x) => x._id === coupon._id ? coupon : x) : [coupon, ...list]);
    const toggle = async (coupon, active) => { try { saved(await api("/admin/coupons/" + coupon._id, { method: "PATCH", body: JSON.stringify({ active }) })); } catch (e) { setError(e.message); } };
    const remove = async (coupon) => {
        if (!window.confirm("حذف كود " + coupon.code + " نهائيًا؟")) return;
        try { await api("/admin/coupons/" + coupon._id, { method: "DELETE" }); setItems((list) => list.filter((x) => x._id !== coupon._id)); } catch (e) { setError(e.message); }
    };
    const now = Date.now();
    return <section>
        <div className="mb-4 flex items-center justify-between gap-2"><div><h2 className="font-bold">أكواد الخصم</h2><p className="mt-1 text-xs text-mute">الأكواد مرتبطة بالطلبات وقاعدة البيانات.</p></div><div className="flex gap-2"><button type="button" onClick={load} className={btnGhost} aria-label="تحديث"><RefreshCw className={"size-4 " + (busy ? "animate-spin" : "")}/></button><button type="button" onClick={() => setEditing({})} className={btnGold + " flex items-center gap-2"}><Plus className="size-4"/>كود جديد</button></div></div>
        {error && <p className="mb-3 rounded-xl border border-red-500/40 p-3 text-sm text-red-300">{error}</p>}
        {!items.length && <Empty>{busy ? "جارٍ التحميل..." : "لا توجد أكواد خصم."}</Empty>}
        <div className="space-y-2">{items.map((coupon) => {
            const expired = coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now, full = coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses;
            return <article key={coupon._id} className={"flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4 " + (!coupon.active || expired || full ? "opacity-60" : "")}>
                <div className="min-w-0 flex-1"><p className="font-mono font-bold tracking-wider text-gold-300" dir="ltr">{coupon.code}</p><p className="mt-1 text-xs text-mute">{coupon.type === "percent" ? coupon.value + "%" : coupon.value + "$"} · استُخدم {coupon.usedCount}{coupon.maxUses ? " من " + coupon.maxUses : ""}{coupon.minOrder ? " · حد أدنى " + coupon.minOrder + "$" : ""}{coupon.firstOnly ? " · مرة لكل مستخدم" : ""}{expired ? " · منتهي" : ""}{full ? " · مكتمل" : ""}</p></div>
                <Switch on={coupon.active} onChange={(value) => toggle(coupon, value)} label="تفعيل الكود"/>
                <button type="button" onClick={() => setEditing(coupon)} className="rounded-lg p-2 text-gold-400 hover:bg-ink-800"><Pencil className="size-5"/></button>
                <button type="button" onClick={() => remove(coupon)} className="rounded-lg p-2 text-red-400 hover:bg-ink-800"><Trash2 className="size-5"/></button>
            </article>;
        })}</div>
        {editing && <CouponForm initial={editing} onSaved={saved} onClose={() => setEditing(null)}/>}
    </section>;
}
