<p align="center">
  <img src="twala-app/assets/branding/homeward-logo.png" width="120" alt="HomeWard logo" />
</p>

<h1 align="center">HomeWard</h1>

<p align="center"><strong>Send home with purpose, proof, and peace of mind.</strong></p>

<p align="center">
  <a href="https://homeward-staging.vercel.app/">Live demo</a> ·
  <a href="#demo-flow">Demo flow</a> ·
  <a href="#prototype-boundaries">Prototype boundaries</a> ·
  <a href="#run-locally">Run locally</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Stellar-Testnet-7B2FBE?style=for-the-badge&logo=stellar&logoColor=white" alt="Stellar Testnet" />
  <img src="https://img.shields.io/badge/USDC-Testnet-2775CA?style=for-the-badge" alt="Test USDC" />
  <img src="https://img.shields.io/badge/Expo-React_Native-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/Ugandan_languages-Sunbird_AI-00843D?style=for-the-badge" alt="Sunbird AI" />
</p>

---

## Why HomeWard

For many Ugandans abroad, a transfer home is not merely money movement. It is school fees, rent, medical support, land, construction, or a regular promise to family. Existing flows often leave senders worried about wrong numbers, unclear fees, and whether the intended person received the money.

There is another barrier that is easy to overlook: financial apps are often written for confident English readers with experience using digital products. Some intended users have low literacy, prefer a local language, or are more comfortable speaking than typing. A safe remittance product cannot be inclusive if understanding the interface depends on technical English.

HomeWard is a mobile-first remittance experience designed around **people, purpose, proof, and accessible language**. It helps a sender verify a trusted recipient, understand the expected UGX amount before confirming, organise recurring family support, and retain a clear receipt with independent Stellar Testnet evidence.

> The intended experience: pay abroad → family receives UGX on mobile money → both people have a clear record.

The user does not need to understand USDC or Stellar. Those are implementation rails, not product jargon.

## What we built

### Safe-to-send transfers

- Private sign-in sessions and user-scoped wallets, history, goals, chats, recipients, and notifications.
- Individual Stellar Testnet wallets with Test USDC and independently inspectable transaction hashes.
- Trusted recipients with full name, phone number, MTN/Airtel network, relationship, and optional monthly support plan.
- Recipient Passports showing known-since date, completed transfers, usual amount, latest payment, and changes to recipient details.
- A deliberate review before sending: recipient, network, amount, expected UGX, rate, fee, purpose, and delivery estimate.
- Smart transfer guardrails for a new recipient, unusual amount, changed network, or amount above a saved monthly plan.
- **Private Recipient Proof:** HomeWard creates a keyed, non-reversible commitment from the recipient profile and anchors a short commitment in the Stellar memo. No recipient name, phone number, prompt, or raw AI response is written to the public ledger.
- **Verifiable safety audit:** every confirmed transfer records the safety policy version, relevant guardrail flags, and a tamper-evident audit hash. Receipts expose short proof references that a judge can independently compare with the Testnet transaction.

### Goals and HomeWard Circles

- Goals for school fees, land, construction, business, savings, and family support.
- Progress, milestones, contribution history, and receipts connected to each goal.
- Circles for recurring support such as “Mum’s monthly support” or “Brian’s school fees.”
- Each Circle has a recipient or goal, planned amount, purpose, contribution totals, latest receipt, share summary, and pause/resume control.
- Circles do **not** send money automatically. Every payment still needs the sender’s explicit confirmation.

### Sunbird AI: financial guidance in familiar Ugandan languages

- HomeWard integrates **Sunbird AI** as its Ugandan-language intelligence layer: translation, conversational AI fallback, speech-to-text, and text-to-speech are available through server-side Sunbird endpoints when a Sunbird API token is configured.
- The language choice persists across the app. Luganda is implemented across the account, dashboard, transfer, goals, history, Circles, and receipt journeys, so language support is part of the product—not only a chatbot setting.
- A sender can speak to HomeWard, hear a response, and receive guidance in a familiar language rather than being forced to understand financial English or blockchain terminology. This makes navigation more approachable for users with low literacy or limited confidence reading English.
- Clear labels, voice interaction, and local-language guidance help users understand what they are doing before a financial action is confirmed; they do not remove the need for explicit sender confirmation.
- An AI assistant can explain balances, goals, history, rates, and transfer preparation.
- Server-side guardrails: the assistant cannot settle a payment on its own; the user must explicitly confirm a protected transfer action.

> Sunbird credentials remain server-side. HomeWard never exposes the Sunbird token to the mobile client.

### Proof and communication

- In-app receipts, downloadable receipts, WhatsApp sharing, history filters, and Circle summaries.
- Africa’s Talking Sandbox SMS receipts for registered simulator numbers.
- Stellar Testnet transaction hashes and explorer links for real Testnet ledger proof.

## Demo flow

1. Create an account using a name, phone number, and PIN.
2. HomeWard provisions a user-specific Stellar Testnet wallet and Test USDC balance.
3. Add a trusted recipient with their full name, MTN/Airtel number, relationship, and optional monthly plan.
4. Review the recipient’s Passport before sending.
5. Optionally create a Goal or Circle for recurring family support.
6. Enter an amount and purpose; HomeWard shows the expected UGX, rate, and fee.
7. Review and explicitly confirm the transfer.
8. HomeWard records the user confirmation and safety policy, sends Test USDC on Stellar Testnet with a private recipient commitment, then presents the transaction hash, receipt, history entry, and related Goal/Circle update.

## Architecture

```text
Expo / React Native Web app
          │ signed session
          ▼
Express + TypeScript API
   ├── Stellar Testnet + Horizon + Test USDC
   ├── Supabase / PostgreSQL
   ├── Groq / Gemini / Sunbird AI
   ├── Africa's Talking Sandbox
   ├── Kotani Pay Sandbox or demo mode
   └── MoneyGram Ramps Testnet demonstration
```

## Prototype boundaries

HomeWard is a hackathon prototype. This table intentionally separates what works now from what requires regulated partner approval.

| Capability | Current state |
| --- | --- |
| Accounts, trusted recipients, Goals, Circles, history, receipts, notifications, and AI guardrails | Implemented in the prototype |
| Private Recipient Proof and verifiable safety-audit record | Implemented with HMAC commitments and Stellar Testnet memo anchors; this is not a zero-knowledge proof or decentralized AI inference |
| Wallet provisioning, Test USDC transfers, and transaction proof | Real Stellar **Testnet** transactions |
| Africa’s Talking SMS | Sandbox only; messages appear in the registered Africa’s Talking simulator |
| Kotani Pay payout | Sandbox/demo integration; no promise of live UGX settlement |
| MoneyGram cash-in | Transparent Testnet demonstration; a live UAE programme requires MoneyGram approval and allowlisting |
| Transak checkout | Optional hosted integration; availability and supported payment methods depend on Transak approval and market support |
| AED collection, KYC/AML, custody, FX, and live Uganda mobile-money payout | Require licensed, regulated partners before any public launch |

HomeWard is therefore a working Testnet product demonstration and partner-ready experience layer, **not a licensed remittance service**.

## Technology

| Layer | Stack |
| --- | --- |
| Client | React Native, Expo, React Native Web, TypeScript |
| API | Node.js, Express, TypeScript |
| Blockchain | `@stellar/stellar-sdk`, Stellar Testnet, Horizon, Test USDC |
| Data | Supabase / PostgreSQL |
| AI and language access | Sunbird AI translation, conversational AI, speech-to-text, and text-to-speech; Google Gemini and Groq for assistant intelligence |
| Messaging | Africa’s Talking Sandbox |
| Funding and payout demos | MoneyGram Ramps demo flow, Transak hosted checkout, Kotani Pay Sandbox |
| Deployment | Vercel frontend, Railway backend |

## Run locally

### Prerequisites

- Node.js 20+
- A Supabase project
- Optional partner/API credentials for AI, SMS, Kotani, Transak, and MoneyGram demo capabilities

### Install

```bash
git clone https://github.com/RockieRaheem/HomeWard.git
cd HomeWard/twala-app
npm install
cd backend && npm install
```

### Configure Supabase

For a new project, run `twala-app/backend/supabase-schema.sql` in the Supabase SQL editor.

For an existing HomeWard database, run the idempotent `twala-app/backend/supabase-user-isolation.sql` migration, then run `twala-app/backend/supabase-privacy-verification.sql` to enable proof fields on new receipts.

### Configure environment variables

Copy the backend example file:

```powershell
cd twala-app/backend
Copy-Item .env.example .env
```

Set at least:

```env
AUTH_TOKEN_SECRET=a-random-secret-with-at-least-32-characters
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
STELLAR_NETWORK=TESTNET
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

For a physical device on your local network, create `twala-app/.env`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:4000/api
```

Never commit `.env` files or expose server-side keys in Expo variables.

### Start the app

```bash
# terminal 1
cd twala-app/backend
npm run dev

# terminal 2
cd twala-app
npm start
```

Use the Expo QR code for a phone on the same network, run the web target, or open the deployed demo.

## Security and production path

This codebase is for a hackathon demonstration. Do not use Testnet keys, sandbox API keys, demo PINs, or prototype data handling for a live financial product.

Before handling customer money, HomeWard needs regulated funding and payout partners, KYC/AML operations, hardened authentication, rate limiting, secure key custody or MPC, restrictive CORS, database row-level security, audited encryption, monitoring, incident response, and an independent security review.

## Team

- **Kamwanga Raheem**
- **Kisakye Abigail**
- **Sunday Emmanuel Lugai**

Built for Blockchain DevFest Kampala 2026.
