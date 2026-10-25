import {
  checkTripAndSeatsSchema,
  checkTripAndSeats,
  changeSeatSchema,
  changeSeat,
} from './airline.js';
import { sendTextMessageSchema, sendTextMessage } from './sms.js';
import { offerRecoveryCouponSchema, offerRecoveryCoupon } from './coupon.js';

const SCHEMAS = [checkTripAndSeatsSchema, changeSeatSchema, sendTextMessageSchema, offerRecoveryCouponSchema];
const HANDLERS = {
  [checkTripAndSeatsSchema.function.name]: checkTripAndSeats,
  [changeSeatSchema.function.name]: changeSeat,
  [sendTextMessageSchema.function.name]: sendTextMessage,
  [offerRecoveryCouponSchema.function.name]: offerRecoveryCoupon,
};

export function allSchemas() {
  return SCHEMAS.slice();
}

export function allHandlers() {
  return { ...HANDLERS };
}
