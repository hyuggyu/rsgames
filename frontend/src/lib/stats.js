const D = 86400000;
const r2 = (n) => Math.round(n * 100) / 100;
const day = (t) => new Date(t).toLocaleDateString("en-CA");
const sum = (l) => r2(l.reduce((s, o) => s + o.price, 0));

export function computeStats({ orders, deposits, accounts }) {
    const now = Date.now();
    const live = orders.filter((o) => o.status !== "cancelled");
    const users = Object.values(accounts);
    const series = Array.from({ length: 14 }, (_, i) => {
        const t = now - (13 - i) * D;
        const L = live.filter((o) => day(o.date) === day(t));
        return { k: day(t), label: new Date(t).getDate(), total: sum(L), count: L.length };
    });
    const by = (keyFn, nameFn) => {
        const m = new Map();
        live.forEach((o) => { const k = keyFn(o); const e = m.get(k) ?? { k, name: nameFn(o), total: 0, count: 0 }; e.total = r2(e.total + o.price); e.count++; m.set(k, e); });
        return [...m.values()].sort((a, b) => b.total - a.total);
    };
    const approved = {};
    deposits.filter((d) => d.status === "مكتمل").forEach((d) => { approved[d.currency] = r2((approved[d.currency] ?? 0) + d.amount); });
    return {
        salesTotal: sum(live),
        salesToday: sum(live.filter((o) => day(o.date) === day(now))),
        sales30: sum(live.filter((o) => o.date > now - 30 * D)),
        doneCount: orders.filter((o) => o.status === "done").length,
        ordersTotal: orders.length,
        pendingOrders: orders.filter((o) => o.status === "pending"),
        pendingDeposits: deposits.filter((d) => d.status === "قيد المراجعة"),
        users: users.length,
        banned: users.filter((u) => u.banned).length,
        newUsers7: users.filter((u) => u.created > now - 7 * D).length,
        balancesUSD: r2(users.reduce((s, u) => s + (u.balances?.USD ?? 0), 0)),
        approved,
        discounts: r2(live.reduce((s, o) => s + (o.discount ?? 0), 0)),
        series,
        maxDay: Math.max(1, ...series.map((x) => x.total)),
        topProducts: by((o) => o.productId, (o) => o.productName).slice(0, 5),
        byCat: by((o) => o.cat, (o) => o.cat),
    };
}
