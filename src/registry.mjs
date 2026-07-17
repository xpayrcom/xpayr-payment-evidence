import { Contract, getAddress } from "ethers";

export const EVIDENCE_REGISTRY_ABI = [
  "function owner() view returns (address)",
  "function publishers(address) view returns (bool)",
  "function batches(bytes32) view returns (bytes32 merkleRoot,uint64 leafCount,bytes32 manifestHash,address publisher)",
  "function publishedAt(bytes32) view returns (uint64)",
  "function publishRoot(bytes32,bytes32,uint64,bytes32)",
  "function setPublisher(address,bool)",
  "function transferOwnership(address)",
  "event EvidenceRootPublished(bytes32 indexed batchId,bytes32 indexed merkleRoot,uint64 leafCount,bytes32 manifestHash,address publisher)",
];

export function sha256ToBytes32(value) {
  if (!/^sha256:[a-f0-9]{64}$/i.test(String(value))) throw new TypeError("Expected sha256:<64 hex> value");
  return `0x${String(value).slice(7).toLowerCase()}`;
}

export async function readAnchoredBatch(provider, contractAddress, batchId) {
  const contract = new Contract(getAddress(contractAddress), EVIDENCE_REGISTRY_ABI, provider);
  const batch = await contract.batches(batchId);
  const publishedAt = await contract.publishedAt(batchId);
  return {
    merkle_root: batch.merkleRoot,
    leaf_count: Number(batch.leafCount),
    manifest_hash: batch.manifestHash,
    publisher: batch.publisher,
    published_at: Number(publishedAt),
  };
}

export function verifyAnchorRecord(anchor, expected) {
  const errors = [];
  if (String(anchor.merkle_root).toLowerCase() !== String(expected.merkle_root).toLowerCase()) errors.push("merkle_root_mismatch");
  if (anchor.leaf_count !== expected.leaf_count) errors.push("leaf_count_mismatch");
  if (String(anchor.manifest_hash).toLowerCase() !== String(expected.manifest_hash).toLowerCase()) errors.push("manifest_hash_mismatch");
  if (expected.publisher && getAddress(anchor.publisher) !== getAddress(expected.publisher)) errors.push("publisher_mismatch");
  if (!Number.isSafeInteger(anchor.published_at) || anchor.published_at <= 0) errors.push("published_at_invalid");
  return { valid: errors.length === 0, errors };
}
