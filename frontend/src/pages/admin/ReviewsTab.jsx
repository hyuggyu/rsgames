import { useEffect, useState } from "react";
import { BadgeCheck, Check, RefreshCw, Star, X } from "lucide-react";
import { api } from "../../lib/api";
import { btnGhost, Empty } from "./ui";

const labels = { pending: "بانتظار المراجعة", approved: "منشور", rejected: "مرفوض" };

export default function ReviewsTab() {
    const [reviews, setReviews] = useState([]);
    const [filter, setFilter] = useState("pending");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const load = async () => { setBusy(true); try { setReviews(await api("/admin/reviews")); setError(""); } catch (e) { setError(e.message); } finally { setBusy(false); } };
    useEffect(() => { load(); }, []);
    const visible = filter === "all" ? reviews : reviews.filter((review) => review.status === filter);
    const moderate = async (review, status) => {
        setBusy(true);
        try { const updated = await api(`/admin/reviews/${review._id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); setReviews((items) => items.map((item) => item._id === updated._id ? updated : item)); window.dispatchEvent(new Event("rs:admin-badges")); }
        catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };
    return <section className="space-y-4">
        <div className="flex flex-wrap gap-2">{[["all","الكل"],["pending","قيد المراجعة"],["approved","المنشورة"],["rejected","المرفوضة"]].map(([key,label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-xl border px-3 py-2 text-sm ${filter === key ? "border-gold-500 bg-gold-500 font-bold text-ink-950" : "border-ink-700"}`}>{label} <span className="opacity-70">{key === "all" ? reviews.length : reviews.filter((item) => item.status === key).length}</span></button>)}<button type="button" onClick={load} className={btnGhost}><RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} /></button></div>
        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        {!visible.length && <Empty>{busy ? "جارٍ التحميل..." : "لا توجد تقييمات في هذا القسم."}</Empty>}
        <div className="grid gap-3 sm:grid-cols-2">{visible.map((review) => <article key={review._id} className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
            <div className="flex gap-3">{review.product?.image && <img src={review.product.image} alt="" className="size-14 rounded-xl object-cover" />}<div className="min-w-0 flex-1"><h3 className="truncate font-bold">{review.product?.name || "منتج محذوف"}</h3><p className="flex items-center gap-1 truncate text-xs text-mute">{review.user?.name || "مستخدم محذوف"}{review.user?.verified && <BadgeCheck className="size-3.5 text-gold-400" />}</p></div><span className="text-xs text-mute">{labels[review.status]}</span></div>
            <div className="mt-3 flex gap-1 text-gold-400">{[1,2,3,4,5].map((value) => <Star key={value} className="size-4" fill={value <= review.rating ? "currentColor" : "none"} />)}</div>
            {review.text && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed" dir="auto">{review.text}</p>}
            {review.status === "pending" && <div className="mt-4 flex gap-2"><button disabled={busy} onClick={() => moderate(review, "approved")} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-white"><Check className="size-4" />اعتماد</button><button disabled={busy} onClick={() => moderate(review, "rejected")} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-red-500/15 px-3 py-2 text-sm font-bold text-red-300"><X className="size-4" />رفض</button></div>}
        </article>)}</div>
    </section>;
}
