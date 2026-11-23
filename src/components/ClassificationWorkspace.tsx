import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCheck,
  CheckCircle2,
  Download,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  classifyFiscalLinkBatch,
  suggestNcmBatch,
} from '../lib/apiClient';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  buildSampleProductRows,
  downloadTemplateSpreadsheet,
  exportProductsToFile,
  formatNcmString,
  formatPriceString,
  parseSpreadsheetFile,
} from '../lib/spreadsheet';
import type {
  FiscalLinkValue,
  NcmEntry,
  ProductRow,
  UserProfile,
} from '../types/fiscal';
import { NcmLookupModal } from './NcmLookupModal';

interface ClassificationWorkspaceProps {
  currentUser: UserProfile;
  activeUf: string;
  rows: ProductRow[];
  batchId: string | null;
  batchTitle: string;
  sourceType: 'csv' | 'xls' | 'pdf' | 'manual';
  onRowsChange: React.Dispatch<React.SetStateAction<ProductRow[]>>;
  onBatchMetaChange: (meta: {
    batchId: string | null;
    title: string;
    sourceType: 'csv' | 'xls' | 'pdf' | 'manual';
  }) => void;
  onGoToPdfImport: () => void;
}

type FilterTab =
  | 'all'
  | 'suggested'
  | 'missing_ncm'
  | 'st'
  | 'tributado'
  | 'unreviewed';

export const ClassificationWorkspace: React.FC<ClassificationWorkspaceProps> = ({
  currentUser,
  activeUf,
  rows,
  batchId,
  batchTitle,
  sourceType,
  onRowsChange,
  onBatchMetaChange,
  onGoToPdfImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [busyAction, setBusyAction] = useState<
    null | 'suggest_ncm' | 'classify_uf' | 'auto_all' | 'saving'
  >(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [lookupRowId, setLookupRowId] = useState<string | null>(null);

  const lookupRow = useMemo(
    () => rows.find((r) => r.id === lookupRowId) || null,
    [rows, lookupRowId]
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const withNcm = rows.filter((r) => r.ncm.replace(/\D/g, '').length === 8).length;
    const suggestedNcm = rows.filter((r) => r.ncmSource === 'suggested').length;
    const stCount = rows.filter(
      (r) => r.fiscalLink === 'Substituição Tributária'
    ).length;
    const tribCount = rows.filter((r) => r.fiscalLink === 'Tributado').length;
    const missingNcm = total - withNcm;
    const missingFiscal = rows.filter(
      (r) => r.ncm.replace(/\D/g, '').length >= 4 && !r.fiscalLink
    ).length;
    const reviewedCount = rows.filter((r) => r.reviewed).length;
    return {
      total,
      withNcm,
      suggestedNcm,
      stCount,
      tribCount,
      missingNcm,
      missingFiscal,
      reviewedCount,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (filterTab === 'suggested' && row.ncmSource !== 'suggested') return false;
      if (filterTab === 'missing_ncm' && row.ncm.replace(/\D/g, '').length === 8)
        return false;
      if (filterTab === 'st' && row.fiscalLink !== 'Substituição Tributária')
        return false;
      if (filterTab === 'tributado' && row.fiscalLink !== 'Tributado') return false;
      if (filterTab === 'unreviewed' && row.reviewed) return false;

      if (!q) return true;
      return (
        row.description.toLowerCase().includes(q) ||
        (row.category || '').toLowerCase().includes(q) ||
        (row.price || '').toLowerCase().includes(q) ||
        row.ncm.toLowerCase().includes(q) ||
        row.barcode.toLowerCase().includes(q) ||
        row.ncmDescription.toLowerCase().includes(q)
      );
    });
  }, [rows, filterTab, searchQuery]);

  async function handleFileUpload(file: File): Promise<void> {
    setErrorMessage('');
    setStatusMessage('');
    try {
      const parsed = await parseSpreadsheetFile(file);
      onRowsChange(parsed.rows);
      onBatchMetaChange({
        batchId: null,
        title: file.name.replace(/\.(csv|xlsx|xls)$/i, ''),
        sourceType: parsed.sourceType,
      });
      setStatusMessage(
        `${parsed.rows.length} produtos importados de "${file.name}".`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao ler a planilha enviada.'
      );
    }
  }

  async function handleSuggestBlankNcms(
    targetRows: ProductRow[] = rows
  ): Promise<ProductRow[]> {
    const blankItems = targetRows
      .filter((r) => r.ncm.replace(/\D/g, '').length < 8 && r.description.trim())
      .map((r) => ({ id: r.id, description: r.description, category: r.category }));

    if (blankItems.length === 0) {
      setStatusMessage('Todos os produtos já possuem código NCM preenchido.');
      return targetRows;
    }

    setBusyAction('suggest_ncm');
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await suggestNcmBatch(blankItems);
      const map = new Map(res.suggestions.map((s) => [s.id, s]));

      const updated = targetRows.map((row) => {
        const s = map.get(row.id);
        if (!s || !s.ncm) return row;
        return {
          ...row,
          ncm: s.ncm,
          ncmDescription: s.ncmDescription,
          ncmSource: 'suggested' as const,
          ...(s.fiscalLink
            ? {
                fiscalLink: s.fiscalLink,
                fiscalLinkSource: 'auto_uf' as const,
                fiscalReason: s.reason || row.fiscalReason,
              }
            : {
                fiscalReason: row.fiscalReason || s.reason,
              }),
        };
      });

      onRowsChange(updated);
      setStatusMessage(
        `Sugestão automática concluída para ${res.suggestions.filter((s) => s.ncm).length} produtos usando a tabela NCM oficial da Receita Federal.`
      );
      return updated;
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Falha ao sugerir NCMs automaticamente.'
      );
      return targetRows;
    } finally {
      setBusyAction(null);
    }
  }

  async function handleClassifyFiscalByUf(
    onlyBlankFiscal: boolean,
    inputRows: ProductRow[] = rows
  ): Promise<void> {
    const candidates = inputRows.filter((r) => {
      const hasNcm = r.ncm.replace(/\D/g, '').length >= 4;
      if (!hasNcm) return false;
      if (onlyBlankFiscal) return !r.fiscalLink;
      return true;
    });

    if (candidates.length === 0) {
      setStatusMessage(
        onlyBlankFiscal
          ? 'Não há produtos com NCM preenchido e Vínculo Fiscal em branco.'
          : 'Nenhum produto possui NCM válido para classificação.'
      );
      return;
    }

    setBusyAction('classify_uf');
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await classifyFiscalLinkBatch(
        activeUf,
        candidates.map((c) => ({ id: c.id, ncm: c.ncm, category: c.category }))
      );
      const map = new Map(res.results.map((r) => [r.id, r]));

      onRowsChange((prev) =>
        prev.map((row) => {
          const r = map.get(row.id);
          if (!r) return row;
          return {
            ...row,
            ncm: r.ncm || row.ncm,
            ncmDescription: r.ncmDescription || row.ncmDescription,
            fiscalLink: r.fiscalLink,
            fiscalLinkSource: 'auto_uf',
            fiscalReason: r.reason,
          };
        })
      );

      setStatusMessage(
        `Vínculo Fiscal (${activeUf}) classificado para ${res.results.length} produtos.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Erro ao classificar vínculo fiscal por UF.'
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRunFullAutoClassification(): Promise<void> {
    setBusyAction('auto_all');
    setErrorMessage('');
    setStatusMessage('');
    try {
      const afterNcm = await handleSuggestBlankNcms(rows);
      await handleClassifyFiscalByUf(true, afterNcm);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveBatch(exportStatus?: 'draft' | 'reviewed' | 'exported'): Promise<void> {
    if (rows.length === 0) return;
    setBusyAction('saving');
    setErrorMessage('');
    setStatusMessage('');

    const targetBatchId =
      batchId ||
      `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const stCount = rows.filter(
      (r) => r.fiscalLink === 'Substituição Tributária'
    ).length;
    const tribCount = rows.filter((r) => r.fiscalLink === 'Tributado').length;
    const classifiedCount = rows.filter(
      (r) => r.ncm.replace(/\D/g, '').length === 8 && Boolean(r.fiscalLink)
    ).length;
    const allReviewed = rows.every((r) => r.reviewed);
    const nextStatus = exportStatus || (allReviewed ? 'reviewed' : 'draft');

    try {
      const batchRef = doc(db, 'batches', targetBatchId);

      // Remove itens antigos se o lote já existir antes de regravar os itens atualizados
      if (batchId) {
        const existingItemsSnap = await getDocs(
          query(
            collection(db, 'batches', targetBatchId, 'items'),
            where('ownerId', '==', currentUser.uid)
          )
        );
        const docsToDelete = existingItemsSnap.docs;
        for (let i = 0; i < docsToDelete.length; i += 350) {
          const delBatch = writeBatch(db);
          docsToDelete.slice(i, i + 350).forEach((d) => delBatch.delete(d.ref));
          await delBatch.commit();
        }
      }

      const headerBatch = writeBatch(db);
      const batchPayload: Record<string, unknown> = {
        id: targetBatchId,
        ownerId: currentUser.uid,
        ownerName: currentUser.name.slice(0, 120) || 'Operador',
        title: (batchTitle.trim() || 'Lote de Classificação').slice(0, 180),
        sourceType,
        uf: activeUf,
        totalProducts: rows.length,
        classifiedCount,
        stCount,
        tributadoCount: tribCount,
        status: nextStatus,
        updatedAt: serverTimestamp(),
      };
      if (!batchId) {
        batchPayload.createdAt = serverTimestamp();
      }

      if (batchId) {
        headerBatch.update(batchRef, {
          title: batchPayload.title,
          uf: batchPayload.uf,
          totalProducts: batchPayload.totalProducts,
          classifiedCount: batchPayload.classifiedCount,
          stCount: batchPayload.stCount,
          tributadoCount: batchPayload.tributadoCount,
          status: batchPayload.status,
          updatedAt: serverTimestamp(),
        });
      } else {
        headerBatch.set(batchRef, batchPayload);
      }
      await headerBatch.commit();

      // Grava itens em blocos de 350 documentos
      for (let i = 0; i < rows.length; i += 350) {
        const chunk = rows.slice(i, i + 350);
        const wb = writeBatch(db);
        chunk.forEach((row, offset) => {
          const safeItemId = `item_${i + offset}_${row.id.replace(/[^a-zA-Z0-9_-]/g, '')}`.slice(
            0,
            120
          );
          const itemRef = doc(db, 'batches', targetBatchId, 'items', safeItemId);
          wb.set(itemRef, {
            id: safeItemId,
            batchId: targetBatchId,
            ownerId: currentUser.uid,
            rowIndex: i + offset,
            description: (row.description || 'Produto sem descrição').slice(0, 300),
            category: (row.category || '').slice(0, 100),
            price: (row.price || '').slice(0, 24),
            ncm: (row.ncm || '').slice(0, 12),
            ncmDescription: (row.ncmDescription || '').slice(0, 300),
            ncmSource: row.ncmSource,
            fiscalLink: row.fiscalLink,
            fiscalLinkSource: row.fiscalLinkSource,
            fiscalReason: (row.fiscalReason || '').slice(0, 300),
            barcode: (row.barcode || '').slice(0, 40),
            reviewed: Boolean(row.reviewed),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
        await wb.commit();
      }

      onBatchMetaChange({
        batchId: targetBatchId,
        title: batchTitle.trim() || 'Lote de Classificação',
        sourceType,
      });
      setStatusMessage('Lote salvo com sucesso no histórico do sistema.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `batches/${targetBatchId}`);
    } finally {
      setBusyAction(null);
    }
  }

  function updateRow(id: string, patch: Partial<ProductRow>): void {
    onRowsChange((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function addManualRow(): void {
    onRowsChange((prev) => [
      ...prev,
      {
        id: `row_${Date.now()}_${prev.length}`,
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

  function removeRow(id: string): void {
    onRowsChange((prev) =>
      prev.filter((r) => r.id !== id).map((r, idx) => ({ ...r, rowIndex: idx }))
    );
  }

  function handleSelectNcmFromModal(entry: NcmEntry): void {
    if (!lookupRowId) return;
    updateRow(lookupRowId, {
      ncm: entry.digits || formatNcmString(entry.code),
      ncmDescription: entry.description,
      ncmSource: 'manual',
    });
    setLookupRowId(null);
  }

  function handleMarkAllReviewed(): void {
    onRowsChange((prev) => prev.map((r) => ({ ...r, reviewed: true })));
    setStatusMessage('Todas as linhas foram marcadas como revisadas.');
  }

  function handleExport(format: 'xlsx' | 'csv'): void {
    if (rows.length === 0) return;
    exportProductsToFile(
      rows,
      format,
      `${batchTitle || 'classificacao_fiscal'}_${activeUf}`
    );
    setStatusMessage(
      `Planilha exportada em ${format.toUpperCase()} com ${rows.length} produtos.`
    );
  }

  const isBusy = busyAction !== null;

  return (
    <div className="space-y-6">
      {/* Barra de Indicadores */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Total de Produtos</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {stats.total}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {stats.reviewedCount} revisados
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">NCMs Preenchidos</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {stats.withNcm}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {stats.suggestedNcm} sugeridos · {stats.missingNcm} em branco
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">
            Substituição Tributária ({activeUf})
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {stats.stCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">ICMS-ST aplicável na UF</div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">
            Tributado ({activeUf})
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {stats.tribCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {stats.missingFiscal} pendentes de vínculo
          </div>
        </div>
      </div>

      {/* Barra de Ações Principais */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              Importar CSV / XLS
            </button>

            <button
              type="button"
              onClick={onGoToPdfImport}
              disabled={isBusy}
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Importar via PDF
            </button>

            <button
              type="button"
              onClick={downloadTemplateSpreadsheet}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" />
              Modelo XLS
            </button>

            <button
              type="button"
              onClick={() => {
                onRowsChange(buildSampleProductRows());
                onBatchMetaChange({
                  batchId: null,
                  title: 'Planilha Exemplo Supermercado & Cardápio',
                  sourceType: 'manual',
                });
                setStatusMessage(
                  'Exemplo carregado com NCMs e Vínculos Fiscais mistos para teste.'
                );
              }}
              className="px-3 py-2 text-xs font-medium text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Carregar Exemplo
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleSuggestBlankNcms(rows)}
              disabled={isBusy || rows.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-teal-700/30 bg-teal-50 hover:bg-teal-100 disabled:opacity-50 text-teal-900 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {busyAction === 'suggest_ncm' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Sugerir NCM
            </button>

            <button
              type="button"
              onClick={() => handleClassifyFiscalByUf(true, rows)}
              disabled={isBusy || rows.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {busyAction === 'classify_uf' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Classificar Vínculo ({activeUf})
            </button>

            <button
              type="button"
              onClick={handleRunFullAutoClassification}
              disabled={isBusy || rows.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {busyAction === 'auto_all' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Classificar Tudo ({activeUf})
            </button>
          </div>
        </div>

        {/* Linha secundária: Título do Lote, Salvar e Exportar */}
        {rows.length > 0 && (
          <div className="pt-3 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
              <label htmlFor="batch-title" className="text-xs font-medium text-slate-500 shrink-0">
                Lote:
              </label>
              <input
                id="batch-title"
                type="text"
                value={batchTitle}
                onChange={(e) =>
                  onBatchMetaChange({
                    batchId,
                    title: e.target.value,
                    sourceType,
                  })
                }
                placeholder="Nome do lote fiscal"
                className="flex-1 min-w-[200px] max-w-sm px-3 py-1.5 text-xs font-medium text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <button
                type="button"
                onClick={() => handleClassifyFiscalByUf(false, rows)}
                disabled={isBusy}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 whitespace-nowrap shrink-0"
              >
                Recalcular todos os vínculos para {activeUf}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleMarkAllReviewed}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar Revisados
              </button>
              <button
                type="button"
                onClick={() => handleSaveBatch()}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {busyAction === 'saving' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Salvar Lote
              </button>
              <button
                type="button"
                onClick={() => handleExport('xlsx')}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar XLS
              </button>
              <button
                type="button"
                onClick={() => handleExport('csv')}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>
            </div>
          </div>
        )}

        {statusMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Estado Vazio vs Grade Editável */}
      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-4" />
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Importe uma planilha ou cardápio em PDF para iniciar
          </h2>
          <p className="mt-2 text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
            Envie um arquivo CSV ou Excel (.xls / .xlsx) contendo Descrição do produto, Categorias,
            Preço R$, NCM, Vínculo Fiscal e Código de barras, ou utilize o menu Importar via PDF para extrair
            itens, categorias e preços automaticamente.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4" />
              Importar Planilha CSV / XLS
            </button>
            <button
              type="button"
              onClick={onGoToPdfImport}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Importar Cardápio PDF
            </button>
            <button
              type="button"
              onClick={addManualRow}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Inserir Manualmente
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Barra de Busca e Filtros */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por descrição, categoria, NCM ou código de barras..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              {(
                [
                  { id: 'all', label: `Todos (${stats.total})` },
                  { id: 'suggested', label: `Sugeridos (${stats.suggestedNcm})` },
                  { id: 'missing_ncm', label: `Sem NCM (${stats.missingNcm})` },
                  { id: 'st', label: `Subst. Trib. (${stats.stCount})` },
                  { id: 'tributado', label: `Tributado (${stats.tribCount})` },
                  {
                    id: 'unreviewed',
                    label: `A revisar (${stats.total - stats.reviewedCount})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    filterTab === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grade Editável */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-3 w-11 text-center">#</th>
                  <th className="py-2.5 px-3 min-w-[230px]">Descrição do produto</th>
                  <th className="py-2.5 px-3 w-40">Categorias</th>
                  <th className="py-2.5 px-3 w-32">Preço R$</th>
                  <th className="py-2.5 px-3 min-w-[200px]">NCM (Receita Federal)</th>
                  <th className="py-2.5 px-3 min-w-[230px]">
                    Vínculo Fiscal ({activeUf})
                  </th>
                  <th className="py-2.5 px-3 w-44">Código de barras</th>
                  <th className="py-2.5 px-3 w-20 text-center">Revisado</th>
                  <th className="py-2.5 px-3 w-12 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-500">
                      Nenhum produto corresponde aos filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        row.reviewed ? 'bg-slate-50/40' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-xs text-slate-400 tabular-nums align-top pt-3.5">
                        {idx + 1}
                      </td>

                      {/* Descrição do produto */}
                      <td className="py-2 px-3 align-top">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) =>
                            updateRow(row.id, { description: e.target.value })
                          }
                          placeholder="Descrição do produto"
                          className="w-full px-2.5 py-1.5 text-sm text-slate-900 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                        />
                      </td>

                      {/* Categorias */}
                      <td className="py-2 px-3 align-top">
                        <input
                          type="text"
                          value={row.category || ''}
                          onChange={(e) =>
                            updateRow(row.id, { category: e.target.value })
                          }
                          placeholder="Ex: Bebidas, Petiscos"
                          className="w-full px-2.5 py-1.5 text-xs font-medium text-slate-800 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                        />
                      </td>

                      {/* Preço R$ */}
                      <td className="py-2 px-3 align-top">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-400">
                            R$
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.price || ''}
                            onChange={(e) =>
                              updateRow(row.id, { price: e.target.value })
                            }
                            onBlur={(e) => {
                              const formatted = formatPriceString(e.target.value);
                              if (formatted !== (row.price || '')) {
                                updateRow(row.id, { price: formatted });
                              }
                            }}
                            placeholder="0,00"
                            className="w-full pl-8 pr-2.5 py-1.5 font-mono text-xs text-right tabular-nums text-slate-900 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                          />
                        </div>
                      </td>

                      {/* NCM */}
                      <td className="py-2 px-3 align-top">
                        <div className="flex items-center gap-1.5">
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
                            placeholder="00000000"
                            className="w-full px-2.5 py-1.5 font-mono text-xs text-slate-900 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                          />
                          <button
                            type="button"
                            onClick={() => setLookupRowId(row.id)}
                            title="Pesquisar na Tabela NCM Oficial"
                            aria-label="Pesquisar NCM"
                            className="p-1.5 border border-slate-200 rounded-md text-slate-500 hover:text-teal-700 hover:border-teal-300 hover:bg-teal-50 transition-colors shrink-0"
                          >
                            <Search className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 leading-tight flex items-center gap-1.5 flex-wrap">
                          <span
                            className={
                              row.ncmSource === 'suggested'
                                ? 'font-medium text-teal-800'
                                : row.ncmSource === 'manual'
                                  ? 'font-medium text-slate-700'
                                  : row.ncmSource === 'empty'
                                    ? 'text-red-700'
                                    : 'text-slate-500'
                            }
                          >
                            {row.ncmSource === 'suggested'
                              ? 'Sugerido Receita Federal'
                              : row.ncmSource === 'manual'
                                ? 'Editado manual'
                                : row.ncmSource === 'original'
                                  ? 'Planilha original'
                                  : 'NCM em branco'}
                          </span>
                          {row.ncmDescription && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate max-w-[190px]" title={row.ncmDescription}>
                                {row.ncmDescription}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Vínculo Fiscal */}
                      <td className="py-2 px-3 align-top">
                        <select
                          value={row.fiscalLink}
                          onChange={(e) =>
                            updateRow(row.id, {
                              fiscalLink: e.target.value as FiscalLinkValue,
                              fiscalLinkSource: e.target.value ? 'manual' : 'empty',
                              fiscalReason: e.target.value
                                ? 'Definido manualmente na revisão.'
                                : '',
                            })
                          }
                          className={`w-full px-2.5 py-1.5 text-xs font-medium border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 ${
                            row.fiscalLink === 'Substituição Tributária'
                              ? 'border-amber-300 text-amber-900'
                              : row.fiscalLink === 'Tributado'
                                ? 'border-emerald-300 text-emerald-900'
                                : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          <option value="">Selecionar vínculo...</option>
                          <option value="Tributado">Tributado</option>
                          <option value="Substituição Tributária">
                            Substituição Tributária
                          </option>
                        </select>
                        <div className="mt-1 text-[11px] text-slate-500 leading-tight truncate max-w-[230px]" title={row.fiscalReason}>
                          {row.fiscalLinkSource === 'auto_uf'
                            ? `Auto ${activeUf}`
                            : row.fiscalLinkSource === 'manual'
                              ? 'Editado manual'
                              : row.fiscalLinkSource === 'original'
                                ? 'Original'
                                : 'Pendente'}
                          {row.fiscalReason ? ` · ${row.fiscalReason}` : ''}
                        </div>
                      </td>

                      {/* Código de barras */}
                      <td className="py-2 px-3 align-top">
                        <input
                          type="text"
                          value={row.barcode}
                          onChange={(e) =>
                            updateRow(row.id, { barcode: e.target.value })
                          }
                          placeholder="EAN / GTIN"
                          className="w-full px-2.5 py-1.5 font-mono text-xs text-slate-800 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                      </td>

                      {/* Revisado */}
                      <td className="py-2.5 px-3 text-center align-top pt-3">
                        <button
                          type="button"
                          onClick={() =>
                            updateRow(row.id, { reviewed: !row.reviewed })
                          }
                          aria-label={
                            row.reviewed ? 'Desmarcar revisão' : 'Marcar como revisado'
                          }
                          className={`inline-flex items-center justify-center w-6 h-6 rounded border transition-colors ${
                            row.reviewed
                              ? 'bg-teal-700 border-teal-700 text-white'
                              : 'bg-white border-slate-300 text-transparent hover:border-teal-600'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </td>

                      {/* Excluir */}
                      <td className="py-2 px-3 text-center align-top pt-2.5">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          aria-label="Excluir linha"
                          className="p-1.5 text-slate-400 hover:text-red-700 rounded-md hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <button
              type="button"
              onClick={addManualRow}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 hover:text-teal-950"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar novo produto
            </button>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Exibindo {filteredRows.length} de {rows.length} produtos
            </span>
          </div>
        </div>
      )}

      <NcmLookupModal
        isOpen={lookupRow !== null}
        initialQuery={lookupRow?.ncm || ''}
        productDescription={lookupRow?.description || ''}
        onSelect={handleSelectNcmFromModal}
        onClose={() => setLookupRowId(null)}
      />
    </div>
  );
};
