import * as XLSX from 'xlsx';
import type { FiscalLinkValue, ProductRow } from '../types/fiscal';

function normalizeHeader(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function stripParentheticalDescription(raw: string): string {
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

export function formatNcmString(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length > 0) {
    return digits;
  }
  return '';
}

export function formatPriceString(raw: string): string {
  const cleaned = (raw || '')
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (!cleaned) return '';

  const match = cleaned.match(/(\d{1,3}(?:\.\d{3})*,\d{1,2}|\d+,\d{1,2}|\d+\.\d{1,2}|\d+)/);
  if (!match) return cleaned.slice(0, 24);

  let token = match[1];
  if (token.includes(',')) {
    token = token.replace(/\./g, '').replace(',', '.');
  }
  const num = Number.parseFloat(token);
  if (!Number.isFinite(num) || num < 0) return '';
  return num.toFixed(2).replace('.', ',').slice(0, 24);
}

export function parseFiscalLinkString(raw: string): FiscalLinkValue {
  const norm = normalizeHeader(raw);
  if (!norm) return '';
  if (
    norm.includes('substitui') ||
    norm === 'st' ||
    norm.includes('icmsst') ||
    norm.includes('substtribut')
  ) {
    return 'Substituição Tributária';
  }
  if (norm.includes('tributad')) {
    return 'Tributado';
  }
  return '';
}

function createRowId(idx: number): string {
  return `row_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function parseSpreadsheetFile(file: File): Promise<{
  rows: ProductRow[];
  sourceType: 'csv' | 'xls';
}> {
  const lower = file.name.toLowerCase();
  const isCsv = lower.endsWith('.csv') || file.type === 'text/csv';
  const sourceType: 'csv' | 'xls' = isCsv ? 'csv' : 'xls';

  let workbook: XLSX.WorkBook;
  if (isCsv) {
    const buffer = await file.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buffer);
    if (text.includes('\uFFFD')) {
      text = new TextDecoder('iso-8859-1').decode(buffer);
    }
    workbook = XLSX.read(text, { type: 'string', raw: false });
  } else {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: 'array', raw: false });
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('A planilha enviada está vazia.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (matrix.length === 0) {
    throw new Error('Nenhuma linha encontrada na planilha.');
  }

  let headerRowIdx = 0;
  let descCol = -1;
  let catCol = -1;
  let priceCol = -1;
  let ncmCol = -1;
  let fiscalCol = -1;
  let barcodeCol = -1;

  for (let r = 0; r < Math.min(matrix.length, 5); r++) {
    const row = matrix[r] || [];
    let matchedCols = 0;
    row.forEach((cell, cIdx) => {
      const h = normalizeHeader(String(cell ?? ''));
      if (
        h.includes('descricaodoproduto') ||
        h === 'descricao' ||
        h === 'produto' ||
        h === 'nome' ||
        h === 'item'
      ) {
        descCol = cIdx;
        matchedCols++;
      } else if (
        h === 'categoria' ||
        h === 'categorias' ||
        h === 'secao' ||
        h === 'grupo'
      ) {
        catCol = cIdx;
        matchedCols++;
      } else if (
        h === 'preco' ||
        h === 'precor' ||
        h.includes('precovenda') ||
        h.includes('precounitario') ||
        h === 'valor' ||
        h.includes('valorunitario') ||
        h === 'price' ||
        h === 'vlr'
      ) {
        priceCol = cIdx;
        matchedCols++;
      } else if (h === 'ncm' || h.includes('codigoncm') || h === 'sh') {
        ncmCol = cIdx;
        matchedCols++;
      } else if (
        h.includes('vinculofiscal') ||
        h.includes('vinculo') ||
        h.includes('situacaotributaria') ||
        h.includes('tributacao')
      ) {
        fiscalCol = cIdx;
        matchedCols++;
      } else if (
        h.includes('codigodebarras') ||
        h.includes('codigobarras') ||
        h === 'ean' ||
        h === 'gtin' ||
        h === 'barras'
      ) {
        barcodeCol = cIdx;
        matchedCols++;
      }
    });

    if (matchedCols >= 1 && descCol >= 0) {
      headerRowIdx = r;
      break;
    }
  }

  const hasExplicitHeader = descCol >= 0;
  if (!hasExplicitHeader) {
    descCol = 0;
    ncmCol = 1;
    fiscalCol = 2;
    barcodeCol = 3;
    catCol = 4;
    priceCol = 5;
    headerRowIdx = -1;
  }

  const rows: ProductRow[] = [];
  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const cells = matrix[r] || [];
    const rawDescription = String(cells[descCol] ?? '').trim();
    const description = stripParentheticalDescription(rawDescription).slice(0, 300);
    if (!description) continue;

    const category = catCol >= 0 ? String(cells[catCol] ?? '').trim().slice(0, 100) : '';
    const price = priceCol >= 0 ? formatPriceString(String(cells[priceCol] ?? '')) : '';
    const rawNcm = ncmCol >= 0 ? String(cells[ncmCol] ?? '').trim() : '';
    const formattedNcm = formatNcmString(rawNcm);
    const hasNcm = formattedNcm.replace(/\D/g, '').length >= 4;

    const rawFiscal = fiscalCol >= 0 ? String(cells[fiscalCol] ?? '').trim() : '';
    const fiscalLink = parseFiscalLinkString(rawFiscal);

    const barcode = barcodeCol >= 0 ? String(cells[barcodeCol] ?? '').trim().slice(0, 40) : '';

    rows.push({
      id: createRowId(rows.length),
      rowIndex: rows.length,
      description,
      category,
      price,
      ncm: formattedNcm,
      ncmDescription: '',
      ncmSource: hasNcm ? 'original' : 'empty',
      fiscalLink,
      fiscalLinkSource: fiscalLink ? 'original' : 'empty',
      fiscalReason: fiscalLink ? 'Informado na planilha original.' : '',
      barcode,
      reviewed: false,
    });
  }

  if (rows.length === 0) {
    throw new Error(
      'Nenhum produto válido encontrado. Verifique se a coluna "Descrição do produto" está preenchida.'
    );
  }

  return { rows, sourceType };
}

export function exportProductsToFile(
  rows: ProductRow[],
  format: 'xlsx' | 'csv',
  baseName = 'classificacao_fiscal'
): void {
  const safeBase =
    baseName.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') ||
    'classificacao_fiscal';

  if (format === 'csv') {
    const headers = [
      'Descrição do produto',
      'Categorias',
      'Preço R$',
      'NCM',
      'Vínculo Fiscal',
      'Código de barras',
    ];
    const escapeCsv = (val: string) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };
    const lines = [
      headers.map(escapeCsv).join(';'),
      ...rows.map((r) =>
        [
          r.description,
          r.category,
          r.price,
          formatNcmString(r.ncm),
          r.fiscalLink,
          r.barcode,
        ]
          .map(escapeCsv)
          .join(';')
      ),
    ];
    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `${safeBase}.csv`);
    return;
  }

  const sheetData = rows.map((r) => ({
    'Descrição do produto': r.description,
    Categorias: r.category,
    'Preço R$': r.price,
    NCM: formatNcmString(r.ncm),
    'Vínculo Fiscal': r.fiscalLink,
    'Código de barras': r.barcode,
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetData);
  worksheet['!cols'] = [
    { wch: 44 },
    { wch: 22 },
    { wch: 14 },
    { wch: 16 },
    { wch: 28 },
    { wch: 20 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Classificação Fiscal');
  XLSX.writeFile(workbook, `${safeBase}.xlsx`);
}

export function downloadTemplateSpreadsheet(): void {
  const sampleData = [
    {
      'Descrição do produto': 'Refrigerante Cola Lata 350ml',
      Categorias: 'Bebidas',
      'Preço R$': '6,50',
      NCM: '',
      'Vínculo Fiscal': '',
      'Código de barras': '7894900011517',
    },
    {
      'Descrição do produto': 'Cerveja Pilsen Long Neck 330ml',
      Categorias: 'Bebidas',
      'Preço R$': '9,90',
      NCM: '22030000',
      'Vínculo Fiscal': '',
      'Código de barras': '7891149103300',
    },
    {
      'Descrição do produto': 'Suco Natural de Laranja 500ml',
      Categorias: 'Sucos',
      'Preço R$': '12,00',
      NCM: '',
      'Vínculo Fiscal': '',
      'Código de barras': '',
    },
    {
      'Descrição do produto': 'Porção de Batata Frita com Bacon',
      Categorias: 'Porções',
      'Preço R$': '34,90',
      NCM: '',
      'Vínculo Fiscal': '',
      'Código de barras': '',
    },
    {
      'Descrição do produto': 'X-Bacon Artesanal',
      Categorias: 'Hambúrgueres',
      'Preço R$': '38,90',
      NCM: '',
      'Vínculo Fiscal': '',
      'Código de barras': '',
    },
  ];
  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  worksheet['!cols'] = [
    { wch: 44 },
    { wch: 22 },
    { wch: 14 },
    { wch: 16 },
    { wch: 28 },
    { wch: 20 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos');
  XLSX.writeFile(workbook, 'modelo_importacao_ncm_fiscal.xlsx');
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function buildSampleProductRows(): ProductRow[] {
  const items: Array<{
    description: string;
    category: string;
    price: string;
    ncm: string;
    fiscalLink: FiscalLinkValue;
    barcode: string;
  }> = [
    {
      description: 'Refrigerante Cola Lata 350ml',
      category: 'Bebidas',
      price: '6,50',
      ncm: '',
      fiscalLink: '',
      barcode: '7894900011517',
    },
    {
      description: 'Cerveja Pilsen Long Neck 330ml',
      category: 'Bebidas',
      price: '9,90',
      ncm: '22030000',
      fiscalLink: '',
      barcode: '7891149103300',
    },
    {
      description: 'Vitamina de Morango com Banana 400ml',
      category: 'Vitaminas',
      price: '14,50',
      ncm: '',
      fiscalLink: '',
      barcode: '',
    },
    {
      description: 'Suco Natural de Maracujá 500ml',
      category: 'Sucos',
      price: '12,00',
      ncm: '',
      fiscalLink: '',
      barcode: '',
    },
    {
      description: 'Isca de Frango Crocante',
      category: 'Petiscos',
      price: '39,90',
      ncm: '',
      fiscalLink: '',
      barcode: '',
    },
    {
      description: 'Pizza Calabresa Grande',
      category: 'Pizzas',
      price: '54,00',
      ncm: '',
      fiscalLink: '',
      barcode: '',
    },
    {
      description: 'X-Burguer Artesanal com Queijo Cheddar',
      category: 'Hambúrgueres',
      price: '36,90',
      ncm: '',
      fiscalLink: '',
      barcode: '',
    },
    {
      description: 'Coxinha de Frango com Catupiry',
      category: 'Salgados',
      price: '8,50',
      ncm: '',
      fiscalLink: '',
      barcode: '',
    },
    {
      description: 'Prato Executivo Picanha Grelhada',
      category: 'Refeições',
      price: '48,00',
      ncm: '',
      fiscalLink: '',
      barcode: '',
    },
    {
      description: 'Café Torrado e Moído Tradicional 500g',
      category: 'Mercearia',
      price: '18,90',
      ncm: '09012100',
      fiscalLink: '',
      barcode: '7896005800027',
    },
  ];

  return items.map((item, idx) => ({
    id: createRowId(idx),
    rowIndex: idx,
    description: item.description,
    category: item.category,
    price: item.price,
    ncm: item.ncm,
    ncmDescription: '',
    ncmSource: item.ncm ? 'original' : 'empty',
    fiscalLink: item.fiscalLink,
    fiscalLinkSource: 'empty',
    fiscalReason: '',
    barcode: item.barcode,
    reviewed: false,
  }));
}
