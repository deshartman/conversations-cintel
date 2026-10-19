import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
export const MAX_TOOL_ITERATIONS = 5;
export const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
export const DEMO_CALLER_PHONE_NUMBER = process.env.DEMO_CALLER_PHONE_NUMBER;

// Repo root is two levels above src/core.
export const ASSETS_DIR = path.resolve(__dirname, '..', '..', 'assets');
