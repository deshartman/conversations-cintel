// Point TWILIO_PHONE_NUMBER's Voice webhook at https://<TWILIO_VOICE_PUBLIC_DOMAIN>/twiml.
//
// Only the Voice URL is touched. The SMS webhook is deliberately left alone:
// SMS reaches the app via Orchestrator statusCallbacks, and pointing the
// number's SMS webhook at the app causes "Invalid webhook payload" errors.
//
// Usage:
//   node helpers/setup/5_configure_phone_number.js
//   npm run setup:phone-number
//
// Docs: https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource

import {
  getTwilioClient,
  isMainModule,
  isPlaceholderValue,
  loadEnv,
  requireEnv,
  requireTwilioAuth,
} from '../common.js';

export async function configurePhoneNumber() {
  const phoneNumber = requireEnv('TWILIO_PHONE_NUMBER');
  const domain = requireEnv('TWILIO_VOICE_PUBLIC_DOMAIN')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  if (isPlaceholderValue(domain) || domain === 'your-domain.ngrok.io') {
    console.error(`TWILIO_VOICE_PUBLIC_DOMAIN is still a placeholder (${domain}).`);
    console.error('Set it to your tunnel host (no https://) and re-run.');
    process.exit(1);
  }
  const voiceUrl = `https://${domain}/twiml`;

  const client = getTwilioClient();
  const [number] = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
  if (!number) {
    throw new Error(`TWILIO_PHONE_NUMBER ${phoneNumber} was not found on this account.`);
  }

  console.log(`Phone number ${phoneNumber} (${number.sid})`);
  console.log(`  current Voice URL: ${number.voiceUrl || '(none)'} [${number.voiceMethod}]`);

  if (number.voiceUrl === voiceUrl && number.voiceMethod === 'POST') {
    console.log('  Voice URL already correct; no change.');
    return { sid: number.sid, voiceUrl, changed: false };
  }

  await client.incomingPhoneNumbers(number.sid).update({ voiceUrl, voiceMethod: 'POST' });
  console.log(`  updated Voice URL: ${voiceUrl} [POST]`);
  return { sid: number.sid, voiceUrl, changed: true };
}

if (isMainModule(import.meta.url)) {
  loadEnv();
  requireTwilioAuth();
  await configurePhoneNumber();
}
