# Security Policy

## Reporting a vulnerability

Do not disclose suspected vulnerabilities in a public issue.

Use the [XPayr contact form](https://xpayr.com/contact) and include the repository name, affected version or commit, reproduction steps, and impact. Do not include private keys, seed phrases, live API keys, customer data, or unredacted production logs.

## Secret handling

- Use test credentials first.
- Keep merchant secret keys on the server.
- Commit only placeholder values through `.env.example`.
- Never submit wallet private keys or seed phrases.

This repository contains client code or reference integrations. It does not authorize production access, hold merchant funds, or replace on-chain receipt verification.
