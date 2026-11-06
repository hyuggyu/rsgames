import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { Prisma } from "@prisma/client";
import { connectDatabase, disconnectDatabase, prisma } from "./db.js";
import { createR2Storage } from "./r2-storage.js";

const app = express();
const port = /^\d+$/.test(String(process.env.PORT || "")) ? Number(process.env.PORT) : (process.env.PORT || 4000);
const secret = process.env.JWT_SECRET || "development-only-secret-change-me";
const codeKey = crypto.createHash("sha256").update(process.env.CODE_ENCRYPTION_KEY || `${secret}:digital-codes`).digest();
const origins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((x) => x.trim().replace(/\/$/, ""))
  .filter(Boolean);
const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
if (vercelOrigin && !origins.includes(vercelOrigin)) origins.push(vercelOrigin);
const webRoot = path.resolve(process.env.WEB_ROOT || "public");
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const privateBucket = process.env.SUPABASE_PRIVATE_BUCKET || "private-uploads";
const publicBucket = process.env.SUPABASE_PUBLIC_BUCKET || "public-assets";
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const storage = () => {
  if (!supabase) throw Object.assign(new Error("Supabase Storage is not configured"), { status: 503 });
  return supabase.storage;
};
const r2 = createR2Storage();
const r2PrivateBucket = process.env.R2_PRIVATE_BUCKET || "private-uploads";
const r2PublicBucket = process.env.R2_PUBLIC_BUCKET || "public-assets";
const putPrivateObject = async (key, body, contentType) => {
  if (r2.configured) return r2.put(r2PrivateBucket, key, body, contentType);
  const { error } = await storage().from(privateBucket).upload(key, body, { contentType, upsert: false });
  if (error) throw Object.assign(new Error(`File upload failed: ${error.message}`), { status: 502 });
};
const deletePrivateObject = async (key) => {
  if (r2.configured) return r2.remove(r2PrivateBucket, key);
  const { error } = await storage().from(privateBucket).remove([key]);
  if (error) throw Object.assign(new Error(`File delete failed: ${error.message}`), { status: 502 });
};
const getPrivateObject = async (key) => {
  if (r2.configured) return r2.get(r2PrivateBucket, key);
  const { data, error } = await storage().from(privateBucket).download(key);
  if (error || !data) throw Object.assign(new Error("File not found"), { status: 404 });
  return { buffer: Buffer.from(await data.arrayBuffer()), contentType: data.type };
};
const putPublicObject = async (key, body, contentType) => {
  if (r2.configured) {
    await r2.put(r2PublicBucket, key, body, contentType);
    return r2.publicUrl(key);
  }
  const { error } = await storage().from(publicBucket).upload(key, body, { contentType, upsert: false });
  if (error) throw Object.assign(new Error(`Image upload failed: ${error.message}`), { status: 502 });
  return storage().from(publicBucket).getPublicUrl(key).data.publicUrl;
};

if (process.env.NODE_ENV === "production" && secret === "development-only-secret-change-me") {
  throw new Error("JWT_SECRET must be configured in production");
}

app.set("trust proxy", 1);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp", "application/pdf", "audio/mpeg", "audio/ogg", "audio/webm", "audio/wav", "audio/mp4", "audio/x-m4a", "video/mp4", "video/webm", "video/quicktime"].includes(file.mimetype))
});
const publicImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(file.mimetype))
});

const r2Origin = process.env.R2_PUBLIC_URL ? (() => { try { return new URL(process.env.R2_PUBLIC_URL).origin; } catch { return ""; } })() : "";
const supabaseOrigin = supabaseUrl ? (() => { try { return new URL(supabaseUrl).origin; } catch { return ""; } })() : "";
const extraImg = [r2Origin, supabaseOrigin].filter(Boolean);
const isProd = process.env.NODE_ENV === "production";
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://accounts.google.com/gsi/"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com/gsi/style"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", ...extraImg],
      mediaSrc: ["'self'", "blob:", "data:", ...extraImg],
      connectSrc: ["'self'", "https://accounts.google.com", ...extraImg],
      frameSrc: ["'self'", "https://accounts.google.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      ...(isProd ? { upgradeInsecureRequests: [] } : {})
    }
  },
  hsts: isProd
}));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const normalized = String(origin).replace(/\/$/, "");
    const isVercelPreview = /^https:\/\/[^.]+(?:-[^.]+)*\.vercel\.app$/i.test(normalized);
    cb(null, origins.includes(normalized) || normalized === vercelOrigin || isVercelPreview);
  }
}));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use("/assets", express.static(path.join(webRoot, "assets"), { index: false, maxAge: "365d", immutable: true }));
app.use(express.static(webRoot, { index: false, maxAge: "1d" }));

const buckets = new Map();
const limiter = (windowMs = 60_000, max = 180) => (req, res, next) => {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const old = buckets.get(key);
  if (!old || now - old.at > windowMs) buckets.set(key, { at: now, count: 1 });
  else if (++old.count > max) return res.status(429).json({ message: "Too many requests" });
  next();
};
const adminSetupBuckets = new Map();
const adminSetupRateLimit = (req, res, next) => {
  const key = cleanIp(req.ip);
  const now = Date.now();
  const state = adminSetupBuckets.get(key);
  if (!state || now - state.startedAt >= 15 * 60_000) adminSetupBuckets.set(key, { startedAt: now, count: 1 });
  else if (state.count >= 5) return res.status(429).json({ message: "Too many setup attempts. Try again in 15 minutes." });
  else state.count += 1;
  if (adminSetupBuckets.size > 5000) {
    for (const [ip, entry] of adminSetupBuckets) if (now - entry.startedAt >= 15 * 60_000) adminSetupBuckets.delete(ip);
  }
  next();
};
const adminSetupCode = () => process.env.ADMIN_SETUP_CODE || (process.env.NODE_ENV === "production" ? "" : "1234");
const secretMatches = (received, expected) => {
  const left = Buffer.from(String(received || ""));
  const right = Buffer.from(String(expected || ""));
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
};
app.use(limiter());

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const tokenHash = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");
const randomCode = (size = 6) => Array.from({ length: size }, () => crypto.randomInt(0, 10)).join("");
const codeHash = (value) => crypto.createHmac("sha256", codeKey).update(String(value)).digest("hex");
const encryptCode = (value) => {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv("aes-256-gcm", codeKey, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return { cipherText: encrypted.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
};
const decryptCode = (item) => {
  const decipher = crypto.createDecipheriv("aes-256-gcm", codeKey, Buffer.from(item.iv, "base64"));
  decipher.setAuthTag(Buffer.from(item.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(item.cipherText, "base64")), decipher.final()]).toString("utf8");
};
const deliveryPrefix = "rsenc:v1:";
const encryptDelivery = (value) => {
  const text = String(value || "");
  if (!text || text.startsWith(deliveryPrefix)) return text;
  return deliveryPrefix + Buffer.from(JSON.stringify(encryptCode(text))).toString("base64url");
};
const decryptDelivery = (value) => {
  const text = String(value || "");
  if (!text.startsWith(deliveryPrefix)) return text;
  try { return decryptCode(JSON.parse(Buffer.from(text.slice(deliveryPrefix.length), "base64url").toString("utf8"))); }
  catch { throw Object.assign(new Error("Delivery code cannot be decrypted"), { status: 500 }); }
};
const customerOrderView = (order) => {
  const output = plain(order);
  output.hasDeliveryCode = order.status === "completed" && Boolean(order.deliveryCode);
  delete output.deliveryCode;
  return output;
};
const adminOrderView = (order) => {
  const output = plain(order);
  if (order.status === "completed" && order.deliveryCode) output.deliveryCode = decryptDelivery(order.deliveryCode);
  return output;
};
const addOrderEvent = (client, orderId, status, title, message = null, source = "system", eventKey = null, metadata = null) => client.orderEvent.create({ data: { orderId, status, title, message, source, eventKey, metadata } });

const providerKey = (provider) => decryptCode({ cipherText: provider.keyCipherText, iv: provider.keyIv, authTag: provider.keyAuthTag });
const safeProviderUrl = (provider, rawPath) => {
  const url = new URL(String(rawPath || ""), provider.baseUrl.endsWith("/") ? provider.baseUrl : provider.baseUrl + "/");
  if (url.protocol !== "https:") throw Object.assign(new Error("Provider URL must use HTTPS"), { status: 400 });
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "::1" || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) throw Object.assign(new Error("Private provider URLs are not allowed"), { status: 400 });
  return url;
};
const pathValue = (value, dottedPath) => String(dottedPath || "").split(".").filter(Boolean).reduce((current, part) => current == null ? undefined : current[part], value);
const fillProviderTemplate = (value, context) => {
  if (Array.isArray(value)) return value.map((item) => fillProviderTemplate(item, context));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fillProviderTemplate(item, context)]));
  if (typeof value !== "string") return value;
  const exact = value.match(/^\{([a-zA-Z0-9_.-]+)\}$/);
  if (exact) return pathValue(context, exact[1]) ?? "";
  return value.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (_match, key) => String(pathValue(context, key) ?? ""));
};
const providerHeaders = (provider) => {
  const headers = { "Content-Type": "application/json", "Accept": "application/json" };
  const key = providerKey(provider);
  if (provider.authType === "bearer") headers.Authorization = "Bearer " + key;
  else if (provider.authType === "header") headers[provider.authName || "X-API-Key"] = key;
  return { headers, key };
};
const providerPublic = (provider) => plain({ ...provider, keyCipherText: undefined, keyIv: undefined, keyAuthTag: undefined, apiKeyConfigured: Boolean(provider.keyCipherText), apiKeyPreview: "••••••••" });

async function handleProviderSubmissionFailure(job, rawError) {
  const message = String(rawError?.message || rawError || "Provider request failed").slice(0, 500);
  const failureCount = job.provider.consecutiveFailures + 1;
  await prisma.apiProvider.update({ where: { id: job.provider.id }, data: { consecutiveFailures: { increment: 1 }, lastFailureAt: new Date(), circuitOpenUntil: failureCount >= 3 ? new Date(Date.now() + 15 * 60_000) : job.provider.circuitOpenUntil } });
  if (job.attempts < Math.max(1, job.provider.maxRetries)) {
    await prisma.apiFulfillment.update({ where: { id: job.id }, data: { status: "queued", lastError: message, nextCheckAt: new Date(Date.now() + Math.min(120_000, 10_000 * 2 ** Math.max(0, job.attempts - 1))) } });
    return "retry";
  }
  const excluded = [...new Set([...(job.failedProviderIds || []), job.provider.id])];
  const fallback = await prisma.apiProvider.findFirst({ where: { active: true, id: { notIn: excluded }, OR: [{ circuitOpenUntil: null }, { circuitOpenUntil: { lte: new Date() } }] }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
  if (fallback) {
    await prisma.apiFulfillment.update({ where: { id: job.id }, data: { providerId: fallback.id, status: "queued", attempts: 0, failedProviderIds: excluded, switchedCount: { increment: 1 }, externalOrderId: null, lastError: `Switched from ${job.provider.name}: ${message}`, nextCheckAt: new Date(Date.now() + 3000) } });
    await addOrderEvent(prisma, job.orderItem.orderId, "processing", "تم التحويل إلى مزود احتياطي", `تعذر التنفيذ عبر ${job.provider.name} وتم التحويل تلقائيًا إلى ${fallback.name}.`, "system");
    return "switched";
  }
  await prisma.apiFulfillment.update({ where: { id: job.id }, data: { status: "failed", failedProviderIds: excluded, lastError: message, nextCheckAt: null } });
  const admins = await prisma.user.findMany({ where: { role: "admin", status: "active" }, select: { id: true } });
  if (admins.length) await prisma.notification.createMany({ data: admins.map((adminUser) => ({ userId: adminUser.id, title: "فشل جميع مزودي الشحن", message: `${job.orderItem.order.orderNumber}: ${message}`, type: "order", data: { orderId: job.orderItem.orderId, fulfillmentId: job.id } })) });
  await addOrderEvent(prisma, job.orderItem.orderId, "processing", "تعذر الشحن التلقائي", "تم تحويل الطلب إلى الإدارة للمعالجة اليدوية.", "system");
  return "failed";
}

async function sendApiFulfillment(fulfillmentId) {
  const locked = await prisma.apiFulfillment.updateMany({ where: { id: fulfillmentId, status: { in: ["queued", "failed"] } }, data: { status: "sending", attempts: { increment: 1 }, lastError: null } });
  if (!locked.count) return;
  const job = await prisma.apiFulfillment.findUnique({ where: { id: fulfillmentId }, include: { provider: true, orderItem: { include: { order: true, package: true } } } });
  if (!job?.orderItem.package?.providerCode) {
    await prisma.apiFulfillment.update({ where: { id: fulfillmentId }, data: { status: "failed", lastError: "Product mapping is unavailable" } });
    return;
  }
  if (!job.provider.active || (job.provider.circuitOpenUntil && job.provider.circuitOpenUntil > new Date())) return handleProviderSubmissionFailure(job, "Provider is disabled or temporarily unavailable");
  try {
    const provider = job.provider;
    const customer = job.orderItem.order.customerData && typeof job.orderItem.order.customerData === "object" ? job.orderItem.order.customerData : {};
    const context = { productCode: job.orderItem.package.providerCode, quantity: job.orderItem.quantity, orderNumber: job.orderItem.order.orderNumber, orderItemId: job.orderItem.id, packageTitle: job.orderItem.packageTitle, customer };
    const payload = fillProviderTemplate(provider.requestTemplate, context);
    const auth = providerHeaders(provider);
    const url = safeProviderUrl(provider, provider.orderPath);
    if (provider.authType === "query") url.searchParams.set(provider.authName || "api_key", auth.key);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(30000, Math.max(3000, provider.timeoutMs)));
    let response;
    try {
      response = await fetch(url, { method: provider.httpMethod, headers: auth.headers, body: provider.httpMethod === "GET" ? undefined : JSON.stringify(payload), signal: controller.signal });
    } finally { clearTimeout(timeout); }
    const data = await response.json().catch(() => ({ raw: "Non-JSON response" }));
    if (!response.ok) throw new Error("Provider returned HTTP " + response.status);
    const externalOrderId = pathValue(data, provider.externalIdPath);
    const rawStatus = String(pathValue(data, provider.statusResponsePath) || "processing").toLowerCase();
    const completed = provider.successValues.map((x) => x.toLowerCase()).includes(rawStatus);
    await prisma.apiFulfillment.update({ where: { id: job.id }, data: { status: completed ? "completed" : "processing", externalOrderId: externalOrderId == null ? null : String(externalOrderId), requestPayload: payload, responsePayload: data, sentAt: new Date(), completedAt: completed ? new Date() : null, nextCheckAt: completed ? null : new Date(Date.now() + 60_000) } });
    await prisma.apiProvider.update({ where: { id: provider.id }, data: { consecutiveFailures: 0, circuitOpenUntil: null, lastSuccessAt: new Date() } });
    const moved = await prisma.order.update({ where: { id: job.orderItem.orderId }, data: { status: "processing" } });
    if (job.orderItem.order.status !== "processing" && job.orderItem.order.status !== "completed") await addOrderEvent(prisma, moved.id, "processing", "بدأ تنفيذ الشحن", "تم إرسال الطلب بأمان إلى مزود الخدمة.", "provider", "provider-started").catch((error) => { if (error?.code !== "P2002") throw error; });
    const remaining = await prisma.orderItem.count({ where: { orderId: job.orderItem.orderId, OR: [{ fulfillment: null }, { fulfillment: { status: { not: "completed" } } }] } });
    if (!remaining) {
      await prisma.order.update({ where: { id: job.orderItem.orderId }, data: { status: "completed" } });
      await addOrderEvent(prisma, job.orderItem.orderId, "completed", "اكتمل الطلب", "تم تسليم جميع عناصر الطلب تلقائيًا.", "provider");
    }
  } catch (error) {
    await handleProviderSubmissionFailure(job, error);
  }
}

async function checkApiFulfillment(fulfillmentId) {
  const job = await prisma.apiFulfillment.findUnique({ where: { id: fulfillmentId }, include: { provider: true, orderItem: true } });
  if (!job || job.status !== "processing" || !job.externalOrderId || !job.provider.statusPath) return;
  try {
    const auth = providerHeaders(job.provider);
    const path = job.provider.statusPath.replace("{externalOrderId}", encodeURIComponent(job.externalOrderId));
    const url = safeProviderUrl(job.provider, path);
    if (job.provider.authType === "query") url.searchParams.set(job.provider.authName || "api_key", auth.key);
    const response = await fetch(url, { headers: auth.headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("Provider returned HTTP " + response.status);
    const rawStatus = String(pathValue(data, job.provider.statusResponsePath) || "").toLowerCase();
    const completed = job.provider.successValues.map((x) => x.toLowerCase()).includes(rawStatus);
    const pending = job.provider.pendingValues.map((x) => x.toLowerCase()).includes(rawStatus);
    await prisma.apiFulfillment.update({ where: { id: job.id }, data: { status: completed ? "completed" : pending ? "processing" : "failed", responsePayload: data, completedAt: completed ? new Date() : null, nextCheckAt: pending ? new Date(Date.now() + 60_000) : null, lastError: pending || completed ? null : "Provider status: " + rawStatus } });
    await prisma.apiProvider.update({ where: { id: job.provider.id }, data: { consecutiveFailures: 0, circuitOpenUntil: null, lastSuccessAt: new Date() } });
    const remaining = await prisma.orderItem.count({ where: { orderId: job.orderItem.orderId, OR: [{ fulfillment: null }, { fulfillment: { status: { not: "completed" } } }] } });
    if (!remaining) {
      await prisma.order.update({ where: { id: job.orderItem.orderId }, data: { status: "completed" } });
      await addOrderEvent(prisma, job.orderItem.orderId, "completed", "اكتمل الطلب", "أكد مزود الخدمة نجاح التسليم.", "provider");
    }
  } catch (error) {
    await prisma.apiFulfillment.update({ where: { id: job.id }, data: { lastError: String(error.message || error).slice(0, 500), nextCheckAt: new Date(Date.now() + 120_000) } });
  }
}

// On Vercel a function is frozen after the response, so background work must be registered with waitUntil.
function runInBackground(promise) {
  const waitUntil = globalThis[Symbol.for("@vercel/request-context")]?.get?.()?.waitUntil;
  if (typeof waitUntil === "function") waitUntil(promise);
}
async function processApiFulfillments() {
  const queued = await prisma.apiFulfillment.findMany({ where: { status: "queued", OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: new Date() } }], orderItem: { order: { status: { not: "payment_review" } } } }, select: { id: true }, take: 10, orderBy: { createdAt: "asc" } });
  for (const job of queued) await sendApiFulfillment(job.id);
  const checks = await prisma.apiFulfillment.findMany({ where: { status: "processing", nextCheckAt: { lte: new Date() } }, select: { id: true }, take: 20 });
  for (const job of checks) await checkApiFulfillment(job.id);
}
async function monitorStuckOrders() {
  const delayMinutes = Math.max(5, Number((await settings()).site?.policies?.orderDelayMinutes || 30));
  const cutoff = new Date(Date.now() - delayMinutes * 60_000);
  const stuck = await prisma.order.findMany({ where: { status: { in: ["pending", "paid", "processing"] }, updatedAt: { lte: cutoff }, events: { none: { eventKey: "delay-alert" } } }, select: { id: true, userId: true, orderNumber: true, status: true }, take: 50 });
  if (!stuck.length) return 0;
  const admins = await prisma.user.findMany({ where: { role: "admin", status: "active" }, select: { id: true } });
  await prisma.$transaction(async (tx) => {
    for (const order of stuck) {
      await addOrderEvent(tx, order.id, order.status, "تأخر تنفيذ الطلب", "تجاوز الطلب مدة التنفيذ المتوقعة وتم تحويله إلى الإدارة للمراجعة.", "monitor", "delay-alert");
      await tx.notification.create({ data: { userId: order.userId, title: "Order delay detected", message: `${order.orderNumber} is being reviewed by support.`, type: "order", data: { orderId: order.id } } });
      for (const adminUser of admins) await tx.notification.create({ data: { userId: adminUser.id, title: "Delayed order alert", message: `${order.orderNumber} is stuck in ${order.status}.`, type: "order", data: { orderId: order.id } } });
    }
  });
  return stuck.length;
}
async function monitorLowStock(packageIds = null) {
  const where = { deliveryType: "code", active: true, ...(packageIds?.length ? { id: { in: [...new Set(packageIds)] } } : {}) };
  const packages = await prisma.productPackage.findMany({ where, include: { product: { select: { name: true } } } });
  if (!packages.length) return 0;
  const counts = await prisma.digitalCode.groupBy({ by: ["packageId"], where: { packageId: { in: packages.map((pack) => pack.id) }, status: "available" }, _count: { _all: true } });
  const availableByPackage = new Map(counts.map((row) => [row.packageId, row._count._all]));
  const admins = await prisma.user.findMany({ where: { role: "admin", status: "active" }, select: { id: true } });
  let alerted = 0;
  for (const pack of packages) {
    const available = availableByPackage.get(pack.id) || 0;
    const threshold = Math.max(0, pack.lowStockThreshold);
    if (available <= threshold && !pack.lowStockAlertedAt) {
      const locked = await prisma.productPackage.updateMany({ where: { id: pack.id, lowStockAlertedAt: null }, data: { lowStockAlertedAt: new Date() } });
      if (!locked.count) continue;
      if (admins.length) await prisma.notification.createMany({ data: admins.map((adminUser) => ({ userId: adminUser.id, title: "تنبيه انخفاض المخزون", message: `${pack.product.name} - ${pack.title}: متوفر ${available} فقط (الحد ${threshold}).`, type: "general", data: { packageId: pack.id, available, threshold } })) });
      alerted += 1;
    } else if (available > threshold && pack.lowStockAlertedAt) {
      await prisma.productPackage.update({ where: { id: pack.id }, data: { lowStockAlertedAt: null } });
    }
  }
  return alerted;
}
const number = (value) => value instanceof Prisma.Decimal ? value.toNumber() : Number(value || 0);
const plain = (value) => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = plain(item);
    if (out.id) out._id = out.id;
    return out;
  }
  return value;
};
const publicUser = (user) => plain({
  id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, mustChangePassword: Boolean(user.mustChangePassword),
  avatarUrl: user.avatarUrl, authProvider: user.authProvider,
  walletId: user.walletId, balances: { USD: user.balanceUSD, SYP: user.balanceSYP, TRY: user.balanceTRY },
  affiliateCode: user.affiliateCode, affiliatePoints: user.affiliatePoints,
  affiliateSales: user.affiliateSales, affiliateOrders: user.affiliateOrders,
  agentLevel: user.agentLevel, agentCommissionRate: user.agentCommissionRate, phone: user.phone, phoneVerified: user.phoneVerified,
  emailVerified: user.emailVerified, twoFactorEnabled: user.twoFactorEnabled, verified: user.verified, hasPin: Boolean(user.pinHash), createdAt: user.createdAt
});
const productView = (product) => plain({ ...product, category: product.categorySlug, packages: product.packages || [] });

const MENU_ITEM_IDS = {
  main: ["sell-pubg", "favorites", "wallet", "notifications", "orders", "charge", "deposits", "ledger", "invoices", "affiliate", "support", "feedback", "faq", "guides"],
  account: ["profile", "verification", "security", "pin"]
};
const MENU_ROUTES = new Set(["/sell-pubg-account", "/favorites", "/wallet", "/notifications", "/orders", "/charge", "/ledger", "/invoices", "/affiliate", "/support", "/feedback", "/faq", "/guides", "/profile", "/verification", "/security", "/pin", "/"]);
function cleanMenu(input) {
  const source = input && typeof input === "object" ? input : {};
  const items = {};
  for (const id of Object.values(MENU_ITEM_IDS).flat()) {
    const entry = source.items?.[id];
    if (!entry || typeof entry !== "object") continue;
    const label = typeof entry.label === "string" ? entry.label.trim().slice(0, 40) : "";
    const hidden = entry.hidden === true;
    if (label || hidden) items[id] = { ...(label ? { label } : {}), ...(hidden ? { hidden: true } : {}) };
  }
  const order = {};
  for (const [group, ids] of Object.entries(MENU_ITEM_IDS)) {
    const list = source.order?.[group];
    if (Array.isArray(list)) order[group] = [...new Set(list.filter((id) => ids.includes(id)))];
  }
  const titles = {};
  for (const groupId of ["main", "account"]) {
    const title = typeof source.titles?.[groupId] === "string" ? source.titles[groupId].trim().slice(0, 40) : "";
    if (title) titles[groupId] = title;
  }
  const customIds = new Set();
  const customGroups = (Array.isArray(source.customGroups) ? source.customGroups : []).slice(0, 12).flatMap((group, groupIndex) => {
    if (!group || typeof group !== "object") return [];
    let id = String(group.id || `custom-${groupIndex + 1}`).trim();
    if (!/^custom-[a-z0-9-]{1,48}$/.test(id)) id = `custom-${groupIndex + 1}`;
    if (customIds.has(id)) return [];
    customIds.add(id);
    const title = typeof group.title === "string" ? group.title.trim().slice(0, 40) : "";
    if (!title) return [];
    const itemIds = new Set();
    const customItems = (Array.isArray(group.items) ? group.items : []).slice(0, 12).flatMap((item, itemIndex) => {
      if (!item || typeof item !== "object") return [];
      let itemId = String(item.id || `${id}-item-${itemIndex + 1}`).trim();
      if (!/^[a-z0-9-]{1,80}$/.test(itemId)) itemId = `${id}-item-${itemIndex + 1}`;
      if (itemIds.has(itemId)) return [];
      itemIds.add(itemId);
      const label = typeof item.label === "string" ? item.label.trim().slice(0, 40) : "";
      const to = typeof item.to === "string" && MENU_ROUTES.has(item.to) ? item.to : "";
      return label && to ? [{ id: itemId, label, to }] : [];
    });
    return [{ id, title, items: customItems }];
  });
  const bottomNav = (Array.isArray(source.bottomNav) ? source.bottomNav : []).slice(0, 5).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const to = typeof item.to === "string" && MENU_ROUTES.has(item.to) ? item.to : "";
    const label = typeof item.label === "string" ? item.label.trim().slice(0, 30) : "";
    return to && label ? [{ id: String(item.id || `bottom-${index + 1}`).slice(0, 80), to, label, ...(item.hidden === true ? { hidden: true } : {}) }] : [];
  });
  return { items, order, titles, customGroups, bottomNav };
}

async function settings() {
  const defaults = {
    site: { name: "RS Store", tagline: "شحن ألعاب وبطاقات واشتراكات", logoUrl: "/assets/rs-logo.jpg", banner: "", bannerOn: false, maintenance: false, maintenanceMsg: "المتجر في صيانة مؤقتة وسنعود قريبًا.", minimumOrderUSD: 0 },
    contact: { whatsapp: "", telegram: "", supportName: "دعم RS Store", welcome: "أهلًا بك! اكتب رسالتك وسيرد عليك فريق الدعم." },
    currency: { selected: "SYP", rates: { USD: 1, SYP: 15000, TRY: 35 } },
    affiliate: { pointsPerDollar: 1, pointsToDollar: 100, minimumRedeemPoints: 100, levels: { silver: { minSales: 0 }, gold: { minSales: 500 }, platinum: { minSales: 2000 }, api: { minSales: 5000 } } }
  };
  const row = await prisma.storeSettings.upsert({ where: { key: "main" }, update: {}, create: { key: "main", ...defaults } });
  const controls = { registration: true, orders: true, deposits: true, support: true, reviews: true, verification: true, affiliates: true, liveChat: true, ...(row.site?.controls || {}) };
  const policies = { requireEmailForOrders: false, requirePhoneForOrders: false, requireIdentityForOrders: false, requirePinForOrders: false, maximumOrderUSD: 0, maximumDepositUSD: 0, maximumPendingOrders: 0, orderDelayMinutes: 30, ...(row.site?.policies || {}) };
  return { ...row, site: { ...(row.site || {}), controls, policies } };
}

const auth = asyncRoute(async (req, res, next) => {
  const raw = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!raw) return res.status(401).json({ message: "Authentication required" });
  let payload;
  try { payload = jwt.verify(raw, secret); } catch { return res.status(401).json({ message: "Invalid session" }); }
  const session = await prisma.authSession.findUnique({ where: { jti: payload.jti }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== "active") return res.status(401).json({ message: "Session expired" });
  req.user = session.user;
  req.session = session;
  if (session.user.mustChangePassword) {
    const route = String(req.originalUrl || "").split("?")[0].replace(/\/+$/, "");
    if (!["/api/auth/change-password", "/api/auth/logout"].includes(route)) return res.status(403).json({ code: "PASSWORD_CHANGE_REQUIRED", message: "You must change your temporary password first" });
  }
  await prisma.authSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  next();
});
const admin = (req, res, next) => req.user?.role === "admin" ? next() : res.status(403).json({ message: "Admin access required" });

const resellerRateState = new Map();
const resellerKeyHash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const cleanIp = (value) => String(value || "").replace(/^::ffff:/, "");
const resellerAuth = asyncRoute(async (req, res, next) => {
  const startedAt = Date.now();
  const raw = String(req.headers["x-api-key"] || "").trim();
  const dot = raw.lastIndexOf(".");
  if (!raw.startsWith("rs_live_") || dot < 9) return res.status(401).json({ success: false, error: { code: "INVALID_API_KEY", message: "Missing or invalid X-API-Key" } });
  const keyPrefix = raw.slice(0, dot);
  const client = await prisma.apiClient.findUnique({ where: { keyPrefix }, include: { user: true } });
  const actualHash = resellerKeyHash(raw);
  const expected = Buffer.from(client?.keyHash || "0".repeat(64), "hex");
  const actual = Buffer.from(actualHash, "hex");
  if (!client || !crypto.timingSafeEqual(expected, actual) || !client.active || (client.expiresAt && client.expiresAt <= new Date()) || client.user.status !== "active") return res.status(401).json({ success: false, error: { code: "INVALID_API_KEY", message: "API key is inactive or expired" } });
  const ip = cleanIp(req.ip);
  if (client.allowedIps.length && !client.allowedIps.includes(ip)) return res.status(403).json({ success: false, error: { code: "IP_NOT_ALLOWED", message: "This IP address is not allowed" } });
  const minute = Math.floor(Date.now() / 60000);
  const rateKey = client.id + ":" + minute;
  const used = (resellerRateState.get(rateKey) || 0) + 1;
  resellerRateState.set(rateKey, used);
  if (used > client.requestsPerMinute) return res.status(429).json({ success: false, error: { code: "RATE_LIMITED", message: "Too many API requests" } });
  if (resellerRateState.size > 10000) for (const key of resellerRateState.keys()) if (!key.endsWith(":" + minute)) resellerRateState.delete(key);
  req.apiClient = client;
  req.user = client.user;
  res.set("X-RateLimit-Limit", String(client.requestsPerMinute));
  res.set("X-RateLimit-Remaining", String(Math.max(0, client.requestsPerMinute - used)));
  res.on("finish", () => {
    prisma.apiRequestLog.create({ data: { apiClientId: client.id, endpoint: req.path.slice(0, 160), method: req.method, statusCode: res.statusCode, ip, latencyMs: Date.now() - startedAt } }).catch(() => {});
    prisma.apiClient.update({ where: { id: client.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  });
  next();
});
const requireApiScope = (scope) => (req, res, next) => req.apiClient.scopes.includes(scope) ? next() : res.status(403).json({ success: false, error: { code: "SCOPE_DENIED", message: "Required scope: " + scope } });
const resellerPrice = (user, pack) => ["api", "platinum"].includes(user.agentLevel) ? (pack.wholesalePrice ?? pack.agentPrice ?? pack.price) : user.agentLevel === "gold" ? (pack.agentPrice ?? pack.retailPrice ?? pack.price) : (pack.retailPrice ?? pack.price);

async function createSession(user, req) {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000);
  await prisma.authSession.create({ data: { userId: user.id, jti, ip: req.ip, userAgent: String(req.headers["user-agent"] || "").slice(0, 500), expiresAt } });
  return jwt.sign({ id: user.id, role: user.role, jti }, secret, { expiresIn: "7d" });
}

async function sendEmail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  if (apiKey && from) {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, text, html }) });
    if (!response.ok) throw Object.assign(new Error("Email provider rejected the message"), { status: 502 });
    return true;
  }
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const nodemailer = (await import("nodemailer")).default;
    const port = Number(process.env.SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    try { await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text, html }); }
    catch (error) { console.error("SMTP error:", error.message); throw Object.assign(new Error("Email provider rejected the message"), { status: 502 }); }
    return true;
  }
  if (process.env.NODE_ENV === "production") throw Object.assign(new Error("Email delivery is not configured"), { status: 503 });
  console.log(`[DEV EMAIL] ${to}: ${subject}\n${text}`); return false;
}

let googleKeys = { expiresAt: 0, values: [] };
async function verifyGoogleCredential(credential) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw Object.assign(new Error("Google sign-in is not configured"), { status: 503 });
  const parts = String(credential || "").split(".");
  if (parts.length !== 3) throw Object.assign(new Error("Invalid Google credential"), { status: 401 });
  const decode = (value) => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  let header, payload;
  try { header = decode(parts[0]); payload = decode(parts[1]); } catch { throw Object.assign(new Error("Invalid Google credential"), { status: 401 }); }
  if (header.alg !== "RS256" || !header.kid) throw Object.assign(new Error("Unsupported Google credential"), { status: 401 });
  if (googleKeys.expiresAt <= Date.now()) {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
    if (!response.ok) throw Object.assign(new Error("Google verification is unavailable"), { status: 502 });
    const body = await response.json();
    const maxAge = Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] || 3600);
    googleKeys = { values: body.keys || [], expiresAt: Date.now() + maxAge * 1000 };
  }
  const jwk = googleKeys.values.find((key) => key.kid === header.kid);
  if (!jwk || !crypto.verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), crypto.createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"))) {
    throw Object.assign(new Error("Invalid Google credential signature"), { status: 401 });
  }
  const issuerOk = ["accounts.google.com", "https://accounts.google.com"].includes(payload.iss);
  const audienceOk = Array.isArray(payload.aud) ? payload.aud.includes(clientId) : payload.aud === clientId;
  if (!issuerOk || !audienceOk || Number(payload.exp) * 1000 <= Date.now() || !payload.email_verified || !payload.email || !payload.sub) {
    throw Object.assign(new Error("Google credential is expired or invalid"), { status: 401 });
  }
  return payload;
}
async function sendSms({ to, message }) {
  const url = process.env.SMS_API_URL, apiKey = process.env.SMS_API_KEY;
  if (url && apiKey) {
    const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ to, message, sender: process.env.SMS_SENDER || "RS Store" }) });
    if (!response.ok) throw Object.assign(new Error("SMS provider rejected the message"), { status: 502 });
    return true;
  }
  if (process.env.NODE_ENV === "production") throw Object.assign(new Error("SMS delivery is not configured"), { status: 503 });
  console.log(`[DEV SMS] ${to}: ${message}`); return false;
}

app.get("/api/health", asyncRoute(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true, database: "postgresql", orm: "prisma" });
}));
app.get("/api/auth/admin/setup-status", asyncRoute(async (_req, res) => {
  res.set("Cache-Control", "no-store");
  const config = await settings();
  res.json({ configured: Boolean(config.site?.adminCredentialConfigured) });
}));
app.post("/api/auth/admin/verify-code", adminSetupRateLimit, asyncRoute(async (req, res) => {
  const expected = adminSetupCode();
  if (!expected) return res.status(503).json({ message: "ADMIN_SETUP_CODE is not configured" });
  if (!secretMatches(req.body.code, expected)) return res.status(401).json({ message: "رمز الدخول غير صحيح" });
  const config = await settings();
  res.json({ configured: Boolean(config.site?.adminCredentialConfigured) });
}));
app.post("/api/auth/admin/setup", adminSetupRateLimit, asyncRoute(async (req, res) => {
  const expected = adminSetupCode();
  if (!expected) return res.status(503).json({ message: "ADMIN_SETUP_CODE is not configured" });
  if (!secretMatches(req.body.code, expected)) return res.status(401).json({ message: "رمز الدخول غير صحيح" });
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12 || password.length > 128) {
    return res.status(400).json({ message: "أدخل بريدًا صحيحًا وكلمة مرور من 12 محرفًا على الأقل" });
  }
  const requestedUser = await prisma.user.findUnique({ where: { email } });
  if (requestedUser && requestedUser.role !== "admin") {
    return res.status(409).json({ message: "هذا البريد مرتبط بحساب مستخدم. اختر بريدًا آخر للمدير" });
  }
  await settings();
  const passwordHash = await bcrypt.hash(password, 12);
  const existingAdmins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  const primary = requestedUser || (existingAdmins.length ? await prisma.user.findUnique({ where: { id: existingAdmins[0].id } }) : null);
  const user = await prisma.$transaction(async (tx) => {
    const config = await tx.storeSettings.findUnique({ where: { key: "main" } });
    if (config?.site?.adminCredentialConfigured) {
      throw Object.assign(new Error("Primary admin account has already been configured"), { status: 409 });
    }
    const adminUser = primary
      ? await tx.user.update({ where: { id: primary.id }, data: {
          name: "RS Store Admin", email, passwordHash, role: "admin", status: "active",
          authProvider: "local", googleId: null, twoFactorEnabled: false,
          mustChangePassword: false, failedLogins: 0, lockedUntil: null
        } })
      : await tx.user.create({ data: {
          name: "RS Store Admin", email, passwordHash, role: "admin", status: "active",
          authProvider: "local", emailVerified: true, walletId: `RS-ADMIN-${crypto.randomBytes(6).toString("hex").toUpperCase()}`
        } });
    const previousAdminIds = existingAdmins.map(({ id }) => id).filter((id) => id !== adminUser.id);
    if (previousAdminIds.length) {
      await tx.user.updateMany({ where: { id: { in: previousAdminIds }, role: "admin" }, data: { role: "customer" } });
    }
    const sessionAdminIds = [...new Set([...existingAdmins.map(({ id }) => id), adminUser.id])];
    await tx.authSession.updateMany({ where: { userId: { in: sessionAdminIds }, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.storeSettings.update({
      where: { key: "main" },
      data: { site: { ...(config?.site || {}), adminCredentialConfigured: true } }
    });
    return adminUser;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.status(201).json({ token: await createSession(user, req), user: publicUser(user) });
}));
const publicCache = (seconds) => (req, res, next) => { if (!req.headers.authorization) res.set("Cache-Control", `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}`); next(); };
app.get("/api/settings", publicCache(15), asyncRoute(async (_req, res) => res.json(plain(await settings()))));

app.post("/api/auth/register", limiter(60_000, 10), asyncRoute(async (req, res) => {
  const config = await settings();
  if (config.site?.controls?.registration === false) return res.status(503).json({ message: "New account registration is currently disabled" });
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ message: "Invalid registration data" });
  if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ message: "Email already exists" });
  const referral = req.body.referralCode ? await prisma.user.findUnique({ where: { affiliateCode: String(req.body.referralCode).toUpperCase() } }) : null;
  const emailCode = randomCode();
  const user = await prisma.user.create({ data: {
    name, email, passwordHash: await bcrypt.hash(password, 12),
    walletId: `RS-${crypto.randomBytes(7).toString("hex").toUpperCase()}`,
    affiliateCode: crypto.randomBytes(5).toString("hex").toUpperCase(), referredBy: referral?.affiliateCode || null,
    emailCodeHash: tokenHash(emailCode), emailCodeExpires: new Date(Date.now() + 30 * 60_000)
  }});
  let emailSent = false; try { emailSent = await sendEmail({ to: email, subject: "RS Store email verification", text: `Your verification code is ${emailCode}`, html: `<p>Your RS Store verification code is <strong>${emailCode}</strong>. It expires in 30 minutes.</p>` }); } catch (error) { console.error("Registration email:", error.message); }
  res.status(201).json({ token: await createSession(user, req), user: publicUser(user), emailSent });
}));
app.post("/api/auth/login", limiter(60_000, 12), asyncRoute(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000));
    return res.status(429).json({ message: `Too many failed attempts. Try again in ${minutes} minute(s).` });
  }
  if (!user || !await bcrypt.compare(String(req.body.password || ""), user.passwordHash)) {
    if (user) {
      const failed = (user.failedLogins || 0) + 1;
      await prisma.user.update({ where: { id: user.id }, data: failed >= 5 ? { failedLogins: 0, lockedUntil: new Date(Date.now() + 15 * 60_000) } : { failedLogins: failed } });
    }
    return res.status(401).json({ message: "Invalid email or password" });
  }
  if (user.status !== "active") return res.status(403).json({ message: "Account is blocked" });
  if (user.failedLogins || user.lockedUntil) await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  if (user.twoFactorEnabled) {
    const challengeToken = crypto.randomBytes(32).toString("base64url");
    const verificationCode = randomCode();
    await prisma.loginChallenge.deleteMany({ where: { OR: [{ expiresAt: { lte: new Date() } }, { userId: user.id, consumedAt: null }] } });
    await prisma.loginChallenge.create({ data: {
      userId: user.id, tokenHash: tokenHash(challengeToken), codeHash: codeHash(verificationCode),
      ip: req.ip, userAgent: String(req.headers["user-agent"] || "").slice(0, 500), expiresAt: new Date(Date.now() + 10 * 60_000)
    }});
    await sendEmail({ to: user.email, subject: "RS Store login verification", text: `Your login code is ${verificationCode}. It expires in 10 minutes.`, html: `<div dir="rtl"><h2>تأكيد تسجيل الدخول</h2><p>رمز الدخول إلى RS Store هو:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${verificationCode}</p><p>تنتهي صلاحيته خلال 10 دقائق. إذا لم تطلب الدخول غيّر كلمة المرور فورًا.</p></div>` });
    return res.json({ twoFactorRequired: true, challengeToken, expiresIn: 600, emailHint: user.email.replace(/^(.{2}).*(@.*)$/, "$1***$2") });
  }
  res.json({ token: await createSession(user, req), user: publicUser(user) });
}));
app.post("/api/auth/2fa/verify", limiter(60_000, 10), asyncRoute(async (req, res) => {
  const challenge = await prisma.loginChallenge.findUnique({ where: { tokenHash: tokenHash(req.body.challengeToken) }, include: { user: true } });
  if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5) return res.status(400).json({ message: "Verification code expired" });
  if (codeHash(String(req.body.code || "")) !== challenge.codeHash) {
    await prisma.loginChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    return res.status(400).json({ message: "Incorrect verification code" });
  }
  if (challenge.user.status !== "active") return res.status(403).json({ message: "Account is blocked" });
  await prisma.loginChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
  res.json({ token: await createSession(challenge.user, req), user: publicUser(challenge.user) });
}));
app.post("/api/auth/google", limiter(60_000, 12), asyncRoute(async (req, res) => {
  const profile = await verifyGoogleCredential(req.body.credential);
  const email = String(profile.email).trim().toLowerCase();
  let user = await prisma.user.findFirst({ where: { OR: [{ googleId: profile.sub }, { email }] } });
  if (user?.status === "blocked") return res.status(403).json({ message: "Account is blocked" });
  if (user) {
    user = await prisma.user.update({ where: { id: user.id }, data: {
      googleId: profile.sub, emailVerified: true, avatarUrl: user.avatarUrl || profile.picture || null,
      authProvider: user.authProvider === "local" ? "local+google" : user.authProvider
    }});
  } else {
    const referral = req.body.referralCode ? await prisma.user.findUnique({ where: { affiliateCode: String(req.body.referralCode).toUpperCase() } }) : null;
    user = await prisma.user.create({ data: {
      name: String(profile.name || email.split("@")[0]).slice(0, 60), email, googleId: profile.sub,
      passwordHash: await bcrypt.hash(crypto.randomBytes(48).toString("hex"), 12), authProvider: "google",
      avatarUrl: profile.picture || null, emailVerified: true,
      walletId: `RS-${crypto.randomBytes(7).toString("hex").toUpperCase()}`,
      affiliateCode: crypto.randomBytes(5).toString("hex").toUpperCase(), referredBy: referral?.affiliateCode || null
    }});
  }
  res.json({ token: await createSession(user, req), user: publicUser(user) });
}));
app.get("/api/auth/me", auth, (req, res) => res.json(publicUser(req.user)));
app.patch("/api/auth/profile", auth, asyncRoute(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (name.length < 2 || name.length > 60) return res.status(400).json({ message: "Invalid name" });
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { name } });
  res.json(publicUser(user));
}));
app.post("/api/auth/logout", auth, asyncRoute(async (req, res) => { await prisma.authSession.update({ where: { id: req.session.id }, data: { revokedAt: new Date() } }); res.json({ loggedOut: true }); }));
app.post("/api/auth/change-password", auth, limiter(60_000, 8), asyncRoute(async (req, res) => {
  const next = String(req.body.newPassword || "");
  const current = String(req.body.currentPassword || "");
  if (next.length < 8 || !await bcrypt.compare(current, req.user.passwordHash)) return res.status(400).json({ message: "Current password is incorrect or new password is too short" });
  if (req.user.mustChangePassword && (next.length < 12 || next === current)) return res.status(400).json({ message: "New password must be at least 12 characters and different from the temporary one" });
  const hash = await bcrypt.hash(next, 12);
  await prisma.$transaction([prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: hash, mustChangePassword: false } }), prisma.authSession.updateMany({ where: { userId: req.user.id, id: { not: req.session.id }, revokedAt: null }, data: { revokedAt: new Date() } })]);
  res.json({ changed: true });
}));

app.post("/api/password/forgot", limiter(60_000, 8), asyncRoute(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const raw = String(crypto.randomInt(100000, 1000000));
    await prisma.user.update({ where: { id: user.id }, data: { resetHash: tokenHash(raw), resetExpires: new Date(Date.now() + 15 * 60_000) } });
    try { await sendEmail({ to: user.email, subject: "RS Store verification code", text: `Your RS Store password reset code is ${raw}. It expires in 15 minutes.`, html: `<p>رمز استرجاع كلمة مرور RS Store:</p><h2>${raw}</h2><p>ينتهي الرمز خلال 15 دقيقة.</p>` }); } catch (error) { console.error("Password reset email:", error.message); }
  }
  res.json({ message: "If the email exists, a reset link has been sent" });
}));
app.post("/api/password/reset", limiter(60_000, 8), asyncRoute(async (req, res) => {
  const password = String(req.body.password || "");
  if (password.length < 8) return res.status(400).json({ message: "Password is too short" });
  const user = await prisma.user.findFirst({ where: { resetHash: tokenHash(req.body.token), resetExpires: { gt: new Date() } } });
  if (!user) return res.status(400).json({ message: "Invalid or expired reset token" });
  await prisma.$transaction([prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 12), resetHash: null, resetExpires: null } }), prisma.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })]);
  res.json({ changed: true });
}));

app.get("/api/security/sessions", auth, asyncRoute(async (req, res) => {
  const rows = await prisma.authSession.findMany({ where: { userId: req.user.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } });
  res.json(plain(rows.map((x) => ({ ...x, current: x.id === req.session.id }))));
}));
app.delete("/api/security/sessions/:id", auth, asyncRoute(async (req, res) => {
  if (req.params.id === req.session.id) return res.status(409).json({ message: "Use logout for current session" });
  const result = await prisma.authSession.updateMany({ where: { id: req.params.id, userId: req.user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!result.count) return res.status(404).json({ message: "Session not found" });
  res.json({ revoked: true });
}));
app.post("/api/security/sessions/revoke-others", auth, asyncRoute(async (req, res) => {
  const result = await prisma.authSession.updateMany({ where: { userId: req.user.id, id: { not: req.session.id }, revokedAt: null }, data: { revokedAt: new Date() } });
  res.json({ revoked: result.count });
}));
app.post("/api/security/2fa/send", auth, limiter(60_000, 5), asyncRoute(async (req, res) => {
  const enable = Boolean(req.body.enabled);
  if (enable && !req.user.emailVerified) return res.status(403).json({ message: "Verify your email before enabling two-factor authentication" });
  if (enable === req.user.twoFactorEnabled) return res.status(409).json({ message: enable ? "Two-factor authentication is already enabled" : "Two-factor authentication is already disabled" });
  const code = randomCode();
  await sendEmail({ to: req.user.email, subject: enable ? "Enable RS Store 2FA" : "Disable RS Store 2FA", text: `Your security code is ${code}. It expires in 10 minutes.`, html: `<div dir="rtl"><h2>${enable ? "تفعيل" : "إيقاف"} التحقق بخطوتين</h2><p>رمز الأمان:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>تنتهي صلاحيته خلال 10 دقائق.</p></div>` });
  await prisma.user.update({ where: { id: req.user.id }, data: { emailCodeHash: codeHash(code), emailCodeExpires: new Date(Date.now() + 10 * 60_000) } });
  res.json({ sent: true, enabled: enable });
}));
app.post("/api/security/2fa", auth, limiter(60_000, 8), asyncRoute(async (req, res) => {
  const enable = Boolean(req.body.enabled);
  const fresh = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!fresh.emailCodeHash || !fresh.emailCodeExpires || fresh.emailCodeExpires <= new Date() || codeHash(String(req.body.code || "")) !== fresh.emailCodeHash) return res.status(400).json({ message: "Incorrect or expired security code" });
  if (!enable && !await bcrypt.compare(String(req.body.password || ""), fresh.passwordHash)) return res.status(401).json({ message: "Password is incorrect" });
  const user = await prisma.user.update({ where: { id: fresh.id }, data: { twoFactorEnabled: enable, emailCodeHash: null, emailCodeExpires: null } });
  if (!enable) await prisma.loginChallenge.deleteMany({ where: { userId: fresh.id } });
  res.json({ changed: true, user: publicUser(user) });
}));

app.get("/api/products", publicCache(30), asyncRoute(async (req, res) => {
  const where = { active: true, ...(req.query.category ? { categorySlug: String(req.query.category) } : {}), ...(req.query.search ? { name: { contains: String(req.query.search), mode: "insensitive" } } : {}) };
  const rows = await prisma.product.findMany({ where, include: { packages: { where: { active: true }, orderBy: { createdAt: "asc" } } }, orderBy: [{ featured: "desc" }, { name: "asc" }] });
  res.json(rows.map(productView));
}));
app.get("/api/products/:slug", publicCache(30), asyncRoute(async (req, res) => {
  const row = await prisma.product.findFirst({ where: { slug: req.params.slug, active: true }, include: { packages: { where: { active: true } } } });
  if (!row) return res.status(404).json({ message: "Product not found" });
  res.json(productView(row));
}));
app.get("/api/categories", asyncRoute(async (_req, res) => res.json(plain(await prisma.category.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] })))));
app.get("/api/offers", asyncRoute(async (_req, res) => { const now = new Date(); res.json(plain(await prisma.offer.findMany({ where: { active: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }))); }));
app.get("/api/payment-methods", asyncRoute(async (_req, res) => res.json(plain(await prisma.paymentMethod.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })))));

app.get("/api/favorites", auth, asyncRoute(async (req, res) => {
  const rows = await prisma.favorite.findMany({ where: { userId: req.user.id, product: { active: true } }, include: { product: { include: { packages: { where: { active: true } } } } }, orderBy: { createdAt: "desc" } });
  res.json(rows.map((x) => productView(x.product)));
}));
app.post("/api/favorites/:productId", auth, asyncRoute(async (req, res) => {
  if (!await prisma.product.findFirst({ where: { id: req.params.productId, active: true } })) return res.status(404).json({ message: "Product not found" });
  await prisma.favorite.upsert({ where: { userId_productId: { userId: req.user.id, productId: req.params.productId } }, update: {}, create: { userId: req.user.id, productId: req.params.productId } });
  res.status(201).json({ favorite: true, productId: req.params.productId });
}));
app.delete("/api/favorites/:productId", auth, asyncRoute(async (req, res) => { await prisma.favorite.deleteMany({ where: { userId: req.user.id, productId: req.params.productId } }); res.json({ favorite: false, productId: req.params.productId }); }));

app.get("/api/wallet", auth, (req, res) => res.json(publicUser(req.user)));
app.get("/api/wallet/", auth, (req, res) => res.json(publicUser(req.user)));
app.get("/api/wallet/deposits", auth, asyncRoute(async (req, res) => res.json(plain(await prisma.deposit.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } })))));
app.post("/api/uploads", auth, upload.single("file"), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Unsupported or missing file" });
  const filename = `${crypto.randomUUID()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80)}`;
  const storagePath = `${req.user.id}/${filename}`;
  await putPrivateObject(storagePath, req.file.buffer, req.file.mimetype);
  await prisma.uploadAsset.create({ data: { filename, storagePath, ownerId: req.user.id, sharedWith: [], originalName: req.file.originalname.slice(0, 120), mimeType: req.file.mimetype, size: req.file.size } });
  res.status(201).json({ url: `/api/files/${filename}`, name: req.file.originalname, type: req.file.mimetype, size: req.file.size });
}));
app.get("/api/files/:name", auth, asyncRoute(async (req, res) => {
  const filename = path.basename(req.params.name);
  const asset = await prisma.uploadAsset.findUnique({ where: { filename } });
  if (!asset) return res.status(404).json({ message: "File not found" });
  if (req.user.role !== "admin" && asset.ownerId !== req.user.id && !asset.sharedWith.includes(req.user.id)) return res.status(403).json({ message: "File access denied" });
  const data = await getPrivateObject(asset.storagePath);
  res.set({ "Cache-Control": "private, max-age=300", "Content-Type": asset.mimeType, "X-Content-Type-Options": "nosniff" });
  res.send(data.buffer);
}));
app.post("/api/wallet/deposits", auth, asyncRoute(async (req, res) => {
  const config = await settings();
  if (config.site?.controls?.deposits === false) return res.status(503).json({ message: "Deposits are currently disabled" });
  const currency = String(req.body.currency || "");
  const amount = Number(req.body.amount);
  const method = await prisma.paymentMethod.findFirst({ where: { slug: String(req.body.method || ""), active: true, currencies: { has: currency } } });
  const minimum = Number(method?.minimums?.[currency] || 0);
  const maximumUSD = Number(config.site?.policies?.maximumDepositUSD || 0);
  const rate = Number(config.currency?.rates?.[currency] || 1);
  const amountUSD = currency === "USD" ? amount : amount / rate;
  if (!method || !["USD", "SYP", "TRY"].includes(currency) || !Number.isFinite(amount) || amount < minimum || (maximumUSD > 0 && amountUSD > maximumUSD) || String(req.body.reference || "").trim().length < 4) return res.status(400).json({ message: "Invalid deposit data or amount limits" });
  const receiptUrl = String(req.body.receiptUrl || "");
  const filename = path.basename(receiptUrl);
  const asset = await prisma.uploadAsset.findFirst({ where: { filename, ownerId: req.user.id } });
  if (!receiptUrl.startsWith("/api/files/") || !asset) return res.status(403).json({ message: "Invalid receipt ownership" });
  const deposit = await prisma.deposit.create({ data: { userId: req.user.id, methodSlug: method.slug, currency, amount, reference: String(req.body.reference).trim(), receiptUrl, extraData: req.body.extraData || {} } });
  res.status(201).json(plain(deposit));
}));

app.get("/api/coupons/validate/:code", auth, asyncRoute(async (req, res) => {
  const subtotal = Math.max(0, Number(req.query.subtotal || 0));
  const coupon = await prisma.coupon.findUnique({ where: { code: String(req.params.code).toUpperCase() }, include: { uses: { where: { userId: req.user.id } } } });
  if (!coupon || !coupon.active || (coupon.expiresAt && coupon.expiresAt < new Date()) || (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) || subtotal < number(coupon.minOrder) || (coupon.firstOnly && coupon.uses.length)) return res.status(400).json({ message: "Invalid or expired coupon" });
  const discount = coupon.type === "percent" ? Math.min(subtotal, subtotal * number(coupon.value) / 100) : Math.min(subtotal, number(coupon.value));
  res.json({ valid: true, code: coupon.code, type: coupon.type, value: number(coupon.value), discount, minOrder: number(coupon.minOrder) });
}));

app.post("/api/orders", auth, asyncRoute(async (req, res) => {
  const config = await settings();
  if (config.site?.maintenance) return res.status(503).json({ message: config.site.maintenanceMsg || "Store is under maintenance" });
  if (config.site?.controls?.orders === false) return res.status(503).json({ message: "New orders are currently disabled" });
  const policy = config.site?.policies || {};
  if (policy.requireEmailForOrders && !req.user.emailVerified) return res.status(403).json({ message: "Email verification is required before ordering" });
  if (policy.requirePhoneForOrders && !req.user.phoneVerified) return res.status(403).json({ message: "Phone verification is required before ordering" });
  if (policy.requireIdentityForOrders && !req.user.verified) return res.status(403).json({ message: "Identity verification is required before ordering" });
  if (policy.requirePinForOrders && !req.user.pinHash) return res.status(403).json({ message: "Set a wallet PIN before ordering" });
  if (Number(policy.maximumPendingOrders || 0) > 0) {
    const pending = await prisma.order.count({ where: { userId: req.user.id, status: { in: ["pending", "payment_review", "paid", "processing"] } } });
    if (pending >= Number(policy.maximumPendingOrders)) return res.status(409).json({ message: "Maximum pending orders reached" });
  }
  const key = String(req.headers["idempotency-key"] || req.body.idempotencyKey || "").trim() || null;
  if (key) { const old = await prisma.order.findUnique({ where: { userId_idempotencyKey: { userId: req.user.id, idempotencyKey: key } }, include: { items: true } }); if (old) return res.json(plain(old)); }
  if (req.user.pinHash && !await bcrypt.compare(String(req.body.pin || ""), req.user.pinHash)) return res.status(401).json({ message: "Incorrect PIN" });
  const items = [];
  const apiConfigs = new Map();
  for (const input of req.body.items || []) {
    const pack = await prisma.productPackage.findFirst({ where: { id: String(input.packageId), productId: String(input.productId), active: true }, include: { product: true } });
    if (!pack || !pack.product.active) return res.status(400).json({ message: "Invalid product package" });
    const price = ["api", "platinum"].includes(req.user.agentLevel) ? (pack.wholesalePrice ?? pack.agentPrice ?? pack.price) : req.user.agentLevel === "gold" ? (pack.agentPrice ?? pack.retailPrice ?? pack.price) : (pack.retailPrice ?? pack.price);
    items.push({ productId: pack.productId, packageId: pack.id, name: pack.product.name, packageTitle: pack.title, price: number(price), quantity: Math.min(100, Math.max(1, Math.floor(Number(input.quantity || 1)))) });
    if (pack.deliveryType === "api" && pack.autoFulfill && pack.apiProviderId && pack.providerCode) apiConfigs.set(pack.id, { providerId: pack.apiProviderId });
  }
  if (!items.length) return res.status(400).json({ message: "Items required" });
  const subtotal = items.reduce((sum, x) => sum + x.price * x.quantity, 0);
  let coupon = null, discount = 0;
  if (req.body.couponCode) {
    coupon = await prisma.coupon.findUnique({ where: { code: String(req.body.couponCode).toUpperCase() }, include: { uses: { where: { userId: req.user.id } } } });
    if (!coupon || !coupon.active || (coupon.expiresAt && coupon.expiresAt < new Date()) || subtotal < number(coupon.minOrder) || (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) || (coupon.firstOnly && coupon.uses.length)) return res.status(400).json({ message: "Invalid coupon" });
    discount = coupon.type === "percent" ? subtotal * number(coupon.value) / 100 : number(coupon.value);
  }
  const total = Math.max(0, subtotal - discount);
  if (total < Number(config.site?.minimumOrderUSD || 0)) return res.status(400).json({ message: `Minimum order is ${config.site.minimumOrderUSD} USD` });
  if (Number(policy.maximumOrderUSD || 0) > 0 && total > Number(policy.maximumOrderUSD)) return res.status(400).json({ message: `Maximum order is ${policy.maximumOrderUSD} USD` });
  const [previousOrders, activeIpCount] = await Promise.all([
    prisma.order.count({ where: { userId: req.user.id, status: { not: "cancelled" } } }),
    prisma.authSession.findMany({ where: { userId: req.user.id, revokedAt: null, expiresAt: { gt: new Date() } }, distinct: ["ip"], select: { ip: true } }).then((rows) => rows.filter((row) => row.ip).length)
  ]);
  const riskReasons = [];
  let riskScore = 0;
  const accountAgeHours = (Date.now() - new Date(req.user.createdAt).getTime()) / 3_600_000;
  if (total >= 500) { riskScore += 45; riskReasons.push("large_order_500"); }
  else if (total >= 100) { riskScore += 25; riskReasons.push("large_order_100"); }
  if (accountAgeHours < 24) { riskScore += 30; riskReasons.push("account_under_24h"); }
  else if (accountAgeHours < 168) { riskScore += 15; riskReasons.push("account_under_7d"); }
  if (previousOrders === 0) { riskScore += 15; riskReasons.push("first_order"); }
  if (!req.user.emailVerified) { riskScore += 20; riskReasons.push("email_unverified"); }
  if (activeIpCount >= 4) { riskScore += 20; riskReasons.push("many_active_networks"); }
  riskScore = Math.min(100, riskScore);
  const riskLevel = riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low";
  const order = await prisma.$transaction(async (tx) => {
    const charged = await tx.user.updateMany({ where: { id: req.user.id, balanceUSD: { gte: total } }, data: { balanceUSD: { decrement: total } } });
    if (!charged.count) throw Object.assign(new Error("Insufficient wallet balance"), { status: 400 });
    const created = await tx.order.create({ data: { orderNumber: `RS-${Date.now().toString(36).toUpperCase()}`, idempotencyKey: key, userId: req.user.id, customerData: req.body.customerData || {}, subtotal, discount, totalAmount: total, couponCode: coupon?.code || null, status: riskLevel === "high" ? "payment_review" : "pending", riskScore, riskLevel, riskReasons, items: { create: items } }, include: { items: true } });
    await addOrderEvent(tx, created.id, created.status, "تم إنشاء الطلب", riskLevel === "high" ? "الطلب بانتظار مراجعة أمنية." : "تم استلام الطلب بنجاح.", "customer", "created", { riskLevel });
    for (const item of created.items) {
      const config = apiConfigs.get(item.packageId);
      if (config) await tx.apiFulfillment.create({ data: { orderItemId: item.id, providerId: config.providerId } });
    }
    await tx.ledger.create({ data: { userId: req.user.id, type: "order", direction: "debit", amount: total, currency: "USD", reference: created.id, note: "Order payment" } });
    if (riskLevel === "high") await tx.notification.create({ data: { userId: req.user.id, title: "Order under security review", message: `${created.orderNumber} is held temporarily for a security review.`, type: "order" } });
    if (coupon) {
      await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
      await tx.couponUse.upsert({ where: { couponId_userId: { couponId: coupon.id, userId: req.user.id } }, update: { usedAt: new Date() }, create: { couponId: coupon.id, userId: req.user.id } });
    }
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (apiConfigs.size) runInBackground(processApiFulfillments().catch((error) => console.error("API fulfillment:", error.message)));
  res.status(201).json(plain(order));
}));
app.get("/api/orders/my", auth, asyncRoute(async (req, res) => {
  const rows = await prisma.order.findMany({ where: { userId: req.user.id }, include: { items: true, events: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } });
  res.json(rows.map(customerOrderView));
}));
app.post("/api/orders/:id/reveal/request", auth, limiter(10 * 60_000, 4), asyncRoute(async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.user.id }, select: { id: true, orderNumber: true, status: true, deliveryCode: true } });
  if (!order || order.status !== "completed" || !order.deliveryCode) return res.status(404).json({ message: "Delivery code is unavailable" });
  if (!req.user.emailVerified) return res.status(403).json({ message: "Verify your email before requesting a code" });
  const code = randomCode(6), challengeToken = crypto.randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.deliveryRevealChallenge.updateMany({ where: { userId: req.user.id, orderId: order.id, consumedAt: null }, data: { consumedAt: new Date() } }),
    prisma.deliveryRevealChallenge.create({ data: { orderId: order.id, userId: req.user.id, tokenHash: tokenHash(challengeToken), codeHash: codeHash(code), expiresAt: new Date(Date.now() + 10 * 60_000) } })
  ]);
  await sendEmail({ to: req.user.email, subject: `RS Store secure code - ${order.orderNumber}`, text: `Your verification code is ${code}. It expires in 10 minutes.`, html: `<div dir="rtl"><h2>عرض كود الطلب بأمان</h2><p>رمز التحقق للطلب <strong>${order.orderNumber}</strong> هو:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>ينتهي خلال 10 دقائق. لا تشاركه مع أي شخص.</p></div>` });
  res.json({ challengeToken, expiresIn: 600, maskedEmail: req.user.email.replace(/^(.{2}).*(@.*)$/, "$1***$2") });
}));
app.post("/api/orders/:id/reveal", auth, limiter(10 * 60_000, 8), asyncRoute(async (req, res) => {
  const method = String(req.body.method || "");
  const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.user.id }, select: { id: true, orderNumber: true, status: true, deliveryCode: true } });
  if (!order || order.status !== "completed" || !order.deliveryCode) return res.status(404).json({ message: "Delivery code is unavailable" });
  if (method === "pin") {
    if (!req.user.pinHash) return res.status(400).json({ message: "Set a wallet PIN first or use email OTP" });
    if (!await bcrypt.compare(String(req.body.pin || ""), req.user.pinHash)) return res.status(401).json({ message: "Incorrect PIN" });
  } else if (method === "otp") {
    const challenge = await prisma.deliveryRevealChallenge.findUnique({ where: { tokenHash: tokenHash(String(req.body.challengeToken || "")) } });
    if (!challenge || challenge.userId !== req.user.id || challenge.orderId !== order.id || challenge.consumedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5) return res.status(400).json({ message: "Verification code expired" });
    if (challenge.codeHash !== codeHash(String(req.body.code || ""))) {
      await prisma.deliveryRevealChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      return res.status(400).json({ message: "Incorrect verification code" });
    }
    await prisma.deliveryRevealChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
  } else return res.status(400).json({ message: "Choose PIN or email OTP" });
  await prisma.orderSecretAccess.create({ data: { orderId: order.id, userId: req.user.id, method, ip: req.ip, userAgent: String(req.get("user-agent") || "").slice(0, 500) } });
  res.setHeader("Cache-Control", "no-store, private");
  res.json({ orderId: order.id, orderNumber: order.orderNumber, deliveryCode: decryptDelivery(order.deliveryCode) });
}));
app.post("/api/orders/:id/cancel", auth, asyncRoute(async (req, res) => {
  const order = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { items: true } });
    if (!existing) throw Object.assign(new Error("Order not found"), { status: 404 });
    if (existing.status !== "pending") throw Object.assign(new Error("Order cannot be cancelled"), { status: 409 });
    const changed = await tx.order.updateMany({ where: { id: existing.id, status: "pending" }, data: { status: "cancelled" } });
    if (!changed.count) throw Object.assign(new Error("Order cannot be cancelled"), { status: 409 });
    await tx.user.update({ where: { id: req.user.id }, data: { balanceUSD: { increment: existing.totalAmount } } });
    await tx.ledger.create({ data: { userId: req.user.id, type: "order_refund", direction: "credit", amount: existing.totalAmount, currency: "USD", reference: existing.id, note: "Cancelled order refund" } });
    await addOrderEvent(tx, existing.id, "cancelled", "تم إلغاء الطلب", "تمت إعادة المبلغ إلى محفظتك.", "customer");
    return { ...existing, status: "cancelled" };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json(plain(order));
}));

app.get("/api/invoices/my", auth, asyncRoute(async (req, res) => res.json(plain(await prisma.invoice.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } })))));
app.get("/api/ledger/my", auth, asyncRoute(async (req, res) => {
  const rows = await prisma.ledger.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } });
  const summary = {};
  for (const row of rows) { summary[row.currency] ||= { credit: 0, debit: 0 }; summary[row.currency][row.direction] += number(row.amount); }
  res.json({ entries: plain(rows), summary });
}));

app.get("/api/notifications/my", auth, asyncRoute(async (req, res) => res.json(plain(await prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" }, take: 100 })))));
app.patch("/api/notifications/read-all", auth, asyncRoute(async (req, res) => { const x = await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } }); res.json({ updated: x.count }); }));
app.patch("/api/notifications/:id/read", auth, asyncRoute(async (req, res) => { const x = await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { read: true } }); if (!x.count) return res.status(404).json({ message: "Notification not found" }); res.json({ read: true }); }));
app.delete("/api/notifications/:id", auth, asyncRoute(async (req, res) => { const x = await prisma.notification.deleteMany({ where: { id: req.params.id, userId: req.user.id } }); if (!x.count) return res.status(404).json({ message: "Notification not found" }); res.json({ deleted: true }); }));
app.delete("/api/notifications", auth, asyncRoute(async (req, res) => { const x = await prisma.notification.deleteMany({ where: { userId: req.user.id } }); res.json({ deleted: x.count }); }));

app.get("/api/pin/status", auth, (req, res) => res.json({ hasPin: Boolean(req.user.pinHash) }));
app.post("/api/pin/set", auth, limiter(60_000, 8), asyncRoute(async (req, res) => {
  const pin = String(req.body.pin || "");
  if (!/^\d{4,8}$/.test(pin)) return res.status(400).json({ message: "PIN must contain 4 to 8 digits" });
  if (req.user.pinHash && !await bcrypt.compare(String(req.body.currentPin || ""), req.user.pinHash)) return res.status(401).json({ message: "Current PIN is incorrect" });
  await prisma.user.update({ where: { id: req.user.id }, data: { pinHash: await bcrypt.hash(pin, 12) } });
  res.json({ changed: true });
}));

app.post("/api/phone/send", auth, limiter(60_000, 5), asyncRoute(async (req, res) => {
  const phone = String(req.body.phone || "").replace(/\s+/g, "");
  if (!/^(?:\+963|00963|0)?9\d{8}$/.test(phone)) return res.status(400).json({ message: "Invalid Syrian phone number" });
  const normalized = `+963${phone.replace(/^(?:\+963|00963|0)/, "")}`;
  const code = randomCode();
  await sendSms({ to: normalized, message: `RS Store verification code: ${code}. Valid for 10 minutes.` });
  await prisma.user.update({ where: { id: req.user.id }, data: { phone: normalized, phoneVerified: false, phoneCodeHash: tokenHash(code), phoneCodeExpires: new Date(Date.now() + 10 * 60_000), phoneAttempts: 0 } });
  res.json({ sent: true });
}));
app.post("/api/phone/verify", auth, limiter(60_000, 8), asyncRoute(async (req, res) => {
  const fresh = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!fresh.phoneCodeHash || !fresh.phoneCodeExpires || fresh.phoneCodeExpires <= new Date() || fresh.phoneAttempts >= 5) return res.status(400).json({ message: "Code expired" });
  if (tokenHash(req.body.code) !== fresh.phoneCodeHash) { await prisma.user.update({ where: { id: fresh.id }, data: { phoneAttempts: { increment: 1 } } }); return res.status(400).json({ message: "Incorrect code" }); }
  await prisma.user.update({ where: { id: fresh.id }, data: { phoneVerified: true, phoneCodeHash: null, phoneCodeExpires: null, phoneAttempts: 0 } });
  res.json({ verified: true });
}));

app.post("/api/email/send", auth, limiter(60_000, 5), asyncRoute(async (req, res) => {
  if (req.user.emailVerified) return res.json({ sent: false, alreadyVerified: true });
  const code = randomCode();
  await sendEmail({ to: req.user.email, subject: "RS Store email verification", text: `Your verification code is ${code}`, html: `<p>Your RS Store verification code is <strong>${code}</strong>. It expires in 30 minutes.</p>` });
  await prisma.user.update({ where: { id: req.user.id }, data: { emailCodeHash: tokenHash(code), emailCodeExpires: new Date(Date.now() + 30 * 60_000) } });
  res.json({ sent: true });
}));
app.post("/api/email/verify", auth, limiter(60_000, 8), asyncRoute(async (req, res) => {
  const fresh = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!fresh.emailCodeHash || !fresh.emailCodeExpires || fresh.emailCodeExpires <= new Date()) return res.status(400).json({ message: "Code expired" });
  if (tokenHash(req.body.code) !== fresh.emailCodeHash) return res.status(400).json({ message: "Incorrect code" });
  const user = await prisma.user.update({ where: { id: fresh.id }, data: { emailVerified: true, emailCodeHash: null, emailCodeExpires: null } });
  res.json({ verified: true, user: publicUser(user) });
}));

app.get("/api/affiliate/settings", auth, asyncRoute(async (_req, res) => res.json((await settings()).affiliate)));
app.get("/api/affiliate/me", auth, asyncRoute(async (req, res) => {
  const [user, config] = await Promise.all([prisma.user.findUnique({ where: { id: req.user.id } }), settings()]);
  const referredUsers = user.affiliateCode ? await prisma.user.count({ where: { referredBy: user.affiliateCode } }) : 0;
  const levels = config.affiliate?.levels || {}, sales = number(user.affiliateSales);
  const next = ["silver", "gold", "platinum", "api"].map((level) => ({ level, minSales: Number(levels[level]?.minSales || 0) })).find((x) => x.minSales > sales) || null;
  res.json({ ...publicUser(user), referredUsers, nextTarget: next ? { ...next, remaining: Math.max(0, next.minSales - sales) } : null });
}));
app.post("/api/affiliate/redeem", auth, asyncRoute(async (req, res) => {
  const points = Math.floor(Number(req.body.points || 0));
  const storeConfig = await settings();
  if (storeConfig.site?.controls?.affiliates === false) return res.status(503).json({ message: "Affiliate rewards are currently disabled" });
  const config = storeConfig.affiliate;
  if (points < Number(config.minimumRedeemPoints || 100)) return res.status(400).json({ message: "Minimum points not reached" });
  const usd = points / Number(config.pointsToDollar || 100);
  const user = await prisma.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({ where: { id: req.user.id, affiliatePoints: { gte: points } }, data: { affiliatePoints: { decrement: points }, balanceUSD: { increment: usd } } });
    if (!changed.count) throw Object.assign(new Error("Insufficient points"), { status: 400 });
    await tx.ledger.create({ data: { userId: req.user.id, type: "affiliate_redeem", direction: "credit", amount: usd, currency: "USD", note: `${points} points redeemed` } });
    return tx.user.findUnique({ where: { id: req.user.id } });
  });
  res.json({ amount: usd, user: publicUser(user) });
}));
app.get("/api/affiliate/withdrawal-methods", auth, asyncRoute(async (_req, res) => {
  const rows = await prisma.withdrawalMethod.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  res.json(plain(rows));
}));
app.get("/api/affiliate/withdrawals", auth, asyncRoute(async (req, res) => {
  const rows = await prisma.agentWithdrawal.findMany({ where: { userId: req.user.id }, include: { method: { select: { name: true, slug: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  res.json(plain(rows));
}));
app.post("/api/affiliate/withdrawals", auth, limiter(60_000, 5), asyncRoute(async (req, res) => {
  const methodId = String(req.body.methodId || ""), amount = Number(req.body.amount), payoutInput = req.body.payoutData;
  const [method, config] = await Promise.all([prisma.withdrawalMethod.findUnique({ where: { id: methodId } }), settings()]);
  if (!method?.active) return res.status(400).json({ message: "Withdrawal method is unavailable" });
  if (!Number.isFinite(amount) || amount <= 0 || amount < number(method.minAmount) || (number(method.maxAmount) > 0 && amount > number(method.maxAmount))) return res.status(400).json({ message: "Withdrawal amount is outside method limits" });
  const fields = Array.isArray(method.fields) ? method.fields : [];
  const payoutData = {};
  for (const field of fields) {
    const key = String(field?.key || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    if (!key) continue;
    const value = String(payoutInput?.[key] || "").trim().slice(0, 300);
    if (field.required !== false && !value) return res.status(400).json({ message: `Missing payout field: ${key}` });
    payoutData[key] = value;
  }
  const pointsToDollar = Math.max(1, Number(config.affiliate?.pointsToDollar || 100));
  const pointsHeld = Math.ceil(amount * pointsToDollar * 10000) / 10000;
  const feeAmount = Math.round(amount * Math.max(0, number(method.feePercent)) * 10000) / 1_000_000;
  const netAmount = amount - feeAmount;
  if (netAmount <= 0) return res.status(400).json({ message: "Withdrawal fee exceeds amount" });
  const requestNumber = `AW-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const row = await prisma.$transaction(async (tx) => {
    const pending = await tx.agentWithdrawal.count({ where: { userId: req.user.id, status: "pending" } });
    if (pending >= 3) throw Object.assign(new Error("Maximum pending withdrawal requests reached"), { status: 409 });
    const held = await tx.user.updateMany({ where: { id: req.user.id, affiliatePoints: { gte: pointsHeld } }, data: { affiliatePoints: { decrement: pointsHeld } } });
    if (!held.count) throw Object.assign(new Error("Insufficient available affiliate earnings"), { status: 400 });
    const created = await tx.agentWithdrawal.create({ data: { requestNumber, userId: req.user.id, methodId: method.id, grossAmount: amount, feeAmount, netAmount, pointsHeld, payoutData } });
    await tx.notification.create({ data: { userId: req.user.id, title: "Withdrawal submitted", message: `${requestNumber}: ${netAmount.toFixed(2)} USD after fees`, type: "balance" } });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.status(201).json(plain(row));
}));

app.get("/api/verification/me", auth, asyncRoute(async (req, res) => res.json(plain(await prisma.verification.findUnique({ where: { userId: req.user.id } })))));
app.post("/api/verification", auth, asyncRoute(async (req, res) => {
  if ((await settings()).site?.controls?.verification === false) return res.status(503).json({ message: "Identity verification requests are currently disabled" });
  const data = Object.fromEntries(["fullName", "nationalId", "birthDate", "province", "idFrontUrl", "idBackUrl", "selfieUrl"].map((key) => [key, String(req.body[key] || "").trim()]));
  if (data.fullName.length < 3 || data.nationalId.length < 4 || !data.idFrontUrl || !data.selfieUrl) return res.status(400).json({ message: "Complete verification data is required" });
  const row = await prisma.verification.upsert({ where: { userId: req.user.id }, update: { ...data, status: "pending", adminNote: null }, create: { userId: req.user.id, ...data } });
  res.status(201).json(plain(row));
}));

app.get("/api/feedback/my", auth, asyncRoute(async (req, res) => res.json(plain(await prisma.feedback.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } })))));
app.post("/api/feedback", auth, asyncRoute(async (req, res) => {
  const kind = String(req.body.kind || ""); const text = String(req.body.text || "").trim();
  if (!["complaint", "suggestion"].includes(kind) || text.length < 3 || text.length > 2000) return res.status(400).json({ message: "Invalid feedback" });
  res.status(201).json(plain(await prisma.feedback.create({ data: { userId: req.user.id, kind, text } })));
}));

app.get("/api/support/my", auth, asyncRoute(async (req, res) => res.json(plain(await prisma.ticket.findMany({ where: { userId: req.user.id }, include: { messages: { orderBy: { createdAt: "asc" } } }, orderBy: { updatedAt: "desc" } })))));
app.post("/api/support", auth, asyncRoute(async (req, res) => {
  if ((await settings()).site?.controls?.support === false) return res.status(503).json({ message: "Support tickets are currently disabled" });
  const subject = String(req.body.subject || "").trim(); const text = String(req.body.text || "").trim(); const attachments = cleanAttachments(req.body.attachments);
  if (subject.length < 3 || (!text && !attachments.length)) return res.status(400).json({ message: "Subject and message are required" });
  if (!await ownsAttachments(attachments, req.user.id)) return res.status(403).json({ message: "Invalid attachment ownership" });
  const row = await prisma.ticket.create({ data: { userId: req.user.id, subject, messages: { create: { sender: "user", text, attachments } } }, include: { messages: true } });
  res.status(201).json(plain(row));
}));
app.post("/api/support/:id/replies", auth, asyncRoute(async (req, res) => {
  const ticket = await prisma.ticket.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!ticket) return res.status(404).json({ message: "Ticket not found" });
  const text = String(req.body.text || "").trim(), attachments = cleanAttachments(req.body.attachments);
  if (!text && !attachments.length) return res.status(400).json({ message: "Message required" });
  if (!await ownsAttachments(attachments, req.user.id)) return res.status(403).json({ message: "Invalid attachment ownership" });
  await prisma.ticketMessage.create({ data: { ticketId: ticket.id, sender: "user", text, attachments } });
  await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "open" } });
  res.json(plain(await prisma.ticket.findUnique({ where: { id: ticket.id }, include: { messages: { orderBy: { createdAt: "asc" } } } })));
}));

const cleanAttachments = (items) => (Array.isArray(items) ? items : []).slice(0, 4).map((x) => ({
  url: String(x?.url || "").slice(0, 300), name: String(x?.name || "file").slice(0, 120),
  type: String(x?.type || "application/octet-stream").slice(0, 100), size: Number(x?.size || 0)
})).filter((x) => /^\/api\/files\/[a-zA-Z0-9._-]+$/.test(x.url));
const attachmentNames = (items) => items.map((x) => path.basename(x.url));
async function ownsAttachments(items, ownerId) {
  if (!items.length) return true;
  return await prisma.uploadAsset.count({ where: { filename: { in: attachmentNames(items) }, ownerId } }) === items.length;
}
async function grantAttachments(tx, items, userId) {
  for (const filename of attachmentNames(items)) {
    const asset = await tx.uploadAsset.findUnique({ where: { filename } });
    if (asset && !asset.sharedWith.includes(userId)) await tx.uploadAsset.update({ where: { filename }, data: { sharedWith: { push: userId } } });
  }
}
const chatView = (chat) => plain({ ...chat, unread: chat.messages?.filter((x) => x.sender === "admin" && x.createdAt > chat.userReadAt).length || 0 });

app.get("/api/live-chat", auth, asyncRoute(async (req, res) => {
  let chat = await prisma.liveChat.findUnique({ where: { userId: req.user.id }, include: { messages: { orderBy: { createdAt: "asc" }, take: 300 } } });
  if (!chat) chat = await prisma.liveChat.create({ data: { userId: req.user.id }, include: { messages: true } });
  res.json(chatView(chat));
}));
app.patch("/api/live-chat/read", auth, asyncRoute(async (req, res) => { await prisma.liveChat.updateMany({ where: { userId: req.user.id }, data: { userReadAt: new Date() } }); res.json({ read: true }); }));
app.post("/api/live-chat/messages", auth, limiter(60_000, 30), asyncRoute(async (req, res) => {
  if ((await settings()).site?.controls?.liveChat === false) return res.status(503).json({ message: "Live chat is currently disabled" });
  const text = String(req.body.text || "").trim(), attachments = cleanAttachments(req.body.attachments);
  if ((!text && !attachments.length) || text.length > 1000) return res.status(400).json({ message: "Message or attachment is required" });
  if (!await ownsAttachments(attachments, req.user.id)) return res.status(403).json({ message: "Invalid attachment ownership" });
  const now = new Date();
  const chat = await prisma.$transaction(async (tx) => {
    const base = await tx.liveChat.upsert({ where: { userId: req.user.id }, update: { status: "open", lastMessageAt: now }, create: { userId: req.user.id, status: "open", lastMessageAt: now } });
    await tx.liveChatMessage.create({ data: { liveChatId: base.id, sender: "user", text, attachments } });
    return tx.liveChat.findUnique({ where: { id: base.id }, include: { messages: { orderBy: { createdAt: "asc" }, take: 300 } } });
  });
  res.status(201).json(chatView(chat));
}));

async function refreshProductRating(tx, productId) {
  const aggregate = await tx.review.aggregate({ where: { productId, status: "approved" }, _avg: { rating: true }, _count: { rating: true } });
  await tx.product.update({ where: { id: productId }, data: { ratingAverage: aggregate._avg.rating || 0, ratingCount: aggregate._count.rating } });
}
app.get("/api/reviews/product/:productId", asyncRoute(async (req, res) => {
  const rows = await prisma.review.findMany({ where: { productId: req.params.productId, status: "approved" }, include: { user: { select: { id: true, name: true, verified: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  res.json(plain(rows));
}));
app.get("/api/reviews/mine/:productId", auth, asyncRoute(async (req, res) => {
  const [review, purchased] = await Promise.all([
    prisma.review.findUnique({ where: { userId_productId: { userId: req.user.id, productId: req.params.productId } } }),
    prisma.order.count({ where: { userId: req.user.id, status: "completed", items: { some: { productId: req.params.productId } } } })
  ]);
  res.json({ review: plain(review), canReview: purchased > 0 });
}));
app.post("/api/reviews/product/:productId", auth, asyncRoute(async (req, res) => {
  if ((await settings()).site?.controls?.reviews === false) return res.status(503).json({ message: "Product reviews are currently disabled" });
  const rating = Math.floor(Number(req.body.rating)), text = String(req.body.text || "").trim();
  if (rating < 1 || rating > 5 || text.length > 1000) return res.status(400).json({ message: "Invalid review" });
  const purchased = await prisma.order.count({ where: { userId: req.user.id, status: "completed", items: { some: { productId: req.params.productId } } } });
  if (!purchased) return res.status(403).json({ message: "Only verified buyers can review this product" });
  const row = await prisma.review.upsert({ where: { userId_productId: { userId: req.user.id, productId: req.params.productId } }, update: { rating, text, status: "pending", adminNote: "" }, create: { userId: req.user.id, productId: req.params.productId, rating, text } });
  res.status(201).json(plain(row));
}));

const balanceField = { USD: "balanceUSD", SYP: "balanceSYP", TRY: "balanceTRY" };
const allowedOrderStatuses = ["pending", "payment_review", "paid", "processing", "completed", "rejected", "cancelled"];
app.get("/api/pubg-sales/my", auth, asyncRoute(async (req, res) => {
  const rows = await prisma.pubgSaleRequest.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } });
  res.json(plain(rows));
}));

app.post("/api/pubg-sales", auth, limiter(60_000, 5), asyncRoute(async (req, res) => {
  const region = String(req.body.accountRegion || "").trim();
  const description = String(req.body.description || "").trim();
  const requestedPrice = Number(req.body.requestedPrice);
  const mediaUrls = [...new Set((req.body.mediaUrls || []).map((url) => String(url)))].slice(0, 8);
  const linkingMethods = [...new Set((req.body.linkingMethods || []).map((item) => String(item).trim()).filter(Boolean))].slice(0, 8);
  if (region.length < 2 || description.length < 20 || !Number.isFinite(requestedPrice) || requestedPrice <= 0 || requestedPrice > 100000 || !mediaUrls.length) return res.status(400).json({ message: "Complete the account details and attach at least one image or video" });
  const filenames = mediaUrls.map((url) => path.basename(url));
  const owned = await prisma.uploadAsset.count({ where: { filename: { in: filenames }, ownerId: req.user.id } });
  if (owned !== filenames.length || mediaUrls.some((url) => !url.startsWith("/api/files/"))) return res.status(403).json({ message: "One or more attachments are invalid" });
  const row = await prisma.pubgSaleRequest.create({ data: {
    requestNumber: "PUBG-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomInt(100, 999),
    userId: req.user.id,
    accountRegion: region,
    accountLevel: Number.isFinite(Number(req.body.accountLevel)) ? Math.max(1, Math.floor(Number(req.body.accountLevel))) : null,
    linkingMethods,
    skinsCount: Number.isFinite(Number(req.body.skinsCount)) ? Math.max(0, Math.floor(Number(req.body.skinsCount))) : null,
    upgradedWeapons: Number.isFinite(Number(req.body.upgradedWeapons)) ? Math.max(0, Math.floor(Number(req.body.upgradedWeapons))) : null,
    requestedPrice,
    description,
    mediaUrls,
    userNote: String(req.body.userNote || "").trim() || null
  } });
  await prisma.notification.create({ data: { userId: req.user.id, title: "تم استلام طلب بيع الحساب", message: "طلبك " + row.requestNumber + " قيد مراجعة الإدارة", type: "general", data: { pubgSaleId: row.id } } });
  res.status(201).json(plain(row));
}));

app.post("/api/pubg-sales/:id/accept", auth, asyncRoute(async (req, res) => {
  const changed = await prisma.pubgSaleRequest.updateMany({ where: { id: req.params.id, userId: req.user.id, status: "priced", offeredPrice: { not: null } }, data: { status: "accepted", userNote: String(req.body.note || "").trim() || null } });
  if (!changed.count) return res.status(409).json({ message: "This offer is no longer available for acceptance" });
  const row = await prisma.pubgSaleRequest.findUnique({ where: { id: req.params.id } });
  res.json(plain(row));
}));

app.post("/api/pubg-sales/:id/cancel", auth, asyncRoute(async (req, res) => {
  const changed = await prisma.pubgSaleRequest.updateMany({ where: { id: req.params.id, userId: req.user.id, status: { in: ["pending", "needs_info", "priced"] } }, data: { status: "cancelled" } });
  if (!changed.count) return res.status(409).json({ message: "This request cannot be cancelled now" });
  res.json({ cancelled: true });
}));

app.get("/api/admin/pubg-sales", auth, admin, asyncRoute(async (req, res) => {
  const allowed = ["pending", "needs_info", "priced", "accepted", "inspecting", "completed", "rejected", "cancelled"];
  const where = allowed.includes(String(req.query.status || "")) ? { status: String(req.query.status) } : {};
  const rows = await prisma.pubgSaleRequest.findMany({ where, include: { user: { select: { id: true, name: true, email: true, walletId: true } }, reviewer: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } });
  res.json(plain(rows));
}));

app.patch("/api/admin/pubg-sales/:id", auth, admin, asyncRoute(async (req, res) => {
  const status = String(req.body.status || "");
  if (!["needs_info", "priced", "inspecting", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid review status" });
  const current = await prisma.pubgSaleRequest.findUnique({ where: { id: req.params.id } });
  if (!current || ["completed", "cancelled"].includes(current.status)) return res.status(404).json({ message: "Request is unavailable" });
  const offeredPrice = status === "priced" ? Number(req.body.offeredPrice) : undefined;
  if (status === "priced" && (!Number.isFinite(offeredPrice) || offeredPrice <= 0 || offeredPrice > 100000)) return res.status(400).json({ message: "Enter a valid offer price" });
  const row = await prisma.pubgSaleRequest.update({ where: { id: current.id }, data: { status, offeredPrice: status === "priced" ? offeredPrice : current.offeredPrice, adminNote: String(req.body.adminNote || "").trim() || null, reviewerId: req.user.id } });
  const messages = { priced: "حددت الإدارة سعراً لحسابك. راجع الطلب للموافقة.", needs_info: "تحتاج الإدارة معلومات إضافية حول حسابك.", inspecting: "بدأت الإدارة فحص الحساب.", rejected: "تم رفض طلب بيع الحساب." };
  await prisma.notification.create({ data: { userId: row.userId, title: "تحديث طلب بيع PUBG", message: messages[status], type: "general", createdById: req.user.id, data: { pubgSaleId: row.id, status } } });
  await audit(req, "pubg_sale.review", row.id, { status, offeredPrice: row.offeredPrice });
  res.json(plain(row));
}));

app.post("/api/admin/pubg-sales/:id/complete", auth, admin, asyncRoute(async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.pubgSaleRequest.findUnique({ where: { id: req.params.id } });
    if (!current || !["accepted", "inspecting"].includes(current.status) || !current.offeredPrice || current.paidAt) throw Object.assign(new Error("The request is not ready for payment"), { status: 409 });
    const changed = await tx.pubgSaleRequest.updateMany({ where: { id: current.id, paidAt: null, status: { in: ["accepted", "inspecting"] } }, data: { status: "completed", paidAt: new Date(), reviewerId: req.user.id } });
    if (!changed.count) throw Object.assign(new Error("Payment was already processed"), { status: 409 });
    await tx.user.update({ where: { id: current.userId }, data: { balanceUSD: { increment: current.offeredPrice } } });
    await tx.ledger.create({ data: { userId: current.userId, type: "pubg_account_sale", direction: "credit", amount: current.offeredPrice, currency: "USD", reference: current.id, note: "PUBG account sale " + current.requestNumber } });
    await tx.notification.create({ data: { userId: current.userId, title: "تم تحويل سعر الحساب", message: "تمت إضافة " + current.offeredPrice + " USD إلى محفظتك", type: "balance", createdById: req.user.id, data: { pubgSaleId: current.id, amount: current.offeredPrice } } });
    return tx.pubgSaleRequest.findUnique({ where: { id: current.id }, include: { user: { select: { id: true, name: true, email: true, walletId: true, balanceUSD: true } } } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(req, "pubg_sale.complete", result.id, { amount: result.offeredPrice, userId: result.userId });
  res.json(plain(result));
}));

const adminIncludeOrder = { user: { select: { id: true, name: true, email: true } }, items: true, invoice: true, events: { orderBy: { createdAt: "asc" } } };

async function audit(req, action, targetId = null, metadata = null) {
  await prisma.auditLog.create({ data: {
    adminId: req.user.id, action, method: req.method, path: req.originalUrl,
    targetId, statusCode: 200, ip: req.ip,
    userAgent: String(req.headers["user-agent"] || "").slice(0, 500), metadata
  } });
}
const invoiceNumber = (prefix = "INV") => `${prefix}-${Date.now()}-${crypto.randomInt(1000, 9999)}`;

app.get("/api/admin/stats", auth, admin, asyncRoute(async (_req, res) => {
  const now = new Date();
  const startToday = new Date(now); startToday.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000);
  const fourteenDaysAgo = new Date(now.getTime() - 13 * 86400_000); fourteenDaysAgo.setUTCHours(0, 0, 0, 0);
  const completedWhere = { status: "completed" };
  const [usersTotal, usersNew7, usersBlocked, balances, orderTotal, orderPending, oldestPending,
    allCompleted, completed30, recent, pendingDeposits, approvedDeposits, verificationPending,
    supportOpen, feedbackPending, reviewsPending, products, availableCodes] = await Promise.all([
    prisma.user.count(), prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { status: "blocked" } }),
    prisma.user.aggregate({ _sum: { balanceUSD: true, balanceSYP: true, balanceTRY: true } }),
    prisma.order.count(), prisma.order.count({ where: { status: { in: ["pending", "payment_review", "paid", "processing"] } } }),
    prisma.order.findFirst({ where: { status: { in: ["pending", "payment_review", "paid", "processing"] } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.order.findMany({ where: completedWhere, select: { totalAmount: true, discount: true, createdAt: true, items: true } }),
    prisma.order.findMany({ where: { ...completedWhere, createdAt: { gte: thirtyDaysAgo } }, select: { totalAmount: true, createdAt: true, items: true } }),
    prisma.order.findMany({ include: adminIncludeOrder, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.deposit.count({ where: { status: "pending" } }),
    prisma.deposit.groupBy({ by: ["currency"], where: { status: "approved" }, _sum: { amount: true } }),
    prisma.verification.count({ where: { status: "pending" } }), prisma.ticket.count({ where: { status: "open" } }),
    prisma.feedback.count({ where: { status: "pending" } }),
    prisma.review.count({ where: { status: "pending" } }),
    prisma.product.findMany({ include: { packages: true } }),
    prisma.digitalCode.groupBy({ by: ["packageId"], where: { status: "available" }, _count: { _all: true } })
  ]);
  const revenue = allCompleted.reduce((sum, x) => sum + number(x.totalAmount), 0);
  const discounts = allCompleted.reduce((sum, x) => sum + number(x.discount), 0);
  const salesToday = allCompleted.filter((x) => x.createdAt >= startToday).reduce((sum, x) => sum + number(x.totalAmount), 0);
  const sales30 = completed30.reduce((sum, x) => sum + number(x.totalAmount), 0);
  const byDay = new Map();
  const top = new Map(); const categories = new Map();
  for (const order of allCompleted) for (const item of order.items) {
    const row = top.get(item.productId || item.name) || { _id: item.productId || item.name, name: item.name, total: 0, count: 0 };
    row.total += number(item.price) * item.quantity; row.count += item.quantity; top.set(row._id, row);
  }
  for (const order of completed30.filter((x) => x.createdAt >= fourteenDaysAgo)) {
    const key = order.createdAt.toISOString().slice(0, 10), row = byDay.get(key) || { _id: key, total: 0, count: 0 };
    row.total += number(order.totalAmount); row.count += 1; byDay.set(key, row);
  }
  const productCategory = new Map(products.map((x) => [x.id, x.categorySlug || "other"]));
  for (const order of allCompleted) for (const item of order.items) {
    const key = productCategory.get(item.productId) || "other";
    categories.set(key, (categories.get(key) || 0) + number(item.price) * item.quantity);
  }
  const codeCounts = new Map(availableCodes.map((x) => [x.packageId, x._count._all]));
  const lowStock = products.flatMap((p) => p.packages.filter((x) => x.deliveryType === "code").map((x) => ({ productId: p.id, packageId: x.id, product: p.name, package: x.title, available: codeCounts.get(x.id) || 0, threshold: x.lowStockThreshold }))).filter((x) => x.available <= x.threshold);
  res.json(plain({
    users: { total: usersTotal, new7: usersNew7, blocked: usersBlocked, balances: { USD: balances._sum.balanceUSD, SYP: balances._sum.balanceSYP, TRY: balances._sum.balanceTRY } },
    orders: { total: orderTotal, pending: orderPending, completed: allCompleted.length, oldestPending: oldestPending?.createdAt || null, revenue, discounts, average: allCompleted.length ? revenue / allCompleted.length : 0, salesToday, sales30, series: [...byDay.values()], topProducts: [...top.values()].sort((a, b) => b.total - a.total).slice(0, 8), recent },
    deposits: { pending: pendingDeposits, approved: Object.fromEntries(approvedDeposits.map((x) => [x.currency, number(x._sum.amount)])) },
    verification: { pending: verificationPending }, support: { open: supportOpen }, feedback: { pending: feedbackPending }, reviews: { pending: reviewsPending },
    products: { total: products.length, lowStock }, categories: [...categories].map(([_id, total]) => ({ _id, total }))
  }));
}));

app.get("/api/admin/audit-logs", auth, admin, asyncRoute(async (req, res) => {
  const take = Math.min(100, Math.max(1, Number(req.query.limit || 50))), page = Math.max(1, Number(req.query.page || 1));
  const action = String(req.query.action || "all"), search = String(req.query.search || "").trim();
  const where = { ...(action !== "all" ? { action } : {}), ...(search ? { OR: [{ action: { contains: search, mode: "insensitive" } }, { targetId: { contains: search, mode: "insensitive" } }, { path: { contains: search, mode: "insensitive" } }, { admin: { is: { name: { contains: search, mode: "insensitive" } } } }] } : {}) };
  const [items, total] = await Promise.all([prisma.auditLog.findMany({ where, include: { admin: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }), prisma.auditLog.count({ where })]);
  res.json({ items: plain(items), total, page, pages: Math.ceil(total / take) });
}));

app.get("/api/admin/users", auth, admin, asyncRoute(async (req, res) => {
  const q = String(req.query.search || "").trim();
  const rows = await prisma.user.findMany({ where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { affiliateCode: { contains: q, mode: "insensitive" } }] } : {}, orderBy: { createdAt: "desc" } });
  res.json(rows.map(publicUser));
}));
app.patch("/api/admin/users/:id/status", auth, admin, asyncRoute(async (req, res) => {
  const status = String(req.body.status || ""); if (!["active", "blocked"].includes(status)) return res.status(400).json({ message: "Invalid status" });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status } });
  if (status === "blocked") await prisma.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit(req, "user.status", user.id, { status }); res.json(publicUser(user));
}));
app.patch("/api/admin/users/:id/agent-level", auth, admin, asyncRoute(async (req, res) => {
  const agentLevel = String(req.body.agentLevel || ""); if (!["silver", "gold", "platinum", "api"].includes(agentLevel)) return res.status(400).json({ message: "Invalid agent level" });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { agentLevel } });
  await audit(req, "user.agent_level", user.id, { agentLevel }); res.json(publicUser(user));
}));
app.patch("/api/admin/users/:id/agent-commission", auth, admin, asyncRoute(async (req, res) => {
  const raw = req.body.rate;
  const rate = raw === null || raw === "" ? null : Number(raw);
  if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) return res.status(400).json({ message: "Commission rate must be between 0 and 100" });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { agentCommissionRate: rate } });
  await audit(req, "user.agent_commission", user.id, { rate }); res.json(publicUser(user));
}));
app.get("/api/admin/users/:id/ledger", auth, admin, asyncRoute(async (req, res) => {
  const [entries, orders, deposits] = await Promise.all([prisma.ledger.findMany({ where: { userId: req.params.id }, orderBy: { createdAt: "desc" }, take: 100 }), prisma.order.count({ where: { userId: req.params.id } }), prisma.deposit.count({ where: { userId: req.params.id } })]);
  res.json(plain({ entries, orders, deposits }));
}));
app.post("/api/admin/users/:id/balance", auth, admin, asyncRoute(async (req, res) => {
  const currency = String(req.body.currency || ""), amount = Number(req.body.amount), note = String(req.body.note || "").trim(), field = balanceField[currency];
  if (!field || !Number.isFinite(amount) || amount === 0 || note.length < 3) return res.status(400).json({ message: "Invalid balance adjustment" });
  const user = await prisma.$transaction(async (tx) => {
    const where = { id: req.params.id, ...(amount < 0 ? { [field]: { gte: Math.abs(amount) } } : {}) };
    const changed = await tx.user.updateMany({ where, data: { [field]: { increment: amount } } });
    if (!changed.count) throw Object.assign(new Error("User not found or insufficient balance"), { status: 400 });
    await tx.ledger.create({ data: { userId: req.params.id, type: "admin_adjustment", direction: amount > 0 ? "credit" : "debit", amount: Math.abs(amount), currency, note } });
    await tx.notification.create({ data: { userId: req.params.id, title: amount > 0 ? "Balance credited" : "Balance debited", message: `${Math.abs(amount)} ${currency}. ${note}`, type: "balance", createdById: req.user.id } });
    return tx.user.findUnique({ where: { id: req.params.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(req, "user.balance", user.id, { currency, amount, note }); res.json(publicUser(user));
}));
app.post("/api/admin/users/:id/reset-password", auth, admin, asyncRoute(async (req, res) => {
  const temporaryPassword = crypto.randomBytes(12).toString("base64url");
  await prisma.$transaction([prisma.user.update({ where: { id: req.params.id }, data: { passwordHash: await bcrypt.hash(temporaryPassword, 12) } }), prisma.authSession.updateMany({ where: { userId: req.params.id, revokedAt: null }, data: { revokedAt: new Date() } })]);
  await audit(req, "user.reset_password", req.params.id); res.json({ temporaryPassword });
}));
app.post("/api/admin/users/:id/revoke-sessions", auth, admin, asyncRoute(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(409).json({ message: "Use logout to close the current admin session" });
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!user) return res.status(404).json({ message: "User not found" });
  const result = await prisma.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit(req, "user.sessions.revoke", user.id, { sessions: result.count });
  res.json({ revoked: result.count });
}));

app.patch("/api/admin/settings", auth, admin, asyncRoute(async (req, res) => {
  const current = await settings(), data = {};
  for (const key of ["site", "contact", "currency", "affiliate"]) if (req.body[key] && typeof req.body[key] === "object") data[key] = { ...(current[key] || {}), ...req.body[key] };
  if (data.currency) {
    data.currency.rates = { ...(current.currency?.rates || {}), ...(req.body.currency.rates || {}), USD: 1 };
    if (!(Number(data.currency.rates.SYP) > 0) || !(Number(data.currency.rates.TRY) > 0) || !["USD", "SYP", "TRY"].includes(data.currency.selected)) return res.status(400).json({ message: "Invalid currency settings" });
  }
  if (data.site) {
    const controlKeys = ["registration", "orders", "deposits", "support", "reviews", "verification", "affiliates", "liveChat"];
    const policySwitches = ["requireEmailForOrders", "requirePhoneForOrders", "requireIdentityForOrders", "requirePinForOrders"];
    const policyNumbers = ["maximumOrderUSD", "maximumDepositUSD", "maximumPendingOrders"];
    if ("menu" in req.body.site) data.site.menu = cleanMenu(req.body.site.menu);
    if (req.body.site.controls) data.site.controls = Object.fromEntries(controlKeys.map((key) => [key, req.body.site.controls[key] !== false]));
    if (req.body.site.policies) {
      data.site.policies = { ...(current.site?.policies || {}) };
      for (const key of policySwitches) data.site.policies[key] = Boolean(req.body.site.policies[key]);
      for (const key of policyNumbers) {
        const value = Number(req.body.site.policies[key] || 0);
        if (!Number.isFinite(value) || value < 0) return res.status(400).json({ message: "Invalid store policy limits" });
        data.site.policies[key] = key === "maximumPendingOrders" ? Math.floor(value) : value;
      }
    }
  }
  const row = await prisma.storeSettings.update({ where: { key: "main" }, data });
  await audit(req, "settings.update", row.id, { keys: Object.keys(data) }); res.json(plain(row));
}));

app.get("/api/admin/categories", auth, admin, asyncRoute(async (_req, res) => res.json(plain(await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] })))));
app.post("/api/admin/categories", auth, admin, asyncRoute(async (req, res) => {
  const slug = String(req.body.slug || "").trim().toLowerCase(), label = String(req.body.label || "").trim();
  if (!/^[a-z0-9-]{2,30}$/.test(slug) || label.length < 2) return res.status(400).json({ message: "Invalid category" });
  const row = await prisma.category.create({ data: { slug, label, sortOrder: Number(req.body.order ?? req.body.sortOrder ?? 0), active: req.body.active !== false } });
  await audit(req, "category.create", row.id); res.status(201).json(plain({ ...row, order: row.sortOrder }));
}));
app.patch("/api/admin/categories/:id", auth, admin, asyncRoute(async (req, res) => {
  const data = {}; if (req.body.label !== undefined) data.label = String(req.body.label).trim(); if (req.body.active !== undefined) data.active = Boolean(req.body.active); if (req.body.order !== undefined || req.body.sortOrder !== undefined) data.sortOrder = Number(req.body.order ?? req.body.sortOrder);
  const row = await prisma.category.update({ where: { id: req.params.id }, data }); await audit(req, "category.update", row.id); res.json(plain({ ...row, order: row.sortOrder }));
}));

app.get("/api/v1/reseller/products", resellerAuth, requireApiScope("products:read"), asyncRoute(async (req, res) => {
  const products = await prisma.product.findMany({ where: { active: true }, include: { packages: { where: { active: true }, orderBy: { createdAt: "asc" } } }, orderBy: { name: "asc" } });
  res.json({ success: true, data: products.map((product) => ({ id: product.id, name: product.name, category: product.categorySlug, packages: product.packages.map((pack) => ({ id: pack.id, name: pack.title, price: number(resellerPrice(req.user, pack)), currency: "USD", delivery: pack.deliveryType })) })) });
}));
app.get("/api/v1/reseller/balance", resellerAuth, requireApiScope("balance:read"), (req, res) => {
  res.json({ success: true, data: { walletId: req.user.walletId, balance: number(req.user.balanceUSD), currency: "USD", level: req.user.agentLevel } });
});
app.post("/api/v1/reseller/orders", resellerAuth, requireApiScope("orders:write"), asyncRoute(async (req, res) => {
  const reference = String(req.body.reference || "").trim();
  const packageId = String(req.body.packageId || "");
  const playerId = String(req.body.playerId || "").trim();
  const zoneId = String(req.body.zoneId || "").trim();
  const rawQuantity = Number(req.body.quantity ?? 1);
  const quantity = Number.isFinite(rawQuantity) ? Math.min(100, Math.max(1, Math.floor(rawQuantity))) : 0;
  if (!/^[a-zA-Z0-9_-]{4,80}$/.test(reference) || playerId.length < 2 || !packageId || quantity < 1) return res.status(400).json({ success: false, error: { code: "INVALID_REQUEST", message: "reference, packageId, playerId and a valid quantity are required" } });
  const idempotencyKey = "reseller:" + req.apiClient.id + ":" + reference;
  const previous = await prisma.order.findUnique({ where: { userId_idempotencyKey: { userId: req.user.id, idempotencyKey } }, include: { items: { include: { fulfillment: true } } } });
  if (previous) return res.json({ success: true, repeated: true, data: plain(previous) });
  const pack = await prisma.productPackage.findFirst({ where: { id: packageId, active: true, product: { active: true } }, include: { product: true } });
  if (!pack) return res.status(404).json({ success: false, error: { code: "PACKAGE_NOT_FOUND", message: "Active package not found" } });
  const unitPrice = number(resellerPrice(req.user, pack));
  const total = unitPrice * quantity;
  const order = await prisma.$transaction(async (tx) => {
    const charged = await tx.user.updateMany({ where: { id: req.user.id, balanceUSD: { gte: total } }, data: { balanceUSD: { decrement: total } } });
    if (!charged.count) throw Object.assign(new Error("Insufficient reseller balance"), { status: 400, apiCode: "INSUFFICIENT_BALANCE" });
    const created = await tx.order.create({ data: { orderNumber: "API-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomInt(100, 999), idempotencyKey, userId: req.user.id, apiClientId: req.apiClient.id, customerData: { playerId, zoneId: zoneId || null, resellerReference: reference, source: "reseller_api" }, subtotal: total, totalAmount: total, status: "paid", items: { create: [{ productId: pack.productId, packageId: pack.id, name: pack.product.name, packageTitle: pack.title, price: unitPrice, quantity }] } }, include: { items: true } });
    if (pack.deliveryType === "api" && pack.autoFulfill && pack.apiProviderId && pack.providerCode) await tx.apiFulfillment.create({ data: { orderItemId: created.items[0].id, providerId: pack.apiProviderId } });
    await tx.ledger.create({ data: { userId: req.user.id, type: "reseller_api_order", direction: "debit", amount: total, currency: "USD", reference: created.id, note: "API order " + reference } });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  runInBackground(processApiFulfillments().catch((error) => console.error("Reseller API fulfillment:", error.message)));
  res.status(201).json({ success: true, data: { orderId: order.id, orderNumber: order.orderNumber, reference, status: order.status, amount: total, currency: "USD" } });
}));
app.get("/api/v1/reseller/orders", resellerAuth, requireApiScope("orders:read"), asyncRoute(async (req, res) => {
  const requestedLimit = Number(req.query.limit || 50);
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.floor(requestedLimit))) : 50;
  const rows = await prisma.order.findMany({ where: { apiClientId: req.apiClient.id }, include: { items: { include: { fulfillment: true } } }, orderBy: { createdAt: "desc" }, take: limit });
  res.json({ success: true, data: plain(rows.map((row) => ({ orderNumber: row.orderNumber, reference: row.customerData?.resellerReference, status: row.status, amount: row.totalAmount, currency: row.currency, items: row.items, createdAt: row.createdAt }))) });
}));
app.get("/api/v1/reseller/orders/:reference", resellerAuth, requireApiScope("orders:read"), asyncRoute(async (req, res) => {
  const reference = String(req.params.reference || "");
  const row = await prisma.order.findFirst({ where: { apiClientId: req.apiClient.id, OR: [{ orderNumber: reference }, { idempotencyKey: "reseller:" + req.apiClient.id + ":" + reference }] }, include: { items: { include: { fulfillment: true } } } });
  if (!row) return res.status(404).json({ success: false, error: { code: "ORDER_NOT_FOUND", message: "Order not found" } });
  res.json({ success: true, data: plain({ orderNumber: row.orderNumber, reference: row.customerData?.resellerReference, status: row.status, amount: row.totalAmount, currency: row.currency, items: row.items, createdAt: row.createdAt, updatedAt: row.updatedAt }) });
}));
app.get("/api/v1/reseller/docs", (_req, res) => res.json({ name: "RS Store Reseller API", version: "v1", authentication: { header: "X-API-Key", note: "Keep the key secret and send it only over HTTPS" }, endpoints: [{ method: "GET", path: "/api/v1/reseller/products", scope: "products:read" }, { method: "GET", path: "/api/v1/reseller/balance", scope: "balance:read" }, { method: "POST", path: "/api/v1/reseller/orders", scope: "orders:write", body: { reference: "unique-001", packageId: "package-id", playerId: "123456789", zoneId: "optional", quantity: 1 } }, { method: "GET", path: "/api/v1/reseller/orders/{reference}", scope: "orders:read" }] }));

const apiClientPublic = (client) => plain({ ...client, keyHash: undefined });
app.get("/api/admin/reseller-api/clients", auth, admin, asyncRoute(async (_req, res) => {
  const rows = await prisma.apiClient.findMany({ include: { user: { select: { id: true, name: true, email: true, walletId: true, agentLevel: true, balanceUSD: true } }, _count: { select: { orders: true, requestLogs: true } } }, orderBy: { createdAt: "desc" } });
  res.json(rows.map(apiClientPublic));
}));
app.post("/api/admin/reseller-api/clients", auth, admin, asyncRoute(async (req, res) => {
  const userId = String(req.body.userId || "");
  const name = String(req.body.name || "").trim();
  const user = await prisma.user.findFirst({ where: { id: userId, status: "active" } });
  if (!user || name.length < 2) return res.status(400).json({ message: "Select an active user and enter a client name" });
  const keyPrefix = "rs_live_" + crypto.randomBytes(5).toString("hex");
  const rawKey = keyPrefix + "." + crypto.randomBytes(24).toString("base64url");
  const scopesAllowed = ["products:read", "balance:read", "orders:write", "orders:read"];
  const scopes = (req.body.scopes || scopesAllowed).filter((x) => scopesAllowed.includes(x));
  const allowedIps = [...new Set((req.body.allowedIps || []).map((x) => cleanIp(x).trim()).filter(Boolean))].slice(0, 20);
  const requestedRate = Number(req.body.requestsPerMinute || 60);
  const requestsPerMinute = Number.isFinite(requestedRate) ? Math.min(600, Math.max(5, Math.floor(requestedRate))) : 60;
  const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
  const row = await prisma.apiClient.create({ data: { userId, name, keyPrefix, keyHash: resellerKeyHash(rawKey), scopes, allowedIps, requestsPerMinute, expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null } });
  await audit(req, "reseller_api.client.create", row.id, { userId, name, keyPrefix });
  res.status(201).json({ client: apiClientPublic(row), apiKey: rawKey, warning: "This API key is shown only once" });
}));
app.patch("/api/admin/reseller-api/clients/:id", auth, admin, asyncRoute(async (req, res) => {
  const current = await prisma.apiClient.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ message: "API client not found" });
  const data = {};
  if (req.body.name !== undefined) data.name = String(req.body.name).trim();
  if (req.body.active !== undefined) data.active = Boolean(req.body.active);
  if (req.body.requestsPerMinute !== undefined) {
    const requestedRate = Number(req.body.requestsPerMinute);
    if (!Number.isFinite(requestedRate)) return res.status(400).json({ message: "Invalid request rate" });
    data.requestsPerMinute = Math.min(600, Math.max(5, Math.floor(requestedRate)));
  }
  if (req.body.allowedIps !== undefined) data.allowedIps = [...new Set((req.body.allowedIps || []).map((x) => cleanIp(x).trim()).filter(Boolean))].slice(0, 20);
  if (req.body.expiresAt !== undefined) {
    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) return res.status(400).json({ message: "Invalid expiration date" });
    data.expiresAt = expiresAt;
  }
  const row = await prisma.apiClient.update({ where: { id: current.id }, data });
  await audit(req, "reseller_api.client.update", row.id, { active: row.active });
  res.json(apiClientPublic(row));
}));
app.post("/api/admin/reseller-api/clients/:id/regenerate", auth, admin, asyncRoute(async (req, res) => {
  const current = await prisma.apiClient.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ message: "API client not found" });
  const keyPrefix = "rs_live_" + crypto.randomBytes(5).toString("hex");
  const rawKey = keyPrefix + "." + crypto.randomBytes(24).toString("base64url");
  const row = await prisma.apiClient.update({ where: { id: current.id }, data: { keyPrefix, keyHash: resellerKeyHash(rawKey), active: true } });
  await audit(req, "reseller_api.client.regenerate", row.id, { keyPrefix });
  res.json({ client: apiClientPublic(row), apiKey: rawKey, warning: "The previous key stopped working. This key is shown only once." });
}));
app.get("/api/admin/reseller-api/logs", auth, admin, asyncRoute(async (req, res) => {
  const rows = await prisma.apiRequestLog.findMany({ where: req.query.clientId ? { apiClientId: String(req.query.clientId) } : {}, include: { apiClient: { select: { id: true, name: true, keyPrefix: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
  res.json(plain(rows));
}));

const apiProviderData = (body, current = null) => {
  const name = String(body.name ?? current?.name ?? "").trim();
  const baseUrl = String(body.baseUrl ?? current?.baseUrl ?? "").trim();
  const orderPath = String(body.orderPath ?? current?.orderPath ?? "").trim();
  const statusPath = String(body.statusPath ?? current?.statusPath ?? "").trim() || null;
  const httpMethod = String(body.httpMethod ?? current?.httpMethod ?? "POST").toUpperCase();
  const authType = String(body.authType ?? current?.authType ?? "bearer");
  const authName = String(body.authName ?? current?.authName ?? "").trim() || null;
  const requestTemplate = body.requestTemplate ?? current?.requestTemplate ?? {};
  const externalIdPath = String(body.externalIdPath ?? current?.externalIdPath ?? "order_id").trim();
  const statusResponsePath = String(body.statusResponsePath ?? current?.statusResponsePath ?? "status").trim();
  const successValues = (body.successValues ?? current?.successValues ?? ["completed", "success"]).map((x) => String(x).trim()).filter(Boolean);
  const pendingValues = (body.pendingValues ?? current?.pendingValues ?? ["pending", "processing"]).map((x) => String(x).trim()).filter(Boolean);
  const timeoutMs = Math.min(30000, Math.max(3000, Number(body.timeoutMs ?? current?.timeoutMs ?? 15000)));
  const priority = Math.min(10000, Math.max(1, Math.floor(Number(body.priority ?? current?.priority ?? 100))));
  const maxRetries = Math.min(10, Math.max(1, Math.floor(Number(body.maxRetries ?? current?.maxRetries ?? 2))));
  if (name.length < 2 || !orderPath || !Number.isFinite(priority) || !Number.isFinite(maxRetries) || !["POST", "PUT"].includes(httpMethod) || !["none", "bearer", "header", "query"].includes(authType) || !requestTemplate || typeof requestTemplate !== "object" || Array.isArray(requestTemplate)) throw Object.assign(new Error("Invalid API provider configuration"), { status: 400 });
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== "https:") throw Object.assign(new Error("Provider base URL must use HTTPS"), { status: 400 });
  safeProviderUrl({ baseUrl }, orderPath);
  if (statusPath) safeProviderUrl({ baseUrl }, statusPath.replace("{externalOrderId}", "test"));
  return { name, baseUrl: parsed.origin + parsed.pathname.replace(/\/$/, ""), orderPath, statusPath, httpMethod, authType, authName, requestTemplate, externalIdPath, statusResponsePath, successValues, pendingValues, timeoutMs, priority, maxRetries, active: body.active ?? current?.active ?? true };
};

app.get("/api/admin/api-providers", auth, admin, asyncRoute(async (_req, res) => {
  const rows = await prisma.apiProvider.findMany({ include: { _count: { select: { packages: true, fulfillments: true } } }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
  res.json(rows.map(providerPublic));
}));
app.post("/api/admin/api-providers", auth, admin, asyncRoute(async (req, res) => {
  const data = apiProviderData(req.body);
  const apiKey = String(req.body.apiKey || "");
  if (data.authType !== "none" && apiKey.length < 4) return res.status(400).json({ message: "API key is required" });
  const encrypted = encryptCode(apiKey || "none");
  const row = await prisma.apiProvider.create({ data: { ...data, keyCipherText: encrypted.cipherText, keyIv: encrypted.iv, keyAuthTag: encrypted.authTag } });
  await audit(req, "api_provider.create", row.id, { name: row.name });
  res.status(201).json(providerPublic(row));
}));
app.patch("/api/admin/api-providers/:id", auth, admin, asyncRoute(async (req, res) => {
  const current = await prisma.apiProvider.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ message: "API provider not found" });
  const data = apiProviderData(req.body, current);
  const apiKey = String(req.body.apiKey || "");
  if (apiKey) {
    const encrypted = encryptCode(apiKey);
    Object.assign(data, { keyCipherText: encrypted.cipherText, keyIv: encrypted.iv, keyAuthTag: encrypted.authTag });
  }
  const row = await prisma.apiProvider.update({ where: { id: current.id }, data });
  await audit(req, "api_provider.update", row.id, { name: row.name, active: row.active });
  res.json(providerPublic(row));
}));
app.delete("/api/admin/api-providers/:id", auth, admin, asyncRoute(async (req, res) => {
  const row = await prisma.apiProvider.update({ where: { id: req.params.id }, data: { active: false } });
  await audit(req, "api_provider.disable", row.id);
  res.json({ disabled: true });
}));
app.get("/api/admin/api-fulfillments", auth, admin, asyncRoute(async (req, res) => {
  const allowed = ["queued", "sending", "processing", "completed", "failed", "cancelled"];
  const where = allowed.includes(String(req.query.status || "")) ? { status: String(req.query.status) } : {};
  const rows = await prisma.apiFulfillment.findMany({ where, include: { provider: { select: { id: true, name: true } }, orderItem: { include: { order: { select: { id: true, orderNumber: true, customerData: true, status: true } } } } }, orderBy: { createdAt: "desc" }, take: 500 });
  res.json(plain(rows));
}));
app.post("/api/admin/api-fulfillments/:id/retry", auth, admin, asyncRoute(async (req, res) => {
  const changed = await prisma.apiFulfillment.updateMany({ where: { id: req.params.id, status: "failed" }, data: { status: "queued", attempts: 0, failedProviderIds: [], lastError: null, nextCheckAt: null } });
  if (!changed.count) return res.status(409).json({ message: "Only failed requests can be retried" });
  runInBackground(processApiFulfillments().catch((error) => console.error("API fulfillment retry:", error.message)));
  await audit(req, "api_fulfillment.retry", req.params.id);
  res.json({ queued: true });
}));
app.patch("/api/admin/products/:productId/packages/:packageId/api", auth, admin, asyncRoute(async (req, res) => {
  const enabled = req.body.enabled === true;
  const providerId = enabled ? String(req.body.providerId || "") : null;
  const providerCode = enabled ? String(req.body.providerCode || "").trim() : null;
  if (enabled) {
    if (!providerCode) return res.status(400).json({ message: "Provider product code is required" });
    const provider = await prisma.apiProvider.findFirst({ where: { id: providerId, active: true } });
    if (!provider) return res.status(404).json({ message: "Active API provider not found" });
  }
  const changed = await prisma.productPackage.updateMany({ where: { id: req.params.packageId, productId: req.params.productId }, data: { deliveryType: enabled ? "api" : "manual", apiProviderId: providerId, providerCode, autoFulfill: enabled } });
  if (!changed.count) return res.status(404).json({ message: "Product package not found" });
  const row = await prisma.productPackage.findUnique({ where: { id: req.params.packageId } });
  await audit(req, "package.api_mapping", row.id, { enabled, providerId, providerCode });
  res.json(plain(row));
}));

const normalizePackages = (packages = []) => packages.map((p) => ({ title: String(p.title || "").trim(), price: Number(p.price), retailPrice: p.retailPrice == null ? null : Number(p.retailPrice), agentPrice: p.agentPrice == null ? null : Number(p.agentPrice), wholesalePrice: p.wholesalePrice == null ? null : Number(p.wholesalePrice), deliveryType: ["manual", "code", "api"].includes(p.deliveryType) ? p.deliveryType : "manual", apiProviderId: p.deliveryType === "api" && p.apiProviderId ? String(p.apiProviderId) : null, providerCode: p.deliveryType === "api" ? String(p.providerCode || "").trim() || null : null, autoFulfill: p.deliveryType === "api" && p.autoFulfill === true, active: p.active !== false }));
app.get("/api/admin/products", auth, admin, asyncRoute(async (_req, res) => { const rows = await prisma.product.findMany({ include: { packages: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } }); res.json(rows.map(productView)); }));
app.post("/api/admin/products", auth, admin, asyncRoute(async (req, res) => {
  const name = String(req.body.name || "").trim(), slug = String(req.body.slug || "").trim().toLowerCase(), packages = normalizePackages(req.body.packages);
  if (name.length < 2 || !/^[a-z0-9-]{2,60}$/.test(slug) || !packages.length || packages.some((x) => !x.title || !(x.price > 0))) return res.status(400).json({ message: "Invalid product" });
  const row = await prisma.product.create({ data: { name, slug, categorySlug: req.body.category || null, description: String(req.body.description || ""), image: String(req.body.image || ""), featured: Boolean(req.body.featured), active: req.body.active !== false, packages: { create: packages } }, include: { packages: true } });
  await audit(req, "product.create", row.id); res.status(201).json(productView(row));
}));
app.patch("/api/admin/products/:id", auth, admin, asyncRoute(async (req, res) => {
  const scalar = {}; const map = { name: "name", slug: "slug", category: "categorySlug", description: "description", image: "image", featured: "featured", active: "active" };
  for (const [input, field] of Object.entries(map)) if (req.body[input] !== undefined) scalar[field] = req.body[input];
  if (scalar.slug) scalar.slug = String(scalar.slug).trim().toLowerCase();
  const row = await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: req.params.id }, data: scalar });
    if (Array.isArray(req.body.packages)) {
      const incoming = normalizePackages(req.body.packages);
      await tx.productPackage.updateMany({ where: { productId: req.params.id }, data: { active: false } });
      for (let i = 0; i < incoming.length; i++) {
        const original = req.body.packages[i], data = { ...incoming[i], active: original.active !== false };
        if (original.id || original._id) await tx.productPackage.update({ where: { id: original.id || original._id }, data });
        else await tx.productPackage.create({ data: { productId: req.params.id, ...data } });
      }
    }
    return tx.product.findUnique({ where: { id: req.params.id }, include: { packages: { orderBy: { createdAt: "asc" } } } });
  });
  await audit(req, "product.update", row.id); res.json(productView(row));
}));
app.delete("/api/admin/products/:id", auth, admin, asyncRoute(async (req, res) => { const row = await prisma.product.update({ where: { id: req.params.id }, data: { active: false } }); await audit(req, "product.disable", row.id); res.json({ deleted: true, product: productView({ ...row, packages: [] }) }); }));

app.get("/api/admin/deposits", auth, admin, asyncRoute(async (_req, res) => { const rows = await prisma.deposit.findMany({ include: { user: { select: { id: true, name: true, email: true } }, method: true, invoice: true }, orderBy: { createdAt: "desc" } }); res.json(plain(rows.map((x) => ({ ...x, method: x.methodSlug })))); }));
app.patch("/api/admin/deposits/:id", auth, admin, asyncRoute(async (req, res) => {
  const status = String(req.body.status || ""); if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid deposit status" });
  const deposit = await prisma.$transaction(async (tx) => {
    const current = await tx.deposit.findUnique({ where: { id: req.params.id } });
    if (!current || current.status !== "pending") throw Object.assign(new Error("Deposit was already reviewed"), { status: 409 });
    const changed = await tx.deposit.updateMany({ where: { id: current.id, status: "pending" }, data: { status, adminNote: String(req.body.adminNote || "") } });
    if (!changed.count) throw Object.assign(new Error("Deposit was already reviewed"), { status: 409 });
    if (status === "approved") {
      await tx.user.update({ where: { id: current.userId }, data: { [balanceField[current.currency]]: { increment: current.amount } } });
      await tx.ledger.create({ data: { userId: current.userId, type: "deposit", direction: "credit", amount: current.amount, currency: current.currency, reference: current.id, note: `Deposit ${current.reference}` } });
      const requested = Boolean(current.extraData && typeof current.extraData === "object" && current.extraData.invoiceRequested);
      if (requested || req.body.createInvoice) await tx.invoice.create({ data: { invoiceNumber: invoiceNumber("DEP"), userId: current.userId, type: "deposit", depositId: current.id, amount: current.amount, currency: current.currency, status: "paid", items: [{ description: `Deposit ${current.reference}`, amount: number(current.amount) }] } });
    }
    await tx.notification.create({ data: { userId: current.userId, title: status === "approved" ? "Deposit approved" : "Deposit rejected", message: status === "approved" ? `Your balance was credited with ${current.amount} ${current.currency}` : String(req.body.adminNote || "Deposit rejected"), type: "deposit", createdById: req.user.id } });
    return tx.deposit.findUnique({ where: { id: current.id }, include: { user: { select: { id: true, name: true, email: true } }, invoice: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(req, `deposit.${status}`, deposit.id);
  try { await sendEmail({ to: deposit.user.email, subject: status === "approved" ? "RS Store deposit approved" : "RS Store deposit rejected", text: status === "approved" ? `Your deposit ${deposit.reference} was approved. ${deposit.amount} ${deposit.currency} was added to your balance.` : `Your deposit ${deposit.reference} was rejected. ${deposit.adminNote || "Please contact support."}`, html: `<div dir="rtl"><h2>${status === "approved" ? "تم قبول الإيداع" : "تم رفض الإيداع"}</h2><p>المرجع: <b>${deposit.reference}</b></p><p>${status === "approved" ? `تمت إضافة ${deposit.amount} ${deposit.currency} إلى رصيدك.` : (deposit.adminNote || "يرجى التواصل مع الدعم.")}</p></div>` }); } catch (error) { console.error("Deposit notification email:", error.message); }
  res.json({ deposit: plain({ ...deposit, method: deposit.methodSlug }) });
}));

app.get("/api/admin/orders", auth, admin, asyncRoute(async (req, res) => { const rows = await prisma.order.findMany({ where: req.query.status ? { status: String(req.query.status) } : {}, include: adminIncludeOrder, orderBy: { createdAt: "desc" } }); res.json(rows.map(adminOrderView)); }));
app.patch("/api/admin/orders/:id/status", auth, admin, asyncRoute(async (req, res) => {
  const status = String(req.body.status || ""); if (!["pending", "payment_review", "paid", "processing"].includes(status)) return res.status(400).json({ message: "Invalid status transition" });
  const order = await prisma.order.update({ where: { id: req.params.id }, data: { status }, include: adminIncludeOrder });
  await addOrderEvent(prisma, order.id, status, "تم تحديث حالة الطلب", String(req.body.note || `الحالة الجديدة: ${status}`), "admin");
  await prisma.notification.create({ data: { userId: order.userId, title: "Order status updated", message: `${order.orderNumber}: ${status}`, type: "order", createdById: req.user.id } });
  await audit(req, "order.status", order.id, { status });
  if (["paid", "processing"].includes(status)) runInBackground(processApiFulfillments().catch((error) => console.error("API fulfillment release:", error.message)));
  res.json(adminOrderView(order));
}));
app.post("/api/admin/orders/:id/cancel", auth, admin, asyncRoute(async (req, res) => {
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: req.params.id } });
    if (!current || !["pending", "payment_review", "paid", "processing"].includes(current.status)) throw Object.assign(new Error("Order cannot be cancelled"), { status: 409 });
    const changed = await tx.order.updateMany({ where: { id: current.id, status: { in: ["pending", "payment_review", "paid", "processing"] } }, data: { status: "cancelled", deliveryCode: String(req.body.reason || "") } });
    if (!changed.count) throw Object.assign(new Error("Order cannot be cancelled"), { status: 409 });
    await tx.user.update({ where: { id: current.userId }, data: { [balanceField[current.currency]]: { increment: current.totalAmount } } });
    await tx.ledger.create({ data: { userId: current.userId, type: "order_refund", direction: "credit", amount: current.totalAmount, currency: current.currency, reference: current.id, note: "Order cancelled by admin" } });
    await tx.notification.create({ data: { userId: current.userId, title: "Order cancelled", message: `${current.orderNumber} refunded`, type: "order", createdById: req.user.id } });
    await addOrderEvent(tx, current.id, "cancelled", "ألغت الإدارة الطلب", String(req.body.reason || "تمت إعادة المبلغ إلى المحفظة."), "admin");
    return tx.order.findUnique({ where: { id: current.id }, include: adminIncludeOrder });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(req, "order.cancel", order.id);
  try { await sendEmail({ to: order.user.email, subject: "RS Store order cancelled", text: `Order ${order.orderNumber} was cancelled and ${order.totalAmount} ${order.currency} was returned to your balance.`, html: `<div dir="rtl"><h2>تم إلغاء الطلب</h2><p>رقم الطلب: ${order.orderNumber}</p><p>تمت إعادة المبلغ إلى رصيدك.</p></div>` }); } catch (error) { console.error("Order cancellation email:", error.message); }
  res.json(plain(order));
}));
app.post("/api/admin/orders/:id/complete", auth, admin, asyncRoute(async (req, res) => {
  const affiliateConfig = (await settings()).affiliate || {};
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: req.params.id }, include: { items: true, invoice: true, user: { select: { referredBy: true } } } });
    if (!current || !["pending", "payment_review", "paid", "processing"].includes(current.status)) throw Object.assign(new Error("Order cannot be completed"), { status: 409 });
    const delivered = [];
    if (String(req.body.deliveryCode || "").trim()) delivered.push(String(req.body.deliveryCode).trim());
    for (const item of current.items) {
      if (!item.packageId) continue;
      const pack = await tx.productPackage.findUnique({ where: { id: item.packageId } });
      if (pack?.deliveryType !== "code") continue;
      const codes = await tx.digitalCode.findMany({ where: { productId: item.productId || undefined, packageId: item.packageId, status: "available" }, orderBy: { createdAt: "asc" }, take: item.quantity });
      if (codes.length < item.quantity) throw Object.assign(new Error(`Insufficient digital code stock for ${item.packageTitle}`), { status: 409 });
      for (const code of codes) {
        const changed = await tx.digitalCode.updateMany({ where: { id: code.id, status: "available" }, data: { status: "sold", soldOrderId: current.id, soldAt: new Date(), reservedOrderId: null, reservedAt: null } });
        if (!changed.count) throw Object.assign(new Error("Digital code stock changed; retry completion"), { status: 409 });
        delivered.push(`${item.name} — ${item.packageTitle}\n${decryptCode(code)}`);
      }
    }
    await tx.order.update({ where: { id: current.id }, data: { status: "completed", deliveryCode: encryptDelivery(delivered.join("\n\n")) } });
    await addOrderEvent(tx, current.id, "completed", "اكتمل الطلب", "تم تسليم الطلب بنجاح.", "admin");
    for (const item of current.items) if (item.productId) await tx.product.update({ where: { id: item.productId }, data: { purchaseCount: { increment: item.quantity } } });
    if (current.user.referredBy) {
      const referrer = await tx.user.findUnique({ where: { affiliateCode: current.user.referredBy } });
      if (referrer?.status === "active" && referrer.id !== current.userId) {
        const sale = number(current.totalAmount);
        const pointsToDollar = Math.max(1, Number(affiliateConfig.pointsToDollar || 100));
        const points = referrer.agentCommissionRate == null
          ? sale * Math.max(0, Number(affiliateConfig.pointsPerDollar || 0))
          : sale * Math.max(0, number(referrer.agentCommissionRate)) / 100 * pointsToDollar;
        const nextSales = number(referrer.affiliateSales) + sale;
        const levels = affiliateConfig.levels || {};
        const nextLevel = ["silver", "gold", "platinum", "api"].filter((level) => nextSales >= Number(levels[level]?.minSales || 0)).at(-1) || "silver";
        await tx.user.update({ where: { id: referrer.id }, data: { affiliateSales: { increment: sale }, affiliateOrders: { increment: 1 }, affiliatePoints: { increment: points }, agentLevel: nextLevel } });
        await tx.notification.create({ data: { userId: referrer.id, title: "Affiliate reward", message: `You earned ${points} points from a completed referral order`, type: "balance", createdById: req.user.id, data: { orderId: current.id, points, sale, agentLevel: nextLevel } } });
      }
    }
    if (!current.invoice) await tx.invoice.create({ data: { invoiceNumber: invoiceNumber("ORD"), userId: current.userId, type: "order", orderId: current.id, amount: current.totalAmount, currency: current.currency, status: "paid", items: current.items.map((x) => ({ name: x.name, packageTitle: x.packageTitle, price: number(x.price), quantity: x.quantity })) } });
    await tx.notification.create({ data: { userId: current.userId, title: "Order completed", message: `${current.orderNumber} completed`, type: "order", createdById: req.user.id } });
    return tx.order.findUnique({ where: { id: current.id }, include: adminIncludeOrder });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await monitorLowStock(order.items.filter((item) => item.packageId).map((item) => item.packageId));
  await audit(req, "order.complete", order.id);
  try { await sendEmail({ to: order.user.email, subject: "RS Store order completed", text: `Order ${order.orderNumber} has been completed.`, html: `<div dir="rtl"><h2>اكتمل طلبك</h2><p>رقم الطلب: ${order.orderNumber}</p><p>يمكنك مراجعة تفاصيل التسليم من حسابك.</p></div>` }); } catch (error) { console.error("Order completion email:", error.message); }
  res.json({ order: adminOrderView(order) });
}));

app.get("/api/admin/payment-methods", auth, admin, asyncRoute(async (_req, res) => { const rows = await prisma.paymentMethod.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }); res.json(plain(rows.map((x) => ({ ...x, order: x.sortOrder })))); }));
const paymentData = (body, partial = false) => {
  const data = {};
  const strings = ["name", "account", "hint", "appIcon", "walletImage"];
  for (const key of strings) if (!partial || body[key] !== undefined) data[key] = String(body[key] || "").trim();
  if (!partial || body.currencies !== undefined) data.currencies = Array.isArray(body.currencies) ? body.currencies.filter((x) => ["USD", "SYP", "TRY"].includes(x)) : [];
  if (!partial || body.minimums !== undefined) data.minimums = body.minimums && typeof body.minimums === "object" ? body.minimums : {};
  if (!partial || body.extraFields !== undefined) data.extraFields = Array.isArray(body.extraFields) ? body.extraFields : [];
  if (body.active !== undefined) data.active = Boolean(body.active);
  if (body.order !== undefined || body.sortOrder !== undefined) data.sortOrder = Number(body.order ?? body.sortOrder);
  return data;
};
app.post("/api/admin/payment-methods", auth, admin, asyncRoute(async (req, res) => {
  const slug = String(req.body.slug || "").trim().toLowerCase(), data = paymentData(req.body);
  if (!/^[a-z0-9-]{2,30}$/.test(slug) || data.name.length < 2 || data.account.length < 3 || !data.currencies.length) return res.status(400).json({ message: "Invalid payment method" });
  const row = await prisma.paymentMethod.create({ data: { slug, ...data } }); await audit(req, "payment_method.create", row.id); res.status(201).json(plain({ ...row, order: row.sortOrder }));
}));
app.patch("/api/admin/payment-methods/:id", auth, admin, asyncRoute(async (req, res) => { const row = await prisma.paymentMethod.update({ where: { id: req.params.id }, data: paymentData(req.body, true) }); await audit(req, "payment_method.update", row.id); res.json(plain({ ...row, order: row.sortOrder })); }));
app.delete("/api/admin/payment-methods/:id", auth, admin, asyncRoute(async (req, res) => { const row = await prisma.paymentMethod.update({ where: { id: req.params.id }, data: { active: false } }); await audit(req, "payment_method.disable", row.id); res.json({ deleted: true }); }));

app.get("/api/admin/offers", auth, admin, asyncRoute(async (_req, res) => { const rows = await prisma.offer.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }); res.json(plain(rows.map((x) => ({ ...x, order: x.sortOrder })))); }));
const offerData = (body) => {
  const data = {};
  for (const key of ["title", "text", "code", "badge", "image", "link"]) if (body[key] !== undefined) data[key] = String(body[key] || "").trim();
  if (data.code) data.code = data.code.toUpperCase();
  if (body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (body.active !== undefined) data.active = Boolean(body.active);
  if (body.order !== undefined || body.sortOrder !== undefined) data.sortOrder = Number(body.order ?? body.sortOrder);
  return data;
};
app.post("/api/admin/offers", auth, admin, asyncRoute(async (req, res) => { const data = offerData(req.body); if (!data.title || data.title.length < 3 || (data.startsAt && data.endsAt && data.endsAt <= data.startsAt)) return res.status(400).json({ message: "Invalid offer" }); const row = await prisma.offer.create({ data }); await audit(req, "offer.create", row.id); res.status(201).json(plain({ ...row, order: row.sortOrder })); }));
app.patch("/api/admin/offers/:id", auth, admin, asyncRoute(async (req, res) => { const data = offerData(req.body); if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) return res.status(400).json({ message: "Invalid offer dates" }); const row = await prisma.offer.update({ where: { id: req.params.id }, data }); await audit(req, "offer.update", row.id); res.json(plain({ ...row, order: row.sortOrder })); }));
app.delete("/api/admin/offers/:id", auth, admin, asyncRoute(async (req, res) => { await prisma.offer.delete({ where: { id: req.params.id } }); await audit(req, "offer.delete", req.params.id); res.json({ deleted: true }); }));

app.get("/api/admin/coupons", auth, admin, asyncRoute(async (_req, res) => res.json(plain(await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } })))));
const couponData = (body) => {
  const data = {};
  if (body.code !== undefined) data.code = String(body.code).trim().toUpperCase();
  if (body.type !== undefined) data.type = String(body.type);
  for (const key of ["value", "minOrder"]) if (body[key] !== undefined) data[key] = Number(body[key]);
  if (body.maxUses !== undefined) data.maxUses = Math.max(0, Math.floor(Number(body.maxUses)));
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  for (const key of ["firstOnly", "active"]) if (body[key] !== undefined) data[key] = Boolean(body[key]);
  return data;
};
const validCoupon = (data, fallbackType = "percent") => (!data.code || /^[A-Z0-9_-]{3,20}$/.test(data.code)) && (!data.type || ["percent", "fixed"].includes(data.type)) && (data.value === undefined || (data.value > 0 && ((data.type || fallbackType) !== "percent" || data.value <= 100))) && (data.minOrder === undefined || data.minOrder >= 0);
app.post("/api/admin/coupons", auth, admin, asyncRoute(async (req, res) => { const data = couponData(req.body); if (!data.code || data.value === undefined || !validCoupon(data)) return res.status(400).json({ message: "Invalid coupon" }); const row = await prisma.coupon.create({ data: { type: "percent", minOrder: 0, maxUses: 0, firstOnly: false, active: true, ...data } }); await audit(req, "coupon.create", row.id); res.status(201).json(plain(row)); }));
app.patch("/api/admin/coupons/:id", auth, admin, asyncRoute(async (req, res) => { const current = await prisma.coupon.findUnique({ where: { id: req.params.id } }); if (!current) return res.status(404).json({ message: "Coupon not found" }); const data = couponData(req.body); if (!validCoupon(data, current.type)) return res.status(400).json({ message: "Invalid coupon" }); const row = await prisma.coupon.update({ where: { id: current.id }, data }); await audit(req, "coupon.update", row.id); res.json(plain(row)); }));
app.delete("/api/admin/coupons/:id", auth, admin, asyncRoute(async (req, res) => { await prisma.coupon.delete({ where: { id: req.params.id } }); await audit(req, "coupon.delete", req.params.id); res.json({ deleted: true }); }));

const uploadPublicImage = async (req, res, auditAction) => {
  if (!req.file) return res.status(400).json({ message: "Unsupported or missing image" });
  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
  const storagePath = `${crypto.randomUUID()}-${safeName}`;
  const publicUrl = await putPublicObject(storagePath, req.file.buffer, req.file.mimetype);
  await audit(req, auditAction, storagePath, { mimeType: req.file.mimetype, size: req.file.size });
  res.status(201).json({ url: publicUrl });
};
app.post("/api/admin/product-image", auth, admin, publicImageUpload.single("file"), asyncRoute(async (req, res) => uploadPublicImage(req, res, "asset.upload")));
app.post("/api/admin/site-logo", auth, admin, publicImageUpload.single("file"), asyncRoute(async (req, res) => uploadPublicImage(req, res, "site_logo.upload")));

app.get("/api/admin/codes", auth, admin, asyncRoute(async (req, res) => {
  runInBackground(monitorLowStock().catch((error) => console.error("Inventory monitor on admin view:", error.message)));
  const where = { ...(req.query.productId ? { productId: String(req.query.productId) } : {}), ...(req.query.packageId ? { packageId: String(req.query.packageId) } : {}), ...(["available", "reserved", "sold", "disabled"].includes(req.query.status) ? { status: req.query.status } : {}) };
  const summaryWhere = { ...where }; delete summaryWhere.status;
  const [items, grouped] = await Promise.all([
    prisma.digitalCode.findMany({ where, include: { product: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.digitalCode.groupBy({ by: ["status"], where: summaryWhere, _count: { _all: true } })
  ]);
  res.json({ items: plain(items.map(({ cipherText: _a, iv: _b, authTag: _c, codeHash: _d, ...item }) => item)), summary: Object.fromEntries(grouped.map((x) => [x.status, x._count._all])) });
}));
app.post("/api/admin/codes/import", auth, admin, asyncRoute(async (req, res) => {
  const productId = String(req.body.productId || ""), packageId = String(req.body.packageId || "");
  const pack = await prisma.productPackage.findFirst({ where: { id: packageId, productId }, include: { product: true } });
  if (!pack) return res.status(404).json({ message: "Product package not found" });
  const input = Array.isArray(req.body.codes) ? req.body.codes : String(req.body.codes || "").split(/\r?\n/);
  const unique = [...new Set(input.map((x) => String(x).trim()).filter((x) => x.length >= 3 && x.length <= 500))].slice(0, 1000);
  if (!unique.length) return res.status(400).json({ message: "No valid codes supplied" });
  const hashes = unique.map(codeHash), existing = new Set((await prisma.digitalCode.findMany({ where: { codeHash: { in: hashes } }, select: { codeHash: true } })).map((x) => x.codeHash));
  const data = unique.map((value, index) => ({ value, hash: hashes[index] })).filter((x) => !existing.has(x.hash)).map(({ value, hash }) => ({ productId, packageId, packageTitle: pack.title, codeHash: hash, ...encryptCode(value), preview: `••••${value.slice(-4)}`, createdById: req.user.id }));
  if (data.length) await prisma.digitalCode.createMany({ data, skipDuplicates: true });
  await monitorLowStock([packageId]);
  await audit(req, "codes.import", packageId, { imported: data.length, duplicates: unique.length - data.length });
  res.status(201).json({ imported: data.length, duplicates: unique.length - data.length, ignored: Math.max(0, input.length - unique.length) });
}));
app.patch("/api/admin/products/:id/packages/:packageId/delivery", auth, admin, asyncRoute(async (req, res) => {
  const deliveryType = String(req.body.deliveryType || ""); if (!["manual", "code"].includes(deliveryType)) return res.status(400).json({ message: "Invalid delivery type" });
  const changed = await prisma.productPackage.updateMany({ where: { id: req.params.packageId, productId: req.params.id }, data: { deliveryType } }); if (!changed.count) return res.status(404).json({ message: "Product package not found" });
  const product = await prisma.product.findUnique({ where: { id: req.params.id }, include: { packages: { orderBy: { createdAt: "asc" } } } }); await audit(req, "package.delivery", req.params.packageId, { deliveryType }); res.json(productView(product));
}));
app.patch("/api/admin/products/:id/packages/:packageId/stock-settings", auth, admin, asyncRoute(async (req, res) => {
  const threshold = Math.max(0, Math.min(100000, Math.floor(Number(req.body.lowStockThreshold))));
  if (!Number.isFinite(threshold)) return res.status(400).json({ message: "Invalid stock threshold" });
  const changed = await prisma.productPackage.updateMany({ where: { id: req.params.packageId, productId: req.params.id }, data: { lowStockThreshold: threshold, lowStockAlertedAt: null } });
  if (!changed.count) return res.status(404).json({ message: "Product package not found" });
  await monitorLowStock([req.params.packageId]);
  const pack = await prisma.productPackage.findUnique({ where: { id: req.params.packageId } });
  await audit(req, "package.stock_threshold", pack.id, { threshold });
  res.json(plain(pack));
}));
app.delete("/api/admin/codes/:id", auth, admin, asyncRoute(async (req, res) => {
  const item = await prisma.digitalCode.findUnique({ where: { id: req.params.id }, select: { packageId: true, status: true } });
  if (!item || item.status !== "available") return res.status(409).json({ message: "Only available codes can be disabled" });
  const changed = await prisma.digitalCode.updateMany({ where: { id: req.params.id, status: "available" }, data: { status: "disabled" } });
  if (!changed.count) return res.status(409).json({ message: "Stock changed; refresh and retry" });
  await monitorLowStock([item.packageId]);
  await audit(req, "code.disable", req.params.id); res.json({ disabled: true });
}));

app.get("/api/admin/verifications", auth, admin, asyncRoute(async (_req, res) => { const rows = await prisma.verification.findMany({ include: { user: { select: { id: true, name: true, email: true, walletId: true } } }, orderBy: { createdAt: "desc" } }); res.json(plain(rows)); }));
app.patch("/api/admin/verifications/:id", auth, admin, asyncRoute(async (req, res) => {
  const status = String(req.body.status || ""); if (!["pending", "approved", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid status" });
  const row = await prisma.$transaction(async (tx) => {
    const verification = await tx.verification.update({ where: { id: req.params.id }, data: { status, adminNote: String(req.body.adminNote || "").slice(0, 500) }, include: { user: { select: { id: true, name: true, email: true, walletId: true } } } });
    await tx.user.update({ where: { id: verification.userId }, data: { verified: status === "approved" } });
    if (status !== "pending") await tx.notification.create({ data: { userId: verification.userId, title: status === "approved" ? "Account verified" : "Verification rejected", message: status === "approved" ? "Your account verification was approved" : (String(req.body.adminNote || "Verification was rejected")), type: "verification", createdById: req.user.id } });
    return verification;
  });
  await audit(req, `verification.${status}`, row.id); res.json(plain(row));
}));

app.get("/api/admin/support", auth, admin, asyncRoute(async (_req, res) => { const rows = await prisma.ticket.findMany({ include: { user: { select: { id: true, name: true, email: true, walletId: true } }, messages: { orderBy: { createdAt: "asc" } } }, orderBy: { updatedAt: "desc" } }); res.json(plain(rows)); }));
app.post("/api/admin/support/:id/replies", auth, admin, asyncRoute(async (req, res) => {
  const text = String(req.body.text || "").trim(), attachments = cleanAttachments(req.body.attachments);
  if ((!text && !attachments.length) || text.length > 2000) return res.status(400).json({ message: "Message or attachment is required" });
  if (!await ownsAttachments(attachments, req.user.id)) return res.status(403).json({ message: "Invalid attachment ownership" });
  const ticket = await prisma.$transaction(async (tx) => {
    const current = await tx.ticket.findUnique({ where: { id: req.params.id } }); if (!current) throw Object.assign(new Error("Ticket not found"), { status: 404 });
    await tx.ticketMessage.create({ data: { ticketId: current.id, sender: "admin", text, attachments } });
    await tx.ticket.update({ where: { id: current.id }, data: { status: "answered" } });
    await grantAttachments(tx, attachments, current.userId);
    await tx.notification.create({ data: { userId: current.userId, title: "Support replied", message: `A reply was added to: ${current.subject}`, type: "support", createdById: req.user.id } });
    return tx.ticket.findUnique({ where: { id: current.id }, include: { user: { select: { id: true, name: true, email: true, walletId: true } }, messages: { orderBy: { createdAt: "asc" } } } });
  });
  await audit(req, "support.reply", ticket.id); res.json(plain(ticket));
}));
app.patch("/api/admin/support/:id/status", auth, admin, asyncRoute(async (req, res) => { const status = String(req.body.status || ""); if (!["open", "answered", "closed"].includes(status)) return res.status(400).json({ message: "Invalid ticket status" }); const row = await prisma.ticket.update({ where: { id: req.params.id }, data: { status }, include: { messages: { orderBy: { createdAt: "asc" } } } }); await audit(req, "support.status", row.id, { status }); res.json(plain(row)); }));

app.get("/api/admin/live-chats/unread-count", auth, admin, asyncRoute(async (_req, res) => { const chats = await prisma.liveChat.findMany({ select: { adminReadAt: true, messages: { where: { sender: "user" }, select: { createdAt: true } } } }); res.json({ unread: chats.reduce((sum, chat) => sum + chat.messages.filter((x) => x.createdAt > chat.adminReadAt).length, 0) }); }));
app.get("/api/admin/live-chats", auth, admin, asyncRoute(async (_req, res) => {
  const chats = await prisma.liveChat.findMany({ include: { user: { select: { id: true, name: true, email: true, walletId: true, verified: true } }, messages: { orderBy: { createdAt: "asc" }, take: 300 } }, orderBy: { lastMessageAt: "desc" }, take: 300 });
  res.json(plain(chats.map((chat) => ({ ...chat, unread: chat.messages.filter((x) => x.sender === "user" && x.createdAt > chat.adminReadAt).length }))));
}));
app.patch("/api/admin/live-chats/:id/read", auth, admin, asyncRoute(async (req, res) => { const changed = await prisma.liveChat.updateMany({ where: { id: req.params.id }, data: { adminReadAt: new Date() } }); if (!changed.count) return res.status(404).json({ message: "Chat not found" }); res.json({ read: true }); }));
app.post("/api/admin/live-chats/:id/messages", auth, admin, limiter(60_000, 60), asyncRoute(async (req, res) => {
  const text = String(req.body.text || "").trim(), attachments = cleanAttachments(req.body.attachments);
  if ((!text && !attachments.length) || text.length > 1000) return res.status(400).json({ message: "Message or attachment is required" });
  if (!await ownsAttachments(attachments, req.user.id)) return res.status(403).json({ message: "Invalid attachment ownership" });
  const chat = await prisma.$transaction(async (tx) => {
    const current = await tx.liveChat.findUnique({ where: { id: req.params.id } }); if (!current) throw Object.assign(new Error("Chat not found"), { status: 404 });
    const now = new Date(); await tx.liveChatMessage.create({ data: { liveChatId: current.id, sender: "admin", text, attachments } });
    await tx.liveChat.update({ where: { id: current.id }, data: { status: "open", lastMessageAt: now, adminReadAt: now } });
    await grantAttachments(tx, attachments, current.userId);
    await tx.notification.create({ data: { userId: current.userId, title: "New support message", message: "You received a new live-chat reply", type: "support", createdById: req.user.id } });
    return tx.liveChat.findUnique({ where: { id: current.id }, include: { user: { select: { id: true, name: true, email: true, walletId: true, verified: true } }, messages: { orderBy: { createdAt: "asc" }, take: 300 } } });
  });
  await audit(req, "live_chat.reply", chat.id); res.json(plain({ ...chat, unread: 0 }));
}));
app.patch("/api/admin/live-chats/:id/status", auth, admin, asyncRoute(async (req, res) => { const status = String(req.body.status || ""); if (!["open", "closed"].includes(status)) return res.status(400).json({ message: "Invalid chat status" }); const row = await prisma.liveChat.update({ where: { id: req.params.id }, data: { status }, include: { user: { select: { id: true, name: true, email: true, walletId: true, verified: true } }, messages: { orderBy: { createdAt: "asc" }, take: 300 } } }); await audit(req, "live_chat.status", row.id, { status }); res.json(plain({ ...row, unread: row.messages.filter((x) => x.sender === "user" && x.createdAt > row.adminReadAt).length })); }));

app.get("/api/admin/feedback", auth, admin, asyncRoute(async (req, res) => { const where = ["pending", "answered", "closed"].includes(req.query.status) ? { status: req.query.status } : {}; const rows = await prisma.feedback.findMany({ where, include: { user: { select: { id: true, name: true, email: true, walletId: true } }, repliedBy: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 500 }); res.json(plain(rows)); }));
app.post("/api/admin/feedback/:id/reply", auth, admin, asyncRoute(async (req, res) => { const reply = String(req.body.reply || "").trim(); if (reply.length < 2 || reply.length > 2000) return res.status(400).json({ message: "Invalid reply" }); const row = await prisma.feedback.update({ where: { id: req.params.id }, data: { reply, status: "answered", repliedById: req.user.id, repliedAt: new Date() }, include: { user: { select: { id: true, name: true, email: true, walletId: true } }, repliedBy: { select: { id: true, name: true, email: true } } } }); await prisma.notification.create({ data: { userId: row.userId, title: "Feedback reply", message: "The administration replied to your message", type: "support", createdById: req.user.id } }); await audit(req, "feedback.reply", row.id); res.json(plain(row)); }));
app.patch("/api/admin/feedback/:id/status", auth, admin, asyncRoute(async (req, res) => { const status = String(req.body.status || ""); if (!["pending", "answered", "closed"].includes(status)) return res.status(400).json({ message: "Invalid status" }); const row = await prisma.feedback.update({ where: { id: req.params.id }, data: { status }, include: { user: { select: { id: true, name: true, email: true, walletId: true } } } }); await audit(req, "feedback.status", row.id, { status }); res.json(plain(row)); }));

app.get("/api/admin/reviews", auth, admin, asyncRoute(async (req, res) => { const where = ["pending", "approved", "rejected"].includes(req.query.status) ? { status: req.query.status } : {}; const rows = await prisma.review.findMany({ where, include: { user: { select: { id: true, name: true, email: true, walletId: true, verified: true } }, product: { select: { id: true, name: true, slug: true, image: true } } }, orderBy: { createdAt: "desc" }, take: 500 }); res.json(plain(rows)); }));
app.patch("/api/admin/reviews/:id/status", auth, admin, asyncRoute(async (req, res) => {
  const status = String(req.body.status || ""); if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid review status" });
  const row = await prisma.$transaction(async (tx) => { const review = await tx.review.update({ where: { id: req.params.id }, data: { status, adminNote: String(req.body.adminNote || "").slice(0, 500) }, include: { user: { select: { id: true, name: true, email: true, walletId: true, verified: true } }, product: { select: { id: true, name: true, slug: true, image: true } } } }); await refreshProductRating(tx, review.productId); await tx.notification.create({ data: { userId: review.userId, title: status === "approved" ? "Review approved" : "Review rejected", message: `${review.product.name}: ${status}`, type: "general", createdById: req.user.id } }); return review; });
  await audit(req, `review.${status}`, row.id); res.json(plain(row));
}));

app.get("/api/admin/notifications", auth, admin, asyncRoute(async (_req, res) => {
  const rows = await prisma.notification.findMany({ where: { campaignId: { not: null } }, orderBy: { createdAt: "desc" }, take: 3000 });
  const campaigns = new Map(); for (const row of rows) { const current = campaigns.get(row.campaignId) || { id: row.campaignId, _id: row.campaignId, title: row.title, message: row.message, type: row.type, audience: row.audience, createdAt: row.createdAt, recipients: 0, readCount: 0 }; current.recipients += 1; if (row.read) current.readCount += 1; campaigns.set(row.campaignId, current); }
  res.json(plain([...campaigns.values()].slice(0, 30)));
}));
app.post("/api/admin/notifications", auth, admin, asyncRoute(async (req, res) => {
  const title = String(req.body.title || "").trim(), message = String(req.body.message || "").trim(), type = ["general", "order", "deposit", "balance", "verification", "support"].includes(req.body.type) ? req.body.type : "general", audience = req.body.audience === "user" ? "user" : "all";
  if (title.length < 3 || title.length > 100 || message.length < 3 || message.length > 1000) return res.status(400).json({ message: "Invalid notification content" });
  const users = await prisma.user.findMany({ where: audience === "user" ? { id: String(req.body.userId || ""), status: "active" } : { status: "active", role: "customer" }, select: { id: true } });
  if (!users.length) return res.status(404).json({ message: "No active recipients found" });
  const campaignId = crypto.randomUUID(); await prisma.notification.createMany({ data: users.map((x) => ({ userId: x.id, title, message, type, campaignId, createdById: req.user.id, audience, data: { broadcast: true } })) });
  await audit(req, "notification.send", campaignId, { audience, recipients: users.length, type }); res.status(201).json({ campaignId, recipients: users.length });
}));

app.get("/api/admin/wallet-transfers/lookup", auth, admin, asyncRoute(async (req, res) => {
  const walletId = String(req.query.walletId || "").trim().toUpperCase();
  if (walletId.length < 4) return res.status(400).json({ message: "Enter a valid wallet ID" });
  const user = await prisma.user.findUnique({ where: { walletId } });
  if (!user) return res.status(404).json({ message: "Wallet not found" });
  if (user.id === req.user.id) return res.status(409).json({ message: "Choose a customer wallet, not the owner wallet" });
  res.json(publicUser(user));
}));
app.get("/api/admin/wallet-transfers", auth, admin, asyncRoute(async (req, res) => {
  const rows = await prisma.walletTransfer.findMany({ where: { fromUserId: req.user.id }, include: { toUser: { select: { id: true, name: true, email: true, walletId: true } } }, orderBy: { createdAt: "desc" }, take: Math.min(200, Math.max(1, Number(req.query.limit || 50))) });
  res.json(plain(rows));
}));
app.post("/api/admin/wallet-transfers", auth, admin, limiter(60_000, 20), asyncRoute(async (req, res) => {
  const walletId = String(req.body.walletId || "").trim().toUpperCase(), currency = String(req.body.currency || ""), field = balanceField[currency], amount = Number(req.body.amount), note = String(req.body.note || "").trim().slice(0, 300), idempotencyKey = String(req.body.idempotencyKey || "").trim(), pin = String(req.body.pin || "");
  if (!field || !(amount > 0) || !Number.isFinite(amount) || amount > 1_000_000_000 || idempotencyKey.length < 8) return res.status(400).json({ message: "Invalid transfer data" });
  const previous = await prisma.walletTransfer.findUnique({ where: { idempotencyKey }, include: { toUser: { select: { id: true, name: true, email: true, walletId: true } } } });
  if (previous) {
    if (previous.fromUserId !== req.user.id) return res.status(409).json({ message: "Transfer key conflict" });
    const owner = await prisma.user.findUnique({ where: { id: req.user.id } });
    return res.json({ transfer: plain(previous), owner: publicUser(owner), repeated: true });
  }
  if (req.user.pinHash && !await bcrypt.compare(pin, req.user.pinHash)) return res.status(401).json({ message: "Incorrect owner PIN" });
  const recipient = await prisma.user.findUnique({ where: { walletId } });
  if (!recipient || recipient.status !== "active") return res.status(404).json({ message: "Active recipient wallet not found" });
  if (recipient.id === req.user.id) return res.status(409).json({ message: "Cannot transfer to the same wallet" });
  const result = await prisma.$transaction(async (tx) => {
    const debited = await tx.user.updateMany({ where: { id: req.user.id, [field]: { gte: amount } }, data: { [field]: { decrement: amount } } });
    if (!debited.count) throw Object.assign(new Error("Owner wallet balance is insufficient"), { status: 400 });
    const credited = await tx.user.update({ where: { id: recipient.id }, data: { [field]: { increment: amount } } });
    const transfer = await tx.walletTransfer.create({ data: { transferNumber: `TR-${Date.now().toString(36).toUpperCase()}-${crypto.randomInt(1000, 9999)}`, idempotencyKey, fromUserId: req.user.id, toUserId: recipient.id, currency, amount, note: note || null }, include: { toUser: { select: { id: true, name: true, email: true, walletId: true } } } });
    await tx.ledger.createMany({ data: [
      { userId: req.user.id, type: "owner_transfer_out", direction: "debit", amount, currency, reference: transfer.id, note: note || `Transfer to ${recipient.walletId}` },
      { userId: recipient.id, type: "owner_transfer_in", direction: "credit", amount, currency, reference: transfer.id, note: note || "Direct transfer from store owner" }
    ] });
    await tx.notification.create({ data: { userId: recipient.id, title: "Balance received", message: `${amount} ${currency} was transferred to your wallet`, type: "balance", createdById: req.user.id, data: { transferId: transfer.id, transferNumber: transfer.transferNumber, amount, currency } } });
    const owner = await tx.user.findUnique({ where: { id: req.user.id } });
    return { transfer, recipient: publicUser(credited), owner: publicUser(owner) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(req, "wallet.transfer", result.transfer.id, { walletId, currency, amount, transferNumber: result.transfer.transferNumber });
  res.status(201).json(plain(result));
}));

app.post("/api/admin/security/revoke-customer-sessions", auth, admin, limiter(60_000, 3), asyncRoute(async (req, res) => {
  if (req.user.pinHash && !await bcrypt.compare(String(req.body.pin || ""), req.user.pinHash)) return res.status(401).json({ message: "Incorrect owner PIN" });
  const customers = await prisma.user.findMany({ where: { role: "customer" }, select: { id: true } });
  const result = await prisma.authSession.updateMany({ where: { userId: { in: customers.map((user) => user.id) }, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit(req, "security.customer_sessions.revoke", null, { sessions: result.count, users: customers.length });
  res.json({ revoked: result.count });
}));

const withdrawalMethodData = (body) => {
  const name = String(body.name || "").trim().slice(0, 100);
  const slug = String(body.slug || name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const minAmount = Number(body.minAmount ?? 5), maxAmount = Number(body.maxAmount ?? 0), feePercent = Number(body.feePercent ?? 0);
  if (name.length < 2 || !slug || !Number.isFinite(minAmount) || minAmount < 0 || !Number.isFinite(maxAmount) || maxAmount < 0 || (maxAmount > 0 && maxAmount < minAmount) || !Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100) throw Object.assign(new Error("Invalid withdrawal method"), { status: 400 });
  const fields = (Array.isArray(body.fields) ? body.fields : []).slice(0, 10).map((field) => ({ key: String(field?.key || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40), label: String(field?.label || "").trim().slice(0, 80), type: ["text", "tel", "email", "number"].includes(field?.type) ? field.type : "text", required: field?.required !== false })).filter((field) => field.key && field.label);
  if (!fields.length) throw Object.assign(new Error("At least one payout field is required"), { status: 400 });
  return { name, slug, instructions: String(body.instructions || "").trim().slice(0, 1000), fields, minAmount, maxAmount, feePercent, active: body.active !== false, sortOrder: Math.max(0, Math.floor(Number(body.sortOrder || 0))) };
};
app.get("/api/admin/withdrawal-methods", auth, admin, asyncRoute(async (_req, res) => {
  res.json(plain(await prisma.withdrawalMethod.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })));
}));
app.post("/api/admin/withdrawal-methods", auth, admin, asyncRoute(async (req, res) => {
  const row = await prisma.withdrawalMethod.create({ data: withdrawalMethodData(req.body) });
  await audit(req, "withdrawal_method.create", row.id); res.status(201).json(plain(row));
}));
app.patch("/api/admin/withdrawal-methods/:id", auth, admin, asyncRoute(async (req, res) => {
  const row = await prisma.withdrawalMethod.update({ where: { id: req.params.id }, data: withdrawalMethodData(req.body) });
  await audit(req, "withdrawal_method.update", row.id); res.json(plain(row));
}));
app.delete("/api/admin/withdrawal-methods/:id", auth, admin, asyncRoute(async (req, res) => {
  const used = await prisma.agentWithdrawal.count({ where: { methodId: req.params.id } });
  if (used) await prisma.withdrawalMethod.update({ where: { id: req.params.id }, data: { active: false } });
  else await prisma.withdrawalMethod.delete({ where: { id: req.params.id } });
  await audit(req, "withdrawal_method.remove", req.params.id, { deactivated: Boolean(used) }); res.json({ ok: true, deactivated: Boolean(used) });
}));
app.get("/api/admin/agent-withdrawals", auth, admin, asyncRoute(async (req, res) => {
  const status = String(req.query.status || "all");
  const rows = await prisma.agentWithdrawal.findMany({ where: status === "all" ? {} : { status }, include: { user: { select: { id: true, name: true, email: true, affiliateCode: true, agentLevel: true } }, method: { select: { id: true, name: true, slug: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
  res.json(plain(rows));
}));
app.post("/api/admin/agent-withdrawals/:id/review", auth, admin, asyncRoute(async (req, res) => {
  const status = String(req.body.status || ""), adminNote = String(req.body.adminNote || "").trim().slice(0, 500);
  if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid withdrawal status" });
  const row = await prisma.$transaction(async (tx) => {
    const current = await tx.agentWithdrawal.findUnique({ where: { id: req.params.id }, include: { method: true } });
    if (!current) throw Object.assign(new Error("Withdrawal request not found"), { status: 404 });
    const changed = await tx.agentWithdrawal.updateMany({ where: { id: current.id, status: "pending" }, data: { status, adminNote, reviewedById: req.user.id, reviewedAt: new Date() } });
    if (!changed.count) throw Object.assign(new Error("Withdrawal request was already reviewed"), { status: 409 });
    if (status === "rejected") {
      await tx.user.update({ where: { id: current.userId }, data: { affiliatePoints: { increment: current.pointsHeld } } });
    } else {
      await tx.ledger.create({ data: { userId: current.userId, type: "agent_withdrawal", direction: "debit", amount: current.grossAmount, currency: "USD", reference: current.id, note: `${current.requestNumber} via ${current.method.name}; fee ${current.feeAmount} USD` } });
    }
    await tx.notification.create({ data: { userId: current.userId, title: status === "approved" ? "Withdrawal approved" : "Withdrawal rejected", message: status === "approved" ? `${current.netAmount} USD will be sent through ${current.method.name}` : `${current.pointsHeld} points returned. ${adminNote}`, type: "balance", createdById: req.user.id } });
    return tx.agentWithdrawal.findUnique({ where: { id: current.id }, include: { user: { select: { id: true, name: true, email: true } }, method: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(req, `agent_withdrawal.${status}`, row.id, { adminNote }); res.json(plain(row));
}));

app.get("/api/admin/data/summary", auth, admin, asyncRoute(async (_req, res) => {
  const [users, products, orders, deposits, feedback, tickets, invoices, ledger, codes, transfers] = await Promise.all([
    prisma.user.count(), prisma.product.count(), prisma.order.count(), prisma.deposit.count(), prisma.feedback.count(),
    prisma.ticket.count(), prisma.invoice.count(), prisma.ledger.count(), prisma.digitalCode.count(), prisma.walletTransfer.count()
  ]);
  res.json({ users, products, orders, deposits, feedback, tickets, invoices, ledger, codes, transfers, total: users + products + orders + deposits + feedback + tickets + invoices + ledger + codes + transfers });
}));
app.get("/api/admin/data/export/:type", auth, admin, asyncRoute(async (req, res) => {
  const type = String(req.params.type || ""); let items;
  if (type === "orders") items = await prisma.order.findMany({ include: { user: { select: { name: true, email: true, walletId: true } }, items: true }, orderBy: { createdAt: "desc" } });
  else if (type === "deposits") items = await prisma.deposit.findMany({ include: { user: { select: { name: true, email: true, walletId: true } } }, orderBy: { createdAt: "desc" } });
  else if (type === "feedback") items = await prisma.feedback.findMany({ include: { user: { select: { name: true, email: true, walletId: true } } }, orderBy: { createdAt: "desc" } });
  else return res.status(400).json({ message: "Unsupported export type" });
  await audit(req, `data.export.${type}`, null, { rows: items.length }); res.json({ type, items: plain(items) });
}));
app.get("/api/admin/reports/financial", auth, admin, asyncRoute(async (req, res) => {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
  defaultFrom.setUTCHours(0, 0, 0, 0);
  const parseDate = (value, fallback, endOfDay = false) => {
    if (!value) return fallback;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) date.setUTCHours(23, 59, 59, 999);
    return date;
  };
  const from = parseDate(req.query.from, defaultFrom);
  const to = parseDate(req.query.to, now, true);
  if (!from || !to || from > to) return res.status(400).json({ message: "Invalid report date range" });
  const maxRangeMs = 366 * 24 * 60 * 60 * 1000;
  if (to - from > maxRangeMs) return res.status(400).json({ message: "Report range cannot exceed 366 days" });

  const range = { gte: from, lte: to };
  const [orders, deposits, ledger, agents, fulfillments, storeConfig] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: range },
      select: { id: true, orderNumber: true, status: true, currency: true, subtotal: true, discount: true, totalAmount: true, createdAt: true, user: { select: { referredBy: true } }, items: { select: { productId: true, name: true, quantity: true, price: true } } }
    }),
    prisma.deposit.findMany({ where: { createdAt: range }, select: { status: true, currency: true, amount: true, createdAt: true } }),
    prisma.ledger.findMany({ where: { createdAt: range }, select: { userId: true, type: true, direction: true, currency: true, amount: true, createdAt: true } }),
    prisma.user.findMany({ where: { affiliateCode: { not: null } }, select: { id: true, name: true, affiliateCode: true, agentLevel: true, affiliatePoints: true, affiliateSales: true, affiliateOrders: true } }),
    prisma.apiFulfillment.findMany({ where: { createdAt: range }, select: { status: true, attempts: true, switchedCount: true, createdAt: true, completedAt: true, provider: { select: { id: true, name: true, active: true, priority: true } } } }),
    settings()
  ]);

  const currencies = ["USD", "SYP", "TRY"];
  const emptyMoney = () => Object.fromEntries(currencies.map((currency) => [currency, 0]));
  const sales = emptyMoney(); const discounts = emptyMoney(); const approvedDeposits = emptyMoney();
  const ledgerCredits = emptyMoney(); const ledgerDebits = emptyMoney(); const refunds = emptyMoney(); const affiliateRedeems = emptyMoney();
  const dailyMap = new Map(); const productsMap = new Map();
  const dayRow = (date) => {
    const key = new Date(date).toISOString().slice(0, 10);
    if (!dailyMap.has(key)) dailyMap.set(key, { date: key, sales: emptyMoney(), orders: 0, deposits: emptyMoney() });
    return dailyMap.get(key);
  };
  const completedOrders = orders.filter((order) => order.status === "completed");
  for (const order of completedOrders) {
    const currency = order.currency;
    sales[currency] += Number(order.totalAmount);
    discounts[currency] += Number(order.discount);
    const day = dayRow(order.createdAt); day.sales[currency] += Number(order.totalAmount); day.orders += 1;
    for (const item of order.items) {
      const key = item.productId || item.name;
      const current = productsMap.get(key) || { productId: item.productId, name: item.name, quantity: 0, orders: new Set(), revenue: emptyMoney() };
      current.quantity += item.quantity; current.orders.add(order.id); current.revenue[currency] += Number(item.price) * item.quantity;
      productsMap.set(key, current);
    }
  }
  for (const deposit of deposits.filter((item) => item.status === "approved")) {
    approvedDeposits[deposit.currency] += Number(deposit.amount);
    dayRow(deposit.createdAt).deposits[deposit.currency] += Number(deposit.amount);
  }
  for (const entry of ledger) {
    const target = entry.direction === "credit" ? ledgerCredits : ledgerDebits;
    target[entry.currency] += Number(entry.amount);
    if (entry.type === "order_refund") refunds[entry.currency] += Number(entry.amount);
    if (entry.type === "affiliate_redeem") affiliateRedeems[entry.currency] += Number(entry.amount);
  }
  const roundMoney = (record) => Object.fromEntries(Object.entries(record).map(([key, value]) => [key, Number(value.toFixed(6))]));
  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map((row) => ({ ...row, sales: roundMoney(row.sales), deposits: roundMoney(row.deposits) }));
  const topProducts = [...productsMap.values()].map((item) => ({ ...item, orders: item.orders.size, revenue: roundMoney(item.revenue) })).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  const statuses = Object.fromEntries(["pending", "payment_review", "paid", "processing", "completed", "rejected", "cancelled"].map((status) => [status, orders.filter((order) => order.status === status).length]));
  const agentByCode = new Map(agents.map((agent) => [agent.affiliateCode, { ...agent, periodSales: 0, periodOrders: 0 }]));
  for (const order of completedOrders) {
    const agent = agentByCode.get(order.user.referredBy);
    if (agent) { agent.periodSales += Number(order.totalAmount); agent.periodOrders += 1; }
  }
  const pointsToDollar = Math.max(1, Number(storeConfig.affiliate?.pointsToDollar || 100));
  const topAgents = [...agentByCode.values()].filter((agent) => agent.periodOrders > 0 || Number(agent.affiliatePoints) > 0).map((agent) => ({ id: agent.id, name: agent.name, code: agent.affiliateCode, level: agent.agentLevel, periodSales: Number(agent.periodSales.toFixed(6)), periodOrders: agent.periodOrders, availablePoints: Number(agent.affiliatePoints), estimatedRewardUSD: Number((Number(agent.affiliatePoints) / pointsToDollar).toFixed(6)), lifetimeSales: Number(agent.affiliateSales), lifetimeOrders: agent.affiliateOrders })).sort((a, b) => b.periodSales - a.periodSales).slice(0, 10);
  const providerMap = new Map();
  for (const item of fulfillments) {
    const key = item.provider.id;
    const row = providerMap.get(key) || { id: key, name: item.provider.name, active: item.provider.active, priority: item.provider.priority, total: 0, completed: 0, failed: 0, processing: 0, attempts: 0, switches: 0, durationTotalMs: 0, durationSamples: 0 };
    row.total += 1; row.attempts += item.attempts; row.switches += item.switchedCount;
    if (item.status === "completed") row.completed += 1;
    else if (item.status === "failed") row.failed += 1;
    else if (["queued", "sending", "processing"].includes(item.status)) row.processing += 1;
    if (item.completedAt) { row.durationTotalMs += item.completedAt.getTime() - item.createdAt.getTime(); row.durationSamples += 1; }
    providerMap.set(key, row);
  }
  const providers = [...providerMap.values()].map((row) => ({ ...row, successRate: row.total ? Number(((row.completed / row.total) * 100).toFixed(2)) : 0, averageDurationSeconds: row.durationSamples ? Number((row.durationTotalMs / row.durationSamples / 1000).toFixed(1)) : null, averageAttempts: row.total ? Number((row.attempts / row.total).toFixed(2)) : 0, durationTotalMs: undefined, durationSamples: undefined })).sort((a, b) => b.total - a.total);
  const result = { from, to, generatedAt: now, counts: { orders: orders.length, completedOrders: completedOrders.length, cancelledOrders: statuses.cancelled, rejectedOrders: statuses.rejected, approvedDeposits: deposits.filter((item) => item.status === "approved").length }, statuses, totals: { sales: roundMoney(sales), discounts: roundMoney(discounts), refunds: roundMoney(refunds), affiliateRedeems: roundMoney(affiliateRedeems), approvedDeposits: roundMoney(approvedDeposits), ledgerCredits: roundMoney(ledgerCredits), ledgerDebits: roundMoney(ledgerDebits) }, daily, topProducts, topAgents, providers };
  await audit(req, "reports.financial", null, { from, to, orders: orders.length });
  res.json(result);
}));
const buildSafeBackup = async () => {
  const [storeSettings, categories, products, paymentMethods, offers, coupons, users, orders, deposits, invoices, ledger, feedback, reviews, walletTransfers] = await Promise.all([
    prisma.storeSettings.findMany(), prisma.category.findMany(), prisma.product.findMany({ include: { packages: true } }),
    prisma.paymentMethod.findMany(), prisma.offer.findMany(), prisma.coupon.findMany(),
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, status: true, walletId: true, balanceUSD: true, balanceSYP: true, balanceTRY: true, affiliateCode: true, referredBy: true, affiliatePoints: true, affiliateSales: true, affiliateOrders: true, agentLevel: true, phone: true, phoneVerified: true, emailVerified: true, verified: true, createdAt: true, updatedAt: true } }),
    prisma.order.findMany({ include: { items: true } }), prisma.deposit.findMany(), prisma.invoice.findMany(), prisma.ledger.findMany(), prisma.feedback.findMany(), prisma.review.findMany(), prisma.walletTransfer.findMany()
  ]);
  return plain({ app: "rs-store", version: 3, database: "postgresql", createdAt: new Date(), data: { storeSettings, categories, products, paymentMethods, offers, coupons, users, orders, deposits, invoices, ledger, feedback, reviews, walletTransfers } });
};
const encryptBackup = (backup) => {
  const raw = Buffer.from(JSON.stringify(backup));
  const plaintext = zlib.gzipSync(raw, { level: 9 });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", codeKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const envelope = Buffer.from(JSON.stringify({ version: 2, algorithm: "aes-256-gcm+gzip", iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") }));
  return { envelope, checksum: crypto.createHash("sha256").update(raw).digest("hex") };
};
const decryptBackup = (buffer) => {
  const envelope = JSON.parse(buffer.toString("utf8"));
  if (![1, 2].includes(envelope.version) || !["aes-256-gcm", "aes-256-gcm+gzip"].includes(envelope.algorithm)) throw Object.assign(new Error("Unsupported backup format"), { status: 422 });
  const decipher = crypto.createDecipheriv("aes-256-gcm", codeKey, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
  return envelope.version === 2 ? zlib.gunzipSync(plaintext) : plaintext;
};
app.get("/api/admin/data/backup", auth, admin, asyncRoute(async (req, res) => {
  const backup = await buildSafeBackup();
  await audit(req, "data.backup", null, { collections: Object.keys(backup.data).length }); res.json(backup);
}));
app.get("/api/admin/data/snapshots", auth, admin, asyncRoute(async (_req, res) => {
  const items = await prisma.backupSnapshot.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  res.json({ items });
}));
app.post("/api/admin/data/snapshots", auth, admin, asyncRoute(async (req, res) => {
  const backup = await buildSafeBackup();
  const { envelope, checksum } = encryptBackup(backup);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const storageKey = `backups/rs-store-${stamp}-${crypto.randomBytes(4).toString("hex")}.encrypted.json`;
  await putPrivateObject(storageKey, envelope, "application/octet-stream");
  const snapshot = await prisma.backupSnapshot.create({ data: { storageKey, checksum, sizeBytes: envelope.length, collections: Object.keys(backup.data).length, createdById: req.user.id } });
  await audit(req, "data.snapshot.create", snapshot.id, { sizeBytes: envelope.length, checksum });
  res.status(201).json(snapshot);
}));
app.post("/api/cron/backup", asyncRoute(async (req, res) => {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.get("authorization") !== `Bearer ${expected}`) return res.status(401).json({ message: "Unauthorized" });
  const owner = await prisma.user.findFirst({ where: { role: "admin", status: "active" }, select: { id: true } });
  if (!owner) return res.status(503).json({ message: "No active admin available for backup" });
  const backup = await buildSafeBackup();
  const { envelope, checksum } = encryptBackup(backup);
  const storageKey = "backups/rs-store-daily.encrypted.json";
  await putPrivateObject(storageKey, envelope, "application/octet-stream");
  const snapshot = await prisma.backupSnapshot.upsert({ where: { storageKey }, update: { checksum, sizeBytes: envelope.length, collections: Object.keys(backup.data).length, createdById: owner.id }, create: { storageKey, checksum, sizeBytes: envelope.length, collections: Object.keys(backup.data).length, createdById: owner.id } });
  const oldSnapshots = await prisma.backupSnapshot.findMany({ orderBy: { createdAt: "desc" }, skip: 30, select: { id: true, storageKey: true } });
  for (const old of oldSnapshots) { await deletePrivateObject(old.storageKey).catch(() => {}); await prisma.backupSnapshot.delete({ where: { id: old.id } }).catch(() => {}); }
  res.status(201).json({ created: true, snapshot: plain(snapshot) });
}));
app.get("/api/admin/data/snapshots/:id/download", auth, admin, asyncRoute(async (req, res) => {
  const snapshot = await prisma.backupSnapshot.findUnique({ where: { id: req.params.id } });
  if (!snapshot) return res.status(404).json({ message: "Backup snapshot not found" });
  const stored = await getPrivateObject(snapshot.storageKey);
  const plaintext = decryptBackup(stored.buffer);
  const checksum = crypto.createHash("sha256").update(plaintext).digest("hex");
  if (checksum !== snapshot.checksum) return res.status(422).json({ message: "Backup integrity check failed" });
  await audit(req, "data.snapshot.download", snapshot.id, { checksum });
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="rs-store-backup-${snapshot.createdAt.toISOString().slice(0, 10)}.json"`);
  res.send(plaintext);
}));

// Dynamic site pages: managed from the admin panel and safe for public display.
app.get("/api/pages", asyncRoute(async (_req, res) => {
  const rows = await prisma.sitePage.findMany({ where: { published: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true, title: true, slug: true, excerpt: true, content: true, blocks: true, coverImage: true, links: true, updatedAt: true } });
  res.json(plain(rows));
}));
app.get("/api/pages/:slug", asyncRoute(async (req, res) => {
  const row = await prisma.sitePage.findFirst({ where: { slug: String(req.params.slug), published: true } });
  if (!row) return res.status(404).json({ message: "Page not found" });
  res.json(plain(row));
}));
app.get("/api/admin/pages", auth, admin, asyncRoute(async (_req, res) => {
  res.json(plain(await prisma.sitePage.findMany({ orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }] })));
}));
app.post("/api/admin/pages", auth, admin, asyncRoute(async (req, res) => {
  const title = String(req.body.title || "").trim();
  const slug = String(req.body.slug || title).trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-|-$/g, "");
  if (!title || !slug) return res.status(400).json({ message: "العنوان والرابط مطلوبان" });
  const row = await prisma.sitePage.create({ data: { title, slug, excerpt: String(req.body.excerpt || ""), content: String(req.body.content || ""), blocks: req.body.blocks || [], coverImage: String(req.body.coverImage || ""), links: req.body.links || [], published: Boolean(req.body.published), sortOrder: Number(req.body.sortOrder || 0) } });
  await audit(req, "page.create", row.id); res.status(201).json(plain(row));
}));
app.patch("/api/admin/pages/:id", auth, admin, asyncRoute(async (req, res) => {
  const data = {}; for (const key of ["title", "slug", "excerpt", "content", "coverImage"]) if (req.body[key] !== undefined) data[key] = String(req.body[key]);
  for (const key of ["blocks", "links"]) if (req.body[key] !== undefined) data[key] = req.body[key];
  if (req.body.published !== undefined) data.published = Boolean(req.body.published);
  if (req.body.sortOrder !== undefined) data.sortOrder = Number(req.body.sortOrder || 0);
  const row = await prisma.sitePage.update({ where: { id: req.params.id }, data }); await audit(req, "page.update", row.id); res.json(plain(row));
}));
app.delete("/api/admin/pages/:id", auth, admin, asyncRoute(async (req, res) => {
  await prisma.sitePage.delete({ where: { id: req.params.id } }); await audit(req, "page.delete", req.params.id); res.json({ ok: true });
}));

app.get("/api/cron/fulfillments", asyncRoute(async (req, res) => {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.get("authorization") !== `Bearer ${expected}`) return res.status(401).json({ message: "Unauthorized" });
  await processApiFulfillments();
  const delayed = await monitorStuckOrders();
  const lowStock = await monitorLowStock();
  res.json({ ok: true, delayed, lowStock });
}));
app.use("/api/admin", auth, admin, (_req, res) => res.status(404).json({ message: "Admin route not found" }));
app.use("/api", (_req, res) => res.status(404).json({ message: "Route not found" }));
app.get("*splat", (_req, res, next) => {
  const indexFile = path.join(webRoot, "index.html");
  if (!fs.existsSync(indexFile)) return next();
  res.sendFile(indexFile);
});
app.use((_req, res) => res.status(404).send("Not found"));
app.use((error, req, res, _next) => {
  console.error(error);
  const duplicate = error?.code === "P2002";
  const status = error.status || (duplicate ? 409 : 500);
  const message = duplicate ? "Duplicate value" : (error.message || "Server error");
  if (req.path.startsWith("/api/v1/reseller/")) return res.status(status).json({ success: false, error: { code: error.apiCode || (duplicate ? "DUPLICATE_REFERENCE" : "API_ERROR"), message } });
  res.status(status).json({ message });
});

try { await connectDatabase(); } catch (error) { console.error("Database connection failed at startup:", error.message); if (!process.env.VERCEL) throw error; }

if (!process.env.VERCEL) {
  const server = app.listen(port, () => console.log(`RS Store PostgreSQL API listening on ${port}`));
  const fulfillmentTimer = setInterval(() => processApiFulfillments().catch((error) => console.error("API fulfillment worker:", error.message)), 15000);
  fulfillmentTimer.unref();
  const orderMonitorTimer = setInterval(() => monitorStuckOrders().catch((error) => console.error("Order monitor:", error.message)), 5 * 60_000);
  orderMonitorTimer.unref();
  const inventoryMonitorTimer = setInterval(() => monitorLowStock().catch((error) => console.error("Inventory monitor:", error.message)), 15 * 60_000);
  inventoryMonitorTimer.unref();
  setImmediate(() => processApiFulfillments().catch((error) => console.error("API fulfillment startup:", error.message)));
  setImmediate(() => monitorStuckOrders().catch((error) => console.error("Order monitor startup:", error.message)));
  setImmediate(() => monitorLowStock().catch((error) => console.error("Inventory monitor startup:", error.message)));
  const shutdown = async () => { clearInterval(fulfillmentTimer); clearInterval(orderMonitorTimer); clearInterval(inventoryMonitorTimer); server.close(); await disconnectDatabase(); process.exit(0); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export default app;
