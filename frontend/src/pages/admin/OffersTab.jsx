import { useEffect, useRef, useState } from "react";
import { ImagePlus, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Empty, Field, Modal, Switch, inputCls, btnGold, btnGhost } from "./ui";

const dateInput = (value) => value ? new Date(value).toISOString().slice(0, 16) : "";
const blank = { title: "", text: "", code: "", badge: "", image: "", link: "", startsAt: "", endsAt: "", active: true, order: 0 };

function OfferForm({ initial, onSaved, onClose }) {
    const fileRef = useRef(null);
    const [form, setForm] = useState({ ...blank, ...initial, startsAt: dateInput(initial.startsAt), endsAt: dateInput(initial.endsAt) });
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
    const upload = async (event) => { const file=event.target.files?.[0];event.target.value="";if(!file)return;const body=new FormData();body.append("file",file);setBusy(true);try{const result=await api("/admin/product-image",{method:"POST",body});setForm((old)=>({...old,image:result.url}));}catch(e){setError(e.message);}finally{setBusy(false);} };
    const submit = async (event) => {
        event.preventDefault(); setError("");
        if (form.title.trim().length < 3) return setError("عنوان العرض يجب ألا يقل عن 3 أحرف.");
        if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) return setError("وقت انتهاء العرض يجب أن يكون بعد وقت البداية.");
        setBusy(true);
        try { const payload={...form,title:form.title.trim(),text:form.text.trim(),code:form.code.trim().toUpperCase(),badge:form.badge.trim(),order:Number(form.order||0),startsAt:form.startsAt||null,endsAt:form.endsAt||null};const result=await api("/admin/offers"+(initial._id?"/"+initial._id:""),{method:initial._id?"PATCH":"POST",body:JSON.stringify(payload)});onSaved(result);onClose(); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    return <Modal title={initial._id ? "تعديل العرض" : "إضافة عرض"} onClose={onClose}><form onSubmit={submit} className="space-y-4"><div><span className="mb-1.5 block text-sm font-medium">صورة العرض — اختيارية</span><div className="flex items-center gap-3"><div className="grid h-24 w-36 place-items-center overflow-hidden rounded-xl border border-dashed border-ink-700 bg-ink-800">{form.image?<img src={form.image} alt="" className="size-full object-cover"/>:<ImagePlus className="size-7 text-mute"/>}</div><div><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} className="hidden"/><button type="button" onClick={()=>fileRef.current?.click()} className={btnGhost}>رفع صورة</button>{form.image&&<button type="button" onClick={()=>setForm({...form,image:""})} className="mt-2 block text-xs text-red-400">إزالة الصورة</button>}</div></div></div><Field label="عنوان العرض"><input value={form.title} onChange={set("title")} maxLength="100" className={inputCls()}/></Field><Field label="الوصف"><textarea value={form.text} onChange={set("text")} maxLength="300" rows="3" className={inputCls()}/></Field><div className="grid grid-cols-2 gap-3"><Field label="شارة العرض"><input value={form.badge} onChange={set("badge")} placeholder="عرض محدود" className={inputCls()}/></Field><Field label="كود الخصم الظاهر"><input value={form.code} onChange={set("code")} placeholder="RS20" className={inputCls()} dir="ltr"/></Field></div><Field label="رابط الانتقال — اختياري"><input value={form.link} onChange={set("link")} placeholder="/product/pubg-mobile" className={inputCls()} dir="ltr"/></Field><div className="grid grid-cols-2 gap-3"><Field label="يبدأ في"><input type="datetime-local" value={form.startsAt} onChange={set("startsAt")} className={inputCls()} dir="ltr"/></Field><Field label="ينتهي في"><input type="datetime-local" value={form.endsAt} onChange={set("endsAt")} className={inputCls()} dir="ltr"/></Field></div><Field label="ترتيب العرض"><input type="number" value={form.order} onChange={set("order")} className={inputCls()} dir="ltr"/></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e)=>setForm({...form,active:e.target.checked})} className="size-4 accent-[#d4a22a]"/>العرض مفعّل</label>{error&&<p className="text-sm text-red-400">{error}</p>}<div className="flex gap-2"><button disabled={busy} className={btnGold+" flex-1"}>{busy?"جارٍ الحفظ...":"حفظ العرض"}</button><button type="button" onClick={onClose} className={btnGhost}>إلغاء</button></div></form></Modal>;
}

export default function OffersTab() {
    const [offers, setOffers] = useState([]);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const load=async()=>{setBusy(true);setError("");try{setOffers(await api("/admin/offers"));}catch(e){setError(e.message);}finally{setBusy(false);}};
    useEffect(()=>{load();},[]);
    const saved=(offer)=>setOffers((list)=>list.some((item)=>item._id===offer._id)?list.map((item)=>item._id===offer._id?offer:item):[offer,...list]);
    const toggle=async(offer,active)=>{try{saved(await api("/admin/offers/"+offer._id,{method:"PATCH",body:JSON.stringify({active})}));}catch(e){setError(e.message);}};
    const remove=async(offer)=>{if(!window.confirm("حذف العرض «"+offer.title+"»؟"))return;try{await api("/admin/offers/"+offer._id,{method:"DELETE"});setOffers((list)=>list.filter((item)=>item._id!==offer._id));}catch(e){setError(e.message);}};
    const now=Date.now();
    return <section><div className="mb-4 flex items-center justify-between gap-2"><div><h2 className="font-bold">عروض الصفحة الرئيسية</h2><p className="mt-1 text-xs text-mute">يمكن جدولة ظهور العرض واختفائه تلقائيًا.</p></div><div className="flex gap-2"><button type="button" onClick={load} className={btnGhost}><RefreshCw className={(busy?"animate-spin ":"")+"size-4"}/></button><button type="button" onClick={()=>setEditing({})} className={btnGold+" flex items-center gap-2"}><Plus className="size-4"/>عرض جديد</button></div></div>{error&&<p className="mb-3 rounded-xl border border-red-500/40 p-3 text-sm text-red-300">{error}</p>}{!offers.length&&<Empty>{busy?"جارٍ التحميل...":"لا توجد عروض."}</Empty>}<div className="space-y-2">{offers.map((offer)=>{const upcoming=offer.startsAt&&new Date(offer.startsAt).getTime()>now,expired=offer.endsAt&&new Date(offer.endsAt).getTime()<now;return <article key={offer._id} className={(offer.active&&!expired?"":"opacity-60 ")+"flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-3"}>{offer.image?<img src={offer.image} alt="" className="h-16 w-24 shrink-0 rounded-xl object-cover"/>:<span className="grid size-14 shrink-0 place-items-center rounded-xl bg-gold-500/10"><ImagePlus className="size-5 text-gold-400"/></span>}<div className="min-w-0 flex-1"><p className="truncate font-semibold">{offer.title}</p><p className="truncate text-xs text-mute">{offer.text}{offer.code?" · "+offer.code:""}</p><p className="mt-1 text-[11px] text-gold-300">{upcoming?"مجدول للظهور":expired?"منتهي":"ظاهر حاليًا"}</p></div><Switch on={offer.active} onChange={(value)=>toggle(offer,value)} label="تفعيل العرض"/><button type="button" onClick={()=>setEditing(offer)} className="rounded-lg p-2 text-gold-400"><Pencil className="size-5"/></button><button type="button" onClick={()=>remove(offer)} className="rounded-lg p-2 text-red-400"><Trash2 className="size-5"/></button></article>;})}</div>{editing&&<OfferForm initial={editing} onSaved={saved} onClose={()=>setEditing(null)}/>}</section>;
}
