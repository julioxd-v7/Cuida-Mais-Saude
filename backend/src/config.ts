import { z } from 'zod';

/**
 * Configuração do backend, lida das variáveis de ambiente e validada na
 * inicialização. Se algo estiver errado, o servidor nem sobe — melhor do
 * que falhar no meio de uma requisição.
 */

const schemaName = z
  .string()
  .regex(/^[a-z_][a-z0-9_]{0,62}$/, 'Use letras minúsculas, números e _');

const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3333),
    DATABASE_URL: z.string().url('DATABASE_URL precisa ser uma URL postgresql://'),
    DATABASE_SCHEMA: schemaName.default('app'),
    DATABASE_SSL: z.enum(['disable', 'require', 'verify']).default('require'),
    DATABASE_CA_CERT: z.string().optional(),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    TERMS_VERSION: z.string().min(1).default('2026-10-rascunho'),
    CORS_ORIGINS: z.string().default(''),
    MAIL_TRANSPORT: z.enum(['console', 'none']).default('none'),
    SUPABASE_URL: z.string().url('SUPABASE_URL precisa ser https://<projeto>.supabase.co').optional(),
    SUPABASE_SECRET_KEY: z.string().min(20).optional(),
    STORAGE_BUCKET: z.string().regex(/^[a-z0-9-]{3,63}$/).default('caregiver-documents'),
    /** Client IDs OAuth do Google aceitos (web, Android, iOS), separados por vírgula. Vazio = login Google desligado. */
    GOOGLE_CLIENT_IDS: z.string().default(''),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && value.MAIL_TRANSPORT === 'console') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MAIL_TRANSPORT'],
        message: 'MAIL_TRANSPORT=console expõe códigos de recuperação no log e é proibido em produção',
      });
    }
    if (value.NODE_ENV === 'production' && value.DATABASE_SSL === 'disable') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_SSL'],
        message: 'Conexão sem criptografia não é permitida em produção',
      });
    }
    if (value.DATABASE_SSL === 'verify' && !value.DATABASE_CA_CERT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_CA_CERT'],
        message: 'DATABASE_SSL=verify exige o caminho do certificado em DATABASE_CA_CERT',
      });
    }
  });

export type RawConfig = z.infer<typeof configSchema>;

export type AppConfig = {
  env: RawConfig['NODE_ENV'];
  host: string;
  port: number;
  database: {
    url: string;
    schema: string;
    ssl: RawConfig['DATABASE_SSL'];
    caCertPath?: string;
  };
  accessTokenTtlMs: number;
  refreshTokenTtlMs: number;
  termsVersion: string;
  corsOrigins: string[];
  mailTransport: RawConfig['MAIL_TRANSPORT'];
  /** null = upload de documentos indisponível (falta configurar o Supabase Storage). */
  storage: { projectUrl: string; secretKey: string; bucket: string } | null;
  /** Client IDs do Google aceitos no login (vazio = desligado). */
  googleClientIds: string[];
};

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Configuração inválida:\n${details.join('\n')}`);
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
      caCertPath: c.DATABASE_CA_CERT,
    },
    accessTokenTtlMs: c.ACCESS_TOKEN_TTL_MINUTES * 60_000,
    refreshTokenTtlMs: c.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
    termsVersion: c.TERMS_VERSION,
    corsOrigins: c.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
    mailTransport: c.MAIL_TRANSPORT,
    storage:
      c.SUPABASE_URL && c.SUPABASE_SECRET_KEY
        ? { projectUrl: c.SUPABASE_URL, secretKey: c.SUPABASE_SECRET_KEY, bucket: c.STORAGE_BUCKET }
        : null,
    googleClientIds: c.GOOGLE_CLIENT_IDS.split(',').map((id) => id.trim()).filter(Boolean),
  };
}
