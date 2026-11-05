import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { runMigrations } from '../src/db/migrate.ts';
import type { Db, DbOptions } from '../src/db/types.ts';
import type { MailMessage, Mailer } from '../src/mail/mailer.ts';
import { RateLimiter } from '../src/security/rateLimit.ts';
import type { FileStorage } from '../src/storage/fileStorage.ts';
import type { GoogleIdentity, GoogleVerifier } from '../src/security/google.ts';

/**
 * Sobe o backend de verdade contra um PostgreSQL de verdade, num schema
 * temporário (test_xxxxxxxx) que é apagado no final.
 *
 * Requer TEST_DATABASE_URL (arquivo .env.test). TEST_DB_MODULE permite trocar
 * o driver do banco (padrão: node-postgres em src/db/pg.ts).
 */

type DbFactory = { createPgDb: (options: DbOptions) => Db };

export type ApiResponse = { status: number; body: any };

export type TestApp = {
  db: Db;
  schema: string;
  baseUrl: string;
  mails: MailMessage[];
  storage: MemoryStorage;
  google: FakeGoogle;
  call: (method: string, path: string, options?: { token?: string; body?: unknown }) => Promise<ApiResponse>;
  stop: () => Promise<void>;
};

export async function startTestApp(options: { strictLimits?: boolean } = {}): Promise<TestApp> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('Defina TEST_DATABASE_URL (copie .env.test.example para .env.test).');
  }

  const schema = `test_${randomBytes(4).toString('hex')}`;
  const factory = (await import(process.env.TEST_DB_MODULE ?? '../src/db/pg.ts')) as DbFactory;
  const ssl = (process.env.TEST_DATABASE_SSL ?? 'require') as DbOptions['ssl'];
  const db = factory.createPgDb({ url, schema, ssl });
  await runMigrations(db, schema);

  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DATABASE_SCHEMA: schema,
    DATABASE_SSL: ssl,
    MAIL_TRANSPORT: 'console',
    TERMS_VERSION: 'teste',
  });

  const mails: MailMessage[] = [];
  const mailer: Mailer = { available: true, send: async (message) => void mails.push(message) };

  const generous = () => new RateLimiter(10_000, 60_000);
  const storage = createMemoryStorage();
  const google = createFakeGoogle();
  const handler = createApp({
    db,
    config,
    mailer,
    storage,
    google,
    log: () => {},
    limits: options.strictLimits
      ? undefined
      : { login: generous(), register: generous(), forgot: generous(), reset: generous(), messages: generous(), account: generous() },
  });

  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
    const headers: Record<string, string> = {};
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : undefined };
  }

  return {
    db,
    schema,
    baseUrl: base,
    mails,
    storage,
    google,
    call,
    async stop() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.exec(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.close();
    },
  };
}

let counter = 0;
export function uniqueEmail(prefix = 'pessoa'): string {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@exemplo.com`;
}

export const VALID_PASSWORD = 'senhaForte123';

export function clientPayload(overrides: Record<string, unknown> = {}) {
  return {
    role: 'client',
    fullName: 'Maria da Silva',
    email: uniqueEmail('cliente'),
    phone: '(11) 91234-5678',
    password: VALID_PASSWORD,
    acceptTerms: true,
    ...overrides,
  };
}

export function caregiverPayload(overrides: Record<string, unknown> = {}) {
  return { ...clientPayload(overrides), role: 'caregiver', email: overrides.email ?? uniqueEmail('cuidador') };
}

/** CPF válido e diferente a cada chamada (dígitos verificadores calculados). */
let cpfSeed = Math.floor(Math.random() * 100_000_000);
export function randomCpf(): string {
  cpfSeed = (cpfSeed + 7919) % 1_000_000_000;
  const base = String(cpfSeed).padStart(9, '0').split('').map(Number);
  if (base.every((d) => d === base[0])) base[8] = (base[8]! + 1) % 10;
  const check = (digits: number[]) => {
    const total = digits.reduce((sum, d, i) => sum + d * (digits.length + 1 - i), 0);
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = check(base);
  const d2 = check([...base, d1]);
  return [...base, d1, d2].join('');
}

export function completeCaregiverProfile(overrides: Record<string, unknown> = {}) {
  return {
    profession: 'caregiver',
    cpf: randomCpf(),
    bio: 'Técnica de enfermagem com experiência em cuidado de idosos acamados.',
    experienceYears: 6,
    specialties: ['elderly', 'post_surgery'],
    serviceCity: 'Recife',
    serviceState: 'PE',
    serviceDistrict: 'Boa Viagem',
    categories: ['companionship'],
    serviceRadiusKm: 15,
    availabilityDays: ['mon', 'tue', 'wed'],
    availabilityPeriods: ['morning', 'afternoon'],
    ...overrides,
  };
}

export const REQUIRED_DOCS = {
  caregiver: ['identity', 'criminal_record', 'proof_of_address', 'course_certificate'],
  nurse: ['identity', 'criminal_record', 'proof_of_address', 'council_card'],
  physiotherapist: ['identity', 'criminal_record', 'proof_of_address', 'council_card'],
} as const;

/** Envia um documento pelo fluxo real: pede o link, "sobe" o arquivo e conclui. */
export async function uploadDocument(app: TestApp, token: string, docType: string, sizeBytes = 2048) {
  const created = await app.call('POST', '/v1/me/caregiver-documents', {
    token,
    body: { docType, contentType: 'application/pdf', sizeBytes },
  });
  if (created.status !== 201) throw new Error(`Falha ao criar documento: ${JSON.stringify(created.body)}`);
  app.storage.simulateUpload(created.body.upload.url, sizeBytes);
  const done = await app.call('POST', `/v1/me/caregiver-documents/${created.body.document.id}/complete`, { token });
  if (done.status !== 200) throw new Error(`Falha ao concluir documento: ${JSON.stringify(done.body)}`);
  return done.body.document as { id: string; status: string };
}

/** Um valor válido (faixa provisória de Recife: R$ 20–45/h) para a categoria padrão do perfil. */
export const DEFAULT_RATE = {
  caregiver: { serviceType: 'companionship', hourlyRateCents: 3000 },
  nurse: { serviceType: 'companionship', hourlyRateCents: 3500 },
  physiotherapist: { serviceType: 'companionship', hourlyRateCents: 4000 },
} as const;

export async function setDefaultRates(app: TestApp, token: string, profession: keyof typeof REQUIRED_DOCS) {
  const response = await app.call('POST', '/v1/me/caregiver-profile/rates', {
    token,
    body: { rates: [DEFAULT_RATE[profession]] },
  });
  if (response.status !== 200) throw new Error(`Valores não salvos: ${JSON.stringify(response.body)}`);
  return response.body;
}

/** Cuidador aprovado por um admin (aparece na busca). */
export async function approvedCaregiver(app: TestApp, admin: { accessToken: string }, profession: keyof typeof REQUIRED_DOCS = 'caregiver') {
  const caregiver = await caregiverInReview(app, profession);
  const approved = await app.call('POST', `/v1/admin/caregivers/${caregiver.user.id}/verification`, {
    token: admin.accessToken,
    body: { status: 'approved' },
  });
  if (approved.status !== 200) throw new Error(`Aprovação falhou: ${JSON.stringify(approved.body)}`);
  return caregiver;
}

/** Cuidador com perfil completo, documentos enviados e perfil enviado para análise. */
export async function caregiverInReview(app: TestApp, profession: keyof typeof REQUIRED_DOCS = 'caregiver') {
  const caregiver = await register(app, caregiverPayload());
  const extra = profession === 'caregiver' ? {} : { councilNumber: '123456', councilState: 'PE' };
  const saved = await app.call('PATCH', '/v1/me/caregiver-profile', {
    token: caregiver.accessToken,
    body: completeCaregiverProfile({ profession, ...extra }),
  });
  if (saved.status !== 200) throw new Error(`Perfil não salvo: ${JSON.stringify(saved.body)}`);
  await setDefaultRates(app, caregiver.accessToken, profession);
  for (const docType of REQUIRED_DOCS[profession]) await uploadDocument(app, caregiver.accessToken, docType);
  const submitted = await app.call('POST', '/v1/me/caregiver-profile/submit', { token: caregiver.accessToken });
  if (submitted.status !== 200) throw new Error(`Envio falhou: ${JSON.stringify(submitted.body)}`);
  return caregiver;
}

export type MemoryStorage = FileStorage & {
  files: Map<string, { size: number }>;
  simulateUpload: (uploadUrl: string, size: number) => void;
};

/** Armazenamento em memória para os testes (o real é o Supabase Storage). */
export function createMemoryStorage(): MemoryStorage {
  const files = new Map<string, { size: number }>();
  return {
    available: true,
    files,
    async createUploadUrl(path, contentType) {
      return { url: `memory://upload/${path}`, method: 'PUT', headers: { 'Content-Type': contentType } };
    },
    async stat(path) {
      const file = files.get(path);
      return file ? { size: file.size, contentType: 'application/pdf' } : null;
    },
    async createDownloadUrl(path, expiresIn) {
      return `memory://download/${path}?expiresIn=${expiresIn}`;
    },
    async remove(path) {
      files.delete(path);
    },
    simulateUpload(uploadUrl, size) {
      files.set(uploadUrl.replace('memory://upload/', ''), { size });
    },
  };
}

export async function register(app: TestApp, payload: Record<string, unknown>) {
  const response = await app.call('POST', '/v1/auth/register', { body: payload });
  if (response.status !== 201) {
    throw new Error(`Cadastro falhou: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body as { accessToken: string; refreshToken: string; user: { id: string; email: string } };
}

/** Cria um admin pelo caminho real: cadastro comum + função usada pelo script admin:grant. */
export async function createAdmin(app: TestApp) {
  const payload = clientPayload({ email: uniqueEmail('admin') });
  await register(app, payload);
  await app.db.query(`SELECT * FROM grant_admin_by_email($1)`, [payload.email]);
  const login = await app.call('POST', '/v1/auth/login', {
    body: { email: payload.email, password: VALID_PASSWORD },
  });
  return login.body as { accessToken: string; user: { id: string } };
}

export type FakeGoogle = GoogleVerifier & {
  /** Gera um "token" aceito pelo verificador falso para esta identidade. */
  issue: (identity: Partial<GoogleIdentity> & { sub: string; email: string }) => string;
};

/** Google falso para os testes de rota (a verificação real tem testes próprios). */
export function createFakeGoogle(): FakeGoogle {
  const tokens = new Map<string, GoogleIdentity>();
  return {
    available: true,
    issue(identity) {
      const token = `fake.${'x'.repeat(120)}.${tokens.size}.${identity.sub}`;
      tokens.set(token, { emailVerified: true, name: null, ...identity });
      return token;
    },
    async verify(idToken) {
      const identity = tokens.get(idToken);
      if (!identity) throw new Error('token desconhecido');
      return identity;
    },
  };
}
