import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser, signOut } from "../lib/wallet";
import { api } from "../lib/api";
import { useSite } from "../lib/db";
import { menuItems, groupTitle, customMenuGroups } from "../lib/menu";
import { X, Bell, CreditCard, Wallet, MessageSquareText, CircleHelp, BookOpen, UserRound, Shield, KeyRound, LogOut, LogIn, Banknote, ShoppingCart, FileText, Receipt, Users, BadgeCheck, Heart, Gamepad2 } from "lucide-react";

const icons = {
    "sell-pubg": Gamepad2, favorites: Heart, wallet: Wallet, notifications: Bell, orders: ShoppingCart, charge: CreditCard, deposits: Banknote,
    ledger: FileText, invoices: Receipt, affiliate: Users, support: MessageSquareText, feedback: MessageSquareText, faq: CircleHelp, guides: BookOpen,
    profile: UserRound, verification: BadgeCheck, security: Shield, pin: KeyRound,
};

function Item({ item, onClose, badge }) {
    const Icon = icons[item.id] || CircleHelp;
    return (
        <Link to={item.to} onClick={onClose} className="drawer-menu-link flex items-center gap-4 rounded-xl px-3 py-3.5 text-[15px] font-semibold transition-colors hover:bg-ink-800">
            <Icon className="size-5 text-gold-400" />
            <span className="flex-1">{item.label}</span>
            {item.badge && badge > 0 && <span className="grid size-5 place-items-center rounded-full bg-red-500 text-[11px] font-bold text-white">{badge}</span>}
        </Link>
    );
}

export default function Drawer({ open, onClose }) {
    const navigate = useNavigate();
    const user = useUser();
    const userId = user?.id;
    const site = useSite();
    const main = menuItems("main", site.menu).filter((i) => !i.hidden);
    const account = menuItems("account", site.menu).filter((i) => !i.hidden);
    const customGroups = customMenuGroups(site.menu).filter((group) => group.items.length > 0);
    const [unread, setUnread] = useState(0);

    useEffect(() => {
        if (!userId) { setUnread(0); return; }
        if (open) api("/notifications/my").then((items) => setUnread(items.filter((item) => !item.read).length)).catch(() => {});
    }, [open, userId]);
    useEffect(() => {
        const update = (event) => setUnread(Number(event.detail) || 0);
        window.addEventListener("rs-notifications", update);
        return () => window.removeEventListener("rs-notifications", update);
    }, []);

    const logout = async () => {
        await signOut();
        onClose();
        navigate("/login");
    };

    return (
        <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
            <div onClick={onClose} className={`absolute inset-0 bg-black/70 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
            <aside className={`app-drawer absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col overflow-y-auto overscroll-contain pb-6 border-s border-gold-500/30 bg-[#050505] text-sand shadow-2xl shadow-black transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
                <div className="relative overflow-hidden border-b border-gold-500/30 bg-gradient-to-br from-gold-700/35 via-black to-black px-5 pb-5 pt-4">
                    <div className="relative flex min-h-9 items-center justify-center"><span className="text-xs font-bold tracking-widest text-gold-300">RS STORE</span><button type="button" onClick={onClose} aria-label="إغلاق القائمة" className="absolute right-0 top-0 z-10 grid size-9 place-items-center rounded-full text-gold-400 transition hover:bg-gold-500/20 hover:text-gold-200" title="إغلاق القائمة"><X className="size-5" strokeWidth={2.5} /></button></div>
                    <div className="mt-5 flex items-center gap-3"><img src={site.logoUrl || "/assets/rs-logo.jpg"} alt={site.name || "RS Store"} className="size-16 rounded-full border-2 border-gold-500 object-cover" /><div className="min-w-0 flex-1"><p className="break-words text-lg font-extrabold leading-relaxed text-white [overflow-wrap:anywhere]">{user ? user.name : "زائر"}</p><p className="break-all text-xs text-gold-300">{user ? `ID: ${user.walletId || "RS"}` : "سجّل الدخول للمتابعة"}</p></div></div>
                    {user ? <div className="mt-4 text-center"><p className="text-xs text-mute">الرصيد المتاح</p><p className="mt-1 text-2xl font-extrabold text-red-400" dir="ltr">$ {user.balances?.USD || 0}</p></div> : <Link to="/login" onClick={onClose} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 py-3 font-bold text-ink-950"><LogIn className="size-5" /> تسجيل الدخول</Link>}
                    {user && <div className="mt-4 flex justify-center gap-5"><Link onClick={onClose} to="/affiliate" className="text-red-400"><Users className="size-6" /></Link><Link onClick={onClose} to="/profile" className="text-white"><UserRound className="size-6" /></Link><button type="button" onClick={logout} className="text-gold-300"><LogOut className="size-6" /></button></div>}
                </div>
                {user && <div className="border-b border-gold-500/20 bg-gradient-to-r from-gold-600/20 to-transparent px-4 py-3 text-center"><p className="text-xs font-bold text-gold-200">العملة الثانوية USD</p><p className="mt-1 text-sm font-bold text-white" dir="ltr">{user.balances?.USD || 0} USD</p></div>}
                <div className="space-y-2 bg-gradient-to-b from-lime-950/30 via-black to-black px-3 py-4">
                    {main.length > 0 && <p className="px-3 pb-1 text-xs font-bold text-gold-400">{groupTitle("main", site.menu)}</p>}
                    {main.map((i) => <div key={i.id} className="rounded-xl border border-gold-500/20 bg-gradient-to-r from-lime-900/30 to-yellow-900/20 shadow-lg shadow-black/40"><Item item={i} onClose={onClose} badge={unread} /></div>)}
                </div>
                <div className="border-t border-ink-700 px-3 py-3"><Link to="/pages" onClick={onClose} className="drawer-menu-link flex items-center gap-4 rounded-xl px-3 py-3.5 text-[15px] font-semibold transition-colors hover:bg-ink-800"><FileText className="size-5 text-gold-400"/><span>صفحات الموقع</span></Link></div>
                {account.length > 0 && <div className="border-t border-ink-700 px-3 py-3">
                    <p className="px-3 pb-1 text-xs text-gold-400">{groupTitle("account", site.menu)}</p>
                    <div className="space-y-2">{account.map((i) => <div key={i.id} className="rounded-xl border border-gold-500/20 bg-gradient-to-r from-lime-900/30 to-yellow-900/20"><Item item={i} onClose={onClose} /></div>)}</div>
                </div>}
                {(site.supportWhatsapp || site.supportTelegram) && <div className="border-t border-ink-700 px-3 py-4"><p className="px-3 pb-2 text-xs text-gold-400">تواصل معنا</p><div className="grid grid-cols-2 gap-2">{site.supportWhatsapp && <a href={`https://wa.me/${String(site.supportWhatsapp).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600/20 px-2 py-2 text-center text-xs font-bold text-emerald-300">واتساب</a>}{site.supportTelegram && <a href={site.supportTelegram} target="_blank" rel="noreferrer" className="rounded-xl bg-sky-600/20 px-2 py-2 text-center text-xs font-bold text-sky-300">تلغرام</a>}</div></div>}
                {customGroups.map((group) => <div key={group.id} className="border-t border-ink-700 px-3 py-3">
                    <p className="px-3 pb-1 text-xs text-gold-400">{group.title}</p>
                    <div className="space-y-2">{group.items.map((item) => <div key={item.id} className="rounded-xl border border-gold-500/20 bg-gradient-to-r from-lime-900/30 to-yellow-900/20"><Item item={item} onClose={onClose} /></div>)}</div>
                </div>)}
            </aside>
        </div>
    );
}
