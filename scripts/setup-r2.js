import "dotenv/config";
import { createR2Storage } from "../src/r2-storage.js";

const r2 = createR2Storage();
if (!r2.configured) throw new Error("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required");
const buckets = [process.env.R2_PRIVATE_BUCKET || "private-uploads", process.env.R2_PUBLIC_BUCKET || "public-assets"];
for (const bucket of buckets) {
  await r2.ensureBucket(bucket);
  console.log(`R2 bucket is ready: ${bucket}`);
}
console.log("Enable a custom/public domain for the public bucket and set R2_PUBLIC_URL.");
