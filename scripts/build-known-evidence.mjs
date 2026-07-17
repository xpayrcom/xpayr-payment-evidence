import { mkdir, readFile, writeFile } from "node:fs/promises";
import { domainHash, sealEnvelope, buildMerkleBatch } from "../src/index.mjs";

const sourceUrl = new URL("../examples/arc-testnet-agent-payment.source.json", import.meta.url);
const sealedUrl = new URL("../examples/arc-testnet-agent-payment.sealed.json", import.meta.url);
const batchUrl = new URL("../examples/arc-testnet-agent-payment.batch.json", import.meta.url);
const source = JSON.parse(await readFile(sourceUrl, "utf8"));

if (source.network_key !== "arc-testnet" || source.chain_id !== 5042002) {
  throw new Error("Known evidence source must remain Arc Testnet-only");
}

const sha = (domain, value) => domainHash(domain, value);
const decisionHash = `sha256:${source.decision_hash}`;
const sourceEvidenceHash = `sha256:${source.source_evidence_hash}`;
const envelope = {
  schema: "xpayr.payment-evidence-envelope.v1",
  envelope_id: `pee_${source.proof_id}`,
  revision: 1,
  subject: {
    type: "agent_checkout",
    merchant_ref: sha("XPAYR:MERCHANT-REF:v1", source.merchant_wallet.toLowerCase()),
    payment_session_id: source.payment_session_id,
    proof_id: source.proof_id,
  },
  intent: {
    actor_type: "agent",
    operation: "checkout_split",
    network_key: source.network_key,
    chain_id: source.chain_id,
    token_symbol: source.token_symbol,
    token_address: source.token_address,
    token_decimals: source.token_decimals,
    amount_atomic: source.amount_atomic,
    recipient: source.merchant_wallet,
    route_id: "arc-testnet:splitter:v1",
    intent_hash: decisionHash,
  },
  policy: {
    policy_id: source.intent_id,
    policy_version: 1,
    policy_hash: decisionHash,
    decision: "approved",
    reason_codes: ["agent_policy_approved"],
    evaluated_at: source.verified_at,
  },
  guard: {
    decision_id: source.proof_id,
    verdict: "ALLOW",
    decision_state: "consumed",
    execution_fingerprint: decisionHash,
    profile: "agent_execution_proof.v1",
  },
  quote: {
    quote_id: `afq_${source.payment_session_id}`,
    quote_hash: sha("XPAYR:QUOTE:v1", {
      amount_atomic: source.amount_atomic,
      platform_fee_atomic: source.platform_fee_atomic,
      merchant_net_atomic: source.merchant_net_atomic,
    }),
    gross_amount_atomic: source.amount_atomic,
    customer_fee_atomic: "0",
    platform_fee_atomic: source.platform_fee_atomic,
    merchant_net_atomic: source.merchant_net_atomic,
    fee_bps: 50,
    fee_recipient: source.platform_wallet,
    expires_at: source.verified_at,
  },
  execution: {
    tx_hash: source.tx_hash,
    block_number: source.block_number,
    block_hash: source.block_hash,
    transaction_index: source.transaction_index,
    log_index: source.log_index,
    sender: source.agent_wallet,
    to: source.splitter_contract,
    receipt_status: 1,
    confirmation_count: 1,
    verifier: {
      name: "xpayr_evm_payment_verifier",
      version: "v1",
      evidence_hash: sourceEvidenceHash,
    },
    verified_at: source.verified_at,
  },
  split: {
    payment_id: source.payment_id,
    platform_fee_atomic: source.platform_fee_atomic,
    merchant_net_atomic: source.merchant_net_atomic,
    platform_recipient: source.platform_wallet,
    merchant_recipient: source.merchant_wallet,
  },
  settlement: {
    mode: "atomic_split",
    route_id: "arc-testnet:splitter:v1",
    status: "confirmed",
    source_refs: [`gateway_transaction:${source.tx_hash}`],
    legs: [
      { role: "platform_fee", recipient: source.platform_wallet, amount_atomic: source.platform_fee_atomic },
      { role: "merchant_net", recipient: source.merchant_wallet, amount_atomic: source.merchant_net_atomic },
    ],
    settled_at: source.verified_at,
  },
  reconciliation: {
    payment_status: "completed",
    gateway_status: "confirmed",
    fee_status: "collected",
    webhook: {
      event_type: "payment.completed",
      status: source.webhook_status,
      payload_hash: sha("XPAYR:WEBHOOK-REF:v1", {
        payment_session_id: source.payment_session_id,
        webhook_id: source.webhook_id,
        status: source.webhook_status,
      }),
    },
    checks: {
      intent_bound: true,
      amount_bound: true,
      route_bound: true,
      sender_bound: true,
      split_reconciled: true,
    },
    reconciled_at: source.verified_at,
  },
  provenance: {
    environment: "testnet",
    xpayr_release: "arc-agentic-economy-e2e-20260714",
    chain_manifest_hash: sha("XPAYR:CHAIN-MANIFEST:v1", {
      chain_id: source.chain_id,
      network_key: source.network_key,
      token_address: source.token_address,
      splitter_contract: source.splitter_contract,
    }),
    verifier_artifact_hash: sourceEvidenceHash,
    indexer_fact_hashes: [sha("XPAYR:INDEXER-FACT:v1", {
      block_hash: source.block_hash,
      transaction_index: source.transaction_index,
      log_index: source.log_index,
    })],
  },
  privacy: {
    classification: "merchant_shareable",
    contains_pii: false,
    redacted_fields: ["subject.merchant_ref"],
    retention_class: "payment_audit",
  },
  integrity: {
    canonicalization: "RFC8785-JCS",
    hash_algorithm: "SHA-256",
    previous_revision_hash: null,
    created_at: source.verified_at,
  },
};

const sealed = sealEnvelope(envelope);
const batch = buildMerkleBatch([sealed.integrity.envelope_hash]);
await mkdir(new URL("../examples/", import.meta.url), { recursive: true });
await writeFile(sealedUrl, `${JSON.stringify(sealed, null, 2)}\n`);
await writeFile(batchUrl, `${JSON.stringify(batch, null, 2)}\n`);
console.log(JSON.stringify({
  ok: true,
  envelope_hash: sealed.integrity.envelope_hash,
  merkle_root: batch.merkle_root,
  leaf_count: batch.leaf_count,
}));
