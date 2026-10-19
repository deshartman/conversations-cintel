// Run the full Owl Airlines Twilio Conversation Services setup.
//
// Usage:
//   node helpers/setup/run_all.js
//   npm run setup

import { loadEnv, requireTwilioAuth } from '../common.js';
import { runPreflight } from './0_preflight.js';
import { createMemoryStore } from './1_create_memory_store.js';
import { createConversationConfig } from './2_create_conversation_config.js';
import { createIntelligenceConfig } from './3_create_intelligence_config.js';
import { attachIntelligenceConfig } from './4_update_conversation_config.js';

loadEnv();
requireTwilioAuth();

console.log('==========================================');
console.log('Owl Airlines Twilio Conversation Services');
console.log('==========================================');
console.log('');

console.log('Step 0: Preflight checks');
await runPreflight();
console.log('');

console.log('Step 1: Create Memory Store');
const { id: memoryStoreId } = await createMemoryStore();
console.log('');

console.log('Step 2: Create Conversation Configuration');
const { id: conversationConfigId } = await createConversationConfig({ memoryStoreId });
console.log('');

console.log('Step 3: Create Intelligence Configuration');
const { id: intelligenceConfigId } = await createIntelligenceConfig();
console.log('');

console.log('Step 4: Attach Intelligence to Conversation Orchestrator');
await attachIntelligenceConfig({ conversationConfigId, intelligenceConfigId });
console.log('');

console.log('==========================================');
console.log('Setup complete');
console.log('==========================================');
console.log('');
console.log('Add these values to .env:');
console.log(`TWILIO_MEMORY_STORE_ID=${memoryStoreId}`);
console.log(`TWILIO_CONVERSATION_CONFIGURATION_ID=${conversationConfigId}`);
console.log(`TWILIO_INTELLIGENCE_CONFIGURATION_ID=${intelligenceConfigId}`);
console.log('');
console.log('Cleanup dry run:');
console.log('  npm run setup:cleanup');
console.log('');
console.log('Cleanup apply:');
console.log('  npm run setup:cleanup:apply');
