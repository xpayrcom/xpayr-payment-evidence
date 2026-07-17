import { concat, getBytes, keccak256 } from "ethers";
import { domainHash, normalizeSha256 } from "./jcs.mjs";

export const TREE_ALGORITHM = "xpayr.keccak256.sorted-pairs.v1";
const compareHex = (left, right) => Buffer.compare(Buffer.from(getBytes(left)), Buffer.from(getBytes(right)));

export function leafHash(envelopeHash) {
  const normalized = normalizeSha256(envelopeHash);
  return keccak256(concat([Uint8Array.from([0]), getBytes(`0x${normalized.slice(7)}`)]));
}

export function nodeHash(left, right) {
  const ordered = compareHex(left, right) <= 0 ? [left, right] : [right, left];
  return keccak256(concat([Uint8Array.from([1]), getBytes(ordered[0]), getBytes(ordered[1])]));
}

export function buildMerkleBatch(envelopeHashes) {
  if (!Array.isArray(envelopeHashes) || envelopeHashes.length < 1 || envelopeHashes.length > 1000) throw new TypeError("Evidence batch must contain between 1 and 1000 leaves");
  const normalized = envelopeHashes.map(normalizeSha256);
  if (new Set(normalized).size !== normalized.length) throw new TypeError("Duplicate envelope hashes are forbidden");
  const entries = normalized.map((envelope_hash) => ({ envelope_hash, leaf_hash: leafHash(envelope_hash) })).sort((a, b) => compareHex(a.leaf_hash, b.leaf_hash));
  const levels = [entries.map((entry) => entry.leaf_hash)];
  while (levels.at(-1).length > 1) {
    const current = levels.at(-1);
    const next = [];
    for (let index = 0; index < current.length; index += 2) next.push(nodeHash(current[index], current[index + 1] ?? current[index]));
    levels.push(next);
  }
  const proofs = {};
  entries.forEach((entry, leafIndex) => {
    let index = leafIndex;
    proofs[entry.envelope_hash] = [];
    for (let level = 0; level < levels.length - 1; level++) {
      const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
      proofs[entry.envelope_hash].push({ sibling_hash: levels[level][siblingIndex] ?? levels[level][index], tree_algorithm: TREE_ALGORITHM });
      index = Math.floor(index / 2);
    }
  });
  const manifest = entries.map((entry, leaf_index) => ({ leaf_index, ...entry }));
  return { tree_algorithm: TREE_ALGORITHM, leaf_count: entries.length, merkle_root: levels.at(-1)[0], manifest_hash: domainHash("XPAYR:MANIFEST:v1", manifest), manifest, proofs };
}

export function verifyProof(envelopeHash, proof, expectedRoot) {
  if (!Array.isArray(proof) || typeof expectedRoot !== "string") return false;
  try {
    let current = leafHash(envelopeHash);
    for (const entry of proof) {
      if (entry?.tree_algorithm !== TREE_ALGORITHM) return false;
      current = nodeHash(current, entry.sibling_hash);
    }
    return current.toLowerCase() === expectedRoot.toLowerCase();
  } catch { return false; }
}
