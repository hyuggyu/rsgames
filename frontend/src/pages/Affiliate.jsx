import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Gift, Landmark, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { api } from "../lib/api";
import Page, { card, Notice } from "../components/Page";

const names = { silver: "فضي", gold: "ذهبي", platinum: "بلاتيني", api: "API" };

export default function Affiliate() {
    const [data, setData] = useState(null);
    const [copied, setCopied] = useState(false);
    const [points, setPoints] = useState("");
    const [message, setMessage] = useState(null);
    const [busy, setBusy] = useState(false);
    const [withdrawal, setWithdrawal] = useState({ methodId: "", amount: "", payoutData: {} });
    const load = useCallback(() => Promise.all([api("/affiliate/me"), api("/affiliate/settings"), api("/affiliate/withdrawal-methods"), api("/affiliate/withdrawals")]).then(([account, config, methods, withdrawals]) => setData({ account, config, methods, withdrawals })).catch((e) => setMessage({ bad: true, text: e.message })), []);
    useEffect(() => { load(); }, [load]);

    const account = data?.account, config = data?.config;
    const link = window.location.origin + "/login?ref=" + (account?.affiliateCode || "");
    const current = config?.levels?.[account?.agentLevel]?.minSales || 0;
    const target = account?.nextTarget;
    const progress = target ? Math.min(100, Math.max(0, ((Number(account?.affiliateSales || 0) - current) / (target - current)) * 100)) : 100;

    const redeem = async (e) => {
        e.preventDefault(); setBusy(true); setMessage(null);
        try {
            const result = await api("/affiliate/redeem", { method: "POST", body: JSON.stringify({ points: Number(points) }) });
            setPoints(""); setMessage({ text: "تمت إضافة " + result.amount.toFixed(2) + "$ إلى رصيدك." }); await load();
        } catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };
    const selectedMethod = data?.methods?.find((method) => method.id === withdrawal.methodId);
    const withdrawalFee = Number(withdrawal.amount || 0) * Number(selectedMethod?.feePercent || 0) / 100;
    const requestWithdrawal = async (e) => {
        e.preventDefault(); setBusy(true); setMessage(null);
        try {
            await api("/affiliate/withdrawals", { method: "POST", body: JSON.stringify({ methodId: withdrawal.methodId, amount: Number(withdrawal.amount), payoutData: withdrawal.payoutData }) });
            setWithdrawal({ methodId: "", amount: "", payoutData: {} }); setMessage({ text: "تم إرسال طلب السحب وحجز النقاط حتى انتهاء المراجعة." }); await load();
        } catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };

    const stats = [
        [TrendingUp, "المستوى", names[account?.agentLevel] || "—"],
        [Gift, "النقاط", account?.affiliatePoints ?? 0],
        [Users, "المسجلون", account?.referredUsers ?? 0],
        [ShoppingCart, "طلبات الإحالة", account?.affiliateOrders ?? 0]
    ];

    return <Page title="برنامج الوكلاء">
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{stats.map(([Icon, label, value]) => <div key={label} className={card + " p-4"}><Icon className="size-6 text-gold-400"/><p className="mt-3 text-xs text-mute">{label}</p><p className="mt-1 font-bold text-gold-300">{value}</p></div>)}</div>

        <section className={card + " mt-5 p-4"}>
            <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">تقدم المستوى</h2><p className="mt-1 text-xs text-mute">مبيعات الإحالة: {"$"}{Number(account?.affiliateSales || 0).toFixed(2)}</p></div><span className="rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-xs text-gold-300">{account?.nextLevel ? "التالي: " + names[account.nextLevel] : "أعلى مستوى"}</span></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-gradient-to-l from-gold-300 to-gold-600" style={{ width: progress + "%" }}/></div>
            {account?.nextLevel && <p className="mt-2 text-xs text-mute">متبقي {Number(account.remainingSales || 0).toFixed(2)}$ للترقية تلقائيًا.</p>}
        </section>

        <section className={card + " mt-5 p-4"}><h2 className="font-bold">رابط الإحالة الخاص بك</h2><p className="mt-2 text-sm text-mute">كل مستخدم يسجل من الرابط سيُربط بحسابك.</p><div className="mt-4 flex items-center gap-2 rounded-xl border border-gold-500/40 bg-ink-800 p-3"><span className="min-w-0 flex-1 truncate text-xs" dir="ltr">{link}</span><button type="button" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-gold-400">{copied ? <Check className="size-5"/> : <Copy className="size-5"/>}</button></div></section>

        <form onSubmit={redeem} className={card + " mt-5 space-y-3 p-4"}><div><h2 className="font-bold">استبدال النقاط</h2><p className="mt-1 text-xs text-mute">كل {config?.pointsToDollar || 100} نقطة = 1$، والحد الأدنى {config?.minimumRedeemPoints || 100} نقطة.</p></div><div className="flex gap-2"><input type="number" min={config?.minimumRedeemPoints || 100} value={points} onChange={(e) => setPoints(e.target.value)} placeholder="عدد النقاط" className="min-w-0 flex-1 rounded-xl border border-ink-700 bg-ink-800 px-3 py-3 outline-none focus:border-gold-500" dir="ltr"/><button disabled={busy || !points} className="rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-5 font-bold text-ink-950 disabled:opacity-50">{busy ? "جارٍ..." : "استبدال"}</button></div></form>
        <section className={card + " mt-5 p-4"}><div className="flex items-center gap-2"><Landmark className="size-5 text-gold-400"/><h2 className="font-bold">سحب أرباح الوكيل</h2></div><p className="mt-1 text-xs text-mute">تُحجز النقاط عند الطلب وتُعاد تلقائيًا عند الرفض.</p>
            <form onSubmit={requestWithdrawal} className="mt-4 space-y-3"><select value={withdrawal.methodId} onChange={(e) => setWithdrawal({ methodId: e.target.value, amount: "", payoutData: {} })} className="w-full rounded-xl border border-ink-700 bg-ink-800 px-3 py-3"><option value="">اختر طريقة السحب</option>{(data?.methods || []).map((method) => <option key={method.id} value={method.id}>{method.name} — عمولة {method.feePercent}%</option>)}</select>{selectedMethod && <><p className="text-xs text-mute">{selectedMethod.instructions}</p><div className="grid gap-3 sm:grid-cols-2"><input type="number" min={selectedMethod.minAmount} max={Number(selectedMethod.maxAmount) || undefined} step="0.01" value={withdrawal.amount} onChange={(e) => setWithdrawal({ ...withdrawal, amount: e.target.value })} placeholder={`المبلغ (الحد الأدنى ${selectedMethod.minAmount}$)`} className="rounded-xl border border-ink-700 bg-ink-800 px-3 py-3" dir="ltr"/>{(selectedMethod.fields || []).map((field) => <input key={field.key} type={field.type || "text"} required={field.required !== false} value={withdrawal.payoutData[field.key] || ""} onChange={(e) => setWithdrawal({ ...withdrawal, payoutData: { ...withdrawal.payoutData, [field.key]: e.target.value } })} placeholder={field.label} className="rounded-xl border border-ink-700 bg-ink-800 px-3 py-3"/>)}</div><div className="rounded-xl bg-ink-800 p-3 text-xs text-mute">العمولة: <span className="text-red-300" dir="ltr">{withdrawalFee.toFixed(2)} USD</span> — الصافي: <span className="text-emerald-300" dir="ltr">{Math.max(0, Number(withdrawal.amount || 0) - withdrawalFee).toFixed(2)} USD</span></div><button disabled={busy || !withdrawal.amount} className="w-full rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-5 py-3 font-bold text-ink-950 disabled:opacity-50">{busy ? "جارٍ الإرسال..." : "إرسال طلب السحب"}</button></>}</form>
            <div className="mt-5 space-y-2">{(data?.withdrawals || []).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-ink-800 p-3 text-sm"><div className="min-w-0 flex-1"><p className="font-medium" dir="ltr">{item.requestNumber}</p><p className="text-xs text-mute">{item.method?.name} · {new Date(item.createdAt).toLocaleDateString("ar-SY")}</p></div><p className="text-end"><span dir="ltr">{Number(item.netAmount).toFixed(2)} USD</span><br/><span className={item.status === "approved" ? "text-emerald-300" : item.status === "rejected" ? "text-red-300" : "text-amber-300"}>{item.status === "approved" ? "مقبول" : item.status === "rejected" ? "مرفوض" : "قيد المراجعة"}</span></p></div>)}</div>
        </section>
        {message && <Notice bad={message.bad}>{message.text}</Notice>}
    </Page>;
}
