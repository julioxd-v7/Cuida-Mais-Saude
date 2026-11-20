/** Textos em português para os valores que o backend guarda em inglês. */

export const SPECIALTY_OPTIONS = [
  { value: 'elderly', label: 'Idosos' },
  { value: 'post_surgery', label: 'Pós-operatório' },
  { value: 'disability', label: 'Pessoas com deficiência' },
  { value: 'dementia', label: 'Demência / Alzheimer' },
  { value: 'palliative', label: 'Cuidados paliativos' },
  { value: 'special_needs_children', label: 'Crianças com necessidades especiais' },
] as const;

export const WEEKDAY_OPTIONS = [
  { value: 'mon', label: 'Seg' },
  { value: 'tue', label: 'Ter' },
  { value: 'wed', label: 'Qua' },
  { value: 'thu', label: 'Qui' },
  { value: 'fri', label: 'Sex' },
  { value: 'sat', label: 'Sáb' },
  { value: 'sun', label: 'Dom' },
] as const;

export const PERIOD_OPTIONS = [
  { value: 'morning', label: 'Manhã' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'night', label: 'Noite' },
  { value: 'overnight', label: 'Pernoite' },
] as const;

export const CONTACT_PREFERENCE_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Ligação' },
  { value: 'email', label: 'E-mail' },
] as const;

export type Specialty = (typeof SPECIALTY_OPTIONS)[number]['value'];
export type Weekday = (typeof WEEKDAY_OPTIONS)[number]['value'];
export type Period = (typeof PERIOD_OPTIONS)[number]['value'];
export type ContactPreference = (typeof CONTACT_PREFERENCE_OPTIONS)[number]['value'];

export const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

/** Categorias profissionais do MVP (técnico de enfermagem fica para depois). */
export const PROFESSION_OPTIONS = [
  { value: 'caregiver', label: 'Cuidador(a) de idosos' },
  { value: 'nurse', label: 'Enfermeiro(a)' },
  { value: 'physiotherapist', label: 'Fisioterapeuta' },
] as const;

export type Profession = (typeof PROFESSION_OPTIONS)[number]['value'];

/**
 * Profissões oferecidas a NOVOS cadastros no lançamento (F0: serviços só não
 * clínicos). Enfermagem e fisioterapia voltam quando houver parecer jurídico.
 */
export const LAUNCH_PROFESSIONS: readonly Profession[] = ['caregiver'];

/** Opções da tela de perfil: as do lançamento, mais a atual se o perfil já tiver outra. */
export function professionOptionsFor(current: Profession | null) {
  return PROFESSION_OPTIONS.filter((option) => LAUNCH_PROFESSIONS.includes(option.value) || option.value === current);
}

export const PROFESSION_INFO: Record<
  Profession,
  { summary: string; council: 'COREN' | 'CREFITO' | null; requiredDocuments: DocumentType[] }
> = {
  caregiver: {
    summary: 'Companhia, apoio no dia a dia e acompanhamento, sem atos de saúde.',
    council: null,
    requiredDocuments: ['identity', 'criminal_record', 'proof_of_address', 'course_certificate'],
  },
  nurse: {
    summary:
      'No lançamento, o Cuidar+ oferece só serviços não clínicos: você atende como acompanhante, com o COREN verificado como garantia extra.',
    council: 'COREN',
    requiredDocuments: ['identity', 'criminal_record', 'proof_of_address', 'council_card'],
  },
  physiotherapist: {
    summary:
      'No lançamento, o Cuidar+ oferece só serviços não clínicos: você atende como acompanhante, com o CREFITO verificado como garantia extra.',
    council: 'CREFITO',
    requiredDocuments: ['identity', 'criminal_record', 'proof_of_address', 'council_card'],
  },
};

/**
 * Categorias de serviço do lançamento: SÓ NÃO CLÍNICAS (decisão P1 da
 * docs/ESPECIFICACAO_MVP.md). A ficha completa (o que inclui e o que não
 * inclui) vem do servidor em GET /v1/catalog/categories.
 */
export const SERVICE_TYPE_LABELS = {
  companionship: 'Companhia e acompanhamento',
  daily_support: 'Apoio cotidiano',
  appointment_escort: 'Ida a consultas e compromissos',
  family_support: 'Apoio à família',
} as const;

export type ServiceType = keyof typeof SERVICE_TYPE_LABELS;

export const SERVICE_TYPE_SHORT_DESCRIPTIONS: Record<ServiceType, string> = {
  companionship: 'Presença, conversa e passeios.',
  daily_support: 'Ajuda em tarefas rotineiras e organização leve.',
  appointment_escort: 'Ir junto a consultas, exames e compromissos.',
  family_support: 'Comunicação e registro de horários para a família.',
};

export const SERVICE_TYPE_OPTIONS = (Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((value) => ({
  value,
  label: SERVICE_TYPE_LABELS[value],
}));

export function isServiceType(value: unknown): value is ServiceType {
  return typeof value === 'string' && value in SERVICE_TYPE_LABELS;
}

/** Nome da categoria; códigos desconhecidos (ex.: categoria nova no servidor) aparecem como "Outro serviço". */
export function serviceTypeLabel(code: string): string {
  return isServiceType(code) ? SERVICE_TYPE_LABELS[code] : 'Outro serviço';
}

/** Situação de cada categoria pedida pelo profissional (aprovada uma a uma pela equipe). */
export const CATEGORY_STATUS_LABELS = {
  pending: 'Aguardando análise',
  approved: 'Aprovada',
  rejected: 'Não aprovada',
  suspended: 'Suspensa',
} as const;

export type CategoryStatus = keyof typeof CATEGORY_STATUS_LABELS;

/** Aviso de emergência mostrado antes de contratar (CAT-02). */
export const EMERGENCY_NOTICE =
  'O Cuidar+ não é serviço de emergência. Em emergência médica ligue 192 (SAMU); em risco à segurança, 190.';

export const DOCUMENT_INFO = {
  identity: { label: 'Documento com foto', hint: 'RG ou CNH, frente e verso.' },
  criminal_record: {
    label: 'Certidão de antecedentes criminais',
    hint: 'Emitida há no máximo 90 dias (Polícia Federal ou Secretaria de Segurança do estado).',
  },
  proof_of_address: { label: 'Comprovante de residência', hint: 'Não é mostrado a clientes.' },
  course_certificate: { label: 'Certificado de curso de cuidador', hint: 'Curso de cuidador de idosos ou equivalente.' },
  council_card: { label: 'Registro no conselho', hint: 'Carteira ou certidão do COREN ou CREFITO.' },
  other: { label: 'Outros certificados', hint: 'Cursos, especializações, cartas de referência.' },
} as const;

export type DocumentType = keyof typeof DOCUMENT_INFO;

export const DOCUMENT_STATUS_LABELS = {
  uploading: 'Enviando',
  submitted: 'Enviado',
  accepted: 'Aprovado',
  rejected: 'Recusado',
} as const;

/** Parentesco do beneficiário com quem contrata. */
export const RELATIONSHIP_OPTIONS = [
  { value: 'self', label: 'Eu mesmo(a)' },
  { value: 'parent', label: 'Pai ou mãe' },
  { value: 'grandparent', label: 'Avô ou avó' },
  { value: 'spouse', label: 'Cônjuge' },
  { value: 'child', label: 'Filho(a)' },
  { value: 'sibling', label: 'Irmão(ã)' },
  { value: 'other', label: 'Outro' },
] as const;

export type Relationship = (typeof RELATIONSHIP_OPTIONS)[number]['value'];

/** Tipos de apoio que o beneficiário precisa (sem diagnóstico: dados de saúde ficam para a ficha protegida). */
export const ASSISTANCE_OPTIONS = [
  { value: 'mobility', label: 'Locomoção' },
  { value: 'hygiene', label: 'Higiene' },
  { value: 'feeding', label: 'Alimentação' },
  { value: 'medication_reminder', label: 'Lembrar remédios' },
  { value: 'companionship', label: 'Companhia' },
] as const;

export type AssistanceNeed = (typeof ASSISTANCE_OPTIONS)[number]['value'];
