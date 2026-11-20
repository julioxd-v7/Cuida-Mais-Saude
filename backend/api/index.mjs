// GERADO por 'npm run build:vercel' a partir de src/vercel.ts. Não edite à mão.

// src/http/errors.ts
var HttpError = class extends Error {
  constructor(status, code, message, fieldErrors) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.name = "HttpError";
  }
  status;
  code;
  fieldErrors;
};
function validationError(error) {
  const fieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return new HttpError(400, "VALIDATION", "Alguns dados est\xE3o inv\xE1lidos. Revise os campos indicados.", fieldErrors);
}
var errors = {
  unauthorized: () => new HttpError(401, "UNAUTHORIZED", "Voc\xEA precisa entrar para continuar."),
  tokenExpired: () => new HttpError(401, "TOKEN_EXPIRED", "Sua sess\xE3o expirou. Entre novamente."),
  forbidden: () => new HttpError(403, "FORBIDDEN", "Voc\xEA n\xE3o tem permiss\xE3o para realizar esta a\xE7\xE3o."),
  suspended: () => new HttpError(403, "ACCOUNT_SUSPENDED", "Sua conta est\xE1 suspensa. Entre em contato com o suporte."),
  accountDeleted: () => new HttpError(403, "ACCOUNT_DELETED", "Esta conta foi encerrada a pedido do titular. Fale com o suporte se foi um engano."),
  notFound: () => new HttpError(404, "NOT_FOUND", "N\xE3o encontramos o que voc\xEA procurou."),
  rateLimited: () => new HttpError(429, "RATE_LIMITED", "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.")
};

// src/http/router.ts
var MAX_BODY_BYTES = 64 * 1024;
var Router = class {
  routes = [];
  add(method, path, handler2) {
    const keys = [];
    const source = path.replace(/:([a-zA-Z]+)/g, (_match, key) => {
      keys.push(key);
      return "([^/]+)";
    });
    this.routes.push({ method, pattern: new RegExp(`^${source}$`), keys, handler: handler2 });
  }
  match(method, pathname) {
    let pathMatched = false;
    for (const route of this.routes) {
      const found = route.pattern.exec(pathname);
      if (!found) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params = {};
      route.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(found[index + 1] ?? "");
      });
      return { handler: route.handler, params };
    }
    return pathMatched ? "method" : null;
  }
};
async function readJsonBody(req) {
  if (req.method === "GET" || req.method === "DELETE") return void 0;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Os dados enviados s\xE3o grandes demais.");
    }
    chunks.push(buffer);
  }
  if (size === 0) return void 0;
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Envie os dados em JSON.");
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Os dados enviados n\xE3o est\xE3o em um formato v\xE1lido.");
  }
}
function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (body === void 0 || status === 204) {
    res.end();
    return;
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim() || null;
}

// src/modules/admin/routes.ts
import { z as z2 } from "zod";

// src/db/types.ts
function isDbError(error) {
  return error instanceof Error && typeof error.code === "string";
}

// src/db/errors.ts
function translateDbError(error) {
  if (!isDbError(error)) return error;
  switch (error.code) {
    case "23505":
      if (error.constraint === "users_email_key") {
        return new HttpError(409, "EMAIL_IN_USE", "J\xE1 existe uma conta com este e-mail. Tente entrar ou recuperar a senha.", {
          email: "Este e-mail j\xE1 est\xE1 cadastrado."
        });
      }
      if (error.constraint === "caregiver_profiles_cpf_key") {
        return new HttpError(409, "CPF_IN_USE", "Este CPF j\xE1 est\xE1 cadastrado em outra conta. Fale com o suporte se precisar de ajuda.", {
          cpf: "Este CPF j\xE1 est\xE1 cadastrado."
        });
      }
      return new HttpError(409, "CONFLICT", "Esta informa\xE7\xE3o j\xE1 est\xE1 em uso.");
    case "42501":
      return new HttpError(403, "FORBIDDEN", "Voc\xEA n\xE3o tem permiss\xE3o para realizar esta a\xE7\xE3o.");
    case "23514":
      if (error.message.includes("PROFILE_INCOMPLETE")) {
        return new HttpError(409, "PROFILE_INCOMPLETE", "Complete todos os campos obrigat\xF3rios do perfil profissional antes de continuar.");
      }
      if (error.message.includes("DOCUMENTS_MISSING")) {
        return new HttpError(409, "DOCUMENTS_MISSING", "Envie todos os documentos obrigat\xF3rios antes de continuar.");
      }
      if (error.message.includes("SERVICE_AREA_UNAVAILABLE")) {
        return new HttpError(
          409,
          "SERVICE_AREA_UNAVAILABLE",
          "O Cuidar+ ainda n\xE3o atende esta cidade. Seu cadastro fica salvo e avisaremos quando chegarmos a\xED.",
          { serviceCity: "Cidade ainda n\xE3o atendida." }
        );
      }
      if (error.message.includes("RATES_MISSING")) {
        return new HttpError(409, "RATES_MISSING", "Informe o valor por hora de pelo menos um servi\xE7o antes de enviar para verifica\xE7\xE3o.");
      }
      if (error.message.includes("RATE_OUT_OF_RANGE")) {
        return new HttpError(400, "RATE_OUT_OF_RANGE", "O valor precisa ficar dentro da faixa permitida para o servi\xE7o na sua cidade.");
      }
      if (error.message.includes("SERVICE_NOT_ALLOWED")) {
        return new HttpError(400, "SERVICE_NOT_ALLOWED", "Escolha esta categoria de servi\xE7o no seu perfil antes de definir o valor.");
      }
      if (error.message.includes("CATEGORIES_MISSING")) {
        return new HttpError(409, "CATEGORIES_MISSING", "Escolha pelo menos uma categoria de servi\xE7o antes de enviar para verifica\xE7\xE3o.");
      }
      if (error.message.includes("CATEGORY_NOT_AVAILABLE")) {
        return new HttpError(400, "CATEGORY_NOT_AVAILABLE", "Esta categoria de servi\xE7o n\xE3o est\xE1 dispon\xEDvel.", {
          categories: "Categoria indispon\xEDvel."
        });
      }
      if (error.message.includes("CLINICAL_CLEARANCE_REQUIRED")) {
        return new HttpError(
          409,
          "CLINICAL_CLEARANCE_REQUIRED",
          "Categorias cl\xEDnicas s\xF3 podem ser ativadas depois de registrar o parecer jur\xEDdico e regulat\xF3rio."
        );
      }
      if (error.message.includes("CONVERSATION_CLOSED")) {
        return new HttpError(409, "CONVERSATION_CLOSED", "Esta conversa foi encerrada.");
      }
      if (error.message.includes("INVALID_TRANSITION")) {
        return new HttpError(409, "INVALID_TRANSITION", "Esta mudan\xE7a de situa\xE7\xE3o n\xE3o \xE9 permitida agora.");
      }
      return new HttpError(400, "VALIDATION", "Alguns dados est\xE3o inv\xE1lidos. Revise e tente novamente.");
    case "22P02":
      return new HttpError(404, "NOT_FOUND", "N\xE3o encontramos o que voc\xEA procurou.");
    case "P0002":
      return new HttpError(404, "NOT_FOUND", "N\xE3o encontramos o que voc\xEA procurou.");
    default:
      return error;
  }
}

// src/security/tokens.ts
import { createHash, randomBytes, randomInt } from "node:crypto";
function generateToken() {
  return randomBytes(32).toString("base64url");
}
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
function generateResetCode() {
  return randomInt(0, 1e8).toString().padStart(8, "0");
}
function hashResetCode(resetId, code) {
  return createHash("sha256").update(`${resetId}:${code}`).digest("hex");
}

// src/modules/guard.ts
async function authenticate(deps, ctx, roles) {
  if (!ctx.bearerToken) throw errors.unauthorized();
  const [row] = await deps.db.query(
    `SELECT s.id AS session_id, s.user_id, s.access_expires_at, u.role, u.status, u.deletion_requested_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.access_token_hash = $1 AND s.revoked_at IS NULL`,
    [hashToken(ctx.bearerToken)]
  );
  if (!row) throw errors.unauthorized();
  if (new Date(row.access_expires_at).getTime() <= Date.now()) throw errors.tokenExpired();
  if (row.deletion_requested_at) throw errors.accountDeleted();
  if (row.status !== "active") throw errors.suspended();
  if (roles && !roles.includes(row.role)) throw errors.forbidden();
  return { userId: row.user_id, role: row.role, sessionId: row.session_id };
}

// src/modules/mappers.ts
function iso(value) {
  if (value === null || value === void 0) return null;
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}
function text(value) {
  if (value === null || value === void 0) return null;
  return String(value).trimEnd();
}
function list(value) {
  return Array.isArray(value) ? value.map(String) : [];
}
function toUser(row) {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    phone: String(row.phone),
    role: row.role,
    status: row.status,
    hasPassword: row.password_hash !== null && row.password_hash !== void 0,
    googleLinked: row.google_sub !== null && row.google_sub !== void 0,
    createdAt: iso(row.created_at)
  };
}
function toAddress(row) {
  return {
    street: text(row.address_street),
    number: text(row.address_number),
    complement: text(row.address_complement),
    district: text(row.address_district),
    city: text(row.address_city),
    state: text(row.address_state),
    postalCode: text(row.address_postal_code)
  };
}
function toClientProfile(row) {
  return {
    contactPreference: String(row.contact_preference),
    address: toAddress(row),
    updatedAt: iso(row.updated_at)
  };
}
function toCaregiverProfile(row) {
  const profession = text(row.profession);
  const approved = row.verification_status === "approved";
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
    experienceYears: row.experience_years === null || row.experience_years === void 0 ? null : Number(row.experience_years),
    specialties: list(row.specialties),
    serviceCity: text(row.service_city),
    serviceState: text(row.service_state),
    serviceRadiusKm: row.service_radius_km === null || row.service_radius_km === void 0 ? null : Number(row.service_radius_km),
    availabilityDays: list(row.availability_days),
    availabilityPeriods: list(row.availability_periods),
    /** Ligado pelo próprio profissional (aprovado); expira sozinho em 8 h. */
    availableNow: row.available_now_effective === void 0 ? Boolean(row.available_now) : Boolean(row.available_now_effective),
    verificationStatus: String(row.verification_status),
    verificationNote: text(row.verification_note),
    submittedAt: iso(row.submitted_at),
    reviewedAt: iso(row.reviewed_at),
    updatedAt: iso(row.updated_at)
  };
}
function toCareRecipient(row) {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    relationship: String(row.relationship),
    assistanceNeeds: list(row.assistance_needs),
    address: toAddress(row),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}
function toCaregiverDocument(row) {
  return {
    id: String(row.id),
    docType: String(row.doc_type),
    contentType: String(row.content_type),
    sizeBytes: Number(row.size_bytes),
    status: String(row.status),
    reviewNote: text(row.review_note),
    createdAt: iso(row.created_at),
    submittedAt: iso(row.submitted_at),
    reviewedAt: iso(row.reviewed_at)
  };
}
function toCategory(row) {
  return {
    code: String(row.code),
    name: String(row.name),
    description: String(row.description ?? ""),
    includes: list(row.includes),
    excludes: list(row.excludes),
    requiredDocuments: list(row.required_documents),
    minHours: row.min_hours === null || row.min_hours === void 0 ? null : Number(row.min_hours),
    maxHours: row.max_hours === null || row.max_hours === void 0 ? null : Number(row.max_hours),
    cancellationPolicy: text(row.cancellation_policy),
    emergencyNotice: text(row.emergency_notice),
    clinical: Boolean(row.clinical),
    allowedProfessions: list(row.allowed_professions),
    enabled: Boolean(row.enabled)
  };
}
function toRate(row) {
  return { serviceType: String(row.service_type), hourlyRateCents: Number(row.hourly_rate_cents) };
}
function displayName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts.pop();
  return `${parts.slice(0, 2).join(" ")} ${last[0].toUpperCase()}.`;
}
function toPublicCaregiver(row, rates, favorite) {
  const profession = text(row.profession);
  const council = profession === "nurse" ? "COREN" : profession === "physiotherapist" ? "CREFITO" : null;
  return {
    id: String(row.user_id),
    displayName: displayName(String(row.full_name)),
    profession,
    verified: row.verification_status === "approved",
    council: council ? { name: council, state: text(row.council_state) } : null,
    bio: text(row.bio),
    experienceYears: row.experience_years === null || row.experience_years === void 0 ? null : Number(row.experience_years),
    specialties: list(row.specialties),
    serviceTypes: list(row.offered_categories),
    rates,
    region: {
      district: text(row.service_district),
      city: text(row.service_city),
      state: text(row.service_state),
      radiusKm: row.service_radius_km === null || row.service_radius_km === void 0 ? null : Number(row.service_radius_km)
    },
    availabilityDays: list(row.availability_days),
    availabilityPeriods: list(row.availability_periods),
    availableNow: Boolean(row.available_now_effective),
    favorite,
    verifiedSince: iso(row.reviewed_at)
  };
}

// src/catalog.ts
var PROFESSIONS = ["caregiver", "nurse", "physiotherapist"];
var CATEGORY_CODE = /^[a-z_]{3,40}$/;
var DOCUMENT_TYPES = [
  "identity",
  "criminal_record",
  "proof_of_address",
  "course_certificate",
  "council_card",
  "other"
];
var DOCUMENT_CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
var MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
var PROFESSION_CATALOG = {
  caregiver: {
    serviceTypes: ["care"],
    requiresCouncil: false,
    council: null,
    requiredDocuments: ["identity", "criminal_record", "proof_of_address", "course_certificate"]
  },
  nurse: {
    serviceTypes: ["care", "nursing_procedure", "nursing_assessment"],
    requiresCouncil: true,
    council: "COREN",
    requiredDocuments: ["identity", "criminal_record", "proof_of_address", "council_card"]
  },
  physiotherapist: {
    serviceTypes: ["physiotherapy"],
    requiresCouncil: true,
    council: "CREFITO",
    requiredDocuments: ["identity", "criminal_record", "proof_of_address", "council_card"]
  }
};
function extensionFor(contentType) {
  return { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" }[contentType] ?? "bin";
}

// src/modules/catalog/routes.ts
async function listCategories(deps, includeDisabled = false) {
  const rows = await deps.db.query(
    `SELECT * FROM service_categories ${includeDisabled ? "" : "WHERE enabled"} ORDER BY sort_order, code`
  );
  return rows.map(toCategory);
}
function registerCatalogRoutes(router, deps) {
  router.add("GET", "/v1/catalog/professions", async () => ({
    status: 200,
    body: {
      professions: PROFESSIONS.map((profession) => ({ profession, ...PROFESSION_CATALOG[profession] }))
    }
  }));
  router.add("GET", "/v1/catalog/categories", async () => ({
    status: 200,
    body: { categories: await listCategories(deps) }
  }));
}

// src/validation.ts
import { z } from "zod";
var UF_LIST = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO"
];
var SPECIALTIES = ["elderly", "post_surgery", "disability", "dementia", "palliative", "special_needs_children"];
var WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
var PERIODS = ["morning", "afternoon", "night", "overnight"];
var ASSISTANCE_NEEDS = ["mobility", "hygiene", "feeding", "medication_reminder", "companionship"];
var RELATIONSHIPS = ["self", "parent", "grandparent", "spouse", "child", "sibling", "other"];
var CONTACT_PREFERENCES = ["whatsapp", "phone", "email"];
var emailSchema = z.string({ required_error: "Informe o e-mail." }).trim().toLowerCase().max(254, "E-mail longo demais.").regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Digite um e-mail v\xE1lido, como nome@exemplo.com.");
var phoneSchema = z.string({ required_error: "Informe o telefone." }).transform((value) => value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")).refine((digits) => /^[1-9][1-9]\d{8,9}$/.test(digits), "Digite o DDD e o n\xFAmero, como (11) 91234-5678.").refine((digits) => digits.length === 10 || digits[2] === "9", "Celular com 11 d\xEDgitos come\xE7a com 9 depois do DDD.");
var passwordSchema = z.string({ required_error: "Crie uma senha." }).min(8, "A senha precisa ter pelo menos 8 caracteres.").max(128, "A senha pode ter no m\xE1ximo 128 caracteres.").refine((value) => /[A-Za-zÀ-ÿ]/.test(value) && /\d/.test(value), "Use letras e n\xFAmeros na senha.");
var fullNameSchema = z.string({ required_error: "Informe o nome completo." }).trim().min(3, "Informe o nome completo.").max(120, "Nome longo demais.").refine((value) => value.split(/\s+/).length >= 2, "Informe nome e sobrenome.");
var ufSchema = z.string().trim().toUpperCase().refine((value) => UF_LIST.includes(value), "Escolha uma UF v\xE1lida, como SP.");
var postalCodeSchema = z.string().transform((value) => value.replace(/\D/g, "")).refine((digits) => digits.length === 8, "O CEP tem 8 d\xEDgitos.");
var optionalText = (max) => z.string().trim().max(max).nullable().optional();
var addressSchema = z.object({
  street: optionalText(160),
  number: optionalText(20),
  complement: optionalText(80),
  district: optionalText(80),
  city: optionalText(80),
  state: ufSchema.nullable().optional(),
  postalCode: postalCodeSchema.nullable().optional()
}).strict();
function enumList(values, message) {
  return z.array(z.enum(values, { errorMap: () => ({ message }) })).max(values.length).transform((list2) => [...new Set(list2)]);
}
function isValidCpf(value) {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (length) => {
    let total = 0;
    for (let i = 0; i < length; i += 1) total += Number(digits[i]) * (length + 1 - i);
    const rest = total * 10 % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}
var cpfSchema = z.string().transform((value) => value.replace(/\D/g, "")).refine(isValidCpf, "CPF inv\xE1lido. Confira os 11 n\xFAmeros.");
var councilNumberSchema = z.string().trim().regex(/^[0-9A-Za-z./-]{3,20}$/, "Informe o n\xFAmero do registro, como 123456.");

// src/modules/areas/routes.ts
async function listServiceAreas(deps, includeInactive = false) {
  const areas = await deps.db.query(
    `SELECT id, city, state, active FROM service_areas ${includeInactive ? "" : "WHERE active"} ORDER BY state, city`
  );
  const ranges = await deps.db.query(
    `SELECT service_area_id, service_type, min_hourly_cents, max_hourly_cents FROM service_price_ranges ORDER BY service_type`
  );
  return areas.map((area) => ({
    id: String(area.id),
    city: String(area.city),
    state: String(area.state).trim(),
    active: Boolean(area.active),
    priceRanges: ranges.filter((range) => String(range.service_area_id) === String(area.id)).map((range) => ({
      serviceType: String(range.service_type),
      minHourlyCents: Number(range.min_hourly_cents),
      maxHourlyCents: Number(range.max_hourly_cents)
    }))
  }));
}
function registerAreaRoutes(router, deps) {
  router.add("GET", "/v1/service-areas", async () => ({
    status: 200,
    body: { areas: await listServiceAreas(deps) }
  }));
}

// src/modules/admin/routes.ts
var verificationSchema = z2.object({
  status: z2.enum(["approved", "rejected", "suspended", "pending_review"]),
  note: z2.string().trim().max(500).optional()
}).strict();
var areaSchema = z2.object({ city: z2.string().trim().min(2, "Informe a cidade.").max(80), state: ufSchema, active: z2.boolean() }).strict();
var rangeSchema = z2.object({
  serviceType: z2.string().regex(CATEGORY_CODE, "Servi\xE7o desconhecido."),
  minHourlyCents: z2.number().int().min(100).max(1e7),
  maxHourlyCents: z2.number().int().min(100).max(1e7)
}).strict().refine((range) => range.maxHourlyCents >= range.minHourlyCents, {
  message: "O m\xE1ximo precisa ser maior ou igual ao m\xEDnimo.",
  path: ["maxHourlyCents"]
});
var caregiverCategorySchema = z2.object({
  status: z2.enum(["approved", "rejected", "suspended", "pending"]),
  note: z2.string().trim().max(500).optional()
}).strict();
var lines = z2.array(z2.string().trim().min(2).max(200)).max(20);
var categoryUpdateSchema = z2.object({
  name: z2.string().trim().min(3).max(80).optional(),
  description: z2.string().trim().max(500).optional(),
  includes: lines.optional(),
  excludes: lines.optional(),
  minHours: z2.number().int().min(1).max(24).optional(),
  maxHours: z2.number().int().min(1).max(24).optional(),
  cancellationPolicy: z2.string().trim().min(10).max(500).optional(),
  emergencyNotice: z2.string().trim().min(10).max(500).optional(),
  enabled: z2.boolean().optional()
}).strict();
var clearanceSchema = z2.object({
  topic: z2.enum(["clinical_services", "payments_live", "other"]),
  documentRef: z2.string().trim().min(3).max(300),
  issuedOn: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD."),
  responsible: z2.string().trim().min(3).max(160),
  validUntil: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD.").optional()
}).strict();
var settingSchema = z2.object({ value: z2.number().finite() }).strict();
function toSetting(row) {
  return {
    key: row.key,
    value: Number(row.value),
    unit: row.unit,
    min: Number(row.min_value),
    max: Number(row.max_value),
    provisional: Boolean(row.provisional),
    description: row.description,
    updatedAt: new Date(row.updated_at).toISOString()
  };
}
var userStatusSchema = z2.object({ status: z2.enum(["active", "suspended"]) }).strict();
function registerAdminRoutes(router, deps) {
  router.add("GET", "/v1/admin/caregivers", async (ctx) => {
    await authenticate(deps, ctx, ["admin"]);
    const rows = await deps.db.query(
      `SELECT u.*, c.verification_status, c.submitted_at
         FROM users u JOIN caregiver_profiles c ON c.user_id = u.id
        WHERE c.verification_status = 'pending_review'
        ORDER BY c.submitted_at`
    );
    return {
      status: 200,
      body: {
        caregivers: rows.map((row) => ({
          user: toUser(row),
          verificationStatus: String(row.verification_status)
        }))
      }
    };
  });
  router.add("POST", "/v1/admin/caregivers/:id/verification", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["admin"]);
    const parsed = verificationSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    try {
      const [profile] = await deps.db.query(`SELECT * FROM admin_set_caregiver_status($1, $2, $3, $4)`, [
        auth.userId,
        ctx.params.id,
        parsed.data.status,
        parsed.data.note ?? null
      ]);
      if (!profile) throw errors.notFound();
      return { status: 200, body: { caregiverProfile: toCaregiverProfile(profile) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("POST", "/v1/admin/users/:id/status", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["admin"]);
    const parsed = userStatusSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    try {
      const [user] = await deps.db.query(`SELECT * FROM admin_set_user_status($1, $2, $3)`, [
        auth.userId,
        ctx.params.id,
        parsed.data.status
      ]);
      if (!user) throw errors.notFound();
      return { status: 200, body: { user: toUser(user) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("GET", "/v1/admin/service-areas", async (ctx) => {
    await authenticate(deps, ctx, ["admin"]);
    return { status: 200, body: { areas: await listServiceAreas(deps, true) } };
  });
  router.add("POST", "/v1/admin/service-areas", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["admin"]);
    const parsed = areaSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    try {
      await deps.db.query(`SELECT id FROM admin_upsert_service_area($1, $2, $3, $4)`, [
        auth.userId,
        parsed.data.city,
        parsed.data.state,
        parsed.data.active
      ]);
      return { status: 200, body: { areas: await listServiceAreas(deps, true) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("POST", "/v1/admin/service-areas/:id/price-ranges", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["admin"]);
    const parsed = rangeSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    try {
      await deps.db.query(`SELECT service_type FROM admin_set_price_range($1, $2, $3, $4, $5)`, [
        auth.userId,
        ctx.params.id,
        parsed.data.serviceType,
        parsed.data.minHourlyCents,
        parsed.data.maxHourlyCents
      ]);
      return { status: 200, body: { areas: await listServiceAreas(deps, true) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("POST", "/v1/admin/caregivers/:id/categories/:code", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["admin"]);
    const parsed = caregiverCategorySchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    try {
      const [row] = await deps.db.query(`SELECT * FROM admin_set_caregiver_category($1, $2, $3, $4, $5)`, [
        auth.userId,
        ctx.params.id,
        ctx.params.code,
        parsed.data.status,
        parsed.data.note ?? null
      ]);
      if (!row) throw errors.notFound();
      return { status: 200, body: { category: { code: String(row.category_code), status: String(row.status) } } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("GET", "/v1/admin/categories", async (ctx) => {
    await authenticate(deps, ctx, ["admin"]);
    return { status: 200, body: { categories: await listCategories(deps, true) } };
  });
  router.add("PATCH", "/v1/admin/categories/:code", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["admin"]);
    const parsed = categoryUpdateSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    const d = parsed.data;
    try {
      const [row] = await deps.db.query(
        `SELECT * FROM admin_update_category($1, $2, $3, $4, $5::text[], $6::text[], $7, $8, $9, $10, $11)`,
        [
          auth.userId,
          ctx.params.code,
          d.name ?? null,
          d.description ?? null,
          d.includes ?? null,
          d.excludes ?? null,
          d.minHours ?? null,
          d.maxHours ?? null,
          d.cancellationPolicy ?? null,
          d.emergencyNotice ?? null,
          d.enabled ?? null
        ]
      );
      if (!row) throw errors.notFound();
      return { status: 200, body: { category: toCategory(row) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("GET", "/v1/admin/legal-clearances", async (ctx) => {
    await authenticate(deps, ctx, ["admin"]);
    const rows = await deps.db.query(
      `SELECT id, topic, document_ref, issued_on::text AS issued_on, responsible, valid_until::text AS valid_until, created_at
         FROM legal_clearances ORDER BY created_at DESC`
    );
    return {
      status: 200,
      body: {
        clearances: rows.map((r) => ({
          id: String(r.id),
          topic: String(r.topic),
          documentRef: String(r.document_ref),
          issuedOn: String(r.issued_on),
          responsible: String(r.responsible),
          validUntil: r.valid_until === null ? null : String(r.valid_until)
        }))
      }
    };
  });
  router.add("POST", "/v1/admin/legal-clearances", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["admin"]);
    const parsed = clearanceSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    const d = parsed.data;
    try {
      const [row] = await deps.db.query(
        `SELECT id FROM admin_add_legal_clearance($1, $2, $3, $4::date, $5, $6::date)`,
        [auth.userId, d.topic, d.documentRef, d.issuedOn, d.responsible, d.validUntil ?? null]
      );
      return { status: 201, body: { id: String(row?.id) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("GET", "/v1/admin/settings", async (ctx) => {
    await authenticate(deps, ctx, ["admin"]);
    const rows = await deps.db.query(`SELECT * FROM platform_settings ORDER BY key`);
    return { status: 200, body: { settings: rows.map(toSetting) } };
  });
  router.add("POST", "/v1/admin/settings/:key", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["admin"]);
    const parsed = settingSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    try {
      const [row] = await deps.db.query(`SELECT * FROM admin_set_setting($1, $2, $3)`, [
        auth.userId,
        ctx.params.key,
        parsed.data.value
      ]);
      if (!row) throw errors.notFound();
      return { status: 200, body: { setting: toSetting(row) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
}

// src/modules/auth/routes.ts
import { randomUUID } from "node:crypto";
import { z as z3 } from "zod";

// src/security/passwords.ts
import { randomBytes as randomBytes2, scrypt, timingSafeEqual } from "node:crypto";
var PARAMS = { N: 2 ** 14, r: 8, p: 5 };
var KEY_LENGTH = 64;
var SALT_BYTES = 16;
function derive(password, salt, options) {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { ...options, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}
async function hashPassword(password) {
  const salt = randomBytes2(SALT_BYTES);
  const key = await derive(password, salt, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}
async function verifyPassword(password, stored) {
  const [algorithm, n, r, p, saltB64, hashB64] = stored.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await derive(password, Buffer.from(saltB64, "base64"), {
    N: Number(n),
    r: Number(r),
    p: Number(p)
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
var dummyHash = null;
async function verifyAgainstDummy(password) {
  dummyHash ??= hashPassword("senha-inexistente-para-equalizar-tempo");
  await verifyPassword(password, await dummyHash);
}

// src/modules/auth/routes.ts
var registerSchema = z3.object({
  role: z3.enum(["client", "caregiver"], {
    errorMap: () => ({ message: "Escolha se voc\xEA \xE9 cliente ou cuidador." })
  }),
  fullName: fullNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  acceptTerms: z3.literal(true, {
    errorMap: () => ({ message: "\xC9 preciso aceitar os Termos de Uso e a Pol\xEDtica de Privacidade." })
  })
}).strict();
var loginSchema = z3.object({
  email: emailSchema,
  password: z3.string({ required_error: "Informe a senha." }).min(1, "Informe a senha.").max(128)
}).strict();
var refreshSchema = z3.object({ refreshToken: z3.string().min(20).max(200) }).strict();
var logoutSchema = z3.object({ refreshToken: z3.string().max(200).optional() }).strict();
var forgotSchema = z3.object({ email: emailSchema }).strict();
var resetSchema = z3.object({
  email: emailSchema,
  code: z3.string().trim().regex(/^\d{8}$/, "O c\xF3digo tem 8 n\xFAmeros."),
  password: passwordSchema
}).strict();
var googleSchema = z3.object({
  idToken: z3.string({ required_error: "Token do Google ausente." }).min(100).max(4096),
  /** Só no primeiro acesso: dados que o Google não fornece. */
  signup: z3.object({
    role: registerSchema.shape.role,
    fullName: fullNameSchema,
    phone: phoneSchema,
    acceptTerms: registerSchema.shape.acceptTerms
  }).strict().optional()
}).strict();
var RESET_TTL_MS = 15 * 6e4;
var RESET_MAX_ATTEMPTS = 5;
function parse(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw validationError(result.error);
  return result.data;
}
async function createSession(deps, userId) {
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const accessExpiresAt = new Date(Date.now() + deps.config.accessTokenTtlMs);
  const refreshExpiresAt = new Date(Date.now() + deps.config.refreshTokenTtlMs);
  await deps.db.query(
    `INSERT INTO sessions (user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, hashToken(accessToken), hashToken(refreshToken), accessExpiresAt.toISOString(), refreshExpiresAt.toISOString()]
  );
  return { accessToken, refreshToken, accessExpiresAt: accessExpiresAt.toISOString() };
}
function authResponse(status, tokens, user) {
  return { status, body: { ...tokens, user } };
}
function limitOrThrow(allowed) {
  if (!allowed) throw errors.rateLimited();
}
function registerAuthRoutes(router, deps) {
  router.add("POST", "/v1/auth/register", async (ctx) => {
    limitOrThrow(deps.limits.register.consume(`ip:${ctx.ip}`));
    const input = parse(registerSchema, ctx.body);
    const passwordHash = await hashPassword(input.password);
    let row;
    try {
      [row] = await deps.db.query(`SELECT * FROM register_user($1, $2, $3, $4, $5, $6)`, [
        input.email,
        passwordHash,
        input.fullName,
        input.phone,
        input.role,
        deps.config.termsVersion
      ]);
    } catch (error) {
      throw translateDbError(error);
    }
    if (!row) throw new Error("register_user n\xE3o retornou o usu\xE1rio");
    const user = toUser(row);
    return authResponse(201, await createSession(deps, user.id), user);
  });
  router.add("POST", "/v1/auth/login", async (ctx) => {
    const input = parse(loginSchema, ctx.body);
    limitOrThrow(deps.limits.login.consume(`login:${ctx.ip}:${input.email}`));
    const [row] = await deps.db.query(`SELECT * FROM users WHERE email = $1`, [input.email]);
    if (!row) {
      await verifyAgainstDummy(input.password);
      throw new HttpError(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos.");
    }
    if (!row.password_hash) {
      await verifyAgainstDummy(input.password);
      throw new HttpError(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos.");
    }
    if (!await verifyPassword(input.password, String(row.password_hash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos.");
    }
    if (row.deletion_requested_at) throw errors.accountDeleted();
    if (row.status !== "active") throw errors.suspended();
    deps.limits.login.reset(`login:${ctx.ip}:${input.email}`);
    const user = toUser(row);
    return authResponse(200, await createSession(deps, user.id), user);
  });
  router.add("POST", "/v1/auth/google", async (ctx) => {
    limitOrThrow(deps.limits.login.consume(`google:${ctx.ip}`));
    if (!deps.google.available) {
      throw new HttpError(503, "GOOGLE_UNAVAILABLE", "O login com Google ainda n\xE3o est\xE1 dispon\xEDvel. Entre com e-mail e senha.");
    }
    const input = parse(googleSchema, ctx.body);
    let identity;
    try {
      identity = await deps.google.verify(input.idToken);
    } catch {
      throw new HttpError(401, "INVALID_GOOGLE_TOKEN", "N\xE3o foi poss\xEDvel confirmar sua conta Google. Tente novamente.");
    }
    if (!identity.emailVerified) {
      throw new HttpError(401, "GOOGLE_EMAIL_NOT_VERIFIED", "Seu e-mail do Google n\xE3o est\xE1 verificado.");
    }
    const [bySub] = await deps.db.query(`SELECT * FROM users WHERE google_sub = $1`, [identity.sub]);
    const [byEmail] = bySub ? [bySub] : await deps.db.query(`SELECT * FROM users WHERE email = $1`, [identity.email]);
    const existing = bySub ?? byEmail;
    if (existing) {
      if (existing.deletion_requested_at) throw errors.accountDeleted();
      if (existing.status !== "active") throw errors.suspended();
      if (existing.google_sub && existing.google_sub !== identity.sub) {
        throw new HttpError(409, "GOOGLE_ACCOUNT_MISMATCH", "Este e-mail j\xE1 est\xE1 ligado a outra conta Google. Entre com e-mail e senha.");
      }
      if (!existing.google_sub) {
        await deps.db.query(`UPDATE users SET google_sub = $2 WHERE id = $1 RETURNING id`, [existing.id, identity.sub]);
        await deps.db.query(
          `INSERT INTO audit_log (actor_id, action, target_type, target_id) VALUES ($1, 'user.google_linked', 'user', $1) RETURNING id`,
          [existing.id]
        );
      }
      const [row2] = await deps.db.query(`SELECT * FROM users WHERE id = $1`, [existing.id]);
      const user2 = toUser(row2);
      return authResponse(200, await createSession(deps, user2.id), user2);
    }
    if (!input.signup) {
      return {
        status: 200,
        body: { needsSignup: true, profile: { email: identity.email, fullName: identity.name } }
      };
    }
    limitOrThrow(deps.limits.register.consume(`ip:${ctx.ip}`));
    let row;
    try {
      [row] = await deps.db.query(`SELECT * FROM register_google_user($1, $2, $3, $4, $5, $6)`, [
        identity.email,
        identity.sub,
        input.signup.fullName,
        input.signup.phone,
        input.signup.role,
        deps.config.termsVersion
      ]);
    } catch (error) {
      throw translateDbError(error);
    }
    if (!row) throw new Error("register_google_user n\xE3o retornou o usu\xE1rio");
    const user = toUser(row);
    return authResponse(201, await createSession(deps, user.id), user);
  });
  router.add("POST", "/v1/auth/refresh", async (ctx) => {
    const input = parse(refreshSchema, ctx.body);
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const accessExpiresAt = new Date(Date.now() + deps.config.accessTokenTtlMs);
    const refreshExpiresAt = new Date(Date.now() + deps.config.refreshTokenTtlMs);
    const [session] = await deps.db.query(
      `UPDATE sessions
          SET access_token_hash = $2, refresh_token_hash = $3,
              access_expires_at = $4, refresh_expires_at = $5, last_used_at = now()
        WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND refresh_expires_at > now()
      RETURNING user_id`,
      [
        hashToken(input.refreshToken),
        hashToken(accessToken),
        hashToken(refreshToken),
        accessExpiresAt.toISOString(),
        refreshExpiresAt.toISOString()
      ]
    );
    if (!session) throw errors.tokenExpired();
    const [row] = await deps.db.query(`SELECT * FROM users WHERE id = $1`, [session.user_id]);
    if (!row) throw errors.unauthorized();
    if (row.deletion_requested_at) throw errors.accountDeleted();
    if (row.status !== "active") throw errors.suspended();
    return authResponse(200, { accessToken, refreshToken, accessExpiresAt: accessExpiresAt.toISOString() }, toUser(row));
  });
  router.add("POST", "/v1/auth/logout", async (ctx) => {
    const input = parse(logoutSchema, ctx.body);
    const hashes = [ctx.bearerToken, input.refreshToken].filter((t) => Boolean(t)).map(hashToken);
    if (hashes.length) {
      await deps.db.query(
        `UPDATE sessions SET revoked_at = now()
          WHERE revoked_at IS NULL AND (access_token_hash = ANY($1::text[]) OR refresh_token_hash = ANY($1::text[]))
        RETURNING id`,
        [hashes]
      );
    }
    return { status: 204 };
  });
  router.add("POST", "/v1/auth/password/forgot", async (ctx) => {
    const input = parse(forgotSchema, ctx.body);
    limitOrThrow(deps.limits.forgot.consume(`forgot-ip:${ctx.ip}`));
    limitOrThrow(deps.limits.forgot.consume(`forgot-email:${input.email}`));
    if (!deps.mailer.available) {
      throw new HttpError(
        503,
        "PASSWORD_RESET_UNAVAILABLE",
        "A recupera\xE7\xE3o de senha ainda n\xE3o est\xE1 dispon\xEDvel. Fale com o suporte."
      );
    }
    const [user] = await deps.db.query(`SELECT id, status FROM users WHERE email = $1`, [
      input.email
    ]);
    if (user && user.status === "active") {
      await deps.db.query(
        `UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL RETURNING id`,
        [user.id]
      );
      const resetId = randomUUID();
      const code = generateResetCode();
      await deps.db.query(
        `INSERT INTO password_resets (id, user_id, code_hash, expires_at) VALUES ($1, $2, $3, $4) RETURNING id`,
        [resetId, user.id, hashResetCode(resetId, code), new Date(Date.now() + RESET_TTL_MS).toISOString()]
      );
      await deps.mailer.send({
        to: input.email,
        subject: "CUIDAR+ \u2014 c\xF3digo para redefinir sua senha",
        text: `Seu c\xF3digo \xE9 ${code}. Ele vale por 15 minutos.
Se voc\xEA n\xE3o pediu, ignore este e-mail.`
      });
    }
    return {
      status: 202,
      body: { message: "Se houver uma conta com este e-mail, enviaremos um c\xF3digo para redefinir a senha." }
    };
  });
  router.add("POST", "/v1/auth/password/reset", async (ctx) => {
    limitOrThrow(deps.limits.reset.consume(`reset:${ctx.ip}`));
    const input = parse(resetSchema, ctx.body);
    const invalid = () => new HttpError(400, "INVALID_RESET_CODE", "C\xF3digo inv\xE1lido ou expirado. Pe\xE7a um novo c\xF3digo.", {
      code: "C\xF3digo inv\xE1lido ou expirado."
    });
    const [reset] = await deps.db.query(
      `SELECT r.id, r.user_id, r.code_hash, r.attempts
         FROM password_resets r
         JOIN users u ON u.id = r.user_id
        WHERE u.email = $1 AND u.status = 'active'
          AND r.used_at IS NULL AND r.expires_at > now()
        ORDER BY r.created_at DESC
        LIMIT 1`,
      [input.email]
    );
    if (!reset || reset.attempts >= RESET_MAX_ATTEMPTS) throw invalid();
    if (hashResetCode(reset.id, input.code) !== reset.code_hash) {
      await deps.db.query(`UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1 RETURNING id`, [reset.id]);
      throw invalid();
    }
    const passwordHash = await hashPassword(input.password);
    const [done] = await deps.db.query(
      `WITH used AS (
         UPDATE password_resets SET used_at = now()
          WHERE id = $1 AND used_at IS NULL
         RETURNING user_id
       ), changed AS (
         UPDATE users SET password_hash = $2 WHERE id = (SELECT user_id FROM used) RETURNING id
       ), revoked AS (
         UPDATE sessions SET revoked_at = now()
          WHERE user_id = (SELECT id FROM changed) AND revoked_at IS NULL
         RETURNING id
       )
       SELECT id FROM changed`,
      [reset.id, passwordHash]
    );
    if (!done) throw invalid();
    await deps.db.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id) VALUES ($1, 'user.password_reset', 'user', $1) RETURNING id`,
      [reset.user_id]
    );
    return { status: 204 };
  });
  router.add("GET", "/v1/auth/session", async (ctx) => {
    const auth = await authenticate(deps, ctx);
    const [row] = await deps.db.query(`SELECT * FROM users WHERE id = $1`, [auth.userId]);
    if (!row) throw errors.unauthorized();
    return { status: 200, body: { user: toUser(row) } };
  });
}

// src/modules/me/routes.ts
import { z as z4 } from "zod";
var updateMeSchema = z4.object({ fullName: fullNameSchema.optional(), phone: phoneSchema.optional() }).strict();
var updateClientProfileSchema = z4.object({
  contactPreference: z4.enum(CONTACT_PREFERENCES).optional(),
  address: addressSchema.optional()
}).strict();
var updateCaregiverProfileSchema = z4.object({
  profession: z4.enum(PROFESSIONS, { errorMap: () => ({ message: "Escolha sua profiss\xE3o." }) }).optional(),
  cpf: cpfSchema.optional(),
  councilNumber: councilNumberSchema.nullable().optional(),
  councilState: ufSchema.nullable().optional(),
  serviceDistrict: z4.string().trim().max(80).nullable().optional(),
  bio: z4.string().trim().max(1e3, "A apresenta\xE7\xE3o pode ter at\xE9 1000 caracteres.").nullable().optional(),
  experienceYears: z4.number().int().min(0, "Informe os anos de experi\xEAncia.").max(60).nullable().optional(),
  specialties: enumList(SPECIALTIES, "Especialidade desconhecida.").optional(),
  serviceCity: z4.string().trim().max(80).nullable().optional(),
  serviceState: ufSchema.nullable().optional(),
  serviceRadiusKm: z4.number().int().min(1, "O raio m\xEDnimo \xE9 1 km.").max(100, "O raio m\xE1ximo \xE9 100 km.").nullable().optional(),
  availabilityDays: enumList(WEEKDAYS, "Dia da semana desconhecido.").optional(),
  availabilityPeriods: enumList(PERIODS, "Per\xEDodo desconhecido.").optional(),
  /** Categorias que quer oferecer (substitui a lista). Cada uma é aprovada pela equipe. */
  categories: z4.array(z4.string().regex(CATEGORY_CODE, "Categoria desconhecida.")).max(20).refine((items) => new Set(items).size === items.length, "Categoria repetida.").optional()
}).strict();
var ratesSchema = z4.object({
  rates: z4.array(
    z4.object({
      serviceType: z4.string().regex(CATEGORY_CODE, "Servi\xE7o desconhecido."),
      hourlyRateCents: z4.number({ invalid_type_error: "Informe o valor por hora." }).int("Informe o valor em centavos.").min(100, "Informe o valor por hora.").max(1e7)
    }).strict()
  ).max(20).refine((items) => new Set(items.map((item) => item.serviceType)).size === items.length, "Servi\xE7o repetido.")
}).strict();
var changePasswordSchema = z4.object({
  currentPassword: z4.string().max(128).optional(),
  newPassword: passwordSchema
}).strict();
var deletionSchema = z4.object({
  confirm: z4.literal("EXCLUIR", { errorMap: () => ({ message: "Digite EXCLUIR para confirmar." }) }),
  password: z4.string().max(128).optional(),
  reason: z4.string().trim().max(300).optional()
}).strict();
var availabilitySchema = z4.object({ availableNow: z4.boolean() }).strict();
function parse2(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw validationError(result.error);
  return result.data;
}
function buildSet(fields, columns, startAt = 2) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(columns)) {
    if (fields[key] === void 0) continue;
    values.push(fields[key]);
    const cast = Array.isArray(fields[key]) ? "::text[]" : "";
    sets.push(`${column} = $${startAt + values.length - 1}${cast}`);
  }
  return { sets, values };
}
async function withMissingDocuments(deps, userId, row) {
  const [extra] = await deps.db.query(
    `SELECT caregiver_missing_documents(p.user_id) AS missing,
            service_area_is_active(p.service_city, p.service_state) AS area_active,
            caregiver_is_available_now(p) AS available
       FROM caregiver_profiles p WHERE p.user_id = $1`,
    [userId]
  );
  const rates = await deps.db.query(
    `SELECT service_type, hourly_rate_cents FROM caregiver_service_rates WHERE caregiver_id = $1 ORDER BY service_type`,
    [userId]
  );
  const categories = await deps.db.query(
    `SELECT c.category_code, c.status, c.note, s.enabled
       FROM caregiver_categories c JOIN service_categories s ON s.code = c.category_code
      WHERE c.caregiver_id = $1 ORDER BY s.sort_order`,
    [userId]
  );
  const offered = categories.filter((c) => c.status === "approved" && c.enabled).map((c) => String(c.category_code));
  return {
    ...toCaregiverProfile({ ...row, available_now_effective: extra?.available ?? false, offered_categories: offered }),
    missingDocuments: extra?.missing ?? [],
    serviceAreaActive: extra?.area_active ?? false,
    rates: rates.map(toRate),
    /** Situação de cada categoria pedida (pendente, aprovada, recusada, suspensa). */
    categories: categories.map((c) => ({
      code: String(c.category_code),
      status: String(c.status),
      note: c.note === null || c.note === void 0 ? null : String(c.note)
    }))
  };
}
async function loadMe(deps, userId) {
  const [userRow] = await deps.db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
  if (!userRow) throw errors.notFound();
  const user = toUser(userRow);
  if (user.role === "client") {
    const [profile] = await deps.db.query(`SELECT * FROM client_profiles WHERE user_id = $1`, [userId]);
    return { user, clientProfile: profile ? toClientProfile(profile) : null };
  }
  if (user.role === "caregiver") {
    const [profile] = await deps.db.query(`SELECT * FROM caregiver_profiles WHERE user_id = $1`, [userId]);
    return { user, caregiverProfile: profile ? await withMissingDocuments(deps, userId, profile) : null };
  }
  return { user };
}
function registerMeRoutes(router, deps) {
  router.add("GET", "/v1/me", async (ctx) => {
    const auth = await authenticate(deps, ctx);
    return { status: 200, body: await loadMe(deps, auth.userId) };
  });
  router.add("PATCH", "/v1/me", async (ctx) => {
    const auth = await authenticate(deps, ctx);
    const input = parse2(updateMeSchema, ctx.body);
    const { sets, values } = buildSet(input, { fullName: "full_name", phone: "phone" });
    if (sets.length) {
      try {
        await deps.db.query(`UPDATE users SET ${sets.join(", ")} WHERE id = $1 RETURNING id`, [auth.userId, ...values]);
      } catch (error) {
        throw translateDbError(error);
      }
    }
    return { status: 200, body: await loadMe(deps, auth.userId) };
  });
  router.add("PATCH", "/v1/me/client-profile", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client"]);
    const input = parse2(updateClientProfileSchema, ctx.body);
    const flat = { contactPreference: input.contactPreference };
    if (input.address) {
      for (const [key, value] of Object.entries(input.address)) flat[`address.${key}`] = value;
    }
    const { sets, values } = buildSet(flat, {
      contactPreference: "contact_preference",
      "address.street": "address_street",
      "address.number": "address_number",
      "address.complement": "address_complement",
      "address.district": "address_district",
      "address.city": "address_city",
      "address.state": "address_state",
      "address.postalCode": "address_postal_code"
    });
    if (sets.length) {
      try {
        await deps.db.query(`UPDATE client_profiles SET ${sets.join(", ")} WHERE user_id = $1 RETURNING user_id`, [
          auth.userId,
          ...values
        ]);
      } catch (error) {
        throw translateDbError(error);
      }
    }
    return { status: 200, body: await loadMe(deps, auth.userId) };
  });
  router.add("PATCH", "/v1/me/caregiver-profile", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["caregiver"]);
    const input = parse2(updateCaregiverProfileSchema, ctx.body);
    const { sets, values } = buildSet(input, {
      profession: "profession",
      cpf: "cpf",
      councilNumber: "council_number",
      councilState: "council_state",
      serviceDistrict: "service_district",
      bio: "bio",
      experienceYears: "experience_years",
      specialties: "specialties",
      serviceCity: "service_city",
      serviceState: "service_state",
      serviceRadiusKm: "service_radius_km",
      availabilityDays: "availability_days",
      availabilityPeriods: "availability_periods"
    });
    try {
      if (sets.length) {
        await deps.db.query(`UPDATE caregiver_profiles SET ${sets.join(", ")} WHERE user_id = $1 RETURNING user_id`, [
          auth.userId,
          ...values
        ]);
      }
      if (input.categories) {
        await deps.db.query(`SELECT caregiver_set_categories($1, $2::text[])`, [auth.userId, input.categories]);
      }
      const [profile] = await deps.db.query(`SELECT * FROM sync_caregiver_completion($1)`, [auth.userId]);
      if (!profile) throw errors.notFound();
      return { status: 200, body: { caregiverProfile: await withMissingDocuments(deps, auth.userId, profile) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("POST", "/v1/me/caregiver-profile/submit", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["caregiver"]);
    try {
      const [profile] = await deps.db.query(`SELECT * FROM caregiver_submit_for_review($1)`, [auth.userId]);
      if (!profile) throw errors.notFound();
      return { status: 200, body: { caregiverProfile: await withMissingDocuments(deps, auth.userId, profile) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("POST", "/v1/me/caregiver-profile/rates", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["caregiver"]);
    const input = parse2(ratesSchema, ctx.body);
    const types = input.rates.map((rate) => rate.serviceType);
    const cents = input.rates.map((rate) => rate.hourlyRateCents);
    try {
      if (types.length) {
        await deps.db.query(
          `INSERT INTO caregiver_service_rates (caregiver_id, service_type, hourly_rate_cents)
           SELECT $1, t.service_type, t.cents
             FROM unnest($2::text[], $3::text[]::int[]) AS t(service_type, cents)
           ON CONFLICT (caregiver_id, service_type) DO UPDATE SET hourly_rate_cents = EXCLUDED.hourly_rate_cents
           RETURNING caregiver_id`,
          [auth.userId, types, cents]
        );
      }
      await deps.db.query(
        `DELETE FROM caregiver_service_rates WHERE caregiver_id = $1 AND NOT (service_type = ANY ($2::text[])) RETURNING caregiver_id`,
        [auth.userId, types]
      );
      const [profile] = await deps.db.query(`SELECT * FROM caregiver_profiles WHERE user_id = $1`, [auth.userId]);
      if (!profile) throw errors.notFound();
      return { status: 200, body: { caregiverProfile: await withMissingDocuments(deps, auth.userId, profile) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("POST", "/v1/me/caregiver-profile/availability", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["caregiver"]);
    const input = parse2(availabilitySchema, ctx.body);
    const [current] = await deps.db.query(
      `SELECT verification_status FROM caregiver_profiles WHERE user_id = $1`,
      [auth.userId]
    );
    if (!current) throw errors.notFound();
    if (input.availableNow && current.verification_status !== "approved") {
      throw new HttpError(409, "NOT_APPROVED", "Voc\xEA poder\xE1 ficar dispon\xEDvel depois que seu perfil for aprovado.");
    }
    try {
      const [profile] = await deps.db.query(
        `UPDATE caregiver_profiles SET available_now = $2 WHERE user_id = $1 RETURNING *`,
        [auth.userId, input.availableNow]
      );
      if (!profile) throw errors.notFound();
      return { status: 200, body: { caregiverProfile: await withMissingDocuments(deps, auth.userId, profile) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("POST", "/v1/me/password", async (ctx) => {
    const auth = await authenticate(deps, ctx);
    if (!deps.limits.account.consume(`password:${auth.userId}`)) throw errors.rateLimited();
    const input = parse2(changePasswordSchema, ctx.body);
    const [user] = await deps.db.query(`SELECT password_hash FROM users WHERE id = $1`, [
      auth.userId
    ]);
    if (!user) throw errors.notFound();
    if (user.password_hash && !(input.currentPassword && await verifyPassword(input.currentPassword, user.password_hash))) {
      throw new HttpError(400, "INVALID_CURRENT_PASSWORD", "A senha atual est\xE1 incorreta.", {
        currentPassword: "Senha atual incorreta."
      });
    }
    const hash = await hashPassword(input.newPassword);
    await deps.db.query(`UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING id`, [auth.userId, hash]);
    await deps.db.query(
      `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL RETURNING id`,
      [auth.userId, auth.sessionId]
    );
    await deps.db.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id) VALUES ($1, 'user.password_changed', 'user', $1) RETURNING id`,
      [auth.userId]
    );
    return { status: 204 };
  });
  router.add("GET", "/v1/me/sessions", async (ctx) => {
    const auth = await authenticate(deps, ctx);
    const rows = await deps.db.query(
      `SELECT id, created_at, last_used_at FROM sessions
        WHERE user_id = $1 AND revoked_at IS NULL AND refresh_expires_at > now()
        ORDER BY last_used_at DESC`,
      [auth.userId]
    );
    return {
      status: 200,
      body: {
        sessions: rows.map((row) => ({
          id: String(row.id),
          createdAt: new Date(row.created_at).toISOString(),
          lastUsedAt: new Date(row.last_used_at).toISOString(),
          current: String(row.id) === auth.sessionId
        }))
      }
    };
  });
  router.add("POST", "/v1/me/sessions/revoke-others", async (ctx) => {
    const auth = await authenticate(deps, ctx);
    const revoked = await deps.db.query(
      `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL RETURNING id`,
      [auth.userId, auth.sessionId]
    );
    await deps.db.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
       VALUES ($1, 'user.sessions_revoked', 'user', $1, jsonb_build_object('count', $2::int)) RETURNING id`,
      [auth.userId, revoked.length]
    );
    return { status: 200, body: { revoked: revoked.length } };
  });
  router.add("POST", "/v1/me/deletion", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client", "caregiver"]);
    if (!deps.limits.account.consume(`deletion:${auth.userId}`)) throw errors.rateLimited();
    const input = parse2(deletionSchema, ctx.body);
    const [user] = await deps.db.query(`SELECT password_hash FROM users WHERE id = $1`, [
      auth.userId
    ]);
    if (!user) throw errors.notFound();
    if (user.password_hash && !(input.password && await verifyPassword(input.password, user.password_hash))) {
      throw new HttpError(400, "INVALID_CURRENT_PASSWORD", "Senha incorreta.", { password: "Senha incorreta." });
    }
    try {
      await deps.db.query(`SELECT id FROM request_account_deletion($1, $2)`, [auth.userId, input.reason ?? null]);
    } catch (error) {
      throw translateDbError(error);
    }
    return {
      status: 200,
      body: {
        message: "Pedido de exclus\xE3o registrado. Sua conta foi encerrada e seus dados ser\xE3o eliminados em at\xE9 30 dias, exceto o que a lei obriga a guardar."
      }
    };
  });
}

// src/modules/recipients/routes.ts
import { z as z5 } from "zod";
var recipientFields = {
  fullName: z5.string().trim().min(2, "Informe o nome.").max(120),
  relationship: z5.enum(RELATIONSHIPS, { errorMap: () => ({ message: "Escolha o parentesco." }) }),
  assistanceNeeds: enumList(ASSISTANCE_NEEDS, "Tipo de assist\xEAncia desconhecido."),
  address: addressSchema
};
var createSchema = z5.object({
  fullName: recipientFields.fullName,
  relationship: recipientFields.relationship,
  assistanceNeeds: recipientFields.assistanceNeeds.default([]),
  address: recipientFields.address.optional()
}).strict();
var updateSchema = z5.object({
  fullName: recipientFields.fullName.optional(),
  relationship: recipientFields.relationship.optional(),
  assistanceNeeds: recipientFields.assistanceNeeds.optional(),
  address: recipientFields.address.optional()
}).strict();
var COLUMNS = {
  fullName: "full_name",
  relationship: "relationship",
  assistanceNeeds: "assistance_needs",
  "address.street": "address_street",
  "address.number": "address_number",
  "address.complement": "address_complement",
  "address.district": "address_district",
  "address.city": "address_city",
  "address.state": "address_state",
  "address.postalCode": "address_postal_code"
};
function flatten(input) {
  const entries = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === void 0) continue;
    if (key === "address" && value && typeof value === "object") {
      for (const [addressKey, addressValue] of Object.entries(value)) {
        if (addressValue !== void 0) entries.push([`address.${addressKey}`, addressValue]);
      }
    } else {
      entries.push([key, value]);
    }
  }
  return entries.filter(([key]) => key in COLUMNS);
}
function placeholder(index, value) {
  return `$${index}${Array.isArray(value) ? "::text[]" : ""}`;
}
function registerRecipientRoutes(router, deps) {
  router.add("GET", "/v1/me/care-recipients", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client"]);
    const rows = await deps.db.query(
      `SELECT * FROM care_recipients WHERE guardian_id = $1 ORDER BY created_at`,
      [auth.userId]
    );
    return { status: 200, body: { careRecipients: rows.map(toCareRecipient) } };
  });
  router.add("POST", "/v1/me/care-recipients", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client"]);
    const parsed = createSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    const entries = flatten(parsed.data);
    const columns = ["guardian_id", ...entries.map(([key]) => COLUMNS[key])];
    const values = [auth.userId, ...entries.map(([, value]) => value)];
    const placeholders = values.map((value, index) => placeholder(index + 1, value));
    try {
      const [row] = await deps.db.query(
        `INSERT INTO care_recipients (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
        values
      );
      if (!row) throw new Error("Inser\xE7\xE3o n\xE3o retornou o benefici\xE1rio");
      return { status: 201, body: { careRecipient: toCareRecipient(row) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("PATCH", "/v1/me/care-recipients/:id", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client"]);
    const parsed = updateSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    const entries = flatten(parsed.data);
    const sets = entries.map(([key, value], index) => `${COLUMNS[key]} = ${placeholder(index + 3, value)}`);
    const values = entries.map(([, value]) => value);
    try {
      const [row] = sets.length ? await deps.db.query(
        `UPDATE care_recipients SET ${sets.join(", ")} WHERE id = $1 AND guardian_id = $2 RETURNING *`,
        [ctx.params.id, auth.userId, ...values]
      ) : await deps.db.query(`SELECT * FROM care_recipients WHERE id = $1 AND guardian_id = $2`, [
        ctx.params.id,
        auth.userId
      ]);
      if (!row) throw errors.notFound();
      return { status: 200, body: { careRecipient: toCareRecipient(row) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("DELETE", "/v1/me/care-recipients/:id", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client"]);
    try {
      const [row] = await deps.db.query(
        `DELETE FROM care_recipients WHERE id = $1 AND guardian_id = $2 RETURNING id`,
        [ctx.params.id, auth.userId]
      );
      if (!row) throw errors.notFound();
      return { status: 204 };
    } catch (error) {
      throw translateDbError(error);
    }
  });
}

// src/security/rateLimit.ts
var RateLimiter = class {
  constructor(limit, windowMs, now = Date.now) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }
  limit;
  windowMs;
  now;
  hits = /* @__PURE__ */ new Map();
  /** Retorna false quando a chave estourou o limite na janela atual. */
  consume(key) {
    const now = this.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      this.sweep(now);
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }
  reset(key) {
    this.hits.delete(key);
  }
  sweep(now) {
    if (this.hits.size < 1e4) return;
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) this.hits.delete(key);
    }
  }
};

// src/storage/fileStorage.ts
var unavailableStorage = {
  available: false,
  async createUploadUrl() {
    throw new Error("Armazenamento de arquivos n\xE3o configurado");
  },
  async stat() {
    return null;
  },
  async createDownloadUrl() {
    throw new Error("Armazenamento de arquivos n\xE3o configurado");
  },
  async remove() {
  }
};
function createSupabaseStorage(options) {
  const base = `${options.projectUrl.replace(/\/+$/, "")}/storage/v1`;
  const doFetch = options.fetchImpl ?? fetch;
  const bucket = encodeURIComponent(options.bucket);
  const authHeaders = { apikey: options.secretKey };
  if (options.secretKey.startsWith("eyJ")) authHeaders.Authorization = `Bearer ${options.secretKey}`;
  const encodePath = (path) => path.split("/").map(encodeURIComponent).join("/");
  async function failIfNotOk(response, action) {
    if (response.ok) return;
    const text2 = await response.text().catch(() => "");
    throw new Error(`Storage: falha ao ${action} (HTTP ${response.status}) ${text2.slice(0, 200)}`);
  }
  return {
    available: true,
    async createUploadUrl(path, contentType) {
      const response = await doFetch(`${base}/object/upload/sign/${bucket}/${encodePath(path)}`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: "{}"
      });
      await failIfNotOk(response, "gerar link de envio");
      const data = await response.json();
      if (!data.url) throw new Error("Storage: resposta sem url de envio");
      return {
        url: `${base}${data.url}`,
        method: "PUT",
        headers: { "Content-Type": contentType, "x-upsert": "false" }
      };
    },
    async stat(path) {
      const response = await doFetch(`${base}/object/${bucket}/${encodePath(path)}`, {
        method: "HEAD",
        headers: authHeaders
      });
      if (response.status === 400 || response.status === 404) return null;
      await failIfNotOk(response, "consultar arquivo");
      return {
        size: Number(response.headers.get("content-length") ?? 0),
        contentType: response.headers.get("content-type")
      };
    },
    async createDownloadUrl(path, expiresInSeconds) {
      const response = await doFetch(`${base}/object/sign/${bucket}/${encodePath(path)}`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: expiresInSeconds })
      });
      await failIfNotOk(response, "gerar link de leitura");
      const data = await response.json();
      const signed = data.signedURL ?? data.signedUrl;
      if (!signed) throw new Error("Storage: resposta sem link de leitura");
      return signed.startsWith("http") ? signed : `${base}${signed}`;
    },
    async remove(path) {
      const response = await doFetch(`${base}/object/${bucket}`, {
        method: "DELETE",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [path] })
      });
      await failIfNotOk(response, "remover arquivo");
    }
  };
}

// src/security/google.ts
import { createPublicKey, verify as verifySignature } from "node:crypto";
var InvalidGoogleToken = class extends Error {
  constructor(reason) {
    super(`Token do Google inv\xE1lido: ${reason}`);
    this.name = "InvalidGoogleToken";
  }
};
var CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
var ISSUERS = ["accounts.google.com", "https://accounts.google.com"];
var CLOCK_SKEW_S = 60;
function decodeSegment(segment) {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}
var unavailableGoogle = {
  available: false,
  async verify() {
    throw new InvalidGoogleToken("login com Google n\xE3o configurado");
  }
};
function createGoogleVerifier(clientIds, options = {}) {
  if (!clientIds.length) return unavailableGoogle;
  const doFetch = options.fetch ?? ((url) => fetch(url));
  const now = options.now ?? (() => Date.now());
  let cache = null;
  async function keys(forceRefresh = false) {
    if (!forceRefresh && cache && cache.expiresAt > now()) return cache.keys;
    const response = await doFetch(CERTS_URL);
    if (!response.ok) throw new Error("N\xE3o foi poss\xEDvel obter as chaves do Google");
    const body = await response.json();
    const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "")?.[1] ?? 3600);
    cache = { keys: body.keys ?? [], expiresAt: now() + Math.min(maxAge, 86400) * 1e3 };
    return cache.keys;
  }
  return {
    available: true,
    async verify(idToken) {
      const parts = idToken.split(".");
      if (parts.length !== 3) throw new InvalidGoogleToken("formato");
      const [headerB64, payloadB64, signatureB64] = parts;
      let header;
      let payload;
      try {
        header = decodeSegment(headerB64);
        payload = decodeSegment(payloadB64);
      } catch {
        throw new InvalidGoogleToken("formato");
      }
      if (header.alg !== "RS256" || !header.kid) throw new InvalidGoogleToken("algoritmo");
      let key = (await keys()).find((item) => item.kid === header.kid);
      if (!key) key = (await keys(true)).find((item) => item.kid === header.kid);
      if (!key) throw new InvalidGoogleToken("chave desconhecida");
      const valid = verifySignature(
        "RSA-SHA256",
        Buffer.from(`${headerB64}.${payloadB64}`),
        // A chave JWK do Google é aceita diretamente pelo Node.
        createPublicKey({ key, format: "jwk" }),
        Buffer.from(signatureB64, "base64url")
      );
      if (!valid) throw new InvalidGoogleToken("assinatura");
      const nowS = now() / 1e3;
      if (!ISSUERS.includes(String(payload.iss))) throw new InvalidGoogleToken("emissor");
      const audiences = Array.isArray(payload.aud) ? payload.aud.map(String) : [String(payload.aud)];
      if (!audiences.some((aud) => clientIds.includes(aud))) throw new InvalidGoogleToken("destinat\xE1rio");
      if (typeof payload.exp !== "number" || payload.exp + CLOCK_SKEW_S < nowS) throw new InvalidGoogleToken("expirado");
      if (typeof payload.iat === "number" && payload.iat - CLOCK_SKEW_S > nowS) throw new InvalidGoogleToken("emitido no futuro");
      if (typeof payload.sub !== "string" || typeof payload.email !== "string") throw new InvalidGoogleToken("dados");
      return {
        sub: payload.sub,
        email: payload.email.toLowerCase(),
        emailVerified: payload.email_verified === true || payload.email_verified === "true",
        name: typeof payload.name === "string" ? payload.name : null
      };
    }
  };
}

// src/modules/documents/routes.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { z as z6 } from "zod";
var MAX_DOCUMENTS_PER_CAREGIVER = 30;
var DOWNLOAD_URL_TTL_SECONDS = 300;
var createSchema2 = z6.object({
  docType: z6.enum(DOCUMENT_TYPES, { errorMap: () => ({ message: "Tipo de documento desconhecido." }) }),
  contentType: z6.enum(DOCUMENT_CONTENT_TYPES, {
    errorMap: () => ({ message: "Envie PDF ou imagem (JPG, PNG, WEBP ou HEIC)." })
  }),
  sizeBytes: z6.number().int().min(1, "Arquivo vazio.").max(MAX_DOCUMENT_BYTES, "O arquivo pode ter no m\xE1ximo 10 MB.")
}).strict();
function storageUnavailable() {
  return new HttpError(
    503,
    "DOCUMENT_STORAGE_UNAVAILABLE",
    "O envio de documentos ainda n\xE3o est\xE1 dispon\xEDvel. Tente mais tarde ou fale com o suporte."
  );
}
async function loadProfileStatus(deps, userId) {
  const [row] = await deps.db.query(
    `SELECT verification_status FROM caregiver_profiles WHERE user_id = $1`,
    [userId]
  );
  if (!row) throw errors.notFound();
  return row.verification_status;
}
function underReview() {
  return new HttpError(
    409,
    "UNDER_REVIEW",
    "Seu perfil est\xE1 em an\xE1lise. Aguarde o resultado para alterar documentos."
  );
}
function registerDocumentRoutes(router, deps) {
  router.add("GET", "/v1/me/caregiver-documents", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["caregiver"]);
    const [profile] = await deps.db.query(
      `SELECT profession FROM caregiver_profiles WHERE user_id = $1`,
      [auth.userId]
    );
    const rows = await deps.db.query(
      `SELECT * FROM caregiver_documents WHERE caregiver_id = $1 AND status <> 'uploading' ORDER BY created_at DESC`,
      [auth.userId]
    );
    const [missing] = await deps.db.query(
      `SELECT caregiver_missing_documents($1) AS missing`,
      [auth.userId]
    );
    const profession = profile?.profession;
    return {
      status: 200,
      body: {
        documents: rows.map(toCaregiverDocument),
        requiredDocuments: profession ? PROFESSION_CATALOG[profession].requiredDocuments : [],
        missingDocuments: missing?.missing ?? [],
        uploadsAvailable: deps.storage.available
      }
    };
  });
  router.add("POST", "/v1/me/caregiver-documents", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["caregiver"]);
    const parsed = createSchema2.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    if (!deps.storage.available) throw storageUnavailable();
    if (await loadProfileStatus(deps, auth.userId) === "pending_review") throw underReview();
    const [count] = await deps.db.query(
      `SELECT count(*)::int AS total FROM caregiver_documents WHERE caregiver_id = $1`,
      [auth.userId]
    );
    if ((count?.total ?? 0) >= MAX_DOCUMENTS_PER_CAREGIVER) {
      throw new HttpError(409, "TOO_MANY_DOCUMENTS", "Limite de documentos atingido. Remova envios antigos ou fale com o suporte.");
    }
    const id = randomUUID2();
    const path = `caregivers/${auth.userId}/${id}.${extensionFor(parsed.data.contentType)}`;
    try {
      const [row] = await deps.db.query(
        `INSERT INTO caregiver_documents (id, caregiver_id, doc_type, storage_path, content_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, auth.userId, parsed.data.docType, path, parsed.data.contentType, parsed.data.sizeBytes]
      );
      if (!row) throw new Error("Inser\xE7\xE3o n\xE3o retornou o documento");
      const upload = await deps.storage.createUploadUrl(path, parsed.data.contentType);
      return { status: 201, body: { document: toCaregiverDocument(row), upload } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("POST", "/v1/me/caregiver-documents/:id/complete", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["caregiver"]);
    if (!deps.storage.available) throw storageUnavailable();
    let doc;
    try {
      [doc] = await deps.db.query(
        `SELECT * FROM caregiver_documents WHERE id = $1 AND caregiver_id = $2`,
        [ctx.params.id, auth.userId]
      );
    } catch (error) {
      throw translateDbError(error);
    }
    if (!doc) throw errors.notFound();
    if (doc.status !== "uploading") return { status: 200, body: { document: toCaregiverDocument(doc) } };
    const stored = await deps.storage.stat(String(doc.storage_path));
    if (!stored || stored.size <= 0) {
      throw new HttpError(409, "UPLOAD_NOT_FOUND", "O arquivo n\xE3o chegou. Tente enviar de novo.");
    }
    if (stored.size > MAX_DOCUMENT_BYTES) {
      await deps.storage.remove(String(doc.storage_path));
      await deps.db.query(`DELETE FROM caregiver_documents WHERE id = $1 RETURNING id`, [doc.id]);
      throw new HttpError(400, "FILE_TOO_LARGE", "O arquivo pode ter no m\xE1ximo 10 MB.");
    }
    const [updated] = await deps.db.query(
      `UPDATE caregiver_documents SET status = 'submitted', submitted_at = now(), size_bytes = $2
        WHERE id = $1 RETURNING *`,
      [doc.id, stored.size]
    );
    await deps.db.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
       VALUES ($1, 'caregiver.document_submitted', 'caregiver_document', $2, jsonb_build_object('docType', $3::text))
       RETURNING id`,
      [auth.userId, doc.id, doc.doc_type]
    );
    if (!updated) throw errors.notFound();
    return { status: 200, body: { document: toCaregiverDocument(updated) } };
  });
  router.add("DELETE", "/v1/me/caregiver-documents/:id", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["caregiver"]);
    if (await loadProfileStatus(deps, auth.userId) === "pending_review") throw underReview();
    let row;
    try {
      [row] = await deps.db.query(
        `DELETE FROM caregiver_documents
          WHERE id = $1 AND caregiver_id = $2 AND status IN ('uploading', 'submitted', 'rejected')
        RETURNING storage_path`,
        [ctx.params.id, auth.userId]
      );
    } catch (error) {
      throw translateDbError(error);
    }
    if (!row) throw errors.notFound();
    await deps.storage.remove(row.storage_path).catch((error) => {
      deps.log(`[storage] falha ao remover arquivo: ${error instanceof Error ? error.message : String(error)}`);
    });
    return { status: 204 };
  });
  router.add("GET", "/v1/admin/caregivers/:id", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["admin"]);
    let user;
    try {
      [user] = await deps.db.query(`SELECT * FROM users WHERE id = $1 AND role = 'caregiver'`, [ctx.params.id]);
    } catch (error) {
      throw translateDbError(error);
    }
    if (!user) throw errors.notFound();
    const [profile] = await deps.db.query(`SELECT * FROM caregiver_profiles WHERE user_id = $1`, [ctx.params.id]);
    const docs = await deps.db.query(
      `SELECT * FROM caregiver_documents WHERE caregiver_id = $1 AND status <> 'uploading' ORDER BY doc_type, created_at DESC`,
      [ctx.params.id]
    );
    const [missing] = await deps.db.query(
      `SELECT caregiver_missing_documents($1) AS missing`,
      [ctx.params.id]
    );
    const documents = await Promise.all(
      docs.map(async (doc) => ({
        ...toCaregiverDocument(doc),
        downloadUrl: deps.storage.available ? await deps.storage.createDownloadUrl(String(doc.storage_path), DOWNLOAD_URL_TTL_SECONDS) : null
      }))
    );
    await deps.db.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id) VALUES ($1, 'admin.caregiver_file_viewed', 'caregiver_profile', $2) RETURNING id`,
      [auth.userId, ctx.params.id]
    );
    return {
      status: 200,
      body: {
        user: toUser(user),
        caregiverProfile: profile ? { ...toCaregiverProfile(profile), missingDocuments: missing?.missing ?? [] } : null,
        documents
      }
    };
  });
}

// src/modules/messages/routes.ts
import { z as z7 } from "zod";
var bodySchema = z7.string().trim().min(1, "Escreva uma mensagem.").max(2e3, "A mensagem pode ter at\xE9 2000 caracteres.");
var openSupportSchema = z7.object({
  subject: z7.string().trim().min(3, "Informe o assunto.").max(120, "Assunto longo demais."),
  message: bodySchema
}).strict();
var sendSchema = z7.object({ body: bodySchema }).strict();
var statusSchema = z7.object({ status: z7.enum(["open", "closed"]) }).strict();
function iso2(value) {
  if (value === null || value === void 0) return null;
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}
function toConversation(row) {
  return {
    id: String(row.id),
    kind: String(row.kind),
    subject: row.subject === null ? null : String(row.subject),
    status: String(row.status),
    lastMessageAt: iso2(row.last_message_at),
    lastMessage: row.last_body === void 0 || row.last_body === null ? null : String(row.last_body),
    unreadCount: row.unread === void 0 ? 0 : Number(row.unread),
    createdAt: iso2(row.created_at)
  };
}
function toMessage(row, viewerId) {
  return {
    id: String(row.id),
    body: String(row.body),
    createdAt: iso2(row.created_at),
    mine: row.sender_id === viewerId,
    /** Mensagem da equipe do Cuidar Mais (aparece como "Suporte"). */
    fromSupport: row.participant_role === "support"
  };
}
async function loadConversationFor(deps, auth, conversationId) {
  let rows;
  try {
    rows = await deps.db.query(
      `SELECT c.*, p.participant_role AS my_role
         FROM conversations c
         LEFT JOIN conversation_participants p ON p.conversation_id = c.id AND p.user_id = $2
        WHERE c.id = $1`,
      [conversationId, auth.userId]
    );
  } catch (error) {
    throw translateDbError(error);
  }
  const conversation = rows[0];
  if (!conversation) throw errors.notFound();
  const isParticipant = conversation.my_role !== null && conversation.my_role !== void 0;
  const isSupportAdmin = auth.role === "admin" && conversation.kind === "support";
  if (!isParticipant && !isSupportAdmin) throw errors.notFound();
  return { conversation, isParticipant };
}
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function afterParam(ctx) {
  const value = new URL(ctx.req.url ?? "/", "http://localhost").searchParams.get("after");
  return value && UUID.test(value) ? value : null;
}
function registerMessageRoutes(router, deps) {
  router.add("GET", "/v1/conversations", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client", "caregiver"]);
    const rows = await deps.db.query(
      `SELECT c.*,
              (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
              (SELECT count(*)::int FROM messages m
                WHERE m.conversation_id = c.id
                  AND m.created_at > coalesce(p.last_read_at, '-infinity'::timestamptz)
                  AND m.sender_id IS DISTINCT FROM $1) AS unread
         FROM conversations c
         JOIN conversation_participants p ON p.conversation_id = c.id AND p.user_id = $1
        ORDER BY c.last_message_at DESC
        LIMIT 50`,
      [auth.userId]
    );
    return { status: 200, body: { conversations: rows.map(toConversation) } };
  });
  router.add("POST", "/v1/support/conversations", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client", "caregiver"]);
    const parsed = openSupportSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    if (!deps.limits.messages.consume(`msg:${auth.userId}`)) throw errors.rateLimited();
    try {
      const [row] = await deps.db.query(`SELECT * FROM open_support_conversation($1, $2, $3)`, [
        auth.userId,
        parsed.data.subject,
        parsed.data.message
      ]);
      if (!row) throw new Error("Chamado n\xE3o criado");
      return { status: 201, body: { conversation: toConversation({ ...row, last_body: parsed.data.message }) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("GET", "/v1/conversations/:id", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client", "caregiver", "admin"]);
    const { conversation, isParticipant } = await loadConversationFor(deps, auth, ctx.params.id ?? "");
    const after = afterParam(ctx);
    const rows = await deps.db.query(
      `SELECT * FROM (
         SELECT m.*, p.participant_role
           FROM messages m
           LEFT JOIN conversation_participants p ON p.conversation_id = m.conversation_id AND p.user_id = m.sender_id
          WHERE m.conversation_id = $1
            AND ($2::uuid IS NULL OR (m.created_at, m.id) > (
                  SELECT a.created_at, a.id FROM messages a WHERE a.id = $2::uuid AND a.conversation_id = $1))
          ORDER BY m.created_at DESC, m.id DESC
          LIMIT 200
       ) recent ORDER BY created_at, id`,
      [conversation.id, after]
    );
    if (isParticipant) {
      await deps.db.query(
        `UPDATE conversation_participants SET last_read_at = now() WHERE conversation_id = $1 AND user_id = $2 RETURNING user_id`,
        [conversation.id, auth.userId]
      );
    }
    return {
      status: 200,
      body: { conversation: toConversation(conversation), messages: rows.map((row) => toMessage(row, auth.userId)) }
    };
  });
  router.add("POST", "/v1/conversations/:id/messages", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client", "caregiver", "admin"]);
    const parsed = sendSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    if (!deps.limits.messages.consume(`msg:${auth.userId}`)) throw errors.rateLimited();
    const { conversation, isParticipant } = await loadConversationFor(deps, auth, ctx.params.id ?? "");
    if (conversation.status !== "open") {
      throw new HttpError(409, "CONVERSATION_CLOSED", "Esta conversa foi encerrada. Abra um novo chamado se precisar.");
    }
    try {
      const [row] = auth.role === "admin" ? await deps.db.query(`SELECT *, 'support'::text AS participant_role FROM support_reply($1, $2, $3)`, [
        auth.userId,
        conversation.id,
        parsed.data.body
      ]) : isParticipant ? await deps.db.query(
        `INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3)
                 RETURNING *, (SELECT participant_role FROM conversation_participants
                                WHERE conversation_id = $1 AND user_id = $2) AS participant_role`,
        [conversation.id, auth.userId, parsed.data.body]
      ) : [];
      if (!row) throw errors.notFound();
      return { status: 201, body: { message: toMessage(row, auth.userId) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("POST", "/v1/conversations/:id/status", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client", "caregiver", "admin"]);
    const parsed = statusSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    const { conversation } = await loadConversationFor(deps, auth, ctx.params.id ?? "");
    const isOwner = conversation.created_by === auth.userId;
    if (conversation.kind !== "support" || !(isOwner || auth.role === "admin")) throw errors.forbidden();
    if (parsed.data.status === "open" && auth.role !== "admin") throw errors.forbidden();
    const [row] = await deps.db.query(`UPDATE conversations SET status = $2 WHERE id = $1 RETURNING *`, [
      conversation.id,
      parsed.data.status
    ]);
    if (!row) throw errors.notFound();
    return { status: 200, body: { conversation: toConversation(row) } };
  });
  router.add("GET", "/v1/admin/support/conversations", async (ctx) => {
    await authenticate(deps, ctx, ["admin"]);
    const rows = await deps.db.query(
      `SELECT c.*, u.full_name AS opened_by_name, u.role AS opened_by_role,
              (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_body
         FROM conversations c JOIN users u ON u.id = c.created_by
        WHERE c.kind = 'support'
        ORDER BY (c.status = 'open') DESC, c.last_message_at DESC
        LIMIT 100`
    );
    return {
      status: 200,
      body: {
        conversations: rows.map((row) => ({
          ...toConversation(row),
          openedBy: { id: String(row.created_by), name: String(row.opened_by_name), role: String(row.opened_by_role) }
        }))
      }
    };
  });
}

// src/modules/caregivers/routes.ts
import { z as z8 } from "zod";
var searchSchema = z8.object({
  city: z8.string().trim().min(2, "Informe a cidade.").max(80),
  state: ufSchema,
  serviceType: z8.string().regex(CATEGORY_CODE, "Servi\xE7o desconhecido.").optional(),
  specialty: z8.enum(SPECIALTIES).optional(),
  availableNow: z8.enum(["true", "false"]).optional(),
  district: z8.string().trim().max(80).optional()
}).strict();
var VISIBLE = `
  c.verification_status = 'approved'
  AND u.status = 'active'
  AND u.deletion_requested_at IS NULL
  AND service_area_is_active(c.service_city, c.service_state)
  AND cardinality(caregiver_offered_categories(c.user_id)) > 0`;
var SELECT_CAREGIVER = `
  SELECT c.*, u.full_name, caregiver_is_available_now(c) AS available_now_effective,
         caregiver_offered_categories(c.user_id) AS offered_categories,
         EXISTS (SELECT 1 FROM client_favorites f WHERE f.client_id = $1 AND f.caregiver_id = c.user_id) AS favorite
    FROM caregiver_profiles c
    JOIN users u ON u.id = c.user_id`;
async function ratesFor(deps, ids) {
  const map = /* @__PURE__ */ new Map();
  if (!ids.length) return map;
  const rows = await deps.db.query(
    `SELECT r.caregiver_id, r.service_type, r.hourly_rate_cents
       FROM caregiver_service_rates r
       JOIN caregiver_profiles c ON c.user_id = r.caregiver_id
      WHERE r.caregiver_id::text = ANY ($1::text[])
        AND r.service_type = ANY (caregiver_offered_categories(c.user_id))
      ORDER BY r.service_type`,
    [ids]
  );
  for (const row of rows) {
    const id = String(row.caregiver_id);
    map.set(id, [...map.get(id) ?? [], toRate(row)]);
  }
  return map;
}
async function toPublicList(deps, rows) {
  const rates = await ratesFor(deps, rows.map((row) => String(row.user_id)));
  return rows.map((row) => toPublicCaregiver(row, rates.get(String(row.user_id)) ?? [], Boolean(row.favorite)));
}
var UUID2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function findVisible(deps, clientId, caregiverId) {
  if (!UUID2.test(caregiverId)) return null;
  const [row] = await deps.db.query(`${SELECT_CAREGIVER} WHERE c.user_id = $2 AND ${VISIBLE}`, [
    clientId,
    caregiverId
  ]);
  return row ?? null;
}
function registerCaregiverSearchRoutes(router, deps) {
  router.add("GET", "/v1/caregivers", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client"]);
    const query = Object.fromEntries(new URL(ctx.req.url ?? "/", "http://localhost").searchParams);
    const parsed = searchSchema.safeParse(query);
    if (!parsed.success) throw validationError(parsed.error);
    const input = parsed.data;
    const [area] = await deps.db.query(`SELECT service_area_is_active($1, $2) AS active`, [
      input.city,
      input.state
    ]);
    if (!area?.active) {
      throw new HttpError(409, "SERVICE_AREA_UNAVAILABLE", "O Cuidar+ ainda n\xE3o atende esta cidade. Estamos come\xE7ando aos poucos, com seguran\xE7a.");
    }
    try {
      const rows = await deps.db.query(
        `${SELECT_CAREGIVER}
          WHERE ${VISIBLE}
            AND normalize_city(c.service_city) = normalize_city($2) AND c.service_state = $3
            AND ($4::text IS NULL OR $4::text = ANY (caregiver_offered_categories(c.user_id)))
            AND ($5::text IS NULL OR $5::text = ANY (c.specialties))
            AND (NOT $6::boolean OR caregiver_is_available_now(c))
          ORDER BY caregiver_is_available_now(c) DESC,
                   ($7::text <> '' AND normalize_city(c.service_district) = normalize_city($7::text)) DESC,
                   c.experience_years DESC NULLS LAST,
                   c.reviewed_at
          LIMIT 50`,
        [
          auth.userId,
          input.city,
          input.state,
          input.serviceType ?? null,
          input.specialty ?? null,
          input.availableNow === "true",
          input.district ?? ""
        ]
      );
      return { status: 200, body: { caregivers: await toPublicList(deps, rows) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
  router.add("GET", "/v1/caregivers/:id", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client"]);
    const row = await findVisible(deps, auth.userId, ctx.params.id ?? "");
    if (!row) throw errors.notFound();
    const [caregiver] = await toPublicList(deps, [row]);
    return { status: 200, body: { caregiver } };
  });
  router.add("GET", "/v1/favorites", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client"]);
    const rows = await deps.db.query(
      `${SELECT_CAREGIVER}
         JOIN client_favorites fav ON fav.caregiver_id = c.user_id AND fav.client_id = $1
        WHERE ${VISIBLE}
        ORDER BY fav.created_at DESC`,
      [auth.userId]
    );
    return { status: 200, body: { caregivers: await toPublicList(deps, rows) } };
  });
  router.add("POST", "/v1/favorites/:id", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client"]);
    const row = await findVisible(deps, auth.userId, ctx.params.id ?? "");
    if (!row) throw errors.notFound();
    try {
      await deps.db.query(
        `INSERT INTO client_favorites (client_id, caregiver_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING client_id`,
        [auth.userId, ctx.params.id]
      );
    } catch (error) {
      throw translateDbError(error);
    }
    return { status: 200, body: { favorite: true } };
  });
  router.add("DELETE", "/v1/favorites/:id", async (ctx) => {
    const auth = await authenticate(deps, ctx, ["client"]);
    if (!UUID2.test(ctx.params.id ?? "")) throw errors.notFound();
    await deps.db.query(`DELETE FROM client_favorites WHERE client_id = $1 AND caregiver_id = $2 RETURNING client_id`, [
      auth.userId,
      ctx.params.id
    ]);
    return { status: 200, body: { favorite: false } };
  });
}

// src/app.ts
function createApp(options) {
  const log = options.log ?? ((message) => console.log(message));
  const deps = {
    db: options.db,
    config: options.config,
    mailer: options.mailer,
    storage: options.storage ?? unavailableStorage,
    google: options.google ?? createGoogleVerifier(options.config.googleClientIds),
    log,
    limits: {
      login: new RateLimiter(10, 15 * 6e4),
      register: new RateLimiter(10, 60 * 6e4),
      forgot: new RateLimiter(5, 60 * 6e4),
      reset: new RateLimiter(10, 15 * 6e4),
      messages: new RateLimiter(30, 6e4),
      account: new RateLimiter(10, 15 * 6e4),
      ...options.limits
    }
  };
  const router = new Router();
  router.add("GET", "/v1/health", async () => {
    await deps.db.query("SELECT 1 AS ok");
    return { status: 200, body: { status: "ok" } };
  });
  registerCatalogRoutes(router, deps);
  registerAreaRoutes(router, deps);
  registerAuthRoutes(router, deps);
  registerMeRoutes(router, deps);
  registerRecipientRoutes(router, deps);
  registerDocumentRoutes(router, deps);
  registerMessageRoutes(router, deps);
  registerCaregiverSearchRoutes(router, deps);
  registerAdminRoutes(router, deps);
  return async function handle(req, res) {
    const started = Date.now();
    const url = new URL(req.url ?? "/", "http://localhost");
    applyCors(req, res, options.config.corsOrigins);
    try {
      if (req.method === "OPTIONS") {
        sendJson(res, 204);
        return;
      }
      const found = router.match(req.method ?? "GET", url.pathname);
      if (found === null) throw new HttpError(404, "NOT_FOUND", "Endere\xE7o n\xE3o encontrado.");
      if (found === "method") throw new HttpError(405, "METHOD_NOT_ALLOWED", "M\xE9todo n\xE3o permitido.");
      const result = await found.handler({
        req,
        params: found.params,
        body: await readJsonBody(req),
        ip: req.socket.remoteAddress ?? "desconhecido",
        bearerToken: getBearerToken(req)
      });
      sendJson(res, result.status, result.body);
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.status, { code: error.code, message: error.message, fieldErrors: error.fieldErrors });
      } else {
        console.error(`[erro] ${req.method} ${url.pathname}:`, error);
        sendJson(res, 500, { code: "SERVER_ERROR", message: "Tivemos um problema no servidor. Tente novamente em instantes." });
      }
    } finally {
      if (options.config.env !== "test") {
        log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
      }
    }
  };
}
function applyCors(req, res, allowed) {
  const origin = req.headers.origin;
  if (!origin || !allowed.includes(origin)) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  res.setHeader("Access-Control-Max-Age", "600");
}

// src/config.ts
import { z as z9 } from "zod";
var schemaName = z9.string().regex(/^[a-z_][a-z0-9_]{0,62}$/, "Use letras min\xFAsculas, n\xFAmeros e _");
var configSchema = z9.object({
  NODE_ENV: z9.enum(["development", "test", "production"]).default("development"),
  HOST: z9.string().default("0.0.0.0"),
  PORT: z9.coerce.number().int().min(1).max(65535).default(3333),
  DATABASE_URL: z9.string().url("DATABASE_URL precisa ser uma URL postgresql://"),
  DATABASE_SCHEMA: schemaName.default("app"),
  DATABASE_SSL: z9.enum(["disable", "require", "verify"]).default("require"),
  DATABASE_CA_CERT: z9.string().optional(),
  ACCESS_TOKEN_TTL_MINUTES: z9.coerce.number().int().min(1).max(60).default(15),
  REFRESH_TOKEN_TTL_DAYS: z9.coerce.number().int().min(1).max(90).default(30),
  TERMS_VERSION: z9.string().min(1).default("2026-10-rascunho"),
  CORS_ORIGINS: z9.string().default(""),
  MAIL_TRANSPORT: z9.enum(["console", "none"]).default("none"),
  SUPABASE_URL: z9.string().url("SUPABASE_URL precisa ser https://<projeto>.supabase.co").optional(),
  SUPABASE_SECRET_KEY: z9.string().min(20).optional(),
  STORAGE_BUCKET: z9.string().regex(/^[a-z0-9-]{3,63}$/).default("caregiver-documents"),
  /** Client IDs OAuth do Google aceitos (web, Android, iOS), separados por vírgula. Vazio = login Google desligado. */
  GOOGLE_CLIENT_IDS: z9.string().default("")
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === "production" && value.MAIL_TRANSPORT === "console") {
    ctx.addIssue({
      code: z9.ZodIssueCode.custom,
      path: ["MAIL_TRANSPORT"],
      message: "MAIL_TRANSPORT=console exp\xF5e c\xF3digos de recupera\xE7\xE3o no log e \xE9 proibido em produ\xE7\xE3o"
    });
  }
  if (value.NODE_ENV === "production" && value.DATABASE_SSL === "disable") {
    ctx.addIssue({
      code: z9.ZodIssueCode.custom,
      path: ["DATABASE_SSL"],
      message: "Conex\xE3o sem criptografia n\xE3o \xE9 permitida em produ\xE7\xE3o"
    });
  }
  if (value.DATABASE_SSL === "verify" && !value.DATABASE_CA_CERT) {
    ctx.addIssue({
      code: z9.ZodIssueCode.custom,
      path: ["DATABASE_CA_CERT"],
      message: "DATABASE_SSL=verify exige o caminho do certificado em DATABASE_CA_CERT"
    });
  }
});
var OPTIONAL_KEYS = /* @__PURE__ */ new Set(["SUPABASE_URL", "SUPABASE_SECRET_KEY", "DATABASE_CA_CERT"]);
function loadConfig(env = process.env) {
  const cleaned = Object.fromEntries(
    Object.entries(env).filter(([key, value]) => !(OPTIONAL_KEYS.has(key) && (value ?? "").trim() === ""))
  );
  const parsed = configSchema.safeParse(cleaned);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Configura\xE7\xE3o inv\xE1lida:
${details.join("\n")}`);
  }
  const c = parsed.data;
  return {
    env: c.NODE_ENV,
    host: c.HOST,
    port: c.PORT,
    database: {
      url: c.DATABASE_URL,
      schema: c.DATABASE_SCHEMA,
      ssl: c.DATABASE_SSL,
      caCertPath: c.DATABASE_CA_CERT
    },
    accessTokenTtlMs: c.ACCESS_TOKEN_TTL_MINUTES * 6e4,
    refreshTokenTtlMs: c.REFRESH_TOKEN_TTL_DAYS * 864e5,
    termsVersion: c.TERMS_VERSION,
    corsOrigins: c.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    mailTransport: c.MAIL_TRANSPORT,
    storage: c.SUPABASE_URL && c.SUPABASE_SECRET_KEY ? { projectUrl: c.SUPABASE_URL, secretKey: c.SUPABASE_SECRET_KEY, bucket: c.STORAGE_BUCKET } : null,
    googleClientIds: c.GOOGLE_CLIENT_IDS.split(",").map((id) => id.trim()).filter(Boolean)
  };
}

// src/db/pg.ts
import { readFileSync } from "node:fs";
import pg from "pg";

// src/db/ident.ts
function quoteIdent(name) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) {
    throw new Error(`Nome de schema inv\xE1lido: ${name}`);
  }
  return `"${name}"`;
}

// src/db/pg.ts
function createPgDb(options) {
  const ssl = options.ssl === "disable" ? false : options.ssl === "verify" ? { rejectUnauthorized: true, ca: readFileSync(options.caCertPath ?? "", "utf8") } : { rejectUnauthorized: false };
  const pool = new pg.Pool({
    connectionString: stripSslParams(options.url),
    ssl,
    max: 10,
    idleTimeoutMillis: 3e4,
    connectionTimeoutMillis: 1e4
  });
  const schema = quoteIdent(options.schema);
  pool.on("connect", (client) => {
    client.query(`SET search_path TO ${schema}, public`).catch(() => {
    });
  });
  pool.on("error", (error) => {
    console.error("[db] erro em conex\xE3o ociosa:", error.message);
  });
  return {
    async query(sql, params = []) {
      const result = await pool.query(sql, params);
      return result.rows;
    },
    async exec(sql) {
      await pool.query(sql);
    },
    close: () => pool.end()
  };
}
function stripSslParams(url) {
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  parsed.searchParams.delete("sslrootcert");
  return parsed.toString();
}

// src/mail/mailer.ts
var unavailableMailer = {
  available: false,
  async send() {
    throw new Error("Nenhum provedor de e-mail configurado");
  }
};

// src/vercel.ts
var handler = null;
function vercelHandler(req, res) {
  if (!handler) {
    const config = loadConfig();
    const db = createPgDb(config.database);
    const storage = config.storage ? createSupabaseStorage(config.storage) : unavailableStorage;
    handler = createApp({ db, config, mailer: unavailableMailer, storage });
  }
  return handler(req, res);
}
export {
  vercelHandler as default
};
