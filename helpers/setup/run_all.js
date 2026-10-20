// Run the full Owl Airlines Twilio Conversation Services setup.
//
// Creates (or reuses, when .env already has a real ID) the Memory Store and
// Conversation Configuration, optionally Intelligence, seeds the passenger
// profile + traits, and points TWILIO_PHONE_NUMBER's Voice webhook at the app.
// New IDs are written into .env when the key is missing or a placeholder.
//
// Usage:
//   node helpers/setup/run_all.js
//   npm run setup

import { isPlaceholderValue, loadEnv, requireTwilioAuth, writeEnvIfMissing } from '../common.js';
import { runPreflight } from './0_preflight.js';
import { createMemoryStore } from './1_create_memory_store.js';
import { createConversationConfig } from './2_create_conversation_config.js';
import { createIntelligenceConfig } from './3_create_intelligence_config.js';
import { attachIntelligenceConfig } from './4_update_conversation_config.js';
import { configurePhoneNumber } from './5_configure_phone_number.js';
import { createTraitGroups } from '../profile/1_create_trait_groups.js';
import { createPassengerProfile } from '../profile/2_create_profile.js';
import { addPassengerObservations } from '../profile/3_add_observations.js';
import { verifyPassengerMemory } from '../profile/4_verify_memory.js';

loadEnv();
requireTwilioAuth();

// Reuse an existing real ID from .env; otherwise create and record it.
async function ensureResource(envName, create) {
  const existing = process.env[envName];
  if (!isPlaceholderValue(existing)) {
    console.log(`Using existing ${envName}=${existing} from .env (skipping create).`);
    return existing;
  }
  const { id } = await create();
  writeEnvIfMissing(envName, id);
  return id;
}

console.log('==========================================');
console.log('Owl Airlines Twilio Conversation Services');
console.log('==========================================');
console.log('');

console.log('Step 0: Preflight checks');
await runPreflight();
console.log('');

console.log('Step 1: Memory Store');
const memoryStoreId = await ensureResource('TWILIO_MEMORY_STORE_ID', createMemoryStore);
console.log('');

console.log('Step 2: Conversation Configuration');
const conversationConfigId = await ensureResource(
  'TWILIO_CONVERSATION_CONFIGURATION_ID',
  () => createConversationConfig({ memoryStoreId }),
);
console.log('');

// Intelligence is normally set up manually in the Console
// (assets/conversation-intelligence.md), so skip it unless all operator IDs are set.
const intelligenceOperatorVars = [
  'TWILIO_INTELLIGENCE_SENTIMENT_OPERATOR_ID',
  'TWILIO_INTELLIGENCE_SUMMARY_OPERATOR_ID',
  'TWILIO_INTELLIGENCE_NEXT_BEST_RESPONSE_OPERATOR_ID',
];
console.log('Step 3: Intelligence Configuration');
if (intelligenceOperatorVars.every((name) => process.env[name])) {
  const intelligenceConfigId = await ensureResource(
    'TWILIO_INTELLIGENCE_CONFIGURATION_ID',
    createIntelligenceConfig,
  );
  console.log('');
  console.log('Step 4: Attach Intelligence to Conversation Orchestrator');
  await attachIntelligenceConfig({ conversationConfigId, intelligenceConfigId });
} else {
  console.log(`  Skipped: set ${intelligenceOperatorVars.join(', ')} to enable,`);
  console.log('  or configure Intelligence manually (assets/conversation-intelligence.md).');
}
console.log('');

console.log('Step 5: Passenger profile + trait groups');
await createTraitGroups({ memoryStoreId });
const { id: profileId } = await createPassengerProfile({ memoryStoreId });
writeEnvIfMissing('TWILIO_MEMORY_PROFILE_ID', profileId);
await addPassengerObservations({ memoryStoreId, profileId });
console.log('Memory observations are processed asynchronously, so this step may wait briefly.');
await verifyPassengerMemory({ memoryStoreId, profileId, fatal: false });
console.log('');

console.log('Step 6: Phone number Voice webhook');
const voiceDomain = process.env.TWILIO_VOICE_PUBLIC_DOMAIN;
if (isPlaceholderValue(voiceDomain) || voiceDomain === 'your-domain.ngrok.io') {
  console.log('  Skipped: set TWILIO_VOICE_PUBLIC_DOMAIN to your tunnel host, then run');
  console.log('  npm run setup:phone-number');
} else {
  await configurePhoneNumber();
}
console.log('');

console.log('==========================================');
console.log('Setup complete');
console.log('==========================================');
console.log('');
console.log('Reminder: SMS needs Orchestrator statusCallbacks (RUNBOOK_SETUP.md §6.4).');
console.log('');
console.log('Cleanup dry run:');
console.log('  npm run setup:cleanup');
console.log('');
console.log('Cleanup apply:');
console.log('  npm run setup:cleanup:apply');
