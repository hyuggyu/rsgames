import { useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Search, Users } from "lucide-react";
import { api } from "../../lib/api";
import { Empty, Field, inputCls, btnGold, btnGhost } from "./ui";

const levels = [["silver", "فضي"], ["gold", "ذهبي"], ["platinum", "بلاتيني"], ["api", "API"]];

export default function AgentsTab() {
    const [users, setUsers] = useState([]);
    const [settings, setSettings] = useState(null);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState("all");
    const [message, setMessage] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setBusy(true); setMessage(null);
        try {
            const [list, config] = await Promise.all([api("/admin/users"), api("/settings")]);
            setUsers(list); setSettings(config.affiliate);
        } catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };
    useEffect(() => { load(); }, []);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter((u) => (filter === "all" || u.agentLevel === filter) && (!q || (u.name + " " + u.email + " " + (u.affiliateCode || "")).toLowerCase().includes(q)));
    }, [users, query, filter]);

    const changeLevel = async (id, agentLevel) => {
        try {
            const updated = await api("/admin/users/" + id + "/agent-level", { method: "PATCH", body: JSON.stringify({ agentLevel }) });
            setUsers((list) => list.map((u) => u._id === id ? { ...u, agentLevel: updated.agentLevel } : u));
            setMessage({ text: "تم تحديث مستوى الوكيل." });
        } catch (error) { setMessage({ bad: true, text: error.message }); }
    };

    const saveSettings = async (e) => {
        e.preventDefault(); setMessage(null);
        try {
            const normalized = {
                pointsPerDollar: Number(settings.pointsPerDollar),
                pointsToDollar: Number(settings.pointsToDollar),
                minimumRedeemPoints: Number(settings.minimumRedeemPoints),
                levels: Object.fromEntries(levels.map(([key]) => [key, { minSales: Number(settings.levels[key].minSales) }]))
            };
            const result = await api("/admin/settings", { method: "PATCH", body: JSON.stringify({ affiliate: normalized }) });
            setSettings(result.affiliate); setMessage({ text: "تم حفظ نظام الوكلاء." });
        } catch (error) { setMessage({ bad: true, text: error.message }); }
    };

    return <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {levels.map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(filter === key ? "all" : key)} className={"rounded-2xl border p-4 text-start " + (filter === key ? "border-gold-400 bg-gold-500/15" : "border-ink-700 bg-ink-900")}><p className="text-xs text-mute">مستوى {label}</p><p className="mt-2 text-2xl font-extrabold text-gold-300">{users.filter((u) => u.agentLevel === key).length}</p></button>)}
        </div>

        {settings && <form onSubmit={saveSettings} className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-5">
            <div><h3 className="font-bold">إعدادات النقاط والترقية</h3><p className="mt-1 text-sm text-mute">يتم ترقية الوكيل تلقائيًا عند وصول مبيعات الإحالة إلى الحد المحدد.</p></div>
            <div className="grid gap-3 sm:grid-cols-3">
                <Field label="نقاط لكل 1$"><input type="number" min="0.01" step="0.01" value={settings.pointsPerDollar} onChange={(e) => setSettings({ ...settings, pointsPerDollar: e.target.value })} className={inputCls()} dir="ltr"/></Field>
                <Field label="نقاط مقابل 1$ رصيد"><input type="number" min="1" value={settings.pointsToDollar} onChange={(e) => setSettings({ ...settings, pointsToDollar: e.target.value })} className={inputCls()} dir="ltr"/></Field>
                <Field label="الحد الأدنى للاستبدال"><input type="number" min="1" value={settings.minimumRedeemPoints} onChange={(e) => setSettings({ ...settings, minimumRedeemPoints: e.target.value })} className={inputCls()} dir="ltr"/></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">{levels.map(([key, label]) => <Field key={key} label={"حد مبيعات " + label + " ($)"}><input type="number" min="0" value={settings.levels[key].minSales} onChange={(e) => setSettings({ ...settings, levels: { ...settings.levels, [key]: { minSales: e.target.value } } })} className={inputCls()} dir="ltr"/></Field>)}</div>
            <button className={btnGold}>حفظ الإعدادات</button>
        </form>}

        <section>
            <div className="mb-3 flex gap-2">
                <div className="relative flex-1"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gold-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث بالاسم أو البريد أو كود الوكيل" className={inputCls() + " ps-10"}/></div>
                <button type="button" onClick={load} className={btnGhost} aria-label="تحديث"><RefreshCw className={"size-5 " + (busy ? "animate-spin" : "")}/></button>
            </div>
            {!visible.length && <Empty>{busy ? "جارٍ تحميل الوكلاء..." : "لا توجد نتائج."}</Empty>}
            <div className="space-y-2">{visible.map((u) => <article key={u._id} className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-full bg-gold-500/15 text-gold-300"><Users className="size-5"/></span>
                    <div className="min-w-0 flex-1"><p className="truncate font-bold">{u.name}</p><p className="truncate text-xs text-mute" dir="ltr">{u.email} · {u.affiliateCode || "—"}</p></div>
                    <select value={u.agentLevel} onChange={(e) => changeLevel(u._id, e.target.value)} className="rounded-xl border border-gold-500/40 bg-ink-800 px-3 py-2 text-sm">{levels.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-ink-800 p-2"><p className="text-mute">المبيعات</p><p className="mt-1 font-bold text-gold-300">{"$"}{Number(u.affiliateSales || 0).toFixed(2)}</p></div><div className="rounded-xl bg-ink-800 p-2"><p className="text-mute">الطلبات</p><p className="mt-1 font-bold">{u.affiliateOrders || 0}</p></div><div className="rounded-xl bg-ink-800 p-2"><p className="text-mute">النقاط</p><p className="mt-1 font-bold">{u.affiliatePoints || 0}</p></div></div>
            </article>)}</div>
        </section>
        {message && <p className={"flex items-center gap-2 rounded-xl border p-3 text-sm " + (message.bad ? "border-red-500/40 text-red-300" : "border-emerald-500/40 text-emerald-300")}>{!message.bad && <Check className="size-4"/>}{message.text}</p>}
    </div>;
}
