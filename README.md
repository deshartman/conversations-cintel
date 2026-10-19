# Twilio Multi-channel AI agents

Multi-channel AI agents on Twilio using Twilio Agent Connect (TAC) to implement LLM-backed conversational agents, integrated with Conversation Orchestrator and Conversation Memory.

---

> Agents shouldn't live in just one chatbox.
>
> What if your AI agent could text, call, message and engage users across multiple channels — while maintaining context and delivering one connected experience?

---

## Prerequisites

- Node.js LTS (24+ or later), and npm
- A Twilio account with a Voice- and SMS-capable phone number
- A Twilio Memory Store and Conversation Orchestrator Configuration (see `helpers/setup/`)
- A Memory profile provisioned for the demo caller (see `helpers/profile/`)
- An OpenAI API key
- A public tunnel to your local port (e.g. ngrok) for Twilio Voice webhooks

## Setup

Install project dependencies:

```bash
npm install
```

Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

Provision Twilio resources using the helpers (run from the repo root):

```bash
npm run setup      # Memory Store + Conversation Configuration + Intelligence
npm run profile    # Memory profile + trait groups + observations
```

Copy the resulting IDs into `.env`.

## Local dev server

```bash
npm start
```

Then point your Twilio phone number's Voice and Messaging webhooks at your public tunnel URL. TAC exposes the ConversationRelay endpoint for Voice and the inbound SMS webhook.

## Demo scenario

The agent plays an Owl Airlines assistant. The demo caller is Avery Stone, an Owl Club Gold passenger on a London to San Francisco trip (OA404). The agent uses Memory-driven context and local tools (trip lookup, seat search, SMS confirmations) to complete a seat-change request across Voice and SMS.

See `RUNBOOK.md` for the step-by-step demo script, and `AGENTS.md` for internal conventions and module layout.

## License

MIT
