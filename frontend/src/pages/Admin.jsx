import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Package, Landmark, MessagesSquare, Settings, LogOut, ArrowRight, ArrowLeftRight, ShoppingCart, Banknote, MessageSquareWarning, LayoutDashboard, Users, Percent, Globe, DatabaseBackup, History, Medal, BadgeCheck, Headphones, BellRing, Boxes, Star, SlidersHorizontal, Gamepad2, PlugZap, KeyRound } from "lucide-react";
import { isAdmin, adminLogin, adminLogout, useSite } from "../lib/db";
import { api } from "../lib/api";
import Dashboard from "./admin/Dashboard";
import ProductsTab from "./admin/ProductsTab";
import MethodsTab from "./admin/MethodsTab";
import ChatsTab from "./admin/ChatsTab";
import SettingsTab from "./admin/SettingsTab";
import OrdersTab from "./admin/OrdersTab";
import DepositsTab from "./admin/DepositsTab";
import FeedbackTab from "./admin/FeedbackTab";
import UsersTab from "./admin/UsersTab";
import OffersTab from "./admin/OffersTab";
import SiteTab from "./admin/SiteTab";
import DataTab from "./admin/DataTab";
import LogTab from "./admin/LogTab";
import AgentsTab from "./admin/AgentsTab";
import CouponsTab from "./admin/CouponsTab";
import VerificationsTab from "./admin/VerificationsTab";
import SupportTab from "./admin/SupportTab";
import NotificationsTab from "./admin/NotificationsTab";
import CodesTab from "./admin/CodesTab";
import ReviewsTab from "./admin/ReviewsTab";
import WalletTransferTab from "./admin/WalletTransferTab";
import ControlCenterTab from "./admin/ControlCenterTab";
import PubgSalesTab from "./admin/PubgSalesTab";
import ApiProvidersTab from "./admin/ApiProvidersTab";
import ResellerApiTab from "./admin/ResellerApiTab";
import { Field, inputCls, btnGold } from "./admin/ui";

function Gate({ onOk }) {
    const [email, setEmail] = useState(import.meta.env.VITE_ADMIN_EMAIL || "");
    const [pw, setPw] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await adminLogin(email.trim(), pw);
        setBusy(false);
        if (ok) onOk(); else setError("كلمة المرور غير صحيحة.");
    };
    return (
        <main className="mx-auto grid min-h-screen max-w-sm place-items-center px-4">
            <form onSubmit={submit} className="w-full space-y-4 rounded-2xl border border-gold-600/40 bg-ink-900 p-6">
                <div className="flex flex-col items-center gap-2">
                    <div className="grid size-14 place-items-center rounded-full bg-gold-500/15 text-gold-400"><Lock className="size-7" /></div>
                    <h1 className="text-lg font-bold">لوحة تحكم الإدارة</h1>
                </div>
                <Field label="بريد الإدارة" error={error}><input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} autoComplete="username" dir="ltr" className={inputCls(error)} /></Field>
                <Field label="كلمة المرور">
                    <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setError(""); }} autoComplete="current-password" dir="ltr" className={inputCls(error)} />
                </Field>
                <button disabled={busy || !email || !pw} className={`${btnGold} w-full py-3`}>{busy ? "جارٍ التحقق..." : "دخول آمن"}</button>
                <Link to="/" className="flex items-center justify-center gap-1 text-sm text-mute hover:text-sand"><ArrowRight className="size-4" /> العودة إلى الموقع</Link>
            </form>
        </main>
    );
}

const groups = [
    { title: "التحكم الشامل", items: [{ id: "control-center", label: "مركز التحكم", icon: SlidersHorizontal }] },
    { title: "الرصيد", items: [{ id: "wallet-transfer", label: "تحويل رصيد مباشر", icon: ArrowLeftRight }] },
    { title: "نظرة عامة", items: [{ id: "dashboard", label: "لوحة المعلومات", icon: LayoutDashboard }] },
    { title: "المبيعات", items: [{ id: "orders", label: "الطلبات", icon: ShoppingCart }, { id: "deposits", label: "الإيداعات", icon: Banknote }] },
    { title: "المتجر", items: [{ id: "products", label: "المنتجات", icon: Package }, { id: "codes", label: "مخزن الأكواد", icon: Boxes }, { id: "offers", label: "العروض", icon: Percent }, { id: "coupons", label: "أكواد الخصم", icon: Percent }] },
    { title: "العملاء", items: [{ id: "users", label: "المستخدمون", icon: Users }, { id: "notifications", label: "إرسال الإشعارات", icon: BellRing }, { id: "agents", label: "الوكلاء والمستويات", icon: Medal }, { id: "verifications", label: "طلبات التوثيق", icon: BadgeCheck }, { id: "reviews", label: "تقييمات المنتجات", icon: Star }, { id: "support", label: "الدعم الفني", icon: Headphones }, { id: "chats", label: "المحادثات", icon: MessagesSquare }, { id: "feedback", label: "الشكاوى", icon: MessageSquareWarning }] },
    { title: "النظام", items: [{ id: "methods", label: "حسابات الدفع", icon: Landmark }, { id: "site", label: "إعدادات الموقع", icon: Globe }, { id: "settings", label: "التواصل والأمان", icon: Settings }, { id: "data", label: "التقارير والنسخ", icon: DatabaseBackup }, { id: "log", label: "سجل العمليات", icon: History }] },
    { title: "خدمة الحسابات", items: [{ id: "pubg-sales", label: "شراء حسابات PUBG", icon: Gamepad2 }] },
    { title: "الربط التلقائي", items: [{ id: "api-providers", label: "واجهات الشحن API", icon: PlugZap }] },
    { title: "توزيع API", items: [{ id: "reseller-api", label: "مفاتيح الموزعين", icon: KeyRound }] },
];
const all = groups.flatMap((g) => g.items);

function Panel({ onExit }) {
    const [tab, setTabState] = useState(() => (all.some((t) => t.id === sessionStorage.getItem("rs_admin_tab")) ? sessionStorage.getItem("rs_admin_tab") : "dashboard"));
    const setTab = (t) => { setTabState(t); try { sessionStorage.setItem("rs_admin_tab", t); } catch { /* غير مهم */ } window.scrollTo({ top: 0 }); };
    const site = useSite();
    const [badge, setBadge] = useState({ orders: 0, deposits: 0, feedback: 0, chats: 0, reviews: 0 });
    const cur = all.find((t) => t.id === tab);
    useEffect(() => { document.querySelector("nav[role=tablist] [aria-selected=true]")?.scrollIntoView({ inline: "center", block: "nearest" }); }, [tab]);
    useEffect(() => {
        let active = true;
        const load = () => Promise.all([api("/admin/stats"), api("/admin/live-chats/unread-count")]).then(([stats, chats]) => {
            if (active) setBadge({ orders: stats.orders.pending, deposits: stats.deposits.pending, feedback: stats.feedback?.pending || 0, chats: chats.unread || 0, reviews: stats.reviews?.pending || 0 });
        }).catch(() => {});
        load();
        const timer = window.setInterval(load, 15000);
        window.addEventListener("rs:admin-badges", load);
        return () => { active = false; window.clearInterval(timer); window.removeEventListener("rs:admin-badges", load); };
    }, []);

    const btn = (t, side) => (
        <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={side
                ? `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${tab === t.id ? "bg-gold-500 text-ink-950" : "text-sand/90 hover:bg-ink-800"}`
                : `flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${tab === t.id ? "border-gold-500 bg-gold-500 text-ink-950" : "border-ink-700 bg-ink-900 text-sand"}`}>
            <t.icon className="size-4" /> <span className={side ? "flex-1 text-start" : ""}>{t.label}</span>
            {badge[t.id] > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{badge[t.id]}</span>}
        </button>
    );

    return (
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-5">
            <header className="mb-4 flex items-center gap-3">
                <img src={site.logoUrl || "/assets/rs-logo.jpg"} alt="" className="size-10 rounded-full border border-gold-500 object-cover" />
                <div className="flex-1"><h1 className="text-lg font-extrabold text-gold-300">لوحة التحكم</h1><p className="text-xs text-mute">{site.name}{site.maintenance && <span className="ms-2 rounded-full bg-red-500/20 px-2 py-0.5 text-red-300">وضع الصيانة</span>}</p></div>
                <Link to="/" className="text-sm text-mute hover:text-sand">الموقع</Link>
                <button type="button" onClick={onExit} className="flex items-center gap-1 text-sm text-red-400"><LogOut className="size-4" /> خروج</button>
            </header>

            <nav className="scroll-hide -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:hidden" role="tablist" aria-label="أقسام لوحة التحكم">{all.map((t) => btn(t, false))}</nav>

            <div className="md:grid md:grid-cols-[14rem_1fr] md:gap-6">
                <aside className="hidden self-start md:sticky md:top-4 md:block" aria-label="أقسام لوحة التحكم">
                    <div role="tablist" aria-orientation="vertical" className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-3">
                        {groups.map((g) => (
                            <div key={g.title}><p className="px-3 pb-1 text-xs text-gold-400">{g.title}</p><div className="space-y-0.5">{g.items.map((t) => btn(t, true))}</div></div>
                        ))}
                    </div>
                </aside>
                <div className="min-w-0">
                    <h2 className="mb-4 hidden text-xl font-extrabold md:block">{cur.label}</h2>
                    {tab === "dashboard" && <Dashboard go={setTab} />}
                    {tab === "control-center" && <ControlCenterTab />}
                    {tab === "orders" && <OrdersTab />}
                    {tab === "deposits" && <DepositsTab />}
                    {tab === "pubg-sales" && <PubgSalesTab />}
                    {tab === "api-providers" && <ApiProvidersTab />}
                    {tab === "reseller-api" && <ResellerApiTab />}
                    {tab === "wallet-transfer" && <WalletTransferTab />}
                    {tab === "products" && <ProductsTab />}
                    {tab === "codes" && <CodesTab />}
                    {tab === "offers" && <OffersTab />}
                    {tab === "coupons" && <CouponsTab />}
                    {tab === "users" && <UsersTab />}
                    {tab === "notifications" && <NotificationsTab />}
                    {tab === "agents" && <AgentsTab />}
                    {tab === "verifications" && <VerificationsTab />}
                    {tab === "reviews" && <ReviewsTab />}
                    {tab === "support" && <SupportTab />}
                    {tab === "chats" && <ChatsTab />}
                    {tab === "feedback" && <FeedbackTab />}
                    {tab === "methods" && <MethodsTab />}
                    {tab === "site" && <SiteTab />}
                    {tab === "settings" && <SettingsTab />}
                    {tab === "data" && <DataTab />}
                    {tab === "log" && <LogTab />}
                </div>
            </div>
        </main>
    );
}

export default function Admin() {
    const [ok, setOk] = useState(isAdmin());
    return ok ? <Panel onExit={() => { adminLogout(); setOk(false); }} /> : <Gate onOk={() => setOk(true)} />;
}
