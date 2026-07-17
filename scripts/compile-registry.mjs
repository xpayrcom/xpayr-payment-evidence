import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { compileRegistry } from "./lib/compile-registry.mjs";

const artifact = await compileRegistry();
const runtimeBytes = (artifact.deployed_bytecode.length - 2) / 2;
assert.ok(runtimeBytes > 0 && runtimeBytes < 24_576, "Registry runtime exceeds EIP-170 size limit");
await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../artifacts/XPayrEvidenceRootRegistry.json", import.meta.url),
  `${JSON.stringify(artifact, null, 2)}\n`,
  { mode: 0o600 },
);
console.log(JSON.stringify({ ok: true, compiler: artifact.compiler_version, runtime_bytes: runtimeBytes }));
