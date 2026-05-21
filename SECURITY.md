# Security Policy

## Supported Versions

Priyx provides security updates for the actively maintained Priyx release
line.

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |

## Reporting a Vulnerability

Do not open a public issue for a security vulnerability.

Send the report through the official Priyx security contact or private
project support channel. Include:

- Affected version or commit.
- Steps to reproduce.
- Impact and expected behavior.
- Any relevant logs with secrets redacted.

Priyx will review the report, confirm impact where possible, and publish a
fix or mitigation when appropriate.

## Secret Handling

Never commit `.env`, bot tokens, API keys, database passwords, Redis passwords,
private keys, or production credentials. Rotate any secret that may have been
exposed.
