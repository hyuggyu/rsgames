import { useEffect, useState } from "react";
import { Clipboard, KeyRound, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api";
import { Empty, Field, inputCls, btnGold, btnGhost } from "./ui";

export default function ResellerApiTab() {
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState("clients");
  const [form, setForm] = useState({ userId: "", name: "", allowedIps: "", requestsPerMinute: 60, expiresAt: "" });
  const [newKey, setNewKey] = useState("");
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true); setMessage(null);
    try {
      const [clientRows, userRows, logRows] = await Promise.all([api("/admin/reseller-api/clients"), api("/admin/users"), api("/admin/reseller-api/logs")]);
      setClients(clientRows); setUsers(Array.isArray(userRows) ? userRows : userRows.items || []); setLogs(logRows);
    } catch (error) { setMessage({ bad: true, text: error.message }); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);
  const create = async (event) => {
    event.preventDefault(); setBusy(true); setMessage(null); setNewKey("");
    try {
      const result = await api("/admin/reseller-api/clients", { method: "POST", body: JSON.stringify({ userId: form.userId, name: form.name, allowedIps: form.allowedIps.split(/[,\n]/).map((x) => x.trim()).filter(Boolean), requestsPerMinute: Number(form.requestsPerMinute), expiresAt: form.expiresAt || null }) });
      setNewKey(result.apiKey); setForm({ userId: "", name: "", allowedIps: "", requestsPerMinute: 60, expiresAt: "" }); setMessage({ text: "تم إنشاء المفتاح. انسخه الآن لأنه لن يظهر مرة ثانية." }); await load();
    } catch (error) { setMessage({ bad: true, text: error.message }); }
    finally { setBusy(false); }
  };
  const patch = async (client, change) => {
    setBusy(true); setMessage(null);
    try { await api("/admin/reseller-api/clients/" + client.id, { method: "PATCH", body: JSON.stringify(change) }); await load(); }
    catch (error) { setMessage({ bad: true, text: error.message }); } finally { setBusy(false); }
  };
  const regenerate = async (client) => {
    if (!window.confirm("المفتاح القديم سيتوقف فوراً. هل تريد إنشاء مفتاح جديد؟")) return;
    setBusy(true); setNewKey(""); setMessage(null);
    try { const result = await api("/admin/reseller-api/clients/" + client.id + "/regenerate", { method: "POST", body: "{}" }); setNewKey(result.apiKey); setMessage({ text: "تم إنشاء المفتاح الجديد. انسخه الآن." }); await load(); }
    catch (error) { setMessage({ bad: true, text: error.message }); } finally { setBusy(false); }
  };
  const copyKey = async () => { await navigator.clipboard.writeText(newKey); setMessage({ text: "تم نسخ المفتاح." }); };

  return <section className="space-y-5">
    <div className="flex flex-wrap gap-2">{[["clients","الموزعون والمفاتيح"],["logs","سجل استخدام API"],["docs","التوثيق"]].map(([key,label]) => <button key={key} type="button" onClick={() => setTab(key)} className={"rounded-xl border px-4 py-2 text-sm font-bold " + (tab === key ? "border-gold-500 bg-gold-500 text-ink-950" : "border-ink-700")}>{label}</button>)}<button type="button" onClick={load} className={btnGhost}><RefreshCw className={"size-4 " + (busy ? "animate-spin" : "")}/></button></div>
    {message && <p className={"rounded-xl border p-3 text-sm " + (message.bad ? "border-red-500/40 text-red-300" : "border-emerald-500/40 text-emerald-300")}>{message.text}</p>}
    {newKey && <div className="rounded-2xl border-2 border-gold-500 bg-gold-500/10 p-5"><div className="flex items-center gap-2 text-gold-300"><KeyRound className="size-5"/><h3 className="font-extrabold">مفتاح API — يظهر مرة واحدة فقط</h3></div><code className="mt-3 block select-all overflow-x-auto rounded-xl bg-black p-4 text-sm text-white" dir="ltr">{newKey}</code><button type="button" onClick={copyKey} className={btnGold + " mt-3 flex items-center gap-2"}><Clipboard className="size-4"/>نسخ المفتاح</button></div>}

    {tab === "clients" && <>
      <form onSubmit={create} className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-5"><div><h3 className="font-extrabold">إنشاء مفتاح لموزّع</h3><p className="text-xs text-mute">يُربط المفتاح بحساب الموزع وتُخصم الطلبات من محفظته.</p></div><div className="grid gap-3 md:grid-cols-2">
        <Field label="حساب الموزع"><select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className={inputCls()}><option value="">اختر المستخدم</option>{users.filter((user) => user.status === "active").map((user) => <option key={user.id || user._id} value={user.id || user._id}>{user.name} — {user.email} — {user.walletId}</option>)}</select></Field>
        <Field label="اسم المفتاح"><input required minLength="2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="متجر الموزع الرئيسي" className={inputCls()}/></Field>
        <Field label="عناوين IP المسموحة" hint="اختياري، كل IP في سطر"><textarea rows="3" value={form.allowedIps} onChange={(e) => setForm({ ...form, allowedIps: e.target.value })} placeholder={"1.2.3.4\n5.6.7.8"} className={inputCls()} dir="ltr"/></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="طلبات بالدقيقة"><input type="number" min="5" max="600" value={form.requestsPerMinute} onChange={(e) => setForm({ ...form, requestsPerMinute: e.target.value })} className={inputCls()} dir="ltr"/></Field><Field label="تاريخ الانتهاء"><input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={inputCls()} dir="ltr"/></Field></div>
      </div><button disabled={busy} className={btnGold + " flex items-center gap-2"}><KeyRound className="size-4"/>إنشاء المفتاح</button></form>
      <div className="space-y-2">{clients.map((client) => <article key={client.id} className="rounded-2xl border border-ink-700 bg-ink-900 p-4"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-gold-500/15 text-gold-300"><ShieldCheck className="size-6"/></span><div className="min-w-0 flex-1"><p className="font-bold">{client.name}</p><p className="truncate text-xs text-mute">{client.user?.name} · {client.user?.walletId} · المستوى {client.user?.agentLevel}</p><p className="mt-1 text-xs text-mute" dir="ltr">{client.keyPrefix}•••• · {client._count?.orders || 0} orders · {client.requestsPerMinute}/min</p></div><button type="button" disabled={busy} onClick={() => patch(client, { active: !client.active })} className={client.active ? btnGold : btnGhost}>{client.active ? "فعّال" : "متوقف"}</button><button type="button" disabled={busy} onClick={() => regenerate(client)} title="تغيير المفتاح" className={btnGhost}><RotateCcw className="size-4"/></button></div>{client.allowedIps?.length > 0 && <p className="mt-3 rounded-xl bg-ink-800 p-2 text-xs text-mute" dir="ltr">IP: {client.allowedIps.join(", ")}</p>}</article>)}</div>
      {!clients.length && <Empty>لم يتم إنشاء مفاتيح موزعين بعد.</Empty>}
    </>}

    {tab === "logs" && <div className="overflow-x-auto rounded-2xl border border-ink-700"><table className="w-full min-w-[700px] text-sm"><thead className="bg-ink-800 text-gold-300"><tr><th className="p-3 text-start">الموزع</th><th className="p-3 text-start">المسار</th><th className="p-3">الحالة</th><th className="p-3">IP</th><th className="p-3">الزمن</th><th className="p-3">التاريخ</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id} className="border-t border-ink-700"><td className="p-3">{log.apiClient?.name}</td><td className="p-3 font-mono text-xs" dir="ltr">{log.method} {log.endpoint}</td><td className="p-3 text-center">{log.statusCode}</td><td className="p-3 text-center" dir="ltr">{log.ip}</td><td className="p-3 text-center">{log.latencyMs}ms</td><td className="p-3 text-center">{new Date(log.createdAt).toLocaleString("ar-SY")}</td></tr>)}</tbody></table></div>}

    {tab === "docs" && <div className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-5"><h3 className="text-lg font-extrabold">RS Store Reseller API v1</h3><p className="text-sm text-mute">يرسل الموزع المفتاح في Header باسم <code dir="ltr">X-API-Key</code>.</p><Doc method="GET" path="/api/v1/reseller/products" text="قائمة المنتجات والباقات والأسعار الخاصة بالموزع"/><Doc method="GET" path="/api/v1/reseller/balance" text="رصيد محفظة الموزع"/><Doc method="POST" path="/api/v1/reseller/orders" text='إنشاء طلب: {"reference":"unique-001","packageId":"...","playerId":"123456","zoneId":"","quantity":1}'/><Doc method="GET" path="/api/v1/reseller/orders/{reference}" text="متابعة حالة الطلب"/><a href="/api/v1/reseller/docs" target="_blank" rel="noreferrer" className={btnGold + " inline-block"}>فتح التوثيق JSON</a></div>}
  </section>;
}

function Doc({ method, path, text }) {
  return <div className="rounded-xl bg-ink-800 p-3"><div className="flex items-center gap-2" dir="ltr"><span className="rounded bg-gold-500 px-2 py-1 text-xs font-black text-ink-950">{method}</span><code className="text-sm text-white">{path}</code></div><p className="mt-2 text-sm text-mute">{text}</p></div>;
}
