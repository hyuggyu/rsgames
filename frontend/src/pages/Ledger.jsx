import { useEffect, useState } from "react";
import { api } from "../lib/api";
import Page, { card } from "../components/Page";

export default function Ledger() {
  const [data, setData] = useState({ entries: [], summary: {}, pagination: {} });
  const [error, setError] = useState("");
  useEffect(() => { api("/ledger/my").then(setData).catch((e) => setError(e.message)); }, []);
  return <Page title="كشف الحساب">
    {error && <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    <div className="mt-5 grid grid-cols-2 gap-3">
      {Object.entries(data.summary).map(([currency, values]) => <div className={`${card} p-4`} key={currency}><p className="text-xs text-mute">{currency}</p><p className="mt-2 text-sm text-emerald-300">إيداعات: {values.credit || 0}</p><p className="text-sm text-red-300">خصومات: {values.debit || 0}</p></div>)}
    </div>
    <div className="mt-6 space-y-2">{data.entries.map((item) => <div className={`${card} flex items-center justify-between p-4`} key={item._id}><div><p className="font-semibold">{item.note || item.type}</p><p className="text-xs text-mute">{new Date(item.createdAt).toLocaleString("ar-SY")}</p></div><p className={item.direction === "credit" ? "text-emerald-300" : "text-red-300"} dir="ltr">{item.direction === "credit" ? "+" : "-"}{item.amount} {item.currency}</p></div>)}</div>
    {!data.entries.length && !error && <p className={`${card} mt-5 p-6 text-center text-mute`}>لا توجد عمليات مالية بعد.</p>}
  </Page>;
}
