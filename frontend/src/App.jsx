import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Product from "./pages/Product";
import Orders from "./pages/Orders";
import Notifications from "./pages/Notifications";
const Feedback = lazy(() => import("./pages/Feedback"));
const Faq = lazy(() => import("./pages/Faq"));
const Guides = lazy(() => import("./pages/Guides"));
const Profile = lazy(() => import("./pages/Profile"));
const Security = lazy(() => import("./pages/Security"));
const Pin = lazy(() => import("./pages/Pin"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Charge = lazy(() => import("./pages/Charge"));
const Admin = lazy(() => import("./pages/Admin"));
import NotFound from "./pages/NotFound";
import Page from "./pages/Page";
import PagesIndex from "./pages/PagesIndex";
import { getUser } from "./lib/wallet";
import BottomNav from "./components/BottomNav";
import Drawer from "./components/Drawer";
import FloatingContact from "./components/FloatingContact";
const Ledger = lazy(() => import("./pages/Ledger"));
const Invoices = lazy(() => import("./pages/Invoices"));
import ForgotPassword from "./pages/ForgotPassword";
const Affiliate = lazy(() => import("./pages/Affiliate"));
const Verification = lazy(() => import("./pages/Verification"));
const Support = lazy(() => import("./pages/Support"));
import Favorites from "./pages/Favorites";
import ThemeToggle from "./components/ThemeToggle";
const SellPubgAccount = lazy(() => import("./pages/SellPubgAccount"));
import PwaPrompts from "./components/PwaPrompts";

function Private({ children }) {
    const { pathname } = useLocation();
    return getUser() ? children : <Navigate to="/login" replace state={{ from: pathname }} />;
}
const priv = (el) => <Private>{el}</Private>;

export default function App() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [online, setOnline] = useState(() => navigator.onLine);
    const { pathname } = useLocation();
    const isLogin = pathname === "/login" || pathname.startsWith("/admin");
    useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);

    return (
        <>
            {!online && <div className="fixed inset-x-0 top-0 z-[100] bg-red-600 px-4 py-2 text-center text-xs font-bold text-white">لا يوجد اتصال بالإنترنت — ستتم إعادة المحاولة عند عودة الشبكة</div>}
            <ThemeToggle />
            <Suspense fallback={<div className="grid min-h-[60vh] place-items-center text-sm text-mute">جارٍ التحميل...</div>}>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/product/:id" element={<Product />} />
                <Route path="/orders" element={priv(<Orders />)} />
                <Route path="/notifications" element={priv(<Notifications />)} />
                <Route path="/wallet" element={priv(<Wallet />)} />
                <Route path="/ledger" element={priv(<Ledger />)} />
                <Route path="/invoices" element={priv(<Invoices />)} />
                <Route path="/affiliate" element={priv(<Affiliate />)} />
                <Route path="/verification" element={priv(<Verification />)} />
                <Route path="/sell-pubg-account" element={priv(<SellPubgAccount />)} />
                <Route path="/support" element={priv(<Support />)} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/charge" element={priv(<Charge />)} />
                <Route path="/profile" element={priv(<Profile />)} />
                <Route path="/security" element={priv(<Security />)} />
                <Route path="/pin" element={priv(<Pin />)} />
                <Route path="/feedback" element={priv(<Feedback />)} />
                <Route path="/faq" element={<Faq />} />
                <Route path="/guides" element={<Guides />} />
                <Route path="/page/:slug" element={<Page />} />
                <Route path="/pages" element={<PagesIndex />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/soon" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            <FloatingContact />
            {!isLogin && <BottomNav onMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />}
            <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} />
            {!isLogin && <PwaPrompts />}
        </>
    );
}
