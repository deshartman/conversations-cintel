// Read-only checks to run before provisioning anything: required env vars,
// both credential types (auth token for helpers, API key for TAC), and that
// the account has accepted the Conversations terms of service.
//
// Usage:
//   node helpers/setup/0_preflight.js
//   npm run preflight

import twilio from 'twilio';
import { isMainModule, loadEnv, TERMS_HINT } from '../common.js';

const CONTROL_PLANE_URLS = {
  'Conversation Orchestrator': 'https://conversations.twilio.com/v2/ControlPlane/Configurations',
  'Conversation Memory': 'https://memory.twilio.com/v1/ControlPlane/Stores',
};

const REQUIRED_ENV = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_API_KEY',
  'TWILIO_API_SECRET',
  'TWILIO_PHONE_NUMBER',
];

async function probe(client, url) {
  const { statusCode, body } = await client.request({ method: 'GET', uri: url });
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { statusCode, termsNotAccepted: /20003/.test(text) && /terms of service/i.test(text) };
}

export async function runPreflight() {
  const problems = [];

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length) problems.push(`Missing env vars: ${missing.join(', ')}`);

  if (!missing.length) {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_API_KEY, TWILIO_API_SECRET } = process.env;
    const credentials = {
      'auth token (helpers)': twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
      'API key (TAC)': twilio(TWILIO_API_KEY, TWILIO_API_SECRET, { accountSid: TWILIO_ACCOUNT_SID }),
    };

    let termsNotAccepted = false;
    for (const [credLabel, client] of Object.entries(credentials)) {
      for (const [product, url] of Object.entries(CONTROL_PLANE_URLS)) {
        const result = await probe(client, url);
        const ok = result.statusCode >= 200 && result.statusCode < 300;
        console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${product} via ${credLabel} -> HTTP ${result.statusCode}`);
        if (result.termsNotAccepted) termsNotAccepted = true;
        else if (!ok) problems.push(`${product} via ${credLabel} returned HTTP ${result.statusCode}`);
      }
    }
    if (termsNotAccepted) problems.push(`Conversations terms of service not accepted.${TERMS_HINT}`);
  }

  if (problems.length) {
    console.error('');
    console.error('Preflight failed:');
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }
  console.log('Preflight passed.');
}

if (isMainModule(import.meta.url)) {
  loadEnv();
  await runPreflight();
}
