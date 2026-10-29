import { get, update, logAction } from "./db";
import { checkCoupon, consumeCoupon, releaseCoupon } from "./coupons";
import { verifyPin, updateUser } from "./wallet";
import { currencies } from "../data/store";

export const STATUS = { pending: "قيد التنفيذ", done: "مكتمل", cancelled: "ملغى" };
export const DEP_STATUS = { pending: "قيد المراجعة", done: "مكتمل", rejected: "مرفوض" };
const r2 = (n) => Math.round(n * 100) / 100;
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export const orderRef = (o) => o.id.slice(-6).toUpperCase();
export const fmtDate = (t) => new Date(t).toLocaleDateString("ar-u-nu-latn", { day: "numeric", month: "short", year: "numeric" });
export const fmtDateTime = (t) => `${fmtDate(t)} ${new Date(t).toLocaleTimeString("ar-u-nu-latn", { hour: "2-digit", minute: "2-digit" })}`;

export function notify(walletId, title, text) {
    update("notifs", (l) => [{ id: uid("N"), walletId, title, text, t: Date.now(), read: false }, ...l].slice(0, 1000));
}
export const markAllRead = (walletId) => update("notifs", (l) => (l.some((n) => n.walletId === walletId && !n.read) ? l.map((n) => (n.walletId === walletId ? { ...n, read: true } : n)) : l));
export const clearNotifs = (walletId) => update("notifs", (l) => l.filter((n) => n.walletId !== walletId));

// الدفع من رصيد الدولار في المحفظة. يعيد { order } أو { error, short? }
export async function placeOrder({ user, product, pkg, fields, note, pin, couponCode }) {
    const site = get("site");
    if (site.maintenance) return { error: site.maintenanceMsg || "المتجر في صيانة مؤقتة." };
    const me = get("accounts")[user.id];
    if (!me) return { error: "سجّل الدخول من جديد." };
    if (me.banned) return { error: "حسابك موقوف. تواصل مع الدعم." };
    if (!(await verifyPin(me, pin || ""))) return { error: "البين كود غير صحيح." };
    let discount = 0, coupon = "";
    if (couponCode?.trim()) {
        const r = checkCoupon(couponCode, pkg.price, me);
        if (r.error) return { error: r.error };
        discount = r.discount; coupon = r.coupon.code;
    }
    const price = r2(pkg.price - discount);
    if (me.balances.USD < price) return { error: "رصيدك بالدولار غير كافٍ لإتمام الطلب.", short: true };
    const order = { id: uid("O"), walletId: me.walletId, productId: product.id, productName: product.name, cat: product.cat, pkgLabel: pkg.label, price, original: pkg.price, discount, coupon, fields, note: note || "", status: "pending", date: Date.now(), delivery: "" };
    if (!update("orders", (l) => [order, ...l])) return { error: "تعذّر حفظ الطلب (مساحة المتصفح ممتلئة)." };
    updateUser(me.id, (u) => ({ ...u, balances: { ...u.balances, USD: r2(u.balances.USD - price) } }));
    if (coupon) consumeCoupon(coupon, me.walletId);
    notify(me.walletId, "تم استلام طلبك", `طلب ${product.name} (${pkg.label}) قيد التنفيذ. رقم الطلب ${orderRef(order)}.`);
    return { order };
}

// للإدارة: إتمام الطلب أو إلغاؤه مع إرجاع الرصيد
export function setOrderStatus(id, status, delivery = "") {
    const o = get("orders").find((x) => x.id === id);
    if (!o || o.status !== "pending") return;
    update("orders", (l) => l.map((x) => (x.id === id ? { ...x, status, delivery, closed: Date.now() } : x)));
    logAction(`${status === "done" ? "إتمام" : "إلغاء"} الطلب ${orderRef(o)} — ${o.productName} (${o.pkgLabel})`);
    if (status === "cancelled") {
        if (o.coupon) releaseCoupon(o.coupon, o.walletId);
        const acc = Object.values(get("accounts")).find((a) => a.walletId === o.walletId);
        if (acc) updateUser(acc.id, (u) => ({ ...u, balances: { ...u.balances, USD: r2(u.balances.USD + o.price) } }));
        notify(o.walletId, "تم إلغاء طلبك", `أُلغي طلب ${o.productName} (${orderRef(o)}) وأُعيد $${o.price} إلى محفظتك.${delivery ? " السبب: " + delivery : ""}`);
    } else {
        notify(o.walletId, "اكتمل طلبك", `تم تنفيذ طلب ${o.productName} (${orderRef(o)}).${delivery ? " راجع تفاصيل التسليم في صفحة الطلبات." : ""}`);
    }
}

export function resolveDeposit(id, approve, reason = "") {
    const d = get("deposits").find((x) => x.id === id);
    if (!d || d.status !== DEP_STATUS.pending) return;
    update("deposits", (l) => l.map((x) => (x.id === id ? { ...x, status: approve ? DEP_STATUS.done : DEP_STATUS.rejected, reason } : x)));
    const cur = currencies.find((c) => c.code === d.currency);
    logAction(`${approve ? "قبول" : "رفض"} إيداع ${d.amount} ${d.currency} (${d.ref})`);
    if (approve) {
        const acc = Object.values(get("accounts")).find((a) => a.walletId === d.walletId);
        if (acc) updateUser(acc.id, (u) => ({ ...u, balances: { ...u.balances, [d.currency]: r2((u.balances[d.currency] ?? 0) + d.amount) } }));
        notify(d.walletId, "تمت إضافة الرصيد", `أُضيف ${d.amount} ${cur?.symbol ?? d.currency} إلى محفظتك.`);
    } else {
        notify(d.walletId, "رُفض طلب الإيداع", `لم نتمكن من قبول إيداع ${d.amount} ${cur?.symbol ?? d.currency}.${reason ? " السبب: " + reason : ""}`);
    }
}

export function addFeedback(f) { return update("feedback", (l) => [{ id: uid("F"), t: Date.now(), reply: "", ...f }, ...l].slice(0, 300)); }
export function replyFeedback(id, reply) {
    const f = get("feedback").find((x) => x.id === id);
    if (!f) return;
    update("feedback", (l) => l.map((x) => (x.id === id ? { ...x, reply, repliedAt: Date.now() } : x)));
    logAction(`رد على ${f.kind} من ${f.name}`);
    if (f.walletId) notify(f.walletId, "ردّ على رسالتك", reply.slice(0, 160));
}
