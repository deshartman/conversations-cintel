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

function renderToolEvents(conversation) {
  const container = document.getElementById('toolEvents');
  container.replaceChildren();
  const events = conversation.toolEvents || [];
  if (!events.length) {
    container.appendChild(el('div', 'muted empty-note', 'No tool events yet.'));
    return;
  }
  for (const event of events) {
    const wrap = el('div', 'tool-event');
    const head = document.createElement('div');
    head.appendChild(el('span', 'name', event.name || 'unnamed_tool'));
    const at = fmtTime(event.at);
    if (at) {
      head.appendChild(document.createTextNode(' '));
      head.appendChild(el('span', 'at', `- ${at}`));
    }
    wrap.appendChild(head);

    if (event.args && Object.keys(event.args).length) {
      wrap.appendChild(el('div', 'label', 'Args'));
      wrap.appendChild(el('pre', null, safeStringify(event.args)));
    }
    if (event.result !== undefined && event.result !== null) {
      wrap.appendChild(el('div', 'label', 'Result'));
      wrap.appendChild(el('pre', null, safeStringify(event.result)));
    }
    container.appendChild(wrap);
  }
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
  renderToolEvents(conversation);
}

function clearConversation() {
  document.getElementById('conversationTitle').textContent = 'Select a conversation';
  document.getElementById('conversationStatus').textContent = '';
  document.getElementById('transcript').replaceChildren(
    el('div', 'empty', 'Caller and agent turns will appear here.'),
  );
  document.getElementById('toolEvents').replaceChildren(
    el('div', 'muted empty-note', 'No tool events yet.'),
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

function eventItem(event) {
  const item = el('div', `event-item ${event.kind}`);
  const head = el('div', 'event-head');
  let title = '';
  let detail = '';
  if (event.kind === 'message') {
    const caller = event.role === 'user';
    head.appendChild(el('span', `badge ${caller ? 'caller' : 'agent'}`, caller ? 'Caller' : 'Agent'));
    detail = event.content;
  } else if (event.kind === 'orchestrator') {
    head.appendChild(el('span', 'badge orchestrator', 'Orchestrator'));
    title = event.event_type;
    detail = event.detail;
  } else if (event.kind === 'intelligence') {
    head.appendChild(el('span', 'badge intelligence', 'Intelligence'));
    title = event.operator;
    detail = event.detail;
    if (event.signal?.type === 'offer_coupon' && event.signal.value === true) item.classList.add('coupon-yes');
  } else if (event.kind === 'tool') {
    head.appendChild(el('span', `badge tool ${event.status === 'failed' ? 'failed' : ''}`, 'Tool'));
    title = event.tool;
    detail = event.arguments && Object.keys(event.arguments).length ? JSON.stringify(event.arguments) : '';
  }
  if (title) head.appendChild(el('span', 'event-name', title));
  head.appendChild(el('span', 'event-time muted', fmtTime(event.created_at)));
  item.appendChild(head);
  if (detail) item.appendChild(el('div', 'event-detail', detail));
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

const couponText = (value) => (value ? 'YES' : 'no');

function renderSignal(valueId, trailId, signal, format) {
  const valueEl = document.getElementById(valueId);
  const latest = signal?.latest;
  valueEl.textContent = latest ? format(latest.value) : '-';
  valueEl.classList.toggle('yes', valueId === 'couponValue' && latest?.value === true);
  // Earlier values only (the latest is shown above), most recent 3.
  const earlier = (signal?.history ?? []).slice(0, -1).slice(-3);
  document.getElementById(trailId).textContent =
    earlier.length ? `was: ${earlier.map((h) => format(h.value)).join(' \u2192 ')}` : '';
}

function renderSignals(signals) {
  renderSignal('intentValue', 'intentTrail', signals.intent, String);
  renderSignal('couponValue', 'couponTrail', signals.offer_coupon, couponText);
}

// Events + signals for the selected conversation. Re-renders only when the
// combined payload changed, so the timeline does not jump between polls.
async function pollInsights() {
  const id = selectedId;
  if (!id) return;
  try {
    const base = `/api/sessions/${encodeURIComponent(id)}`;
    const [events, signals] = await Promise.all([
      fetch(`${base}/events`).then((r) => r.json()),
      fetch(`${base}/signals`).then((r) => r.json()),
    ]);
    if (id !== selectedId) return;
    const key = JSON.stringify([id, events.events, signals]);
    if (key === lastInsights) return;
    lastInsights = key;
    // Signals first: their height changes the timeline's, then scroll it.
    renderSignals(signals);
    renderEvents(events.events || []);
  } catch {
    // Retain last-known state on transient errors.
  }
}

refresh();
setInterval(refresh, 3000);
pollInsights();
setInterval(pollInsights, 2000);
