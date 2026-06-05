# Contributing to Chain Screener Frontend

Thank you for your interest in contributing! This document explains how to get started.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to uphold it.

## How to Contribute

### Reporting Bugs

Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.yml) issue template. Include:
- Steps to reproduce
- Expected vs. actual behaviour
- Browser, OS, and `NEXT_PUBLIC_API_URL` value

### Requesting Features

Use the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.yml) issue template.

### Reporting Security Vulnerabilities

**Do not open a public issue.** See [SECURITY.md](SECURITY.md) for the private disclosure process.

## Development Workflow

1. **Fork** the repository and clone your fork.
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Install dependencies**:
   ```bash
   npm install
   cp .env.example .env
   ```
4. **Start the dev server**:
   ```bash
   npm run dev
   ```
5. **Make your changes.**
6. **Run lint** before committing:
   ```bash
   npm run lint
   ```
7. **Build** to catch TypeScript and Next.js errors:
   ```bash
   npm run build
   ```
8. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: add wallet sparkline to top-gainers table`
   - `fix: resolve hydration mismatch on token page`
   - `docs: update env variable table in README`
   - `chore: upgrade next to 15.x`
9. **Push** your branch and open a **Pull Request** against `main`.
10. Fill in the PR template completely.
11. A maintainer will review. Address any feedback, then a maintainer merges.

## Pull Request Requirements

- All CI checks must pass (lint + build).
- At least 1 maintainer approval is required.
- All review conversations must be resolved.
- No direct pushes to `main` — PRs only.

## Project Structure

```
app/               Next.js App Router pages
  dashboard/
  launches/
  top-gainers/
  smart-money/
  holder-analysis/
  risk-scanner/
  token/[address]/
  wallet/[address]/
components/        Shared React components
  charts/          Chart components (candlestick, etc.)
lib/               API client, types, and utilities
public/            Static assets
```

## Environment Variables

See [.env.example](.env.example) for all required and optional variables. Never commit a `.env` file.

## Questions

Open a [Discussion](https://github.com/Ship-Hub/ChainScreener-frontend/discussions) for questions that are not bugs or feature requests.
