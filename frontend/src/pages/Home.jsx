import { createElement, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Zap, Headset, ShieldCheck, MessageCircle, MessagesSquare, X } from "lucide-react";
import { categories, steps, catIcon } from "../data/store";
import { useProducts, useContact, useSite, useOrders } from "../lib/db";
import { api } from "../lib/api";
import { saveCurrency, useCurrency } from "../lib/currency";
import { useFavorites } from "../lib/favorites";
import ProductCard from "../components/ProductCard";

const catLabel = (id) => categories.find((c) => c.id === id)?.label;

export default function Home() {
    const currency = useCurrency();
    const contact = useContact();
    const site = useSite();
    const [offers, setOffers] = useState([]);
    const orders = useOrders();
    const localProducts = useProducts().filter((p) => p.active !== false);
    const [remoteProducts, setRemoteProducts] = useState(null);
    const [remoteCategories, setRemoteCategories] = useState(null);
    const favorites = useFavorites();
    useEffect(() => { api("/products").then((items) => setRemoteProducts(items.map((p) => ({ ...p, id: p.slug, cat: p.category, from: p.packages?.[0]?.retailPrice ?? p.packages?.[0]?.price ?? 0, packages: p.packages?.map((x) => ({ id: x._id, label: x.title, price: x.retailPrice ?? x.price })) || [] })))).catch(() => {}); }, []);
    useEffect(() => { api("/categories").then((items) => setRemoteCategories(items.map((c) => ({ id: c.slug, label: c.label, icon: catIcon(c.slug) })))).catch(() => {}); }, []);
    useEffect(() => { api("/offers").then(setOffers).catch(() => {}); }, []);
    const categoryList = remoteCategories?.length ? remoteCategories : categories;
    const labelFor = (id) => categoryList.find((c) => c.id === id)?.label || catLabel(id) || id;
    const products = (remoteProducts || localProducts).filter((p) => p.active !== false);
    const sold = (id) => orders.filter((o) => o.productId === id && o.status !== "cancelled").length;
    const popular = [...products].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || Number(b.purchaseCount || sold(b.id)) - Number(a.purchaseCount || sold(a.id)) || Number(b.ratingAverage || 0) - Number(a.ratingAverage || 0)).slice(0, 6);
    const [q, setQ] = useState("");
    const [cat, setCat] = useState("");
    const [sort, setSort] = useState("recommended");
    const query = q.trim().toLowerCase();
    const filtering = Boolean(query || cat || sort !== "recommended");
    const sortProducts = (items) => [...items].sort((a, b) => {
        if (sort === "alphabetical") return a.name.localeCompare(b.name, "ar");
        if (sort === "purchases") return Number(b.purchaseCount || 0) - Number(a.purchaseCount || 0) || a.name.localeCompare(b.name, "ar");
        if (sort === "rating") return Number(b.ratingAverage || 0) - Number(a.ratingAverage || 0) || Number(b.ratingCount || 0) - Number(a.ratingCount || 0);
        if (sort === "priceLow") return Number(a.from || 0) - Number(b.from || 0);
        if (sort === "priceHigh") return Number(b.from || 0) - Number(a.from || 0);
        if (sort === "favorites") return Number(favorites.has(b)) - Number(favorites.has(a)) || Number(b.purchaseCount || 0) - Number(a.purchaseCount || 0);
        return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || Number(b.purchaseCount || 0) - Number(a.purchaseCount || 0) || Number(b.ratingAverage || 0) - Number(a.ratingAverage || 0);
    });
    const results = sortProducts(products.filter((p) => (!cat || p.cat === cat) && (!query || (p.name + labelFor(p.cat)).toLowerCase().includes(query))));

    return (
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-5">
            {site.bannerOn && site.banner && <p role="status" className="mb-4 rounded-xl border border-gold-500/50 bg-gold-500/10 px-4 py-2.5 text-center text-sm text-gold-200" dir="auto">{site.banner}</p>}
            {site.maintenance && <p role="alert" className="mb-4 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-center text-sm text-red-300" dir="auto">{site.maintenanceMsg}</p>}
            <header className="mb-5 flex items-center gap-3">
                <img src={site.logoUrl || "/assets/rs-logo.jpg"} alt="" className="size-11 rounded-full border border-gold-500 object-cover" />
                <div>
                    <p className="font-extrabold leading-tight text-gold-300" dir="auto">{site.name}</p>
                    <p className="text-xs text-mute" dir="auto">{site.tagline}</p>
                </div>
            </header>
            <div className="mb-4 flex justify-end"><label className="flex items-center gap-2 text-xs text-mute">عرض الأسعار<select value={currency.selected} onChange={(e) => saveCurrency({ ...currency, selected: e.target.value })} className="rounded-xl border border-gold-500/40 bg-ink-900 px-3 py-2 text-sand"><option value="SYP">ليرة سورية</option><option value="TRY">ليرة تركية</option><option value="USD">دولار</option></select></label></div>

            <section className="relative overflow-hidden rounded-3xl border border-gold-600/40 bg-ink-900">
                <div className="flex items-center gap-4 p-5 sm:p-8">
                    <div className="flex-1">
                        <h1 className="text-2xl font-extrabold leading-snug sm:text-4xl">اشحن ألعابك وبطاقاتك <br />في دقائق</h1>
                        <p className="mt-3 max-w-md text-sm leading-relaxed text-mute">أسعار واضحة وتنفيذ سريع ودعم مباشر على واتساب وتليغرام.</p>
                        <a href="#categories" className="mt-5 inline-block rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-6 py-3 text-sm font-bold text-ink-950">تصفح الأقسام</a>
                    </div>
                    <img src={site.logoUrl || "/assets/rs-logo.jpg"} alt={site.name || "RS Store"} className="w-32 shrink-0 rounded-2xl object-cover sm:w-64" />
                </div>
            </section>

            <div className="relative mt-5">
                <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-gold-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="ابحث عن لعبة أو خدمة..." aria-label="بحث"
                    className="w-full rounded-2xl border border-ink-700 bg-ink-900 py-3.5 pe-4 ps-12 text-sm text-sand placeholder:text-mute focus:border-gold-500 focus:outline-none" />
            </div>
            <div className="mt-3 flex justify-end"><label className="flex items-center gap-2 text-xs text-mute">ترتيب المنتجات<select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-sand"><option value="recommended">المقترحة</option><option value="purchases">الأكثر شراءً</option><option value="rating">الأعلى تقييمًا</option><option value="alphabetical">أبجديًا</option><option value="priceLow">السعر: الأقل أولًا</option><option value="priceHigh">السعر: الأعلى أولًا</option><option value="favorites">المفضلة أولًا</option></select></label></div>

            <section id="categories" className="mt-7 scroll-mt-4">
                <h2 className="mb-3 text-lg font-bold">الأقسام</h2>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                    {categoryList.map(({ id, label, icon }) => (
                        <button key={id} type="button" onClick={() => setCat(cat === id ? "" : id)} aria-pressed={cat === id}
                            className={`group overflow-hidden rounded-2xl border bg-ink-900 transition-colors hover:border-gold-500 ${cat === id ? "border-gold-400 ring-1 ring-gold-400" : "border-ink-700"}`}>
                            <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-gold-600/35 via-ink-800 to-ink-900">
                                {createElement(icon, { className: "size-10 text-gold-300 transition-transform group-hover:scale-110", strokeWidth: 1.6 })}
                            </div>
                            <p className="px-2 py-3 text-center text-xs font-medium leading-snug">{label}</p>
                        </button>
                    ))}
                </div>
            </section>

            {filtering ? (
                <section className="mt-7" aria-live="polite">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h2 className="text-lg font-bold">{query ? "نتائج البحث" : cat ? labelFor(cat) : "المنتجات المرتبة"}</h2>
                        {cat && <button type="button" onClick={() => setCat("")} className="flex items-center gap-1 rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-mute hover:text-sand"><X className="size-4" />{labelFor(cat)}</button>}
                    </div>
                    {results.length ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{results.map((p) => <ProductCard key={p.id} product={p} categoryLabel={labelFor(p.cat)} favorite={favorites.has(p)} onFavorite={(item) => favorites.toggle(item).catch(() => {})} />)}</div>
                    ) : (
                        <p className="rounded-2xl border border-ink-700 bg-ink-900 p-5 text-mute">{query ? `لا توجد نتائج لـ «${q}». جرّب اسم لعبة أو خدمة أخرى.` : "لا توجد منتجات في هذا القسم حاليًا."}</p>
                    )}
                </section>
            ) : (
                <>
                    {offers.length > 0 && <section className="mt-9">
                        <h2 className="mb-3 text-lg font-bold">العروض والخصومات</h2>
                        <div className="scroll-hide -mx-4 flex gap-3 overflow-x-auto px-4">
                            {offers.map((o) => (
                                <div key={o._id} className="relative w-64 shrink-0 overflow-hidden rounded-2xl border border-gold-600/40 bg-gradient-to-br from-gold-600/25 to-ink-900 p-4">
                                    {o.image && <img src={o.image} alt="" className="mb-3 h-28 w-full rounded-xl object-cover" />}
                                    {o.badge && <span className="mb-2 inline-block rounded-full bg-gold-500 px-2.5 py-1 text-[11px] font-bold text-ink-950">{o.badge}</span>}
                                    <h3 className="font-bold text-gold-300" dir="auto">{o.title}</h3>
                                    <p className="mt-1 text-sm text-mute">{o.text}</p>
                                    {o.code && <p className="mt-3 inline-block rounded-lg border border-dashed border-gold-400 px-3 py-1 text-sm font-bold tracking-widest text-gold-300" dir="ltr">{o.code}</p>}
                                    {o.link && <Link to={o.link} className="mt-3 block text-sm font-semibold text-gold-300">عرض التفاصيل</Link>}
                                </div>
                            ))}
                        </div>
                    </section>}

                    <section className="mt-9">
                        <h2 className="mb-3 text-lg font-bold">المنتجات الأكثر طلبًا</h2>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{popular.map((p) => <ProductCard key={p.id} product={p} categoryLabel={labelFor(p.cat)} favorite={favorites.has(p)} onFavorite={(item) => favorites.toggle(item).catch(() => {})} />)}</div>
                    </section>

                    <section className="mt-9">
                        <h2 className="mb-3 text-lg font-bold">خطوات الشراء</h2>
                        <ol className="grid gap-3 sm:grid-cols-4">
                            {steps.map((s, i) => (
                                <li key={s.title} className="flex gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4">
                                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold-500 text-sm font-extrabold text-ink-950">{i + 1}</span>
                                    <div><h3 className="font-semibold">{s.title}</h3><p className="mt-1 text-sm leading-relaxed text-mute">{s.text}</p></div>
                                </li>
                            ))}
                        </ol>
                    </section>

                    <section className="mt-9 grid gap-3 sm:grid-cols-3">
                        {[[Zap, "تنفيذ سريع", "نبدأ بتنفيذ طلبك فور تأكيد الدفع."], [ShieldCheck, "دفع آمن", "نراجع كل إيصال قبل تنفيذ الطلب."], [Headset, "دعم مباشر", "فريقنا متاح عبر واتساب وتليغرام."]].map(([icon, t, d]) => (
                            <div key={t} className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4">
                                {createElement(icon, { className: "size-8 shrink-0 text-gold-400", strokeWidth: 1.6 })}
                                <div><h3 className="font-semibold">{t}</h3><p className="text-sm text-mute">{d}</p></div>
                            </div>
                        ))}
                    </section>

                    <section className="mt-9 rounded-2xl border border-gold-600/40 bg-gradient-to-br from-gold-600/20 to-ink-900 p-5">
                        <h2 className="text-lg font-bold">دعم العملاء</h2>
                        <p className="mt-1 text-sm text-mute">عندك سؤال أو مشكلة بطلبك؟ فريقنا جاهز يساعدك.</p>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                            {contact.whatsapp && <a href={contact.whatsappUrl} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25a95a] py-3 font-bold text-white"><MessageCircle className="size-5" />واتساب</a>}
                            <button type="button" onClick={() => window.dispatchEvent(new Event("rs:open-chat"))} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 py-3 font-bold text-ink-950"><MessagesSquare className="size-5" />محادثة مباشرة</button>
                        </div>
                    </section>
                </>
            )}
        </main>
    );
}
