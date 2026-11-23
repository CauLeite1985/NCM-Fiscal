import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { FolderOpen, Loader2, Trash2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatNcmString } from '../lib/spreadsheet';
import type { BatchSummary, ProductRow, UserProfile } from '../types/fiscal';

interface SavedBatchesViewProps {
  currentUser: UserProfile;
  onLoadBatch: (batch: BatchSummary, items: ProductRow[]) => void;
}

export const SavedBatchesView: React.FC<SavedBatchesViewProps> = ({
  currentUser,
  onLoadBatch,
}) => {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBatchId, setLoadingBatchId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'batches'),
      where('ownerId', '==', currentUser.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: BatchSummary[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as BatchSummary);
        });
        list.sort((a, b) => {
          const aSec = (a.updatedAt as { seconds?: number })?.seconds ?? 0;
          const bSec = (b.updatedAt as { seconds?: number })?.seconds ?? 0;
          return bSec - aSec;
        });
        setBatches(list);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'batches');
      }
    );

    return () => unsub();
  }, [currentUser.uid]);

  async function handleOpen(batch: BatchSummary): Promise<void> {
    setLoadingBatchId(batch.id);
    const itemsPath = `batches/${batch.id}/items`;
    try {
      const q = query(
        collection(db, 'batches', batch.id, 'items'),
        where('ownerId', '==', currentUser.uid)
      );
      const snap = await getDocs(q);
      const items: ProductRow[] = [];
      snap.forEach((d) => {
        const data = d.data() as ProductRow;
        items.push({
          id: data.id,
          rowIndex: data.rowIndex,
          description: data.description,
          category: data.category || '',
          price: data.price || '',
          ncm: formatNcmString(data.ncm || ''),
          ncmDescription: data.ncmDescription,
          ncmSource: data.ncmSource,
          fiscalLink: data.fiscalLink,
          fiscalLinkSource: data.fiscalLinkSource,
          fiscalReason: data.fiscalReason,
          barcode: data.barcode,
          reviewed: data.reviewed,
        });
      });
      items.sort((a, b) => a.rowIndex - b.rowIndex);
      onLoadBatch(batch, items);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, itemsPath);
    } finally {
      setLoadingBatchId(null);
    }
  }

  async function handleDelete(batch: BatchSummary): Promise<void> {
    setLoadingBatchId(batch.id);
    try {
      const q = query(
        collection(db, 'batches', batch.id, 'items'),
        where('ownerId', '==', currentUser.uid)
      );
      const snap = await getDocs(q);
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const wb = writeBatch(db);
        docs.slice(i, i + 400).forEach((itemDoc) => wb.delete(itemDoc.ref));
        await wb.commit();
      }
      await deleteDoc(doc(db, 'batches', batch.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `batches/${batch.id}`);
    } finally {
      setLoadingBatchId(null);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Lotes de Classificação Salvos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Retome revisões anteriores ou exporte novamente planilhas já classificadas.
          </p>
        </div>
        <span className="font-mono text-xs text-slate-500 tabular-nums">
          {batches.length} lotes
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">Título do Lote</th>
              <th className="py-3 px-4">Origem</th>
              <th className="py-3 px-4">UF</th>
              <th className="py-3 px-4 text-right">Produtos</th>
              <th className="py-3 px-4 text-right">Subst. Trib.</th>
              <th className="py-3 px-4 text-right">Tributado</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-500">
                  Carregando lotes salvos...
                </td>
              </tr>
            ) : batches.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-500">
                  Nenhum lote salvo ainda. Importe uma planilha ou PDF e clique em "Salvar Lote".
                </td>
              </tr>
            ) : (
              batches.map((batch) => {
                const busy = loadingBatchId === batch.id;
                return (
                  <tr key={batch.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {batch.title}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 uppercase font-mono">
                      {batch.sourceType}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800">
                      {batch.uf}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {batch.totalProducts}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700">
                      {batch.stCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                      {batch.tributadoCount}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleOpen(batch)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0"
                        >
                          {busy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FolderOpen className="w-3.5 h-3.5" />
                          )}
                          Abrir
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDelete(batch)}
                          aria-label={`Excluir lote ${batch.title}`}
                          className="p-1.5 text-slate-400 hover:text-red-700 rounded-md hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
