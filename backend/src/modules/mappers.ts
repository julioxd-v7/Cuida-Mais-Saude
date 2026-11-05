/** Conversão das linhas do banco (snake_case) para o JSON da API (camelCase). */

type Row = Record<string, unknown>;

function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value).trimEnd();
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export type Role = 'client' | 'caregiver' | 'admin';

export type PublicUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  status: 'active' | 'suspended';
  /** Formas de entrar na conta (para a tela "Senha e acesso"). */
  hasPassword: boolean;
  googleLinked: boolean;
  createdAt: string | null;
};

export function toUser(row: Row): PublicUser {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    phone: String(row.phone),
    role: row.role as Role,
    status: row.status as PublicUser['status'],
    hasPassword: row.password_hash !== null && row.password_hash !== undefined,
    googleLinked: row.google_sub !== null && row.google_sub !== undefined,
    createdAt: iso(row.created_at),
  };
}

function toAddress(row: Row) {
  return {
    street: text(row.address_street),
    number: text(row.address_number),
    complement: text(row.address_complement),
    district: text(row.address_district),
    city: text(row.address_city),
    state: text(row.address_state),
    postalCode: text(row.address_postal_code),
  };
}

export function toClientProfile(row: Row) {
  return {
    contactPreference: String(row.contact_preference),
    address: toAddress(row),
    updatedAt: iso(row.updated_at),
  };
}

export function toCaregiverProfile(row: Row) {
  const profession = text(row.profession);
  const approved = row.verification_status === 'approved';
  return {
    profession,
    /** Categorias aprovadas e ativas: o que o profissional pode oferecer hoje. */
    serviceTypes: list(row.offered_categories),
    cpf: text(row.cpf),
    councilNumber: text(row.council_number),
    councilState: text(row.council_state),
    serviceDistrict: text(row.service_district),
    /** Selo de segurança: perfil e documentos verificados pela equipe. */
    verified: approved,
    verifiedAt: approved ? iso(row.reviewed_at) : null,
    bio: text(row.bio),
    experienceYears: row.experience_years === null || row.experience_years === undefined ? null : Number(row.experience_years),
    specialties: list(row.specialties),
    serviceCity: text(row.service_city),
    serviceState: text(row.service_state),
    serviceRadiusKm: row.service_radius_km === null || row.service_radius_km === undefined ? null : Number(row.service_radius_km),
    availabilityDays: list(row.availability_days),
    availabilityPeriods: list(row.availability_periods),
    /** Ligado pelo próprio profissional (aprovado); expira sozinho em 8 h. */
    availableNow: row.available_now_effective === undefined ? Boolean(row.available_now) : Boolean(row.available_now_effective),
    verificationStatus: String(row.verification_status),
    verificationNote: text(row.verification_note),
    submittedAt: iso(row.submitted_at),
    reviewedAt: iso(row.reviewed_at),
    updatedAt: iso(row.updated_at),
  };
}

export function toCareRecipient(row: Row) {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    relationship: String(row.relationship),
    assistanceNeeds: list(row.assistance_needs),
    address: toAddress(row),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function toCaregiverDocument(row: Row) {
  return {
    id: String(row.id),
    docType: String(row.doc_type),
    contentType: String(row.content_type),
    sizeBytes: Number(row.size_bytes),
    status: String(row.status),
    reviewNote: text(row.review_note),
    createdAt: iso(row.created_at),
    submittedAt: iso(row.submitted_at),
    reviewedAt: iso(row.reviewed_at),
  };
}

export function toCategory(row: Row) {
  return {
    code: String(row.code),
    name: String(row.name),
    description: String(row.description ?? ''),
    includes: list(row.includes),
    excludes: list(row.excludes),
    requiredDocuments: list(row.required_documents),
    minHours: row.min_hours === null || row.min_hours === undefined ? null : Number(row.min_hours),
    maxHours: row.max_hours === null || row.max_hours === undefined ? null : Number(row.max_hours),
    cancellationPolicy: text(row.cancellation_policy),
    emergencyNotice: text(row.emergency_notice),
    clinical: Boolean(row.clinical),
    allowedProfessions: list(row.allowed_professions),
    enabled: Boolean(row.enabled),
  };
}

export type Rate = { serviceType: string; hourlyRateCents: number };

export function toRate(row: Row): Rate {
  return { serviceType: String(row.service_type), hourlyRateCents: Number(row.hourly_rate_cents) };
}

/** "Ana Paula Souza" -> "Ana Paula S." (o sobrenome completo não aparece na busca). */
export function displayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  const last = parts.pop()!;
  return `${parts.slice(0, 2).join(' ')} ${last[0]!.toUpperCase()}.`;
}

/**
 * O que um CLIENTE pode ver de um profissional aprovado.
 * Nunca inclui: CPF, número do conselho, e-mail, telefone, nome completo,
 * endereço residencial ou documentos.
 */
export function toPublicCaregiver(row: Row, rates: Rate[], favorite: boolean) {
  const profession = text(row.profession);
  const council = profession === 'nurse' ? 'COREN' : profession === 'physiotherapist' ? 'CREFITO' : null;
  return {
    id: String(row.user_id),
    displayName: displayName(String(row.full_name)),
    profession,
    verified: row.verification_status === 'approved',
    council: council ? { name: council, state: text(row.council_state) } : null,
    bio: text(row.bio),
    experienceYears: row.experience_years === null || row.experience_years === undefined ? null : Number(row.experience_years),
    specialties: list(row.specialties),
    serviceTypes: list(row.offered_categories),
    rates,
    region: {
      district: text(row.service_district),
      city: text(row.service_city),
      state: text(row.service_state),
      radiusKm: row.service_radius_km === null || row.service_radius_km === undefined ? null : Number(row.service_radius_km),
    },
    availabilityDays: list(row.availability_days),
    availabilityPeriods: list(row.availability_periods),
    availableNow: Boolean(row.available_now_effective),
    favorite,
    verifiedSince: iso(row.reviewed_at),
  };
}
