// Delete Owl Airlines Twilio Conversation Services setup.
//
// Usage:
//   node helpers/setup/0_cleanup.js                           # dry-run everything from .env
//   node helpers/setup/0_cleanup.js --yes                     # delete everything from .env
//   node helpers/setup/0_cleanup.js memory <MEMORY_STORE_ID>  # dry-run one Memory Store
//   node helpers/setup/0_cleanup.js --yes memory <MEMORY_STORE_ID>
//   node helpers/setup/0_cleanup.js conversation <CONVERSATION_CONFIG_ID>
//   node helpers/setup/0_cleanup.js intelligence <INTELLIGENCE_CONFIG_ID>

import {
  isNotFoundError,
  loadEnv,
  requireTwilioAuth,
  twilioRequest,
} from '../common.js';

const VALID_TARGETS = new Set(['all', 'memory', 'conversation', 'intelligence']);

function parseArgs(argv) {
  const args = argv.slice(2);
  let dryRun = true;
  if (args[0] === '--yes') {
    dryRun = false;
    args.shift();
  }
  const target = args[0] || 'all';
  const id = args[1];
  if (!VALID_TARGETS.has(target)) {
    console.error(`Unknown cleanup target: ${target}`);
    console.error('');
    console.error('Use one of:');
    console.error('  all');
    console.error('  memory <MEMORY_STORE_ID>');
    console.error('  conversation <CONVERSATION_CONFIG_ID>');
    console.error('  intelligence <INTELLIGENCE_CONFIG_ID>');
    process.exit(1);
  }
  return { dryRun, target, id };
}

async function deleteResource({ label, id, url, dryRun }) {
  if (!id) {
    console.log(`Skipping ${label}: no ID configured.`);
    console.log('');
    return;
  }
  console.log(`Deleting ${label}...`);
  console.log(`DELETE ${url}`);
  if (!dryRun) {
    try {
      await twilioRequest('DELETE', url);
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
      console.log(`${label} not found; already deleted.`);
    }
  }
  console.log('');
}

async function run() {
  loadEnv();
  const { dryRun, target, id } = parseArgs(process.argv);

  if (dryRun) {
    console.log('Dry run. No Twilio resources will be deleted.');
    console.log('Add --yes to apply deletion.');
    console.log('');
  } else {
    requireTwilioAuth();
  }

  const memoryStoreId = id || process.env.TWILIO_MEMORY_STORE_ID;
  const conversationConfigId = id || process.env.TWILIO_CONVERSATION_CONFIGURATION_ID;
  const intelligenceConfigId = id || process.env.TWILIO_INTELLIGENCE_CONFIGURATION_ID;

  const memoryUrl = `https://memory.twilio.com/v1/ControlPlane/Stores/${memoryStoreId}`;
  const conversationUrl = `https://conversations.twilio.com/v2/ControlPlane/Configurations/${conversationConfigId}`;
  const intelligenceUrl = `https://intelligence.twilio.com/v3/ControlPlane/Configurations/${intelligenceConfigId}`;

  switch (target) {
    case 'all':
      await deleteResource({
        label: 'Conversation Configuration',
        id: conversationConfigId,
        url: conversationUrl,
        dryRun,
      });
      await deleteResource({
        label: 'Intelligence Configuration',
        id: intelligenceConfigId,
        url: intelligenceUrl,
        dryRun,
      });
      await deleteResource({
        label: 'Memory Store',
        id: memoryStoreId,
        url: memoryUrl,
        dryRun,
      });
      break;
    case 'memory':
      await deleteResource({
        label: 'Memory Store',
        id: memoryStoreId,
        url: memoryUrl,
        dryRun,
      });
      break;
    case 'conversation':
      await deleteResource({
        label: 'Conversation Configuration',
        id: conversationConfigId,
        url: conversationUrl,
        dryRun,
      });
      break;
    case 'intelligence':
      await deleteResource({
        label: 'Intelligence Configuration',
        id: intelligenceConfigId,
        url: intelligenceUrl,
        dryRun,
      });
      break;
  }

  console.log('Done.');
}

await run();
