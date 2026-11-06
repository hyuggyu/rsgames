import { useEffect, useState } from "react";
import { BadgeCheck, Eye, RefreshCw } from "lucide-react";
import { api, apiBlob } from "../../lib/api";
import { Empty, Field, Modal, inputCls, btnGold, btnGhost } from "./ui";

const labels = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };

export default function VerificationsTab() {
    const [items, setItems] = useState([]);
    const [filter, setFilter] = useState("pending");
    const [selected, setSelected] = useState(null);
    const [documents, setDocuments] = useState(null);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const load = async () => { setBusy(true); setError(""); try { setItems(await api("/admin/verifications")); } catch (e) { setError(e.message); } finally { setBusy(false); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-time load/cleanup
    useEffect(() => { load(); return () => Object.values(documents || {}).forEach((url) => URL.revokeObjectURL(url)); }, []);
    const view = async (item) => {
        setSelected(item); setNote(item.adminNote || ""); setDocuments(null); setError("");
        try {
            const pairs = await Promise.all([["front", item.idFrontUrl], ["back", item.idBackUrl], ["selfie", item.selfieUrl]].map(async ([key, url]) => [key, url ? await apiBlob(url.replace(/^.*\/api/, "")) : null]));
            setDocuments(Object.fromEntries(pairs));
        } catch (e) { setError(e.message); }
    };
    const close = () => { Object.values(documents || {}).forEach((url) => url && URL.revokeObjectURL(url)); setDocuments(null); setSelected(null); };
    const decide = async (status) => {
        setBusy(true); setError("");
        try { const updated = await api("/admin/verifications/" + selected._id, { method: "PATCH", body: JSON.stringify({ status, adminNote: note.trim() }) }); setItems((list) => list.map((x) => x._id === updated._id ? { ...x, ...updated } : x)); close(); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    const visible = filter === "all" ? items : items.filter((x) => x.status === filter);
    return <section>
        <div className="mb-4 flex flex-wrap items-center gap-2">{[["all","الكل"],["pending","قيد المراجعة"],["approved","مقبول"],["rejected","مرفوض"]].map(([key,label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={"rounded-xl border px-3 py-2 text-sm " + (filter === key ? "border-gold-500 bg-gold-500 font-bold text-ink-950" : "border-ink-700")}>{label} <span className="opacity-70">{key === "all" ? items.length : items.filter((x) => x.status === key).length}</span></button>)}<button type="button" onClick={load} className={btnGhost}><RefreshCw className={"size-4 " + (busy ? "animate-spin" : "")}/></button></div>
        {error && <p className="mb-3 rounded-xl border border-red-500/40 p-3 text-sm text-red-300">{error}</p>}
        {!visible.length && <Empty>{busy ? "جارٍ تحميل الطلبات..." : "لا توجد طلبات توثيق."}</Empty>}
        <div className="space-y-2">{visible.map((item) => <article key={item._id} className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4"><span className="grid size-11 place-items-center rounded-full bg-gold-500/15 text-gold-300"><BadgeCheck className="size-6"/></span><div className="min-w-0 flex-1"><p className="font-bold">{item.fullName}</p><p className="truncate text-xs text-mute" dir="ltr">{item.user?.email}</p><p className="mt-1 text-xs text-mute">{item.province} · {new Date(item.createdAt).toLocaleDateString("ar-SY")}</p></div><span className={"text-xs font-bold " + (item.status === "approved" ? "text-emerald-300" : item.status === "rejected" ? "text-red-300" : "text-gold-300")}>{labels[item.status]}</span><button type="button" onClick={() => view(item)} className={btnGhost}><Eye className="size-4"/></button></article>)}</div>
        {selected && <Modal title="مراجعة طلب التوثيق" onClose={close}><div className="space-y-4"><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-mute">الاسم الكامل</dt><dd>{selected.fullName}</dd></div><div><dt className="text-mute">الرقم الوطني</dt><dd className="select-all" dir="ltr">{selected.nationalId}</dd></div><div><dt className="text-mute">تاريخ الميلاد</dt><dd dir="ltr">{selected.birthDate}</dd></div><div><dt className="text-mute">المحافظة</dt><dd>{selected.province}</dd></div></dl><div className="grid grid-cols-3 gap-2">{[["front","وجه الهوية"],["back","ظهر الهوية"],["selfie","الصورة الشخصية"]].map(([key,label]) => <div key={key}><p className="mb-1 text-center text-xs text-mute">{label}</p>{documents?.[key] ? <a href={documents[key]} target="_blank" rel="noreferrer"><img src={documents[key]} alt={label} className="aspect-square w-full rounded-xl object-cover"/></a> : <div className="grid aspect-square place-items-center rounded-xl bg-ink-800 text-xs text-mute">تحميل...</div>}</div>)}</div><Field label="ملاحظة الإدارة"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows="3" className={inputCls()}/></Field>{selected.status === "pending" && <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => decide("approved")} className={btnGold + " flex-1"}>قبول وإضافة علامة التوثيق</button><button type="button" disabled={busy} onClick={() => decide("rejected")} className={btnGhost + " text-red-300"}>رفض</button></div>}</div></Modal>}
    </section>;
}
