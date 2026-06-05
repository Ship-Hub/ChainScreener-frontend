# Chain Screener Frontend

[![CI](https://github.com/Ship-Hub/ChainScreener-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/Ship-Hub/ChainScreener-frontend/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Next.js 15 dashboard for real-time token launch intelligence. Connects to the [Chain Screener API](https://github.com/Ship-Hub/chain-screener-api) to display live on-chain data, smart-wallet analytics, candlestick charts, and risk signals across Base, Ethereum, and BNB Chain.

## Features

- Live token launch feed with price and volume
- Candlestick charts powered by lightweight-charts
- Smart money wallet tracking
- Holder distribution analysis
- Risk scanner with on-chain signals
- Top gainers leaderboard
- Mobile-responsive navigation

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, Tailwind CSS
- **Charts**: lightweight-charts, Recharts
- **Icons**: Lucide React
- **Language**: TypeScript

## Prerequisites

- Node.js 20+
- [Chain Screener API](https://github.com/Ship-Hub/chain-screener-api) running locally or remotely

## Quick Start

```bash
git clone https://github.com/Ship-Hub/ChainScreener-frontend.git
cd ChainScreener-frontend
npm install
cp .env.example .env   # set NEXT_PUBLIC_API_URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Chain Screener API base URL |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run Next.js ESLint rules |

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard overview |
| `/launches` | New token launches |
| `/top-gainers` | Top performing tokens |
| `/smart-money` | Smart wallet activity |
| `/holder-analysis` | Holder distribution |
| `/risk-scanner` | On-chain risk signals |
| `/token/:address` | Token detail page |
| `/wallet/:address` | Wallet detail page |

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Security

Please report vulnerabilities privately — see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
