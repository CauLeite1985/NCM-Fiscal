import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { ADMIN_EMAIL, ADMIN_NAME, auth, googleProvider } from '../lib/firebase';
import type { UserProfile } from '../types/fiscal';

interface AuthScreenProps {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loadingProfile: boolean;
  onProfileRefresh: () => Promise<void>;
  onCreatePendingProfile: (user: User, displayName: string) => Promise<void>;
}

function mapAuthError(err: unknown): { message: string; isProviderDisabled: boolean } {
  const code = (err as { code?: string })?.code || '';
  const raw = err instanceof Error ? err.message : String(err);

  if (code === 'auth/operation-not-allowed') {
    return {
      isProviderDisabled: true,
      message:
        'O login por E-mail/Senha ainda não foi ativado no Firebase Console deste projeto. Utilize "Entrar com Google" agora, ou ative E-mail/senha em Firebase Console > Authentication > Sign-in method.',
    };
  }
  if (code === 'auth/email-already-in-use') {
    return {
      isProviderDisabled: false,
      message: 'Este e-mail já está cadastrado. Utilize a aba "Entrar" para acessar.',
    };
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return {
      isProviderDisabled: false,
      message: 'E-mail ou senha inválidos. Verifique os dados e tente novamente.',
    };
  }
  if (code === 'auth/weak-password') {
    return {
      isProviderDisabled: false,
      message: 'A senha deve conter no mínimo 6 caracteres.',
    };
  }
  if (code === 'auth/invalid-email') {
    return {
      isProviderDisabled: false,
      message: 'Informe um endereço de e-mail válido.',
    };
  }
  if (code === 'auth/popup-closed-by-user') {
    return {
      isProviderDisabled: false,
      message: 'A janela de login Google foi fechada antes da conclusão.',
    };
  }
  return {
    isProviderDisabled: false,
    message: raw || 'Erro ao autenticar usuário.',
  };
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  firebaseUser,
  profile,
  loadingProfile,
  onProfileRefresh,
  onCreatePendingProfile,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showConsoleGuide, setShowConsoleGuide] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');

  // Tela de verificação de e-mail se administrador logar por senha sem verificar e-mail
  if (
    firebaseUser &&
    firebaseUser.email?.toLowerCase() === ADMIN_EMAIL &&
    !firebaseUser.emailVerified
  ) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex items-center gap-3 text-amber-700 mb-3">
            <Mail className="w-5 h-5 shrink-0" />
            <h1 className="text-xl font-semibold text-slate-900">
              Confirmação de E-mail do Administrador
            </h1>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            Por segurança, o acesso administrativo para{' '}
            <span className="font-mono text-slate-900">{firebaseUser.email}</span>{' '}
            exige e-mail verificado. Confirme o link enviado para sua caixa de entrada ou
            entre diretamente com o botão Google.
          </p>
          {infoMsg && (
            <p className="text-sm text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2.5 mb-4">
              {infoMsg}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                setSubmitting(true);
                try {
                  await firebaseUser.reload();
                  await onProfileRefresh();
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
              Já verifiquei, atualizar
            </button>
            <button
              type="button"
              onClick={async () => {
                await sendEmailVerification(firebaseUser);
                setInfoMsg('E-mail de verificação reenviado.');
              }}
              className="px-4 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Reenviar e-mail
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Usuário autenticado aguardando aprovação ou recusado
  if (firebaseUser && !loadingProfile && profile && profile.status !== 'approved') {
    const isRejected = profile.status === 'rejected';
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex items-center gap-3 mb-4">
            {isRejected ? (
              <AlertCircle className="w-6 h-6 text-red-700 shrink-0" />
            ) : (
              <Clock className="w-6 h-6 text-amber-700 shrink-0" />
            )}
            <h1 className="text-xl font-semibold text-slate-900">
              {isRejected
                ? 'Solicitação de Acesso Recusada'
                : 'Cadastro Aguardando Aprovação'}
            </h1>
          </div>

          <div className="text-sm text-slate-600 space-y-3 mb-6 leading-relaxed">
            <p>
              {isRejected
                ? 'O seu acesso ao sistema NCM Fiscal foi recusado pelo administrador.'
                : 'Seu cadastro foi registrado com sucesso e aguarda aceite no menu Usuários para liberação do acesso.'}
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Usuário</span>
                <span className="font-medium text-slate-900">{profile.name}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">E-mail</span>
                <span className="font-mono text-slate-900">{profile.email}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Status</span>
                <span
                  className={`font-medium ${
                    isRejected ? 'text-red-700' : 'text-amber-700'
                  }`}
                >
                  {isRejected ? 'Recusado' : 'Pendente de aprovação'}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Administrador</span>
                <span className="text-slate-800">
                  {ADMIN_NAME} · {ADMIN_EMAIL}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isRejected && (
              <button
                type="button"
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await onProfileRefresh();
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
                Verificar Aprovação
              </button>
            )}
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function handleEmailAuth(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setShowConsoleGuide(false);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setErrorMsg('Preencha e-mail e senha.');
      return;
    }

    if (mode === 'register') {
      if (name.trim().length < 2) {
        setErrorMsg('Informe seu nome completo (mínimo 2 caracteres).');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('A confirmação de senha não confere.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await onCreatePendingProfile(cred.user, name.trim());
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // Opcional caso verificação por e-mail esteja em fila
        }
        setInfoMsg(
          'Cadastro realizado com sucesso. Seu acesso está pendente de aprovação no menu Usuários.'
        );
      }
    } catch (err) {
      const mapped = mapAuthError(err);
      setErrorMsg(mapped.message);
      setShowConsoleGuide(mapped.isProviderDisabled);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin(): Promise<void> {
    setErrorMsg('');
    setInfoMsg('');
    setShowConsoleGuide(false);
    setSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const mapped = mapAuthError(err);
      setErrorMsg(mapped.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Painel Esquerdo — Visão Executiva e Fluxo Fiscal */}
      <div className="lg:w-1/2 bg-slate-900 text-slate-100 p-8 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800">
        <div>
          <div className="flex items-center gap-2.5 text-teal-400 mb-12">
            <FileSpreadsheet className="w-6 h-6 shrink-0" />
            <span className="font-display text-lg font-bold tracking-tight text-white">
              NCM Fiscal
            </span>
          </div>

          <h1 className="font-display text-3xl lg:text-4xl font-semibold text-white tracking-tight leading-tight max-w-xl [text-wrap:balance]">
            Classificação fiscal de produtos com precisão tributária por UF.
          </h1>
          <p className="mt-4 text-slate-300 text-base leading-relaxed max-w-lg">
            Importe planilhas CSV, XLS ou extraia automaticamente itens de cardápios e
            catálogos em PDF. Cruze descrições com a tabela NCM oficial da Receita Federal
            e defina o Vínculo Fiscal por estado antes de exportar.
          </p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl border-t border-slate-800 pt-8">
            <div>
              <h2 className="text-sm font-semibold text-white">
                01. Planilhas e Cardápios PDF
              </h2>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Leitura direta de CSV/XLS e extração inteligente de PDFs com revisão prévia editável.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                02. Tabela NCM Receita Federal
              </h2>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Carga automática inicial e atualização sob demanda diretamente da base oficial.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                03. Vínculo Fiscal por UF
              </h2>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Enquadramento automático entre Tributado e Substituição Tributária para as 27 UFs.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                04. Controle de Acesso
              </h2>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Novos cadastros passam por aprovação do administrador no menu de Usuários.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
            Administração: {ADMIN_NAME}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">{ADMIN_EMAIL}</span>
        </div>
      </div>

      {/* Painel Direito — Formulário de Login e Cadastro */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8">
          {/* Controle Segmentado Entrar / Cadastrar-se */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setInfoMsg('');
                setShowConsoleGuide(false);
              }}
              className={`py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
                setInfoMsg('');
                setShowConsoleGuide(false);
              }}
              className={`py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cadastrar-se
            </button>
          </div>

          <div className="mb-6">
            <h2 className="font-display text-xl font-semibold text-slate-900">
              {mode === 'login' ? 'Acessar o Sistema' : 'Criar Novo Cadastro'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'login'
                ? 'Entre com suas credenciais cadastradas ou conta Google.'
                : 'Após o cadastro, um administrador deverá aprovar seu acesso no menu Usuários.'}
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-700" />
                <span>{errorMsg}</span>
              </div>
              {showConsoleGuide && (
                <div className="text-xs text-red-900 bg-white/80 border border-red-200 rounded p-2.5 leading-relaxed">
                  <strong>Como habilitar E-mail/Senha:</strong> Abra o Firebase Console →
                  Authentication → Sign-in method → Adicionar novo provedor →{' '}
                  <strong>E-mail/senha</strong> → Ativar. Enquanto isso, o login com Google
                  já funciona imediatamente.
                </div>
              )}
            </div>
          )}

          {infoMsg && (
            <div className="mb-5 p-3.5 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-teal-700" />
              <span>{infoMsg}</span>
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Nome completo
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Maria Oliveira"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@empresa.com.br"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-confirm"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Confirmar senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-confirm"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <span>
                {submitting
                  ? 'Processando...'
                  : mode === 'login'
                    ? 'Entrar com E-mail'
                    : 'Solicitar Cadastro'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-slate-500">ou continue com</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2.5 py-2.5 px-4 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>{mode === 'login' ? 'Entrar com Google' : 'Cadastrar com Google'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
