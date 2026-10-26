import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';

import {
  listConversations,
  getConversation,
  getCiEvents,
  getOrchestratorEvents,
  markConversationEnded,
} from '../repositories/conversations.js';
import { ciSignals } from '../services/capture.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_HTML_PATH = join(__dirname, '..', 'static', 'dashboard.html');

export async function registerDashboardRoutes(fastify) {
  fastify.get('/', async (_request, reply) => {
    const html = await readFile(DASHBOARD_HTML_PATH, 'utf8');
    reply.type('text/html; charset=utf-8').send(html);
  });

  fastify.get('/api/conversations', async () => {
    return { conversations: listConversations() };
  });

  fastify.get('/api/conversations/:id', async (request, reply) => {
    const conversation = getConversation(request.params.id);
    if (!conversation) {
      reply.code(404);
      return { error: 'not_found', id: request.params.id };
    }
    return conversation;
  });

  // Time-ordered timeline for one conversation: transcript turns, tool calls,
  // Orchestrator webhook events and CI operator results. Not 404 for unknown
  // IDs: CI/Orchestrator webhooks can arrive before the agent sees a turn.
  fastify.get('/api/sessions/:id/events', async (request) => {
    const { id } = request.params;
    const conversation = getConversation(id);
    const ciEvents = getCiEvents(id);
    const orchestratorEvents = getOrchestratorEvents(id);
    const toolEvents = (conversation?.toolEvents ?? []).map((e) => ({
      tool: e.name,
      arguments: e.args ?? {},
      result: e.result ?? null,
      status: e.result?.error ? 'failed' : 'completed',
      created_at: e.at,
    }));

    const events = [
      ...(conversation?.transcript ?? []).map((t) => ({
        kind: 'message',
        role: t.role === 'agent' ? 'assistant' : 'user',
        content: t.text,
        created_at: t.at,
      })),
      ...toolEvents.map((e) => ({ kind: 'tool', ...e })),
      ...orchestratorEvents.map((e) => ({ kind: 'orchestrator', ...e })),
      ...ciEvents.map((e) => ({ kind: 'intelligence', ...e })),
    ].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));

    return {
      id,
      events,
      ci_events: ciEvents,
      tool_events: toolEvents,
      orchestrator_events: orchestratorEvents,
    };
  });

  fastify.get('/api/sessions/:id/signals', async (request) => {
    const { id } = request.params;
    return { id, ...ciSignals(getCiEvents(id)) };
  });

  // Close the Orchestrator conversation so the next message starts a fresh one
  // (with the current Configuration, including Intelligence).
  fastify.post('/api/conversations/:id/close', async (request, reply) => {
    const { id } = request.params;
    const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET } = process.env;
    const auth = Buffer.from(`${TWILIO_API_KEY}:${TWILIO_API_SECRET}`).toString('base64');
    const res = await fetch(
      `https://conversations.twilio.com/v2/Conversations/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          'X-Twilio-AccountSid': TWILIO_ACCOUNT_SID,
        },
        body: JSON.stringify({ status: 'CLOSED' }),
      },
    );
    if (!res.ok) {
      reply.code(res.status);
      return { error: 'close_failed', status: res.status, detail: await res.text() };
    }
    markConversationEnded(id);
    return { id, status: 'closed' };
  });

  fastify.get('/healthz', async () => ({ status: 'ok' }));
}
