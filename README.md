# Pitch Resonance — The Living Match

A cinematic, multiplayer fan experience that reimagines how we consume live football. Every touch, pass, and shot physically deforms a woven GLSL fabric in real-time, driven by **TxODDS live API**. Fans send micro-tips via **Solana** to cheer for their team, triggering shockwaves across the 3D pitch. When the final whistle blows, the Victory Purse smart contract automatically distributes pooled tips to the winning team's supporters.

## Architecture

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  TxODDS SSE  │────▶│  Backend (Node.js)    │────▶│  Frontend (Next) │
│  Live Data   │     │  + Socket.io + SQLite │     │  + R3F + Solana  │
└─────────────┘     │  + Solana Listener    │     └─────────────────┘
                    │  + Replay Engine      │
                    └──────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Solana Devnet   │
                    │  Victory Purse   │
                    │  (Anchor 0.30)   │
                    └─────────────────┘
```

### Frontend (`/frontend`)
- **Next.js 14** with App Router
- **React Three Fiber** — 256×256 vertex shader terrain
- **Custom GLSL** — woven fabric fragment shader + shockwave vertex displacement
- **Hype Bar** — CSS tug-of-war, driven by Solana tips
- **Match History** — browse and replay past matches with playback controls
- **Solana Blinks** — tip and claim directly from X/Twitter

### Backend (`/backend`)
- **Express + Socket.io** — real-time data relay
- **TxODDS SSE Client** — ingests live scores stream
- **PitchGrid** — maps events to 256×256 Float32Array with decay
- **SQLite (better-sqlite3)** — event recording for historical replay
- **Solana Listener** — monitors `onLogs` for tip confirmations
- **Replay Engine** — timed event playback at configurable speed

### Smart Contract (`/contract`)
- **Anchor 0.30** — Rust program on Solana Devnet
- **Victory Purse** — parimutuel tipping pool
- **Instructions**: `initialize_pool`, `cheer_for_team`, `settle_match`, `claim_winnings`
- **3% platform fee**, proportional payout calculation

## Quick Start

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && npm install && npm run dev

# Contract (requires Solana CLI + Anchor)
cd contract && anchor build && anchor deploy
```

## Environment Variables

See `.env.example` files in each directory. Required vars:

### Frontend
- `NEXT_PUBLIC_BACKEND_URL` — Socket.io server URL
- `NEXT_PUBLIC_SOLANA_RPC` — Solana RPC endpoint
- `NEXT_PUBLIC_PROGRAM_ID` — Deployed contract address
- `NEXT_PUBLIC_SITE_URL` — For Blinks metadata

### Backend
- `TXODDS_JWT` + `TXODDS_API_TOKEN` — From TxLINE activation
- `SOLANA_RPC` + `PROGRAM_ID` — Solana connection
- `ADMIN_SECRET_KEY` — Base58 admin keypair for settlement

## TxODDS Activation (Free World Cup Tier)

1. Fund wallet with devnet SOL
2. Subscribe on-chain using TxLINE program
3. Get guest JWT from `/auth/guest/start`
4. Sign activation + call `/api/token/activate`
5. Use credentials in backend `.env`

World Cup schedule is active June-July 2026. See [TxLINE Schedule](https://txline-docs.txodds.com/documentation/scores/schedule).

## Video Demo Checklist

- [ ] 0:00-0:15: 3D pitch deforming live
- [ ] 0:15-0:30: TxODDS data → shader pipeline
- [ ] 0:30-0:50: Fan tipping → Hype Bar → shockwave
- [ ] 0:50-1:10: Match ends → settlement → claim
- [ ] 1:10-1:30: Solana Blink on X/Twitter
- [ ] 1:30-2:00: Tech stack summary

## License

MIT
