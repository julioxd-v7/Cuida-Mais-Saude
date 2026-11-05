import { useState } from 'react';

import { getUserMessage, reportError, type FieldErrors } from '@/services/errors';

import { authService } from './authService';
import type { AuthUser, LoginCredentials } from './types';
import { hasErrors, validateLoginForm } from './validation';

type Status = 'idle' | 'submitting' | 'success' | 'error';

/** Lógica do formulário de login, separada da tela. */
export function useLoginForm() {
  const [values, setValues] = useState<LoginCredentials>({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  function setField(field: keyof LoginCredentials, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  }

  async function submit() {
    if (status === 'submitting') return;

    const errors = validateLoginForm(values);
    setFieldErrors(errors);
    setFormError(null);
    if (hasErrors(errors)) return;

    setStatus('submitting');
    try {
      const response = await authService.signIn(values);
      // Parte 2: guardar tokens com segurança e abrir a área do papel do usuário.
      setUser(response.user);
      setStatus('success');
    } catch (error) {
      const appError = reportError(error, { action: 'login' });
      setFieldErrors(appError.fieldErrors ?? {});
      setFormError(getUserMessage(appError));
      setStatus('error');
    }
  }

  return {
    values,
    setField,
    fieldErrors,
    formError,
    user,
    isSubmitting: status === 'submitting',
    submit,
  };
}
