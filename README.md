# XPayr Payment Evidence

[![CI](https://github.com/xpayrcom/xpayr-payment-evidence/actions/workflows/ci.yml/badge.svg)](https://github.com/xpayrcom/xpayr-payment-evidence/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-0f766e.svg)](LICENSE)

Canonical payment-evidence envelopes, deterministic hashing, and Merkle inclusion proofs for independently verifiable XPayr receipts.

> **Status:** Arc Testnet anchor verified · Arc Mainnet remains disabled

## Purpose

Package facts already verified by XPAYR into portable evidence without pretending that a hash or Merkle proof creates payment truth.

## Included

- Canonical JSON and domain-separated envelope hashes
- Sorted-pair Keccak Merkle batches and inclusion proofs
- Privacy-safe evidence schema and verification CLI
- Non-custodial immutable-root registry with a real Arc Testnet anchor

## Quick start

```bash
npm install @xpayr/payment-evidence
```

For repository development:

```bash
npm ci
npm test
node ./bin/xpayr-evidence.mjs --help
```

## Evidence is not payment truth

An envelope packages facts that XPayr has already verified. Canonical JSON, hashes, and Merkle proofs detect mutation and prove inclusion in a specific batch; they do not prove that the original facts were correct. The XPayr receipt verifier and reconciliation state remain authoritative.

```bash
xpayr-evidence seal envelope.json > sealed.json
xpayr-evidence verify sealed.json
xpayr-evidence batch sealed-a.json sealed-b.json > batch.json
```

The schema forbids secret-shaped fields, uses atomic-unit strings for blockchain amounts, and marks `payment_status_mutation_allowed: false` in verification output. The registry cannot hold funds, approve tokens, execute arbitrary calls, upgrade itself, or mutate XPayr payment state.

## Verified Arc Testnet anchor

The repository ships a sealed envelope for a real XPayr Arc Testnet agent payment and its independently reproducible on-chain anchor.

| Item | Value |
| --- | --- |
| Network | Arc Testnet (`5042002`) |
| Registry | [`0xf2B78A7A32Eb390827D272Dbd175Aa48341646ba`](https://testnet.arcscan.app/address/0xf2B78A7A32Eb390827D272Dbd175Aa48341646ba) |
| Root transaction | [`0x7ae84fee1f3f00fb96d136aa908be2651743238342dace3fcf4bdf00383614b2`](https://testnet.arcscan.app/tx/0x7ae84fee1f3f00fb96d136aa908be2651743238342dace3fcf4bdf00383614b2) |
| Merkle root | `0x049b78193f72b821cdcb2f2a76f4bba307a184e1dc69f0aa265e7448cba248f2` |

Run the same read-only RPC verification locally:

```bash
npm run verify:arc-testnet
```

The deployment owner is the deterministic XPayr 2-of-3 Safe address. That address currently has no bytecode on Arc Testnet, so owner-only publisher rotation is intentionally unavailable there; existing roots remain immutable and the allowlisted publisher can only append new roots. This Testnet governance constraint is recorded in [`deployments/arc-testnet.json`](deployments/arc-testnet.json). It must be resolved before any future Mainnet deployment.

Arc Mainnet deployment and publishing are not supported by these scripts. Every write command requires the explicit `ARC_TESTNET_ONLY` acknowledgement and verifies chain ID `5042002` before signing.

Use an XPayr test key before live credentials. Never expose `sk_test_*`, `sk_live_*`, agent keys, webhook secrets, or wallet private keys in browser code or commits.

## Documentation

- [Developer Hub](https://xpayr.com/developers)
- [Merchant API documentation](https://xpayr.com/doc-api)
- [Testnet checkout guide](https://xpayr.com/developers/testnet-checkout-api)
- [Webhook signature guide](https://xpayr.com/developers/webhook-signature-guide)

## Security

Read [SECURITY.md](SECURITY.md) before reporting a vulnerability. Payment completion must be based on verified XPayr webhook/API state and canonical on-chain evidence, not browser callbacks alone.

## License

MIT. See [LICENSE](LICENSE).
