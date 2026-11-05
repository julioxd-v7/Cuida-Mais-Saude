import { useRef, useState } from 'react';

import { getUserMessage, reportError, type FieldErrors } from '@/services/errors';

/**
 * Envio de formulário com: um envio por vez (ignora toques repetidos),
 * estado de carregamento, erros por campo vindos do servidor e mensagem geral.
 */
export function useFormSubmit() {
  const [isSubmitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const inFlight = useRef(false);

  async function run(action: () => Promise<void>, context: string): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      await action();
      return true;
    } catch (error) {
      const appError = reportError(error, { action: context });
      setFieldErrors(appError.fieldErrors ?? {});
      setFormError(getUserMessage(appError));
      return false;
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  return { run, isSubmitting, formError, setFormError, fieldErrors, setFieldErrors, clearFieldError };
}
