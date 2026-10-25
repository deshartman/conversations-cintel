import fs from 'node:fs/promises';
import path from 'node:path';
import { ASSETS_DIR } from '../core/config.js';
import { markDelayTold } from './coupon.js';

let tripCache = null;
// Seat moves made this process, keyed by conversation ID.
const seatMoves = new Map();

async function loadTrip() {
  if (tripCache) return tripCache;
  const raw = await fs.readFile(path.join(ASSETS_DIR, 'trip.json'), 'utf8');
  tripCache = JSON.parse(raw);
  return tripCache;
}

export const checkTripAndSeatsSchema = {
  type: 'function',
  function: {
    name: 'check_trip_and_seats',
    description:
      "Look up Avery Stone's upcoming Owl Airlines trip, its flight status (including any delay), " +
      'and available seats. Use this when Avery asks what happened to their flight, or ' +
      'when Avery asks about moving from a middle seat to a window ' +
      'seat near the front of the cabin.',
    parameters: {
      type: 'object',
      properties: {
        passenger_name: {
          type: 'string',
          description: 'Passenger name, usually Avery Stone.',
        },
        seat_preference: {
          type: 'string',
          description: 'Seat request, e.g. window near the front.',
        },
      },
    },
  },
};

export async function checkTripAndSeats(args = {}, { context } = {}) {
  const seatPreference = args.seat_preference ?? 'window near the front';
  const data = await loadTrip();
  const { passenger, trip, seat } = data;
  if (trip.status === 'Delayed' && context?.conversationId) markDelayTold(context.conversationId);
  const route = `${trip.origin} to ${trip.destination}`;
  const movedTo = seatMoves.get(context?.conversationId);
  const currentSeat = movedTo ?? seat.current;
  const matchingSeats = movedTo ? [] : (seat.front_cabin_window_seats ?? []);
  const recommendedSeat = matchingSeats[0] ?? null;

  return {
    passenger_name: passenger.name,
    loyalty_status: passenger.loyalty_status,
    confirmation_code: trip.confirmation_code,
    flight_number: trip.flight_number,
    route,
    flight_status: trip.status,
    scheduled_departure: trip.scheduled_departure,
    departure: trip.departure,
    delay_reason: trip.delay_reason,
    current_seat: currentSeat,
    seat_preference: seatPreference,
    matching_seats: matchingSeats,
    recommended_seat: recommendedSeat,
    summary:
      `${passenger.name} is an ${passenger.loyalty_status} passenger on ` +
      `${trip.flight_number} from ${route}. ` +
      `The flight is ${trip.status.toLowerCase()}: it was scheduled for ${trip.scheduled_departure} ` +
      `and now departs ${trip.departure} (${trip.delay_reason}). ` +
      (movedTo
        ? `They have already been moved to window seat ${movedTo}.`
        : `They are currently in ${currentSeat}; ${recommendedSeat} is the best available window seat near the front.`),
  };
}

export const changeSeatSchema = {
  type: 'function',
  function: {
    name: 'change_seat',
    description:
      "Move Avery to a new seat on their trip. Call this as soon as Avery agrees to a seat you proposed " +
      "(e.g. says yes or okay to moving to 7A). Do not ask again after they have agreed.",
    parameters: {
      type: 'object',
      properties: {
        new_seat: {
          type: 'string',
          description: 'Seat to move to, e.g. 7A. Must be one of the available seats.',
        },
      },
      required: ['new_seat'],
    },
  },
};

export async function changeSeat(args = {}, { context } = {}) {
  const { trip, seat } = await loadTrip();
  const requested = String(args.new_seat ?? '').trim().toUpperCase();
  if (!(seat.available_window_seats ?? []).includes(requested)) {
    return {
      status: 'failed',
      error: `Seat ${requested || '(none)'} is not available.`,
      available_seats: seat.available_window_seats,
    };
  }
  const previous = seatMoves.get(context?.conversationId) ?? seat.current;
  seatMoves.set(context?.conversationId, requested);
  return {
    status: 'changed',
    flight_number: trip.flight_number,
    previous_seat: previous,
    new_seat: requested,
  };
}
