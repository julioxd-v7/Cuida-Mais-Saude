/**
 * Armazenamento de arquivos privados (documentos de verificação).
 *
 * O app NUNCA recebe credenciais do armazenamento: o backend gera um link de
 * envio de uso único (válido por pouco tempo) e, para o admin, links de
 * leitura que expiram em minutos. O bucket é privado.
 */
export type UploadTarget = {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
};

export type StoredFile = { size: number; contentType: string | null };

export interface FileStorage {
  readonly available: boolean;
  createUploadUrl(path: string, contentType: string): Promise<UploadTarget>;
  stat(path: string): Promise<StoredFile | null>;
  createDownloadUrl(path: string, expiresInSeconds: number): Promise<string>;
  remove(path: string): Promise<void>;
}

export const unavailableStorage: FileStorage = {
  available: false,
  async createUploadUrl() {
    throw new Error('Armazenamento de arquivos não configurado');
  },
  async stat() {
    return null;
  },
  async createDownloadUrl() {
    throw new Error('Armazenamento de arquivos não configurado');
  },
  async remove() {},
};

export type SupabaseStorageOptions = {
  /** https://<projeto>.supabase.co */
  projectUrl: string;
  /** Chave secreta (sb_secret_… ou service_role). Só no backend. */
  secretKey: string;
  bucket: string;
  fetchImpl?: typeof fetch;
};

/**
 * Supabase Storage pela API REST (sem SDK). Rotas usadas:
 *   POST   /storage/v1/object/upload/sign/{bucket}/{path}  → link de envio
 *   HEAD   /storage/v1/object/{bucket}/{path}              → confere se o arquivo chegou
 *   POST   /storage/v1/object/sign/{bucket}/{path}         → link de leitura temporário
 *   DELETE /storage/v1/object/{bucket}                     → remove
 */
export function createSupabaseStorage(options: SupabaseStorageOptions): FileStorage {
  const base = `${options.projectUrl.replace(/\/+$/, '')}/storage/v1`;
  const doFetch = options.fetchImpl ?? fetch;
  const bucket = encodeURIComponent(options.bucket);

  // Chaves novas (sb_secret_…) vão só no "apikey"; as antigas (JWT) também no Authorization.
  const authHeaders: Record<string, string> = { apikey: options.secretKey };
  if (options.secretKey.startsWith('eyJ')) authHeaders.Authorization = `Bearer ${options.secretKey}`;

  const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

  async function failIfNotOk(response: Response, action: string): Promise<void> {
    if (response.ok) return;
    const text = await response.text().catch(() => '');
    throw new Error(`Storage: falha ao ${action} (HTTP ${response.status}) ${text.slice(0, 200)}`);
  }

  return {
    available: true,

    async createUploadUrl(path, contentType) {
      const response = await doFetch(`${base}/object/upload/sign/${bucket}/${encodePath(path)}`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: '{}',
      });
      await failIfNotOk(response, 'gerar link de envio');
      const data = (await response.json()) as { url?: string };
      if (!data.url) throw new Error('Storage: resposta sem url de envio');
      return {
        url: `${base}${data.url}`,
        method: 'PUT',
        headers: { 'Content-Type': contentType, 'x-upsert': 'false' },
      };
    },

    async stat(path) {
      const response = await doFetch(`${base}/object/${bucket}/${encodePath(path)}`, {
        method: 'HEAD',
        headers: authHeaders,
      });
      if (response.status === 400 || response.status === 404) return null;
      await failIfNotOk(response, 'consultar arquivo');
      return {
        size: Number(response.headers.get('content-length') ?? 0),
        contentType: response.headers.get('content-type'),
      };
    },

    async createDownloadUrl(path, expiresInSeconds) {
      const response = await doFetch(`${base}/object/sign/${bucket}/${encodePath(path)}`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: expiresInSeconds }),
      });
      await failIfNotOk(response, 'gerar link de leitura');
      const data = (await response.json()) as { signedURL?: string; signedUrl?: string };
      const signed = data.signedURL ?? data.signedUrl;
      if (!signed) throw new Error('Storage: resposta sem link de leitura');
      return signed.startsWith('http') ? signed : `${base}${signed}`;
    },

    async remove(path) {
      const response = await doFetch(`${base}/object/${bucket}`, {
        method: 'DELETE',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [path] }),
      });
      await failIfNotOk(response, 'remover arquivo');
    },
  };
}
