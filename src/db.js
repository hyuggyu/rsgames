import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  if (!process.env.VERCEL) throw new Error("DATABASE_URL is required");
  console.error("DATABASE_URL is not set in Vercel Environment Variables");
}

const globalForPrisma = globalThis;
// Serverless (Vercel) opens many short-lived instances: keep one connection each so the pooler is not exhausted.
const adapter = new PrismaPg({ connectionString, max: Number(process.env.DB_POOL_MAX || (process.env.VERCEL ? 1 : 10)) });

export const prisma = globalForPrisma.__rsStorePrisma || new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

if (process.env.NODE_ENV !== "production") globalForPrisma.__rsStorePrisma = prisma;

export async function connectDatabase() {
  await prisma.$connect();
  return prisma;
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
