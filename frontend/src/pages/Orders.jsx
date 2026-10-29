import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, Copy, PackageOpen, RefreshCw } from "lucide-react";
import { api, getToken } from "../lib/api";
import { useOrders } from "../lib/db";
import { useUser } from "../lib/wallet";
import Page, { card, Notice } from "../components/Page";

const labels = { pending: "معلّق", payment_review: "مراجعة الدفع", paid: "مدفوع", processing: "قيد التنفيذ", completed: "مكتمل", rejected: "مرفوض", cancelled: "ملغي" };
const tone = { pending: "bg-gold-500/15 text-gold-300", payment_review: "bg-blue-500/15 text-blue-300", paid: "bg-cyan-500/15 text-cyan-300", processing: "bg-violet-500/15 text-violet-300", completed: "bg-emerald-500/15 text-emerald-300", rejected: "bg-red-500/15 text-red-300", cancelled: "bg-red-500/15 text-red-300" };

function CopyBtn({ text }) {
    const [ok, setOk] = useState(false);
    return <button type="button" onClick={async () => { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }} className="text-gold-400">{ok ? <Check className="size-5"/> : <Copy className="size-5"/>}</button>;
}

export default function Orders() {
    const user = useUser();
    const localOrders = useOrders().filter((o) => o.walletId === user?.walletId);
    const notice = useLocation().state?.notice;
    const [orders, setOrders] = useState([]);
    const [filter, setFilter] = useState("all");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const load = async () => {
        setBusy(true); setError("");
        try { setOrders(getToken() ? await api("/orders/my") : localOrders); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-time load/cleanup
    useEffect(() => { load(); }, []);
    const list = filter === "all" ? orders : orders.filter((o) => o.status === filter);
    const cancel = async (order) => {
        if (!window.confirm("إلغاء الطلب وإعادة المبلغ إلى محفظتك؟")) return;
        try { const updated = await api("/orders/" + order._id + "/cancel", { method: "POST" }); setOrders((items) => items.map((x) => x._id === updated._id ? updated : x)); }
        catch (e) { setError(e.message); }
    };
    return <Page title="طلباتي">
        {notice && <Notice>{notice}</Notice>}
        {error && <Notice bad>{error}</Notice>}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto">{[["all", "الكل"], ...Object.entries(labels)].map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={"shrink-0 rounded-xl border px-3 py-2 text-sm " + (filter === key ? "border-gold-500 bg-gold-500 font-bold text-ink-950" : "border-ink-700 bg-ink-900")}>{label}{key !== "all" && <span className="ms-1 opacity-70">{orders.filter((o) => o.status === key).length}</span>}</button>)}<button type="button" onClick={load} className="shrink-0 rounded-xl border border-ink-700 p-2"><RefreshCw className={"size-5 " + (busy ? "animate-spin" : "")}/></button></div>
        {!list.length ? <div className={card + " mt-5 flex flex-col items-center gap-3 p-8 text-center text-mute"}><PackageOpen className="size-10 text-gold-400"/><p>{busy ? "جارٍ تحميل طلباتك..." : orders.length ? "لا توجد طلبات بهذه الحالة." : "لم تقم بأي طلب بعد."}</p>{!orders.length && !busy && <Link to="/" className="rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-5 py-2.5 text-sm font-bold text-ink-950">تصفح المنتجات</Link>}</div>
        : <div className="mt-5 space-y-3">{list.map((order) => {
            const remote = Boolean(order._id), items = remote ? order.items : [{ name: order.productName, packageTitle: order.pkgLabel, quantity: 1 }];
            return <article key={order._id || order.id} className={card + " p-4"}>
                <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-gold-300" dir="ltr">{remote ? order.orderNumber : "#" + order.id}</p><p className="mt-1 text-xs text-mute">{new Date(remote ? order.createdAt : order.date).toLocaleString("ar-SY")}</p></div><span className={"rounded-full px-2 py-1 text-xs font-bold " + tone[order.status]}>{labels[order.status] || order.status}</span></div>
                <div className="mt-3 space-y-1">{items.map((item, index) => <p key={index} className="text-sm">{item.name} — {item.packageTitle} × {item.quantity}</p>)}</div>
                <div className="mt-3 flex justify-between border-t border-ink-700 pt-3"><span className="text-sm text-mute">الإجمالي</span><span className="font-bold text-gold-300" dir="ltr">{"$"}{Number(remote ? order.totalAmount : order.price).toFixed(2)}</span></div>
                {remote && Object.keys(order.customerData || {}).length > 0 && <dl className="mt-3 rounded-xl bg-ink-800 p-3">{Object.entries(order.customerData).map(([key, value]) => <div key={key} className="flex justify-between gap-3 text-sm"><dt className="text-mute">{key}</dt><dd className="break-all">{String(value)}</dd></div>)}</dl>}
                {(order.deliveryCode || order.delivery) && <div className="mt-3 rounded-xl border border-dashed border-gold-500/50 p-3"><p className="mb-1 text-xs text-mute">{order.status === "completed" || order.status === "done" ? "تفاصيل التسليم" : "الملاحظة"}</p><div className="flex justify-between gap-3"><p className="select-all whitespace-pre-wrap break-all text-sm text-gold-300">{order.deliveryCode || order.delivery}</p><CopyBtn text={order.deliveryCode || order.delivery}/></div></div>}
                {remote && order.status === "pending" && <button type="button" onClick={() => cancel(order)} className="mt-3 w-full rounded-xl border border-red-500/50 py-2.5 text-sm font-bold text-red-300">إلغاء الطلب واسترجاع الرصيد</button>}
            </article>;
        })}</div>}
    </Page>;
}
