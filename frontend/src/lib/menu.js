// Default sidebar navigation. Admin changes are stored in site.menu.
export const MENU_GROUPS = [
    {
        id: "main", title: "القائمة الرئيسية", items: [
            { id: "sell-pubg", label: "بيع حساب PUBG", to: "/sell-pubg-account" },
            { id: "favorites", label: "المفضلة", to: "/favorites" },
            { id: "wallet", label: "المحفظة", to: "/wallet" },
            { id: "notifications", label: "الإشعارات", to: "/notifications", badge: true },
            { id: "orders", label: "الطلبات", to: "/orders" },
            { id: "charge", label: "شحن الرصيد", to: "/charge" },
            { id: "deposits", label: "الإيداعات", to: "/wallet" },
            { id: "ledger", label: "سجل الحساب", to: "/ledger" },
            { id: "invoices", label: "الفواتير", to: "/invoices" },
            { id: "affiliate", label: "التسويق بالعمولة", to: "/affiliate" },
            { id: "support", label: "الدعم الفني", to: "/support" },
            { id: "feedback", label: "الاقتراحات والشكاوى", to: "/feedback" },
            { id: "faq", label: "الأسئلة الشائعة", to: "/faq" },
            { id: "guides", label: "الأدلة والشروحات", to: "/guides" },
        ],
    },
    {
        id: "account", title: "حسابي", items: [
            { id: "profile", label: "الملف الشخصي", to: "/profile" },
            { id: "verification", label: "توثيق الحساب", to: "/verification" },
            { id: "security", label: "الأمان", to: "/security" },
            { id: "pin", label: "رمز PIN", to: "/pin" },
        ],
    },
];

export const MENU_ROUTES = [...new Map(MENU_GROUPS.flatMap((group) => group.items.map(({ label, to }) => [to, { label, to }]))).values()];

export function menuItems(groupId, menu) {
    const group = MENU_GROUPS.find((g) => g.id === groupId);
    if (!group) return [];
    const overrides = menu?.items || {};
    const saved = Array.isArray(menu?.order?.[groupId]) ? menu.order[groupId] : [];
    const rank = (id) => { const i = saved.indexOf(id); return i === -1 ? saved.length + group.items.findIndex((x) => x.id === id) : i; };
    return group.items
        .map((item) => ({ ...item, defaultLabel: item.label, label: String(overrides[item.id]?.label || "").trim() || item.label, hidden: overrides[item.id]?.hidden === true }))
        .sort((a, b) => rank(a.id) - rank(b.id));
}

export const groupTitle = (groupId, menu) => String(menu?.titles?.[groupId] || "").trim() || MENU_GROUPS.find((g) => g.id === groupId)?.title || "";

export function customMenuGroups(menu) {
    return (Array.isArray(menu?.customGroups) ? menu.customGroups : [])
        .filter((group) => group && typeof group.id === "string" && String(group.title || "").trim())
        .map((group) => ({
            id: group.id,
            title: String(group.title).trim(),
            items: (Array.isArray(group.items) ? group.items : [])
                .filter((item) => item && String(item.label || "").trim() && MENU_ROUTES.some((route) => route.to === item.to))
                .map((item) => ({ ...item, label: String(item.label).trim() }))
        }));
}
