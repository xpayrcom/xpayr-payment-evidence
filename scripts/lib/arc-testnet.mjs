import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { JsonRpcProvider, Wallet, getAddress } from "ethers";

export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_TESTNET_RPC_URL = "https://rpc.testnet.arc.network";
export const ARC_TESTNET_EXPLORER_URL = "https://testnet.arcscan.app";
export const ARC_TESTNET_ACK = "ARC_TESTNET_ONLY";

export function requireArcTestnetAck() {
  if (process.env.XPAYR_EVIDENCE_ACK !== ARC_TESTNET_ACK) {
    throw new Error(`Set XPAYR_EVIDENCE_ACK=${ARC_TESTNET_ACK} to confirm Arc Testnet-only execution`);
  }
}

export function createProvider() {
  const rpcUrl = process.env.ARC_TESTNET_RPC_URL || ARC_TESTNET_RPC_URL;
  return new JsonRpcProvider(rpcUrl, ARC_TESTNET_CHAIN_ID, { staticNetwork: true, batchMaxCount: 1 });
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const isRateLimited = (error) => error?.info?.error?.code === -32011
  || /request limit reached/i.test(String(error?.message || ""));

export async function rpcRead(label, operation) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const result = await operation();
      await sleep(350);
      return result;
    } catch (error) {
      if (!isRateLimited(error) || attempt === 6) throw new Error(`${label} failed`, { cause: error });
      await sleep(Math.min(1_000 * attempt, 5_000));
    }
  }
  throw new Error(`${label} exhausted its retry budget`);
}

export async function assertArcTestnet(provider) {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== ARC_TESTNET_CHAIN_ID) {
    throw new Error(`Refusing unexpected chain ${network.chainId}; expected Arc Testnet ${ARC_TESTNET_CHAIN_ID}`);
  }
  return network;
}

export function createSigner(provider) {
  const privateKey = String(process.env.XPAYR_EVIDENCE_PUBLISHER_PRIVATE_KEY || "").trim();
  if (!/^(?:0x)?[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("XPAYR_EVIDENCE_PUBLISHER_PRIVATE_KEY is required and must be a 32-byte hex key");
  }
  return new Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`, provider);
}

export function requiredAddress(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return getAddress(value);
}

export async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

export async function writeJsonAtomic(url, value) {
  await mkdir(new URL("./", url), { recursive: true });
  const temporary = new URL(`${url.pathname}.tmp-${process.pid}`, url);
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, url);
}
