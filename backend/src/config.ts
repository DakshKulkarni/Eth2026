import { z } from 'zod';

function cleanKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '').trim();
  return /^[0-9a-fA-F]{64}$/.test(trimmed) ? `0x${trimmed}` : trimmed;
}

const schema = z.object({
  PORT: z.coerce.number().int().default(8787),
  HOST: z.string().default('0.0.0.0'),
  ZG_ROUTER_URL: z.string().url().default('https://router-api.0g.ai/v1'),
  ZG_API_KEY: z.string().optional(),
  ZG_COACH_MODEL: z.string().default('qwen3.8-flash'),
  ZG_TIMEOUT_MS: z.coerce.number().int().default(12000),
  ZG_RPC_URL: z.string().url().default('https://evmrpc-testnet.0g.ai'),
  ZG_INDEXER_URL: z.string().url().default('https://indexer-storage-testnet-turbo.0g.ai'),
  AGENT_PRIVATE_KEY: z.string().optional().transform(cleanKey),
  ZG_REGISTRY_ADDRESS: z.string().optional(),
  ZG_TTS_MODEL: z.string().default('minimax-speech-02-turbo'),
  ZG_TTS_VOICE: z.string().default('alloy'),
});

const present = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ''));

export const config = schema.parse(present);
export type Config = typeof config;

export function keyProblem(): string | null {
  const key = config.AGENT_PRIVATE_KEY;
  if (!key) return 'AGENT_PRIVATE_KEY is not set in backend/.env';
  if (/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  const hex = key.replace(/^0x/i, '');
  if (/\s/.test(key)) return 'AGENT_PRIVATE_KEY looks like a seed phrase (words separated by spaces); it must be the 64-character private key';
  if (hex.length === 40) return 'AGENT_PRIVATE_KEY looks like a wallet ADDRESS (40 hex characters); it must be the private key (64)';
  if (!/^[0-9a-fA-F]*$/.test(hex)) return `AGENT_PRIVATE_KEY has characters that are not hex (${hex.length} characters); it must be 64 characters using only 0-9 and a-f`;
  return `AGENT_PRIVATE_KEY has ${hex.length} hex characters; a private key has exactly 64`;
}
