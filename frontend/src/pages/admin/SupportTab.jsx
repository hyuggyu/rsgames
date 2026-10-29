import { useEffect, useState } from "react";
import { Headphones, Paperclip, RefreshCw, Send } from "lucide-react";
import { api, apiBlob } from "../../lib/api";
import { Empty, inputCls, btnGold, btnGhost } from "./ui";

const labels = { open: "بانتظار الرد", answered: "تم الرد", closed: "مغلقة" };

function Attachment({ item }) {
    const [url, setUrl] = useState("");
    const load = async () => { if (!url) setUrl(await apiBlob(item.url.replace(/^.*\/api/, ""))); };
    if (!url) return <button type="button" onClick={load} className="mt-2 flex items-center gap-2 rounded-lg border border-current/30 px-2 py-1 text-xs"><Paperclip className="size-3"/>{item.name}</button>;
    if (item.type?.startsWith("image/")) return <img src={url} alt="" className="mt-2 max-h-56 rounded-xl object-contain"/>;
    if (item.type?.startsWith("audio/")) return <audio src={url} controls className="mt-2 max-w-full"/>;
    return <a href={url} download={item.name} className="mt-2 block text-xs underline">تنزيل {item.name}</a>;
}

export default function SupportTab() {
    const [tickets, setTickets] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [text, setText] = useState("");
    const [files, setFiles] = useState([]);
    const [filter, setFilter] = useState("open");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const load = async () => { setBusy(true); setError(""); try { const list = await api("/admin/support"); setTickets(list); if (!selectedId && list[0]) setSelectedId(list[0]._id); } catch (e) { setError(e.message); } finally { setBusy(false); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-time load/cleanup
    useEffect(() => { load(); }, []);
    const selected = tickets.find((x) => x._id === selectedId);
    const visible = filter === "all" ? tickets : tickets.filter((x) => x.status === filter);
    const uploadAll = async () => Promise.all(files.slice(0, 4).map(async (file) => { const body = new FormData(); body.append("file", file); return api("/uploads", { method: "POST", body }); }));
    const reply = async (e) => {
        e.preventDefault(); setBusy(true); setError("");
        try { const attachments = await uploadAll(); const updated = await api("/admin/support/" + selected._id + "/replies", { method: "POST", body: JSON.stringify({ text, attachments }) }); setTickets((list) => list.map((x) => x._id === updated._id ? { ...updated, user: x.user } : x)); setText(""); setFiles([]); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    const status = async (value) => { try { const updated = await api("/admin/support/" + selected._id + "/status", { method: "PATCH", body: JSON.stringify({ status: value }) }); setTickets((list) => list.map((x) => x._id === updated._id ? { ...x, status: updated.status } : x)); } catch (e) { setError(e.message); } };
    return <section>
        <div className="mb-4 flex flex-wrap gap-2">{[["all","الكل"],["open","بانتظار الرد"],["answered","تم الرد"],["closed","مغلقة"]].map(([key,label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={"rounded-xl border px-3 py-2 text-sm " + (filter === key ? "border-gold-500 bg-gold-500 font-bold text-ink-950" : "border-ink-700")}>{label} <span className="opacity-70">{key === "all" ? tickets.length : tickets.filter((x) => x.status === key).length}</span></button>)}<button type="button" onClick={load} className={btnGhost}><RefreshCw className={"size-4 " + (busy ? "animate-spin" : "")}/></button></div>
        {error && <p className="mb-3 rounded-xl border border-red-500/40 p-3 text-sm text-red-300">{error}</p>}
        <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
            <aside className="space-y-2">{!visible.length && <Empty>لا توجد تذاكر.</Empty>}{visible.map((ticket) => <button key={ticket._id} type="button" onClick={() => setSelectedId(ticket._id)} className={"w-full rounded-xl border p-3 text-start " + (selectedId === ticket._id ? "border-gold-500 bg-gold-500/10" : "border-ink-700 bg-ink-900")}><p className="truncate font-bold">{ticket.subject}</p><p className="truncate text-xs text-mute">{ticket.user?.name} · {labels[ticket.status]}</p></button>)}</aside>
            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4">{selected ? <><div className="flex items-center gap-3 border-b border-ink-700 pb-3"><Headphones className="size-6 text-gold-400"/><div className="min-w-0 flex-1"><h3 className="truncate font-bold">{selected.subject}</h3><p className="truncate text-xs text-mute" dir="ltr">{selected.user?.email}</p></div><select value={selected.status} onChange={(e) => status(e.target.value)} className="rounded-xl border border-ink-700 bg-ink-800 px-2 py-2 text-sm"><option value="open">مفتوحة</option><option value="answered">تم الرد</option><option value="closed">مغلقة</option></select></div><div className="my-4 max-h-[28rem] space-y-3 overflow-y-auto">{selected.messages.map((msg,index) => <div key={msg._id || index} className={"flex " + (msg.sender === "admin" ? "justify-start" : "justify-end")}><div className={"max-w-[88%] rounded-2xl p-3 " + (msg.sender === "admin" ? "bg-gold-500 text-ink-950" : "bg-ink-800")}><p className="whitespace-pre-wrap text-sm">{msg.text}</p>{(msg.attachments || []).map((item,i) => <Attachment key={i} item={item}/>)}</div></div>)}</div><form onSubmit={reply} className="space-y-2"><textarea value={text} onChange={(e) => setText(e.target.value)} rows="3" placeholder="اكتب رد الدعم..." className={inputCls()}/><div className="flex flex-wrap items-center gap-2"><label className={btnGhost + " cursor-pointer"}><Paperclip className="me-1 inline size-4"/>مرفقات<input type="file" multiple accept="image/*,audio/*,application/pdf" className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0,4))}/></label><span className="flex-1 truncate text-xs text-mute">{files.map((f) => f.name).join("، ")}</span><button disabled={busy || (!text.trim() && !files.length)} className={btnGold + " flex items-center gap-2"}><Send className="size-4"/>إرسال الرد</button></div></form></> : <Empty>اختر تذكرة لعرض المحادثة.</Empty>}</div>
        </div>
    </section>;
}
