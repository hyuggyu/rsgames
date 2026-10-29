import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const source = path.resolve("frontend/dist");
const target = path.resolve("public");
if (!existsSync(source)) throw new Error("Frontend build output was not found");
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log("Frontend copied to public/");
