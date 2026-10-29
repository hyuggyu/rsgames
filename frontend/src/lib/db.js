import { useEffect, useSyncExternalStore } from "react";
import { products, depositMethods, contact, offers, coupons, site } from "../data/store";
import { api, clearToken, setToken } from "./api";

// تخزين محلي في المتصفح مع اشتراك لحظي: أي تعديل من لوحة الإدارة ينعكس فورًا على الموقع
// (وعلى التبويبات الأخرى في نفس المتصفح). في النسخة الحقيقية تنتقل هذه الدوال إلى الخادم.
export const KEYS = { products: "rs_products", methods: "rs_methods", contact: "rs_contact", chats: "rs_chats", orders: "rs_orders", notifs: "rs_notifs", feedback: "rs_feedback", deposits: "rs_deposits", accounts: "rs_accounts", coupons: "rs_coupons", offers: "rs_offers", site: "rs_site", log: "rs_log" };
const seeds = { products, methods: depositMethods, contact, chats: {}, orders: [], notifs: [], feedback: [], deposits: [], accounts: {}, coupons, offers, site, log: [] };
const cache = {};
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

function load(key) {
    try { return JSON.parse(localStorage.getItem(KEYS[key])) ?? seeds[key]; } catch { return seeds[key]; }
}
export function get(key) {
    if (!(key in cache)) cache[key] = load(key);
    return cache[key];
}
// يعيد false إذا فشل الحفظ (مثلًا امتلاء مساحة المتصفح بسبب الصور)
function write(key, value) {
    try { localStorage.setItem(KEYS[key], JSON.stringify(value)); } catch { return false; }
    cache[key] = value;
    emit();
    return true;
}
let settingsRequest = null;
export function refreshPublicSettings(force = false) {
    if (!settingsRequest || force) settingsRequest = api("/settings").then((data) => { if (data.site) write("site", data.site); if (data.contact) write("contact", data.contact); return data; }).finally(() => { settingsRequest = null; });
    return settingsRequest;
}
export function update(key, fn) {
    delete cache[key]; // اقرأ أحدث نسخة قبل التعديل لتفادي ضياع تعديلات تبويب آخر
    return write(key, fn(get(key)));
}
export function resetAll() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    Object.keys(cache).forEach((k) => delete cache[k]);
    emit();
}

window.addEventListener("storage", (e) => {
    if (e.key === null) Object.keys(cache).forEach((k) => delete cache[k]);
    else { const k = Object.keys(KEYS).find((n) => KEYS[n] === e.key); if (!k) return; delete cache[k]; }
    emit();
});

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const useDB = (key) => useSyncExternalStore(subscribe, () => get(key));
export const useProducts = () => useDB("products");
export const useMethods = () => useDB("methods");
export const useChats = () => useDB("chats");
export const useOrders = () => useDB("orders");
export const useNotifs = () => useDB("notifs");
export const useFeedback = () => useDB("feedback");
export const useDeposits = () => useDB("deposits");
export const useAccounts = () => useDB("accounts");
export const useCoupons = () => useDB("coupons");
export const useOffers = () => useDB("offers");
export const useSite = () => { const value = useDB("site"); useEffect(() => { refreshPublicSettings().catch(() => {}); }, []); return value; };
export const useLog = () => useDB("log");

// سجل عمليات الإدارة
export const logAction = (text) => update("log", (l) => [{ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t: Date.now(), text }, ...l].slice(0, 500));

// نسخة احتياطية: كل مفاتيح البيانات (بدون كلمة سر الإدارة وجلسات الدخول)
export const exportAll = () => Object.fromEntries(Object.keys(KEYS).map((k) => [k, get(k)]));
// يتحقق من البنية قبل الكتابة. يعيد عدد المفاتيح المستعادة أو -1 إن كان الملف غير صالح
export function restoreAll(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return -1;
    const keys = Object.keys(data).filter((k) => k in KEYS);
    if (!keys.length) return -1;
    if (keys.some((k) => Array.isArray(data[k]) !== Array.isArray(seeds[k]) || typeof data[k] !== "object" || data[k] === null)) return -1;
    try { keys.forEach((k) => localStorage.setItem(KEYS[k], JSON.stringify(data[k]))); } catch { return -1; }
    Object.keys(cache).forEach((k) => delete cache[k]);
    emit();
    return keys.length;
}
export const storageBytes = () => Object.values(KEYS).reduce((n, k) => n + (localStorage.getItem(k)?.length ?? 0) * 2, 0);
export const waLink = (num) => { const d = String(num ?? "").replace(/\D/g, ""); return d ? `https://wa.me/${d}` : "#"; };
export function useContact() {
    const c = useDB("contact");
    useEffect(() => { refreshPublicSettings().catch(() => {}); }, []);
    return { ...c, whatsappUrl: waLink(c.whatsapp) };
}

// ===== دخول الإدارة (حماية واجهة فقط، انظر الملاحظة في الرد) =====
export const sha = async (s) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");
export const isDefaultPassword = () => false;
export const isAdmin = () => sessionStorage.getItem("rs_admin") === "1";
export const adminLogout = () => { sessionStorage.removeItem("rs_admin"); clearToken(); };
export async function adminLogin(email, pw) {
    try {
        const result = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password: pw }) });
        if (result.user?.role !== "admin") return false;
        setToken(result.token); sessionStorage.setItem("rs_admin", "1"); return true;
    } catch { return false; }
}
export async function changeAdminPassword(oldPw, newPw) {
    try { await api("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: oldPw, newPassword: newPw }) }); return true; } catch { return false; }
}
