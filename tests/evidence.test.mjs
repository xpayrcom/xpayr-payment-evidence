import assert from "node:assert/strict";
import test from "node:test";
import { buildMerkleBatch, canonicalize, domainHash, sealEnvelope, verifyEnvelope, verifyProof } from "../src/index.mjs";

function fixture(id = "001", amount = "10000") {
  const hash = `sha256:${"a".repeat(64)}`;
  const tx = `0x${id.padStart(64, "0")}`;
  return {
    schema: "xpayr.payment-evidence-envelope.v1", envelope_id: `pee_test_${id}`, revision: 1,
    subject: { type: "agent_checkout", merchant_ref: hash, payment_session_id: `ps_${id}` },
    intent: { actor_type: "agent", operation: "checkout_split", network_key: "arc-testnet", chain_id: 5042002, token_symbol: "USDC", token_address: "0x3600000000000000000000000000000000000000", token_decimals: 6, amount_atomic: amount, recipient: "0x1111111111111111111111111111111111111111", route_id: "arc-testnet:splitter:v1", intent_hash: hash },
    policy: { policy_id: "pgp_test", policy_version: 1, policy_hash: hash, decision: "approved", reason_codes: [], evaluated_at: "2026-07-16T19:00:00Z" },
    guard: { decision_id: "pgd_test", verdict: "ALLOW", decision_state: "consumed", execution_fingerprint: hash },
    quote: { quote_id: "afq_test", quote_hash: hash, gross_amount_atomic: amount, customer_fee_atomic: "0", platform_fee_atomic: "50", merchant_net_atomic: String(BigInt(amount) - 50n), fee_bps: 50, fee_recipient: "0x2222222222222222222222222222222222222222", expires_at: "2026-07-16T20:00:00Z" },
    execution: { tx_hash: tx, block_number: 100, block_hash: `0x${"b".repeat(64)}`, transaction_index: 1, sender: "0x3333333333333333333333333333333333333333", to: "0x4444444444444444444444444444444444444444", receipt_status: 1, confirmation_count: 1, verifier: { name: "xpayr_evm_payment_verifier", version: "v1", evidence_hash: hash }, verified_at: "2026-07-16T19:02:00Z" },
    split: null,
    settlement: { mode: "atomic_split", route_id: "arc-testnet:splitter:v1", status: "confirmed", source_refs: ["gateway_transaction:test"], legs: [], settled_at: "2026-07-16T19:02:00Z" },
    reconciliation: { payment_status: "completed", gateway_status: "confirmed", fee_status: "collected", webhook: { event_type: "payment.completed", status: "delivered", payload_hash: hash }, checks: { intent_bound: true, amount_bound: true, route_bound: true }, reconciled_at: "2026-07-16T19:02:03Z" },
    provenance: { environment: "testnet", xpayr_release: "test-fixture", chain_manifest_hash: hash, verifier_artifact_hash: hash, indexer_fact_hashes: [] },
    privacy: { classification: "merchant_shareable", contains_pii: false, redacted_fields: ["subject.merchant_ref"], retention_class: "payment_audit" },
    integrity: { canonicalization: "RFC8785-JCS", hash_algorithm: "SHA-256", previous_revision_hash: null, created_at: "2026-07-16T19:02:04Z" },
  };
}

test("canonicalizes keys and rejects floating amounts", () => {
  assert.equal(canonicalize({ b: 2, a: 1 }), '{"a":1,"b":2}');
  assert.throws(() => canonicalize({ amount: 1.2 }), /safe integer/);
  assert.match(domainHash("XPAYR:INTENT:v1", { a: 1 }), /^sha256:[a-f0-9]{64}$/);
});
test("seals and verifies immutable envelope facts", () => {
  const sealed = sealEnvelope(fixture());
  assert.equal(verifyEnvelope(sealed).valid, true);
  sealed.intent.amount_atomic = "99999";
  assert.deepEqual(verifyEnvelope(sealed).errors, ["envelope_hash_mismatch"]);
});
test("rejects secret-shaped fields", () => assert.throws(() => sealEnvelope({ ...fixture(), private_key: "never" }), /forbidden_secret_material/));
test("builds and verifies sorted-pair Merkle proofs", () => {
  const hashes = ["001", "002", "003"].map((id) => sealEnvelope(fixture(id, String(10_000 + Number(id)))).integrity.envelope_hash);
  const batch = buildMerkleBatch(hashes);
  assert.equal(batch.leaf_count, 3);
  for (const hash of hashes) assert.equal(verifyProof(hash, batch.proofs[hash], batch.merkle_root), true);
  assert.equal(verifyProof(`sha256:${"f".repeat(64)}`, batch.proofs[hashes[0]], batch.merkle_root), false);
});
