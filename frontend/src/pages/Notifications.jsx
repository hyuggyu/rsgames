import { useEffect, useState } from "react";
import { BadgeCheck, Bell, BellOff, Headphones, ShoppingCart, Trash2, Wallet } from "lucide-react";
import { api } from "../lib/api";
import Page, { card } from "../components/Page";

const icons = { order: ShoppingCart, deposit: Wallet, balance: Wallet, verification: BadgeCheck, support: Headphones, general: Bell };
const date = (value) => new Intl.DateTimeFormat("ar-SY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function Notifications() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = async () => {
        try { setItems(await api("/notifications/my")); setError(""); }
        catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const syncBadge = (next) => window.dispatchEvent(new CustomEvent("rs-notifications", { detail: next.filter((item) => !item.read).length }));
    const readOne = async (item) => {
        if (item.read) return;
        try {
            await api("/notifications/" + item._id + "/read", { method: "PATCH" });
            const next = items.map((entry) => entry._id === item._id ? { ...entry, read: true } : entry);
            setItems(next); syncBadge(next);
        } catch (e) { setError(e.message); }
    };
    const readAll = async () => {
        try { await api("/notifications/read-all", { method: "PATCH" }); const next = items.map((item) => ({ ...item, read: true })); setItems(next); syncBadge(next); }
        catch (e) { setError(e.message); }
    };
    const remove = async (id) => {
        try { await api("/notifications/" + id, { method: "DELETE" }); const next = items.filter((item) => item._id !== id); setItems(next); syncBadge(next); }
        catch (e) { setError(e.message); }
    };
    const clear = async () => {
        if (!window.confirm("مسح كل الإشعارات؟")) return;
        try { await api("/notifications", { method: "DELETE" }); setItems([]); syncBadge([]); }
        catch (e) { setError(e.message); }
    };

    return (
        <Page title="الإشعارات">
            {error && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
            {loading ? <div className={card + " mt-5 p-8 text-center text-mute"}>جاري تحميل الإشعارات...</div> : items.length === 0 ? (
                <div className={card + " mt-5 flex flex-col items-center gap-3 p-8 text-mute"}><BellOff className="size-10 text-gold-400" /><p>لا توجد إشعارات.</p></div>
            ) : (
                <>
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                        <button type="button" onClick={readAll} className="font-semibold text-gold-300">تحديد الكل كمقروء</button>
                        <button type="button" onClick={clear} className="flex items-center gap-1 text-red-400"><Trash2 className="size-4" /> مسح الكل</button>
                    </div>
                    <ul className="mt-3 space-y-2.5">
                        {items.map((item) => {
                            const Icon = icons[item.type] || Bell;
                            return (
                                <li key={item._id} onClick={() => readOne(item)} className={(item.read ? "border-ink-700 bg-ink-900" : "border-gold-500/60 bg-gold-500/10") + " flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors"}>
                                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-black/40 text-gold-400"><Icon className="size-5" /></div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start gap-2"><p className="flex-1 font-semibold">{item.title}</p>{!item.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-gold-400" />}</div>
                                        <p className="mt-1 text-sm leading-relaxed text-mute" dir="auto">{item.message}</p>
                                        <p className="mt-2 text-xs text-mute">{date(item.createdAt)}</p>
                                    </div>
                                    <button type="button" onClick={(event) => { event.stopPropagation(); remove(item._id); }} aria-label="حذف الإشعار" className="self-start rounded-lg p-1.5 text-mute hover:bg-red-500/10 hover:text-red-400"><Trash2 className="size-4" /></button>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </Page>
    );
}
