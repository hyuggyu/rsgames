import { useEffect, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api";
import { auditLabels, auditText } from "../../lib/audit";
import { Empty, inputCls, btnGhost } from "./ui";

export default function LogTab() {
    const [result, setResult] = useState({ items: [], total: 0, page: 1, pages: 0 });
    const [page, setPage] = useState(1);
    const [action, setAction] = useState("all");
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const load = async () => {
        setBusy(true); setError("");
        try { setResult(await api("/admin/audit-logs?page=" + page + "&limit=30&action=" + encodeURIComponent(action) + "&search=" + encodeURIComponent(query))); }
        catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filters are the complete request dependencies
    useEffect(() => { load(); }, [page, action, query]);
    const submit = (event) => { event.preventDefault(); setPage(1); setQuery(search.trim()); };
    return (
        <section>
            <div className="mb-4 rounded-2xl border border-ink-700 bg-ink-900 p-4"><div className="mb-3 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-gold-500/15 text-gold-400"><ShieldCheck className="size-5"/></span><div><p className="font-bold">سجل تدقيق محمي</p><p className="text-xs text-mute">يسجّل إجراءات الإدارة الناجحة ولا يمكن مسحه من لوحة التحكم.</p></div></div><form onSubmit={submit} className="grid gap-2 md:grid-cols-[1fr_15rem_auto]"><div className="relative"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gold-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالعملية أو رقم العنصر" className={inputCls() + " ps-10"}/></div><select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={inputCls()}><option value="all">جميع العمليات</option>{Object.entries(auditLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select><button className={btnGhost}>بحث</button></form></div>
            <div className="mb-3 flex items-center justify-between"><p className="text-sm text-mute">{result.total} عملية مسجّلة</p><button type="button" onClick={load} className={btnGhost} aria-label="تحديث"><RefreshCw className={(busy ? "animate-spin " : "") + "size-4"}/></button></div>
            {error && <p className="mb-3 rounded-xl border border-red-500/40 p-3 text-sm text-red-300">{error}</p>}
            {!busy && result.items.length === 0 && <Empty>لا توجد عمليات مطابقة.</Empty>}
            <ul className="divide-y divide-ink-700 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
                {result.items.map((item) => <li key={item._id} className="flex items-start gap-3 px-4 py-3 text-sm"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-gold-500/10 text-gold-400"><Activity className="size-4"/></span><div className="min-w-0 flex-1"><p className="font-semibold" dir="auto">{auditText(item)}</p><p className="mt-1 truncate text-xs text-mute">بواسطة {item.admin?.name || item.admin?.email || "مسؤول"}{item.targetId ? " · العنصر " + item.targetId : ""}</p><p className="mt-1 text-[11px] text-mute" dir="ltr">{item.ip || "—"} · {item.method} {item.path}</p></div><span className="shrink-0 text-xs text-mute">{new Date(item.createdAt).toLocaleString("ar-SY")}</span></li>)}
            </ul>
            {result.pages > 1 && <div className="mt-4 flex items-center justify-center gap-3"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className={btnGhost}><ChevronRight className="size-4"/></button><span className="text-sm text-mute">صفحة {result.page} من {result.pages}</span><button type="button" disabled={page >= result.pages} onClick={() => setPage((value) => value + 1)} className={btnGhost}><ChevronLeft className="size-4"/></button></div>}
        </section>
    );
}
