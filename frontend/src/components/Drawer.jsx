import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser, signOut } from "../lib/wallet";
import { api } from "../lib/api";
import { useSite } from "../lib/db";
import { X, Bell, CreditCard, Wallet, MessageSquareText, CircleHelp, BookOpen, UserRound, Shield, KeyRound, LogOut, LogIn, Banknote, ShoppingCart, FileText, Receipt, Users, BadgeCheck, Heart, Gamepad2 } from "lucide-react";

const main = [
    { label: "بيع حساب PUBG للإدارة", icon: Gamepad2, to: "/sell-pubg-account" },
    { label: "منتجاتي المفضلة", icon: Heart, to: "/favorites" },
    { label: "محفظتي", icon: Wallet, to: "/wallet" },
    { label: "الإشعارات", icon: Bell, to: "/notifications", badge: true },
    { label: "طلباتي", icon: ShoppingCart, to: "/orders" },
    { label: "إيداع رصيد", icon: CreditCard, to: "/charge" },
    { label: "طلبات الإيداع", icon: Banknote, to: "/wallet" },
    { label: "كشف الحساب", icon: FileText, to: "/ledger" },
    { label: "فواتيري", icon: Receipt, to: "/invoices" },
    { label: "برنامج الوكلاء", icon: Users, to: "/affiliate" },
    { label: "الدعم الفني", icon: MessageSquareText, to: "/support" },
    { label: "الشكاوى والاقتراحات", icon: MessageSquareText, to: "/feedback" },
    { label: "الأسئلة الشائعة", icon: CircleHelp, to: "/faq" },
    { label: "الشروحات والمقالات", icon: BookOpen, to: "/guides" },
];
const account = [
    { label: "ملفي الشخصي", icon: UserRound, to: "/profile" },
    { label: "توثيق الحساب", icon: BadgeCheck, to: "/verification" },
    { label: "مركز الأمان", icon: Shield, to: "/security" },
    { label: "البين كود", icon: KeyRound, to: "/pin" },
];

function Item({ item, onClose, badge }) {
    const Icon = item.icon;
    return (
        <Link to={item.to} onClick={onClose} className="flex items-center gap-4 rounded-xl px-3 py-3.5 text-[15px] text-sand/90 transition-colors hover:bg-ink-800">
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
            <aside className={`absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col overflow-y-auto border-s border-gold-500/30 bg-[#050505] shadow-2xl shadow-black transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
                <div className="relative overflow-hidden border-b border-gold-500/30 bg-gradient-to-br from-gold-700/35 via-black to-black px-5 pb-5 pt-4">
                    <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-widest text-gold-300">RS STORE</span><button type="button" onClick={onClose} aria-label="إغلاق القائمة" className="rounded-lg p-1.5 text-mute hover:text-sand"><X className="size-5" /></button></div>
                    <div className="mt-5 flex items-center gap-3"><img src={site.logoUrl || "/assets/rs-logo.jpg"} alt={site.name || "RS Store"} className="size-16 rounded-full border-2 border-gold-500 object-cover" /><div className="min-w-0"><p className="truncate text-lg font-extrabold text-white">{user ? user.name : "زائر"}</p><p className="text-xs text-gold-300">{user ? `ID: ${user.walletId || "RS"}` : "سجّل الدخول للمتابعة"}</p></div></div>
                    {user ? <div className="mt-4 text-center"><p className="text-xs text-mute">الرصيد المتاح</p><p className="mt-1 text-2xl font-extrabold text-red-400" dir="ltr">$ {user.balances?.USD || 0}</p></div> : <Link to="/login" onClick={onClose} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 py-3 font-bold text-ink-950"><LogIn className="size-5" /> تسجيل الدخول</Link>}
                    {user && <div className="mt-4 flex justify-center gap-5"><Link onClick={onClose} to="/affiliate" className="text-red-400"><Users className="size-6" /></Link><Link onClick={onClose} to="/profile" className="text-white"><UserRound className="size-6" /></Link><button type="button" onClick={logout} className="text-gold-300"><LogOut className="size-6" /></button></div>}
                </div>
                {user && <div className="border-b border-gold-500/20 bg-gradient-to-r from-gold-600/20 to-transparent px-4 py-3 text-center"><p className="text-xs font-bold text-gold-200">العملة الثانوية USD</p><p className="mt-1 text-sm font-bold text-white" dir="ltr">{user.balances?.USD || 0} USD</p></div>}
                <div className="space-y-2 bg-gradient-to-b from-lime-950/30 via-black to-black px-3 py-4">
                    {main.map((i) => <div key={i.label} className="rounded-xl border border-gold-500/20 bg-gradient-to-r from-lime-900/30 to-yellow-900/20 shadow-lg shadow-black/40"><Item item={i} onClose={onClose} badge={unread} /></div>)}
                </div>
                <div className="border-t border-ink-700 px-3 py-3">
                    <p className="px-3 pb-1 text-xs text-gold-400">الحساب والأمان</p>
                    {account.map((i) => <Item key={i.label} item={i} onClose={onClose} />)}
                </div>
            </aside>
        </div>
    );
}
