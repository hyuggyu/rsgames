import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, ArrowRight, BadgeCheck, MessagesSquare, Paperclip, RotateCcw, Send } from "lucide-react";
import { api } from "../../lib/api";
import PrivateAttachment from "../../components/PrivateAttachment";
import { btnGold, inputCls } from "./ui";

const timeOf = (value) => value ? new Intl.DateTimeFormat("ar-SY", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "";

export default function ChatsTab() {
    const [chats, setChats] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [text, setText] = useState("");
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const endRef = useRef(null);
    const chat = chats.find((item) => item._id === selectedId);

    const load = useCallback(async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const data = await api("/admin/live-chats");
            setChats(data);
            setSelectedId((current) => current && data.some((item) => item._id === current) ? current : null);
            setError("");
        } catch (e) { setError(e.message); }
        finally { if (showLoading) setLoading(false); }
    }, []);

    useEffect(() => {
        load(true);
        const timer = window.setInterval(() => load(false), 5000);
        return () => window.clearInterval(timer);
    }, [load]);

    const lastMessage = chat?.messages.at(-1)?.createdAt;
    useEffect(() => {
        if (!selectedId) return;
        api(`/admin/live-chats/${selectedId}/read`, { method: "PATCH" }).then(() => {
            setChats((items) => items.map((item) => item._id === selectedId ? { ...item, unread: 0 } : item));
            window.dispatchEvent(new Event("rs:admin-badges"));
        }).catch(() => {});
        endRef.current?.scrollIntoView({ block: "end" });
    }, [selectedId, lastMessage]);

    const send = async (e) => {
        e.preventDefault();
        const message = text.trim();
        if (!chat || (!message && !files.length) || busy) return;
        setBusy(true);
        try {
            const attachments = await Promise.all(files.map((file) => { const body = new FormData(); body.append("file", file); return api("/uploads", { method: "POST", body }); }));
            const updated = await api(`/admin/live-chats/${chat._id}/messages`, { method: "POST", body: JSON.stringify({ text: message, attachments }) });
            setChats((items) => [updated, ...items.filter((item) => item._id !== updated._id)]);
            setText("");
            setFiles([]);
            setError("");
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    const changeStatus = async () => {
        if (!chat || busy) return;
        setBusy(true);
        try {
            const updated = await api(`/admin/live-chats/${chat._id}/status`, { method: "PATCH", body: JSON.stringify({ status: chat.status === "closed" ? "open" : "closed" }) });
            setChats((items) => items.map((item) => item._id === updated._id ? { ...item, ...updated } : item));
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    return (
        <div className="space-y-3">
            {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
            <div className="grid gap-3 md:grid-cols-[17rem_1fr]">
                <div className={`${selectedId ? "hidden md:block" : ""}`}>
                    <div className="mb-2 flex items-center justify-between px-1"><p className="text-sm text-mute">{chats.length} محادثة</p><button type="button" onClick={() => load(true)} className="rounded-lg p-1.5 text-mute hover:text-gold-400" aria-label="تحديث"><RotateCcw className="size-4" /></button></div>
                    <ul className="max-h-[68vh] space-y-2 overflow-y-auto">
                        {loading && <li className="rounded-2xl border border-ink-700 bg-ink-900 p-5 text-center text-sm text-mute">جارٍ تحميل المحادثات...</li>}
                        {!loading && chats.length === 0 && <li className="rounded-2xl border border-ink-700 bg-ink-900 p-5 text-sm text-mute">لا توجد محادثات بعد. ستظهر هنا عندما يراسلك مستخدم مسجّل.</li>}
                        {chats.map((item) => (
                            <li key={item._id}>
                                <button type="button" onClick={() => { setSelectedId(item._id); setText(""); setFiles([]); }} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-start ${selectedId === item._id ? "border-gold-500 bg-ink-800" : "border-ink-700 bg-ink-900"}`}>
                                    <div className="min-w-0 flex-1">
                                        <p className="flex items-center gap-1 truncate font-semibold" dir="auto">{item.user?.name || "مستخدم محذوف"}{item.user?.verified && <BadgeCheck className="size-4 shrink-0 text-gold-400" />}</p>
                                        <p className="truncate text-xs text-mute" dir="auto">{item.messages.at(-1)?.text || (item.messages.at(-1)?.attachments?.length ? "مرفق" : "")}</p>
                                        <p className="mt-1 text-[10px] text-mute">{item.status === "closed" ? "مغلقة" : "مفتوحة"} · {timeOf(item.lastMessageAt)}</p>
                                    </div>
                                    {item.unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{item.unread > 99 ? "99+" : item.unread}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className={`flex h-[70vh] flex-col rounded-2xl border border-ink-700 bg-ink-900 ${selectedId ? "" : "hidden md:flex"}`}>
                    {!chat ? (
                        <div className="m-auto flex flex-col items-center gap-2 text-mute"><MessagesSquare className="size-10" /><p className="text-sm">اختر محادثة للرد</p></div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 border-b border-ink-700 p-3">
                                <button type="button" onClick={() => setSelectedId(null)} aria-label="رجوع" className="rounded-lg p-1.5 text-mute md:hidden"><ArrowRight className="size-5" /></button>
                                <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-1 truncate font-semibold" dir="auto">{chat.user?.name || "مستخدم محذوف"}{chat.user?.verified && <BadgeCheck className="size-4 text-gold-400" />}</p>
                                    <p className="truncate text-xs text-mute" dir="ltr">{chat.user?.email} {chat.user?.walletId ? `· ${chat.user.walletId}` : ""}</p>
                                </div>
                                <button type="button" onClick={changeStatus} disabled={busy} className={`flex items-center gap-1 rounded-xl border px-3 py-2 text-xs ${chat.status === "closed" ? "border-gold-500/40 text-gold-400" : "border-ink-600 text-mute"}`}>
                                    {chat.status === "closed" ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}{chat.status === "closed" ? "إعادة فتح" : "إغلاق"}
                                </button>
                            </div>
                            <div className="flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
                                {chat.messages.map((message) => (
                                    <div key={message._id || message.createdAt} className={`flex ${message.sender === "admin" ? "justify-start" : "justify-end"}`}>
                                        <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${message.sender === "admin" ? "bg-gold-500 text-ink-950" : "bg-ink-800"}`}>
                                            {message.text && <p className="whitespace-pre-wrap break-words" dir="auto">{message.text}</p>}
                                            {(message.attachments || []).map((item, index) => <PrivateAttachment key={item.url || index} item={item} />)}
                                            <p className="mt-1 text-[10px] opacity-60">{timeOf(message.createdAt)}</p>
                                        </div>
                                    </div>
                                ))}
                                <div ref={endRef} />
                            </div>
                            <form onSubmit={send} className="space-y-2 border-t border-ink-700 p-3">
                                {files.length > 0 && <div className="flex gap-1 overflow-x-auto">{files.map((file, index) => <button key={`${file.name}-${index}`} type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} className="shrink-0 rounded-lg border border-gold-500/30 px-2 py-1 text-xs text-gold-300">{file.name} ×</button>)}</div>}
                                <div className="flex gap-2">
                                    <label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-ink-700 text-gold-400" aria-label="إرفاق ملف"><Paperclip className="size-5" /><input type="file" multiple accept="image/jpeg,image/png,image/webp,audio/*,application/pdf" className="sr-only" onChange={(e) => { setFiles((current) => [...current, ...Array.from(e.target.files || [])].slice(0, 4)); e.target.value = ""; }} /></label>
                                    <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={chat.status === "closed" ? "الرد سيعيد فتح المحادثة..." : "اكتب ردك..."} aria-label="رسالة" className={inputCls()} />
                                    <button disabled={(!text.trim() && !files.length) || busy} className={`${btnGold} flex items-center gap-1`} aria-label="إرسال"><Send className="size-4" /></button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
