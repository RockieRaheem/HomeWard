<p align="center">
  <img src="twala-app/assets/branding/homeward-logo.png" width="112" alt="HomeWard logo" />
</p>

<h1 align="center">HomeWard</h1>

<p align="center"><strong>Send home. Know more. Worry less.</strong></p>

<p align="center">
  <a href="https://homeward-staging.vercel.app/">Live demo</a> ·
  <a href="#demo-journey">Demo journey</a> ·
  <a href="#what-is-real-today">Prototype boundaries</a> ·
  <a href="#run-it-locally">Run locally</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Stellar-Testnet-7B2FBE?style=for-the-badge&logo=stellar&logoColor=white" alt="Stellar Testnet" />
  <img src="https://img.shields.io/badge/React%20Native-Expo-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/USDC-Stellar_Testnet-2775CA?style=for-the-badge" alt="USDC" />
  <img src="https://img.shields.io/badge/AI-Groq_%2B_Gemini-4285F4?style=for-the-badge" alt="AI" />
</p>

---

## The idea

Sending money home is rarely just a transfer. It can be school fees, medicine, rent, land, or the next stage of a family home. Yet diaspora workers still face unclear costs, wrong-number anxiety, and little visibility after they press send.

**HomeWard** is a mobile-first, purpose-led remittance experience for people supporting family in Uganda. It combines trusted recipients, transparent transfer review, goals, receipts, private accounts, and verifiable Stellar Testnet settlement proof.

The intended production journey is simple:

> Pay abroad → family receives Uganda shillings on mobile money → both people have proof.

The sender never needs to understand USDC, Stellar, or blockchain. Those are the rails underneath the experience.

## Why it matters

| The sender worries about | HomeWard responds with |
| --- | --- |
| “Did I send to the correct person?” | Private trusted-recipient list, exact phone/network review, and explicit confirmation. |
| “What will my family actually receive?” | Up-front UGX estimate, rate, fee, purpose, and receipt. |
| “Can I prove where the money went?” | Transaction history, shareable receipt, SMS notification, and Stellar Testnet proof. |
| “I support more than one person or project.” | Goals for school fees, land, construction, business, and family support. |
| “I do not understand crypto.” | Familiar mobile-first language and an AI guide that explains rather than overwhelms. |

---

## What we built

### A safer way to send

- Private account sessions and owner-scoped wallets, goals, chats, recipients, and history.
- A separate Stellar Testnet wallet and USDC trustline for each signed-in demo user.
- Trusted recipients with name, Uganda phone, MTN/Airtel network, relationship, update, and removal controls.
- A Safe-to-send review showing recipient, amount, expected UGX, fee, rate, purpose, and delivery estimate before money moves.
- Detailed receipts, export/share actions, transaction history, and in-app updates.

### Real blockchain proof

- USDC transfers are submitted to **Stellar Testnet**.
- A transaction hash and Horizon explorer link make the ledger record independently inspectable.
- Testnet cash-in demonstrates the funding leg and wallet balance update on-chain.

### Purpose, not just payment

- Create family goals for land, home construction, education, savings, or business.
- Track contributions, milestones, progress, and goal-specific transaction records.
- Keep the financial reason visible alongside the payment.

### Responsible AI companion

HomeWard’s AI can explain balances, rates, goals, and recent activity in plain language. It can help prepare an action, but it cannot decide to send money on its own.

- Fresh wallet, goal, transaction, and trusted-recipient context is loaded for every chat request.
- Hidden reasoning/HTML-like output is removed before it reaches the user.
- Similar goal creation is paused for confirmation instead of silently duplicating plans.
- AI-assisted payments are limited to exact trusted-recipient matches.
- A transfer requires the user’s explicit `CONFIRM SEND` instruction and server-side validation.

---

## Demo journey

1. Register with a name, Uganda phone number, and PIN.
2. HomeWard provisions an individual Stellar Testnet wallet and Test USDC balance.
3. Add a trusted recipient with their full name, MTN/Airtel number, and relationship.
4. Enter a transfer amount and purpose, then review the expected UGX amount and fee.
5. Confirm the transfer. HomeWard submits a real Stellar Testnet USDC transaction.
6. Open the receipt and Stellar explorer proof.
7. View the updated history, goal progress, and Africa’s Talking sandbox SMS result where configured.

---

## What is real today

Honesty is part of the product. The table below separates the working prototype from the partner approvals required for a public financial service.

| Capability | Current state |
| --- | --- |
| Individual app accounts, private data, trusted recipients, goals, receipts, AI safety controls | Implemented in the prototype |
| Stellar wallet provisioning, USDC trustline, USDC transfer, and transaction proof | **Real on Stellar Testnet** |
| Africa’s Talking SMS | Sandbox integration; messages display only in the registered sandbox simulator |
| Kotani Pay off-ramp | Sandbox/demo integration; not a promise of live UGX settlement |
| MoneyGram cash-in | Transparent Testnet demonstration; a live UAE programme needs MoneyGram approval and allowlisting |
| UAE funding, KYC/AML, AED conversion, custody, FX, and Uganda mobile-money settlement | Require regulated and licensed partners before public launch |

HomeWard is therefore a **working Testnet product prototype and partner-ready experience layer**, not a licensed remittance service.

---

## Architecture

```text
                    ┌───────────────────────────────┐
                    │        HomeWard mobile app     │
                    │  Expo / React Native / Web     │
                    └───────────────┬───────────────┘
                                    │ signed session
                    ┌───────────────▼───────────────┐
                    │  Express + TypeScript backend │
                    │  transfer · goals · AI · auth │
                    └───┬───────────┬───────────┬───┘
                        │           │           │
           ┌────────────▼───┐ ┌─────▼─────┐ ┌──▼─────────────┐
           │ Stellar Testnet│ │ Supabase  │ │ AI providers   │
           │ USDC + Horizon │ │ private   │ │ Groq / Gemini  │
           └────────────────┘ │ app data  │ └────────────────┘
                              └───────────┘
                        │
      ┌─────────────────┼─────────────────────────────┐
      │                 │                             │
┌─────▼──────┐   ┌──────▼──────┐               ┌──────▼──────┐
│ Kotani Pay │   │ Africa's    │               │ MoneyGram   │
│ sandbox    │   │ Talking     │               │ demo flow   │
└────────────┘   │ sandbox     │               └─────────────┘
                 └─────────────┘
```

## Technology

| Layer | Technology |
| --- | --- |
| Client | React Native, Expo, TypeScript, React Native Web |
| Backend | Node.js, Express, TypeScript |
| Blockchain | `@stellar/stellar-sdk`, Stellar Testnet, Horizon, Test USDC |
| Data | Supabase / PostgreSQL |
| AI | Groq and Google Gemini |
| Messaging | Africa’s Talking Sandbox |
| Payout/cash-in prototype | Kotani Pay Sandbox and MoneyGram Ramps demonstration flow |
| Deployment | Vercel and Railway |

---

## Run it locally

### Prerequisites

- Node.js 20+
- A Supabase project
- Optional: Groq, Gemini, Africa’s Talking, Kotani, Transak, and MoneyGram sandbox credentials

### 1. Clone and install

```bash
git clone https://github.com/RockieRaheem/HomeWard.git
cd HomeWard/twala-app

npm install
cd backend && npm install
```

### 2. Configure Supabase

For a **new** Supabase project, run:

```text
backend/supabase-schema.sql
```

For an existing HomeWard database, run the idempotent migration instead:

```text
backend/supabase-user-isolation.sql
```

### 3. Configure the backend

```bash
cd backend
Copy-Item .env.example .env
```

Set at least the following values in `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-project-key
AUTH_TOKEN_SECRET=use-a-long-random-secret-here
STELLAR_NETWORK=TESTNET
```

For a physical phone, create `twala-app/.env`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:4000/api
```

### 4. Start the services

Terminal one:

```bash
cd twala-app/backend
npm run dev
```

Terminal two:

```bash
cd twala-app
npx expo start
```

Open the web client, scan the Expo QR code, or use the deployed demo.

---

## Security notes

This repository is a hackathon prototype. Never use Testnet credentials, demo PINs, or sandbox partner keys in a public financial product.

Before handling real customer funds, HomeWard needs a production security and compliance programme: regulated funding/payout partners, formal KYC/AML controls, hardened authentication, rate limiting, encrypted key management or custody/MPC, restricted CORS, database row-level security, security review, and monitoring.

---

## Team

- **Raheem Kamwanga**
- **Kisakye Kabazaile**
- **Sunday Lugai**

Built for Blockchain DevFest Kampala 2026.
