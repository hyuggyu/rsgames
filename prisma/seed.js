import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const email = String(process.env.ADMIN_EMAIL || "admin@rs-store.local").trim().toLowerCase();
const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "change-this-password", 12);

await prisma.user.upsert({
  where: { email },
  update: { name: "RS Store Admin", passwordHash, role: "admin", status: "active" },
  create: { name: "RS Store Admin", email, passwordHash, role: "admin", status: "active", walletId: "RS-ADMIN" }
});

const settings = {
  site: { name: "RS Store", tagline: "شحن ألعاب وبطاقات واشتراكات", logoUrl: "/assets/rs-logo.jpg", banner: "", bannerOn: false, maintenance: false, maintenanceMsg: "المتجر في صيانة مؤقتة وسنعود قريبًا.", minimumOrderUSD: 0 },
  contact: { whatsapp: "", telegram: "", supportName: "دعم RS Store", welcome: "أهلًا بك! اكتب رسالتك وسيرد عليك فريق الدعم." },
  currency: { selected: "SYP", rates: { USD: 1, SYP: 15000, TRY: 35 } },
  affiliate: { pointsPerDollar: 1, pointsToDollar: 100, minimumRedeemPoints: 100, levels: { silver: { minSales: 0 }, gold: { minSales: 500 }, platinum: { minSales: 2000 }, api: { minSales: 5000 } } }
};
await prisma.storeSettings.upsert({ where: { key: "main" }, update: {}, create: { key: "main", ...settings } });

for (const [slug, label, sortOrder] of [["games", "ألعاب", 1], ["apps", "تطبيقات", 2], ["cards", "بطاقات رقمية", 3], ["subs", "اشتراكات", 4], ["vpn", "خدمات VPN", 5], ["ai", "خدمات الذكاء الاصطناعي", 6]]) {
  await prisma.category.upsert({ where: { slug }, update: { label, active: true, sortOrder }, create: { slug, label, active: true, sortOrder } });
}

for (const method of [
  { slug: "shamcash", name: "شام كاش", account: "ضع معرّف شام كاش هنا", hint: "حوّل المبلغ ثم أدخل رقم العملية.", currencies: ["SYP", "USD", "TRY"], minimums: { USD: 1, SYP: 10000, TRY: 50 } },
  { slug: "syriatel", name: "سيريتل كاش", account: "ضع رقم سيريتل كاش هنا", hint: "حوّل المبلغ إلى الرقم ثم أرفق الإيصال.", currencies: ["SYP"], minimums: { SYP: 10000 } },
  { slug: "usdt", name: "USDT (BEP20)", account: "ضع عنوان محفظة BEP20 هنا", hint: "أرسل عبر شبكة BEP20 فقط.", currencies: ["USD"], minimums: { USD: 5 } }
]) await prisma.paymentMethod.upsert({ where: { slug: method.slug }, update: method, create: { ...method, extraFields: [] } });

for (const product of [
  { name: "PUBG Mobile", slug: "pubg-mobile", categorySlug: "games", featured: true, packages: [{ title: "60 UC", price: 1, retailPrice: 1, agentPrice: 0.95, wholesalePrice: 0.9 }, { title: "325 UC", price: 5, retailPrice: 5, agentPrice: 4.75, wholesalePrice: 4.5 }] },
  { name: "Free Fire", slug: "free-fire", categorySlug: "games", featured: false, packages: [{ title: "100 Diamonds", price: 1.5, retailPrice: 1.5, agentPrice: 1.4, wholesalePrice: 1.3 }] },
  { name: "Netflix", slug: "netflix", categorySlug: "subs", featured: false, packages: [{ title: "شهر واحد", price: 7, retailPrice: 7, agentPrice: 6.5, wholesalePrice: 6 }] }
]) {
  const existing = await prisma.product.findUnique({ where: { slug: product.slug } });
  if (!existing) await prisma.product.create({ data: { name: product.name, slug: product.slug, categorySlug: product.categorySlug, featured: product.featured, packages: { create: product.packages } } });
}

if (await prisma.offer.count() === 0) await prisma.offer.createMany({ data: [
  { title: "أسعار خاصة لشحن الألعاب", text: "اكتشف باقات الشحن الأكثر طلبًا بأسعار مميزة.", badge: "الأكثر طلبًا", link: "/", active: true, sortOrder: 1 },
  { title: "برنامج وكلاء RS Store", text: "اجمع النقاط واحصل على أسعار الجملة ومستويات الوكلاء.", badge: "للوكلاء", link: "/affiliate", active: true, sortOrder: 2 }
] });

console.log(`PostgreSQL seed complete: ${email}`);
await prisma.$disconnect();
