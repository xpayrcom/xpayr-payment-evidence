import { getAddress } from "ethers";
import { buildMerkleBatch, verifyEnvelope, verifyProof } from "../src/index.mjs";
import { readAnchoredBatch, verifyAnchorRecord } from "../src/registry.mjs";
import {
  ARC_TESTNET_CHAIN_ID,
  assertArcTestnet,
  createProvider,
  readJson,
  rpcRead,
} from "./lib/arc-testnet.mjs";

const provider = createProvider();
await assertArcTestnet(provider);
const deployment = await readJson(new URL("../deployments/arc-testnet.json", import.meta.url));
const anchor = await readJson(new URL("../anchors/arc-testnet-agent-payment.json", import.meta.url));
const envelope = await readJson(new URL("../examples/arc-testnet-agent-payment.sealed.json", import.meta.url));
if (deployment.environment !== "arc-testnet" || anchor.environment !== "arc-testnet"
  || deployment.chain_id !== ARC_TESTNET_CHAIN_ID || anchor.chain_id !== ARC_TESTNET_CHAIN_ID) {
  throw new Error("Evidence files must remain Arc Testnet-only");
}
if (getAddress(deployment.contract_address) !== getAddress(anchor.registry_address)) {
  throw new Error("Anchor registry does not match deployment manifest");
}
const envelopeVerification = verifyEnvelope(envelope);
if (!envelopeVerification.valid) throw new Error(`Envelope invalid: ${envelopeVerification.errors.join(",")}`);
const batch = buildMerkleBatch([envelope.integrity.envelope_hash]);
if (!verifyProof(envelope.integrity.envelope_hash, batch.proofs[envelope.integrity.envelope_hash], batch.merkle_root)) {
  throw new Error("Envelope Merkle proof failed");
}
const receipt = anchor.publication_tx_hash
  ? await rpcRead("anchor publication receipt", () => provider.getTransactionReceipt(anchor.publication_tx_hash))
  : null;
if (anchor.publication_tx_hash && (!receipt || receipt.status !== 1)) {
  throw new Error("Anchor publication receipt is missing or failed");
}
const anchored = await rpcRead("anchored evidence batch", () => readAnchoredBatch(provider, anchor.registry_address, anchor.batch_id));
const verification = verifyAnchorRecord(anchored, {
  merkle_root: batch.merkle_root,
  leaf_count: batch.leaf_count,
  manifest_hash: anchor.manifest_hash,
  publisher: anchor.publisher,
});
if (!verification.valid) throw new Error(`On-chain anchor mismatch: ${verification.errors.join(",")}`);
console.log(JSON.stringify({
  ok: true,
  chain_id: ARC_TESTNET_CHAIN_ID,
  registry_address: anchor.registry_address,
  batch_id: anchor.batch_id,
  envelope_hash: envelope.integrity.envelope_hash,
  merkle_root: batch.merkle_root,
  publication_tx_hash: anchor.publication_tx_hash,
  payment_status_mutation_allowed: false,
}));
