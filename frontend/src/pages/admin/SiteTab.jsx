import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { refreshPublicSettings } from "../../lib/db";
import { Field, Switch, inputCls, btnGold, btnGhost } from "./ui";

const empty = { name: "RS Store", tagline: "", logoUrl: "/assets/rs-logo.jpg", banner: "", bannerOn: false, maintenance: false, maintenanceMsg: "", minimumOrderUSD: 0 };

export default function SiteTab() {
    const fileRef = useRef(null);
    const [form, setForm] = useState(empty);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const load = async () => { setBusy(true); try { const data = await api("/settings"); setForm({ ...empty, ...data.site }); setError(""); } catch (e) { setError(e.message); } finally { setBusy(false); } };
    useEffect(() => { load(); }, []);
    const set = (key) => (event) => { setForm({ ...form, [key]: event.target.value }); setSaved(false); };
    const upload = async (event) => {
        const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
        const body = new FormData(); body.append("file", file); setBusy(true);
        try { const result = await api("/admin/site-logo", { method: "POST", body }); setForm((old) => ({ ...old, logoUrl: result.url })); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    const save = async (event) => {
        event.preventDefault(); setSaved(false); setError("");
        if (form.name.trim().length < 2) return setError("أدخل اسم الموقع.");
        if (form.bannerOn && !form.banner.trim()) return setError("اكتب نص شريط الإعلان أو عطّله.");
        setBusy(true);
        try { const result = await api("/admin/settings", { method: "PATCH", body: JSON.stringify({ site: { ...form, minimumOrderUSD: Number(form.minimumOrderUSD || 0) } }) }); setForm(result.site); await refreshPublicSettings(true); setSaved(true); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    };

    return <form onSubmit={save} className="space-y-5">
        <section className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-5"><div className="flex items-center justify-between"><h2 className="font-bold">هوية الموقع</h2><button type="button" onClick={load} className={btnGhost}><RefreshCw className={(busy ? "animate-spin " : "") + "size-4"}/></button></div><div><span className="mb-1.5 block text-sm font-medium">شعار المتجر</span><div className="flex items-center gap-3"><div className="grid size-24 place-items-center overflow-hidden rounded-2xl border border-gold-500/40 bg-black">{form.logoUrl ? <img src={form.logoUrl} alt="شعار المتجر" className="size-full object-contain"/> : <ImagePlus className="size-7 text-mute"/>}</div><div><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} className="hidden"/><button type="button" onClick={() => fileRef.current?.click()} className={btnGhost}>رفع شعار جديد</button><p className="mt-2 text-xs text-mute">PNG أو WebP مربعة، حتى 5MB.</p></div></div></div><Field label="اسم الموقع"><input value={form.name} onChange={set("name")} maxLength="40" className={inputCls()}/></Field><Field label="الشعار النصي تحت الاسم"><input value={form.tagline} onChange={set("tagline")} maxLength="100" className={inputCls()}/></Field><Field label="الحد الأدنى للطلب بالدولار" hint="اكتب 0 لتعطيل الحد الأدنى"><input type="number" min="0" step="0.01" value={form.minimumOrderUSD} onChange={set("minimumOrderUSD")} className={inputCls()} dir="ltr"/></Field></section>
        <section className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">شريط الإعلان</h2><p className="text-xs text-mute">يظهر أعلى الصفحة الرئيسية.</p></div><Switch on={form.bannerOn} onChange={(value) => setForm({ ...form, bannerOn: value })} label="تفعيل الشريط"/></div><Field label="نص الشريط"><input value={form.banner} onChange={set("banner")} maxLength="200" className={inputCls()}/></Field></section>
        <section className={(form.maintenance ? "border-red-500/60 " : "border-ink-700 ") + "space-y-4 rounded-2xl border bg-ink-900 p-5"}><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">وضع الصيانة</h2><p className="text-xs text-mute">يمنع إنشاء الطلبات من الواجهة والباك إند.</p></div><Switch on={form.maintenance} onChange={(value) => setForm({ ...form, maintenance: value })} label="وضع الصيانة"/></div><Field label="رسالة الصيانة"><textarea value={form.maintenanceMsg} onChange={set("maintenanceMsg")} rows="2" maxLength="250" className={inputCls()}/></Field></section>
        {error && <p className="rounded-xl border border-red-500/40 p-3 text-sm text-red-300">{error}</p>}
        <div className="flex items-center gap-3"><button disabled={busy} className={btnGold}>{busy ? "جارٍ الحفظ..." : "حفظ إعدادات الموقع"}</button>{saved && <span className="flex items-center gap-1 text-sm text-emerald-400"><Check className="size-4"/>تم الحفظ والتطبيق</span>}</div>
    </form>;
}
