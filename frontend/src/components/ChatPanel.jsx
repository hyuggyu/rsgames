import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ImagePlus, LogIn, MessageCircle, Mic, Send, Square, X } from "lucide-react";
import { api, getToken } from "../lib/api";
import { useContact } from "../lib/db";
import PrivateAttachment from "./PrivateAttachment";

const timeOf = (value) => value ? new Intl.DateTimeFormat("ar-SY", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "";

export default function ChatPanel({ onClose, onUnreadChange }) {
    const contact = useContact();
    const authenticated = Boolean(getToken());
    const [chat, setChat] = useState({ messages: [], status: "open", unread: 0 });
    const [text, setText] = useState("");
    const [files, setFiles] = useState([]);
    const [recording, setRecording] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(authenticated);
    const endRef = useRef(null);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);

    const load = useCallback(async (showLoading = false) => {
        if (!authenticated) return;
        if (showLoading) setLoading(true);
        try {
            const data = await api("/live-chat");
            setChat(data);
            onUnreadChange?.(0);
            if (data.unread > 0) await api("/live-chat/read", { method: "PATCH" });
            setError("");
        } catch (e) { setError(e.message); }
        finally { if (showLoading) setLoading(false); }
    }, [authenticated, onUnreadChange]);

    useEffect(() => {
        if (!authenticated) return undefined;
        load(true);
        const timer = window.setInterval(() => load(false), 4000);
        return () => window.clearInterval(timer);
    }, [authenticated, load]);
    useEffect(() => () => recorderRef.current?.stream?.getTracks().forEach((track) => track.stop()), []);

    const lastMessage = chat.messages.at(-1)?.createdAt;
    useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [lastMessage]);

    const addFiles = (items) => setFiles((current) => [...current, ...Array.from(items)].slice(0, 4));
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            chunksRef.current = [];
            recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
            recorder.onstop = () => {
                const type = recorder.mimeType || "audio/webm";
                addFiles([new File([new Blob(chunksRef.current, { type })], `voice-${Date.now()}.webm`, { type })]);
                stream.getTracks().forEach((track) => track.stop());
            };
            recorderRef.current = recorder;
            recorder.start();
            setRecording(true);
        } catch { setError("تعذر الوصول إلى الميكروفون."); }
    };
    const stopRecording = () => { recorderRef.current?.stop(); setRecording(false); };
    const uploadAll = () => Promise.all(files.map((file) => { const body = new FormData(); body.append("file", file); return api("/uploads", { method: "POST", body }); }));

    const send = async (e) => {
        e.preventDefault();
        const message = text.trim();
        if ((!message && !files.length) || busy) return;
        setBusy(true);
        try {
            const attachments = await uploadAll();
            const data = await api("/live-chat/messages", { method: "POST", body: JSON.stringify({ text: message, attachments }) });
            setChat({ ...data, unread: 0 });
            setText("");
            setFiles([]);
            setError("");
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    return (
        <section aria-label="محادثة الدعم" className="fixed inset-x-3 bottom-24 z-50 flex h-[28rem] max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-gold-600/40 bg-ink-900 shadow-2xl shadow-black/60 sm:inset-x-auto sm:left-4 sm:w-96">
            <div className="flex items-center gap-3 border-b border-ink-700 bg-ink-800 p-3">
                <div className="grid size-9 place-items-center rounded-full bg-gold-500 text-ink-950"><MessageCircle className="size-5" /></div>
                <div className="flex-1"><p className="text-sm font-bold">{contact.supportName}</p><p className="text-xs text-mute">نرد عليك داخل الموقع</p></div>
                <button type="button" onClick={onClose} aria-label="إغلاق المحادثة" className="rounded-lg p-1.5 text-mute hover:text-sand"><X className="size-5" /></button>
            </div>

            {!authenticated ? (
                <div className="m-auto flex max-w-xs flex-col items-center gap-4 px-6 text-center">
                    <div className="grid size-14 place-items-center rounded-full bg-gold-500/15 text-gold-400"><LogIn className="size-7" /></div>
                    <div><p className="font-bold">سجّل الدخول لبدء المحادثة</p><p className="mt-1 text-sm text-mute">تُحفظ رسائلك بأمان في حسابك ويمكنك متابعتها من أي جهاز.</p></div>
                    <Link to="/login" onClick={onClose} className="rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-bold text-ink-950">تسجيل الدخول</Link>
                </div>
            ) : (
                <>
                    <div className="flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
                        {contact.welcome && chat.messages.length === 0 && <div className="flex justify-end"><p className="max-w-[80%] rounded-2xl bg-ink-800 px-3.5 py-2 text-sm">{contact.welcome}</p></div>}
                        {loading && <p className="py-8 text-center text-sm text-mute">جارٍ تحميل المحادثة...</p>}
                        {!loading && chat.messages.map((message) => (
                            <div key={message._id || message.createdAt} className={`flex ${message.sender === "user" ? "justify-start" : "justify-end"}`}>
                                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${message.sender === "user" ? "bg-gold-500 text-ink-950" : "bg-ink-800"}`}>
                                    {message.text && <p className="whitespace-pre-wrap break-words" dir="auto">{message.text}</p>}
                                    {(message.attachments || []).map((item, index) => <PrivateAttachment key={item.url || index} item={item} />)}
                                    <p className="mt-1 text-[10px] opacity-60">{timeOf(message.createdAt)}</p>
                                </div>
                            </div>
                        ))}
                        <div ref={endRef} />
                    </div>
                    {error && <p className="border-t border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
                    <form onSubmit={send} className="space-y-2 border-t border-ink-700 p-3">
                        {files.length > 0 && <div className="flex gap-1 overflow-x-auto">{files.map((file, index) => <button key={`${file.name}-${index}`} type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} className="shrink-0 rounded-lg border border-gold-500/30 px-2 py-1 text-xs text-gold-300" title="إزالة المرفق">{file.name} ×</button>)}</div>}
                        <div className="flex gap-2">
                            <label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-ink-700 text-gold-400" aria-label="إرفاق صورة أو ملف"><ImagePlus className="size-5" /><input type="file" multiple accept="image/jpeg,image/png,image/webp,audio/*,application/pdf" className="sr-only" onChange={(e) => { addFiles(e.target.files || []); e.target.value = ""; }} /></label>
                            <button type="button" onClick={recording ? stopRecording : startRecording} className={`grid size-11 shrink-0 place-items-center rounded-xl border ${recording ? "border-red-500 text-red-400" : "border-ink-700 text-gold-400"}`} aria-label={recording ? "إيقاف التسجيل" : "تسجيل صوتي"}>{recording ? <Square className="size-4" /> : <Mic className="size-5" />}</button>
                            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={chat.status === "closed" ? "اكتب رسالة لإعادة فتح المحادثة..." : "اكتب رسالتك..."} aria-label="رسالة" className="min-w-0 flex-1 rounded-xl border border-ink-700 bg-ink-800 px-3 py-2.5 text-sm text-sand placeholder:text-mute focus:border-gold-500 focus:outline-none" />
                            <button aria-label="إرسال" disabled={(!text.trim() && !files.length) || busy || recording} className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold-500 text-ink-950 disabled:opacity-50"><Send className="size-5" /></button>
                        </div>
                    </form>
                </>
            )}
        </section>
    );
}
