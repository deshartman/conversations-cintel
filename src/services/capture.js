// Turn raw CI and Orchestrator webhook bodies into dashboard events.
// Ported from CIEventCaptureMiddleware / _format_ci_result in the upstream
// Python dashboard.py. Capture never throws: a bad payload must not block TAC.
import { addCiEvent, addOrchestratorEvent } from '../repositories/conversations.js';

const MAX_DETAIL = 500;

function normalizeName(name) {
  return String(name ?? '').toLowerCase().replace(/[_ ]/g, '-');
}

function stringify(value) {
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}

// The two custom Owl Air operators (assets/conversation-intelligence.md) get a
// typed "signal" so the UI can track how they change turn by turn.
export function ciSignal(operatorName, result) {
  if (!result || typeof result !== 'object') return null;
  const name = normalizeName(operatorName);
  if (name === 'offer-coupon' && typeof result.offer_coupon === 'boolean') {
    return { type: 'offer_coupon', value: result.offer_coupon };
  }
  if (name === 'intent-recognition' && result.description) {
    return { type: 'intent', value: String(result.description) };
  }
  return null;
}

export function formatCiResult(operatorName, outputFormat, result) {
  if (result === null || result === undefined) return outputFormat ?? '';
  if (typeof result !== 'object') return String(result).slice(0, MAX_DETAIL);
  if (Array.isArray(result)) return JSON.stringify(result).slice(0, MAX_DETAIL);

  const signal = ciSignal(operatorName, result);
  if (signal?.type === 'offer_coupon') return `Offer coupon: ${signal.value ? 'YES' : 'no'}`;
  if (signal?.type === 'intent') return `Intent: ${signal.value}`.slice(0, MAX_DETAIL);

  for (const key of ['label', 'text', 'summary', 'description', 'result']) {
    if (result[key] !== null && result[key] !== undefined) {
      return stringify(result[key]).slice(0, MAX_DETAIL);
    }
  }
  if (Array.isArray(result.summaries)) return result.summaries.join(' ').slice(0, MAX_DETAIL);

  // Any other custom operator: list its JSON output fields.
  const fields = Object.entries(result).map(([key, value]) => `${key}: ${stringify(value)}`);
  return fields.length ? fields.join(', ').slice(0, MAX_DETAIL) : outputFormat ?? '';
}

// Body of POST /ci-webhook (Rule Execution webhook). Every operator result is
// kept, including ones TAC's OperatorResultProcessor skips.
export function captureCiPayload(payload) {
  try {
    const convId = payload?.conversationId;
    if (!convId || !Array.isArray(payload.operatorResults)) return 0;
    for (const op of payload.operatorResults) {
      const operator = op?.operator?.displayName ?? op?.operator?.name ?? op?.operator?.id ?? '';
      const outputFormat = op?.outputFormat ?? '';
      const result = op?.result;
      addCiEvent(convId, {
        id: op?.id ?? null,
        operator,
        operator_id: op?.operator?.id ?? null,
        output_format: outputFormat,
        detail: formatCiResult(operator, outputFormat, result),
        signal: ciSignal(operator, result),
        raw_result: result ?? null,
        created_at: op?.dateCreated ?? new Date().toISOString(),
      });
    }
    return payload.operatorResults.length;
  } catch {
    return 0;
  }
}

// Latest intent / offer_coupon plus how each changed over time, for the
// "Current signals" panel. `history` only records value changes.
export function ciSignals(events) {
  const out = {
    intent: { latest: null, history: [] },
    offer_coupon: { latest: null, history: [] },
  };
  const sorted = [...events].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
  for (const event of sorted) {
    const slot = event.signal && out[event.signal.type];
    if (!slot) continue;
    if (slot.latest?.value !== event.signal.value) {
      slot.history.push({ value: event.signal.value, created_at: event.created_at });
    }
    slot.latest = { value: event.signal.value, created_at: event.created_at };
  }
  return out;
}

// Body of POST /webhook (Orchestrator statusCallbacks).
export function captureOrchestratorPayload(payload) {
  try {
    const eventType = payload?.eventType;
    const data = payload?.data ?? {};
    const convId = data.conversationId ?? data.id;
    if (!eventType || !convId) return false;

    let detail = '';
    if (eventType === 'COMMUNICATION_CREATED') {
      const who = [data.author?.channel, data.author?.address].filter(Boolean).join(' ');
      detail = `${who}: ${data.content?.text ?? ''}`;
    } else if (data.status) {
      detail = `Status: ${data.status}`;
    } else if (data.profileId) {
      detail = `Profile: ${data.profileId}`;
    }

    addOrchestratorEvent(convId, {
      event_type: eventType,
      communication_id: eventType === 'COMMUNICATION_CREATED' ? data.id ?? null : null,
      author_channel: data.author?.channel ?? null,
      detail: detail.slice(0, MAX_DETAIL),
      created_at: data.createdAt ?? data.updatedAt ?? new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}
