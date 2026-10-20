import { getCiEvents } from '../repositories/conversations.js';
import { ciSignals } from '../services/capture.js';

// Coupons issued this process, keyed by conversation ID. One per conversation.
const issued = new Map();

export function couponOffered(convId) {
  return ciSignals(getCiEvents(convId)).offer_coupon.latest?.value === true;
}

export function couponIssued(convId) {
  return issued.get(convId);
}

export const offerRecoveryCouponSchema = {
  type: 'function',
  function: {
    name: 'offer_recovery_coupon',
    description:
      'Issue Avery a one-time Owl Airlines recovery coupon. Only use this when the ' +
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
  return { status: 'issued', ...coupon };
}
