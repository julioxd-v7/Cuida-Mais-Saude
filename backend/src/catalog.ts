/**
 * Catálogo de profissões e tipos de serviço. Espelha as funções SQL
 * profession_service_types / profession_required_documents /
 * profession_requires_council (migration 002) — um teste garante que batem.
 */
export const PROFESSIONS = ['caregiver', 'nurse', 'physiotherapist'] as const;
export type Profession = (typeof PROFESSIONS)[number];

/**
 * Tipos de serviço da migration 002 (função profession_service_types). Desde a
 * F0, o que o profissional oferece vem do CATÁLOGO DE CATEGORIAS no banco
 * (service_categories + caregiver_categories); esta lista fica só como
 * referência histórica e para o teste de espelho com o SQL.
 */
export const SERVICE_TYPES = ['care', 'nursing_procedure', 'nursing_assessment', 'physiotherapy'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/** Código de categoria do catálogo (a existência é conferida no banco). */
export const CATEGORY_CODE = /^[a-z_]{3,40}$/;

/** Categorias não clínicas do MVP (P1). As clínicas existem no banco, desativadas. */
export const MVP_CATEGORIES = ['companionship', 'daily_support', 'appointment_escort', 'family_support'] as const;

export const DOCUMENT_TYPES = [
  'identity',
  'criminal_record',
  'proof_of_address',
  'course_certificate',
  'council_card',
  'other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

type ProfessionInfo = {
  serviceTypes: ServiceType[];
  requiresCouncil: boolean;
  council: 'COREN' | 'CREFITO' | null;
  requiredDocuments: DocumentType[];
};

export const PROFESSION_CATALOG: Record<Profession, ProfessionInfo> = {
  caregiver: {
    serviceTypes: ['care'],
    requiresCouncil: false,
    council: null,
    requiredDocuments: ['identity', 'criminal_record', 'proof_of_address', 'course_certificate'],
  },
  nurse: {
    serviceTypes: ['care', 'nursing_procedure', 'nursing_assessment'],
    requiresCouncil: true,
    council: 'COREN',
    requiredDocuments: ['identity', 'criminal_record', 'proof_of_address', 'council_card'],
  },
  physiotherapist: {
    serviceTypes: ['physiotherapy'],
    requiresCouncil: true,
    council: 'CREFITO',
    requiredDocuments: ['identity', 'criminal_record', 'proof_of_address', 'council_card'],
  },
};

export function serviceTypesFor(profession: string | null): ServiceType[] {
  return profession && profession in PROFESSION_CATALOG ? PROFESSION_CATALOG[profession as Profession].serviceTypes : [];
}

export function extensionFor(contentType: string): string {
  return (
    { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' }[
      contentType
    ] ?? 'bin'
  );
}
