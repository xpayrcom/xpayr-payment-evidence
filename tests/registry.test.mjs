import assert from "node:assert/strict";
import test from "node:test";
import { getAddress } from "ethers";
import { compileRegistry } from "../scripts/lib/compile-registry.mjs";
import { sha256ToBytes32, verifyAnchorRecord } from "../src/registry.mjs";

test("compiles the non-custodial immutable root registry", async () => {
  const artifact = await compileRegistry();
  const names = artifact.abi.filter((entry) => entry.type === "function").map((entry) => entry.name).sort();
  assert.deepEqual(names, ["batches", "owner", "publishRoot", "publishedAt", "publishers", "setPublisher", "transferOwnership"]);
  assert.equal(names.includes("upgradeTo"), false);
  assert.equal(names.includes("execute"), false);
  assert.equal(names.includes("withdraw"), false);
  assert.ok((artifact.deployed_bytecode.length - 2) / 2 < 24_576);
});

test("converts domain SHA-256 values into bytes32", () => {
  assert.equal(sha256ToBytes32(`sha256:${"a".repeat(64)}`), `0x${"a".repeat(64)}`);
  assert.throws(() => sha256ToBytes32("0x1234"));
});

test("validates an anchored batch record", () => {
  const publisher = getAddress("0x9b10F2a258CE9E24E24f7F1c99d20E5ad689fB79");
  const record = {
    merkle_root: `0x${"1".repeat(64)}`,
    leaf_count: 2,
    manifest_hash: `0x${"2".repeat(64)}`,
    publisher,
    published_at: 1_789_000_000,
  };
  assert.deepEqual(verifyAnchorRecord(record, { ...record }), { valid: true, errors: [] });
  assert.deepEqual(verifyAnchorRecord(record, { ...record, leaf_count: 3 }).errors, ["leaf_count_mismatch"]);
});
