---
name: owl-air-policies
description: Owl Air demo knowledge base - luggage and pet travel policies, the Avery Stone OA404/OA500 scenario, and how to load them into Twilio Enterprise Knowledge or the agent. Use when the user asks about baggage/pet rules, wants demo questions to ask the agent, or wants to add policy knowledge to the agent.
---

# Owl Air policy knowledge

Sources (demo KB articles, the source of truth; don't edit them):
- `assets/knowledge/owl-air-luggage-policy.md`
- `assets/knowledge/owl-air-pet-policy.md`

Read the relevant file before answering detailed questions. Key facts:

**Luggage.** Everyone gets 1 personal item (18x14x8 in) and 1 carry-on (22x14x9 in). Checked bags:
Economy Saver 0, Standard/Flex/Silver 1 at 50 lb / 23 kg; **Gold and Business Flex 2 at 70 lb / 32 kg**.
Use the most generous allowance that applies. Max 62 linear in. Demo fees: $35 / $45 / $125 for extra
bags, $100 overweight, $150 oversize. Over 70 lb or 80 in goes as cargo. Lithium batteries go in
carry-on only. Never claim a bag was added, waived, or refunded unless a tool confirms it.

**Pets.** Domestic cats and dogs only (no birds, so no pet owls). Cabin rules: at least 12 weeks old,
carrier 18x11x11 in, pet + carrier at most 20 lb / 9 kg, the carrier counts as the carry-on, no exit or
bulkhead rows, $125 each way on US domestic. **No cabin pets on London↔SFO (OA404, OA500)**, only Pet
Cargo with specialist approval. Trained service dogs are not pets. Emotional-support animals follow
the standard pet policy. Never confirm a pet reservation, and never give veterinary advice.

**Avery on OA404.** Gold gives 1 personal item, 1 carry-on, and 2 checked bags at up to 70 lb / 32 kg.
The KB treats OA404 as **cancelled** with OA500 as the replacement.

## Canonical scenario (aligned 2026-10-19)

Avery Stone, Owl Club Gold, **OA404 London (LHR) → San Francisco (SFO), tomorrow 7:00 PM, seat 18B**,
who wants a window seat near the front (7A / 8F / 10A). Aligned across `assets/trip.json`, the Memory
observations (`helpers/profile/3_add_observations.js`), `src/core/prompts.js`, README, and the runbooks.
The KB also describes OA404 as **cancelled with OA500 as the replacement**. That's a possible demo
twist (rebooking plus a pet on OA500), but nothing else in the app models a cancellation yet.

## Demo questions

- "What is the baggage policy for my flight?" (expects the Gold allowance: 2 bags at 70 lb)
- "My bag is a little over 50 pounds, is that OK?"
- "Can I bring my dog on OA500?" (no cabin pets, Pet Cargo with approval)
- "Can I bring my pet owl?" (birds aren't accepted, a good laugh line for Owl Air)

## Making the agent use these policies

The agent currently has **no** knowledge tool, so it will make up policy answers. Two options, and
the user should choose:

1. **Twilio Enterprise Knowledge (fits the Twilio story).** Create a KB at
   `POST https://knowledge.twilio.com/v2/ControlPlane/KnowledgeBases` `{displayName}`, then add each
   article as a text source at `POST https://knowledge.twilio.com/v2/KnowledgeBases/{kbId}/Knowledge`.
   Use `/twilio-developer-kit:twilio-enterprise-knowledge` to get the exact `source` body. Store
   `know_knowledgebase_*` in a new env var, then wire it through TAC: `tac.getKnowledgeClient()` plus
   `createKnowledgeSearchTool(...)` from `twilio-agent-connect`. Indexing is asynchronous.
2. **Local tool (works offline).** Add a `lookup_policy` tool via the `add-agent-tool` skill that
   returns the matching markdown section. It's simpler, but it doesn't demo a Twilio product.

Either way, add the tool to "Tools available" in `src/core/prompts.js`. Answers are spoken aloud,
so keep them to a sentence or two (each KB has short "Recommended answer" examples).
