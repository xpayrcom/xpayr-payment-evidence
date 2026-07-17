# XPayr Payment Evidence

[![CI](https://github.com/xpayrcom/xpayr-payment-evidence/actions/workflows/ci.yml/badge.svg)](https://github.com/xpayrcom/xpayr-payment-evidence/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-0f766e.svg)](LICENSE)

Canonical payment-evidence envelopes, deterministic hashing, and Merkle inclusion proofs for independently verifiable XPayr receipts.

> **Status:** Experimental reference · no production anchoring

## Purpose

Package facts already verified by XPAYR into portable evidence without pretending that a hash or Merkle proof creates payment truth.

## Included

- Canonical JSON and domain-separated envelope hashes
- Sorted-pair Keccak Merkle batches and inclusion proofs
- Privacy-safe evidence schema and verification CLI

## Quick start

```bash
npm install
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

The schema forbids secret-shaped fields, uses atomic-unit strings for blockchain amounts, and marks `payment_status_mutation_allowed: false` in verification output. This repository does not deploy an anchor contract or submit a transaction.

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
