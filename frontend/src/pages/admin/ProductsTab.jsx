import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, ImagePlus, Pencil, Plus, RefreshCw, Search, Star, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Empty, Field, Modal, inputCls, btnGold, btnGhost } from "./ui";

const packagesToText = (items = []) => items.map((p) => [p.title, p.retailPrice ?? p.price, p.agentPrice ?? "", p.wholesalePrice ?? ""].join(" | ")).join("\n");
const parsePackages = (text, existing = []) => text.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [title, retail, agent, wholesale] = line.split("|").map((x) => x.trim());
    const previous = existing[index];
    return { ...(previous?._id ? { _id: previous._id } : {}), title, price: Number(retail), retailPrice: Number(retail), agentPrice: agent === "" ? undefined : Number(agent), wholesalePrice: wholesale === "" ? undefined : Number(wholesale), deliveryType: previous?.deliveryType || "manual", apiProviderId: previous?.apiProviderId || null, providerCode: previous?.providerCode || null, autoFulfill: Boolean(previous?.autoFulfill), active: true };
});

function ProductForm({ initial, categories, onSaved, onClose }) {
    const fileRef = useRef(null);
    const [form, setForm] = useState({
        name: initial.name || "", slug: initial.slug || "", category: initial.category || categories[0]?.slug || "",
        description: initial.description || "", image: initial.image || "", featured: Boolean(initial.featured),
        packagesText: packagesToText(initial.packages)
    });
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
    const uploadImage = async (e) => {
        const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
        const body = new FormData(); body.append("file", file); setBusy(true);
        try { const result = await api("/admin/product-image", { method: "POST", body }); setForm((old) => ({ ...old, image: result.url })); }
        catch (x) { setError(x.message); } finally { setBusy(false); }
    };
    const submit = async (e) => {
        e.preventDefault(); setError("");
        const packages = parsePackages(form.packagesText, initial.packages);
        if (form.name.trim().length < 2) return setError("أدخل اسم المنتج.");
        if (!/^[a-z0-9-]{2,60}$/.test(form.slug)) return setError("المعرّف يجب أن يحتوي أحرفًا إنجليزية صغيرة وأرقامًا وشرطة فقط.");
        if (!packages.length || packages.some((p) => !p.title || !(p.price > 0) || (p.agentPrice !== undefined && !(p.agentPrice >= 0)) || (p.wholesalePrice !== undefined && !(p.wholesalePrice >= 0)))) return setError("صيغة الباقات غير صحيحة.");
        setBusy(true);
        try {
            const payload = { name: form.name.trim(), slug: form.slug.trim(), category: form.category, description: form.description.trim(), image: form.image, featured: form.featured, active: initial.active !== false, packages };
            const result = await api("/admin/products" + (initial._id ? "/" + initial._id : ""), { method: initial._id ? "PATCH" : "POST", body: JSON.stringify(payload) });
            onSaved(result); onClose();
        } catch (x) { setError(x.message); } finally { setBusy(false); }
    };
    return <Modal title={initial._id ? "تعديل المنتج" : "إضافة منتج"} onClose={onClose}>
        <form onSubmit={submit} className="space-y-4">
            <div><span className="mb-1.5 block text-sm font-medium">صورة المنتج</span><div className="flex items-center gap-3"><div className="grid size-24 place-items-center overflow-hidden rounded-xl border border-dashed border-ink-700 bg-ink-800">{form.image ? <img src={form.image} alt="" className="size-full object-cover"/> : <ImagePlus className="size-7 text-mute"/>}</div><div className="space-y-2"><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} className="hidden"/><button type="button" onClick={() => fileRef.current?.click()} className={btnGhost}>رفع صورة</button>{form.image && <button type="button" onClick={() => setForm({ ...form, image: "" })} className="block text-xs text-red-400">إزالة</button>}</div></div></div>
            <Field label="اسم المنتج"><input value={form.name} onChange={set("name")} className={inputCls()}/></Field>
            <Field label="المعرّف الإنجليزي للرابط"><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })} placeholder="pubg-mobile" className={inputCls()} dir="ltr"/></Field>
            <Field label="القسم"><select value={form.category} onChange={set("category")} className={inputCls()}>{categories.filter((x) => x.active !== false).map((x) => <option value={x.slug} key={x._id}>{x.label}</option>)}</select></Field>
            <Field label="الوصف"><textarea value={form.description} onChange={set("description")} rows="2" className={inputCls()}/></Field>
            <Field label="الباقات والأسعار" hint="كل سطر: اسم الباقة | سعر المفرق | سعر الوكيل | سعر الجملة"><textarea value={form.packagesText} onChange={set("packagesText")} rows="5" placeholder={"60 UC | 1 | 0.95 | 0.90\n325 UC | 5 | 4.75 | 4.50"} className={inputCls()} dir="auto"/></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="size-4 accent-[#d4a22a]"/>منتج مميز</label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2"><button disabled={busy} className={btnGold + " flex-1"}>{busy ? "جارٍ الحفظ..." : "حفظ"}</button><button type="button" onClick={onClose} className={btnGhost}>إلغاء</button></div>
        </form>
    </Modal>;
}

export default function ProductsTab() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [editing, setEditing] = useState(null);
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("");
    const [newCategory, setNewCategory] = useState({ label: "", slug: "" });
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const load = async () => { setBusy(true); setMessage(""); try { const [p, c] = await Promise.all([api("/admin/products"), api("/admin/categories")]); setProducts(p); setCategories(c); } catch (e) { setMessage(e.message); } finally { setBusy(false); } };
    useEffect(() => { load(); }, []);
    const visible = useMemo(() => products.filter((p) => (!category || p.category === category) && (!query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase()))), [products, category, query]);
    const saved = (product) => setProducts((list) => list.some((x) => x._id === product._id) ? list.map((x) => x._id === product._id ? product : x) : [product, ...list]);
    const patch = async (product, change) => { try { saved(await api("/admin/products/" + product._id, { method: "PATCH", body: JSON.stringify(change) })); } catch (e) { setMessage(e.message); } };
    const remove = async (product) => { if (!window.confirm("إخفاء المنتج «" + product.name + "» من المتجر؟")) return; try { await api("/admin/products/" + product._id, { method: "DELETE" }); setProducts((list) => list.map((x) => x._id === product._id ? { ...x, active: false } : x)); } catch (e) { setMessage(e.message); } };
    const addCategory = async (e) => { e.preventDefault(); try { const c = await api("/admin/categories", { method: "POST", body: JSON.stringify(newCategory) }); setCategories((list) => [...list, c]); setNewCategory({ label: "", slug: "" }); } catch (x) { setMessage(x.message); } };

    return <section className="space-y-6">
        <form onSubmit={addCategory} className="flex flex-wrap gap-2 rounded-2xl border border-ink-700 bg-ink-900 p-4"><div className="w-full"><h3 className="font-bold">إضافة قسم جديد</h3><p className="text-xs text-mute">يظهر القسم مباشرة ضمن خيارات المنتجات.</p></div><input required minLength="2" value={newCategory.label} onChange={(e) => setNewCategory({ ...newCategory, label: e.target.value })} placeholder="اسم القسم" className={inputCls() + " min-w-40 flex-1"}/><input required pattern="[a-z0-9-]{2,30}" value={newCategory.slug} onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })} placeholder="category-slug" className={inputCls() + " min-w-40 flex-1"} dir="ltr"/><button className={btnGold}>إضافة القسم</button></form>

        <div className="flex gap-2"><div className="relative flex-1"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gold-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث في المنتجات" className={inputCls() + " ps-10"}/></div><button type="button" onClick={load} className={btnGhost}><RefreshCw className={"size-4 " + (busy ? "animate-spin" : "")}/></button><button type="button" onClick={() => setEditing({})} className={btnGold + " flex items-center gap-2"}><Plus className="size-4"/>منتج</button></div>
        <div className="scroll-hide flex gap-2 overflow-x-auto"><button type="button" onClick={() => setCategory("")} className={"shrink-0 rounded-xl border px-3 py-2 text-sm " + (!category ? "border-gold-500 bg-gold-500 text-ink-950" : "border-ink-700")}>الكل</button>{categories.map((c) => <button key={c._id} type="button" onClick={() => setCategory(c.slug)} className={"shrink-0 rounded-xl border px-3 py-2 text-sm " + (category === c.slug ? "border-gold-500 bg-gold-500 text-ink-950" : "border-ink-700")}>{c.label}</button>)}</div>
        {message && <p className="rounded-xl border border-red-500/40 p-3 text-sm text-red-300">{message}</p>}
        {!visible.length && <Empty>{busy ? "جارٍ التحميل..." : "لا توجد منتجات."}</Empty>}
        <div className="space-y-2">{visible.map((product) => <article key={product._id} className={"flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-3 " + (product.active ? "" : "opacity-60")}><div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-gold-500/10">{product.image ? <img src={product.image} alt="" className="size-full object-cover"/> : <ImagePlus className="size-5 text-gold-400"/>}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{product.name}</p><p className="text-xs text-mute">{categories.find((c) => c.slug === product.category)?.label || product.category} · {product.packages?.length || 0} باقات</p></div><button type="button" onClick={() => patch(product, { featured: !product.featured })} className={product.featured ? "p-2 text-gold-300" : "p-2 text-mute"}><Star className="size-5" fill={product.featured ? "currentColor" : "none"}/></button><button type="button" onClick={() => patch(product, { active: !product.active })} className="p-2 text-mute">{product.active ? <Eye className="size-5"/> : <EyeOff className="size-5"/>}</button><button type="button" onClick={() => setEditing(product)} className="p-2 text-gold-400"><Pencil className="size-5"/></button><button type="button" onClick={() => remove(product)} className="p-2 text-red-400"><Trash2 className="size-5"/></button></article>)}</div>
        {editing && <ProductForm initial={editing} categories={categories} onSaved={saved} onClose={() => setEditing(null)}/>}
    </section>;
}
