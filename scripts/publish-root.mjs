import { Contract, getAddress, keccak256, solidityPacked, zeroPadValue, toBeHex } from "ethers";
import { buildMerkleBatch, verifyEnvelope } from "../src/index.mjs";
import { EVIDENCE_REGISTRY_ABI, readAnchoredBatch, sha256ToBytes32, verifyAnchorRecord } from "../src/registry.mjs";
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_EXPLORER_URL,
  assertArcTestnet,
  createProvider,
  createSigner,
  readJson,
  requireArcTestnetAck,
  rpcRead,
  writeJsonAtomic,
} from "./lib/arc-testnet.mjs";

requireArcTestnetAck();
const provider = createProvider();
await assertArcTestnet(provider);
const signer = createSigner(provider);
const deployment = await readJson(new URL("../deployments/arc-testnet.json", import.meta.url));
if (deployment.environment !== "arc-testnet" || deployment.chain_id !== ARC_TESTNET_CHAIN_ID) {
  throw new Error("Deployment manifest is not Arc Testnet");
}
const contractAddress = getAddress(deployment.contract_address);
const code = await rpcRead("evidence registry bytecode", () => provider.getCode(contractAddress));
if (code === "0x") throw new Error("Evidence registry contract is not deployed");
const envelope = await readJson(new URL("../examples/arc-testnet-agent-payment.sealed.json", import.meta.url));
const envelopeVerification = verifyEnvelope(envelope);
if (!envelopeVerification.valid) throw new Error(`Known evidence envelope invalid: ${envelopeVerification.errors.join(",")}`);
const batch = buildMerkleBatch([envelope.integrity.envelope_hash]);
const manifestHash = sha256ToBytes32(batch.manifest_hash);
const batchId = keccak256(solidityPacked(
  ["bytes32", "bytes32", "uint64"],
  [batch.merkle_root, manifestHash, zeroPadValue(toBeHex(batch.leaf_count), 8)],
));
const contract = new Contract(contractAddress, EVIDENCE_REGISTRY_ABI, signer);
if (await rpcRead("publisher authorization", () => contract.publishers(signer.address)) !== true) {
  throw new Error("Signer is not an authorized evidence publisher");
}

const existing = await rpcRead("existing evidence batch", () => readAnchoredBatch(provider, contractAddress, batchId));
let txHash = null;
let blockNumber = null;
if (existing.publisher === "0x0000000000000000000000000000000000000000") {
  const gasEstimate = await rpcRead("evidence root gas estimate", () => contract.publishRoot.estimateGas(
    batchId,
    batch.merkle_root,
    batch.leaf_count,
    manifestHash,
  ));
  const tx = await contract.publishRoot(
    batchId,
    batch.merkle_root,
    batch.leaf_count,
    manifestHash,
    { gasLimit: (gasEstimate * 120n) / 100n },
  );
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error("Evidence root publication failed");
  txHash = tx.hash;
  blockNumber = receipt.blockNumber;
}

const anchored = await rpcRead("published evidence batch", () => readAnchoredBatch(provider, contractAddress, batchId));
const expected = {
  merkle_root: batch.merkle_root,
  leaf_count: batch.leaf_count,
  manifest_hash: manifestHash,
  publisher: signer.address,
};
const verification = verifyAnchorRecord(anchored, expected);
if (!verification.valid) throw new Error(`On-chain anchor mismatch: ${verification.errors.join(",")}`);
const anchor = {
  schema: "xpayr.payment-evidence-anchor.v1",
  environment: "arc-testnet",
  chain_id: ARC_TESTNET_CHAIN_ID,
  registry_address: contractAddress,
  batch_id: batchId,
  merkle_root: batch.merkle_root,
  manifest_hash: manifestHash,
  leaf_count: batch.leaf_count,
  publisher: getAddress(anchored.publisher),
  published_at: anchored.published_at,
  publication_tx_hash: txHash,
  publication_block_number: blockNumber,
  envelope_hashes: batch.manifest.map((entry) => entry.envelope_hash),
  explorer_url: txHash ? `${ARC_TESTNET_EXPLORER_URL}/tx/${txHash}` : deployment.explorer_url,
};
await writeJsonAtomic(new URL("../anchors/arc-testnet-agent-payment.json", import.meta.url), anchor);
console.log(JSON.stringify({ ok: true, ...anchor }));
