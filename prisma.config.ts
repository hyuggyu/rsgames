import "dotenv/config";
import { defineConfig } from "prisma/config";

// The Prisma migration engine does not understand the pg-only "uselibpqcompat" flag, so strip it here.
const clean = (url?: string) => url?.replace(/([?&])uselibpqcompat=[^&]*&?/g, "$1").replace(/[?&]$/, "");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: clean(process.env.DIRECT_URL || process.env.DATABASE_URL) || "postgresql://localhost:5432/rs_store",
  },
});
