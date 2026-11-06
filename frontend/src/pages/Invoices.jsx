import { useEffect, useState } from "react";
import { api } from "../lib/api";
import Page, { card } from "../components/Page";

export default function Invoices() {
  const [items, setItems] = useState([]); const [error, setError] = useState("");
  useEffect(() => { api("/invoices/my").then(setItems).catch((e) => setError(e.message)); }, []);
  return <Page title="فواتيري">
    {error && <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    <div className="mt-5 space-y-3">{items.map((invoice) => <div className={`${card} p-4`} key={invoice._id}><div className="flex justify-between gap-3"><div><p className="font-bold text-gold-300">{invoice.invoiceNumber}</p><p className="mt-1 text-sm text-mute">{invoice.type === "deposit" ? "فاتورة إيداع" : "فاتورة طلب"}</p></div><p className="font-bold" dir="ltr">{invoice.amount} {invoice.currency}</p></div><p className="mt-3 text-xs text-mute">{new Date(invoice.createdAt).toLocaleString("ar-SY")}</p></div>)}</div>
    {!items.length && !error && <p className={`${card} mt-5 p-6 text-center text-mute`}>لا توجد فواتير بعد.</p>}
  </Page>;
}
