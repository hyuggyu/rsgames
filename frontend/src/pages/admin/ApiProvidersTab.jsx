import { useEffect, useState } from "react";
import { Eye, Pencil, PlugZap, RefreshCw, RotateCcw, Save, X } from "lucide-react";
import { api } from "../../lib/api";
import { Empty, Field, inputCls, btnGold, btnGhost } from "./ui";

const initialForm = {
  name: "", baseUrl: "", orderPath: "/orders", statusPath: "/orders/{externalOrderId}",
  httpMethod: "POST", authType: "bearer", authName: "", apiKey: "",
  requestTemplateText: '{\n  "product": "{productCode}",\n  "player_id": "{customer.playerId}",\n  "quantity": "{quantity}",\n  "reference": "{orderNumber}"\n}',
  externalIdPath: "order_id", statusResponsePath: "status",
  successValuesText: "completed,success", pendingValuesText: "pending,processing", timeoutMs: 15000, active: true
};

const statuses = { queued: "في الانتظار", sending: "جارٍ الإرسال", processing: "قيد التنفيذ", completed: "مكتمل", failed: "فشل", cancelled: "ملغي" };

export default function ApiProvidersTab() {
  const [providers, setProviders] = useState([]);
  const [products, setProducts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [section, setSection] = useState("providers");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setBusy(true); setMessage(null);
    try {
      const [p, productsData, jobsData] = await Promise.all([api("/admin/api-providers"), api("/admin/products"), api("/admin/api-fulfillments")]);
      setProviders(p); setProducts(productsData); setJobs(jobsData);
    } catch (error) { setMessage({ bad: true, text: error.message }); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value });
  const edit = (provider) => {
    setEditingId(provider.id);
    setForm({
      name: provider.name, baseUrl: provider.baseUrl, orderPath: provider.orderPath, statusPath: provider.statusPath || "",
      httpMethod: provider.httpMethod, authType: provider.authType, authName: provider.authName || "", apiKey: "",
      requestTemplateText: JSON.stringify(provider.requestTemplate || {}, null, 2),
      externalIdPath: provider.externalIdPath, statusResponsePath: provider.statusResponsePath,
      successValuesText: (provider.successValues || []).join(","), pendingValuesText: (provider.pendingValues || []).join(","),
      timeoutMs: provider.timeoutMs, active: provider.active
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const reset = () => { setEditingId(null); setForm(initialForm); };
  const save = async (event) => {
    event.preventDefault(); setMessage(null);
    let requestTemplate;
    try { requestTemplate = JSON.parse(form.requestTemplateText); } catch { return setMessage({ bad: true, text: "قالب JSON غير صالح." }); }
    setBusy(true);
    try {
      const payload = { ...form, requestTemplate, successValues: form.successValuesText.split(",").map((x) => x.trim()).filter(Boolean), pendingValues: form.pendingValuesText.split(",").map((x) => x.trim()).filter(Boolean), timeoutMs: Number(form.timeoutMs) };
      delete payload.requestTemplateText; delete payload.successValuesText; delete payload.pendingValuesText;
      await api("/admin/api-providers" + (editingId ? "/" + editingId : ""), { method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setMessage({ text: editingId ? "تم تحديث المزوّد." : "تمت إضافة المزوّد." }); reset(); await load();
    } catch (error) { setMessage({ bad: true, text: error.message }); }
    finally { setBusy(false); }
  };
  const mapPackage = async (product, pack, enabled, providerId, providerCode) => {
    setBusy(true); setMessage(null);
    try {
      await api("/admin/products/" + product.id + "/packages/" + pack.id + "/api", { method: "PATCH", body: JSON.stringify({ enabled, providerId, providerCode }) });
      setMessage({ text: enabled ? "تم تفعيل الشحن التلقائي للباقة." : "تم إلغاء الربط التلقائي." }); await load();
    } catch (error) { setMessage({ bad: true, text: error.message }); }
    finally { setBusy(false); }
  };
  const retry = async (job) => {
    setBusy(true); setMessage(null);
    try { await api("/admin/api-fulfillments/" + job.id + "/retry", { method: "POST", body: "{}" }); setMessage({ text: "أُعيدت العملية إلى قائمة التنفيذ." }); await load(); }
    catch (error) { setMessage({ bad: true, text: error.message }); }
    finally { setBusy(false); }
  };

  return <section className="space-y-5">
    <div className="flex flex-wrap gap-2">
      {[["providers","المزوّدون"],["mapping","ربط الباقات"],["jobs","عمليات الشحن"]].map(([key,label]) => <button key={key} type="button" onClick={() => setSection(key)} className={"rounded-xl border px-4 py-2 text-sm font-bold " + (section === key ? "border-gold-500 bg-gold-500 text-ink-950" : "border-ink-700")}>{label}</button>)}
      <button type="button" onClick={load} className={btnGhost}><RefreshCw className={"size-4 " + (busy ? "animate-spin" : "")}/></button>
    </div>
    {message && <p className={"rounded-xl border p-3 text-sm " + (message.bad ? "border-red-500/40 text-red-300" : "border-emerald-500/40 text-emerald-300")}>{message.text}</p>}

    {section === "providers" && <>
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-5">
        <div className="flex items-center justify-between"><div><h3 className="font-extrabold">{editingId ? "تعديل مزوّد API" : "إضافة مزوّد API"}</h3><p className="text-xs text-mute">يُشفّر المفتاح ولا يظهر بعد الحفظ.</p></div>{editingId && <button type="button" onClick={reset} className={btnGhost}><X className="size-4"/></button>}</div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="اسم المزوّد"><input required value={form.name} onChange={set("name")} className={inputCls()}/></Field>
          <Field label="الرابط الأساسي HTTPS"><input required value={form.baseUrl} onChange={set("baseUrl")} placeholder="https://api.provider.com" className={inputCls()} dir="ltr"/></Field>
          <Field label="مسار إنشاء الطلب"><input required value={form.orderPath} onChange={set("orderPath")} placeholder="/v1/orders" className={inputCls()} dir="ltr"/></Field>
          <Field label="مسار متابعة الطلب"><input value={form.statusPath} onChange={set("statusPath")} placeholder="/v1/orders/{externalOrderId}" className={inputCls()} dir="ltr"/></Field>
          <Field label="نوع المصادقة"><select value={form.authType} onChange={set("authType")} className={inputCls()}><option value="bearer">Bearer Token</option><option value="header">Header مخصص</option><option value="query">Query Parameter</option><option value="none">بدون مفتاح</option></select></Field>
          <Field label="اسم Header أو Query"><input value={form.authName} onChange={set("authName")} placeholder="X-API-Key أو api_key" className={inputCls()} dir="ltr"/></Field>
          <Field label={editingId ? "مفتاح API جديد (اتركه فارغاً للإبقاء على القديم)" : "مفتاح API"}><input required={!editingId && form.authType !== "none"} type="password" value={form.apiKey} onChange={set("apiKey")} className={inputCls()} dir="ltr" autoComplete="new-password"/></Field>
          <Field label="مهلة الاتصال بالمللي ثانية"><input type="number" min="3000" max="30000" value={form.timeoutMs} onChange={set("timeoutMs")} className={inputCls()} dir="ltr"/></Field>
          <Field label="مسار رقم الطلب في الاستجابة"><input value={form.externalIdPath} onChange={set("externalIdPath")} className={inputCls()} dir="ltr"/></Field>
          <Field label="مسار الحالة في الاستجابة"><input value={form.statusResponsePath} onChange={set("statusResponsePath")} className={inputCls()} dir="ltr"/></Field>
          <Field label="حالات النجاح مفصولة بفاصلة"><input value={form.successValuesText} onChange={set("successValuesText")} className={inputCls()} dir="ltr"/></Field>
          <Field label="حالات الانتظار مفصولة بفاصلة"><input value={form.pendingValuesText} onChange={set("pendingValuesText")} className={inputCls()} dir="ltr"/></Field>
        </div>
        <Field label="قالب JSON المرسل للمزوّد" hint="المتاح: productCode, quantity, orderNumber, customer.playerId, customer.zoneId"><textarea required rows="8" value={form.requestTemplateText} onChange={set("requestTemplateText")} className={inputCls() + " font-mono text-xs"} dir="ltr"/></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={set("active")} className="size-4 accent-[#d4a22a]"/>المزوّد فعّال</label>
        <button disabled={busy} className={btnGold + " flex items-center gap-2"}><Save className="size-4"/>{editingId ? "حفظ التعديل" : "إضافة المزوّد"}</button>
      </form>
      <div className="space-y-2">{providers.map((provider) => <article key={provider.id} className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4"><span className="grid size-11 place-items-center rounded-xl bg-gold-500/15 text-gold-300"><PlugZap className="size-6"/></span><div className="min-w-0 flex-1"><p className="font-bold">{provider.name}</p><p className="truncate text-xs text-mute" dir="ltr">{provider.baseUrl}{provider.orderPath}</p><p className="mt-1 text-xs text-mute">{provider._count?.packages || 0} باقة مربوطة · {provider.active ? "فعّال" : "متوقف"}</p></div><button type="button" onClick={() => edit(provider)} className={btnGhost}><Pencil className="size-4"/></button></article>)}</div>
      {!providers.length && <Empty>لا يوجد مزوّد API بعد.</Empty>}
    </>}

    {section === "mapping" && <div className="space-y-4">{products.map((product) => <article key={product.id} className="rounded-2xl border border-ink-700 bg-ink-900 p-4"><h3 className="mb-3 font-extrabold">{product.name}</h3><div className="space-y-3">{(product.packages || []).map((pack) => <PackageMap key={pack.id} product={product} pack={pack} providers={providers.filter((x) => x.active)} busy={busy} onSave={mapPackage}/>)}</div></article>)}</div>}

    {section === "jobs" && <div className="space-y-2">{jobs.map((job) => <article key={job.id} className="rounded-2xl border border-ink-700 bg-ink-900 p-4"><div className="flex items-center gap-3"><span className={"size-2 rounded-full " + (job.status === "completed" ? "bg-emerald-400" : job.status === "failed" ? "bg-red-400" : "bg-gold-400")}/><div className="min-w-0 flex-1"><p className="font-bold">{job.orderItem?.order?.orderNumber} · {job.orderItem?.packageTitle}</p><p className="text-xs text-mute">{job.provider?.name} · {statuses[job.status]} · المحاولة {job.attempts}</p>{job.lastError && <p className="mt-1 text-xs text-red-300">{job.lastError}</p>}</div>{job.status === "failed" && <button type="button" onClick={() => retry(job)} className={btnGhost}><RotateCcw className="size-4"/></button>}</div></article>)}</div>}
    {section === "jobs" && !jobs.length && <Empty>لا توجد عمليات شحن تلقائي بعد.</Empty>}
  </section>;
}

function PackageMap({ product, pack, providers, busy, onSave }) {
  const [enabled, setEnabled] = useState(pack.deliveryType === "api" && pack.autoFulfill);
  const [providerId, setProviderId] = useState(pack.apiProviderId || providers[0]?.id || "");
  const [providerCode, setProviderCode] = useState(pack.providerCode || "");
  return <div className="grid gap-2 rounded-xl bg-ink-800 p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
    <div><p className="text-xs text-mute">الباقة</p><p className="font-bold">{pack.title}</p></div>
    <Field label="المزوّد"><select disabled={!enabled} value={providerId} onChange={(e) => setProviderId(e.target.value)} className={inputCls()}><option value="">اختر المزوّد</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></Field>
    <Field label="رمز المنتج عند المزوّد"><input disabled={!enabled} value={providerCode} onChange={(e) => setProviderCode(e.target.value)} className={inputCls()} dir="ltr"/></Field>
    <div className="flex gap-2"><label className="flex items-center gap-2 rounded-xl border border-ink-700 px-3 py-3 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-[#d4a22a]"/>تلقائي</label><button disabled={busy || (enabled && (!providerId || !providerCode))} type="button" onClick={() => onSave(product, pack, enabled, providerId, providerCode)} className={btnGold}><Save className="size-4"/></button></div>
  </div>;
}
