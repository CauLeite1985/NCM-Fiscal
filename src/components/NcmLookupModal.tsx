import React, { useEffect, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { searchNcmEntries } from '../lib/apiClient';
import type { NcmEntry } from '../types/fiscal';

interface NcmLookupModalProps {
  isOpen: boolean;
  initialQuery: string;
  productDescription: string;
  onSelect: (entry: NcmEntry) => void;
  onClose: () => void;
}

export const NcmLookupModal: React.FC<NcmLookupModalProps> = ({
  isOpen,
  initialQuery,
  productDescription,
  onSelect,
  onClose,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [entries, setEntries] = useState<NcmEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery || productDescription);
    }
  }, [isOpen, initialQuery, productDescription]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await searchNcmEntries(query, 40);
        if (active) setEntries(res.entries);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Falha na busca NCM.');
      } finally {
        if (active) setLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Consultar Tabela NCM Oficial"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[82vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Consultar Tabela NCM Oficial (Receita Federal)
            </h2>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              Produto: {productDescription || 'Sem descrição'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite código NCM (ex: 20098990) ou descrição do produto..."
              autoFocus
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Consultando tabela NCM oficial...
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-red-700">{error}</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Nenhum código NCM encontrado para "{query}". Tente termos mais genéricos.
            </div>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.digits}
                type="button"
                onClick={() => onSelect(entry)}
                className="w-full text-left px-6 py-3 hover:bg-teal-50/60 transition-colors flex items-start justify-between gap-4 group"
              >
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold text-teal-800">
                    {entry.digits}
                  </div>
                  <div className="text-sm text-slate-700 mt-0.5 leading-snug">
                    {entry.description}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
                  <Check className="w-3.5 h-3.5" />
                  Selecionar
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
