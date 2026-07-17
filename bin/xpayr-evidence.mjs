#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { buildMerkleBatch, envelopeHash, sealEnvelope, verifyEnvelope, verifyProof } from "../src/index.mjs";

const [command, ...args] = process.argv.slice(2);
const load = async (path) => JSON.parse(await readFile(path, "utf8"));
const output = (value) => console.log(JSON.stringify(value, null, 2));

if (!command || ["help", "--help", "-h"].includes(command)) {
  console.log("Usage: xpayr-evidence <hash|seal|verify|batch|proof> <file...>");
  process.exit(0);
}
if (command === "hash" && args.length === 1) output({ envelope_hash: envelopeHash(await load(args[0])) });
else if (command === "seal" && args.length === 1) output(sealEnvelope(await load(args[0])));
else if (command === "verify" && args.length === 1) { const result = verifyEnvelope(await load(args[0])); output(result); if (!result.valid) process.exitCode = 1; }
else if (command === "batch" && args.length > 0) {
  const envelopes = await Promise.all(args.map(load));
  const hashes = envelopes.map((envelope) => {
    const result = verifyEnvelope(envelope);
    if (!result.valid) throw new Error(`Unverified envelope in batch: ${result.errors.join(",")}`);
    return result.computed_hash;
  });
  output(buildMerkleBatch(hashes));
}
else if (command === "proof" && args.length === 2) { const batch = await load(args[0]); const hash = args[1]; output({ valid: verifyProof(hash, batch.proofs?.[hash], batch.merkle_root) }); }
else { console.error("Invalid command or arguments. Run with --help."); process.exitCode = 2; }
