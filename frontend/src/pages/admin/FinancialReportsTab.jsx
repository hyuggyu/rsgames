import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, PlugZap, RefreshCw, RotateCcw, TrendingUp, Users, WalletCards } from "lucide-react";
import { api } from "../../lib/api";
import { downloadFile, toCsv } from "../../lib/admin";
import { btnGhost, btnGold, inputCls } from "./ui";

const box = "rounded-2xl border border-ink-700 bg-ink-900 p-5";
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const date = new Date(); date.setDate(date.getDate() - 29); return date.toISOString().slice(0, 10); };
const money = (value, currency) => `${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: currency === "SYP" ? 0 : 2 })} ${currency}`;

export default function FinancialReportsTab() {
    const [from, setFrom] = useState(monthAgo);
    const [to, setTo] = useState(today);
    const [report, setReport] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const load = async () => {
        setBusy(true); setError("");
        try { setReport(await api(`/admin/reports/financial?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)); }
        catch (err) { setError(err.message); }
        finally { setBusy(false); }
    };
    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const peak = useMemo(() => Math.max(1, ...(report?.daily || []).map((row) => row.sales.USD || 0)), [report]);
    const exportReport = () => {
        if (!report) return;
        const rows = report.daily.flatMap((row) => ["USD", "SYP", "TRY"].map((currency) => [row.date, currency, row.orders, row.sales[currency], row.deposits[currency]]));
        downloadFile(`financial-report-${from}-${to}.csv`, toCsv(["Date", "Currency", "Completed orders", "Sales", "Approved deposits"], rows), "text/csv;charset=utf-8");
    };
    return <div className="space-y-5">
        <section className={box}><div className="flex flex-wrap items-end gap-3">
            <div className="flex-1"><h2 className="flex items-center gap-2 font-bold"><BarChart3 className="size-5 text-gold-400"/>التقارير المالية</h2><p className="mt-1 text-sm text-mute">المبيعات والإيداعات والخصومات والأرباح مفصولة حسب العملة.</p></div>
            <label className="text-xs text-mute">من<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${inputCls()} mt-1 block`} /></label>
            <label className="text-xs text-mute">إلى<input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} className={`${inputCls()} mt-1 block`} /></label>
            <button type="button" disabled={busy || !from || !to} onClick={load} className={`${btnGold} flex items-center gap-2`}><RefreshCw className={(busy ? "animate-spin " : "") + "size-4"}/>تحديث</button>
            <button type="button" disabled={!report || busy} onClick={exportReport} className={`${btnGhost} flex items-center gap-2`}><Download className="size-4"/>CSV</button>
        </div>{error && <p className="mt-4 rounded-xl border border-red-500/40 p-3 text-sm text-red-300">{error}</p>}</section>
        {report && <>
            <section className="grid gap-3 md:grid-cols-3">{["USD", "SYP", "TRY"].map((currency) => <article key={currency} className={box}><p className="text-xs text-mute">إجمالي المبيعات — {currency}</p><p className="mt-2 text-2xl font-extrabold text-gold-300" dir="ltr">{money(report.totals.sales[currency], currency)}</p><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><span className="text-mute">الإيداعات</span><p className="mt-1" dir="ltr">{money(report.totals.approvedDeposits[currency], currency)}</p></div><div><span className="text-mute">الخصومات</span><p className="mt-1" dir="ltr">{money(report.totals.discounts[currency], currency)}</p></div><div><span className="text-mute">المسترجع</span><p className="mt-1 text-red-300" dir="ltr">{money(report.totals.refunds[currency], currency)}</p></div></div></article>)}</section>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4"><div className={box}><p className="text-xs text-mute">كل الطلبات</p><p className="mt-2 text-2xl font-extrabold">{report.counts.orders}</p></div><div className={box}><p className="text-xs text-mute">المكتملة</p><p className="mt-2 text-2xl font-extrabold text-emerald-300">{report.counts.completedOrders}</p></div><div className={box}><p className="text-xs text-mute">الملغاة</p><p className="mt-2 text-2xl font-extrabold text-amber-300">{report.counts.cancelledOrders}</p></div><div className={box}><p className="text-xs text-mute">المرفوضة</p><p className="mt-2 text-2xl font-extrabold text-red-300">{report.counts.rejectedOrders}</p></div></section>
            <section className={box}><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><TrendingUp className="size-5 text-gold-400"/>المبيعات اليومية بالدولار</h2><span className="text-xs text-mute">{report.counts.completedOrders} طلب مكتمل</span></div><div className="mt-5 flex h-44 items-end gap-1 overflow-x-auto border-b border-ink-700 pb-1" dir="ltr">{report.daily.map((row) => <div key={row.date} className="group flex min-w-5 flex-1 flex-col items-center justify-end" title={`${row.date}: ${money(row.sales.USD, "USD")}`}><span className="mb-1 hidden text-[9px] text-mute group-hover:block">{Number(row.sales.USD).toFixed(0)}</span><div className="w-full max-w-8 rounded-t bg-gradient-to-t from-gold-700 to-gold-300" style={{ height: `${Math.max(2, (row.sales.USD / peak) * 130)}px` }}/></div>)}</div></section>
            <section className={box}><h2 className="flex items-center gap-2 font-bold"><WalletCards className="size-5 text-gold-400"/>المنتجات الأكثر مبيعاً</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[540px] text-sm"><thead className="text-xs text-mute"><tr className="border-b border-ink-700"><th className="p-2 text-start">المنتج</th><th className="p-2">الكمية</th><th className="p-2">الطلبات</th><th className="p-2">إيراد USD</th></tr></thead><tbody>{report.topProducts.map((item) => <tr key={item.productId || item.name} className="border-b border-ink-800"><td className="p-2 font-medium">{item.name}</td><td className="p-2 text-center" dir="ltr">{item.quantity}</td><td className="p-2 text-center" dir="ltr">{item.orders}</td><td className="p-2 text-center text-gold-300" dir="ltr">{money(item.revenue.USD, "USD")}</td></tr>)}{!report.topProducts.length && <tr><td colSpan="4" className="p-6 text-center text-mute">لا توجد مبيعات مكتملة ضمن هذه الفترة.</td></tr>}</tbody></table></div></section>
            <section className={box}><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-bold"><Users className="size-5 text-gold-400"/>أداء الوكلاء</h2><span className="flex items-center gap-1 text-xs text-mute"><RotateCcw className="size-3"/>المحوّل إلى رصيد: {money(report.totals.affiliateRedeems.USD, "USD")}</span></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="text-xs text-mute"><tr className="border-b border-ink-700"><th className="p-2 text-start">الوكيل</th><th className="p-2">المستوى</th><th className="p-2">مبيعات الفترة</th><th className="p-2">الطلبات</th><th className="p-2">قيمة النقاط الحالية</th></tr></thead><tbody>{report.topAgents.map((agent) => <tr key={agent.id} className="border-b border-ink-800"><td className="p-2"><p className="font-medium">{agent.name}</p><p className="text-xs text-mute" dir="ltr">{agent.code}</p></td><td className="p-2 text-center uppercase">{agent.level}</td><td className="p-2 text-center text-gold-300" dir="ltr">{money(agent.periodSales, "USD")}</td><td className="p-2 text-center" dir="ltr">{agent.periodOrders}</td><td className="p-2 text-center" dir="ltr">{money(agent.estimatedRewardUSD, "USD")}</td></tr>)}{!report.topAgents.length && <tr><td colSpan="5" className="p-6 text-center text-mute">لا توجد مبيعات وكلاء ضمن هذه الفترة.</td></tr>}</tbody></table></div></section>
            <section className={box}><h2 className="flex items-center gap-2 font-bold"><PlugZap className="size-5 text-gold-400"/>أداء مزوّدي API</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="text-xs text-mute"><tr className="border-b border-ink-700"><th className="p-2 text-start">المزوّد</th><th className="p-2">العمليات</th><th className="p-2">النجاح</th><th className="p-2">الفشل</th><th className="p-2">نسبة النجاح</th><th className="p-2">متوسط الزمن</th><th className="p-2">التحويلات</th></tr></thead><tbody>{report.providers.map((provider) => <tr key={provider.id} className="border-b border-ink-800"><td className="p-2"><p className="font-medium">{provider.name}</p><p className="text-xs text-mute">أولوية {provider.priority}</p></td><td className="p-2 text-center">{provider.total}</td><td className="p-2 text-center text-emerald-300">{provider.completed}</td><td className="p-2 text-center text-red-300">{provider.failed}</td><td className="p-2 text-center" dir="ltr">{provider.successRate}%</td><td className="p-2 text-center" dir="ltr">{provider.averageDurationSeconds == null ? "—" : `${provider.averageDurationSeconds}s`}</td><td className="p-2 text-center">{provider.switches}</td></tr>)}{!report.providers.length && <tr><td colSpan="7" className="p-6 text-center text-mute">لا توجد عمليات API ضمن هذه الفترة.</td></tr>}</tbody></table></div></section>
        </>}
    </div>;
}
