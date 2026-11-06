import { createElement } from "react";
import { NavLink } from "react-router-dom";
import { Heart, LayoutGrid, ShoppingBag, Store, WalletCards } from "lucide-react";
import { useSite } from "../lib/db";

const defaults = [{ id: "home", to: "/", label: "الرئيسية", icon: Store }, { id: "favorites", to: "/favorites", label: "المفضلة", icon: Heart }, { id: "orders", to: "/orders", label: "الطلبات", icon: ShoppingBag }, { id: "wallet", to: "/wallet", label: "المحفظة", icon: WalletCards }];
const iconFor = (to) => ({ "/": Store, "/favorites": Heart, "/orders": ShoppingBag, "/wallet": WalletCards, "/charge": WalletCards }[to] || Store);
const itemClass = (active) => `group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold transition-colors ${active ? "text-gold-300" : "text-mute hover:text-sand"}`;
const iconClass = (active) => `grid h-8 min-w-11 place-items-center rounded-2xl px-3 transition-all duration-200 ${active ? "bg-gradient-to-b from-gold-300 to-gold-500 text-ink-950 shadow-lg shadow-gold-600/20" : "text-mute group-hover:bg-ink-800 group-hover:text-sand"}`;
function NavItem({ to, end, icon, label }) { return <NavLink to={to} end={end} className={({ isActive }) => itemClass(isActive)}>{({ isActive }) => <><span className={iconClass(isActive)}>{createElement(icon, { className: "size-5", strokeWidth: isActive ? 2.3 : 1.8 })}</span><span className="truncate">{label}</span>{isActive && <span className="absolute -bottom-1 h-0.5 w-5 rounded-full bg-gold-400" />}</>}</NavLink>; }
export default function BottomNav({ onMenu, menuOpen }) {
    const site = useSite();
    const configured = Array.isArray(site?.menu?.bottomNav) ? site.menu.bottomNav.filter((item) => item && item.hidden !== true && item.to).slice(0, 4).map((item) => ({ ...item, icon: iconFor(item.to) })) : [];
    const items = configured.length ? configured : defaults;
    return <nav aria-label="الهيدر السفلي" className="fixed inset-x-0 bottom-0 z-40 border-t border-gold-600/25 bg-[#080808]/95 shadow-[0_-10px_30px_rgba(0,0,0,.35)] backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}><div className="mx-auto flex h-[4.5rem] max-w-3xl items-stretch px-1">{items.map((item) => <NavItem key={item.id || item.to} to={item.to} end={item.to === "/"} icon={item.icon} label={item.label}/>)}<button type="button" onClick={onMenu} aria-expanded={menuOpen} className={itemClass(menuOpen)}><span className={iconClass(menuOpen)}><LayoutGrid className="size-5" strokeWidth={menuOpen ? 2.3 : 1.8}/></span><span>المزيد</span>{menuOpen && <span className="absolute -bottom-1 h-0.5 w-5 rounded-full bg-gold-400"/>}</button></div></nav>;
}
