import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  RefreshCw,
  Search,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  searchNcmEntries,
  updateNcmTableFromReceita,
} from '../lib/apiClient';
import { db } from '../lib/firebase';
import type { NcmEntry, NcmTableState, UserProfile } from '../types/fiscal';

interface NcmTableViewProps {
  ncmState: NcmTableState | null;
  currentUser: UserProfile;
  onNcmStateUpdated: (next: NcmTableState) => void;
}

export const NcmTableView: React.FC<NcmTableViewProps> = ({
  ncmState,
  currentUser,
  onNcmStateUpdated,
}) => {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<NcmEntry[]>([]);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchNcmEntries(query, 100);
        if (active) {
          setEntries(res.entries);
          setTotalLoaded(res.totalLoaded);
        }
      } catch (err) {
        if (active) {
          setSyncError(err instanceof Error ? err.message : 'Erro ao consultar tabela NCM.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, ncmState?.totalEntries]);

  async function handleUpdateFromReceita(): Promise<void> {
    setSyncing(true);
    setSyncMessage('');
    setSyncError('');
    try {
      const result = await updateNcmTableFromReceita();
      if (result.state) {
        onNcmStateUpdated(result.state);
      }
      if (!result.ok) {
        setSyncError(
          result.error ||
            'Não foi possível baixar a atualização da Receita Federal agora.'
        );
        return;
      }

      // Persiste registro da sincronização no Firestore
      try {
        await setDoc(doc(db, 'ncmMetadata', 'current'), {
          id: 'current',
          sourceUrl: result.state.sourceUrl.slice(0, 300),
          actReference: result.state.actReference.slice(0, 160),
          totalEntries: result.state.totalEntries,
          updatedByUid: currentUser.uid,
          updatedByName: currentUser.name.slice(0, 120),
          updatedAt: serverTimestamp(),
        });
      } catch (fsErr) {
        console.warn('Metadado NCM local atualizado; aviso Firestore:', fsErr);
      }

      setSyncMessage(
        `Tabela NCM atualizada diretamente da Receita Federal: ${result.state.totalEntries.toLocaleString('pt-BR')} códigos ativos.`
      );
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'Erro ao atualizar Tabela NCM.'
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Base Oficial Receita Federal */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Database className="w-3.5 h-3.5 text-teal-700" />
              <span>Receita Federal · Portal Único Siscomex</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {(ncmState?.totalEntries ?? totalLoaded).toLocaleString('pt-BR')} códigos NCM carregados
              </span>
            </div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Tabela Oficial NCM (Nomenclatura Comum do Mercosul)
            </h2>
            <p className="text-xs text-slate-500">
              Referência: {ncmState?.actReference || 'TIPI / NCM Vigente'} · Última carga:{' '}
              <span className="font-mono">
                {ncmState?.lastUpdatedAt
                  ? new Date(ncmState.lastUpdatedAt).toLocaleString('pt-BR')
                  : 'Automática na inicialização'}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleUpdateFromReceita}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Baixando da Receita Federal...' : 'Atualizar Tabela NCM'}</span>
          </button>
        </div>

        {syncMessage && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-700" />
            <span>{syncMessage}</span>
          </div>
        )}

        {syncError && (
          <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" />
            <span>{syncError}</span>
          </div>
        )}
      </div>

      {/* Busca e Listagem da Tabela NCM */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar por código NCM (ex: 20098990) ou descrição..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Exibindo até 100 resultados de {(ncmState?.totalEntries ?? totalLoaded).toLocaleString('pt-BR')}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-36">Código NCM</th>
                <th className="py-3 px-4 w-32">NCM 8 Dígitos</th>
                <th className="py-3 px-4">Descrição Oficial (Receita Federal)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-slate-500">
                    Consultando base NCM...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-slate-500">
                    Nenhum NCM localizado para "{query}".
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.digits} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-xs font-semibold text-teal-800">
                      {entry.digits}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      {entry.digits}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800 leading-snug">
                      {entry.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
