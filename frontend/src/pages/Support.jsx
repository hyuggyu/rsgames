import { useEffect, useRef, useState } from "react";
import { Headphones, ImagePlus, Mic, Paperclip, Send, Square } from "lucide-react";
import { api, apiBlob } from "../lib/api";
import Page, { card, fieldCls, btnPrimary, Label, Notice } from "../components/Page";

const statusNames = { open: "بانتظار الدعم", answered: "تم الرد", closed: "مغلقة" };

function Attachment({ item }) {
    const [url, setUrl] = useState("");
    const load = async () => { if (!url) setUrl(await apiBlob(item.url.replace(/^.*\/api/, ""))); };
    if (!url) return <button type="button" onClick={load} className="mt-2 flex items-center gap-2 rounded-lg border border-gold-500/30 px-3 py-2 text-xs text-gold-300"><Paperclip className="size-4"/>{item.name}</button>;
    if (item.type?.startsWith("image/")) return <img src={url} alt={item.name} className="mt-2 max-h-64 rounded-xl object-contain"/>;
    if (item.type?.startsWith("audio/")) return <audio src={url} controls className="mt-2 max-w-full"/>;
    return <a href={url} download={item.name} className="mt-2 block text-xs text-gold-300 underline">تنزيل {item.name}</a>;
}

export default function Support() {
    const [tickets, setTickets] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [subject, setSubject] = useState("");
    const [text, setText] = useState("");
    const [files, setFiles] = useState([]);
    const [message, setMessage] = useState(null);
    const [busy, setBusy] = useState(false);
    const [recording, setRecording] = useState(false);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const load = async () => { try { const list = await api("/support/my"); setTickets(list); if (!selectedId && list[0]) setSelectedId(list[0]._id); } catch (e) { setMessage({ bad: true, text: e.message }); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-time load/cleanup
    useEffect(() => { load(); }, []);
    const selected = tickets.find((x) => x._id === selectedId);
    const addFiles = (newFiles) => setFiles((old) => [...old, ...Array.from(newFiles)].slice(0, 4));
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true }), recorder = new MediaRecorder(stream);
            chunksRef.current = []; recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
            recorder.onstop = () => { const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }); addFiles([new File([blob], "voice-" + Date.now() + ".webm", { type: blob.type })]); stream.getTracks().forEach((track) => track.stop()); };
            recorderRef.current = recorder; recorder.start(); setRecording(true);
        } catch { setMessage({ bad: true, text: "تعذر الوصول إلى الميكروفون." }); }
    };
    const stopRecording = () => { recorderRef.current?.stop(); setRecording(false); };
    const uploadAll = async () => Promise.all(files.map(async (file) => { const body = new FormData(); body.append("file", file); return api("/uploads", { method: "POST", body }); }));
    const send = async (e) => {
        e.preventDefault(); setBusy(true); setMessage(null);
        try {
            const attachments = await uploadAll();
            const result = selected
                ? await api("/support/" + selected._id + "/replies", { method: "POST", body: JSON.stringify({ text, attachments }) })
                : await api("/support", { method: "POST", body: JSON.stringify({ subject, text, attachments }) });
            setTickets((list) => selected ? list.map((x) => x._id === result._id ? result : x) : [result, ...list]);
            setSelectedId(result._id); setText(""); setSubject(""); setFiles([]); setMessage({ text: "تم إرسال رسالتك إلى الدعم." });
        } catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };
    return <Page title="الدعم الفني">
        <div className="mt-5 grid gap-4 md:grid-cols-[16rem_1fr]">
            <aside className={card + " p-3"}><button type="button" onClick={() => { setSelectedId(null); setText(""); setFiles([]); }} className="mb-3 w-full rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 py-2.5 text-sm font-bold text-ink-950">تذكرة جديدة</button><div className="space-y-2">{tickets.map((ticket) => <button key={ticket._id} type="button" onClick={() => setSelectedId(ticket._id)} className={"w-full rounded-xl border p-3 text-start " + (selectedId === ticket._id ? "border-gold-500 bg-gold-500/10" : "border-ink-700")}><p className="truncate text-sm font-bold">{ticket.subject}</p><p className="mt-1 text-xs text-mute">{statusNames[ticket.status]}</p></button>)}</div></aside>
            <section className={card + " flex min-h-[28rem] flex-col p-4"}>
                <div className="mb-4 flex items-center gap-3 border-b border-ink-700 pb-3"><Headphones className="size-6 text-gold-400"/><div><h2 className="font-bold">{selected ? selected.subject : "إنشاء تذكرة دعم"}</h2><p className="text-xs text-mute">{selected ? statusNames[selected.status] : "اشرح المشكلة وأرفق صورة أو تسجيلًا صوتيًا"}</p></div></div>
                {selected && <div className="mb-4 flex-1 space-y-3 overflow-y-auto">{selected.messages.map((msg, index) => <div key={msg._id || index} className={"flex " + (msg.sender === "user" ? "justify-start" : "justify-end")}><div className={"max-w-[88%] rounded-2xl p-3 " + (msg.sender === "user" ? "bg-ink-800" : "bg-gold-500 text-ink-950")}><p className="whitespace-pre-wrap text-sm">{msg.text}</p>{(msg.attachments || []).map((item, i) => <Attachment key={i} item={item}/>) }<p className="mt-1 text-[10px] opacity-60">{new Date(msg.createdAt).toLocaleString("ar-SY")}</p></div></div>)}</div>}
                <form onSubmit={send} className="mt-auto space-y-3">{!selected && <Label id="subject" label="عنوان المشكلة"><input id="subject" required minLength="3" value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldCls()}/></Label>}<textarea value={text} onChange={(e) => setText(e.target.value)} rows="3" placeholder="اكتب رسالتك..." className={fieldCls()}/><div className="flex flex-wrap items-center gap-2"><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink-700 px-3 py-2 text-sm"><ImagePlus className="size-4 text-gold-400"/>صور أو صوت<input type="file" multiple accept="image/jpeg,image/png,image/webp,audio/*" className="sr-only" onChange={(e) => addFiles(e.target.files || [])}/></label>{recording ? <button type="button" onClick={stopRecording} className="flex items-center gap-2 rounded-xl border border-red-500/50 px-3 py-2 text-sm text-red-300"><Square className="size-4"/>إيقاف التسجيل</button> : <button type="button" onClick={startRecording} className="flex items-center gap-2 rounded-xl border border-ink-700 px-3 py-2 text-sm"><Mic className="size-4 text-gold-400"/>تسجيل صوتي</button>}<span className="text-xs text-mute">{files.length ? files.map((f) => f.name).join("، ") : "حتى 4 مرفقات"}</span></div><button disabled={busy || (!text.trim() && !files.length)} className={btnPrimary + " flex items-center justify-center gap-2"}><Send className="size-4"/>{busy ? "جارٍ الإرسال..." : "إرسال"}</button></form>
                {message && <Notice bad={message.bad}>{message.text}</Notice>}
            </section>
        </div>
    </Page>;
}
