import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const globalForPrisma = globalThis;
const adapter = new PrismaPg({ connectionString });

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
