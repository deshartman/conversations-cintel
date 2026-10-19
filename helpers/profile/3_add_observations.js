// Add demo travel observations to an Owl Airlines passenger profile.
//
// Usage:
//   node helpers/profile/3_add_observations.js
//   node helpers/profile/3_add_observations.js <TWILIO_MEMORY_PROFILE_ID>
//   node helpers/profile/3_add_observations.js <TWILIO_MEMORY_STORE_ID> <TWILIO_MEMORY_PROFILE_ID>
//   npm run profile:observations

import {
  isMainModule,
  loadEnv,
  parseTrailingIdArgs,
  prettyPrint,
  requireEnv,
  requireTwilioAuth,
  twilioRequest,
} from '../common.js';

export async function addPassengerObservations({ memoryStoreId, profileId } = {}) {
  const storeId = memoryStoreId || requireEnv('TWILIO_MEMORY_STORE_ID');
  const profId = profileId || requireEnv('TWILIO_MEMORY_PROFILE_ID');
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const url = `https://memory.twilio.com/v1/Stores/${storeId}/Profiles/${profId}/Observations`;
  const body = {
    observations: [
      {
        content: 'Avery prefers window seats near the front of the cabin and usually avoids middle seats.',
        source: 'owl-airlines-profile',
        occurredAt: now,
      },
      {
        content: 'Upcoming trip OA404 from London to San Francisco is scheduled for tomorrow at 7:00 PM. Avery wants to change from seat 18B to a window seat if one is available.',
        source: 'owl-airlines-reservation',
        occurredAt: now,
      },
      {
        content: 'Avery is an Owl Club Gold member and appreciates proactive rebooking help during delays.',
        source: 'owl-airlines-loyalty',
        occurredAt: now,
      },
    ],
  };

  console.log('Adding Passenger Observations...');
  console.log(`POST ${url}`);
  prettyPrint(body);
  console.log('');

  const response = await twilioRequest('POST', url, body);
  prettyPrint(response);
  console.log('');
  return { profileId: profId, memoryStoreId: storeId, response };
}

if (isMainModule(import.meta.url)) {
  loadEnv();
  requireTwilioAuth();
  const options = parseTrailingIdArgs(process.argv, 'memoryStoreId', 'profileId');
  const { profileId } = await addPassengerObservations(options);
  console.log('Observations added for:');
  console.log(`TWILIO_MEMORY_PROFILE_ID=${profileId}`);
}
