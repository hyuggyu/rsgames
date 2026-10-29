import { useEffect, useMemo, useState } from "react";
import { Banknote, ChevronLeft, Percent, RefreshCw, ShoppingCart, TrendingUp, TriangleAlert, Users, Wallet } from "lucide-react";
import { api } from "../../lib/api";
import { auditText } from "../../lib/audit";

const usd = (value) => "$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));
const panel = "rounded-2xl border border-ink-700 bg-ink-900 p-4";
const statuses = { pending: "معلّق", payment_review: "مراجعة الدفع", paid: "مدفوع", processing: "قيد التنفيذ", completed: "مكتمل", rejected: "مرفوض", cancelled: "ملغي" };

function Kpi({ icon: Icon, label, value, sub, onClick, hot }) {
    const Component = onClick ? "button" : "div";
    return <Component type={onClick ? "button" : undefined} onClick={onClick} className={panel + " text-start " + (onClick ? "hover:border-gold-500 " : "") + (hot ? "border-gold-500/70 bg-gold-500/10" : "")}><div className="flex items-center justify-between text-mute"><span className="text-xs">{label}</span><Icon className="size-4 text-gold-400"/></div><p className="mt-2 text-xl font-extrabold text-gold-300" dir="ltr">{value}</p>{sub && <p className="mt-0.5 text-xs text-mute">{sub}</p>}</Component>;
}

function Bars({ rows, format }) {
    const max = Math.max(1, ...rows.map((row) => row.total));
    return <ul className="space-y-3">{rows.map((row) => <li key={row._id || row.name}><div className="flex justify-between text-sm"><span className="truncate" dir="auto">{row.name}</span><span className="text-gold-300" dir="ltr">{format(row)}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full bg-gradient-to-l from-gold-300 to-gold-600" style={{ width: (row.total / max) * 100 + "%" }}/></div></li>)}</ul>;
}

const buildSeries = (source = []) => {
    const values = new Map(source.map((item) => [item._id, item]));
    return Array.from({ length: 14 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (13 - index)); const key = date.toLocaleDateString("en-CA", { timeZone: "Asia/Damascus" }); const item = values.get(key) || {}; return { key, label: date.toLocaleDateString("ar-SY", { day: "numeric", month: "numeric", timeZone: "Asia/Damascus" }), total: item.total || 0, count: item.count || 0 }; });
};

export default function Dashboard({ go }) {
    const [stats, setStats] = useState(null);
    const [log, setLog] = useState([]);
    const [categories, setCategories] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const load = async () => {
        setBusy(true); setError("");
        try {
            const [data, audit, categoryList] = await Promise.all([api("/admin/stats"), api("/admin/audit-logs?limit=10"), api("/admin/categories")]);
            setStats(data); setLog(audit.items); setCategories(Object.fromEntries(categoryList.map((item) => [item.slug, item.label])));
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };
    useEffect(() => { load(); }, []);
    const series = useMemo(() => buildSeries(stats?.orders?.series), [stats]);
    const maxDay = Math.max(1, ...series.map((item) => item.total));

    if (!stats) return <div className={panel + " text-center text-mute"}>{error || "جارٍ تحميل بيانات لوحة التحكم..."}</div>;
    const oldestMinutes = stats.orders.oldestPending ? Math.max(1, Math.round((Date.now() - new Date(stats.orders.oldestPending).getTime()) / 60000)) : 0;
    const alerts = [
        stats.orders.pending > 0 && { text: stats.orders.pending + " طلب بانتظار التنفيذ" + (oldestMinutes ? " — الأقدم منذ " + oldestMinutes + " دقيقة" : ""), tab: "orders" },
        stats.deposits.pending > 0 && { text: stats.deposits.pending + " طلب إيداع بانتظار المراجعة", tab: "deposits" },
        stats.verification.pending > 0 && { text: stats.verification.pending + " طلب توثيق بانتظار المراجعة", tab: "verifications" },
        stats.support.open > 0 && { text: stats.support.open + " تذكرة دعم بانتظار الرد", tab: "support" },
        stats.feedback?.pending > 0 && { text: stats.feedback.pending + " شكوى أو اقتراح بانتظار الرد", tab: "feedback" },
        stats.products.lowStock.length > 0 && { text: stats.products.lowStock.length + " باقة تحتاج إلى تعبئة مخزن الأكواد", tab: "codes" }
    ].filter(Boolean);
    const categoryRows = stats.categories.map((item) => ({ ...item, name: categories[item._id] || item._id }));

    return <div className="space-y-5">
        <div className="flex items-center justify-between"><p className="text-xs text-mute">بيانات مباشرة من قاعدة البيانات</p><button type="button" onClick={load} disabled={busy} className="rounded-xl border border-ink-700 p-2 text-gold-400"><RefreshCw className={(busy ? "animate-spin " : "") + "size-4"}/></button></div>
        {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        {alerts.length ? <section className="space-y-2">{alerts.map((alert) => <button key={alert.text} type="button" onClick={() => go(alert.tab)} className="flex w-full items-center gap-3 rounded-xl border border-gold-500/50 bg-gold-500/10 px-4 py-3 text-start text-sm text-gold-200"><TriangleAlert className="size-4 shrink-0 text-gold-400"/><span className="flex-1">{alert.text}</span><ChevronLeft className="size-4"/></button>)}</section> : <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">كل شيء على ما يرام، لا توجد مهام معلّقة.</p>}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={TrendingUp} label="إجمالي المبيعات" value={usd(stats.orders.revenue)} sub={stats.orders.completed + " طلب مكتمل"}/>
            <Kpi icon={TrendingUp} label="مبيعات اليوم" value={usd(stats.orders.salesToday)} sub={"آخر 30 يومًا: " + usd(stats.orders.sales30)}/>
            <Kpi icon={ShoppingCart} label="الطلبات" value={stats.orders.total} sub={stats.orders.pending + " قيد المعالجة"} onClick={() => go("orders")} hot={stats.orders.pending > 0}/>
            <Kpi icon={Banknote} label="إيداعات معلّقة" value={stats.deposits.pending} sub={Object.entries(stats.deposits.approved).map(([currency,value]) => Number(value).toLocaleString("en-US") + " " + currency).join(" · ") || "لا إيداعات مقبولة"} onClick={() => go("deposits")} hot={stats.deposits.pending > 0}/>
            <Kpi icon={Users} label="المستخدمون" value={stats.users.total} sub={"+" + stats.users.new7 + " هذا الأسبوع" + (stats.users.blocked ? " · " + stats.users.blocked + " موقوف" : "")} onClick={() => go("users")}/>
            <Kpi icon={Wallet} label="أرصدة المحافظ (USD)" value={usd(stats.users.balances.USD)} sub="التزامات على المتجر"/>
            <Kpi icon={Percent} label="إجمالي الخصومات" value={usd(stats.orders.discounts)} onClick={() => go("coupons")}/>
            <Kpi icon={ShoppingCart} label="متوسط الطلب المكتمل" value={usd(stats.orders.average)}/>
        </section>

        <section className={panel}><h2 className="mb-4 font-bold">المبيعات خلال آخر 14 يومًا</h2><div className="flex h-40 items-end gap-1.5" dir="ltr" role="img" aria-label="مخطط المبيعات اليومية">{series.map((day) => <div key={day.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={day.key + ": " + usd(day.total) + " · " + day.count + " طلب"}><div className="w-full rounded-t bg-gradient-to-t from-gold-600 to-gold-300" style={{ height: Math.max(day.total ? 4 : 1, (day.total / maxDay) * 100) + "%", opacity: day.total ? 1 : 0.25 }}/><span className="text-[10px] text-mute">{day.label}</span></div>)}</div></section>

        {stats.products.lowStock.length > 0 && <section className={panel}><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">تنبيه مخزون الأكواد</h2><button type="button" onClick={() => go("codes")} className="text-xs text-gold-400">إدارة المخزن</button></div><div className="grid gap-2 sm:grid-cols-2">{stats.products.lowStock.map((item) => <div key={item.productId + item.packageId} className="flex justify-between rounded-xl bg-ink-800 p-3 text-sm"><span>{item.product} — {item.package}</span><span className={item.available === 0 ? "font-bold text-red-300" : "font-bold text-gold-300"}>{item.available} متاح</span></div>)}</div></section>}

        <div className="grid gap-5 lg:grid-cols-2">
            <section className={panel}><h2 className="mb-4 font-bold">الأكثر مبيعًا</h2>{stats.orders.topProducts.length ? <Bars rows={stats.orders.topProducts} format={(row) => usd(row.total) + " · " + row.count}/> : <p className="text-sm text-mute">لا مبيعات بعد.</p>}</section>
            <section className={panel}><h2 className="mb-4 font-bold">المبيعات حسب القسم</h2>{categoryRows.length ? <Bars rows={categoryRows} format={(row) => usd(row.total)}/> : <p className="text-sm text-mute">لا مبيعات بعد.</p>}</section>
            <section className={panel}><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">آخر الطلبات</h2><button type="button" onClick={() => go("orders")} className="text-xs text-gold-400">الكل</button></div>{stats.orders.recent.length ? <ul className="divide-y divide-ink-700">{stats.orders.recent.map((order) => <li key={order._id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><div className="min-w-0"><p className="truncate">{order.items?.[0]?.name || "طلب"} — {order.user?.name || "مستخدم"}</p><p className="text-xs text-mute" dir="ltr">{order.orderNumber} · {new Date(order.createdAt).toLocaleString("ar-SY")}</p></div><div className="shrink-0 text-end"><p className="font-bold text-gold-300" dir="ltr">{usd(order.totalAmount)}</p><p className="text-xs text-mute">{statuses[order.status] || order.status}</p></div></li>)}</ul> : <p className="text-sm text-mute">لا طلبات بعد.</p>}</section>
            <section className={panel}><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">آخر العمليات</h2><button type="button" onClick={() => go("log")} className="text-xs text-gold-400">السجل</button></div>{log.length ? <ul className="divide-y divide-ink-700">{log.slice(0, 6).map((item) => <li key={item._id} className="py-2.5 text-sm"><p>{auditText(item)}</p><p className="text-xs text-mute">{item.admin?.name || "مسؤول"} · {new Date(item.createdAt).toLocaleString("ar-SY")}</p></li>)}</ul> : <p className="text-sm text-mute">لا عمليات مسجّلة بعد.</p>}</section>
        </div>
    </div>;
}
