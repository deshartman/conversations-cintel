// ?conversation=<id> pins a conversation even when it has no dashboard
// record (e.g. CI/Orchestrator webhooks only), so it is not in the list.
const urlConversation = new URLSearchParams(window.location.search).get('conversation');
let selectedId = urlConversation;
let currentConversations = [];
let lastInsights = null;

const fmtTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString();
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function statusLabel(status) {
  return status || 'active';
}

function renderList(conversations) {
  const list = document.getElementById('conversationList');
  list.replaceChildren();
  if (!conversations.length) {
    list.appendChild(el('div', 'muted empty-note', 'No conversations yet.'));
    return;
  }
  if (!selectedId || (selectedId !== urlConversation && !conversations.some((c) => c.id === selectedId))) {
    selectedId = conversations[0].id;
  }
  for (const conv of conversations) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'conv-btn';
    if (conv.id === selectedId) btn.classList.add('active');
    if (conv.status === 'ended') btn.classList.add('ended');
    btn.dataset.id = conv.id;

    btn.appendChild(el('div', 'conv-id', conv.id));

    const meta = el('div', 'conv-meta');
    const statusBadge = el('span', `badge ${conv.status === 'ended' ? 'ended' : 'active'}`, statusLabel(conv.status));
    meta.appendChild(statusBadge);
    if (conv.channel) meta.appendChild(el('span', 'badge channel', String(conv.channel)));
    const started = fmtTime(conv.startedAt);
    if (started) meta.appendChild(el('span', null, started));
    btn.appendChild(meta);

    btn.addEventListener('click', () => {
      selectedId = conv.id;
      renderList(currentConversations);
      loadSelected();
      pollInsights();
    });
    list.appendChild(btn);
  }
}

function renderTranscript(conversation) {
  const container = document.getElementById('transcript');
  container.replaceChildren();
  const turns = conversation.transcript || [];
  if (!turns.length) {
    container.appendChild(el('div', 'empty', 'Caller and agent turns will appear here.'));
    return;
  }
  for (const turn of turns) {
    const role = turn.role === 'agent' ? 'agent' : 'caller';
    const article = document.createElement('article');
    article.className = `turn ${role}`;
    const time = fmtTime(turn.at);
    article.appendChild(el('div', 'speaker', time ? `${role} - ${time}` : role));
    article.appendChild(el('div', 'bubble', turn.text || ''));
    container.appendChild(article);
  }
  container.scrollTop = container.scrollHeight;
}

function safeStringify(value) {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function renderConversation(conversation) {
  document.getElementById('conversationTitle').textContent = conversation.id;
  const status = document.getElementById('conversationStatus');
  const parts = [statusLabel(conversation.status)];
  if (conversation.channel) parts.push(String(conversation.channel));
  const started = fmtTime(conversation.startedAt);
  if (started) parts.push(`started ${started}`);
  status.textContent = parts.join(' - ');

  const last = document.getElementById('lastUpdated');
  last.textContent = `Updated ${fmtTime(new Date().toISOString())}`;

  renderTranscript(conversation);
}

function clearConversation() {
  document.getElementById('conversationTitle').textContent = 'Select a conversation';
  document.getElementById('conversationStatus').textContent = '';
  document.getElementById('transcript').replaceChildren(
    el('div', 'empty', 'Caller and agent turns will appear here.'),
  );
}

async function loadSelected() {
  if (!selectedId) {
    clearConversation();
    return;
  }
  // A URL-pinned conversation may have only CI/Orchestrator events and no
  // dashboard record; skip the fetch rather than 404 on every poll.
  if (!currentConversations.some((c) => c.id === selectedId)) {
    clearConversation();
    document.getElementById('conversationTitle').textContent = selectedId;
    return;
  }
  try {
    const res = await fetch(`/api/conversations/${encodeURIComponent(selectedId)}`);
    if (!res.ok) {
      clearConversation();
      return;
    }
    const conv = await res.json();
    renderConversation(conv);
  } catch {
    // Network hiccup; leave last render.
  }
}

async function refresh() {
  try {
    const res = await fetch('/api/conversations');
    const data = await res.json();
    currentConversations = Array.isArray(data.conversations) ? data.conversations : [];
    renderList(currentConversations);
    if (currentConversations.length || selectedId) {
      await loadSelected();
    } else {
      clearConversation();
    }
  } catch {
    // Retain last-known state on transient errors.
  }
}

// Tool details the user expanded, so a re-render does not collapse them.
const openTools = new Set();

function toolBody(event, item) {
  const key = `${event.tool}|${event.created_at}`;
  const details = el('details', 'tool-details');
  details.open = openTools.has(key);
  details.addEventListener('toggle', () => {
    if (details.open) openTools.add(key);
    else openTools.delete(key);
  });
  const hasArgs = event.arguments && Object.keys(event.arguments).length;
  const summary = event.status === 'failed' && event.result?.error
    ? `error: ${event.result.error}`
    : hasArgs ? JSON.stringify(event.arguments) : 'no args';
  details.appendChild(el('summary', null, summary));
  if (hasArgs) {
    details.appendChild(el('div', 'label', 'Args'));
    details.appendChild(el('pre', null, safeStringify(event.arguments)));
  }
  if (event.result !== undefined && event.result !== null) {
    details.appendChild(el('div', 'label', 'Result'));
    details.appendChild(el('pre', null, safeStringify(event.result)));
  }
  item.appendChild(details);
}

function eventItem(event) {
  const item = el('div', `event-item ${event.kind}`);
  const head = el('div', 'event-head');
  let title = '';
  let detail = '';
  if (event.kind === 'orchestrator') {
    head.appendChild(el('span', 'badge orchestrator', 'Orchestrator'));
    title = event.event_type;
    detail = event.detail;
  } else if (event.kind === 'intelligence') {
    head.appendChild(el('span', 'badge intelligence', 'Intelligence'));
    title = event.operator;
    detail = event.detail;
    if (event.signal?.type === 'offer_coupon' && event.signal.value === true) item.classList.add('coupon-yes');
  } else if (event.kind === 'tool') {
    const failed = event.status === 'failed';
    if (failed) item.classList.add('failed');
    head.appendChild(el('span', `badge tool ${failed ? 'failed' : ''}`, 'Tool'));
    title = event.tool;
  }
  if (title) head.appendChild(el('span', 'event-name', title));
  head.appendChild(el('span', 'event-time muted', fmtTime(event.created_at)));
  item.appendChild(head);
  if (detail) item.appendChild(el('div', 'event-detail', detail));
  if (event.kind === 'tool') toolBody(event, item);
  return item;
}

function renderEvents(events) {
  const container = document.getElementById('eventsTimeline');
  container.replaceChildren();
  if (!events.length) {
    container.appendChild(el('div', 'muted empty-note', 'No events yet.'));
    return;
  }
  for (const event of events) container.appendChild(eventItem(event));
  container.scrollTop = container.scrollHeight;
}

// offer-coupon and Intent-Recognition first, then other operators A-Z.
const PINNED = { offer_coupon: 0, intent: 1 };
const signalText = (signal) => (signal.type === 'offer_coupon' ? (signal.value ? 'YES' : 'no') : String(signal.value));

// Latest result per operator, from the time-ordered intelligence events.
// Signal operators show their value (the label already names it) and a
// "was:" trail of up to 3 earlier distinct values.
function latestPerOperator(events) {
  const byOp = new Map();
  for (const event of events) {
    if (event.kind !== 'intelligence') continue;
    const name = event.operator || 'Operator';
    const value = event.signal ? signalText(event.signal) : event.detail || '';
    const row = byOp.get(name) ?? { name, history: [] };
    if (row.value !== value) row.history.push(value);
    row.value = value;
    row.signal = event.signal;
    byOp.set(name, row);
  }
  const rank = (row) => PINNED[row.signal?.type] ?? 2;
  return [...byOp.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

// Last rendered value per operator, to flash rows whose value changed.
let intelFor = null;
let intelValues = new Map();

function renderIntel(id, events) {
  const container = document.getElementById('intelList');
  const rows = latestPerOperator(events);
  const prev = intelFor === id ? intelValues : new Map();
  container.replaceChildren();
  if (!rows.length) container.appendChild(el('div', 'muted empty-note', 'No operator results yet.'));
  for (const row of rows) {
    container.appendChild(el('div', 'intel-name', row.name));
    const cell = el('div', 'intel-cell');
    const value = el('div', 'intel-value', row.value || '-');
    if (row.signal?.type === 'offer_coupon' && row.signal.value === true) value.classList.add('yes');
    cell.appendChild(value);
    const earlier = row.signal ? row.history.slice(0, -1).slice(-3) : [];
    if (earlier.length) cell.appendChild(el('div', 'intel-trail muted', `was: ${earlier.join(' → ')}`));
    if (prev.has(row.name) && prev.get(row.name) !== row.value) {
      cell.classList.add('flash');
      setTimeout(() => cell.classList.remove('flash'), 1500);
    }
    container.appendChild(cell);
  }
  intelFor = id;
  intelValues = new Map(rows.map((r) => [r.name, r.value]));
}

// Events for the selected conversation. Re-renders only when the payload
// changed, so the timeline does not jump between polls. Messages are left
// out: they are already in the transcript.
async function pollInsights() {
  const id = selectedId;
  if (!id) return;
  try {
    const data = await fetch(`/api/sessions/${encodeURIComponent(id)}/events`).then((r) => r.json());
    if (id !== selectedId) return;
    const events = (data.events || []).filter((e) => e.kind !== 'message');
    const key = JSON.stringify([id, events]);
    if (key === lastInsights) return;
    lastInsights = key;
    renderIntel(id, events);
    renderEvents(events);
  } catch {
    // Retain last-known state on transient errors.
  }
}

refresh();
setInterval(refresh, 3000);
pollInsights();
setInterval(pollInsights, 2000);
