// تخزين تجريبي في المتصفح. في النسخة الحقيقية تنتقل هذه الدوال إلى الخادم.
import { get, update, sha, useAccounts, useDeposits } from "./db";
import { api, setToken, clearToken } from "./api";

const CUR = "rs_user";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newWalletId = () => "RS-" + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => A[b % 32]).join("");

// يعيد { user } أو { error: { id | password } }
export async function signIn(id, name, pw, signup, referralCode = "") {
    try {
        const data = await api(signup ? "/auth/register" : "/auth/login", { method: "POST", body: JSON.stringify(signup ? { name, email: id, password: pw, referralCode } : { email: id, password: pw }) });
        setToken(data.token);
        const u = data.user;
        update("accounts", (a) => ({ ...a, [u.email]: { ...u, id: u.email } }));
        localStorage.setItem(CUR, JSON.stringify({ id: u.email }));
        return { user: u };
    } catch (error) {
        if (import.meta.env.VITE_USE_MOCK === "true") return mockSignIn(id, name, pw, signup);
        return { error: { id: error.message } };
    }
}

async function mockSignIn(id, name, pw, signup) {
    const hash = await sha(pw);
    const acc = get("accounts")[id];
    if (signup && acc) return { error: { id: "هذا الحساب موجود مسبقًا، سجّل الدخول." } };
    if (!signup && !acc) return { error: { id: "لا يوجد حساب بهذا المعرّف. أنشئ حسابًا جديدًا." } };
    if (acc?.banned) return { error: { id: "هذا الحساب موقوف. تواصل مع الدعم." } };
    if (acc?.pw && acc.pw !== hash) return { error: { password: "كلمة المرور غير صحيحة." } };
    const u = acc ? { ...acc, pw: acc.pw ?? hash } : { name, id, walletId: newWalletId(), balances: { USD: 0, SYP: 0, TRY: 0 }, pw: hash, created: Date.now() };
    update("accounts", (a) => ({ ...a, [id]: u }));
    localStorage.setItem(CUR, JSON.stringify({ id }));
    return { user: u };
}

const resolve = (acc) => { const c = read(CUR, null); return c ? (acc[c.id] ?? (c.walletId ? c : null)) : null; };
export const getUser = () => resolve(get("accounts"));
export const useUser = () => resolve(useAccounts());
export const signOut = async () => { try { await api("/auth/logout", { method: "POST" }); } catch { /* تنتهي الجلسة محليًا حتى لو كان الخادم غير متاح */ } finally { clearToken(); localStorage.removeItem(CUR); } };

export const updateUser = (id, fn) => update("accounts", (a) => (a[id] ? { ...a, [id]: fn(a[id]) } : a));
export const verifyPw = async (user, pw) => !user.pw || user.pw === (await sha(pw));
export const verifyPin = async (user, pin) => !user.pin || user.pin === (await sha(pin));
export const hashOf = sha;

export const getDeposits = (walletId) => get("deposits").filter((d) => d.walletId === walletId);
export const useMyDeposits = (walletId) => useDeposits().filter((d) => d.walletId === walletId);
export const addDeposit = (d) => update("deposits", (l) => [d, ...l]);
export const money = (v, c) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v)} ${c.symbol}`;
export const getWalletApi = () => api("/wallet/");
export const getDepositsApi = () => api("/wallet/deposits");
export const uploadFileApi = (file) => { const body = new FormData(); body.append("file", file); return api("/uploads", { method: "POST", body }); };
export const createDepositApi = (payload) => api("/wallet/deposits", { method: "POST", body: JSON.stringify(payload) });
