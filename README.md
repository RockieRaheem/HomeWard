<p align="center">
  <img src="https://img.shields.io/badge/Stellar-TESTNET-7B2FBE?style=for-the-badge&logo=stellar&logoColor=white" />
  <img src="https://img.shields.io/badge/React_Native-Expo-000020?style=for-the-badge&logo=expo&logoColor=white" />
  <img src="https://img.shields.io/badge/AI-Groq%20%7C%20Gemini-4285F4?style=for-the-badge&logo=google-gemini&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" />
</p>

<div align="center">
  <h1>HOMEWARD</h1>
  <p><strong>Cross-border payments from the Stellar blockchain to African mobile money</strong></p>
  <p>Send USDC → MTN / Airtel Mobile Money (Uganda) in seconds, with an AI financial companion</p>
</div>

---

## Overview

HomeWard is a full-stack mobile payments platform that bridges the Stellar blockchain with African mobile money networks. Users deposit USDC, send it to anyone with a phone number, and the recipient receives local currency (UGX) directly to their mobile money wallet — no smartphone required on the receiving end.

The system includes an **AI financial assistant** powered by Groq and Gemini that can create savings goals, send money, and manage the user's finances through natural conversation.

### How It Works

```
Sender (App)                    Backend                      Kotani Pay          Recipient
    │                              │                             │                    │
    │  1. Enter amount & phone     │                             │                    │
    │──────────────────────────────>│                             │                    │
    │                              │  2. Get live rate quote     │                    │
    │                              │  3. Send USDC on Stellar    │                    │
    │                              │─────────────────────>       │                    │
    │                              │  4. Create offramp          │                    │
    │                              │────────────────────────────────────>            │
    │                              │                             │  5. Process fiat   │
    │                              │                             │──────────────────>│
    │  6. SMS notification         │                             │                    │
    │<─────────────────────────────│                             │                    │
    │                              │                             │   "UGX 50,000      │
    │                              │                             │    sent by Mama"   │
```

---

## Features

### Payments
- **USDC → Mobile Money**: Send USDC from any Stellar wallet directly to MTN or Airtel Mobile Money in Uganda
- **Real-time quotes**: Live exchange rates with transparent 0.5% fee (min $0.50)
- **Transaction history**: Full searchable history with status tracking
- **Onramp (Mobile Money → USDC)**: Deposit UGX via mobile money and receive USDC

### Savings Goals
- Create goals with target amounts, categories, and milestone checkpoints
- Contribute via direct transfer or through the AI assistant
- Track progress with visual progress bars and milestone timelines
- Categories: Home, Education, Land, Business, Savings

### AI Financial Assistant
- Powered by **Groq** (5-model fallback chain) and **Gemini 2.0 Flash**
- Natural language money management: "Send 50 USDC to Mama"
- Create and manage savings goals through conversation
- Navigate the app via voice/text commands
- Session management with conversation history

### Security & Notifications
- PIN-based authentication (4-6 digits, SHA-256 hashed)
- Phone normalization to prevent duplicate accounts
- SMS notifications to recipients (only UGX amount shown — no crypto terminology)
- Africa's Talking integration for reliable SMS delivery
- Fire-and-forget SMS design — never blocks the transfer flow

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile App** | React Native 0.81 + Expo 54 |
| **Language** | TypeScript 5.9 (strict mode) |
| **Navigation** | Custom state-based navigator |
| **UI** | Montserrat + Inter fonts, MaterialCommunityIcons |
| **Backend** | Node.js + Express 4.21 |
| **Database** | Supabase (PostgreSQL) |
| **Blockchain** | Stellar (`@stellar/stellar-sdk` 16) |
| **Fiat Off-ramp** | Kotani Pay v3 API |
| **AI** | Groq API + Gemini 2.0 Flash |
| **SMS** | Africa's Talking |
| **Exchange Rates** | open.er-api.com (USD→UGX) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Mobile App (Expo)                  │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────┐   │
│  │Dashboard │ │ Transfer │ │  AI Assistant      │   │
│  │ Goals    │ │ History  │ │  (Chat Interface)  │   │
│  └────┬─────┘ └────┬─────┘ └─────────┬──────────┘   │
│       │            │                 │              │
│       └────────────┼─────────────────┘              │
│                    │ HTTP / JSON                    │
└────────────────────┼────────────────────────────────┘
                     │
┌────────────────────┼────────────────────────────────┐
│         Backend (Express + TypeScript)              │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Stellar  │  │ Kotani   │  │  AI Orchestrator │  │
│  │ Service  │  │ Service  │  │  (Groq + Gemini) │  │
│  ├──────────┤  ├──────────┤  ├──────────────────┤  │
│  │ Database │  │ SMS      │  │  Rates           │  │
│  │ (Supabase)│  │ Service  │  │  Service         │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────┼────────────────────────────────┐
│    External Services                                 │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Stellar  │  │ Kotani   │  │ Africa's Talking │  │
│  │ Network  │  │ Pay API  │  │ SMS API          │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Data Flow

1. **User** sends money via the mobile app or AI assistant
2. **Backend** gets a live rate quote, calculates fees
3. **Stellar** transaction submits USDC to Kotani's escrow address
4. **Kotani Pay** processes the off-ramp and disburses UGX to mobile money
5. **Africa's Talking** sends the recipient an SMS notification
6. **Supabase** records every transaction, goal, and message
7. **Frontend** polls for changes every 3 seconds via event versioning

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm / yarn
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Supabase](https://supabase.com) account (free tier works)
- [Kotani Pay](https://backoffice.kotanipay.com) account (for live transfers)
- [Africa's Talking](https://africastalking.com) account (for SMS)
- [Groq](https://console.groq.com) and/or [Gemini](https://aistudio.google.com) API key (for AI)

### 1. Clone & Install

```bash
git clone <repo-url> homeward
cd homeward

# Install both frontend and backend dependencies
cd backend && npm install && cd ..
npm install
```

### 2. Database Setup

1. Go to [Supabase](https://supabase.com) → **New Project**
2. Copy your **Project URL** and **anon key**
3. Open the **SQL Editor** and paste + run [`backend/supabase-schema.sql`](backend/supabase-schema.sql)

### 3. Configure Environment

```bash
cp backend/.env.example backend/.env
```

Then edit `backend/.env`:

```env
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Stellar (testnet by default — no key needed)
STELLAR_NETWORK=TESTNET

# Optional — enables live features
KOTANI_API_KEY=your-kotani-api-key
AT_API_KEY=your-africas-talking-key
GEMINI_API_KEY=your-gemini-key
GROQ_API_KEY=your-groq-key
```

### 4. Start the Backend

```bash
cd backend
npx tsx watch src/index.ts
```

You should see:
```
🏦 HomeWard Backend running
─────────────────────
Network : TESTNET
Port    : 4000
Kotani  : LIVE (sandbox)   # or "Demo mode" if no API key
SMS     : LIVE (sandbox)    # or "Demo mode" if no API key
```

### 5. Start the Mobile App

```bash
# In a separate terminal
npx expo start --tunnel
```

Scan the QR code with your phone (Expo Go app) or press `a` for Android emulator / `i` for iOS simulator.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `4000` | Backend server port |
| `STELLAR_NETWORK` | No | `TESTNET` | `TESTNET` or `PUBLIC` |
| `STELLAR_HORIZON_URL` | No | testnet horizon | Stellar Horizon RPC URL |
| `USDC_ISSUER` | No | Testnet issuer | USDC issuer Stellar address |
| `SUPABASE_URL` | **Yes** | — | Supabase project URL |
| `SUPABASE_ANON_KEY` | **Yes** | — | Supabase anonymous API key |
| `KOTANI_API_KEY` | No | — | Kotani Pay API key (demo mode if empty) |
| `KOTANI_USE_SANDBOX` | No | `true` | Use Kotani sandbox vs production |
| `KOTANI_ESCROW_ADDRESS` | No | — | Kotani Stellar escrow address |
| `AT_USERNAME` | No | `sandbox` | Africa's Talking username |
| `AT_API_KEY` | No | — | Africa's Talking API key (console log if empty) |
| `AT_SENDER_ID` | No | `HOMEWARD` | SMS sender name |
| `GEMINI_API_KEY` | No | — | Google Gemini API key (fallback AI) |
| `GROQ_API_KEY` | No | — | Groq API key (primary AI) |

---

## API Reference

### Health & Events
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | System health check |
| `GET` | `/api/events/version` | Change notification version (polled by frontend) |

### Auth
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Register with name, phone, PIN |
| `POST` | `/api/auth/login` | Login with phone, PIN |
| `GET` | `/api/auth/profile/:id` | Get user profile |
| `GET` | `/api/auth/check/:phone` | Check if phone exists |

### Wallet
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/wallet/create` | Create new Stellar wallet |
| `GET` | `/api/wallet/balance` | Get wallet balance (USDC + XLM) |
| `GET` | `/api/wallet/info` | Get wallet info |
| `GET` | `/api/wallet/payments` | List Stellar payments |
| `POST` | `/api/wallet/sync` | Sync wallet from Stellar |

### Transfers
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/transfer/quote?amount=X` | Get transfer quote with fees |
| `POST` | `/api/transfer/offramp` | Send USDC → Mobile Money |
| `POST` | `/api/transfer/onramp` | Deposit Mobile Money → USDC |
| `GET` | `/api/transfer/status/:refId` | Check transaction status |
| `POST` | `/api/transfer/webhook` | Kotani Pay webhook handler |
| `POST` | `/api/transfer/retry/:refId` | Retry failed transaction |

### Goals
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/goals` | List all goals |
| `POST` | `/api/goals` | Create a goal |
| `GET` | `/api/goals/:id` | Get goal detail |
| `PUT` | `/api/goals/:id` | Update a goal |
| `DELETE` | `/api/goals/:id` | Delete a goal |
| `POST` | `/api/goals/:id/contribute` | Contribute to a goal |

### AI Chat
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/chat/sessions` | List chat sessions |
| `POST` | `/api/chat/sessions` | Create new session |
| `DELETE` | `/api/chat/sessions/:id` | Delete a session |
| `POST` | `/api/chat/sessions/:id/send` | Send message to AI |

### Rates & History
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/rates` | Get current exchange rate |
| `GET` | `/api/history?filter=&page=&goalId=` | Transaction history |
| `GET` | `/api/sms/test` | Test SMS delivery |

---

## Production Checklist

Before switching to mainnet, complete these steps:

### 1. Stellar (PUBLIC Network)
- [ ] Set `STELLAR_NETWORK=PUBLIC`
- [ ] Set `USDC_ISSUER` to your real USDC issuer on Stellar mainnet
- [ ] Fund your wallet with real XLM for transaction fees
- [ ] Remove `USDC_ISSUER_SECRET` — use a hardware wallet or multi-sig

### 2. Kotani Pay (Production)
- [ ] Generate a **production** API key from the [Kotani dashboard](https://backoffice.kotanipay.com)
- [ ] Set `KOTANI_USE_SANDBOX=false`
- [ ] Fund your Kotani payout balance
- [ ] Configure webhook URL in the dashboard
- [ ] Verify webhook signature handling

### 3. Africa's Talking (Production)
- [ ] Switch to production application in the AT dashboard
- [ ] Set `AT_USERNAME` to your application name (not `sandbox`)
- [ ] Register your Sender ID (`AT_SENDER_ID`)
- [ ] Purchase SMS credits

### 4. Security
- [ ] Remove `secret_key` storage from `wallets` table — use client-side signing
- [ ] Enable Supabase Row-Level Security (RLS) on all tables
- [ ] Add request rate limiting
- [ ] Implement webhook signature verification
- [ ] Add idempotency keys for transfer retries
- [ ] Enable HTTPS in production
- [ ] Store API keys in a secrets manager (not `.env`)

### 5. Monitoring
- [ ] Add error tracking (Sentry, etc.)
- [ ] Set up uptime monitoring
- [ ] Configure database backups
- [ ] Monitor Stellar account reserves

---

## Project Structure

```
homeward-app/
├── App.tsx                     # Root React Native component
├── index.ts                    # Expo entry point
├── app.json                    # Expo configuration
├── src/                        # Frontend source
│   ├── components/             # Reusable UI components
│   │   ├── BottomNavBar.tsx    # 5-tab navigation bar
│   │   ├── SendSuccess.tsx     # Animated transfer success modal
│   │   └── DismissKeyboard.tsx # Keyboard dismissal wrapper
│   ├── navigation/
│   │   └── AppNavigator.tsx    # State-based navigation controller
│   ├── screens/                # Screen components
│   │   ├── ProfileScreen.tsx   # Registration / login
│   │   ├── HomeDashboard.tsx   # Main dashboard with balance & activity
│   │   ├── SmartTransfer.tsx   # Send money / deposit UI
│   │   ├── AIAssistant.tsx     # AI chat interface with sessions
│   │   ├── History.tsx         # Transaction history
│   │   ├── Goals.tsx           # Savings goals list
│   │   └── GoalDetail.tsx      # Individual goal view
│   ├── services/
│   │   └── api.ts              # Backend API client
│   ├── theme/
│   │   └── index.ts            # Design system (colors, fonts, spacing)
│   └── types/
│       └── index.ts            # TypeScript types
├── backend/
│   ├── src/
│   │   ├── index.ts            # Express server entry
│   │   ├── config.ts           # Environment configuration
│   │   ├── types/
│   │   │   └── index.ts        # Shared types
│   │   ├── routes/             # API route handlers
│   │   │   ├── auth.ts         # PIN-based authentication
│   │   │   ├── wallet.ts       # Stellar wallet management
│   │   │   ├── transfer.ts     # Send/receive money
│   │   │   ├── goals.ts        # Savings goals CRUD
│   │   │   ├── history.ts      # Transaction history
│   │   │   ├── chat.ts         # AI chat sessions
│   │   │   ├── rates.ts        # Exchange rates
│   │   │   ├── kotani.ts       # Kotani Pay admin
│   │   │   └── events.ts       # Change notifications
│   │   └── services/           # Business logic
│   │       ├── stellar.ts      # Stellar blockchain integration
│   │       ├── database.ts     # Supabase ORM
│   │       ├── kotani.ts       # Kotani Pay API wrapper
│   │       ├── ai.ts           # AI orchestration (Groq + Gemini)
│   │       ├── rates.ts        # Exchange rate fetching
│   │       ├── sms.ts          # Africa's Talking SMS
│   │       └── events.ts       # Global change counter
│   └── supabase-schema.sql     # Database schema
└── README.md
```

---

## Key Design Decisions

### Demo-First Architecture
Every external service (Stellar, Kotani, Africa's Talking, AI) works in demo mode with no API keys. The app is fully functional out of the box — simulation replaces live calls when credentials aren't set.

### Fire-and-Forget SMS
SMS notifications are sent asynchronously after the HTTP response. The transfer is never blocked by SMS delivery. If SMS fails, the content is logged to the console for debugging.

### AI Model Fallback Chain
The AI assistant tries 5 Groq models in priority order, then falls back to Gemini 2.0 Flash. If all AI providers fail, a static fallback response ensures the user never gets a blank screen.

### Phone-Normalized Auth
Phone numbers are stripped of spaces, dashes, and parentheses before storage and lookup. This prevents the common "No account found" bug when the same number is entered with different formatting.

### Event-Based Polling
The frontend polls a lightweight version endpoint every 3 seconds instead of WebSocket connections. This keeps the architecture simple while providing near-real-time updates.

---

## License

MIT

---

<p align="center">
  Built with ❤️ for cross-border Africa<br>
  <a href="https://stellar.org">Stellar</a> ·
  <a href="https://kotanipay.com">Kotani Pay</a> ·
  <a href="https://africastalking.com">Africa's Talking</a> ·
  <a href="https://groq.com">Groq</a> ·
  <a href="https://deepmind.google.com/gemini">Gemini</a>
</p>
