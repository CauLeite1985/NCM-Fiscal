import { auth } from './firebase';
import type {
  FiscalLinkValue,
  NcmEntry,
  NcmTableState,
} from '../types/fiscal';

async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Sessão não autenticada. Faça login para continuar.');
  }
  const token = await currentUser.getIdToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(url, {
    ...init,
    headers,
  });
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${text || 'Falha no servidor'}`);
    }
  }
  if (!response.ok) {
    const errMsg =
      typeof data.error === 'string' && data.error
        ? data.error
        : `Erro HTTP ${response.status}`;
    throw new Error(errMsg);
  }
  return data as T;
}

export async function fetchNcmStatus(): Promise<NcmTableState> {
  const res = await authFetch('/api/ncm/status');
  return parseJsonOrThrow<NcmTableState>(res);
}

export async function searchNcmEntries(
  query: string,
  limit = 60
): Promise<{ entries: NcmEntry[]; totalLoaded: number }> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await authFetch(`/api/ncm/search?${params.toString()}`);
  return parseJsonOrThrow<{ entries: NcmEntry[]; totalLoaded: number }>(res);
}

export async function updateNcmTableFromReceita(): Promise<{
  ok: boolean;
  state: NcmTableState;
  error?: string;
}> {
  const res = await authFetch('/api/ncm/update', {
    method: 'POST',
  });
  const text = await res.text();
  const data = (text ? JSON.parse(text) : {}) as {
    ok?: boolean;
    state?: NcmTableState;
    error?: string;
  };
  if (!res.ok && !data.state) {
    throw new Error(data.error || `Erro HTTP ${res.status}`);
  }
  return {
    ok: Boolean(data.ok),
    state: data.state as NcmTableState,
    error: data.error,
  };
}

export interface ExtractedPdfItem {
  description: string;
  category: string;
  price: string;
  ncm: string;
  fiscalLink: FiscalLinkValue;
  barcode: string;
}

export async function extractPdfProducts(file: File): Promise<{
  fileName: string;
  count: number;
  products: ExtractedPdfItem[];
}> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await authFetch('/api/pdf/extract', {
    method: 'POST',
    body: formData,
  });
  return parseJsonOrThrow<{
    fileName: string;
    count: number;
    products: ExtractedPdfItem[];
  }>(res);
}

export async function suggestNcmBatch(
  items: Array<{ id: string; description: string; category?: string }>
): Promise<{
  suggestions: Array<{
    id: string;
    ncm: string;
    ncmDescription: string;
    reason: string;
    fiscalLink?: 'Tributado' | 'Substituição Tributária';
  }>;
}> {
  const res = await authFetch('/api/classify/suggest-ncm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  return parseJsonOrThrow(res);
}

export async function classifyFiscalLinkBatch(
  uf: string,
  items: Array<{ id: string; ncm: string; category?: string }>
): Promise<{
  uf: string;
  results: Array<{
    id: string;
    ncm: string;
    ncmDescription: string;
    fiscalLink: 'Tributado' | 'Substituição Tributária';
    segment: string;
    reason: string;
  }>;
}> {
  const res = await authFetch('/api/classify/fiscal-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uf, items }),
  });
  return parseJsonOrThrow(res);
}
