---
name: add-agent-tool
description: Add a new OpenAI tool (function calling) to the Owl Airlines agent. Use when asked to add, change, or remove an agent tool/capability in src/tools/.
---

# Add an agent tool

Tools are plain ESM modules in `src/tools/` that each export a schema and a handler. They are wired
together in `src/tools/registry.js` and consumed by `runToolLoop` in `src/services/agent.js`.

## Steps

1. **Create `src/tools/<area>.js`** following `airline.js` / `sms.js`:
   - `export const <camelName>Schema = { type: 'function', function: { name: '<snake_name>', description, parameters } }`
   - `export async function <camelName>(args = {}, { context } = {})` returning a plain JSON-serialisable object.
   - `context` is the full TAC `messageReady` event (conversationId, session, memory, authorInfo, ...).
   - Read config from `src/core/config.js` or `process.env`. Never hardcode SIDs, numbers, or keys.
     Add new env vars to `.env.example`.
   - Fixture data belongs in `assets/` (do not modify existing `assets/trip.json`). Load it via
     `ASSETS_DIR` and cache it like `loadTrip()` does.
   - Return `{ status: 'failed', error }` for expected failures. Thrown errors are caught by
     `dispatchToolCall` and returned to the model as `{ error }`, so no try/catch is needed for those.
2. **Register** in `src/tools/registry.js`: add the schema to `SCHEMAS` and the handler to `HANDLERS`,
   keyed by `schema.function.name`.
3. **Update the prompt**: add a `- <snake_name>: ...` line under "Tools available" in
   `src/core/prompts.js`. Responses are spoken aloud, so tool output that the model relays should be short.
4. **Verify**: `node -e "import('./src/tools/registry.js').then(r => console.log(r.allSchemas().map(s => s.function.name)))"`
   then boot `npm start` and exercise it. Tool calls show up in the dashboard's `toolEvents`.

## Rules

- Keep tools inside the demo scope from AGENTS.md (no Studio handoff, no persistence).
  Tools may read captured Intelligence results (see `src/tools/coupon.js`) but must not call
  Intelligence APIs.
- Don't change `MAX_TOOL_ITERATIONS` or the loop shape in `agent.js` just to add a tool.
