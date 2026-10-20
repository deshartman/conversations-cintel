import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import {
  TAC,
  TACConfig,
  TACServer,
  VoiceChannel,
  SMSChannel,
} from 'twilio-agent-connect';
import { registerDashboardRoutes } from './routes/dashboard.js';
import { handleMessageReady } from './services/agent.js';
import { markConversationEnded } from './repositories/conversations.js';
import { captureCiPayload, captureOrchestratorPayload } from './services/capture.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CI_WEBHOOK_PATH = '/ci-webhook';

config();

// One Intelligence config ID for the helpers and TAC: TAC's fromEnv() reads
// TWILIO_TAC_CI_CONFIGURATION_ID, so mirror ours into it (placeholders ignored).
const intelConfigId = process.env.TWILIO_INTELLIGENCE_CONFIGURATION_ID;
if (intelConfigId && !intelConfigId.includes('xxxx')) {
  process.env.TWILIO_TAC_CI_CONFIGURATION_ID = intelConfigId;
}

async function buildTac() {
  try {
    return await TAC.create({ config: TACConfig.fromEnv() });
  } catch (err) {
    const wrapped = new Error(
      `Failed to construct TAC from environment. Verify .env against .env.example: ${err?.message ?? err}`,
    );
    wrapped.cause = err;
    throw wrapped;
  }
}

export async function startServer() {
  const fastify = Fastify({ logger: true });

  await fastify.register(fastifyStatic, {
    root: path.resolve(__dirname, 'static'),
    prefix: '/static/',
  });

  await registerDashboardRoutes(fastify);

  // Copy CI and Orchestrator webhook bodies into dashboard state before TAC's
  // route runs. preValidation fires after body parsing but before TAC's
  // signature preHandler, so capture happens whether or not TAC accepts it.
  fastify.addHook('preValidation', async (request) => {
    if (request.method !== 'POST') return;
    const urlPath = request.url.split('?')[0];
    if (urlPath === CI_WEBHOOK_PATH) captureCiPayload(request.body);
    else if (urlPath === '/webhook') captureOrchestratorPayload(request.body);
  });

  const tac = await buildTac();
  // Voice uses ACTIVE TwiML via ConversationRelay; do NOT add passive VOICE
  // capture rules in the Orchestrator config or STT will be double-billed.
  const voiceChannel = new VoiceChannel(tac, { memoryMode: 'once' });
  const smsChannel = new SMSChannel(tac, { memoryMode: 'always' });
  tac.registerChannel(voiceChannel);
  tac.registerChannel(smsChannel);

  tac.onMessageReady(async (event) => handleMessageReady(event, { tac }));
  tac.onConversationEnded(({ session }) => markConversationEnded(session.conversationId));

  const server = new TACServer(tac, {
    voiceChannel,
    messagingChannels: [smsChannel],
    fastifyInstance: fastify,
    port: Number(process.env.PORT ?? 8000),
    // TAC registers /ci-webhook only when asked; without the CI config ID it
    // would answer every request with 400, so leave the route off entirely.
    ...(process.env.TWILIO_TAC_CI_CONFIGURATION_ID && {
      webhookPaths: { cintel: CI_WEBHOOK_PATH },
    }),
  });

  await server.start();
}
