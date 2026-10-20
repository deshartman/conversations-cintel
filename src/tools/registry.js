import {
  checkTripAndSeatsSchema,
  checkTripAndSeats,
} from './airline.js';
import { sendTextMessageSchema, sendTextMessage } from './sms.js';
import { offerRecoveryCouponSchema, offerRecoveryCoupon } from './coupon.js';

const SCHEMAS = [checkTripAndSeatsSchema, sendTextMessageSchema, offerRecoveryCouponSchema];
const HANDLERS = {
  [checkTripAndSeatsSchema.function.name]: checkTripAndSeats,
  [sendTextMessageSchema.function.name]: sendTextMessage,
  [offerRecoveryCouponSchema.function.name]: offerRecoveryCoupon,
};

export function allSchemas() {
  return SCHEMAS.slice();
}

export function allHandlers() {
  return { ...HANDLERS };
}
