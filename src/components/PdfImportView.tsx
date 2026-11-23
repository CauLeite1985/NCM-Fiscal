import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  FilePlus2,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { extractPdfProducts } from '../lib/apiClient';
import { formatNcmString, formatPriceString } from '../lib/spreadsheet';
import type { FiscalLinkValue, ProductRow } from '../types/fiscal';

interface PdfImportViewProps {
  activeUf: string;
  onProceedToClassification: (
    rows: ProductRow[],
    title: string,
    autoClassifyAfterImport: boolean
  ) => void;
}

interface ImportedPdfSummary {
  name: string;
  count: number;
}

export const PdfImportView: React.FC<PdfImportViewProps> = ({
  activeUf,
  onProceedToClassification,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const appendModeRef = useRef<boolean>(false);

  const [importedFiles, setImportedFiles] = useState<ImportedPdfSummary[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [extractedRows, setExtractedRows] = useState<ProductRow[]>([]);
  const [batchTitle, setBatchTitle] = useState('');

  async function handleFilesProcess(
    fileList: FileList | File[],
    appendToCurrent: boolean
  ): Promise<void> {
    const allFiles = Array.from(fileList || []);
    const pdfFiles = allFiles.filter(
      (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
    );

    if (pdfFiles.length === 0) {
      setErrorMsg('Por favor, selecione um ou mais arquivos no formato PDF.');
      return;
    }

    setErrorMsg('');
    setExtracting(true);

    const newRows: ProductRow[] = [];
    const newSummaries: ImportedPdfSummary[] = [];
    const failedFiles: string[] = [];

    const baseIndex = appendToCurrent ? extractedRows.length : 0;

    try {
      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        setProgressText(
          pdfFiles.length > 1
            ? `Lendo PDF ${i + 1} de ${pdfFiles.length}: ${file.name}...`
            : `Lendo PDF: ${file.name}...`
        );

        try {
          const response = await extractPdfProducts(file);
          const mapped: ProductRow[] = response.products.map((item, idx) => {
            const formattedNcm = formatNcmString(item.ncm);
            const hasNcm = formattedNcm.replace(/\D/g, '').length === 8;
            return {
              id: `pdf_${Date.now()}_${i}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
              rowIndex: baseIndex + newRows.length + idx,
              description: item.description,
              category: item.category || '',
              price: formatPriceString(item.price || ''),
              ncm: formattedNcm,
              ncmDescription: '',
              ncmSource: hasNcm ? 'original' : 'empty',
              fiscalLink: item.fiscalLink,
              fiscalLinkSource: item.fiscalLink ? 'original' : 'empty',
              fiscalReason: item.fiscalLink ? 'Extraído do documento PDF.' : '',
              barcode: item.barcode,
              reviewed: false,
            };
          });

          newRows.push(...mapped);
          newSummaries.push({ name: file.name, count: mapped.length });
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'erro inesperado';
          failedFiles.push(`${file.name} (${reason})`);
        }
      }

      if (appendToCurrent) {
        const mergedRows = [...extractedRows, ...newRows].map((r, idx) => ({
          ...r,
          rowIndex: idx,
        }));
        const mergedFiles = [...importedFiles, ...newSummaries];
        setExtractedRows(mergedRows);
        setImportedFiles(mergedFiles);
        if (!batchTitle.trim() || mergedFiles.length > 1) {
          setBatchTitle(`Cardápio Unificado (${mergedFiles.length} PDFs)`);
        }
      } else {
        setExtractedRows(newRows);
        setImportedFiles(newSummaries);
        if (pdfFiles.length === 1) {
          setBatchTitle(pdfFiles[0].name.replace(/\.pdf$/i, ''));
        } else {
          setBatchTitle(`Cardápio Unificado (${pdfFiles.length} PDFs)`);
        }
      }

      if (failedFiles.length > 0) {
        setErrorMsg(
          `Não foi possível processar: ${failedFiles.join('; ')}.`
        );
      } else if (newRows.length === 0) {
        setErrorMsg(
          'Nenhum produto foi identificado nos PDFs enviados. Você pode adicionar linhas manualmente abaixo ou enviar outros documentos.'
        );
      }
    } finally {
      setExtracting(false);
      setProgressText('');
    }
  }

  function updateRow(id: string, patch: Partial<ProductRow>): void {
    setExtractedRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function removeRow(id: string): void {
    setExtractedRows((prev) =>
      prev.filter((r) => r.id !== id).map((r, idx) => ({ ...r, rowIndex: idx }))
    );
  }

  function addBlankRow(): void {
    setExtractedRows((prev) => [
      ...prev,
      {
        id: `pdf_${Date.now()}_${prev.length}`,
        rowIndex: prev.length,
        description: '',
        category: '',
        price: '',
        ncm: '',
        ncmDescription: '',
        ncmSource: 'empty',
        fiscalLink: '',
        fiscalLinkSource: 'empty',
        fiscalReason: '',
        barcode: '',
        reviewed: false,
      },
    ]);
  }

  function clearCurrentBatch(): void {
    setExtractedRows([]);
    setImportedFiles([]);
    setBatchTitle('');
    setErrorMsg('');
  }

  const validRows = extractedRows.filter((r) => r.description.trim().length > 0);

  return (
    <div className="space-y-6">
      {/* Área de Upload de Múltiplos PDFs */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Extração de Cardápios e Listas em PDF
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Selecione um ou mais arquivos PDF de cardápios ou catálogos. O sistema lê todos os
              documentos, unifica os itens em um único lote e permite revisar antes de classificar.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) {
                handleFilesProcess(files, appendModeRef.current);
              }
              appendModeRef.current = false;
              e.target.value = '';
            }}
          />
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {extractedRows.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  appendModeRef.current = true;
                  fileInputRef.current?.click();
                }}
                disabled={extracting}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-teal-700/30 bg-teal-50 hover:bg-teal-100 disabled:opacity-60 text-teal-900 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>Adicionar PDFs ao Lote</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                appendModeRef.current = false;
                fileInputRef.current?.click();
              }}
              disabled={extracting}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {extracting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>{extracting ? 'Lendo PDFs...' : 'Selecionar PDF(s)'}</span>
            </button>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files && files.length > 0 && !extracting) {
              handleFilesProcess(files, extractedRows.length > 0);
            }
          }}
          onClick={() => {
            if (!extracting) {
              appendModeRef.current = extractedRows.length > 0;
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !extracting) {
              appendModeRef.current = extractedRows.length > 0;
              fileInputRef.current?.click();
            }
          }}
          className="border border-dashed border-slate-300 hover:border-teal-600 bg-slate-50/70 hover:bg-teal-50/30 rounded-xl p-8 text-center cursor-pointer transition-colors"
        >
          <FileText className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <div className="text-sm font-medium text-slate-800">
            {extracting
              ? progressText || 'Processando documentos PDF...'
              : importedFiles.length > 0
                ? `${importedFiles.length} PDF(s) unificados neste lote — arraste mais PDFs aqui ou clique para adicionar`
                : 'Arraste um ou mais cardápios/listas em PDF aqui, ou clique para selecionar vários'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Múltiplos arquivos permitidos (até 20 MB por PDF) · Campos extraídos: Descrição do produto, Categorias, Preço R$, NCM, Vínculo Fiscal e Código de barras
          </p>

          {importedFiles.length > 0 && !extracting && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {importedFiles.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-700"
                >
                  <FileText className="w-3 h-3 text-teal-700" />
                  <span className="max-w-[200px] truncate">{f.name}</span>
                  <span className="font-mono text-slate-500 tabular-nums">({f.count})</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-700" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Grade de Revisão Prévia Editável */}
      {extractedRows.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                <span>Pré-visualização Editável</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {importedFiles.length} PDF(s) · {validRows.length} produtos unificados
                </span>
                <span aria-hidden="true">·</span>
                <span>UF destino: {activeUf}</span>
              </div>
              <input
                type="text"
                value={batchTitle}
                onChange={(e) => setBatchTitle(e.target.value)}
                placeholder="Nome do lote unificado"
                className="w-full max-w-md px-3 py-1.5 text-sm font-medium text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={clearCurrentBatch}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Lote
              </button>
              <button
                type="button"
                onClick={addBlankRow}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Item
              </button>
              <button
                type="button"
                disabled={validRows.length === 0}
                onClick={() =>
                  onProceedToClassification(
                    validRows,
                    batchTitle.trim() || 'Importação PDF',
                    false
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <span>Prosseguir para Revisão</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={validRows.length === 0}
                onClick={() =>
                  onProceedToClassification(
                    validRows,
                    batchTitle.trim() || 'Importação PDF',
                    true
                  )
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Prosseguir e Classificar ({activeUf})</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 min-w-[240px]">Descrição do produto</th>
                  <th className="py-2.5 px-3 w-40">Categorias</th>
                  <th className="py-2.5 px-3 w-32">Preço R$</th>
                  <th className="py-2.5 px-3 w-40">NCM</th>
                  <th className="py-2.5 px-3 w-56">Vínculo Fiscal</th>
                  <th className="py-2.5 px-3 w-44">Código de barras</th>
                  <th className="py-2.5 px-3 w-14 text-center">Excluir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {extractedRows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 text-center font-mono text-xs text-slate-400 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) =>
                          updateRow(row.id, { description: e.target.value })
                        }
                        placeholder="Descrição do produto"
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={row.category}
                        onChange={(e) =>
                          updateRow(row.id, { category: e.target.value })
                        }
                        placeholder="Ex: Bebidas, Sucos"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-400">
                          R$
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.price}
                          onChange={(e) =>
                            updateRow(row.id, { price: e.target.value })
                          }
                          onBlur={(e) => {
                            const formatted = formatPriceString(e.target.value);
                            if (formatted !== row.price) {
                              updateRow(row.id, { price: formatted });
                            }
                          }}
                          placeholder="0,00"
                          className="w-full pl-8 pr-2.5 py-1.5 font-mono text-xs text-right tabular-nums border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                        />
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={row.ncm}
                        onChange={(e) => {
                          const cleanDigits = e.target.value.replace(/\D/g, '').slice(0, 8);
                          updateRow(row.id, {
                            ncm: cleanDigits,
                            ncmSource: cleanDigits ? 'manual' : 'empty',
                          });
                        }}
                        onBlur={(e) => {
                          const formatted = formatNcmString(e.target.value);
                          if (formatted !== row.ncm) {
                            updateRow(row.id, { ncm: formatted });
                          }
                        }}
                        placeholder="Em branco"
                        className="w-full px-2.5 py-1.5 font-mono text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={row.fiscalLink}
                        onChange={(e) =>
                          updateRow(row.id, {
                            fiscalLink: e.target.value as FiscalLinkValue,
                            fiscalLinkSource: e.target.value ? 'manual' : 'empty',
                          })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
                      >
                        <option value="">Em branco (Classificar depois)</option>
                        <option value="Tributado">Tributado</option>
                        <option value="Substituição Tributária">
                          Substituição Tributária
                        </option>
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={row.barcode}
                        onChange={(e) => updateRow(row.id, { barcode: e.target.value })}
                        placeholder="Sem EAN"
                        className="w-full px-2.5 py-1.5 font-mono text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        aria-label="Remover item"
                        className="p-1.5 text-slate-400 hover:text-red-700 rounded-md hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
