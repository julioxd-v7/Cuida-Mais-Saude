/** Ficha de uma categoria de serviço (GET /v1/catalog/categories). */
export type ServiceCategory = {
  code: string;
  name: string;
  description: string;
  includes: string[];
  excludes: string[];
  requiredDocuments: string[];
  minHours: number | null;
  maxHours: number | null;
  cancellationPolicy: string | null;
  emergencyNotice: string | null;
  clinical: boolean;
  allowedProfessions: string[];
  enabled: boolean;
};
