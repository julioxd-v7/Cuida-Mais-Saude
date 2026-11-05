/**
 * Papéis do sistema. O "responsável" (requisitos, seção 2) é um cliente que
 * cadastra beneficiários; por isso não há papel separado para ele.
 * Administradores usam o painel web, não o app.
 *
 * A autorização real é sempre decidida pelo backend. O papel no app serve
 * apenas para escolher qual área mostrar.
 */
export type UserRole = 'client' | 'caregiver' | 'admin';

export type AccountStatus = 'active' | 'suspended';

/** Situação do perfil profissional. Só o fluxo administrativo aprova, reprova ou suspende. */
export type CaregiverVerificationStatus =
  | 'incomplete'
  | 'completed'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'suspended';

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  status: AccountStatus;
  /** Formas de entrar (servidores antigos podem não enviar). */
  hasPassword?: boolean;
  googleLinked?: boolean;
  createdAt: string | null;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type RegisterRole = 'client' | 'caregiver';

export type RegisterInput = {
  role: RegisterRole;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  acceptTerms: boolean;
};

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

/** Resposta de POST /v1/auth/login, /register e /refresh. */
export type AuthResponse = SessionTokens & {
  accessExpiresAt: string;
  user: AuthUser;
};

/** Dados que faltam no primeiro acesso com Google. */
export type GoogleSignupInput = {
  role: RegisterRole;
  fullName: string;
  phone: string;
  acceptTerms: boolean;
};

/** Resposta de POST /v1/auth/google: sessão pronta ou cadastro a completar. */
export type GoogleAuthResponse =
  | AuthResponse
  | { needsSignup: true; profile: { email: string; fullName: string | null } };
