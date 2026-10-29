import { useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Product from "./pages/Product";
import Orders from "./pages/Orders";
import Notifications from "./pages/Notifications";
import Feedback from "./pages/Feedback";
import Faq from "./pages/Faq";
import Guides from "./pages/Guides";
import Profile from "./pages/Profile";
import Security from "./pages/Security";
import Pin from "./pages/Pin";
import Wallet from "./pages/Wallet";
import Charge from "./pages/Charge";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import { getUser } from "./lib/wallet";
import BottomNav from "./components/BottomNav";
import Drawer from "./components/Drawer";
import FloatingContact from "./components/FloatingContact";
import Ledger from "./pages/Ledger";
import Invoices from "./pages/Invoices";
import ForgotPassword from "./pages/ForgotPassword";
import Affiliate from "./pages/Affiliate";
import Verification from "./pages/Verification";
import Support from "./pages/Support";
import Favorites from "./pages/Favorites";
import ThemeToggle from "./components/ThemeToggle";
import SellPubgAccount from "./pages/SellPubgAccount";
import PwaPrompts from "./components/PwaPrompts";

function Private({ children }) {
    const { pathname } = useLocation();
    return getUser() ? children : <Navigate to="/login" replace state={{ from: pathname }} />;
}
const priv = (el) => <Private>{el}</Private>;

export default function App() {
    const [menuOpen, setMenuOpen] = useState(false);
    const { pathname } = useLocation();
    const isLogin = pathname === "/login" || pathname.startsWith("/admin");

    return (
        <>
            <ThemeToggle />
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
                <Route path="/admin" element={<Admin />} />
                <Route path="/soon" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
            <FloatingContact />
            {!isLogin && <BottomNav onMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />}
            <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} />
            {!isLogin && <PwaPrompts />}
        </>
    );
}
