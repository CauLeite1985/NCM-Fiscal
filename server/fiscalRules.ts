export type FiscalLinkValue = 'Tributado' | 'Substituição Tributária';

export const BRAZILIAN_UFS = [
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'PR', name: 'Paraná' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' },
] as const;

export interface FiscalClassificationResult {
  fiscalLink: FiscalLinkValue;
  segment: string;
  reason: string;
}

interface SegmentRule {
  id: string;
  segment: string;
  prefixes: string[];
  /** UFs onde este segmento NÃO possui ICMS-ST (tributação normal) */
  excludedUfs: string[];
  /** UFs onde este segmento possui regra específica de ST (se definido, só aplica ST nessas UFs) */
  onlyUfs?: string[];
  legalNote: string;
}

/**
 * Regras de Substituição Tributária (ICMS-ST) por segmento (Convênio ICMS 142/2018) e adesão por UF.
 */
const ST_SEGMENT_RULES: SegmentRule[] = [
  {
    id: 'combustiveis_lubrificantes',
    segment: 'Combustíveis e Lubrificantes (CEST 06)',
    prefixes: ['2710', '2711', '3403', '3819'],
    excludedUfs: [],
    legalNote: 'ICMS-ST nacional obrigatório (Convênio ICMS 110/2007 e 142/2018).',
  },
  {
    id: 'cigarros_fumo',
    segment: 'Cigarros e Derivados de Fumo (CEST 04)',
    prefixes: ['2402', '2403'],
    excludedUfs: [],
    legalNote: 'ICMS-ST aplicável em todas as UFs (Convênio ICMS 142/2018, Anexo IV).',
  },
  {
    id: 'medicamentos_farma',
    segment: 'Medicamentos e Produtos Farmacêuticos (CEST 13)',
    prefixes: ['3003', '3004', '3006'],
    excludedUfs: [],
    legalNote: 'ICMS-ST aplicável conforme Convênio ICMS 234/2017 e Anexo XIII.',
  },
  {
    id: 'pneumaticos',
    segment: 'Pneumáticos e Câmaras de Ar (CEST 16)',
    prefixes: ['4011', '4013'],
    excludedUfs: [],
    legalNote: 'ICMS-ST nacional sobre pneus novos e câmaras (Convênio ICMS 142/2018, Anexo XVI).',
  },
  {
    id: 'cervejas_refrigerantes_aguas',
    segment: 'Cervejas, Chopes, Refrigerantes e Águas (CEST 03)',
    prefixes: ['220110', '220210', '220291', '220299', '2203'],
    excludedUfs: ['DF'],
    legalNote: 'Sujeito a ICMS-ST de bebidas frias (Anexo III Convênio 142/2018); DF adota regime específico de atacarejo/tributado para itens selecionados.',
  },
  {
    id: 'bebidas_alcoolicas_quentes',
    segment: 'Vinhos, Destilados e Bebidas Alcoólicas (CEST 02)',
    prefixes: ['2204', '2205', '2206', '220720', '2208'],
    excludedUfs: ['SC', 'RN'],
    legalNote: 'SC revogou ICMS-ST de bebidas quentes (RICMS-SC Anexo 3); demais UFs aplicam ST conforme protocolos.',
  },
  {
    id: 'sorvetes',
    segment: 'Sorvetes e Preparados para Sorvetes (CEST 23)',
    prefixes: ['2105'],
    excludedUfs: ['SC', 'ES'],
    legalNote: 'ICMS-ST aplicável (Anexo XXIII); SC e ES excluíram o segmento do regime de ST.',
  },
  {
    id: 'chocolates_doces_biscoitos_massas',
    segment: 'Produtos Alimentícios Industrializados (CEST 17)',
    prefixes: [
      '0401', '0402', '0403', '0405', '0406', '0901', '1509', '1517',
      '1601', '1602', '1604', '1704', '1806', '1901', '1902', '1904',
      '190510', '190520', '190531', '190532', '190540', '19059010', '19059020',
      '200410', '200520', '200811', '2009', '2101', '2103'
    ],
    excludedUfs: ['SC', 'ES', 'DF', 'GO'],
    legalNote: 'Anexo XVII (Produtos Alimentícios) com ST ativa em SP, MG, RJ, RS, PR, BA, PE, CE e demais signatários; SC, ES, DF e GO possuem exclusão ampla para alimentos.',
  },
  {
    id: 'racoes_pet',
    segment: 'Rações para Animais Domésticos (CEST 22)',
    prefixes: ['230910'],
    excludedUfs: ['SC', 'ES'],
    legalNote: 'ICMS-ST aplicável em rações tipo pet (Anexo XXII), exceto UFs desobrigadas como SC e ES.',
  },
  {
    id: 'perfumaria_cosmeticos',
    segment: 'Perfumaria, Cosméticos e Higiene Pessoal (CEST 20)',
    prefixes: ['3303', '3304', '3305', '3306', '3307', '9619'],
    excludedUfs: ['SC', 'ES'],
    legalNote: 'ICMS-ST aplicável (Anexo XX), excluído em SC (Decreto 1.866/2018) e ES.',
  },
  {
    id: 'produtos_limpeza',
    segment: 'Produtos de Limpeza e Saneantes (CEST 11)',
    prefixes: ['3401', '3402', '3808'],
    excludedUfs: ['SC', 'ES'],
    legalNote: 'ICMS-ST aplicável (Anexo XI); SC e ES adotam tributação normal.',
  },
  {
    id: 'autopecas',
    segment: 'Autopeças (CEST 01)',
    prefixes: ['8407', '8408', '8409', '8511', '8708'],
    excludedUfs: ['SC'],
    legalNote: 'ICMS-ST aplicável (Protocolo ICMS 41/2008 e Convênio 142/2018); SC excluiu autopeças da ST.',
  },
  {
    id: 'materiais_construcao_eletricos',
    segment: 'Materiais de Construção e Elétricos (CEST 10 / 12)',
    prefixes: ['2523', '3208', '3209', '3210', '3917', '6810', '6907', '7308', '7318', '8536', '8539', '8544'],
    excludedUfs: ['SC', 'ES', 'DF'],
    legalNote: 'ICMS-ST aplicável (Anexos X e XII); SC, ES e DF retiraram materiais de construção da ST interna.',
  },
  {
    id: 'eletronicos_eletrodomesticos',
    segment: 'Produtos Eletrônicos, Eletroeletrônicos e Eletrodomésticos (CEST 21)',
    prefixes: ['8414', '8415', '8418', '8450', '8471', '8504', '8506', '8516', '8517', '8518', '8528'],
    excludedUfs: ['SC', 'ES'],
    legalNote: 'ICMS-ST aplicável (Anexo XXI); SC e ES não aplicam ST para eletrônicos.',
  },
  {
    id: 'papeis_artigos_papelaria',
    segment: 'Papéis e Artigos de Papelaria / Descartáveis (CEST 19)',
    prefixes: ['3923', '3924', '4818', '4820', '9608'],
    excludedUfs: ['SC', 'ES', 'DF', 'MG'],
    legalNote: 'ICMS-ST aplicável em UFs signatárias do Anexo XIX (SP, RJ, RS, PR, BA, etc.); SC, ES, DF e MG excluíram itens de papelaria/descartáveis.',
  },
];

export function normalizeNcmDigits(ncm: string): string {
  return (ncm || '').replace(/\D/g, '').slice(0, 8);
}

export function formatNcmCode(ncm: string): string {
  const d = normalizeNcmDigits(ncm);
  if (d.length > 0) return d;
  return (ncm || '').trim();
}

export interface DefaultCategoryRule {
  ncm: string;
  fiscalLink: FiscalLinkValue;
  segment: string;
}

const PREPARED_FOOD_CATEGORY_KEYWORDS = [
  'petisco',
  'petiscos',
  'refeicao',
  'refeicoes',
  'sanduiche',
  'sanduiches',
  'hamburguer',
  'hamburgueres',
  'porcao',
  'porcoes',
  'salgado',
  'salgados',
  'pizza',
  'pizzas',
];

const JUICE_VITAMIN_CATEGORY_KEYWORDS = [
  'vitamina',
  'vitaminas',
  'suco',
  'sucos',
];

function normalizeCategoryText(category?: string): string {
  if (!category) return '';
  return category
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getDefaultCategoryRule(category?: string): DefaultCategoryRule | null {
  const normalized = normalizeCategoryText(category);
  if (!normalized) return null;

  const words = normalized.split(' ');
  const matchesAny = (keywords: string[]) =>
    keywords.some(
      (kw) => normalized === kw || words.includes(kw) || normalized.includes(kw)
    );

  if (matchesAny(JUICE_VITAMIN_CATEGORY_KEYWORDS)) {
    return {
      ncm: '20098990',
      fiscalLink: 'Tributado',
      segment: 'Vitaminas e Sucos (Regra Padrão de Categoria)',
    };
  }

  if (matchesAny(PREPARED_FOOD_CATEGORY_KEYWORDS)) {
    return {
      ncm: '21069090',
      fiscalLink: 'Tributado',
      segment: 'Preparações Alimentícias de Cardápio (Regra Padrão de Categoria)',
    };
  }

  return null;
}

export function classifyFiscalLinkByUf(
  ncm: string,
  ufRaw: string,
  category?: string
): FiscalClassificationResult {
  const digits = normalizeNcmDigits(ncm);
  const uf = (ufRaw || 'SP').trim().toUpperCase();
  const categoryRule = getDefaultCategoryRule(category);

  if (categoryRule) {
    return {
      fiscalLink: categoryRule.fiscalLink,
      segment: categoryRule.segment,
      reason: `Regra padrão da categoria "${(category || '').trim()}": classificado como ${categoryRule.fiscalLink} na UF ${uf} (NCM ${digits || categoryRule.ncm}).`,
    };
  }

  if (digits.length < 4) {
    return {
      fiscalLink: 'Tributado',
      segment: 'NCM incompleto',
      reason: `NCM "${ncm}" incompleto; mantido como Tributado por padrão na UF ${uf}.`,
    };
  }

  // Regras de exclusão explícita (in natura, cesta básica primária, refeições preparadas, vestuário, móveis, livros)
  const chapter = digits.slice(0, 2);
  if (['01', '05', '06', '07', '08', '10', '11', '12', '49', '61', '62', '63', '64', '94'].includes(chapter)) {
    return {
      fiscalLink: 'Tributado',
      segment: `Capítulo ${chapter} (Tributação Normal)`,
      reason: `NCM ${formatNcmCode(digits)} pertence a segmento não sujeito à Substituição Tributária na UF ${uf}.`,
    };
  }

  if (digits.startsWith('0201') || digits.startsWith('0202') || digits.startsWith('0203') || digits.startsWith('0207') || digits.startsWith('0302') || digits.startsWith('0304') || digits.startsWith('0407') || digits.startsWith('0409')) {
    return {
      fiscalLink: 'Tributado',
      segment: 'Carnes, Peixes e Ovos in natura',
      reason: `Produtos in natura (NCM ${formatNcmCode(digits)}) são classificados como Tributado na UF ${uf}.`,
    };
  }

  if (digits === '19059090' || digits === '21069090') {
    return {
      fiscalLink: 'Tributado',
      segment: 'Padaria Artesanal / Refeições de Cardápio',
      reason: `Preparações de padaria/restaurante (NCM ${formatNcmCode(digits)}) são tributadas diretamente na saída ao consumidor na UF ${uf}.`,
    };
  }

  // Busca regra mais específica (maior prefixo primeiro)
  let matchedRule: SegmentRule | null = null;
  let matchedPrefixLen = 0;

  for (const rule of ST_SEGMENT_RULES) {
    for (const prefix of rule.prefixes) {
      if (digits.startsWith(prefix) && prefix.length > matchedPrefixLen) {
        matchedRule = rule;
        matchedPrefixLen = prefix.length;
      }
    }
  }

  if (!matchedRule) {
    return {
      fiscalLink: 'Tributado',
      segment: 'Regime Geral (Sem convênio ST)',
      reason: `NCM ${formatNcmCode(digits)} não enquadrado em protocolo de ICMS-ST na UF ${uf}.`,
    };
  }

  if (matchedRule.excludedUfs.includes(uf)) {
    return {
      fiscalLink: 'Tributado',
      segment: matchedRule.segment,
      reason: `Na UF ${uf}, este NCM (${formatNcmCode(digits)}) foi excluído da Substituição Tributária — ${matchedRule.legalNote}`,
    };
  }

  if (matchedRule.onlyUfs && !matchedRule.onlyUfs.includes(uf)) {
    return {
      fiscalLink: 'Tributado',
      segment: matchedRule.segment,
      reason: `Na UF ${uf}, não há protocolo vigente de ST para o NCM ${formatNcmCode(digits)}.`,
    };
  }

  return {
    fiscalLink: 'Substituição Tributária',
    segment: matchedRule.segment,
    reason: `Enquadrado em ICMS-ST na UF ${uf} (${matchedRule.segment}). ${matchedRule.legalNote}`,
  };
}
