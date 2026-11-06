import { useEffect, useState } from "react";
import { Lightbulb, MessageSquareWarning, RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import Page, { fieldCls, btnPrimary, card, Label, Notice } from "../components/Page";

const kinds = [["complaint", "شكوى", MessageSquareWarning], ["suggestion", "اقتراح", Lightbulb]];
const statuses = { pending: "بانتظار المراجعة", answered: "تم الرد", closed: "مغلقة" };

export default function Feedback() {
    const [items, setItems] = useState([]);
    const [kind, setKind] = useState("complaint");
    const [text, setText] = useState("");
    const [message, setMessage] = useState(null);
    const [busy, setBusy] = useState(false);
    const load = async () => { setBusy(true); try { setItems(await api("/feedback/my")); } catch (e) { setMessage({ bad: true, text: e.message }); } finally { setBusy(false); } };
    useEffect(() => { load(); }, []);
    const submit = async (event) => {
        event.preventDefault(); setMessage(null);
        if (text.trim().length < 10) return setMessage({ bad: true, text: "اكتب 10 أحرف على الأقل حتى نفهم رسالتك." });
        setBusy(true);
        try { const item=await api("/feedback",{method:"POST",body:JSON.stringify({kind,text:text.trim()})});setItems((list)=>[item,...list]);setText("");setMessage({text:"وصلتنا رسالتك وسيتم الرد عليها من الإدارة."}); }
        catch (e) { setMessage({ bad: true, text: e.message }); } finally { setBusy(false); }
    };
    return <Page title="الشكاوى والاقتراحات"><p className="mt-2 text-sm text-mute">أرسل شكوى أو فكرة تطوير وتابع رد الإدارة من حسابك.</p><form onSubmit={submit} className={card+" mt-5 space-y-4 p-4"}><div className="grid grid-cols-2 gap-2">{kinds.map(([key,label,Icon])=><button key={key} type="button" onClick={()=>setKind(key)} className={(kind===key?"border-gold-500 bg-gold-500 text-ink-950":"border-ink-700 bg-ink-900")+" flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold"}><Icon className="size-4"/>{label}</button>)}</div><Label id="feedback-text" label="تفاصيل الرسالة"><textarea id="feedback-text" value={text} onChange={(event)=>setText(event.target.value)} rows="5" minLength="10" maxLength="2000" className={fieldCls()} placeholder="اكتب التفاصيل بوضوح..."/></Label><button disabled={busy||text.trim().length<10} className={btnPrimary}>{busy?"جارٍ الإرسال...":"إرسال الرسالة"}</button>{message&&<Notice bad={message.bad}>{message.text}</Notice>}</form><section className="mt-8"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">رسائلي السابقة</h2><button type="button" onClick={load} className="rounded-lg p-2 text-gold-400"><RefreshCw className={(busy?"animate-spin ":"")+"size-4"}/></button></div>{!items.length?<p className={card+" p-5 text-sm text-mute"}>{busy?"جارٍ التحميل...":"لا توجد رسائل سابقة."}</p>:<div className="space-y-3">{items.map((item)=><article key={item._id} className={card+" p-4"}><div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-gold-300">{item.kind==="complaint"?"شكوى":"اقتراح"}</span><span className={item.status==="answered"?"text-emerald-300":"text-mute"}>{statuses[item.status]}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{item.text}</p><p className="mt-2 text-xs text-mute">{new Date(item.createdAt).toLocaleString("ar-SY")}</p>{item.reply&&<div className="mt-3 rounded-xl border border-gold-500/30 bg-gold-500/10 p-3"><p className="mb-1 text-xs font-bold text-gold-300">رد الإدارة</p><p className="whitespace-pre-wrap text-sm">{item.reply}</p>{item.repliedAt&&<p className="mt-2 text-xs text-mute">{new Date(item.repliedAt).toLocaleString("ar-SY")}</p>}</div>}</article>)}</div>}</section></Page>;
}
