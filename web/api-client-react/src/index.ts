import {
  useQuery,
  useMutation,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface MatchedResult {
  id: string;
  groupName: string;
  senderName: string;
  senderUsername: string | null;
  timestamp: string;
  matchedKeywords: string[];
  snippet: string;
  fullText: string;
  messageLink: string | null;
  sharedGroups: string[];
  sharedGroupsCount: number;
}

export interface TelegramStatus {
  authState: 'idle' | 'waiting_code' | 'waiting_password' | 'authenticated';
  isMonitoring: boolean;
  totalMatches: number;
  groupCount: number;
  activeKeywords: number;
  phone?: string;
  botConfigured: boolean;
}

export interface Keyword {
  id: string;
  text: string;
  enabled: boolean;
}

export interface BotConfig {
  botToken: string;
  chatId: string;
  configured: boolean;
}

// ──────────────────────────────────────────────
// Fetch helper
// ──────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ──────────────────────────────────────────────
// Query key factories
// ──────────────────────────────────────────────

export const getGetTelegramStatusQueryKey = () =>
  ['telegram', 'status'] as const;

export const getListResultsQueryKey = (
  params?: Record<string, unknown>,
) => ['results', params] as const;

export const getListKeywordsQueryKey = () => ['keywords'] as const;

export const getGetBotConfigQueryKey = () => ['bot', 'config'] as const;

// ──────────────────────────────────────────────
// Query hooks
// ──────────────────────────────────────────────

export function useGetTelegramStatus(
  options?: { query?: Partial<UseQueryOptions<TelegramStatus>> },
) {
  return useQuery<TelegramStatus>({
    queryKey: getGetTelegramStatusQueryKey(),
    queryFn: () => apiFetch<TelegramStatus>('/api/telegram/status'),
    ...options?.query,
  });
}

export function useListResults(
  params?: { limit?: number; since?: string },
  options?: { query?: Partial<UseQueryOptions<MatchedResult[]>> },
) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.since) qs.set('since', params.since);
  const query = qs.toString();

  return useQuery<MatchedResult[]>({
    queryKey: getListResultsQueryKey(params as Record<string, unknown>),
    queryFn: () =>
      apiFetch<MatchedResult[]>(`/api/results${query ? '?' + query : ''}`),
    ...options?.query,
  });
}

export function useListKeywords(
  options?: { query?: Partial<UseQueryOptions<Keyword[]>> },
) {
  return useQuery<Keyword[]>({
    queryKey: getListKeywordsQueryKey(),
    queryFn: () => apiFetch<Keyword[]>('/api/keywords'),
    ...options?.query,
  });
}

export function useGetBotConfig(
  options?: { query?: Partial<UseQueryOptions<BotConfig>> },
) {
  return useQuery<BotConfig>({
    queryKey: getGetBotConfigQueryKey(),
    queryFn: () => apiFetch<BotConfig>('/api/bot'),
    ...options?.query,
  });
}

// ──────────────────────────────────────────────
// Mutation hooks
// ──────────────────────────────────────────────

type MutOpts<TData, TVars> = UseMutationOptions<TData, Error, TVars>;

// Telegram auth
export function useSendCode(
  options?: MutOpts<unknown, { data: { apiId: number; apiHash: string; phone: string } }>,
) {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch('/api/telegram/send-code', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    ...options,
  });
}

export function useVerifyCode(
  options?: MutOpts<unknown, { data: { code: string } }>,
) {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch('/api/telegram/verify', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    ...options,
  });
}

export function useVerifyPassword(
  options?: MutOpts<unknown, { data: { password: string } }>,
) {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch('/api/telegram/verify-2fa', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    ...options,
  });
}

export function useRestoreSession(
  options?: MutOpts<unknown, { data: { apiId: number; apiHash: string } }>,
) {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch('/api/telegram/restore', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    ...options,
  });
}

// Monitoring control
export function useStartMonitoring(
  options?: MutOpts<unknown, Record<string, never>>,
) {
  return useMutation({
    mutationFn: () =>
      apiFetch('/api/telegram/start', { method: 'POST', body: '{}' }),
    ...options,
  });
}

export function useStopMonitoring(
  options?: MutOpts<unknown, Record<string, never>>,
) {
  return useMutation({
    mutationFn: () =>
      apiFetch('/api/telegram/stop', { method: 'POST', body: '{}' }),
    ...options,
  });
}

export function useDisconnectTelegram(
  options?: MutOpts<unknown, Record<string, never>>,
) {
  return useMutation({
    mutationFn: () =>
      apiFetch('/api/telegram/disconnect', { method: 'POST', body: '{}' }),
    ...options,
  });
}

// Results
export function useClearResults(
  options?: MutOpts<unknown, Record<string, never>>,
) {
  return useMutation({
    mutationFn: () => apiFetch('/api/results', { method: 'DELETE' }),
    ...options,
  });
}

// Keywords
export function useAddKeyword(
  options?: MutOpts<Keyword, { data: { text: string } }>,
) {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch<Keyword>('/api/keywords', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    ...options,
  });
}

export function useUpdateKeyword(
  options?: MutOpts<Keyword, { id: string; data: { text?: string; enabled?: boolean } }>,
) {
  return useMutation({
    mutationFn: ({ id, data }) =>
      apiFetch<Keyword>(`/api/keywords/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    ...options,
  });
}

export function useRemoveKeyword(
  options?: MutOpts<unknown, { id: string }>,
) {
  return useMutation({
    mutationFn: ({ id }) =>
      apiFetch(`/api/keywords/${id}`, { method: 'DELETE' }),
    ...options,
  });
}

// Bot config
export function useSetBotConfig(
  options?: MutOpts<unknown, { data: { botToken: string; chatId: string } }>,
) {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch('/api/bot', { method: 'POST', body: JSON.stringify(data) }),
    ...options,
  });
}
