import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, Card, ErrorState, FeedbackMessage, LoadingState } from '@/components/ui';
import { DOCUMENT_INFO, DOCUMENT_STATUS_LABELS, type DocumentType } from '@/constants/labels';
import { getUserMessage, reportError } from '@/services/errors';
import { radius, spacing, type AppColors, useStyles } from '@/theme';

import { ACCEPTED_MIME_TYPES, documentService, latestByType, type DocumentsResponse } from '../documentService';

/**
 * Documentos para verificação: antecedentes criminais, identidade,
 * comprovante de residência, certificados e registro no conselho.
 * Os arquivos ficam em armazenamento privado: só você e a equipe de
 * verificação têm acesso.
 */
export default function DocumentsScreen() {
  const styles = useStyles(createStyles);
  const [data, setData] = useState<DocumentsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyType, setBusyType] = useState<DocumentType | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setData(await documentService.list());
    } catch (error) {
      setLoadError(getUserMessage(reportError(error, { action: 'documents.load' })));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data && loadError) return <Screen scroll={false}><ErrorState message={loadError} onAction={load} /></Screen>;
  if (!data) return <Screen scroll={false}><LoadingState message="Carregando documentos…" /></Screen>;

  const latest = latestByType(data.documents);
  const optional: DocumentType[] = ['other'];
  const types: DocumentType[] = [...data.requiredDocuments, ...optional.filter((t) => !data.requiredDocuments.includes(t))];

  async function pickAndUpload(docType: DocumentType) {
    if (busyType) return;
    setMessage(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: [...ACCEPTED_MIME_TYPES],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    setBusyType(docType);
    try {
      await documentService.upload(docType, {
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        size: asset.size ?? 0,
        name: asset.name,
      });
      setMessage({ kind: 'success', text: `${DOCUMENT_INFO[docType].label}: enviado.` });
      await load();
    } catch (error) {
      setMessage({ kind: 'error', text: getUserMessage(reportError(error, { action: 'documents.upload', docType })) });
    } finally {
      setBusyType(null);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Documentos
        </AppText>
        <AppText tone="muted">
          Para a segurança das famílias e a sua, a equipe do Cuidar+ confere cada documento antes de liberar o selo de
          verificado. Os arquivos são privados.
        </AppText>
      </View>

      {!data.requiredDocuments.length ? (
        <FeedbackMessage
          kind="warning"
          message="Escolha sua profissão no perfil profissional para ver quais documentos são necessários."
        />
      ) : null}
      {!data.uploadsAvailable ? (
        <FeedbackMessage kind="warning" message="O envio de documentos está temporariamente indisponível." />
      ) : null}
      {message ? <FeedbackMessage kind={message.kind} message={message.text} /> : null}

      {types.map((docType) => {
        const doc = latest[docType];
        const required = data.requiredDocuments.includes(docType);
        const missing = data.missingDocuments.includes(docType);
        return (
          <Card key={docType}>
            <View style={styles.titleRow}>
              <AppText variant="bodyStrong" style={styles.title}>
                {DOCUMENT_INFO[docType].label}
                {required ? <AppText tone="danger"> *</AppText> : null}
              </AppText>
              {doc ? (
                <View style={[styles.pill, doc.status === 'rejected' ? styles.pillDanger : doc.status === 'accepted' ? styles.pillSuccess : styles.pillInfo]}>
                  <AppText variant="caption">{DOCUMENT_STATUS_LABELS[doc.status]}</AppText>
                </View>
              ) : null}
            </View>
            <AppText variant="caption" tone="muted">
              {DOCUMENT_INFO[docType].hint}
            </AppText>
            {doc?.status === 'rejected' && doc.reviewNote ? (
              <AppText variant="caption" tone="danger">
                Motivo: {doc.reviewNote}
              </AppText>
            ) : null}
            <Button
              label={doc ? 'Enviar novo arquivo' : 'Enviar arquivo'}
              variant={missing ? 'primary' : 'secondary'}
              onPress={() => void pickAndUpload(docType)}
              loading={busyType === docType}
              disabled={!data.uploadsAvailable || (busyType !== null && busyType !== docType)}
            />
          </Card>
        );
      })}

      <AppText variant="caption" tone="muted">
        Aceitamos PDF e fotos (JPG, PNG, WEBP, HEIC) de até 10 MB.
      </AppText>
      <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
  },
  pillInfo: {
    backgroundColor: colors.infoSoft,
  },
  pillSuccess: {
    backgroundColor: colors.successSoft,
  },
  pillDanger: {
    backgroundColor: colors.dangerSoft,
  },
});
