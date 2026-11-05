import type { DocumentType } from '@/constants/labels';
import type { CaregiverDocument } from '@/features/profile/types';
import { api } from '@/services/api';
import { AppError } from '@/services/errors';

/** Arquivo escolhido no aparelho (vem do seletor de documentos). */
export type PickedFile = { uri: string; mimeType: string; size: number; name: string };

export const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type DocumentsResponse = {
  documents: CaregiverDocument[];
  requiredDocuments: DocumentType[];
  missingDocuments: DocumentType[];
  uploadsAvailable: boolean;
};

type UploadTarget = { url: string; method: 'PUT'; headers: Record<string, string> };

/** Confere o arquivo antes de enviar (o servidor e o armazenamento conferem de novo). */
export function checkFile(file: PickedFile): string | null {
  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.mimeType)) {
    return 'Envie PDF ou foto (JPG, PNG, WEBP ou HEIC).';
  }
  if (file.size <= 0) return 'O arquivo está vazio.';
  if (file.size > MAX_FILE_BYTES) return 'O arquivo pode ter no máximo 10 MB.';
  return null;
}

/**
 * Documentos de verificação. O arquivo vai direto para o armazenamento
 * privado por um link temporário criado pelo backend; o app nunca recebe
 * credenciais do armazenamento.
 */
export const documentService = {
  list: () => api.get<DocumentsResponse>('/v1/me/caregiver-documents'),

  async upload(docType: DocumentType, file: PickedFile, fetchImpl: typeof fetch = fetch): Promise<CaregiverDocument> {
    const problem = checkFile(file);
    if (problem) throw new AppError('VALIDATION', problem, { userMessage: problem });

    const created = await api.post<{ document: CaregiverDocument; upload: UploadTarget }>('/v1/me/caregiver-documents', {
      docType,
      contentType: file.mimeType,
      sizeBytes: file.size,
    });

    let response: Response;
    try {
      const blob = await (await fetchImpl(file.uri)).blob();
      response = await fetchImpl(created.upload.url, {
        method: created.upload.method,
        headers: created.upload.headers,
        body: blob,
      });
    } catch (error) {
      throw new AppError('NETWORK', 'Falha ao enviar o arquivo', { cause: error });
    }
    if (!response.ok) {
      throw new AppError('SERVER', `Envio do arquivo falhou (HTTP ${response.status})`, {
        status: response.status,
        userMessage: 'Não foi possível enviar o arquivo. Tente de novo.',
      });
    }

    const done = await api.post<{ document: CaregiverDocument }>(`/v1/me/caregiver-documents/${created.document.id}/complete`);
    return done.document;
  },

  remove: (id: string) => api.delete<void>(`/v1/me/caregiver-documents/${id}`),
};

/** O documento mais recente de cada tipo (o que vale para a análise). */
export function latestByType(documents: CaregiverDocument[]): Partial<Record<DocumentType, CaregiverDocument>> {
  const result: Partial<Record<DocumentType, CaregiverDocument>> = {};
  for (const doc of documents) {
    const current = result[doc.docType];
    if (!current || (doc.createdAt ?? '') > (current.createdAt ?? '')) result[doc.docType] = doc;
  }
  return result;
}
