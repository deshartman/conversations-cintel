import { MemoryPromptBuilder } from 'twilio-agent-connect';
import { MAX_TOOL_ITERATIONS, MODEL } from '../core/config.js';
import { SYSTEM_INSTRUCTIONS, intelligenceNote } from '../core/prompts.js';
import { openaiClient } from '../integrations/openai.js';
import {
  addToolEvent,
  addTranscriptTurn,
  ensureDashboardConversation,
} from '../repositories/conversations.js';
import { couponIssued, couponOffered, noteCallerTurn } from '../tools/coupon.js';
import { allHandlers, allSchemas } from '../tools/registry.js';

// Per-conversation OpenAI chat message history. Handoff/CI status messages
// from the Python version are intentionally omitted.
const conversationHistory = new Map();

function getHistory(convId) {
  let hist = conversationHistory.get(convId);
  if (!hist) {
    hist = [];
    conversationHistory.set(convId, hist);
  }
  return hist;
}

async function dispatchToolCall(call, context, handlers, convId) {
  const name = call.function?.name;
  let args = {};
  try {
    args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    args = {};
  }
  const handler = handlers[name];
  let result;
  if (!handler) {
    result = { error: `unknown tool: ${name}` };
  } else {
    try {
      result = await handler(args, { context });
    } catch (err) {
      result = { error: err?.message ?? String(err) };
    }
  }
  addToolEvent(convId, name, args, result);
  return result;
}

async function runToolLoop(convId, history, tools, handlers, context, forceTool) {
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i += 1) {
    const response = await openaiClient.chat.completions.create({
      model: MODEL,
      messages: history,
      tools,
      // Force a tool on the first call only, e.g. the Intelligence-approved coupon.
      ...(i === 0 && forceTool && { tool_choice: { type: 'function', function: { name: forceTool } } }),
    });
    const msg = response.choices[0].message;
    // Persist the assistant turn (with any tool_calls) so subsequent tool
    // messages have a valid predecessor.
    history.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content ?? '';
    }

    for (const call of msg.tool_calls) {
      const result = await dispatchToolCall(call, context, handlers, convId);
      history.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }
  return "I'm having trouble finishing that. Please try again in a moment.";
}

export async function handleMessageReady(event, { tac } = {}) {
  const { conversationId, message, memory, session } = event;
  const context = event; // TAC context: pass through to tools that read author info
  ensureDashboardConversation(conversationId, context, memory);
  noteCallerTurn(conversationId);

  const history = getHistory(conversationId);
  // MemoryPromptBuilder returns the system prompt with caller memory folded in;
  // reset the system message every turn so refreshed memory takes effect.
  // The latest Intelligence results arrive via /ci-webhook between turns.
  const offered = couponOffered(conversationId);
  const issued = couponIssued(conversationId);
  const note = intelligenceNote({ couponOffered: offered, couponIssued: issued });
  const instructions = note ? `${SYSTEM_INSTRUCTIONS}\n${note}\n` : SYSTEM_INSTRUCTIONS;
  const systemPrompt = MemoryPromptBuilder.compose(instructions, memory, session);
  if (history.length === 0) {
    history.push({ role: 'system', content: systemPrompt });
  } else {
    history[0] = { role: 'system', content: systemPrompt };
  }

  history.push({ role: 'user', content: message });
  addTranscriptTurn(conversationId, 'caller', message);

  const tools = allSchemas();
  const handlers = allHandlers();

  // The model tends to ignore the note, so once Intelligence approves a coupon
  // the first model call this turn must issue it.
  const forceTool = offered && !issued ? 'offer_recovery_coupon' : undefined;
  const reply = await runToolLoop(conversationId, history, tools, handlers, context, forceTool);
  addTranscriptTurn(conversationId, 'agent', reply);
  return reply;
}
