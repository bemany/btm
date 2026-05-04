import { apiFetch } from '../lib/api';

export interface ApiTokenRow {
  id: string;
  name: string;
  prefix: string;
  scopes: ('read' | 'write')[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreatedApiToken {
  token: ApiTokenRow;
  plain: string; // wird genau einmal vom Server zurückgegeben
}

export async function listApiTokens(): Promise<ApiTokenRow[]> {
  const { tokens } = await apiFetch<{ tokens: ApiTokenRow[] }>('/api-tokens');
  return tokens;
}

export async function createApiToken(input: {
  name: string;
  scopes?: ('read' | 'write')[];
  expiresAt?: string | null;
}): Promise<CreatedApiToken> {
  return apiFetch<CreatedApiToken>('/api-tokens', { method: 'POST', body: input });
}

export async function revokeApiToken(id: string): Promise<void> {
  await apiFetch(`/api-tokens/${id}/revoke`, { method: 'POST' });
}
