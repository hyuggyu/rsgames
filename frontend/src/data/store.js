import { Gamepad2, Gift, Tv, Bot, ShieldCheck, Smartphone } from "lucide-react";

// عدّل روابط التواصل هنا
export const contact = {
    whatsapp: "", // رقم واتساب الدعم بصيغة دولية (يُعدَّل من لوحة التحكم)
    telegram: "https://t.me/your_channel",
    supportName: "دعم RS Games",
    welcome: "أهلًا بك! اكتب رسالتك وسيرد عليك فريق الدعم في أقرب وقت.",
};

export const categories = [
    { id: "games", label: "ألعاب", icon: Gamepad2 },
    { id: "apps", label: "تطبيقات", icon: Smartphone },
    { id: "cards", label: "بطاقات رقمية", icon: Gift },
    { id: "subs", label: "اشتراكات", icon: Tv },
    { id: "vpn", label: "خدمات VPN", icon: ShieldCheck },
    { id: "ai", label: "خدمات الذكاء الاصطناعي", icon: Bot },
];

// بيانات تجريبية: الأسعار للعرض فقط
const pk = (...x) => x.map(([label, price], i) => ({ id: String(i), label, price }));
export const products = [
    { id: "p1", name: "PUBG Mobile UC", cat: "games", from: 0.99, image: "", active: true, packages: pk(["60 UC", 0.99], ["325 UC", 4.99], ["660 UC", 9.99], ["1800 UC", 24.99]) },
    { id: "p2", name: "Free Fire Diamonds", cat: "games", from: 0.9, image: "", active: true, packages: pk(["100 جوهرة", 0.9], ["310 جوهرة", 2.8], ["520 جوهرة", 4.6], ["1060 جوهرة", 9.2]) },
    { id: "p3", name: "Roblox Robux", cat: "games", from: 4.99, image: "", active: true, packages: pk(["400 Robux", 4.99], ["800 Robux", 9.99], ["1700 Robux", 19.99]) },
    { id: "p4", name: "Google Play", cat: "cards", from: 5, image: "", active: true, packages: pk(["بطاقة 5$", 5], ["بطاقة 10$", 10], ["بطاقة 25$", 25]) },
    { id: "p5", name: "Steam Wallet", cat: "cards", from: 5, image: "", active: true, packages: pk(["بطاقة 5$", 5], ["بطاقة 10$", 10], ["بطاقة 20$", 20], ["بطاقة 50$", 50]) },
    { id: "p6", name: "Netflix", cat: "subs", from: 7, image: "", active: true, packages: pk(["شهر واحد", 7], ["3 أشهر", 20]) },
    { id: "p7", name: "Spotify", cat: "subs", from: 4, image: "", active: true, packages: pk(["شهر واحد", 4], ["3 أشهر", 11]) },
    { id: "p8", name: "ChatGPT Plus", cat: "ai", from: 20, image: "", active: true, packages: pk(["شهر واحد", 20]) },
    { id: "p9", name: "VPN شهري", cat: "vpn", from: 3, image: "", active: true, packages: pk(["شهر واحد", 3], ["6 أشهر", 15], ["سنة كاملة", 25]) },
];
// منتج بلا باقات (أُضيف قبل التحديث) يُعرض كباقة واحدة بسعر «يبدأ من»
export const getPackages = (p) => (p.packages?.length ? p.packages : [{ id: "0", label: "الباقة الأساسية", price: p.from }]);
// بيانات يطلبها الزبون حسب القسم
export const fieldsFor = (cat) => ({
    games: [{ k: "playerId", label: "Player ID", req: true }, { k: "server", label: "السيرفر / المنطقة (إن وجد)", req: false }],
    subs: [{ k: "account", label: "البريد أو رقم الهاتف المرتبط بالحساب", req: true }],
    ai: [{ k: "account", label: "البريد الإلكتروني للحساب", req: true }],
    apps: [{ k: "account", label: "اسم المستخدم أو البريد في التطبيق", req: true }],
    vpn: [{ k: "account", label: "البريد الإلكتروني لاستلام الاشتراك", req: true }],
    cards: [],
}[cat] ?? []);
export const catMeta = (id) => categories.find((c) => c.id === id);
export const catIcon = (id) => catMeta(id)?.icon ?? Gamepad2;

export const offers = [
    { id: "o1", title: "خصم 10% على أول طلب", text: "استخدم الكود عند إتمام الطلب", code: "RS10", active: true },
    { id: "o2", title: "أسعار خاصة على شحن الألعاب", text: "عرض لفترة محدودة على الباقات الأكثر طلبًا", code: "", active: true },
    { id: "o3", title: "اجمع نقاط الولاء", text: "كل طلب مكتمل يضيف نقاطًا إلى رصيدك", code: "", active: true },
];

// أكواد خصم فعلية تُطبَّق عند الشراء. type: percent | fixed
export const coupons = [
    { id: "c1", code: "RS10", type: "percent", value: 10, min: 0, maxUses: 0, used: 0, usedBy: [], expires: "", firstOnly: true, active: true },
];

export const site = {
    name: "RS Games",
    tagline: "شحن ألعاب وبطاقات واشتراكات",
    banner: "",
    bannerOn: false,
    maintenance: false,
    maintenanceMsg: "المتجر في صيانة مؤقتة وسنعود قريبًا. يمكنك التصفح الآن والشراء لاحقًا.",
};

export const steps = [
    { title: "اختر المنتج", text: "اللعبة أو البطاقة أو الاشتراك ثم الباقة المناسبة." },
    { title: "أدخل بياناتك", text: "Player ID والسيرفر أو بيانات الحساب المطلوبة." },
    { title: "ادفع وارفع الإيصال", text: "اختر طريقة الدفع وأرفق صورة التحويل." },
    { title: "استلم طلبك", text: "يصلك إشعار فور اكتمال الشحن أو التفعيل." },
];

// ===== المحفظة والإيداع =====
export const currencies = [
    { code: "USD", label: "دولار", symbol: "$", min: 1 },
    { code: "SYP", label: "ليرة سورية", symbol: "ل.س", min: 10000 },
    { code: "TRY", label: "ليرة تركية", symbol: "₺", min: 50 },
];

// عدّل الحسابات وربط كل طريقة بالعملات المدعومة
export const depositMethods = [
    { id: "shamcash", name: "شام كاش", currencies: ["SYP", "USD", "TRY"], account: "ضع معرّف شام كاش هنا", hint: "حوّل المبلغ من تطبيق شام كاش ثم أدخل رقم العملية." },
    { id: "syriatel", name: "سيريتل كاش", currencies: ["SYP"], account: "ضع رقم سيريتل كاش هنا", hint: "حوّل المبلغ إلى الرقم التالي ثم أدخل رقم العملية." },
    { id: "usdt", name: "USDT (BEP20)", currencies: ["USD"], account: "ضع عنوان المحفظة BEP20 هنا", hint: "أرسل عبر شبكة BEP20 فقط. الإرسال عبر شبكة أخرى يضيّع المبلغ." },
];
