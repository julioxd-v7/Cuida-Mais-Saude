import type { CaregiverVerificationStatus } from '@/features/auth/types';

type StatusInfo = {
  title: string;
  message: string;
  kind: 'info' | 'warning' | 'success' | 'error';
};

/** O que mostrar ao cuidador em cada situação da verificação. */
export const VERIFICATION_INFO: Record<CaregiverVerificationStatus, StatusInfo> = {
  incomplete: {
    title: 'Perfil incompleto',
    message: 'Preencha seu perfil profissional para poder enviá-lo para verificação.',
    kind: 'warning',
  },
  completed: {
    title: 'Perfil pronto para análise',
    message: 'Seu perfil está completo. Envie para a equipe do Cuidar+ verificar.',
    kind: 'info',
  },
  pending_review: {
    title: 'Em análise',
    message: 'Recebemos seu perfil. Você será avisado(a) quando a análise terminar.',
    kind: 'info',
  },
  approved: {
    title: 'Perfil aprovado',
    message: 'Você está verificado(a) e já aparece na busca dos clientes da sua cidade.',
    kind: 'success',
  },
  rejected: {
    title: 'Perfil não aprovado',
    message: 'Veja o motivo abaixo, corrija o que for preciso e envie novamente.',
    kind: 'error',
  },
  suspended: {
    title: 'Perfil suspenso',
    message: 'Seu perfil profissional está suspenso. Entre em contato com o suporte.',
    kind: 'error',
  },
};

/** Só perfis aprovados poderão aceitar atendimentos (regra aplicada também no backend). */
export function canAcceptRequests(status: CaregiverVerificationStatus): boolean {
  return status === 'approved';
}

type StepInput = {
  verificationStatus: CaregiverVerificationStatus;
  missingDocuments: readonly string[];
  rates: readonly unknown[];
  serviceAreaActive: boolean;
};

export type VerificationStep = {
  key: 'profile' | 'rates' | 'documents' | 'review';
  title: string;
  description: string;
  done: boolean;
  href: string | null;
};

/** As etapas até o selo, a partir do que o servidor informou. */
export function verificationSteps(profile: StepInput): VerificationStep[] {
  const status = profile.verificationStatus;
  const profileDone = status !== 'incomplete';
  const outsideArea = profileDone && !profile.serviceAreaActive;
  const ratesDone = profile.rates.length > 0;
  const documentsDone = profileDone && profile.missingDocuments.length === 0;
  const reviewDone = status === 'approved';
  return [
    {
      key: 'profile',
      title: 'Perfil profissional',
      description: outsideArea
        ? 'Completo, mas sua cidade ainda não é atendida. Você fica na lista de espera.'
        : profileDone
          ? 'Completo.'
          : 'Profissão, CPF, registro no conselho, experiência e região.',
      done: profileDone,
      href: '/caregiver/professional-profile',
    },
    {
      key: 'rates',
      title: 'Valor por hora',
      description: ratesDone
        ? 'Definido.'
        : outsideArea
          ? 'Liberado quando o Cuidar+ chegar à sua cidade.'
          : 'Escolha quanto cobrar por hora, dentro da faixa da sua cidade.',
      done: ratesDone,
      href: outsideArea ? null : '/caregiver/rates',
    },
    {
      key: 'documents',
      title: 'Documentos',
      description: documentsDone
        ? 'Todos enviados.'
        : profileDone
          ? `Faltam ${profile.missingDocuments.length}: antecedentes, identidade, comprovante e certificados.`
          : 'Antecedentes criminais, identidade, comprovante de residência e certificados.',
      done: documentsDone,
      href: '/caregiver/documents',
    },
    {
      key: 'review',
      title: 'Análise da equipe',
      description:
        status === 'pending_review'
          ? 'Em análise. Avisaremos o resultado.'
          : reviewDone
            ? 'Aprovado.'
            : 'Depois de completar as etapas, envie para verificação.',
      done: reviewDone,
      href: null,
    },
  ];
}
