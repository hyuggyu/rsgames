import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { api } from "../../lib/api";
import { Empty, Field, Modal, inputCls, btnGold, btnGhost } from "./ui";

const labels = { pending: "معلّق", payment_review: "مراجعة الدفع", paid: "مدفوع", processing: "قيد التنفيذ", completed: "مكتمل", rejected: "مرفوض", cancelled: "ملغي" };
const tones = { pending: "text-gold-300", payment_review: "text-blue-300", paid: "text-cyan-300", processing: "text-violet-300", completed: "text-emerald-300", rejected: "text-red-300", cancelled: "text-red-300" };

export default function OrdersTab() {
    const [orders, setOrders] = useState([]);
    const [filter, setFilter] = useState("pending");
    const [query, setQuery] = useState("");
    const [action, setAction] = useState(null);
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const load = async () => { setBusy(true); setError(""); try { setOrders(await api("/admin/orders")); } catch (e) { setError(e.message); } finally { setBusy(false); } };
    useEffect(() => { load(); }, []);
    const list = useMemo(() => {
        const q = query.trim().toLowerCase();
        return orders.filter((o) => (filter === "all" || o.status === filter) && (!q || (o.orderNumber + " " + (o.user?.name || "") + " " + (o.user?.email || "") + " " + o.items.map((x) => x.name + " " + x.packageTitle).join(" ") + " " + JSON.stringify(o.customerData || {})).toLowerCase().includes(q)));
    }, [orders, filter, query]);
    const saved = (order) => setOrders((items) => items.map((x) => x._id === order._id ? { ...x, ...order } : x));
    const changeStatus = async (order, status) => { try { saved(await api("/admin/orders/" + order._id + "/status", { method: "PATCH", body: JSON.stringify({ status }) })); } catch (e) { setError(e.message); } };
    const confirmAction = async (e) => {
        e.preventDefault(); setBusy(true); setError("");
        try {
            const result = action.type === "complete"
                ? await api("/admin/orders/" + action.order._id + "/complete", { method: "POST", body: JSON.stringify({ deliveryCode: text.trim() }) })
                : await api("/admin/orders/" + action.order._id + "/cancel", { method: "POST", body: JSON.stringify({ reason: text.trim() }) });
            saved(result.order || result); setAction(null); setText("");
        } catch (x) { setError(x.message); } finally { setBusy(false); }
    };
    const filters = [["all", "الكل"], ...Object.entries(labels)];
    return <section>
        <div className="scroll-hide -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">{filters.map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={"shrink-0 rounded-xl border px-3 py-2 text-sm " + (filter === key ? "border-gold-500 bg-gold-500 font-bold text-ink-950" : "border-ink-700 bg-ink-900")}>{label} <span className="opacity-70">{key === "all" ? orders.length : orders.filter((o) => o.status === key).length}</span></button>)}</div>
        <div className="mb-4 flex gap-2"><div className="relative flex-1"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gold-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="رقم الطلب، المستخدم، المنتج أو Player ID" className={inputCls() + " ps-10"}/></div><button type="button" onClick={load} className={btnGhost}><RefreshCw className={"size-4 " + (busy ? "animate-spin" : "")}/></button></div>
        {error && <p className="mb-3 rounded-xl border border-red-500/40 p-3 text-sm text-red-300">{error}</p>}
        {!list.length && <Empty>{busy ? "جارٍ تحميل الطلبات..." : "لا توجد طلبات مطابقة."}</Empty>}
        <div className="space-y-3">{list.map((order) => <article key={order._id} className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold text-gold-300" dir="ltr">{order.orderNumber}</p><p className="truncate text-sm">{order.user?.name || "مستخدم"} · <span className="text-mute" dir="ltr">{order.user?.email}</span></p><p className="mt-1 text-xs text-mute">{new Date(order.createdAt).toLocaleString("ar-SY")}</p></div><div className="text-end"><p className="font-bold" dir="ltr">{"$"}{Number(order.totalAmount || 0).toFixed(2)}</p><p className={"mt-1 text-xs font-bold " + tones[order.status]}>{labels[order.status] || order.status}</p></div></div>
            <div className="mt-3 space-y-1 border-t border-ink-700 pt-3">{order.items.map((item, index) => <p key={index} className="text-sm">{item.name} — {item.packageTitle} × {item.quantity}</p>)}</div>
            {Object.entries(order.customerData || {}).length > 0 && <div className="mt-3 rounded-xl bg-ink-800 p-3">{Object.entries(order.customerData).map(([key, value]) => <p key={key} className="text-sm"><span className="text-mute">{key}: </span><span className="select-all break-all">{String(value)}</span></p>)}</div>}
            {order.deliveryCode && <p className="mt-3 rounded-xl border border-dashed border-gold-500/40 p-3 text-sm"><span className="text-mute">{order.status === "completed" ? "التسليم: " : "الملاحظة: "}</span><span className="select-all whitespace-pre-wrap text-gold-300">{order.deliveryCode}</span></p>}
            {!["completed", "cancelled", "rejected"].includes(order.status) && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => changeStatus(order, "processing")} className={btnGhost}>قيد التنفيذ</button><button type="button" onClick={() => { setAction({ type: "complete", order }); setText(""); }} className={btnGold}>إتمام وتسليم</button><button type="button" onClick={() => { setAction({ type: "cancel", order }); setText(""); }} className={btnGhost + " text-red-300"}>إلغاء وإرجاع الرصيد</button></div>}
        </article>)}</div>
        {action && <Modal title={action.type === "complete" ? "إتمام الطلب وإنشاء الفاتورة" : "إلغاء الطلب وإرجاع الرصيد"} onClose={() => setAction(null)}><form onSubmit={confirmAction} className="space-y-4"><Field label={action.type === "complete" ? "كود أو تفاصيل التسليم" : "سبب الإلغاء"} hint={action.type === "cancel" ? "سيُعاد المبلغ كاملًا إلى محفظة المستخدم." : "تظهر هذه البيانات للمستخدم في صفحة طلباته."}><textarea value={text} onChange={(e) => setText(e.target.value)} rows="4" className={inputCls()}/></Field><div className="flex gap-2"><button disabled={busy} className={btnGold + " flex-1"}>{busy ? "جارٍ التنفيذ..." : "تأكيد"}</button><button type="button" onClick={() => setAction(null)} className={btnGhost}>رجوع</button></div></form></Modal>}
    </section>;
}
