import fs from 'node:fs';
import path from 'node:path';
import { INITIAL_OFFICIAL_NCM_SEED, type NcmEntry } from './ncmSeed.ts';
import { formatNcmCode, normalizeNcmDigits } from './fiscalRules.ts';

export interface NcmTableState {
  sourceUrl: string;
  actReference: string;
  lastUpdatedAt: string;
  totalEntries: number;
  isLiveSynced: boolean;
}

interface IndexedNcmEntry extends NcmEntry {
  normalizedSearch: string;
  normalizedKeywords: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const CACHE_FILE = path.join(DATA_DIR, 'ncm_cache.json');

const SISCOMEX_NCM_URL =
  'https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json?perfil=PUBLICO';
const BRASIL_API_NCM_URL = 'https://brasilapi.com.br/api/ncm/v1';

let loadedEntries: IndexedNcmEntry[] = [];
let entriesByDigits = new Map<string, IndexedNcmEntry>();
let tableState: NcmTableState = {
  sourceUrl: 'Receita Federal / Portal Único Siscomex (Base Oficial Carregada)',
  actReference: 'TIPI / NCM Vigente (Carga Inicial Automática)',
  lastUpdatedAt: new Date().toISOString(),
  totalEntries: 0,
  isLiveSynced: false,
};

export function normalizeText(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(text: string): string {
  return (text || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function buildSeedKeywordsMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of INITIAL_OFFICIAL_NCM_SEED) {
    if (item.keywords) {
      map.set(item.digits, item.keywords);
    }
  }
  return map;
}

function setLoadedData(entries: NcmEntry[], state: NcmTableState): void {
  const seedKeywords = buildSeedKeywordsMap();
  const deduped = new Map<string, IndexedNcmEntry>();

  for (const entry of entries) {
    const digits = normalizeNcmDigits(entry.digits || entry.code);
    if (digits.length !== 8) continue;
    const code = formatNcmCode(digits);
    const description = stripHtml(entry.description);
    if (!description) continue;
    const keywords = entry.keywords || seedKeywords.get(digits) || '';

    deduped.set(digits, {
      code,
      digits,
      description,
      keywords,
      normalizedSearch: normalizeText(description),
      normalizedKeywords: normalizeText(keywords),
    });
  }

  loadedEntries = Array.from(deduped.values());
  entriesByDigits = deduped;
  tableState = {
    ...state,
    totalEntries: loadedEntries.length,
  };
}

export function ensureNcmLoaded(): NcmTableState {
  if (loadedEntries.length > 0) {
    return tableState;
  }

  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as {
        state: NcmTableState;
        entries: NcmEntry[];
      };
      if (Array.isArray(parsed.entries) && parsed.entries.length > 0) {
        setLoadedData(parsed.entries, parsed.state);
        return tableState;
      }
    }
  } catch (err) {
    console.warn('Falha ao ler cache NCM local, carregando base inicial:', err);
  }

  const initialState: NcmTableState = {
    sourceUrl: 'Receita Federal / Portal Único Siscomex (Base Oficial Inicial)',
    actReference: 'TIPI / NCM 2026 (Carga Automática de Primeira Execução)',
    lastUpdatedAt: new Date().toISOString(),
    totalEntries: INITIAL_OFFICIAL_NCM_SEED.length,
    isLiveSynced: false,
  };

  setLoadedData(INITIAL_OFFICIAL_NCM_SEED, initialState);
  persistCache(INITIAL_OFFICIAL_NCM_SEED, tableState);
  return tableState;
}

function persistCache(entries: NcmEntry[], state: NcmTableState): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const serializable = entries.map((e) => ({
      code: e.code,
      digits: e.digits,
      description: e.description,
      ...(e.keywords ? { keywords: e.keywords } : {}),
    }));
    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify({ state, entries: serializable }),
      'utf-8'
    );
  } catch (err) {
    console.warn('Não foi possível salvar cache NCM em disco:', err);
  }
}

export function getNcmStatus(): NcmTableState {
  ensureNcmLoaded();
  return tableState;
}

export function lookupNcmByCode(codeOrDigits: string): NcmEntry | null {
  ensureNcmLoaded();
  const digits = normalizeNcmDigits(codeOrDigits);
  if (digits.length !== 8) return null;
  const found = entriesByDigits.get(digits);
  if (!found) return null;
  return {
    code: found.code,
    digits: found.digits,
    description: found.description,
    keywords: found.keywords,
  };
}

export function searchNcm(query: string, limit = 50): NcmEntry[] {
  ensureNcmLoaded();
  const trimmed = (query || '').trim();
  if (!trimmed) {
    return loadedEntries.slice(0, limit).map(({ code, digits, description }) => ({
      code,
      digits,
      description,
    }));
  }

  const digitsQuery = trimmed.replace(/\D/g, '');
  if (digitsQuery.length >= 2 && /^\d[\d.\s]*$/.test(trimmed)) {
    const codeMatches = loadedEntries.filter((e) => e.digits.startsWith(digitsQuery));
    if (codeMatches.length > 0) {
      return codeMatches.slice(0, limit).map(({ code, digits, description }) => ({
        code,
        digits,
        description,
      }));
    }
  }

  const normQuery = normalizeText(trimmed);
  const tokens = normQuery.split(' ').filter((t) => t.length >= 2);
  if (tokens.length === 0) {
    return loadedEntries.slice(0, limit).map(({ code, digits, description }) => ({
      code,
      digits,
      description,
    }));
  }

  const scored: Array<{ entry: IndexedNcmEntry; score: number }> = [];
  for (const entry of loadedEntries) {
    let score = 0;
    if (entry.normalizedSearch.includes(normQuery)) score += 10;
    if (entry.normalizedKeywords.includes(normQuery)) score += 12;

    for (const token of tokens) {
      if (entry.normalizedKeywords.includes(token)) score += 4;
      if (entry.normalizedSearch.includes(token)) score += 3;
      if (entry.digits.startsWith(token)) score += 6;
    }

    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ entry }) => ({
    code: entry.code,
    digits: entry.digits,
    description: entry.description,
  }));
}

export function findNcmCandidates(productDescription: string, limit = 10): NcmEntry[] {
  ensureNcmLoaded();
  const norm = normalizeText(productDescription);
  const stopWords = new Set([
    'de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'para', 'por', 'em', 'na', 'no',
    'un', 'und', 'pct', 'cx', 'kg', 'gr', 'ml', 'lt', 'l', 'g', 'tipo', 'sabor',
  ]);
  const tokens = norm
    .split(' ')
    .filter((t) => t.length >= 2 && !stopWords.has(t) && !/^\d+(ml|g|kg|l)?$/.test(t));

  const scored: Array<{ entry: IndexedNcmEntry; score: number }> = [];

  for (const entry of loadedEntries) {
    let score = 0;
    if (norm && entry.normalizedKeywords && entry.normalizedKeywords.includes(norm)) {
      score += 18;
    }
    for (const token of tokens) {
      const kwWords = entry.normalizedKeywords ? entry.normalizedKeywords.split(' ') : [];
      const descWords = entry.normalizedSearch.split(' ');
      if (kwWords.includes(token)) {
        score += 10;
      } else if (entry.normalizedKeywords.includes(token)) {
        score += 6;
      }
      if (descWords.includes(token)) {
        score += 7;
      } else if (entry.normalizedSearch.includes(token)) {
        score += 4;
      }
    }

    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ entry }) => ({
    code: entry.code,
    digits: entry.digits,
    description: entry.description,
  }));
}

interface SiscomexNomenclatura {
  Codigo?: string;
  Descricao?: string;
  Data_Inicio?: string;
  Data_Fim?: string;
  Tipo_Ato?: string;
  Numero_Ato?: string;
  Ano_Ato?: string;
}

interface SiscomexPayload {
  Data_Ultima_Atualizacao_NCM?: string;
  Ato?: string;
  Nomenclaturas?: SiscomexNomenclatura[];
}

interface BrasilApiNcmItem {
  codigo?: string;
  descricao?: string;
}

export async function updateNcmFromReceitaFederal(): Promise<{
  ok: boolean;
  state: NcmTableState;
  error?: string;
}> {
  ensureNcmLoaded();
  const seedKeywords = buildSeedKeywordsMap();

  // 1) Tenta endpoint oficial do Portal Único Siscomex / Receita Federal
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const res = await fetch(SISCOMEX_NCM_URL, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'NCM-Fiscal-Classifier/1.0',
      },
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = (await res.json()) as SiscomexPayload;
      const list = Array.isArray(data.Nomenclaturas) ? data.Nomenclaturas : [];
      const parsed: NcmEntry[] = [];

      for (const item of list) {
        const rawCode = (item.Codigo || '').trim();
        const digits = normalizeNcmDigits(rawCode);
        if (digits.length === 8 && /^\d{4}\.\d{2}\.\d{2}$/.test(rawCode)) {
          const desc = stripHtml(item.Descricao || '');
          if (desc) {
            parsed.push({
              code: formatNcmCode(digits),
              digits,
              description: desc,
              keywords: seedKeywords.get(digits),
            });
          }
        }
      }

      if (parsed.length > 100) {
        const nextState: NcmTableState = {
          sourceUrl: SISCOMEX_NCM_URL,
          actReference:
            data.Ato ||
            `Portal Único Siscomex (${data.Data_Ultima_Atualizacao_NCM || 'Vigente'})`,
          lastUpdatedAt: new Date().toISOString(),
          totalEntries: parsed.length,
          isLiveSynced: true,
        };
        setLoadedData(parsed, nextState);
        persistCache(parsed, tableState);
        return { ok: true, state: tableState };
      }
    }
  } catch (err) {
    console.warn('Siscomex direto indisponível, tentando espelho oficial BrasilAPI:', err);
  }

  // 2) Fallback para espelho público Receita Federal (BrasilAPI)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(BRASIL_API_NCM_URL, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'NCM-Fiscal-Classifier/1.0',
      },
    });
    clearTimeout(timer);

    if (res.ok) {
      const list = (await res.json()) as BrasilApiNcmItem[];
      if (Array.isArray(list)) {
        const parsed: NcmEntry[] = [];
        for (const item of list) {
          const digits = normalizeNcmDigits(item.codigo || '');
          if (digits.length === 8) {
            const desc = stripHtml(item.descricao || '');
            if (desc) {
              parsed.push({
                code: formatNcmCode(digits),
                digits,
                description: desc,
                keywords: seedKeywords.get(digits),
              });
            }
          }
        }

        if (parsed.length > 100) {
          const nextState: NcmTableState = {
            sourceUrl: `${SISCOMEX_NCM_URL} (via BrasilAPI Receita Federal)`,
            actReference: 'Tabela NCM Oficial Receita Federal / Siscomex Sincronizada',
            lastUpdatedAt: new Date().toISOString(),
            totalEntries: parsed.length,
            isLiveSynced: true,
          };
          setLoadedData(parsed, nextState);
          persistCache(parsed, tableState);
          return { ok: true, state: tableState };
        }
      }
    }
  } catch (err) {
    console.warn('BrasilAPI NCM também falhou:', err);
  }

  return {
    ok: false,
    state: tableState,
    error:
      'Não foi possível conectar ao servidor da Receita Federal / Siscomex neste momento. A tabela NCM carregada localmente permanece ativa e disponível.',
  };
}
