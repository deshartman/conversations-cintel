// Create the Owl Airlines demo passenger memory profile.
//
// Usage:
//   node helpers/profile/run_all.js
//   node helpers/profile/run_all.js <TWILIO_MEMORY_STORE_ID>
//   npm run profile

import { loadEnv, requireTwilioAuth, writeEnvIfMissing } from '../common.js';
import { runPreflight } from '../setup/0_preflight.js';
import { createTraitGroups } from './1_create_trait_groups.js';
import { createPassengerProfile } from './2_create_profile.js';
import { addPassengerObservations } from './3_add_observations.js';
import { verifyPassengerMemory } from './4_verify_memory.js';

loadEnv();
requireTwilioAuth();

const memoryStoreId = process.argv[2] || process.env.TWILIO_MEMORY_STORE_ID;

console.log('====================================');
console.log('Owl Airlines Passenger Memory Setup');
console.log('====================================');
console.log('');

console.log('Step 0: Preflight checks');
await runPreflight();
console.log('');

console.log('Step 1: Create trait groups');
await createTraitGroups({ memoryStoreId });
console.log('');

console.log('Step 2: Create passenger profile');
const { id: profileId } = await createPassengerProfile({ memoryStoreId });
writeEnvIfMissing('TWILIO_MEMORY_PROFILE_ID', profileId);
console.log('');

console.log('Step 3: Add observations');
await addPassengerObservations({ memoryStoreId, profileId });
console.log('');

console.log('Step 4: Verify memory recall');
console.log('Memory observations are processed asynchronously, so this step may wait briefly.');
await verifyPassengerMemory({ memoryStoreId, profileId });
console.log('');

console.log('====================================');
console.log('Profile setup complete');
console.log('====================================');
console.log('');
console.log(`TWILIO_MEMORY_PROFILE_ID=${profileId}`);
