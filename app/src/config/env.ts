/**
 * Configuração de ambiente do app.
 *
 * ATENÇÃO: tudo o que começa com EXPO_PUBLIC_ é embutido no aplicativo e pode
 * ser lido por qualquer pessoa que baixar o app. Aqui só entram valores
 * públicos (URL da API, nome do ambiente). Chaves privadas, tokens de
 * provedores e credenciais ficam exclusivamente no backend.
 *
 * As variáveis precisam ser lidas como `process.env.EXPO_PUBLIC_NOME`
 * (acesso literal) para o Expo conseguir substituí-las no build.
 */

export type AppEnvironment = 'development' | 'staging' | 'production';

export function parseAppEnvironment(value: string | undefined): AppEnvironment {
  if (value === 'staging' || value === 'production') return value;
  return 'development';
}

/**
 * Valida a URL da API. Retorna null quando ausente ou inválida — o app
 * continua abrindo e as funções que dependem do servidor avisam o usuário.
 * Em produção, só https é aceito.
 */
export function parseApiUrl(value: string | undefined, environment: AppEnvironment): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const match = /^(https?):\/\/[^\s/$.?#][^\s]*$/i.exec(trimmed);
  if (!match) return null;
  if (environment === 'production' && match[1].toLowerCase() !== 'https') return null;

  return trimmed.replace(/\/+$/, '');
}

/**
 * WhatsApp do suporte (opcional, público): só dígitos com DDI 55 + DDD.
 * Sem número válido, o app não mostra o botão de WhatsApp.
 */
export function parseWhatsappNumber(value: string | undefined): string | null {
  const digits = value?.replace(/\D/g, '') ?? '';
  return /^55[1-9]{2}\d{8,9}$/.test(digits) ? digits : null;
}

/** Client ID OAuth do Google: "<números>-<texto>.apps.googleusercontent.com". */
export function parseGoogleClientId(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(trimmed) ? trimmed : null;
}

const appEnvironment = parseAppEnvironment(process.env.EXPO_PUBLIC_APP_ENV);

export const env = {
  appEnvironment,
  apiUrl: parseApiUrl(process.env.EXPO_PUBLIC_API_URL, appEnvironment),
  apiTimeoutMs: 15_000,
  supportWhatsapp: parseWhatsappNumber(process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP),
  /**
   * Login com Google (públicos por natureza: identificam o app, não dão acesso).
   * Sem o client ID "Web", o botão do Google não aparece.
   */
  googleWebClientId: parseGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  googleIosClientId: parseGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
} as const;
