// In-memory conversation store shared between the agent runtime and the dashboard.
// No persistence: state is lost on process restart, which is fine for the demo.

const conversations = new Map();
// Webhook-captured events keyed by conversation ID. Kept apart from
// `conversations` because CI / Orchestrator webhooks can arrive for
// conversations the agent has not handled yet.
const MAX_EVENTS = 200;
const ciEvents = new Map();
const orchestratorEvents = new Map();

function nowIso() {
  return new Date().toISOString();
}

function pushCapped(store, convId, event) {
  let list = store.get(convId);
  if (!list) {
    list = [];
    store.set(convId, list);
  }
  list.push(event);
  if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
}

export function addCiEvent(convId, event) {
  pushCapped(ciEvents, convId, event);
}

export function addOrchestratorEvent(convId, event) {
  pushCapped(orchestratorEvents, convId, event);
}

export function getCiEvents(convId) {
  return ciEvents.get(convId) ?? [];
}

export function getOrchestratorEvents(convId) {
  return orchestratorEvents.get(convId) ?? [];
}

function newRecord(convId, context) {
  return {
    id: convId,
    channel: context?.channel ?? context?.channelType ?? 'unknown',
    profileId: context?.profileId ?? undefined,
    startedAt: nowIso(),
    endedAt: null,
    status: 'active',
    transcript: [],
    toolEvents: [],
  };
}

export function ensureDashboardConversation(convId, context, memoryResponse) {
  let record = conversations.get(convId);
  if (!record) {
    record = newRecord(convId, context ?? {});
    conversations.set(convId, record);
  }
  if (!record.profileId && context?.profileId) {
    record.profileId = context.profileId;
  }
  if (memoryResponse !== undefined) {
    record.memory = memoryResponse;
  }
  // Plain snapshot for the dashboard Memory panel (TACMemoryResponse is a class
  // and does not serialise usefully).
  const profile = context?.session?.profile ?? context?.profile;
  if (profile || memoryResponse) {
    record.memorySnapshot = {
      profileId: profile?.id ?? record.profileId ?? null,
      traits: profile?.traits ?? {},
      observations: (memoryResponse?.observations ?? []).map((o) => o.content),
      summaries: (memoryResponse?.summaries ?? []).map((s) => s.content),
    };
  }
  return record;
}

export function addTranscriptTurn(convId, role, text) {
  if (!text) return;
  const record = conversations.get(convId);
  if (!record) return;
  record.transcript.push({ at: nowIso(), role, text });
}

export function addToolEvent(convId, name, args, result) {
  const record = conversations.get(convId);
  if (!record) return;
  record.toolEvents.push({ at: nowIso(), name, args, result });
}

export function markConversationEnded(convId) {
  const record = conversations.get(convId);
  if (!record) return;
  record.endedAt = nowIso();
  record.status = 'ended';
}

export function listConversations() {
  return [...conversations.values()].sort((a, b) => {
    const aKey = a.endedAt ?? a.startedAt;
    const bKey = b.endedAt ?? b.startedAt;
    return bKey.localeCompare(aKey);
  });
}

export function getConversation(convId) {
  return conversations.get(convId);
}
