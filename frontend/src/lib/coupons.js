import { get, update } from "./db";

const r2 = (n) => Math.round(n * 100) / 100;

// يتحقق من الكود ويحسب الخصم. يعيد { coupon, discount } أو { error }
export function checkCoupon(code, total, user) {
    const c = get("coupons").find((x) => x.code === String(code).trim().toUpperCase());
    if (!c || !c.active) return { error: "كود الخصم غير صالح." };
    if (c.expires && Date.now() > new Date(c.expires + "T23:59:59").getTime()) return { error: "انتهت صلاحية الكود." };
    if (c.maxUses > 0 && c.used >= c.maxUses) return { error: "استُنفد الحد الأقصى لاستخدام هذا الكود." };
    if (c.min > 0 && total < c.min) return { error: `الحد الأدنى للطلب لاستخدام الكود $${c.min}.` };
    if (user && c.usedBy?.includes(user.walletId)) return { error: "استخدمت هذا الكود من قبل." };
    if (c.firstOnly && user && get("orders").some((o) => o.walletId === user.walletId && o.status !== "cancelled")) return { error: "هذا الكود صالح لأول طلب فقط." };
    const raw = c.type === "percent" ? (total * c.value) / 100 : c.value;
    return { coupon: c, discount: Math.min(total, r2(raw)) };
}
export const consumeCoupon = (code, walletId) => update("coupons", (l) => l.map((c) => (c.code === code ? { ...c, used: c.used + 1, usedBy: [...(c.usedBy ?? []), walletId] } : c)));
export const releaseCoupon = (code, walletId) => update("coupons", (l) => l.map((c) => (c.code === code ? { ...c, used: Math.max(0, c.used - 1), usedBy: (c.usedBy ?? []).filter((w) => w !== walletId) } : c)));
