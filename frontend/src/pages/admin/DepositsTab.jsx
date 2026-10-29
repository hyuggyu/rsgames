import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { api, apiBlob } from "../../lib/api";
import { currencies } from "../../data/store";
import { money } from "../../lib/wallet";
import { Empty, Field, Modal, inputCls, btnGold, btnGhost } from "./ui";

const labels = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };
const tone = { pending: "text-gold-300", approved: "text-emerald-300", rejected: "text-red-300" };

export default function DepositsTab() {
    const [deposits, setDeposits] = useState([]);
    const [methods, setMethods] = useState([]);
    const [filter, setFilter] = useState("pending");
    const [query, setQuery] = useState("");
    const [rejecting, setRejecting] = useState(null);
    const [reason, setReason] = useState("");
    const [receipt, setReceipt] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const load = async () => { setBusy(true); setError(""); try { const [d, m] = await Promise.all([api("/admin/deposits"), api("/admin/payment-methods")]); setDeposits(d); setMethods(m); } catch (e) { setError(e.message); } finally { setBusy(false); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-time load/cleanup
    useEffect(() => { load(); return () => { if (receipt) URL.revokeObjectURL(receipt); }; }, []);
    const list = useMemo(() => {
        const q = query.trim().toLowerCase();
        return deposits.filter((d) => (filter === "all" || d.status === filter) && (!q || (d.reference + " " + (d.user?.name || "") + " " + (d.user?.email || "")).toLowerCase().includes(q)));
    }, [deposits, filter, query]);
    const saved = (deposit) => setDeposits((items) => items.map((x) => x._id === deposit._id ? deposit : x));
    const approve = async (deposit) => {
        const c = currencies.find((x) => x.code === deposit.currency);
        if (!window.confirm("إضافة " + money(deposit.amount, c) + " إلى محفظة المستخدم وإنشاء فاتورة؟")) return;
        setBusy(true); try { const result = await api("/admin/deposits/" + deposit._id, { method: "PATCH", body: JSON.stringify({ status: "approved" }) }); saved(result.deposit || result); } catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    const reject = async (e) => { e.preventDefault(); setBusy(true); try { saved(await api("/admin/deposits/" + rejecting._id, { method: "PATCH", body: JSON.stringify({ status: "rejected", adminNote: reason.trim() }) })); setRejecting(null); setReason(""); } catch (x) { setError(x.message); } finally { setBusy(false); } };
    const showReceipt = async (url) => { try { if (receipt) URL.revokeObjectURL(receipt); setReceipt(await apiBlob(url.replace(/^.*\/api/, ""))); } catch (e) { setError(e.message); } };
    return <section>
        <div className="scroll-hide -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">{[["all", "الكل"], ...Object.entries(labels)].map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={"shrink-0 rounded-xl border px-3 py-2 text-sm " + (filter === key ? "border-gold-500 bg-gold-500 font-bold text-ink-950" : "border-ink-700 bg-ink-900")}>{label} <span className="opacity-70">{key === "all" ? deposits.length : deposits.filter((d) => d.status === key).length}</span></button>)}</div>
        <div className="mb-4 flex gap-2"><div className="relative flex-1"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gold-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="رقم العملية أو اسم المستخدم" className={inputCls() + " ps-10"}/></div><button type="button" onClick={load} className={btnGhost}><RefreshCw className={"size-4 " + (busy ? "animate-spin" : "")}/></button></div>
        {error && <p className="mb-3 rounded-xl border border-red-500/40 p-3 text-sm text-red-300">{error}</p>}
        {!list.length && <Empty>{busy ? "جارٍ تحميل الإيداعات..." : "لا توجد طلبات مطابقة."}</Empty>}
        <div className="space-y-3">{list.map((deposit) => {
            const c = currencies.find((x) => x.code === deposit.currency), method = methods.find((x) => x.slug === deposit.method);
            return <article key={deposit._id} className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{deposit.user?.name || "مستخدم"}</p><p className="text-xs text-mute" dir="ltr">{deposit.user?.email}</p><p className="mt-1 text-xs text-mute">{method?.name || deposit.method} · {new Date(deposit.createdAt).toLocaleString("ar-SY")}</p></div><div className="text-end"><p className="font-bold text-gold-300" dir="ltr">{money(deposit.amount, c)}</p><p className={"text-xs font-bold " + tone[deposit.status]}>{labels[deposit.status]}</p></div></div>
                <p className="mt-3 text-sm"><span className="text-mute">رقم العملية: </span><span className="select-all font-mono" dir="ltr">{deposit.reference}</span></p>
                {Object.entries(deposit.extraData || {}).map(([key, value]) => <p key={key} className="mt-1 text-sm"><span className="text-mute">{method?.extraFields?.find((x) => x.key === key)?.label || key}: </span>{String(value)}</p>)}
                {deposit.adminNote && <p className="mt-2 text-sm text-red-300">ملاحظة الإدارة: {deposit.adminNote}</p>}
                <div className="mt-3 flex flex-wrap gap-2">{deposit.receiptUrl && <button type="button" onClick={() => showReceipt(deposit.receiptUrl)} className={btnGhost}>عرض الإيصال</button>}{deposit.status === "pending" && <><button type="button" disabled={busy} onClick={() => approve(deposit)} className={btnGold + " flex-1"}>قبول وإضافة الرصيد</button><button type="button" onClick={() => setRejecting(deposit)} className={btnGhost + " text-red-300"}>رفض</button></>}</div>
            </article>;
        })}</div>
        {receipt && <Modal title="إيصال التحويل" onClose={() => { URL.revokeObjectURL(receipt); setReceipt(null); }}><img src={receipt} alt="إيصال التحويل" className="w-full rounded-xl"/></Modal>}
        {rejecting && <Modal title="رفض طلب الإيداع" onClose={() => setRejecting(null)}><form onSubmit={reject} className="space-y-4"><Field label="سبب الرفض"><textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows="3" className={inputCls()}/></Field><div className="flex gap-2"><button disabled={busy} className={btnGold + " flex-1"}>تأكيد الرفض</button><button type="button" onClick={() => setRejecting(null)} className={btnGhost}>رجوع</button></div></form></Modal>}
    </section>;
}
