import { useEffect, useMemo, useState } from "react";
import { BellRing, RefreshCw, Search, Send, Users } from "lucide-react";
import { api } from "../../lib/api";
import { Empty, Field, inputCls, btnGold, btnGhost } from "./ui";

const typeLabels = { general: "عام", order: "الطلبات", deposit: "الإيداعات", balance: "الرصيد", verification: "التوثيق", support: "الدعم" };

export default function NotificationsTab() {
    const [users, setUsers] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [form, setForm] = useState({ audience: "all", userId: "", type: "general", title: "", message: "" });
    const [search, setSearch] = useState("");
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(null);

    const load = async () => {
        setBusy(true);
        try {
            const [userList, history] = await Promise.all([api("/admin/users"), api("/admin/notifications")]);
            setUsers(userList.filter((user) => user.status === "active")); setCampaigns(history); setNotice(null);
        } catch (e) { setNotice({ bad: true, text: e.message }); }
        finally { setBusy(false); }
    };
    useEffect(() => { load(); }, []);

    const visibleUsers = useMemo(() => {
        const query = search.trim().toLowerCase();
        return users.filter((user) => !query || (user.name + " " + user.email + " " + (user.walletId || "")).toLowerCase().includes(query)).slice(0, 30);
    }, [search, users]);
    const selected = users.find((user) => user._id === form.userId);

    const submit = async (event) => {
        event.preventDefault();
        if (form.audience === "user" && !form.userId) return setNotice({ bad: true, text: "اختر المستخدم المستهدف." });
        if (form.audience === "all" && !window.confirm("إرسال هذا الإشعار إلى جميع المستخدمين النشطين؟")) return;
        setBusy(true); setNotice(null);
        try {
            const result = await api("/admin/notifications", { method: "POST", body: JSON.stringify(form) });
            setNotice({ text: "تم إرسال الإشعار إلى " + result.recipients + " مستخدم." });
            setForm({ ...form, title: "", message: "" });
            setCampaigns(await api("/admin/notifications"));
        } catch (e) { setNotice({ bad: true, text: e.message }); }
        finally { setBusy(false); }
    };

    return <section className="space-y-5">
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-4">
            <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-gold-500/15 text-gold-400"><BellRing className="size-6"/></span><div><h3 className="font-bold">إرسال إشعار جديد</h3><p className="text-xs text-mute">يظهر مباشرة داخل حساب المستخدم.</p></div></div>
            <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setForm({ ...form, audience: "all", userId: "" })} className={(form.audience === "all" ? "border-gold-500 bg-gold-500/10 text-gold-300" : "border-ink-700") + " rounded-xl border p-3 text-sm font-semibold"}><Users className="mx-auto mb-1 size-5"/>جميع المستخدمين</button>
                <button type="button" onClick={() => setForm({ ...form, audience: "user" })} className={(form.audience === "user" ? "border-gold-500 bg-gold-500/10 text-gold-300" : "border-ink-700") + " rounded-xl border p-3 text-sm font-semibold"}>مستخدم محدد</button>
            </div>
            {form.audience === "user" && <div className="space-y-2"><div className="relative"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gold-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو البريد أو رقم المحفظة" className={inputCls() + " ps-10"}/></div><div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-ink-700 p-2">{visibleUsers.map((user) => <button key={user._id} type="button" onClick={() => setForm({ ...form, userId: user._id })} className={(form.userId === user._id ? "border-gold-500 bg-gold-500/10" : "border-transparent hover:bg-ink-800") + " flex w-full items-center gap-2 rounded-lg border p-2 text-start"}><span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold-500/15 text-xs font-bold text-gold-300">{user.name.charAt(0)}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{user.name}</span><span className="block truncate text-xs text-mute" dir="ltr">{user.email}</span></span></button>)}</div>{selected && <p className="text-xs text-emerald-300">المستلم: {selected.name}</p>}</div>}
            <Field label="نوع الإشعار"><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls()}>{Object.entries(typeLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
            <Field label="العنوان" hint={form.title.length + "/100"}><input required minLength="3" maxLength="100" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: عرض جديد متوفر" className={inputCls()}/></Field>
            <Field label="نص الرسالة" hint={form.message.length + "/1000"}><textarea required minLength="3" maxLength="1000" rows="4" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="اكتب تفاصيل الإشعار..." className={inputCls()}/></Field>
            {(form.title || form.message) && <div className="rounded-2xl border border-gold-500/40 bg-gold-500/10 p-4"><p className="mb-1 text-xs font-bold text-gold-400">معاينة</p><p className="font-bold">{form.title || "عنوان الإشعار"}</p><p className="mt-1 whitespace-pre-wrap text-sm text-mute">{form.message || "نص الإشعار"}</p></div>}
            {notice && <p className={(notice.bad ? "border-red-500/40 text-red-300" : "border-emerald-500/40 text-emerald-300") + " rounded-xl border p-3 text-sm"}>{notice.text}</p>}
            <button disabled={busy || !form.title.trim() || !form.message.trim()} className={btnGold + " flex w-full items-center justify-center gap-2"}><Send className="size-4"/>{busy ? "جارٍ الإرسال..." : "إرسال الإشعار"}</button>
        </form>
        <div><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">آخر الحملات المرسلة</h3><button type="button" onClick={load} className={btnGhost}><RefreshCw className={(busy ? "animate-spin " : "") + "size-4"}/></button></div>{!campaigns.length ? <Empty>لم يتم إرسال إشعارات يدوية بعد.</Empty> : <div className="space-y-2">{campaigns.map((campaign) => <article key={campaign._id} className="rounded-2xl border border-ink-700 bg-ink-900 p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-bold">{campaign.title}</h4><span className="rounded-full bg-gold-500/10 px-2 py-0.5 text-xs text-gold-300">{typeLabels[campaign.type]}</span></div><p className="mt-1 line-clamp-2 text-sm text-mute">{campaign.message}</p><p className="mt-2 text-xs text-mute">{new Date(campaign.createdAt).toLocaleString("ar-SY")}</p></div><div className="shrink-0 text-center"><p className="text-lg font-bold text-gold-300">{campaign.recipients}</p><p className="text-[11px] text-mute">مستلم</p><p className="mt-1 text-[11px] text-emerald-300">قرأه {campaign.readCount}</p></div></div></article>)}</div>}</div>
    </section>;
}
