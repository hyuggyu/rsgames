import { get, update, logAction, sha } from "./db";
import { updateUser } from "./wallet";
import { notify } from "./orders";
import { currencies } from "../data/store";

const r2 = (n) => Math.round(n * 100) / 100;

export function adjustBalance(userId, cur, delta, reason) {
    const acc = get("accounts")[userId];
    if (!acc || !delta) return false;
    const next = r2((acc.balances[cur] ?? 0) + delta);
    if (next < 0) return false;
    updateUser(userId, (u) => ({ ...u, balances: { ...u.balances, [cur]: next } }));
    const sym = currencies.find((c) => c.code === cur)?.symbol ?? cur;
    notify(acc.walletId, delta > 0 ? "تمت إضافة رصيد" : "تم خصم رصيد", `${delta > 0 ? "أُضيف" : "خُصم"} ${Math.abs(delta)} ${sym} ${delta > 0 ? "إلى" : "من"} محفظتك.${reason ? " السبب: " + reason : ""}`);
    logAction(`${delta > 0 ? "إضافة" : "خصم"} ${Math.abs(delta)} ${cur} ${delta > 0 ? "لـ" : "من"} ${acc.name}${reason ? " — " + reason : ""}`);
    return true;
}

export function setBan(userId, banned) {
    const acc = get("accounts")[userId];
    if (!acc) return;
    updateUser(userId, (u) => ({ ...u, banned }));
    logAction(`${banned ? "إيقاف" : "تفعيل"} حساب ${acc.name}`);
}

// كلمة مرور مؤقتة يسلّمها المدير للزبون بنفسه
export async function resetPassword(userId) {
    const acc = get("accounts")[userId];
    if (!acc) return "";
    const A = "abcdefghjkmnpqrstuvwxyz23456789";
    const temp = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => A[b % A.length]).join("");
    const pw = await sha(temp);
    updateUser(userId, (u) => ({ ...u, pw }));
    logAction(`إعادة تعيين كلمة مرور ${acc.name}`);
    return temp;
}

// target: "all" أو walletId
export function broadcast(title, text, target) {
    const accs = Object.values(get("accounts")).filter((a) => target === "all" || a.walletId === target);
    const t = Date.now();
    update("notifs", (l) => [...accs.map((a, i) => ({ id: "B" + t.toString(36) + i, walletId: a.walletId, title, text, t, read: false })), ...l].slice(0, 1000));
    logAction(`إشعار «${title}» إلى ${target === "all" ? `كل المستخدمين (${accs.length})` : accs[0]?.name ?? target}`);
    return accs.length;
}

// ===== تصدير =====
export function downloadFile(name, text, mime = "text/plain") {
    const url = URL.createObjectURL(new Blob([text], { type: mime + ";charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// BOM ليفتح Excel النص العربي بشكل صحيح، ومنع تنفيذ الصيغ (حقن CSV)
const cell = (v) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
export const toCsv = (head, rows) => "\uFEFF" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
