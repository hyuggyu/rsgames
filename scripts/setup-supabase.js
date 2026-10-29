import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const buckets = [
  { id: process.env.SUPABASE_PRIVATE_BUCKET || "private-uploads", public: false },
  { id: process.env.SUPABASE_PUBLIC_BUCKET || "public-assets", public: true },
];
for (const bucket of buckets) {
  const { data } = await client.storage.getBucket(bucket.id);
  if (!data) {
    const { error } = await client.storage.createBucket(bucket.id, { public: bucket.public, fileSizeLimit: 4 * 1024 * 1024 });
    if (error) throw error;
    console.log(`Created bucket: ${bucket.id}`);
  } else {
    console.log(`Bucket already exists: ${bucket.id}`);
  }
}
