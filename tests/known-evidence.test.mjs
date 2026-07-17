import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildMerkleBatch, verifyEnvelope, verifyProof } from "../src/index.mjs";

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

test("ships a sealed envelope for a real Arc Testnet payment", async () => {
  const [source, envelope, savedBatch] = await Promise.all([
    read("../examples/arc-testnet-agent-payment.source.json"),
    read("../examples/arc-testnet-agent-payment.sealed.json"),
    read("../examples/arc-testnet-agent-payment.batch.json"),
  ]);
  const verification = verifyEnvelope(envelope);
  assert.equal(verification.valid, true);
  assert.equal(envelope.execution.tx_hash, source.tx_hash);
  assert.equal(envelope.intent.amount_atomic, source.amount_atomic);
  assert.equal(envelope.reconciliation.payment_status, "completed");
  const batch = buildMerkleBatch([envelope.integrity.envelope_hash]);
  assert.deepEqual(batch, savedBatch);
  assert.equal(verifyProof(envelope.integrity.envelope_hash, batch.proofs[envelope.integrity.envelope_hash], batch.merkle_root), true);
});
