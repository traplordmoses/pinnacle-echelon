# Pinnacle Echelon

**Meme Futarchy on Monad** -- submit memes, stake MON, vote, trade prediction shares, and let the market decide the winner.

Built for [Monad Blitz Hackathon 2026](https://monad.xyz).

## What Is This?

Pinnacle Echelon is an on-chain meme competition that uses **futarchy** to pick winners. Instead of pure popularity voting, the outcome is decided by a weighted combination of crowd votes (60%) and prediction market activity (40%). Put your money where your meme is.

Live on **Monad Testnet** at:

```
0x4aae5f21d946D7012633F00aF5e499020BAfFd34
```

Chain ID: `10143` | RPC: `https://testnet-rpc.monad.xyz`

---

## How the Game Works

### Phase 1: Create a Category

Anyone can propose a meme competition category (e.g. "Best Crypto Cringe Meme"). The creator sets:

- **Entry stake** -- how much MON each meme submission costs
- **Submission window** -- how long players can submit memes
- **Voting window** -- how long voting and trading lasts after submissions close

### Phase 2: Submit Memes

During the submission window, players upload a meme image (stored on IPFS via Pinata) and pay the entry stake in MON. One submission per wallet per category. All stakes go into the **prize pool**.

### Phase 3: Vote & Trade

Once submissions close, the voting and prediction market opens simultaneously:

- **Voting**: Every connected wallet gets **5 free votes** to distribute across any memes in the category. You allocate them however you want (all 5 on one meme, or spread them out), then submit in a single batch transaction. One vote submission per wallet.

- **Prediction Market**: You can buy **prediction shares** on the meme you think will win. Shares follow a **linear bonding curve** -- the more shares bought on a meme, the more expensive the next share becomes. Each wallet can only bet on **one meme** per category (locked once placed). The MON spent on shares goes into the prize pool.

### Phase 4: Resolution

After the voting window ends, anyone can trigger resolution. The contract calculates a **futarchy score** for each meme and crowns the winner.

### Phase 5: Claim Winnings

Winners claim their share of the prize pool (see Money Flow below).

---

## The Futarchy Mechanism

Traditional voting is easily gamed -- people vote without skin in the game. Futarchy fixes this by blending two signals:

```
Final Score = (Normalized Votes x 60) + (Normalized Market Pool x 40)
```

**How normalization works:**

1. Find the meme with the most votes -- that meme gets a normalized vote score of 1.0. All others are proportional.
2. Find the meme with the largest share pool (most MON bet on it) -- that meme gets a normalized market score of 1.0. All others are proportional.
3. Combine: 60% vote weight + 40% market weight = final score.

**Why this works:**

- Votes capture broad community sentiment (low barrier, free to cast)
- The prediction market captures **conviction** -- people put real MON behind their picks
- A meme needs both popularity AND market confidence to win
- Gaming votes alone isn't enough if the market disagrees
- A whale buying shares alone isn't enough if the crowd doesn't vote for it

The 60/40 split ensures the crowd has the louder voice while the market keeps it honest.

---

## Money Flow

All MON flows into a single **prize pool** per category:

| Source | Destination |
|---|---|
| Meme submission stakes | Prize pool |
| Prediction share purchases | Prize pool |

When a category resolves:

| Recipient | Share | Description |
|---|---|---|
| **Protocol** | 5% | Platform fee, retained by the contract |
| **Winning meme creator** | 20% | Reward for making the best meme |
| **Winning meme shareholders** | 75% | Split pro-rata based on shares held |

If the winning meme has **zero shareholders** (nobody bought prediction shares on it), the creator receives the entire 95% (everything minus the protocol fee).

### Bonding Curve Pricing

Prediction shares follow a linear bonding curve:

```
Price of share N = 0.001 + (N x 0.0001) MON
```

The cost to buy `amount` shares when `supply` already exist:

```
Cost = amount x 0.001 + 0.0001 x (amount x supply + amount x (amount - 1) / 2)
```

Early believers get cheaper shares. As conviction grows, the price rises.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | [Monad](https://monad.xyz) Testnet (EVM-compatible, chain 10143) |
| Smart Contract | Solidity 0.8.24, Hardhat |
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Wallet | RainbowKit, wagmi v2, viem |
| Styling | Tailwind CSS, Frutiger Aero glassmorphism |
| Storage | IPFS via Pinata |

---

## Project Structure

```
pinnacle-echelon/
├── contracts/
│   ├── contracts/
│   │   └── MemeFutarchy.sol        # The smart contract
│   ├── scripts/
│   │   └── deploy.js               # Deployment script
│   ├── hardhat.config.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Home -- category listing
│   │   │   ├── create/page.tsx     # Create new category
│   │   │   ├── category/[id]/      # Game page -- vote, bet, submit
│   │   │   ├── providers.tsx       # wagmi + RainbowKit providers
│   │   │   ├── layout.tsx          # Root layout
│   │   │   └── globals.css         # Frutiger Aero styles
│   │   ├── abi/
│   │   │   └── MemeFutarchy.json   # Contract ABI
│   │   ├── contract.ts             # Helpers -- IPFS, phases, formatting
│   │   └── wagmi.ts                # Chain + wallet config
│   ├── tailwind.config.ts
│   └── package.json
└── README.md
```

---

## Run Locally

### Prerequisites

- Node.js 18+
- MetaMask (or any injected wallet) configured for Monad Testnet
- Testnet MON from the [Monad faucet](https://faucet.monad.xyz)

### 1. Clone and install

```bash
git clone <repo-url>
cd pinnacle-echelon

# Install contract dependencies
cd contracts
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure environment

**Contracts** (`contracts/.env`):

```env
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
```

**Frontend** (`frontend/.env.local`):

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x4aae5f21d946D7012633F00aF5e499020BAfFd34
NEXT_PUBLIC_PINATA_API_KEY=your_pinata_api_key
NEXT_PUBLIC_PINATA_SECRET=your_pinata_secret
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id
```

Get free API keys:
- **Pinata**: [pinata.cloud](https://pinata.cloud) (for IPFS image uploads)
- **WalletConnect**: [cloud.walletconnect.com](https://cloud.walletconnect.com) (optional -- MetaMask works without it)

### 3. Run the frontend

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Deploy your own contract (optional)

```bash
cd contracts
npx hardhat compile
npm run deploy
```

Update `NEXT_PUBLIC_CONTRACT_ADDRESS` in `frontend/.env.local` with the new address.

---

## Adding Monad Testnet to MetaMask

| Field | Value |
|---|---|
| Network Name | Monad Testnet |
| RPC URL | `https://testnet-rpc.monad.xyz` |
| Chain ID | `10143` |
| Currency Symbol | `MON` |

---

## Contract Constants

| Constant | Value | Description |
|---|---|---|
| `VOTE_WEIGHT` | 60 | Vote component of futarchy score (%) |
| `MARKET_WEIGHT` | 40 | Market component of futarchy score (%) |
| `CREATOR_SHARE` | 20% | Winner's creator payout from pot |
| `PROTOCOL_FEE` | 5% | Platform fee |
| `BASE_SHARE_PRICE` | 0.001 MON | Starting price per prediction share |
| `PRICE_INCREMENT` | 0.0001 MON | Price increase per existing share |
| `MAX_VOTES_PER_USER` | 5 | Votes each wallet can distribute |

---

## License

MIT
