# Pitch Resonance — Agent Instructions

## Project Structure

```
pitch-resonance/
├── backend/          # Node.js + Socket.io + TxODDS + Historical + Physics Engine (Railway)
│   ├── src/auth/      — Solana wallet auth (nonce→sign→verify→JWT)
│   ├── src/db/        — SQLite client (matches, events, fixtures, frames)
│   ├── src/historical/ — TxODDS historical SSE converter + loader
│   ├── src/physics/   — Physics Vector Engine (lightweight shader params)
│   ├── src/replay/    — Frame-by-frame replay engine
│   ├── src/socket/    — Socket.io event constants
│   ├── src/solana/    — On-chain listener + match settler
│   └── src/txodds/    — Live SSE client + PitchGrid parser + simulator
├── contract/          # Anchor program (Solana Devnet)
└── tools/             # One-off utility scripts
```

## Commands

### Backend
- `npm run dev` — dev server on :4000
- `npm run build` — compile TS
- `npm start` — run compiled JS
- `npm run fetch-historical` — batch-fetch all World Cup fixtures into SQLite

### Contract
- `cd contract && anchor build` — compile program
- `cd contract && anchor deploy` — deploy to devnet
- `cd contract && anchor test` — run tests

## Historical DB (already loaded)

22 World Cup fixtures in `backend/data/pitch.db` (~5.5 GB, 22,022 frames).

Check loaded fixtures:
```
curl http://localhost:4000/api/historical/fixtures
curl http://localhost:4000/api/physics/fixtures
```

## API Endpoints

### Historical (raw pixelData)
- `POST /api/historical/load` — fetch + convert + cache in SQLite
- `GET /api/historical/frames/:fixtureId` — raw frame data (?start=N&end=N&stride=10)
- `GET /api/historical/fixtures` — list loaded fixtures

### Physics (lightweight shader params)
- `GET /api/physics/frames/:fixtureId` — physics frames (?stride=1 for all)
- `GET /api/physics/fixtures` — list loaded fixtures

### Auth (Solana wallet)
- `POST /api/auth/nonce` — get nonce to sign `{ wallet }`
- `POST /api/auth/verify` — verify signature `{ wallet, signature, nonce }`
- `GET /api/auth/me` — check JWT validity (Authorization: Bearer <token>)

## Physics Vector Engine

`backend/src/physics/engine.ts` converts 256×256 pixelData into compact shader params (~100 bytes per frame vs 262 KB raw):

| Param | Range | Description |
|-------|-------|-------------|
| turfAmplitude | 0–1 | Overall heat intensity (avg pixel × 4, clamped) |
| rippleCenter.x/y | 0–255 | Center-of-mass of hot pixels |
| rippleAge | 0–1 | 0 = fresh action (maxHeat > 0.5), 1 = stale |
| territoryFactor | -1–1 | -1 = away dominates, +1 = home dominates |
| quadrants | [4] | Normalized heat share in TL/TR/BL/BR |
| waveAngle | rad | Direction from ball to opponent heat center |
| waveFrequency | 0–1 | Hot-pixel density × 5 (tempo of play) |

Frame data fields passed through: `possession`, `ballX`, `ballY`, `homeScore`, `awayScore`, `phase`, `seq`, `clockSec`, `action`, `team`.

## Socket.io Events (live + replay)

- `pitch:update` — raw pixelData (legacy, 256KB per frame)
- `pitch:physics_frame` — lightweight PhysicsFrame (~100 bytes per frame)
- `hype:update` — pool changes on tip
- `match:state` — current match state
- `game:finalised` — full-time signal
- `shockwave:trigger` — on-chain tip shockwave
- `state:sync` — full state on reconnect
- `replay:*` — seek/pause/resume/speed

## Data Flow

```
TxODDS SSE → client.ts → PitchGrid → computePhysicsFrame() → pitch:physics_frame (Socket.io)
Historical  → converter.ts → PitchGrid → DB → physics API
Solana logs → listener.ts → HypeUpdate + Shockwave → Socket.io
```

## Historical Data Pipeline

`converter.ts` maps TxODDS SSE events (no X/Y coordinates) to 256×256 PitchGrid using zone-based positions:

| Event Type | Grid Zone |
|-----------|-----------|
| safe_possession | Team's own half |
| attack_possession | Opponent's half |
| danger_possession | Opponent final third |
| high_danger_possession | Opponent box |
| shot | Opponent goal area |
| goal | Opponent goal mouth |
| corner | Attacking corner flag |
| free_kick (Danger) | Opponent final third |
| throw_in | Sideline |
| yellow_card / red_card | Own defensive zone |

## Race Condition Protections
- **Tip dedup**: Backend tracks `seenSignatures` (Set of tx sigs)
- **Match settlement guard**: Contract checks `!pool.settled` before settling
- **Claim guard**: Contract checks `!receipt.claimed` before payout
- **Reconnect sync**: Backend emits `state:sync` with latest data on join
- **Storage**: SQLite WAL mode for concurrent reads during writes

## Auth Flow
1. `POST /api/auth/nonce { wallet }` → `{ nonce, message: "Sign in to Pitch Resonance: <nonce>" }`
2. Client signs message with Ed25519 wallet
3. `POST /api/auth/verify { wallet, signature (hex), nonce }` → `{ token: "jwt" }`
4. Include `Authorization: Bearer <token>` for authenticated routes

## Demo Tips
1. 22 World Cup matches pre-loaded in SQLite (June 28 – July 9)
2. Physics frames are ~100 bytes vs 256KB raw — use `pitch:physics_frame` for WebGL
3. Stride query param: `?stride=10` returns every 10th frame
4. No live data? Simulation kicks in after 15s idle
