import { useEffect, useMemo, useState } from "react";
import { Boxes, KeyRound, RefreshCw, Trash2, Upload } from "lucide-react";
import { api } from "../../lib/api";
import { Empty, Field, inputCls, btnGold, btnGhost } from "./ui";

const statusLabels = { available: "متاح", reserved: "محجوز", sold: "مباع", disabled: "معطّل" };
const statusTone = { available: "text-emerald-300", reserved: "text-gold-300", sold: "text-blue-300", disabled: "text-red-300" };

export default function CodesTab() {
    const [products, setProducts] = useState([]);
    const [productId, setProductId] = useState("");
    const [packageId, setPackageId] = useState("");
    const [status, setStatus] = useState("all");
    const [codes, setCodes] = useState("");
    const [inventory, setInventory] = useState({ items: [], summary: {} });
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);

    const product = products.find((item) => item._id === productId);
    const pack = product?.packages?.find((item) => item._id === packageId);
    const packages = product?.packages || [];
    const query = useMemo(() => { const params = new URLSearchParams(); if (productId) params.set("productId", productId); if (packageId) params.set("packageId", packageId); if (status !== "all") params.set("status", status); return params.toString(); }, [productId, packageId, status]);

    const loadProducts = async () => {
        try { const list = await api("/admin/products"); setProducts(list); if (!productId && list[0]) { setProductId(list[0]._id); setPackageId(list[0].packages?.[0]?._id || ""); } }
        catch (error) { setMessage({ bad: true, text: error.message }); }
    };
    const loadInventory = async () => { setBusy(true); try { setInventory(await api("/admin/codes?" + query)); } catch (error) { setMessage({ bad: true, text: error.message }); } finally { setBusy(false); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial product bootstrap
    useEffect(() => { loadProducts(); }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- query serializes the complete filter
    useEffect(() => { if (productId) loadInventory(); }, [query]);

    const chooseProduct = (value) => { const selected = products.find((item) => item._id === value); setProductId(value); setPackageId(selected?.packages?.[0]?._id || ""); };
    const importCodes = async (event) => {
        event.preventDefault(); setBusy(true); setMessage(null);
        try { const result = await api("/admin/codes/import", { method: "POST", body: JSON.stringify({ productId, packageId, codes }) }); setCodes(""); setMessage({ text: "تمت إضافة " + result.imported + " كود، والمكرر " + result.duplicates + "." }); await loadInventory(); }
        catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };
    const setDelivery = async (deliveryType) => {
        setBusy(true); setMessage(null);
        try { const updated = await api("/admin/products/" + productId + "/packages/" + packageId + "/delivery", { method: "PATCH", body: JSON.stringify({ deliveryType }) }); setProducts((list) => list.map((item) => item._id === updated._id ? updated : item)); setMessage({ text: deliveryType === "code" ? "تم تفعيل التسليم التلقائي من المخزن." : "تم تحويل الباقة إلى التسليم اليدوي." }); }
        catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };
    const disable = async (item) => {
        if (!window.confirm("تعطيل هذا الكود؟")) return;
        try { await api("/admin/codes/" + item._id, { method: "DELETE" }); await loadInventory(); }
        catch (error) { setMessage({ bad: true, text: error.message }); }
    };

    return <section className="space-y-5">
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4"><div className="mb-4 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-gold-500/15 text-gold-400"><Boxes className="size-6"/></span><div><h3 className="font-bold">مخزن الأكواد الرقمية</h3><p className="text-xs text-mute">الأكواد مشفّرة ولا تظهر كاملة داخل لوحة التحكم.</p></div></div><div className="grid gap-3 sm:grid-cols-2"><Field label="المنتج"><select value={productId} onChange={(event) => chooseProduct(event.target.value)} className={inputCls()}>{products.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Field><Field label="الباقة"><select value={packageId} onChange={(event) => setPackageId(event.target.value)} className={inputCls()}>{packages.map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}</select></Field></div>{pack && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-800 p-3"><div><p className="text-sm font-semibold">طريقة تسليم الباقة</p><p className="text-xs text-mute">التلقائي يسحب كودًا متاحًا عند إكمال الطلب.</p></div><div className="flex gap-2"><button type="button" onClick={() => setDelivery("manual")} className={(pack.deliveryType !== "code" ? "border-gold-500 bg-gold-500 text-ink-950" : "border-ink-700") + " rounded-xl border px-3 py-2 text-sm font-bold"}>يدوي</button><button type="button" onClick={() => setDelivery("code")} className={(pack.deliveryType === "code" ? "border-gold-500 bg-gold-500 text-ink-950" : "border-ink-700") + " rounded-xl border px-3 py-2 text-sm font-bold"}>تلقائي من المخزن</button></div></div>}</div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(statusLabels).map(([key,label]) => <button key={key} type="button" onClick={() => setStatus(status === key ? "all" : key)} className={(status === key ? "border-gold-500 bg-gold-500/10" : "border-ink-700 bg-ink-900") + " rounded-xl border p-3 text-center"}><p className={"text-xl font-extrabold " + statusTone[key]}>{inventory.summary?.[key] || 0}</p><p className="text-xs text-mute">{label}</p></button>)}</div>

        <form onSubmit={importCodes} className="space-y-3 rounded-2xl border border-ink-700 bg-ink-900 p-4"><h3 className="flex items-center gap-2 font-bold"><Upload className="size-5 text-gold-400"/>إضافة أكواد للمخزن</h3><Field label="الأكواد" hint="ضع كل كود في سطر مستقل — حتى 1000 كود في المرة الواحدة"><textarea required value={codes} onChange={(event) => setCodes(event.target.value)} rows="7" placeholder={"ABCD-EFGH-1234\nWXYZ-5678-9012"} className={inputCls()} dir="ltr"/></Field>{message && <p className={(message.bad ? "border-red-500/40 text-red-300" : "border-emerald-500/40 text-emerald-300") + " rounded-xl border p-3 text-sm"}>{message.text}</p>}<button disabled={busy || !productId || !packageId || !codes.trim()} className={btnGold + " flex items-center gap-2"}><Upload className="size-4"/>{busy ? "جارٍ الإضافة..." : "إضافة إلى المخزن"}</button></form>

        <div><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">الأكواد المخزنة</h3><button type="button" onClick={loadInventory} className={btnGhost}><RefreshCw className={(busy ? "animate-spin " : "") + "size-4"}/></button></div>{!inventory.items.length ? <Empty>{busy ? "جارٍ التحميل..." : "لا توجد أكواد ضمن هذا الاختيار."}</Empty> : <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="divide-y divide-ink-700">{inventory.items.map((item) => <div key={item._id} className="flex items-center gap-3 p-3"><span className="grid size-9 place-items-center rounded-lg bg-gold-500/10 text-gold-400"><KeyRound className="size-4"/></span><div className="min-w-0 flex-1"><p className="font-mono font-bold text-gold-300" dir="ltr">{item.preview}</p><p className="truncate text-xs text-mute">{item.product?.name} · {item.packageTitle}</p></div><div className="text-end"><p className={"text-xs font-bold " + statusTone[item.status]}>{statusLabels[item.status]}</p><p className="text-[11px] text-mute">{new Date(item.createdAt).toLocaleDateString("ar-SY")}</p></div>{item.status === "available" && <button type="button" onClick={() => disable(item)} className="rounded-lg p-2 text-red-400"><Trash2 className="size-4"/></button>}</div>)}</div></div>}</div>
    </section>;
}
