import { ContractFactory, formatEther, getAddress, keccak256 } from "ethers";
import { compileRegistry } from "./lib/compile-registry.mjs";
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_EXPLORER_URL,
  assertArcTestnet,
  createProvider,
  createSigner,
  requireArcTestnetAck,
  requiredAddress,
  rpcRead,
  writeJsonAtomic,
} from "./lib/arc-testnet.mjs";

requireArcTestnetAck();
const provider = createProvider();
await assertArcTestnet(provider);
const signer = createSigner(provider);
const owner = requiredAddress("XPAYR_EVIDENCE_OWNER");
const publisher = process.env.XPAYR_EVIDENCE_PUBLISHER
  ? getAddress(process.env.XPAYR_EVIDENCE_PUBLISHER)
  : signer.address;
if (publisher !== signer.address) {
  throw new Error("Initial publisher must be the deployment signer for the first anchored batch");
}

const compiled = await compileRegistry();
const factory = new ContractFactory(compiled.abi, compiled.bytecode, signer);
const deployTx = await factory.getDeployTransaction(owner, publisher);
const balance = await rpcRead("publisher gas balance", () => provider.getBalance(signer.address));
const gasEstimate = await rpcRead("registry deployment gas estimate", () => provider.estimateGas({ ...deployTx, from: signer.address }));
const feeData = await rpcRead("Arc Testnet fee data", () => provider.getFeeData());
const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
if (!gasPrice) throw new Error("Arc Testnet RPC returned no usable gas price");
const estimatedCost = gasEstimate * gasPrice;
if (balance < estimatedCost) {
  throw new Error(`Insufficient Arc Testnet gas: balance=${formatEther(balance)} estimated=${formatEther(estimatedCost)}`);
}

const contract = await factory.deploy(owner, publisher, { gasLimit: (gasEstimate * 120n) / 100n });
const transaction = contract.deploymentTransaction();
if (!transaction) throw new Error("Deployment transaction unavailable");
const receipt = await transaction.wait();
if (!receipt || receipt.status !== 1) throw new Error("Registry deployment failed");
const address = await contract.getAddress();
const code = await rpcRead("deployed registry bytecode", () => provider.getCode(address));
if (code === "0x" || keccak256(code) !== keccak256(compiled.deployed_bytecode)) {
  throw new Error("Deployed runtime bytecode does not match the compiled registry");
}
const storedOwner = await rpcRead("registry owner", () => contract.owner());
const publisherAllowed = await rpcRead("registry publisher status", () => contract.publishers(publisher));
if (getAddress(storedOwner) !== owner || publisherAllowed !== true) {
  throw new Error("Registry owner/publisher post-deploy verification failed");
}

const ownerCode = await rpcRead("registry owner bytecode", () => provider.getCode(owner));
const manifest = {
  schema: "xpayr.evidence-registry-deployment.v1",
  environment: "arc-testnet",
  chain_id: ARC_TESTNET_CHAIN_ID,
  contract_name: compiled.contract_name,
  contract_address: address,
  owner,
  owner_code_present: ownerCode !== "0x",
  owner_activation_state: ownerCode === "0x" ? "deterministic-safe-not-deployed-on-arc-testnet" : "active-contract-owner",
  initial_publisher: publisher,
  deployment_tx_hash: transaction.hash,
  deployment_block_number: receipt.blockNumber,
  runtime_bytecode_hash: keccak256(code),
  compiler_version: compiled.compiler_version,
  explorer_url: `${ARC_TESTNET_EXPLORER_URL}/address/${address}`,
};
await writeJsonAtomic(new URL("../deployments/arc-testnet.json", import.meta.url), manifest);
console.log(JSON.stringify({ ok: true, ...manifest }));
