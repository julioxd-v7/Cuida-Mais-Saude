import type { CaregiverVerificationStatus, AuthUser } from '@/features/auth/types';
import type {
  CategoryStatus,
  ContactPreference,
  DocumentType,
  Period,
  Profession,
  ServiceType,
  Specialty,
  Weekday,
} from '@/constants/labels';

export type ServiceRate = { serviceType: ServiceType; hourlyRateCents: number };

export type CaregiverCategory = { code: ServiceType; status: CategoryStatus; note: string | null };

export type Address = {
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

export type ClientProfile = {
  contactPreference: ContactPreference;
  address: Address;
  updatedAt: string | null;
};

export type CaregiverProfile = {
  profession: Profession | null;
  serviceTypes: ServiceType[];
  cpf: string | null;
  councilNumber: string | null;
  councilState: string | null;
  serviceDistrict: string | null;
  /** Selo de segurança: perfil e documentos verificados pela equipe. */
  verified: boolean;
  verifiedAt: string | null;
  missingDocuments: DocumentType[];
  bio: string | null;
  experienceYears: number | null;
  specialties: Specialty[];
  serviceCity: string | null;
  serviceState: string | null;
  serviceRadiusKm: number | null;
  availabilityDays: Weekday[];
  availabilityPeriods: Period[];
  /** "Disponível agora" ligado (só aprovados; expira sozinho em 8 h). */
  availableNow: boolean;
  /** A cidade de atendimento já é atendida pelo Cuidar+. */
  serviceAreaActive: boolean;
  /** Valor por hora de cada serviço oferecido. */
  rates: ServiceRate[];
  /** Categorias pedidas e a situação de cada uma (aprovadas uma a uma pela equipe). */
  categories: CaregiverCategory[];
  verificationStatus: CaregiverVerificationStatus;
  verificationNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string | null;
};

/** Resposta de GET /v1/me. */
export type MeResponse = {
  user: AuthUser;
  clientProfile?: ClientProfile | null;
  caregiverProfile?: CaregiverProfile | null;
};

export type CaregiverProfileInput = Partial<
  { categories: ServiceType[] } & Pick<
    CaregiverProfile,
    | 'profession'
    | 'cpf'
    | 'councilNumber'
    | 'councilState'
    | 'serviceDistrict'
    | 'bio'
    | 'experienceYears'
    | 'specialties'
    | 'serviceCity'
    | 'serviceState'
    | 'serviceRadiusKm'
    | 'availabilityDays'
    | 'availabilityPeriods'
  >
>;

export type CaregiverDocument = {
  id: string;
  docType: DocumentType;
  contentType: string;
  sizeBytes: number;
  status: 'uploading' | 'submitted' | 'accepted' | 'rejected';
  reviewNote: string | null;
  createdAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
};
