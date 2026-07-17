import { readFile } from "node:fs/promises";
import solc from "solc";

const sourceUrl = new URL("../../contracts/XPayrEvidenceRootRegistry.sol", import.meta.url);

export async function compileRegistry() {
  const source = await readFile(sourceUrl, "utf8");
  const input = {
    language: "Solidity",
    sources: { "XPayrEvidenceRootRegistry.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "metadata"] },
      },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((entry) => entry.severity === "error");
  if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
  const contract = output.contracts?.["XPayrEvidenceRootRegistry.sol"]?.XPayrEvidenceRootRegistry;
  if (!contract?.evm?.bytecode?.object) throw new Error("Registry compiler produced no bytecode");
  return {
    compiler_version: solc.version(),
    source_name: "XPayrEvidenceRootRegistry.sol",
    contract_name: "XPayrEvidenceRootRegistry",
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
    deployed_bytecode: `0x${contract.evm.deployedBytecode.object}`,
    metadata: JSON.parse(contract.metadata),
  };
}
