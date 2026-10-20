import fs from 'node:fs/promises';
import path from 'node:path';
import { ASSETS_DIR } from '../core/config.js';
import { markDelayTold } from './coupon.js';

let tripCache = null;

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
  const matchingSeats = seat.front_cabin_window_seats ?? [];
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
    current_seat: seat.current,
    seat_preference: seatPreference,
    matching_seats: matchingSeats,
    recommended_seat: recommendedSeat,
    summary:
      `${passenger.name} is an ${passenger.loyalty_status} passenger on ` +
      `${trip.flight_number} from ${route}. ` +
      `The flight is ${trip.status.toLowerCase()}: it was scheduled for ${trip.scheduled_departure} ` +
      `and now departs ${trip.departure} (${trip.delay_reason}). ` +
      `They are currently in ${seat.current}; ` +
      `${recommendedSeat} is the best available window seat near the front.`,
  };
}
