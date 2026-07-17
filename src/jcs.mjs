import { createHash } from "node:crypto";

export function canonicalize(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new TypeError("Canonical payment JSON permits only safe integer numbers");
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError("Unsupported canonical JSON value type");
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

export function domainHash(domain, payload) {
  if (!/^XPAYR:[A-Z0-9_-]+:v[0-9]+$/.test(domain)) throw new TypeError("Invalid XPAYR hash domain");
  return `sha256:${createHash("sha256").update(`${domain}\n${canonicalize(payload)}`, "utf8").digest("hex")}`;
}

export function normalizeSha256(value) {
  if (typeof value !== "string" || !/^(?:sha256:)?[a-fA-F0-9]{64}$/.test(value.trim())) throw new TypeError("Invalid SHA-256 reference");
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("sha256:") ? normalized : `sha256:${normalized}`;
}
