import { getCiEvents } from '../repositories/conversations.js';
import { ciSignals } from '../services/capture.js';
import { sendTextMessage } from './sms.js';

// Coupons issued this process, keyed by conversation ID. One per conversation.
const issued = new Map();
// Per conversation: when the caller first spoke after hearing about the delay.
const delayReaction = new Map();

// check_trip_and_seats reported the delay this turn.
export function markDelayTold(convId) {
  if (!delayReaction.has(convId)) delayReaction.set(convId, null);
}

// Called at the start of every caller turn: the first turn after the delay
// was told is the caller's reaction to it.
export function noteCallerTurn(convId) {
  if (delayReaction.has(convId) && !delayReaction.get(convId)) delayReaction.set(convId, Date.now());
}

// Only Intelligence results for the caller's reaction to the delay count, so
// sentiment left over from earlier in the conversation cannot trigger it.
// Needs Sentiment negative and offer-coupon YES.
export function couponOffered(convId) {
  const since = delayReaction.get(convId);
  if (!since) return false;
  const after = getCiEvents(convId).filter((e) => Date.parse(e.created_at) >= since);
  const sentiment = after.filter((e) => /sentiment/i.test(e.operator ?? '')).at(-1)?.raw_result?.label;
  return sentiment === 'negative' && ciSignals(after).offer_coupon.latest?.value === true;
}

export function couponIssued(convId) {
  return issued.get(convId);
}

export const offerRecoveryCouponSchema = {
  type: 'function',
  function: {
    name: 'offer_recovery_coupon',
    description:
      'Issue Avery a one-time Owl Airlines recovery coupon and text it to them as an apology. Only use this when the ' +
      'Intelligence note in the system prompt says a coupon should be offered.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Short reason for the coupon, e.g. flight delay frustration.',
        },
      },
    },
  },
};

export async function offerRecoveryCoupon(args = {}, { context } = {}) {
  const convId = context?.conversationId;
  const existing = issued.get(convId);
  if (existing) return { status: 'already_issued', ...existing };
  // Conversation Intelligence (offer-coupon operator) decides, not the model.
  if (!couponOffered(convId)) {
    return { status: 'failed', error: 'Intelligence has not approved a coupon for this conversation.' };
  }
  const coupon = {
    code: `OWL-SORRY-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    value: '50 USD travel credit',
    expires: 'in 12 months',
    reason: args.reason ?? 'recovery gesture',
  };
  issued.set(convId, coupon);
  // Text the coupon as part of the apology. A failed text still leaves the coupon issued.
  let sms;
  try {
    sms = await sendTextMessage(
      {
        message_body:
          `Owl Airlines: We're sorry about the delay to your flight. Here is a ${coupon.value} ` +
          `for your next trip: ${coupon.code} (valid ${coupon.expires}).`,
      },
      { context },
    );
  } catch (err) {
    sms = { status: 'failed', error: err?.message ?? String(err) };
  }
  return { status: 'issued', ...coupon, sms };
}
