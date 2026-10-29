import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useProducts, useSite } from "../lib/db";
import { checkCoupon } from "../lib/coupons";
import { useUser } from "../lib/wallet";
import { placeOrder } from "../lib/orders";
import { catMeta, catIcon, getPackages, fieldsFor, currencies } from "../data/store";
import { money } from "../lib/wallet";
import Page, { fieldCls, btnPrimary, card, Label, Notice } from "../components/Page";
import { api, getToken } from "../lib/api";
import { formatPrice, useCurrency } from "../lib/currency";
import { BadgeCheck, Heart, Star } from "lucide-react";
import { useFavorites } from "../lib/favorites";

export default function Product() {
    const currency = useCurrency();
    const { id } = useParams();
    const navigate = useNavigate();
    const loc = useLocation();
    const user = useUser();
    const localProduct = useProducts().find((p) => p.id === id && p.active !== false);
    const [remoteProduct, setRemoteProduct] = useState(null);
    const [remoteCategoryLabel, setRemoteCategoryLabel] = useState("");
    useEffect(() => { api(`/products/${id}`).then((p) => setRemoteProduct({ ...p, id: p.slug, cat: p.category, from: p.packages?.[0]?.retailPrice ?? p.packages?.[0]?.price ?? 0, packages: p.packages?.map((x) => ({ id: x._id, label: x.title, price: x.retailPrice ?? x.price })) || [] })).catch(() => {}); }, [id]);
    useEffect(() => { api("/categories").then((items) => setRemoteCategoryLabel(items.find((c) => c.slug === (remoteProduct?.cat || localProduct?.cat))?.label || "")).catch(() => {}); }, [remoteProduct?.cat, localProduct?.cat]);
    const product = remoteProduct || localProduct;
    const [pkgId, setPkgId] = useState("0");
    const [vals, setVals] = useState({});
    const [note, setNote] = useState("");
    const [pin, setPin] = useState("");
    const [hasPin, setHasPin] = useState(false);
    const [err, setErr] = useState({});
    const [msg, setMsg] = useState(null);
    const [busy, setBusy] = useState(false);
    const [code, setCode] = useState("");
    const [applied, setApplied] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [reviewInfo, setReviewInfo] = useState({ review: null, canReview: false });
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewText, setReviewText] = useState("");
    const [reviewBusy, setReviewBusy] = useState(false);
    const [reviewMessage, setReviewMessage] = useState("");
    const site = useSite();
    const favorites = useFavorites();
    useEffect(() => { if (getToken()) api("/pin/status").then((x) => setHasPin(x.hasPin)).catch(() => {}); }, []);
    useEffect(() => {
        if (!remoteProduct?._id) return;
        api(`/reviews/product/${remoteProduct._id}`).then(setReviews).catch(() => {});
        if (getToken()) api(`/reviews/mine/${remoteProduct._id}`).then((info) => { setReviewInfo(info); if (info.review) { setReviewRating(info.review.rating); setReviewText(info.review.text || ""); } }).catch(() => {});
    }, [remoteProduct?._id]);

    const sendReview = async (event) => {
        event.preventDefault();
        if (!remoteProduct?._id || reviewBusy) return;
        setReviewBusy(true); setReviewMessage("");
        try { const review = await api(`/reviews/product/${remoteProduct._id}`, { method: "POST", body: JSON.stringify({ rating: reviewRating, text: reviewText }) }); setReviewInfo({ review, canReview: true }); setReviewMessage("تم إرسال تقييمك إلى الإدارة للمراجعة."); }
        catch (error) { setReviewMessage(error.message); }
        finally { setReviewBusy(false); }
    };

    if (!product) {
        return (
            <Page title="المنتج غير متوفر">
                <p className={`${card} mt-4 p-5 text-mute`}>هذا المنتج غير موجود أو تم إخفاؤه. <Link to="/" className="text-gold-400 underline">تصفح المنتجات</Link></p>
            </Page>
        );
    }

    const Icon = catIcon(product.cat);
    const packages = getPackages(product);
    const pkg = packages.find((p) => p.id === pkgId) ?? packages[0];
    const fields = fieldsFor(product.cat);
    const usd = currencies[0];
    const total = applied ? Math.max(0, Math.round((pkg.price - applied.discount) * 100) / 100) : pkg.price;
    const enough = user ? user.balances.USD >= total : true;
    const applyCode = async () => {
        if (!code.trim()) return;
        if (getToken() && remoteProduct) {
            try {
                const result = await api("/coupons/validate/" + encodeURIComponent(code.trim()) + "?subtotal=" + encodeURIComponent(pkg.price));
                setErr({ ...err, code: "" }); setApplied({ code: result.code, discount: result.discount }); return;
            } catch (error) { setApplied(null); setErr({ ...err, code: error.message }); return; }
        }
        const r = checkCoupon(code, pkg.price, user);
        if (r.error) { setApplied(null); return setErr({ ...err, code: r.error }); }
        setErr({ ...err, code: "" });
        setApplied({ code: r.coupon.code, discount: r.discount });
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!user) return navigate("/login", { state: { from: loc.pathname } });
        const er = {};
        fields.forEach((f) => { if (f.req && !(vals[f.k] ?? "").trim()) er[f.k] = "هذا الحقل مطلوب."; });
        if ((hasPin || user.pin) && !/^\d{4,6}$/.test(pin)) er.pin = "أدخل البين كود (4 إلى 6 أرقام).";
        setErr(er);
        setMsg(null);
        if (Object.keys(er).length) return;
        setBusy(true);
        let res;
        if (getToken() && remoteProduct) { try { await api("/orders", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ items: [{ productId: product._id, packageId: pkg.id, packageTitle: pkg.label, quantity: 1 }], customerData: { ...Object.fromEntries(fields.map((f) => [f.label, (vals[f.k] ?? "").trim()])), note: note.trim() }, couponCode: applied?.code, paymentMethod: "wallet", pin }) }); res = {}; } catch (x) { res = { error: x.message }; } }
        else res = await placeOrder({ user, product, pkg, fields: Object.fromEntries(fields.map((f) => [f.label, (vals[f.k] ?? "").trim()]).filter(([, v]) => v)), note: note.trim(), pin, couponCode: applied?.code });
        setBusy(false);
        if (res.error) return setMsg({ bad: true, t: res.error, short: res.short });
        navigate("/orders", { state: { notice: "تم استلام طلبك وهو الآن قيد التنفيذ. ستصلك إشعارات بكل تحديث." } });
    };

    return (
        <Page title={product.name} backLabel="المنتجات">
            <div className="mt-4 flex items-center gap-4">
                {product.image
                    ? <img src={product.image} alt="" className="size-24 rounded-2xl object-cover" />
                    : <div className="grid size-24 place-items-center rounded-2xl bg-gold-500/15 text-gold-400"><Icon className="size-10" /></div>}
                <div className="min-w-0 flex-1">
                    <p className="text-sm text-mute">{remoteCategoryLabel || catMeta(product.cat)?.label || product.cat}</p>
                    <p className="mt-1 text-sm text-mute">يبدأ من <span className="font-bold text-gold-400" dir="ltr">{formatPrice(product.from, currency.selected)}</span></p>
                    {product.ratingCount > 0 && <p className="mt-1 flex items-center gap-1 text-sm text-gold-300"><Star className="size-4" fill="currentColor" />{Number(product.ratingAverage || 0).toFixed(1)} <span className="text-xs text-mute">من {product.ratingCount} تقييم</span></p>}
                </div>
                <button type="button" onClick={() => favorites.toggle(product).catch(() => {})} aria-pressed={favorites.has(product)} className={`grid size-11 shrink-0 place-items-center rounded-full border ${favorites.has(product) ? "border-red-400 bg-red-500 text-white" : "border-ink-700 bg-ink-900 text-gold-300"}`} aria-label={favorites.has(product) ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}><Heart className="size-5" fill={favorites.has(product) ? "currentColor" : "none"} /></button>
            </div>

            <form onSubmit={submit} noValidate className="mt-6 space-y-5">
                <section>
                    <h2 className="mb-2 text-sm font-semibold text-mute">اختر الباقة</h2>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup">
                        {packages.map((p) => {
                            const on = pkg.id === p.id;
                            return (
                                <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => { setPkgId(p.id); setApplied(null); }}
                                    className={`rounded-xl border p-3.5 text-start transition-colors ${on ? "border-gold-500 bg-gold-500/10" : "border-ink-700 bg-ink-900 hover:border-gold-600/60"}`}>
                                    <p className="text-sm font-semibold" dir="auto">{p.label}</p>
                                    <p className="mt-1 font-extrabold text-gold-300" dir="ltr">{formatPrice(p.price, currency.selected)}</p>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {fields.length > 0 && (
                    <section className={`${card} space-y-4 p-4`}>
                        <h2 className="text-sm font-semibold text-mute">بيانات الطلب</h2>
                        {fields.map((f) => (
                            <Label key={f.k} id={f.k} label={f.label} error={err[f.k]}>
                                <input id={f.k} value={vals[f.k] ?? ""} onChange={(e) => setVals({ ...vals, [f.k]: e.target.value })} dir="auto" maxLength={120} className={fieldCls(err[f.k])} />
                            </Label>
                        ))}
                    </section>
                )}

                <Label id="note" label="ملاحظات (اختياري)">
                    <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} dir="auto" className={fieldCls()} />
                </Label>

                <div>
                    <label htmlFor="coupon" className="mb-1.5 block text-sm">كود الخصم (اختياري)</label>
                    <div className="flex gap-2">
                        <input id="coupon" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setApplied(null); }} dir="ltr" maxLength={20} className={fieldCls(err.code)} />
                        <button type="button" onClick={applyCode} disabled={!code.trim()} className="shrink-0 rounded-xl border border-gold-500/60 px-5 text-sm font-semibold text-gold-300 disabled:opacity-50">تطبيق</button>
                    </div>
                    {err.code && <p className="mt-1.5 text-xs text-red-400">{err.code}</p>}
                    {applied && <p className="mt-1.5 text-xs text-emerald-300">تم تطبيق الكود {applied.code}: خصم ${applied.discount}</p>}
                </div>

                {(hasPin || user?.pin) && (
                    <Label id="pin" label="البين كود" error={err.pin}>
                        <input id="pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} dir="ltr" className={fieldCls(err.pin)} />
                    </Label>
                )}

                <section className={`${card} p-4 text-sm`}>
                    <div className="flex justify-between"><span className="text-mute">الباقة</span><span dir="auto">{pkg.label}</span></div>
                    {applied && <div className="mt-2 flex justify-between"><span className="text-mute">الخصم</span><span className="text-emerald-300" dir="ltr">-${applied.discount}</span></div>}
                    <div className="mt-2 flex justify-between"><span className="text-mute">الإجمالي</span><span className="font-extrabold text-gold-300" dir="ltr">{formatPrice(total, currency.selected)}</span></div>
                    {user && <div className="mt-2 flex justify-between"><span className="text-mute">رصيدك بالدولار</span><span className={enough ? "" : "text-red-400"} dir="ltr">{money(user.balances.USD, usd)}</span></div>}
                </section>

                {msg && <Notice bad={msg.bad}>{msg.t} {msg.short && <Link to="/charge" className="font-bold underline">إيداع رصيد</Link>}</Notice>}

                {site.maintenance && <Notice bad>{site.maintenanceMsg}</Notice>}
                {user?.banned && <Notice bad>حسابك موقوف. تواصل مع الدعم.</Notice>}

                {user && !enough
                    ? <Link to="/charge" className={`${btnPrimary} block`}>رصيدك غير كافٍ — إيداع رصيد</Link>
                    : <button disabled={busy || site.maintenance || user?.banned} className={btnPrimary}>{user ? "تأكيد الشراء" : "سجّل الدخول للشراء"}</button>}
                <p className="text-center text-xs text-mute">يُخصم المبلغ من محفظتك فورًا، ويُرجَع إليك كاملًا إذا أُلغي الطلب.</p>
            </form>

            <section className="mt-8 space-y-4">
                <div className="flex items-center justify-between"><h2 className="text-lg font-bold">تقييمات العملاء</h2><span className="text-sm text-mute">{reviews.length} تقييم منشور</span></div>
                {reviewInfo.canReview && <form onSubmit={sendReview} className={`${card} space-y-3 p-4`}>
                    <div className="flex items-center justify-between"><h3 className="font-bold">قيّم تجربتك</h3>{reviewInfo.review && <span className={`rounded-full px-2 py-1 text-xs ${reviewInfo.review.status === "approved" ? "bg-emerald-500/15 text-emerald-300" : reviewInfo.review.status === "rejected" ? "bg-red-500/15 text-red-300" : "bg-gold-500/15 text-gold-300"}`}>{reviewInfo.review.status === "approved" ? "منشور" : reviewInfo.review.status === "rejected" ? "مرفوض" : "قيد المراجعة"}</span>}</div>
                    <div className="flex gap-1" role="radiogroup" aria-label="عدد النجوم">{[1,2,3,4,5].map((value) => <button key={value} type="button" role="radio" aria-checked={reviewRating === value} onClick={() => setReviewRating(value)} className="p-1 text-gold-400"><Star className="size-7" fill={value <= reviewRating ? "currentColor" : "none"} /></button>)}</div>
                    <textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} maxLength={1000} rows="3" placeholder="اكتب رأيك في الخدمة — اختياري" className={fieldCls()} />
                    {reviewMessage && <p className="text-xs text-gold-300">{reviewMessage}</p>}
                    <button disabled={reviewBusy} className="rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-bold text-ink-950 disabled:opacity-50">{reviewBusy ? "جارٍ الإرسال..." : reviewInfo.review ? "تحديث التقييم" : "إرسال التقييم"}</button>
                </form>}
                {!reviewInfo.canReview && user && <p className="text-sm text-mute">يمكنك إضافة تقييم بعد إكمال أول طلب لهذا المنتج.</p>}
                {!reviews.length ? <p className={`${card} p-5 text-sm text-mute`}>لا توجد تقييمات منشورة بعد.</p> : <div className="space-y-3">{reviews.map((review) => <article key={review._id} className={`${card} p-4`}>
                    <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-1 font-semibold">{review.user?.name || "عميل"}{review.user?.verified && <BadgeCheck className="size-4 text-gold-400" />}</p><div className="flex gap-0.5 text-gold-400">{[1,2,3,4,5].map((value) => <Star key={value} className="size-3.5" fill={value <= review.rating ? "currentColor" : "none"} />)}</div></div>
                    {review.text && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-mute" dir="auto">{review.text}</p>}
                    <p className="mt-2 text-[11px] text-mute">{new Date(review.createdAt).toLocaleDateString("ar-SY")}</p>
                </article>)}</div>}
            </section>
        </Page>
    );
}
