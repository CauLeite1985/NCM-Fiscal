import { GoogleGenAI, ThinkingLevel, Type, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
import {
  findNcmCandidates,
  lookupNcmByCode,
} from './ncmService.ts';
import {
  formatNcmCode,
  getDefaultCategoryRule,
  normalizeNcmDigits,
} from './fiscalRules.ts';

export class UpstreamAiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'UpstreamAiError';
    this.statusCode = statusCode;
  }
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new UpstreamAiError(
      'GEMINI_API_KEY não configurada no servidor. Configure a chave em Settings > Secrets.',
      500
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseUpstreamError(err: unknown): {
  status: number;
  rawMessage: string;
  isTransient: boolean;
} {
  const raw = err instanceof Error ? err.message : String(err);
  let status = (err as { status?: number; statusCode?: number })?.status ??
    (err as { statusCode?: number })?.statusCode ??
    0;

  let extractedMessage = raw;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed.error?.code) status = parsed.error.code;
      if (parsed.error?.message) extractedMessage = parsed.error.message;
    }
  } catch {
    // Mantém mensagem original
  }

  const isTransient =
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    /UNAVAILABLE|high demand|RESOURCE_EXHAUSTED|overloaded|ECONNRESET|ETIMEDOUT/i.test(raw);

  return { status: status || 500, rawMessage: extractedMessage, isTransient };
}

async function generateWithRetryAndFallback(
  ai: GoogleGenAI,
  buildParams: (
    model: string,
    thinkingLevel: ThinkingLevel
  ) => GenerateContentParameters
): Promise<GenerateContentResponse> {
  const attempts: Array<{
    model: string;
    thinkingLevel: ThinkingLevel;
    delayAfterMs: number;
  }> = [
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, delayAfterMs: 900 },
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, delayAfterMs: 1800 },
    { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL, delayAfterMs: 1000 },
    { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL, delayAfterMs: 0 },
  ];

  let lastErr: unknown;

  for (let i = 0; i < attempts.length; i++) {
    const { model, thinkingLevel, delayAfterMs } = attempts[i];
    try {
      return await ai.models.generateContent(buildParams(model, thinkingLevel));
    } catch (err) {
      lastErr = err;
      const info = parseUpstreamError(err);
      console.warn(
        `Falha na chamada Gemini (${model}, tentativa ${i + 1}/${attempts.length}, HTTP ${info.status}): ${info.rawMessage}`
      );

      if (!info.isTransient) {
        break;
      }
      if (delayAfterMs > 0 && i < attempts.length - 1) {
        const jitter = Math.floor(Math.random() * 250);
        await sleep(delayAfterMs + jitter);
      }
    }
  }

  const finalInfo = parseUpstreamError(lastErr);
  if (finalInfo.status === 503 || /UNAVAILABLE|high demand/i.test(finalInfo.rawMessage)) {
    throw new UpstreamAiError(
      'O serviço de análise de documentos está com pico temporário de demanda (503). Aguarde alguns segundos e tente novamente.',
      503
    );
  }
  if (finalInfo.status === 429) {
    throw new UpstreamAiError(
      'Limite temporário de requisições atingido (429). Aguarde um instante antes de tentar novamente.',
      429
    );
  }
  throw new UpstreamAiError(finalInfo.rawMessage || 'Erro ao consultar o serviço de análise.', finalInfo.status);
}

export interface ExtractedPdfProduct {
  description: string;
  category: string;
  price: string;
  ncm: string;
  fiscalLink: '' | 'Tributado' | 'Substituição Tributária';
  barcode: string;
}

function normalizeExtractedPrice(raw: string): string {
  const cleaned = (raw || '')
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (!cleaned) return '';

  const match = cleaned.match(/(\d{1,3}(?:\.\d{3})*,\d{1,2}|\d+,\d{1,2}|\d+\.\d{1,2}|\d+)/);
  if (!match) return '';

  let token = match[1];
  if (token.includes(',')) {
    token = token.replace(/\./g, '').replace(',', '.');
  }

  const num = Number.parseFloat(token);
  if (!Number.isFinite(num) || num < 0) return '';
  return num.toFixed(2).replace('.', ',').slice(0, 24);
}

export function stripParentheticalContent(raw: string): string {
  const original = (raw || '').trim();
  if (!original) return '';

  let cleaned = original;
  let prev = '';
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned.replace(/\([^()]*\)/g, ' ');
  }

  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;:.!?])/g, '$1')
    .replace(/[\s\-–—:,;]+$/, '')
    .trim();

  if (!cleaned) {
    return original.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
  }
  return cleaned;
}

export async function extractProductsFromPdf(
  pdfBuffer: Buffer,
  fileName: string
): Promise<ExtractedPdfProduct[]> {
  const ai = getAiClient();
  const base64Data = pdfBuffer.toString('base64');

  const response = await generateWithRetryAndFallback(ai, (model, thinkingLevel) => ({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Data,
          },
        },
        {
          text: `Analise o documento PDF "${fileName}" (pode ser um cardápio de restaurante/lanchonete, catálogo, lista de preços ou planilha de produtos).
Extraia TODOS os produtos/itens comercializáveis listados no documento.
Regras obrigatórias:
1. "description": Extraia APENAS o nome/descrição principal do produto, DESCONSIDERANDO completamente qualquer conteúdo entre parênteses (ingredientes, acompanhamentos ou observações) e sem incluir preços. Exemplo: se no documento estiver "Hambúrguer (Pão bola, carne de hambúrguer, molho, alface, tomate e cebola)", retorne apenas "Hambúrguer". Limite a 200 caracteres.
2. "category": Categoria ou seção do cardápio/lista a que o produto pertence (ex: "Bebidas", "Petiscos", "Refeições", "Sanduíches", "Hambúrgueres", "Porções", "Salgados", "Pizzas", "Sobremesas", etc.). Se o documento tiver títulos de seção, use o título correspondente; caso contrário, informe uma categoria curta adequada ou "".
3. "price": Preço de venda em reais (R$) listado para o produto (ex: "29,90", "6,50"). Retorne somente o valor numérico formatado com vírgula decimal e 2 casas (sem "R$"). Se o item possuir variações (ex: P/M/G), informe o preço principal ou o menor valor listado; se não houver preço no documento, retorne "".
4. "ncm": Se o código NCM (8 dígitos) constar explicitamente no documento para aquele item, retorne-o somente com os 8 dígitos numéricos, sem pontos (ex: "20098990"); caso contrário, retorne string vazia "".
5. "fiscalLink": Retorne "Tributado" ou "Substituição Tributária" SOMENTE se estiver explicitamente informado no PDF; caso contrário, retorne "".
6. "barcode": Retorne o código de barras (EAN/GTIN) se constar no documento; caso contrário, retorne "".
Não invente códigos de barras nem ignore itens do cardápio/lista.`,
        },
      ],
    },
    config: {
      thinkingConfig: { thinkingLevel },
      systemInstruction:
        'Você é um especialista contábil e fiscal brasileiro que extrai listas estruturadas de produtos, categorias e preços a partir de cardápios e catálogos em PDF.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            description: {
              type: Type.STRING,
              description: 'Apenas a descrição principal do produto (sem conteúdo entre parênteses e sem preço).',
            },
            category: {
              type: Type.STRING,
              description: 'Categoria ou seção do cardápio (ex: Bebidas, Petiscos, Pizzas, Hambúrgueres, Porções, Sucos, Vitaminas).',
            },
            price: {
              type: Type.STRING,
              description: 'Preço do produto em R$ formatado como 0,00 (sem o símbolo R$), ou string vazia.',
            },
            ncm: {
              type: Type.STRING,
              description: 'Código NCM com 8 dígitos numéricos sem pontos (ex: 20098990) se presente no documento, ou string vazia.',
            },
            fiscalLink: {
              type: Type.STRING,
              description: 'Tributado, Substituição Tributária, ou string vazia.',
            },
            barcode: {
              type: Type.STRING,
              description: 'Código de barras EAN/GTIN se presente, ou string vazia.',
            },
          },
          required: ['description', 'category', 'price', 'ncm', 'fiscalLink', 'barcode'],
        },
      },
    },
  }));

  const rawText = (response.text ?? '[]').trim();
  const parsed = JSON.parse(rawText) as Array<{
    description?: string;
    category?: string;
    price?: string;
    ncm?: string;
    fiscalLink?: string;
    barcode?: string;
  }>;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => {
      const description = stripParentheticalContent(item.description || '').slice(0, 300);
      const category = (item.category || '').trim().slice(0, 100);
      const price = normalizeExtractedPrice(item.price || '');
      const digits = normalizeNcmDigits(item.ncm || '');
      const ncm = digits.length === 8 ? formatNcmCode(digits) : '';
      const rawLink = (item.fiscalLink || '').trim();
      const fiscalLink: '' | 'Tributado' | 'Substituição Tributária' =
        rawLink === 'Substituição Tributária' || rawLink === 'ST'
          ? 'Substituição Tributária'
          : rawLink === 'Tributado'
            ? 'Tributado'
            : '';
      const barcode = (item.barcode || '').trim().slice(0, 40);
      return { description, category, price, ncm, fiscalLink, barcode };
    })
    .filter((item) => item.description.length > 0);
}

export interface NcmSuggestionInput {
  id: string;
  description: string;
  category?: string;
}

export interface NcmSuggestionOutput {
  id: string;
  ncm: string;
  ncmDescription: string;
  reason: string;
  fiscalLink?: 'Tributado' | 'Substituição Tributária';
}

export async function suggestNcmForProducts(
  items: NcmSuggestionInput[]
): Promise<NcmSuggestionOutput[]> {
  if (items.length === 0) return [];

  const resultMap = new Map<string, NcmSuggestionOutput>();
  const remainingItems: NcmSuggestionInput[] = [];

  // Regras padrão por categoria:
  // - VITAMINAS / SUCOS -> NCM 20098990 e Tributado
  // - PETISCOS / REFEIÇÕES / SANDUÍCHES / HAMBÚRGUERES / PORÇÕES / SALGADOS / PIZZAS -> NCM 21069090 e Tributado
  for (const item of items) {
    const categoryRule = getDefaultCategoryRule(item.category);
    if (categoryRule) {
      const officialEntry = lookupNcmByCode(categoryRule.ncm);
      resultMap.set(item.id, {
        id: item.id,
        ncm: categoryRule.ncm,
        ncmDescription:
          officialEntry?.description ||
          (categoryRule.ncm === '20098990'
            ? 'Outros sucos de frutas'
            : 'Outras preparações alimentícias'),
        fiscalLink: categoryRule.fiscalLink,
        reason: `Regra padrão da categoria "${item.category}": NCM ${categoryRule.ncm} e Vínculo Fiscal ${categoryRule.fiscalLink}.`,
      });
    } else {
      remainingItems.push(item);
    }
  }

  if (remainingItems.length > 0) {
    const ai = getAiClient();
    const CHUNK_SIZE = 20;

    for (let i = 0; i < remainingItems.length; i += CHUNK_SIZE) {
      const chunk = remainingItems.slice(i, i + CHUNK_SIZE);

      const payloadForAi = chunk.map((item) => {
        const mainDescription = stripParentheticalContent(item.description);
        const candidates = findNcmCandidates(mainDescription, 8);
        return {
          id: item.id,
          description: mainDescription,
          category: item.category || '',
          officialCandidates: candidates.map((c) => ({
            ncm: c.code,
            officialDescription: c.description,
          })),
        };
      });

      const response = await generateWithRetryAndFallback(ai, (model, thinkingLevel) => ({
        model,
        contents: `Classifique o NCM oficial da Receita Federal (exatamente 8 dígitos numéricos, SEM pontos, apenas números, exemplo: 20098990) para cada produto abaixo.
Considere apenas a descrição principal de cada produto (desconsidere ingredientes ou observações entre parênteses).
Sempre dê preferência a um dos códigos listados em "officialCandidates" quando aplicável; se nenhum candidato for exato, informe o código NCM oficial vigente da TIPI/Receita Federal de 8 dígitos apenas numéricos mais correto para o produto (ex: 22021000 para refrigerantes, 22030000 para cervejas, 20098990 para sucos/vitaminas, 21069090 para lanches/pratos preparados, 19059090 para salgados/pizzas/bolos/pão francês).

Produtos para classificar:
${JSON.stringify(payloadForAi)}`,
        config: {
          thinkingConfig: { thinkingLevel },
          systemInstruction:
            'Você é um auditor fiscal brasileiro especialista em NCM (Nomenclatura Comum do Mercosul) e tabela TIPI da Receita Federal.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                ncm: {
                  type: Type.STRING,
                  description: 'Código NCM de 8 dígitos numéricos sem pontos (ex: 20098990)',
                },
                ncmDescription: {
                  type: Type.STRING,
                  description: 'Descrição oficial resumida da posição NCM',
                },
                reason: {
                  type: Type.STRING,
                  description: 'Breve justificativa fiscal do enquadramento NCM',
                },
              },
              required: ['id', 'ncm', 'ncmDescription', 'reason'],
            },
          },
        },
      }));

      const rawText = (response.text ?? '[]').trim();
      const parsed = JSON.parse(rawText) as Array<{
        id?: string;
        ncm?: string;
        ncmDescription?: string;
        reason?: string;
      }>;

      const parsedMap = new Map(
        (Array.isArray(parsed) ? parsed : []).map((p) => [p.id || '', p])
      );

      for (const item of chunk) {
        const match = parsedMap.get(item.id);
        const digits = normalizeNcmDigits(match?.ncm || '');
        const officialEntry = digits.length === 8 ? lookupNcmByCode(digits) : null;

        if (officialEntry) {
          resultMap.set(item.id, {
            id: item.id,
            ncm: officialEntry.code,
            ncmDescription: officialEntry.description,
            reason: (match?.reason || 'Cruzado com a tabela NCM oficial da Receita Federal.').slice(0, 280),
          });
        } else if (digits.length === 8) {
          resultMap.set(item.id, {
            id: item.id,
            ncm: formatNcmCode(digits),
            ncmDescription: (match?.ncmDescription || 'Classificação NCM TIPI Receita Federal').slice(0, 280),
            reason: (match?.reason || 'Classificado conforme TIPI/Receita Federal.').slice(0, 280),
          });
        } else {
          const mainDescription = stripParentheticalContent(item.description);
          const fallbackCandidates = findNcmCandidates(mainDescription, 1);
          const top = fallbackCandidates[0];
          resultMap.set(item.id, {
            id: item.id,
            ncm: top ? top.code : '',
            ncmDescription: top ? top.description : '',
            reason: top
              ? 'Sugestão automática por correspondência na tabela NCM oficial.'
              : 'NCM não identificado automaticamente; revise manualmente.',
          });
        }
      }
    }
  }

  return items.map((item) => resultMap.get(item.id)!);
}
