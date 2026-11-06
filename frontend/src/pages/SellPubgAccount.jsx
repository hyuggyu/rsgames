import { useEffect, useState } from "react";
import { BadgeDollarSign, CheckCircle2, Clock3, Gamepad2, Upload, XCircle } from "lucide-react";
import Page, { card, fieldCls, btnPrimary, Label, Notice } from "../components/Page";
import { api } from "../lib/api";

const statusLabel = {
  pending: "قيد مراجعة الإدارة",
  needs_info: "مطلوب معلومات إضافية",
  priced: "تم إرسال عرض سعر",
  accepted: "وافقت على السعر",
  inspecting: "الحساب قيد الفحص",
  completed: "تم الشراء وتحويل الرصيد",
  rejected: "مرفوض",
  cancelled: "ملغي"
};

const emptyForm = {
  accountRegion: "عالمي",
  accountLevel: "",
  skinsCount: "",
  upgradedWeapons: "",
  requestedPrice: "",
  description: "",
  linkingMethods: [],
  userNote: ""
};

export default function SellPubgAccount() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = () => api("/pubg-sales/my").then(setItems).catch((error) => setMessage({ bad: true, text: error.message }));
  useEffect(() => { load(); }, []);

  const toggleLink = (value) => setForm((old) => ({ ...old, linkingMethods: old.linkingMethods.includes(value) ? old.linkingMethods.filter((x) => x !== value) : [...old.linkingMethods, value] }));
  const upload = async (file) => {
    const body = new FormData();
    body.append("file", file);
    return api("/uploads", { method: "POST", body });
  };
  const submit = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (form.description.trim().length < 20 || Number(form.requestedPrice) <= 0 || !files.length) return setMessage({ bad: true, text: "أكمل التفاصيل وأرفق صورة أو فيديو واحداً على الأقل." });
    setBusy(true);
    try {
      const media = [];
      for (const file of files) media.push((await upload(file)).url);
      await api("/pubg-sales", { method: "POST", body: JSON.stringify({ ...form, mediaUrls: media }) });
      setForm(emptyForm);
      setFiles([]);
      setMessage({ text: "تم إرسال الحساب للإدارة، وستصلك نتيجة التسعير في الإشعارات." });
      await load();
    } catch (error) {
      setMessage({ bad: true, text: error.message });
    } finally {
      setBusy(false);
    }
  };
  const action = async (id, type) => {
    setBusy(true);
    setMessage(null);
    try {
      await api("/pubg-sales/" + id + "/" + type, { method: "POST", body: JSON.stringify({}) });
      await load();
    } catch (error) {
      setMessage({ bad: true, text: error.message });
    } finally {
      setBusy(false);
    }
  };

  return <Page title="بيع حساب PUBG للإدارة">
    <section className={card + " mt-5 overflow-hidden p-5"}>
      <div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-gold-500/15 text-gold-300"><Gamepad2 className="size-7"/></span><div><h2 className="font-extrabold">أرسل حسابك للتقييم</h2><p className="text-sm text-mute">الإدارة تفحص الحساب وترسل لك سعراً، وعند الموافقة يُحوّل المبلغ إلى محفظتك.</p></div></div>
      <div className="mt-4 rounded-xl border border-gold-500/20 bg-gold-500/5 p-3 text-xs leading-6 text-gold-100">لا ترسل كلمة المرور في هذا النموذج. بيانات التسليم تُطلب لاحقاً بعد موافقتك على السعر.</div>
    </section>

    <form onSubmit={submit} className={card + " mt-5 space-y-4 p-5"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label id="region" label="نسخة الحساب"><select id="region" className={fieldCls()} value={form.accountRegion} onChange={(e) => setForm({ ...form, accountRegion: e.target.value })}><option>عالمي</option><option>كوري</option><option>فيتنامي</option><option>تايواني</option></select></Label>
        <Label id="level" label="مستوى الحساب"><input id="level" type="number" min="1" className={fieldCls()} value={form.accountLevel} onChange={(e) => setForm({ ...form, accountLevel: e.target.value })}/></Label>
        <Label id="skins" label="عدد السكنات تقريباً"><input id="skins" type="number" min="0" className={fieldCls()} value={form.skinsCount} onChange={(e) => setForm({ ...form, skinsCount: e.target.value })}/></Label>
        <Label id="weapons" label="عدد الأسلحة المطورة"><input id="weapons" type="number" min="0" className={fieldCls()} value={form.upgradedWeapons} onChange={(e) => setForm({ ...form, upgradedWeapons: e.target.value })}/></Label>
      </div>
      <div><p className="mb-2 text-sm font-medium">طرق ربط الحساب</p><div className="flex flex-wrap gap-2">{["Facebook","Google","Apple","X","هاتف","بريد"].map((item) => <button key={item} type="button" onClick={() => toggleLink(item)} className={"rounded-xl border px-3 py-2 text-sm " + (form.linkingMethods.includes(item) ? "border-gold-500 bg-gold-500 text-ink-950" : "border-ink-700")}>{item}</button>)}</div></div>
      <Label id="price" label="السعر الذي تطلبه بالدولار"><input id="price" type="number" min="1" step="0.01" dir="ltr" className={fieldCls()} value={form.requestedPrice} onChange={(e) => setForm({ ...form, requestedPrice: e.target.value })}/></Label>
      <Label id="description" label="تفاصيل الحساب"><textarea id="description" rows="5" className={fieldCls()} placeholder="اذكر الملابس النادرة، السيارات، الأسلحة المطورة وأي تفاصيل مهمة..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></Label>
      <div><p className="mb-2 text-sm font-medium">صور أو فيديو للحساب</p><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gold-500/50 bg-gold-500/5 px-4 py-5 text-sm text-gold-200"><Upload className="size-5"/><span>{files.length ? "تم اختيار " + files.length + " ملفات" : "اختر حتى 8 ملفات"}</span><input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 8))}/></label><p className="mt-1 text-xs text-mute">الحد الأعلى لكل ملف 25MB.</p></div>
      <button disabled={busy} className={btnPrimary + " w-full"}>{busy ? "جاري الإرسال..." : "إرسال الحساب للإدارة"}</button>
      {message && <Notice bad={message.bad}>{message.text}</Notice>}
    </form>

    <section className="mt-7">
      <h2 className="mb-3 text-lg font-extrabold">طلباتي</h2>
      {!items.length && <div className={card + " p-5 text-sm text-mute"}>لم ترسل أي حساب حتى الآن.</div>}
      <div className="space-y-3">{items.map((item) => <article key={item.id} className={card + " p-4"}>
        <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-gold-500/15 text-gold-300">{item.status === "completed" ? <CheckCircle2 className="size-5"/> : ["rejected","cancelled"].includes(item.status) ? <XCircle className="size-5"/> : <Clock3 className="size-5"/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold" dir="ltr">{item.requestNumber}</p><span className="rounded-full bg-ink-800 px-2.5 py-1 text-xs text-gold-300">{statusLabel[item.status]}</span></div><p className="mt-1 text-xs text-mute">{new Date(item.createdAt).toLocaleString("ar-SY")}</p></div></div>
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-ink-800 p-3 text-sm"><div><p className="text-xs text-mute">السعر المطلوب</p><p dir="ltr">$ {item.requestedPrice}</p></div><div><p className="text-xs text-mute">عرض الإدارة</p><p className="font-bold text-gold-300" dir="ltr">{item.offeredPrice ? "$ " + item.offeredPrice : "—"}</p></div></div>
        {item.adminNote && <p className="mt-3 rounded-xl border border-ink-700 p-3 text-sm"><span className="text-mute">ملاحظة الإدارة: </span>{item.adminNote}</p>}
        {item.status === "priced" && <div className="mt-3 flex gap-2"><button disabled={busy} type="button" onClick={() => action(item.id, "accept")} className={btnPrimary + " flex-1"}><BadgeDollarSign className="me-1 inline size-4"/>موافقة على السعر</button><button disabled={busy} type="button" onClick={() => action(item.id, "cancel")} className="rounded-xl border border-red-500/40 px-4 py-2 text-sm text-red-300">رفض</button></div>}
      </article>)}</div>
    </section>
  </Page>;
}
