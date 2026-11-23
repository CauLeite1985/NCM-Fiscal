import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  Database,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  LogOut,
  Menu,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { ClassificationWorkspace } from './components/ClassificationWorkspace';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NcmTableView } from './components/NcmTableView';
import { PdfImportView } from './components/PdfImportView';
import { SavedBatchesView } from './components/SavedBatchesView';
import { UsersAdminView } from './components/UsersAdminView';
import {
  classifyFiscalLinkBatch,
  fetchNcmStatus,
  suggestNcmBatch,
  updateNcmTableFromReceita,
} from './lib/apiClient';
import {
  ADMIN_EMAIL,
  ADMIN_NAME,
  auth,
  db,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from './lib/firebase';
import {
  BRAZILIAN_UFS,
  type BatchSummary,
  type NcmTableState,
  type ProductRow,
  type UserProfile,
} from './types/fiscal';

type ActiveSection =
  | 'workspace'
  | 'pdf'
  | 'batches'
  | 'ncm'
  | 'users';

function AppShell() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [activeSection, setActiveSection] = useState<ActiveSection>('workspace');
  const [activeUf, setActiveUf] = useState('SP');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Estado da planilha ativa
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchTitle, setBatchTitle] = useState('Nova Classificação');
  const [sourceType, setSourceType] = useState<'csv' | 'xls' | 'pdf' | 'manual'>('manual');

  // Estado da tabela NCM oficial
  const [ncmState, setNcmState] = useState<NcmTableState | null>(null);
  const [updatingNcmHeader, setUpdatingNcmHeader] = useState(false);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);

  const loadOrEnsureUserProfile = useCallback(async (user: User) => {
    setLoadingProfile(true);
    const userDocRef = doc(db, 'users', user.uid);
    const path = `users/${user.uid}`;
    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        const emailLower = (user.email || '').toLowerCase();
        const isVerifiedRootAdmin =
          emailLower === ADMIN_EMAIL && user.emailVerified;

        // Administrador Claudio Leite é aprovado automaticamente quando verificado
        const initialProfile: UserProfile = {
          uid: user.uid,
          name: isVerifiedRootAdmin
            ? ADMIN_NAME
            : (user.displayName || emailLower.split('@')[0] || 'Usuário').slice(0, 120),
          email: emailLower,
          role: isVerifiedRootAdmin ? 'admin' : 'operator',
          status: isVerifiedRootAdmin ? 'approved' : 'pending',
        };

        if (emailLower !== ADMIN_EMAIL || user.emailVerified) {
          await setDoc(userDocRef, {
            ...initialProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setProfile(initialProfile);
        } else {
          setProfile(null);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadOrEnsureUserProfile(user);
      } else {
        setProfile(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [loadOrEnsureUserProfile]);

  // Carrega status da Tabela NCM assim que usuário aprovado entra no sistema
  useEffect(() => {
    if (!firebaseUser || profile?.status !== 'approved') return;

    fetchNcmStatus()
      .then((state) => setNcmState(state))
      .catch((err) => console.warn('Erro ao buscar status NCM:', err));
  }, [firebaseUser, profile?.status]);

  // Contagem de cadastros pendentes para o Administrador Claudio Leite
  useEffect(() => {
    if (
      !firebaseUser ||
      firebaseUser.email?.toLowerCase() !== ADMIN_EMAIL ||
      !firebaseUser.emailVerified
    ) {
      setPendingUsersCount(0);
      return;
    }

    const q = query(
      collection(db, 'users'),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(
      q,
      (snap) => setPendingUsersCount(snap.size),
      (err) => {
        console.warn('Aviso ao observar usuários pendentes:', err);
      }
    );
    return () => unsub();
  }, [firebaseUser]);

  async function handleCreatePendingProfile(
    user: User,
    displayName: string
  ): Promise<void> {
    const emailLower = (user.email || '').toLowerCase();
    const isVerifiedAdmin = emailLower === ADMIN_EMAIL && user.emailVerified;
    const payload: UserProfile = {
      uid: user.uid,
      name: displayName.slice(0, 120),
      email: emailLower,
      role: isVerifiedAdmin ? 'admin' : 'operator',
      status: isVerifiedAdmin ? 'approved' : 'pending',
    };
    await setDoc(doc(db, 'users', user.uid), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setProfile(payload);
  }

  async function handleQuickNcmUpdate(): Promise<void> {
    if (!profile) return;
    setUpdatingNcmHeader(true);
    try {
      const res = await updateNcmTableFromReceita();
      if (res.state) setNcmState(res.state);
      if (res.ok) {
        await setDoc(doc(db, 'ncmMetadata', 'current'), {
          id: 'current',
          sourceUrl: res.state.sourceUrl.slice(0, 300),
          actReference: res.state.actReference.slice(0, 160),
          totalEntries: res.state.totalEntries,
          updatedByUid: profile.uid,
          updatedByName: profile.name.slice(0, 120),
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);
      }
      setActiveSection('ncm');
    } finally {
      setUpdatingNcmHeader(false);
    }
  }

  async function handleProceedFromPdf(
    extractedRows: ProductRow[],
    title: string,
    autoClassifyAfterImport: boolean
  ): Promise<void> {
    setBatchId(null);
    setBatchTitle(title);
    setSourceType('pdf');
    setRows(extractedRows);
    setActiveSection('workspace');

    if (!autoClassifyAfterImport) return;

    try {
      let current = extractedRows;
      const blankNcms = current
        .filter((r) => r.ncm.replace(/\D/g, '').length < 8 && r.description.trim())
        .map((r) => ({ id: r.id, description: r.description, category: r.category }));

      if (blankNcms.length > 0) {
        const ncmRes = await suggestNcmBatch(blankNcms);
        const ncmMap = new Map(ncmRes.suggestions.map((s) => [s.id, s]));
        current = current.map((row) => {
          const s = ncmMap.get(row.id);
          if (!s || !s.ncm) return row;
          return {
            ...row,
            ncm: s.ncm,
            ncmDescription: s.ncmDescription,
            ncmSource: 'suggested',
            ...(s.fiscalLink
              ? {
                  fiscalLink: s.fiscalLink,
                  fiscalLinkSource: 'auto_uf' as const,
                }
              : {}),
            fiscalReason: s.reason,
          };
        });
        setRows(current);
      }

      const fiscalTargets = current
        .filter((r) => r.ncm.replace(/\D/g, '').length >= 4 && !r.fiscalLink)
        .map((r) => ({ id: r.id, ncm: r.ncm, category: r.category }));

      if (fiscalTargets.length > 0) {
        const ufRes = await classifyFiscalLinkBatch(activeUf, fiscalTargets);
        const ufMap = new Map(ufRes.results.map((r) => [r.id, r]));
        current = current.map((row) => {
          const u = ufMap.get(row.id);
          if (!u) return row;
          return {
            ...row,
            ncm: u.ncm || row.ncm,
            ncmDescription: u.ncmDescription || row.ncmDescription,
            fiscalLink: u.fiscalLink,
            fiscalLinkSource: 'auto_uf',
            fiscalReason: u.reason,
          };
        });
        setRows(current);
      }
    } catch (err) {
      console.error('Erro na classificação automática após importação de PDF:', err);
    }
  }

  function handleLoadSavedBatch(batch: BatchSummary, items: ProductRow[]): void {
    setBatchId(batch.id);
    setBatchTitle(batch.title);
    setSourceType(batch.sourceType);
    setActiveUf(batch.uf);
    setRows(items);
    setActiveSection('workspace');
  }

  if (!authReady || (firebaseUser && loadingProfile && !profile)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-600 flex items-center gap-2.5">
          <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
          <span>Carregando ambiente fiscal...</span>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !profile || profile.status !== 'approved') {
    return (
      <AuthScreen
        firebaseUser={firebaseUser}
        profile={profile}
        loadingProfile={loadingProfile}
        onProfileRefresh={async () => {
          if (auth.currentUser) {
            await loadOrEnsureUserProfile(auth.currentUser);
          }
        }}
        onCreatePendingProfile={handleCreatePendingProfile}
      />
    );
  }

  const isAdminUser =
    profile.role === 'admin' ||
    profile.email.toLowerCase() === ADMIN_EMAIL;

  const navItems: Array<{
    id: ActiveSection;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: 'workspace',
      label: 'Produtos',
      icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'pdf',
      label: 'Importar via PDF',
      icon: <FileText className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'batches',
      label: 'Lotes Salvos',
      icon: <FolderKanban className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'ncm',
      label: 'Tabela NCM',
      icon: <Database className="w-4 h-4 shrink-0" />,
    },
  ];

  if (isAdminUser) {
    navItems.push({
      id: 'users',
      label: 'Usuários',
      icon: <Users className="w-4 h-4 shrink-0" />,
      badge: pendingUsersCount > 0 ? pendingUsersCount : undefined,
    });
  }

  const sectionTitle: Record<ActiveSection, string> = {
    workspace: 'Produtos / Classificação Fiscal',
    pdf: 'Importar via PDF / Extração de Cardápios e Listas',
    batches: 'Lotes Salvos / Histórico de Planilhas',
    ncm: 'Tabela NCM / Base Oficial Receita Federal',
    users: 'Usuários / Controle de Acesso',
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-slate-900 text-slate-200 shrink-0 border-r border-slate-800">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-2.5">
          <FileSpreadsheet className="w-5 h-5 text-teal-400 shrink-0" />
          <span className="font-display text-base font-bold text-white tracking-tight whitespace-nowrap">
            NCM Fiscal
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 tabular-nums">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="text-xs">
            <div className="font-medium text-white truncate">{profile.name}</div>
            <div className="text-slate-400 font-mono truncate">{profile.email}</div>
            <div className="text-slate-400 mt-1">
              {profile.role === 'admin' ? 'Administrador' : 'Operador'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Drawer Mobile */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-slate-900 text-slate-200 flex flex-col h-full">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <span className="font-display text-base font-bold text-white">
                NCM Fiscal
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    activeSection === item.id
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Área Principal */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barra Superior */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-display text-sm sm:text-base font-semibold text-slate-900 truncate">
              {sectionTitle[activeSection]}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <label
                htmlFor="uf-selector"
                className="text-xs font-medium text-slate-500 hidden sm:inline whitespace-nowrap"
              >
                UF de Classificação:
              </label>
              <select
                id="uf-selector"
                value={activeUf}
                onChange={(e) => setActiveUf(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {BRAZILIAN_UFS.map((uf) => (
                  <option key={uf.code} value={uf.code}>
                    {uf.code} — {uf.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleQuickNcmUpdate}
              disabled={updatingNcmHeader}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${updatingNcmHeader ? 'animate-spin' : ''}`}
              />
              Atualizar Tabela NCM
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">
          {activeSection === 'workspace' && (
            <ClassificationWorkspace
              currentUser={profile}
              activeUf={activeUf}
              rows={rows}
              batchId={batchId}
              batchTitle={batchTitle}
              sourceType={sourceType}
              onRowsChange={setRows}
              onBatchMetaChange={(meta) => {
                setBatchId(meta.batchId);
                setBatchTitle(meta.title);
                setSourceType(meta.sourceType);
              }}
              onGoToPdfImport={() => setActiveSection('pdf')}
            />
          )}

          {activeSection === 'pdf' && (
            <PdfImportView
              activeUf={activeUf}
              onProceedToClassification={handleProceedFromPdf}
            />
          )}

          {activeSection === 'batches' && (
            <SavedBatchesView
              currentUser={profile}
              onLoadBatch={handleLoadSavedBatch}
            />
          )}

          {activeSection === 'ncm' && (
            <NcmTableView
              ncmState={ncmState}
              currentUser={profile}
              onNcmStateUpdated={setNcmState}
            />
          )}

          {activeSection === 'users' && (
            <UsersAdminView currentUserProfile={profile} />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
