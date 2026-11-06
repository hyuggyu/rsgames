// Vercel Node.js function entry point. vercel.json rewrites every /api/* request here,
// and Express keeps the original URL, so routes like /api/auth/register match normally.
import app from "../src/server.pg.js";

export default app;
