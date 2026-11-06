import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, Clock3, Copy, LockKeyhole, Mail, PackageOpen, RefreshCw } from "lucide-react";
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
    const [revealed, setRevealed] = useState({});
    const [secure, setSecure] = useState(null);
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
        try { const id = order._id || order.id; const updated = await api("/orders/" + id + "/cancel", { method: "POST" }); setOrders((items) => items.map((x) => (x._id || x.id) === (updated._id || updated.id) ? updated : x)); }
        catch (e) { setError(e.message); }
    };
    const revealWithPin = async (orderId) => {
        setBusy(true); setError("");
        try { const result = await api(`/orders/${orderId}/reveal`, { method: "POST", body: JSON.stringify({ method: "pin", pin: secure.pin }) }); setRevealed((items) => ({ ...items, [orderId]: result.deliveryCode })); setSecure(null); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    const requestOtp = async (orderId) => {
        setBusy(true); setError("");
        try { const result = await api(`/orders/${orderId}/reveal/request`, { method: "POST" }); setSecure({ orderId, mode: "otp", code: "", challengeToken: result.challengeToken, maskedEmail: result.maskedEmail }); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    const revealWithOtp = async () => {
        setBusy(true); setError("");
        try { const result = await api(`/orders/${secure.orderId}/reveal`, { method: "POST", body: JSON.stringify({ method: "otp", challengeToken: secure.challengeToken, code: secure.code }) }); setRevealed((items) => ({ ...items, [secure.orderId]: result.deliveryCode })); setSecure(null); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    return <Page title="طلباتي">
        {notice && <Notice>{notice}</Notice>}
        {error && <Notice bad>{error}</Notice>}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto">{[["all", "الكل"], ...Object.entries(labels)].map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={"shrink-0 rounded-xl border px-3 py-2 text-sm " + (filter === key ? "border-gold-500 bg-gold-500 font-bold text-ink-950" : "border-ink-700 bg-ink-900")}>{label}{key !== "all" && <span className="ms-1 opacity-70">{orders.filter((o) => o.status === key).length}</span>}</button>)}<button type="button" onClick={load} className="shrink-0 rounded-xl border border-ink-700 p-2"><RefreshCw className={"size-5 " + (busy ? "animate-spin" : "")}/></button></div>
        {!list.length ? <div className={card + " mt-5 flex flex-col items-center gap-3 p-8 text-center text-mute"}><PackageOpen className="size-10 text-gold-400"/><p>{busy ? "جارٍ تحميل طلباتك..." : orders.length ? "لا توجد طلبات بهذه الحالة." : "لم تقم بأي طلب بعد."}</p>{!orders.length && !busy && <Link to="/" className="rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-5 py-2.5 text-sm font-bold text-ink-950">تصفح المنتجات</Link>}</div>
        : <div className="mt-5 space-y-3">{list.map((order) => {
            const remote = Boolean(order._id || order.orderNumber), items = remote ? order.items : [{ name: order.productName, packageTitle: order.pkgLabel, quantity: 1 }];
            const orderId = order._id || order.id;
            return <article key={order._id || order.id} className={card + " p-4"}>
                <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-gold-300" dir="ltr">{remote ? order.orderNumber : "#" + order.id}</p><p className="mt-1 text-xs text-mute">{new Date(remote ? order.createdAt : order.date).toLocaleString("ar-SY")}</p></div><span className={"rounded-full px-2 py-1 text-xs font-bold " + tone[order.status]}>{labels[order.status] || order.status}</span></div>
                <div className="mt-3 space-y-1">{items.map((item, index) => <p key={index} className="text-sm">{item.name} — {item.packageTitle} × {item.quantity}</p>)}</div>
                <div className="mt-3 flex justify-between border-t border-ink-700 pt-3"><span className="text-sm text-mute">الإجمالي</span><span className="font-bold text-gold-300" dir="ltr">{"$"}{Number(remote ? order.totalAmount : order.price).toFixed(2)}</span></div>
                {remote && Object.keys(order.customerData || {}).length > 0 && <dl className="mt-3 rounded-xl bg-ink-800 p-3">{Object.entries(order.customerData).map(([key, value]) => <div key={key} className="flex justify-between gap-3 text-sm"><dt className="text-mute">{key}</dt><dd className="break-all">{String(value)}</dd></div>)}</dl>}
                {remote && order.hasDeliveryCode && !revealed[orderId] && <div className="mt-3 rounded-xl border border-gold-500/40 bg-gold-500/5 p-4"><div className="flex items-center gap-2"><LockKeyhole className="size-5 text-gold-400"/><div><p className="font-bold">كود الشحن محمي</p><p className="text-xs text-mute">تحقق من هويتك قبل عرض الكود.</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setSecure({ orderId, mode: "pin", pin: "" })} className="rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-3 py-2.5 text-sm font-bold text-ink-950">استخدام PIN</button><button type="button" disabled={busy} onClick={() => requestOtp(orderId)} className="flex items-center justify-center gap-2 rounded-xl border border-ink-600 px-3 py-2.5 text-sm"><Mail className="size-4"/>رمز عبر البريد</button></div></div>}
                {revealed[orderId] && <div className="mt-3 rounded-xl border border-dashed border-gold-500/50 p-3"><p className="mb-1 text-xs text-mute">كود الشحن — لا تشاركه</p><div className="flex justify-between gap-3"><p className="select-all whitespace-pre-wrap break-all text-sm text-gold-300">{revealed[orderId]}</p><CopyBtn text={revealed[orderId]}/></div></div>}
                {(order.deliveryCode || order.delivery) && <div className="mt-3 rounded-xl border border-dashed border-gold-500/50 p-3"><p className="mb-1 text-xs text-mute">{order.status === "completed" || order.status === "done" ? "تفاصيل التسليم" : "الملاحظة"}</p><div className="flex justify-between gap-3"><p className="select-all whitespace-pre-wrap break-all text-sm text-gold-300">{order.deliveryCode || order.delivery}</p><CopyBtn text={order.deliveryCode || order.delivery}/></div></div>}
                {remote && order.status === "pending" && <button type="button" onClick={() => cancel(order)} className="mt-3 w-full rounded-xl border border-red-500/50 py-2.5 text-sm font-bold text-red-300">إلغاء الطلب واسترجاع الرصيد</button>}
                {remote && order.events?.length > 0 && <details className="mt-3 rounded-xl border border-ink-700 bg-ink-800/60 p-3"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-gold-300"><Clock3 className="size-4" />تتبع رحلة الطلب <span className="ms-auto text-xs text-mute">{order.events.length} تحديثات</span></summary><div className="relative mt-4 space-y-4 ps-5 before:absolute before:bottom-2 before:start-[7px] before:top-2 before:w-px before:bg-ink-600">{order.events.map((event) => <div key={event._id || event.id} className="relative"><span className={(event.status === "completed" ? "bg-emerald-400" : event.status === "cancelled" || event.status === "rejected" ? "bg-red-400" : event.eventKey === "delay-alert" ? "bg-amber-400" : "bg-gold-400") + " absolute -start-5 top-1.5 size-2.5 rounded-full ring-4 ring-ink-800"}/><p className="text-sm font-semibold">{event.title}</p>{event.message && <p className="mt-0.5 text-xs leading-relaxed text-mute">{event.message}</p>}<p className="mt-1 text-[10px] text-mute">{new Date(event.createdAt).toLocaleString("ar-SY")}</p></div>)}</div></details>}
            </article>;
        })}</div>}
        {secure && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"><div className="w-full max-w-sm rounded-2xl border border-gold-500/40 bg-ink-900 p-5"><div className="flex items-center gap-2"><LockKeyhole className="size-6 text-gold-400"/><h2 className="font-bold">التحقق لعرض الكود</h2></div>{secure.mode === "pin" ? <><p className="mt-2 text-sm text-mute">أدخل PIN الخاص بمحفظتك.</p><input type="password" inputMode="numeric" maxLength="8" value={secure.pin} onChange={(e) => setSecure({ ...secure, pin: e.target.value.replace(/\D/g, "") })} className="mt-4 w-full rounded-xl border border-ink-700 bg-ink-800 px-3 py-3 text-center tracking-[0.4em]" autoFocus/><button type="button" disabled={busy || secure.pin.length < 4} onClick={() => revealWithPin(secure.orderId)} className="mt-3 w-full rounded-xl bg-gold-400 py-3 font-bold text-ink-950">{busy ? "جارٍ التحقق..." : "عرض الكود"}</button></> : <><p className="mt-2 text-sm text-mute">أرسلنا رمزًا من 6 أرقام إلى <span dir="ltr">{secure.maskedEmail}</span>.</p><input type="text" inputMode="numeric" maxLength="6" value={secure.code} onChange={(e) => setSecure({ ...secure, code: e.target.value.replace(/\D/g, "") })} className="mt-4 w-full rounded-xl border border-ink-700 bg-ink-800 px-3 py-3 text-center tracking-[0.4em]" autoFocus/><button type="button" disabled={busy || secure.code.length !== 6} onClick={revealWithOtp} className="mt-3 w-full rounded-xl bg-gold-400 py-3 font-bold text-ink-950">{busy ? "جارٍ التحقق..." : "تأكيد وعرض الكود"}</button></>}<button type="button" onClick={() => setSecure(null)} className="mt-2 w-full py-2 text-sm text-mute">إلغاء</button></div></div>}
    </Page>;
}
