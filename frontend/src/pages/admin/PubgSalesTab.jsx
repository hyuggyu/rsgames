import { useEffect, useState } from "react";
import { BadgeDollarSign, Eye, RefreshCw } from "lucide-react";
import { api, apiBlob } from "../../lib/api";
import { Empty, Field, Modal, inputCls, btnGold, btnGhost } from "./ui";

const labels = { pending: "قيد المراجعة", needs_info: "مطلوب معلومات", priced: "تم التسعير", accepted: "وافق المستخدم", inspecting: "قيد الفحص", completed: "تم التحويل", rejected: "مرفوض", cancelled: "ملغي" };

export default function PubgSalesTab() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState(null);
  const [media, setMedia] = useState([]);
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => { setBusy(true); try { setItems(await api("/admin/pubg-sales")); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-time load/cleanup
  useEffect(() => { load(); return () => media.forEach((url) => URL.revokeObjectURL(url)); }, []);
  const open = async (item) => {
    setSelected(item); setPrice(item.offeredPrice || ""); setNote(item.adminNote || ""); setError("");
    media.forEach((url) => URL.revokeObjectURL(url)); setMedia([]);
    try { setMedia(await Promise.all((item.mediaUrls || []).map((url) => apiBlob(url.replace(/^.*\/api/, ""))))); } catch (e) { setError(e.message); }
  };
  const close = () => { media.forEach((url) => URL.revokeObjectURL(url)); setMedia([]); setSelected(null); };
  const update = async (status) => {
    setBusy(true); setError("");
    try { await api("/admin/pubg-sales/" + selected.id, { method: "PATCH", body: JSON.stringify({ status, offeredPrice: price, adminNote: note }) }); close(); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const complete = async () => {
    if (!window.confirm("هل تم استلام الحساب وفحصه؟ سيتم تحويل السعر إلى محفظة المستخدم ولا يمكن تكرار العملية.")) return;
    setBusy(true); setError("");
    try { await api("/admin/pubg-sales/" + selected.id + "/complete", { method: "POST", body: JSON.stringify({}) }); close(); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const visible = filter === "all" ? items : items.filter((item) => item.status === filter);
  return <section>
    <div className="mb-4 flex flex-wrap gap-2">{[["all","الكل"],["pending","جديدة"],["priced","تم التسعير"],["accepted","وافق المستخدم"],["inspecting","قيد الفحص"],["completed","مكتملة"]].map(([key,label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={"rounded-xl border px-3 py-2 text-sm " + (filter === key ? "border-gold-500 bg-gold-500 font-bold text-ink-950" : "border-ink-700")}>{label} ({key === "all" ? items.length : items.filter((x) => x.status === key).length})</button>)}<button type="button" onClick={load} className={btnGhost}><RefreshCw className={"size-4 " + (busy ? "animate-spin" : "")}/></button></div>
    {error && <p className="mb-3 rounded-xl border border-red-500/40 p-3 text-sm text-red-300">{error}</p>}
    {!visible.length && <Empty>{busy ? "جاري التحميل..." : "لا توجد طلبات في هذا القسم."}</Empty>}
    <div className="space-y-2">{visible.map((item) => <article key={item.id} className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4"><span className="grid size-11 place-items-center rounded-full bg-gold-500/15 text-gold-300"><BadgeDollarSign className="size-6"/></span><div className="min-w-0 flex-1"><p className="font-bold">{item.user?.name}</p><p className="truncate text-xs text-mute" dir="ltr">{item.requestNumber} · {item.user?.walletId}</p><p className="mt-1 text-xs text-mute">المطلوب: ${item.requestedPrice} · {labels[item.status]}</p></div><button type="button" onClick={() => open(item)} className={btnGhost}><Eye className="size-4"/></button></article>)}</div>
    {selected && <Modal title={"مراجعة " + selected.requestNumber} onClose={close}><div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-ink-800 p-3 text-sm"><div><p className="text-mute">المستخدم</p><p>{selected.user?.name}</p></div><div><p className="text-mute">المحفظة</p><p dir="ltr">{selected.user?.walletId}</p></div><div><p className="text-mute">النسخة والمستوى</p><p>{selected.accountRegion} · {selected.accountLevel || "—"}</p></div><div><p className="text-mute">طلب المستخدم</p><p dir="ltr">$ {selected.requestedPrice}</p></div></div>
      <p className="rounded-xl border border-ink-700 p-3 text-sm leading-6">{selected.description}</p>
      <div className="grid grid-cols-3 gap-2">{media.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={"مرفق " + (index + 1)} className="aspect-square w-full rounded-xl bg-ink-800 object-cover"/></a>)}</div>
      <Field label="سعر الإدارة بالدولار"><input type="number" min="1" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls()} dir="ltr"/></Field>
      <Field label="ملاحظة الإدارة"><textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} className={inputCls()}/></Field>
      {["pending","needs_info","priced"].includes(selected.status) && <div className="grid grid-cols-2 gap-2"><button disabled={busy || Number(price) <= 0} onClick={() => update("priced")} className={btnGold}>إرسال السعر</button><button disabled={busy} onClick={() => update("needs_info")} className={btnGhost}>طلب معلومات</button><button disabled={busy} onClick={() => update("rejected")} className={btnGhost + " text-red-300"}>رفض الطلب</button></div>}
      {selected.status === "accepted" && <button disabled={busy} onClick={() => update("inspecting")} className={btnGold + " w-full"}>بدء فحص الحساب</button>}
      {["accepted","inspecting"].includes(selected.status) && <button disabled={busy} onClick={complete} className="w-full rounded-xl bg-emerald-500 px-5 py-3 font-bold text-ink-950">إتمام الشراء وتحويل ${selected.offeredPrice} للمحفظة</button>}
    </div></Modal>}
  </section>;
}
