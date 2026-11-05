import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().default(8787),
  HOST: z.string().default('0.0.0.0'),
  ZG_ROUTER_URL: z.string().url().default('https://router-api.0g.ai/v1'),
  ZG_API_KEY: z.string().optional(),
  ZG_COACH_MODEL: z.string().default('qwen3.8-flash'),
  ZG_TIMEOUT_MS: z.coerce.number().int().default(8000),
  ZG_TTS_MODEL: z.string().default('minimax-speech-2.8-turbo'),
  ZG_TTS_VOICE: z.string().default('alloy'),
});

const present = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ''));

export const config = schema.parse(present);
export type Config = typeof config;
