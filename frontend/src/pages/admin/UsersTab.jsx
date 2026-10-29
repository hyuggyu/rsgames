import { useEffect, useMemo, useState } from "react";
import { Ban, Check, Copy, KeyRound, RefreshCw, Search, ShieldCheck, WalletCards } from "lucide-react";
import { api } from "../../lib/api";
import { Empty, Field, Modal, inputCls, btnGold, btnGhost } from "./ui";

const levels = [["silver", "فضي"], ["gold", "ذهبي"], ["platinum", "بلاتيني"], ["api", "API"]];
const currencyNames = { USD: "دولار", SYP: "ليرة سورية", TRY: "ليرة تركية" };

function UserModal({ initial, onSaved, onClose }) {
    const [user, setUser] = useState(initial);
    const [ledger, setLedger] = useState(null);
    const [adjust, setAdjust] = useState({ currency: "USD", amount: "", direction: "credit", note: "" });
    const [temporary, setTemporary] = useState("");
    const [copied, setCopied] = useState(false);
    const [message, setMessage] = useState(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => { api("/admin/users/" + user._id + "/ledger").then(setLedger).catch((e) => setMessage({ bad: true, text: e.message })); }, [user._id]);
    const save = (next) => { setUser(next); onSaved(next); };
    const status = async () => { try { save(await api("/admin/users/" + user._id + "/status", { method: "PATCH", body: JSON.stringify({ status: user.status === "blocked" ? "active" : "blocked" }) })); } catch (e) { setMessage({ bad: true, text: e.message }); } };
    const level = async (agentLevel) => { try { save(await api("/admin/users/" + user._id + "/agent-level", { method: "PATCH", body: JSON.stringify({ agentLevel }) })); } catch (e) { setMessage({ bad: true, text: e.message }); } };
    const updateBalance = async (e) => {
        e.preventDefault(); setBusy(true); setMessage(null);
        const value = Number(adjust.amount), amount = adjust.direction === "debit" ? -value : value;
        try { const next = await api("/admin/users/" + user._id + "/balance", { method: "POST", body: JSON.stringify({ currency: adjust.currency, amount, note: adjust.note }) }); save(next); setAdjust({ ...adjust, amount: "", note: "" }); setMessage({ text: "تم تعديل الرصيد وتسجيل العملية." }); setLedger(await api("/admin/users/" + user._id + "/ledger")); }
        catch (x) { setMessage({ bad: true, text: x.message }); } finally { setBusy(false); }
    };
    const resetPassword = async () => {
        if (!window.confirm("إنشاء كلمة مرور مؤقتة وإلغاء كلمة المرور الحالية؟")) return;
        setBusy(true); try { const result = await api("/admin/users/" + user._id + "/reset-password", { method: "POST" }); setTemporary(result.temporaryPassword); } catch (e) { setMessage({ bad: true, text: e.message }); } finally { setBusy(false); }
    };
    return <Modal title={user.name} onClose={onClose}><div className="space-y-5">
        <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-mute">البريد</dt><dd className="break-all" dir="ltr">{user.email}</dd></div><div><dt className="text-mute">رقم المحفظة</dt><dd className="font-mono text-gold-300" dir="ltr">{user.walletId}</dd></div><div><dt className="text-mute">حالة الحساب</dt><dd className={user.status === "blocked" ? "text-red-300" : "text-emerald-300"}>{user.status === "blocked" ? "موقوف" : "نشط"}</dd></div><div><dt className="text-mute">التوثيق</dt><dd>{user.verified ? "موثّق" : "غير موثّق"}</dd></div></dl>
        <div className="grid grid-cols-3 gap-2">{Object.entries(currencyNames).map(([code, label]) => <div key={code} className="rounded-xl bg-ink-800 p-3 text-center"><p className="text-xs text-mute">{label}</p><p className="mt-1 font-bold text-gold-300" dir="ltr">{Number(user.balances?.[code] || 0).toLocaleString("en-US")}</p></div>)}</div>
        <div className="grid grid-cols-2 gap-2"><button type="button" onClick={status} className={btnGhost + " flex items-center justify-center gap-2 " + (user.status === "blocked" ? "text-emerald-300" : "text-red-300")}>{user.status === "blocked" ? <ShieldCheck className="size-4"/> : <Ban className="size-4"/>}{user.status === "blocked" ? "رفع الإيقاف" : "إيقاف الحساب"}</button><select value={user.agentLevel} onChange={(e) => level(e.target.value)} className={inputCls()}>{levels.map(([key,label]) => <option key={key} value={key}>مستوى {label}</option>)}</select></div>
        <form onSubmit={updateBalance} className="space-y-3 rounded-xl border border-ink-700 p-3"><h3 className="flex items-center gap-2 font-bold"><WalletCards className="size-5 text-gold-400"/>تعديل الرصيد</h3><div className="grid grid-cols-2 gap-2"><select value={adjust.currency} onChange={(e) => setAdjust({ ...adjust, currency: e.target.value })} className={inputCls()}>{Object.entries(currencyNames).map(([code,label]) => <option key={code} value={code}>{label}</option>)}</select><select value={adjust.direction} onChange={(e) => setAdjust({ ...adjust, direction: e.target.value })} className={inputCls()}><option value="credit">إضافة</option><option value="debit">خصم</option></select></div><Field label="المبلغ"><input required type="number" min="0.01" step="0.01" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} className={inputCls()} dir="ltr"/></Field><Field label="السبب — يظهر في كشف الحساب"><input required minLength="3" value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} className={inputCls()}/></Field><button disabled={busy} className={btnGold}>تطبيق التعديل</button></form>
        <div><button type="button" onClick={resetPassword} className={btnGhost + " flex items-center gap-2"}><KeyRound className="size-4"/>إنشاء كلمة مرور مؤقتة</button>{temporary && <div className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-gold-500/50 p-3"><span className="flex-1 select-all font-mono font-bold text-gold-300" dir="ltr">{temporary}</span><button type="button" onClick={async () => { await navigator.clipboard.writeText(temporary); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-gold-400">{copied ? <Check className="size-5"/> : <Copy className="size-5"/>}</button></div>}</div>
        <section><h3 className="mb-2 font-bold">آخر العمليات المالية</h3>{!ledger?.entries?.length ? <p className="text-sm text-mute">لا توجد عمليات مالية.</p> : <div className="max-h-64 space-y-2 overflow-y-auto">{ledger.entries.map((entry) => <div key={entry._id} className="flex justify-between gap-3 rounded-xl bg-ink-800 p-3 text-sm"><div><p>{entry.note || entry.type}</p><p className="text-xs text-mute">{new Date(entry.createdAt).toLocaleString("ar-SY")}</p></div><p className={entry.direction === "credit" ? "text-emerald-300" : "text-red-300"} dir="ltr">{entry.direction === "credit" ? "+" : "-"}{entry.amount} {entry.currency}</p></div>)}</div>}</section>
        {message && <p className={"rounded-xl border p-3 text-sm " + (message.bad ? "border-red-500/40 text-red-300" : "border-emerald-500/40 text-emerald-300")}>{message.text}</p>}
    </div></Modal>;
}

export default function UsersTab() {
    const [users, setUsers] = useState([]);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState("all");
    const [selected, setSelected] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const load = async () => { setBusy(true); setError(""); try { setUsers(await api("/admin/users")); } catch (e) { setError(e.message); } finally { setBusy(false); } };
    useEffect(() => { load(); }, []);
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter((u) => (filter === "all" || (filter === "blocked" ? u.status === "blocked" : filter === "verified" ? u.verified : Object.values(u.balances || {}).some((v) => v > 0))) && (!q || (u.name + " " + u.email + " " + (u.walletId || "")).toLowerCase().includes(q)));
    }, [users, filter, query]);
    const saved = (user) => { setUsers((list) => list.map((x) => x._id === user._id ? { ...x, ...user } : x)); setSelected((old) => old?._id === user._id ? { ...old, ...user } : old); };
    return <section><div className="mb-3 flex gap-2"><div className="relative flex-1"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gold-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث بالاسم أو البريد أو المحفظة" className={inputCls() + " ps-10"}/></div><button type="button" onClick={load} className={btnGhost}><RefreshCw className={"size-4 " + (busy ? "animate-spin" : "")}/></button></div><div className="mb-4 flex gap-2 overflow-x-auto">{[["all","الكل"],["balance","لديهم رصيد"],["verified","موثّقون"],["blocked","موقوفون"]].map(([key,label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={"shrink-0 rounded-xl border px-3 py-2 text-sm " + (filter === key ? "border-gold-500 bg-gold-500 font-bold text-ink-950" : "border-ink-700")}>{label}</button>)}</div>{error && <p className="mb-3 text-sm text-red-400">{error}</p>}{!visible.length && <Empty>{busy ? "جارٍ التحميل..." : "لا توجد نتائج."}</Empty>}<div className="grid gap-2 md:grid-cols-2">{visible.map((user) => <button key={user._id} type="button" onClick={() => setSelected(user)} className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-3 text-start hover:border-gold-500"><span className="grid size-11 place-items-center rounded-full bg-gold-500/15 font-bold text-gold-300">{user.name.charAt(0)}</span><span className="min-w-0 flex-1"><span className="block truncate font-bold">{user.name}</span><span className="block truncate text-xs text-mute" dir="ltr">{user.email}</span></span><span className={"text-xs " + (user.status === "blocked" ? "text-red-300" : user.verified ? "text-emerald-300" : "text-mute")}>{user.status === "blocked" ? "موقوف" : user.verified ? "موثّق" : levels.find(([key]) => key === user.agentLevel)?.[1]}</span></button>)}</div>{selected && <UserModal initial={selected} onSaved={saved} onClose={() => setSelected(null)}/>}</section>;
}
