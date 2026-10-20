// Create the Conversation Orchestrator configuration.
//
// Usage:
//   node helpers/setup/2_create_conversation_config.js
//   node helpers/setup/2_create_conversation_config.js <TWILIO_MEMORY_STORE_ID>
//   npm run setup:conversation-config
//
// Docs: https://www.twilio.com/docs/conversations/conversation-orchestrator

import {
  extractOperationResultId,
  isMainModule,
  isPlaceholderValue,
  loadEnv,
  prettyPrint,
  requireEnv,
  requireTwilioAuth,
  timestampSlug,
  twilioRequest,
} from '../common.js';

const CONVERSATION_CONFIG_URL = 'https://conversations.twilio.com/v2/ControlPlane/Configurations';

export async function createConversationConfig({ memoryStoreId } = {}) {
  const twilioPhoneNumber = requireEnv('TWILIO_PHONE_NUMBER');
  const storeId = memoryStoreId || requireEnv('TWILIO_MEMORY_STORE_ID');

  const displayName = `${process.env.CONVERSATION_CONFIG_NAME || 'OwlAir'}-${timestampSlug()}`;
  // statusCallbacks is how Orchestrator tells TAC (POST /webhook) about new
  // SMS communications. Without it, captured SMS never reach the app.
  const voiceDomain = (process.env.TWILIO_VOICE_PUBLIC_DOMAIN || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  const hasDomain = !isPlaceholderValue(voiceDomain) && voiceDomain !== 'your-domain.ngrok.io';
  const statusCallbacks = hasDomain
    ? [{ url: `https://${voiceDomain}/webhook`, method: 'POST' }]
    : [];
  if (!hasDomain) {
    console.log('Warning: TWILIO_VOICE_PUBLIC_DOMAIN not set; creating config without statusCallbacks.');
    console.log('SMS will not reach the app until a statusCallbacks URL is added.');
  }

  const captureRules = [
    { from: twilioPhoneNumber, to: '*', metadata: {} },
    { from: '*', to: twilioPhoneNumber, metadata: {} },
  ];

  const body = {
    displayName,
    description: 'Owl Airlines omnichannel Conversation Orchestrator configuration',
    conversationGroupingType: 'GROUP_BY_PROFILE',
    memoryStoreId: storeId,
    memoryExtractionEnabled: true,
    statusCallbacks,
    channelSettings: {
      SMS: {
        captureRules,
        statusTimeouts: { inactive: 10, closed: 60 },
      },
      WHATSAPP: {
        captureRules,
        statusTimeouts: { inactive: 10, closed: 60 },
      },
      RCS: {
        captureRules,
        statusTimeouts: { inactive: 10, closed: 60 },
      },
      // VOICE has no passive capture rules because TAC/ConversationRelay
      // performs active ingestion.
      VOICE: { statusTimeouts: null },
    },
  };

  console.log(`Creating Conversation Configuration: ${displayName}`);
  console.log(`POST ${CONVERSATION_CONFIG_URL}`);
  prettyPrint(body);
  console.log('');
  console.log('Note: VOICE has no passive captureRules because TAC/ConversationRelay uses active ingestion.');
  console.log('');

  const response = await twilioRequest('POST', CONVERSATION_CONFIG_URL, body);
  prettyPrint(response);
  console.log('');

  const id = await extractOperationResultId(response, 'Conversation Configuration creation');
  return { id, displayName, response };
}

if (isMainModule(import.meta.url)) {
  loadEnv();
  requireTwilioAuth();
  const memoryStoreId = process.argv[2] || undefined;
  const { id } = await createConversationConfig({ memoryStoreId });
  console.log('Conversation Configuration created:');
  console.log(`TWILIO_CONVERSATION_CONFIGURATION_ID=${id}`);
}
