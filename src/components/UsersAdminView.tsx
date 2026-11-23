import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  UserCheck,
  UserX,
  XCircle,
} from 'lucide-react';
import {
  ADMIN_EMAIL,
  ADMIN_NAME,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import type { UserProfile, UserRole, UserStatus } from '../types/fiscal';

interface UsersAdminViewProps {
  currentUserProfile: UserProfile;
}

export const UsersAdminView: React.FC<UsersAdminViewProps> = ({
  currentUserProfile,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | UserStatus>('all');
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const isPrimaryAdmin =
    currentUserProfile.email.toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    if (!isPrimaryAdmin) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as UserProfile);
        });
        setUsers(list);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );

    return () => unsub();
  }, [isPrimaryAdmin]);

  async function handleStatusChange(
    targetUser: UserProfile,
    newStatus: UserStatus
  ): Promise<void> {
    setUpdatingUid(targetUser.uid);
    setFeedback('');
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        status: newStatus,
        approvedBy: currentUserProfile.email,
        updatedAt: serverTimestamp(),
      });
      setFeedback(
        newStatus === 'approved'
          ? `Usuário ${targetUser.name} aceito com sucesso.`
          : `Acesso de ${targetUser.name} recusado.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetUser.uid}`);
    } finally {
      setUpdatingUid(null);
    }
  }

  async function handleRoleChange(
    targetUser: UserProfile,
    newRole: UserRole
  ): Promise<void> {
    if (targetUser.email.toLowerCase() === ADMIN_EMAIL) return;
    setUpdatingUid(targetUser.uid);
    setFeedback('');
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        role: newRole,
        approvedBy: currentUserProfile.email,
        updatedAt: serverTimestamp(),
      });
      setFeedback(`Perfil de ${targetUser.name} atualizado para ${newRole === 'admin' ? 'Administrador' : 'Operador'}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetUser.uid}`);
    } finally {
      setUpdatingUid(null);
    }
  }

  const hasClaudioInList = users.some(
    (u) => u.email.toLowerCase() === ADMIN_EMAIL
  );

  const displayUsers: UserProfile[] = hasClaudioInList
    ? users
    : [
        {
          uid: 'admin_claudio_leite',
          name: ADMIN_NAME,
          email: ADMIN_EMAIL,
          role: 'admin',
          status: 'approved',
        },
        ...users,
      ];

  const pendingCount = displayUsers.filter((u) => u.status === 'pending').length;
  const approvedCount = displayUsers.filter((u) => u.status === 'approved').length;
  const rejectedCount = displayUsers.filter((u) => u.status === 'rejected').length;

  const filteredUsers =
    filter === 'all'
      ? displayUsers
      : displayUsers.filter((u) => u.status === filter);

  if (!isPrimaryAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-2xl">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Controle de Acesso de Usuários
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          A aprovação de novos cadastros é restrita ao administrador principal{' '}
          <span className="font-medium text-slate-900">{ADMIN_NAME}</span> (
          <span className="font-mono">{ADMIN_EMAIL}</span>).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo de Usuários */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Total Cadastrados</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {displayUsers.length}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Aguardando Aceite</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {pendingCount}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Usuários Aprovados</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {approvedCount}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Recusados</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-red-700 tabular-nums">
            {rejectedCount}
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {(
            [
              { id: 'all', label: `Todos (${displayUsers.length})` },
              { id: 'pending', label: `Pendentes (${pendingCount})` },
              { id: 'approved', label: `Aprovados (${approvedCount})` },
              { id: 'rejected', label: `Recusados (${rejectedCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {feedback && (
          <div className="text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5">
            {feedback}
          </div>
        )}
      </div>

      {/* Tabela de Controle de Acesso */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Perfil</th>
                <th className="py-3 px-4">Status de Acesso</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Carregando lista de usuários...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Nenhum usuário encontrado nesta categoria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isRootAdmin = user.email.toLowerCase() === ADMIN_EMAIL;
                  const isUpdating = updatingUid === user.uid;

                  return (
                    <tr key={user.uid} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{user.name}</span>
                          {isRootAdmin && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-800">
                              <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                              Administrador Principal
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">
                        {user.email}
                      </td>
                      <td className="py-3 px-4">
                        {isRootAdmin ? (
                          <span className="text-xs font-medium text-slate-700">
                            Administrador
                          </span>
                        ) : (
                          <select
                            value={user.role}
                            disabled={isUpdating}
                            onChange={(e) =>
                              handleRoleChange(user, e.target.value as UserRole)
                            }
                            aria-label={`Perfil de ${user.name}`}
                            className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                          >
                            <option value="operator">Operador</option>
                            <option value="admin">Administrador</option>
                          </select>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {user.status === 'approved' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            Aprovado
                          </span>
                        )}
                        {user.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            Pendente de aceite
                          </span>
                        )}
                        {user.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            Recusado
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isRootAdmin ? (
                          <span className="text-xs text-slate-400">Protegido</span>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            {user.status !== 'approved' && (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleStatusChange(user, 'approved')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                Aceitar
                              </button>
                            )}
                            {user.status !== 'rejected' && (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleStatusChange(user, 'rejected')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                {user.status === 'approved' ? 'Revogar' : 'Recusar'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
