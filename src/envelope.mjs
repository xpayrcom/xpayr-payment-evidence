import { canonicalize, domainHash, normalizeSha256 } from "./jcs.mjs";

const requiredSections = ["subject", "intent", "policy", "guard", "quote", "execution", "settlement", "reconciliation", "provenance", "privacy", "integrity"];
const forbiddenKeys = /^(?:private_key|secret_key|seed|mnemonic|api_key|webhook_secret|authorization)$/i;

export function envelopeBody(envelope) {
  const body = structuredClone(envelope);
  if (body.integrity) delete body.integrity.envelope_hash;
  return body;
}

export function envelopeHash(envelope) {
  return domainHash("XPAYR:ENVELOPE:v1", envelopeBody(envelope));
}

function findForbidden(value, path = "", findings = []) {
  if (!value || typeof value !== "object") return findings;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (forbiddenKeys.test(key)) findings.push(childPath);
    findForbidden(child, childPath, findings);
  }
  return findings;
}

export function validateEnvelope(envelope, { requireSealedHash = false } = {}) {
  const errors = [];
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return { valid: false, errors: ["envelope_not_object"], forbidden_paths: [] };
  if (envelope.schema !== "xpayr.payment-evidence-envelope.v1") errors.push("schema_invalid");
  if (!/^pee_[A-Za-z0-9_-]{3,}$/.test(envelope.envelope_id || "")) errors.push("envelope_id_invalid");
  if (!Number.isSafeInteger(envelope.revision) || envelope.revision < 1) errors.push("revision_invalid");
  for (const section of requiredSections) if (!envelope[section] || typeof envelope[section] !== "object" || Array.isArray(envelope[section])) errors.push(`${section}_missing`);
  if (!(envelope.split === null || (typeof envelope.split === "object" && !Array.isArray(envelope.split)))) errors.push("split_invalid");
  if (envelope.intent?.network_key !== "arc-testnet" || envelope.intent?.chain_id !== 5042002) errors.push("network_release_gate_invalid");
  if (envelope.intent?.token_symbol !== "USDC" || envelope.intent?.token_decimals !== 6 || !/^\d+$/.test(envelope.intent?.amount_atomic || "")) errors.push("intent_amount_invalid");
  if (envelope.execution?.receipt_status !== 1 || !/^0x[a-fA-F0-9]{64}$/.test(envelope.execution?.tx_hash || "")) errors.push("execution_not_verified");
  if (envelope.reconciliation?.payment_status !== "completed" || envelope.reconciliation?.gateway_status !== "confirmed") errors.push("reconciliation_incomplete");
  if (envelope.integrity?.canonicalization !== "RFC8785-JCS" || envelope.integrity?.hash_algorithm !== "SHA-256" || Number.isNaN(Date.parse(envelope.integrity?.created_at || ""))) errors.push("integrity_profile_invalid");
  const forbiddenPaths = findForbidden(envelope);
  if (forbiddenPaths.length) errors.push("forbidden_secret_material");
  let computedHash = null;
  let canonicalJson = null;
  try {
    computedHash = envelopeHash(envelope);
    canonicalJson = canonicalize(envelopeBody(envelope));
  } catch {
    errors.push("canonicalization_failed");
  }
  if (requireSealedHash && computedHash !== null) {
    try {
      if (normalizeSha256(envelope.integrity?.envelope_hash) !== computedHash) errors.push("envelope_hash_mismatch");
    } catch {
      errors.push("envelope_hash_invalid");
    }
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)], forbidden_paths: forbiddenPaths, computed_hash: computedHash, stored_hash: envelope.integrity?.envelope_hash ?? null, canonical_json: canonicalJson, payment_status_mutation_allowed: false };
}

export function sealEnvelope(envelope) {
  const candidate = structuredClone(envelope);
  const validation = validateEnvelope(candidate);
  if (!validation.valid) throw new Error(`Evidence envelope is not sealable: ${validation.errors.join(",")}`);
  candidate.integrity.envelope_hash = validation.computed_hash;
  const sealed = validateEnvelope(candidate, { requireSealedHash: true });
  if (!sealed.valid) throw new Error(`Sealed evidence failed verification: ${sealed.errors.join(",")}`);
  return candidate;
}

export function verifyEnvelope(envelope) { return validateEnvelope(envelope, { requireSealedHash: true }); }
