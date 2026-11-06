import crypto from "node:crypto";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const hmac = (key, value) => crypto.createHmac("sha256", key).update(value).digest();
const encodePath = (value) => String(value).split("/").filter(Boolean).map(encodeURIComponent).join("/");

export function createR2Storage(env = process.env) {
  const accountId = env.R2_ACCOUNT_ID || "";
  const accessKeyId = env.R2_ACCESS_KEY_ID || "";
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY || "";
  const endpoint = accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "";
  const configured = Boolean(accountId && accessKeyId && secretAccessKey);

  async function request(method, bucket, key = "", { body, contentType } = {}) {
    if (!configured) throw Object.assign(new Error("Cloudflare R2 is not configured"), { status: 503 });
    const payload = body == null ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(body);
    const payloadHash = sha256(payload);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const host = new URL(endpoint).host;
    const objectPath = encodePath(key);
    const canonicalUri = `/${encodeURIComponent(bucket)}${objectPath ? `/${objectPath}` : ""}`;
    const headers = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
    if (contentType) headers["content-type"] = contentType;
    const names = Object.keys(headers).sort();
    const canonicalHeaders = names.map((name) => `${name}:${String(headers[name]).trim()}\n`).join("");
    const signedHeaders = names.join(";");
    const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${dateStamp}/auto/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), "auto"), "s3"), "aws4_request");
    const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const response = await fetch(endpoint + canonicalUri, {
      method,
      headers: { ...headers, Authorization: authorization },
      body: ["GET", "HEAD"].includes(method) ? undefined : payload
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw Object.assign(new Error(`R2 request failed (${response.status})${detail ? `: ${detail}` : ""}`), { status: 502 });
    }
    return response;
  }

  return {
    configured,
    put: (bucket, key, body, contentType) => request("PUT", bucket, key, { body, contentType }),
    remove: (bucket, key) => request("DELETE", bucket, key),
    async get(bucket, key) {
      const response = await request("GET", bucket, key);
      return { buffer: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get("content-type") };
    },
    async ensureBucket(bucket) {
      try { await request("HEAD", bucket); } catch { await request("PUT", bucket); }
    },
    publicUrl(key) {
      const base = String(env.R2_PUBLIC_URL || "").replace(/\/$/, "");
      if (!base) throw Object.assign(new Error("R2_PUBLIC_URL is required for public images"), { status: 503 });
      return `${base}/${encodePath(key)}`;
    }
  };
}
