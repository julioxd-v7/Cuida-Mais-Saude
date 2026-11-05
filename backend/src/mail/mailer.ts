/**
 * Envio de e-mails transacionais (hoje: só o código de recuperação de senha).
 *
 * - "console": imprime o código no terminal do backend. SÓ para desenvolvimento;
 *   a configuração recusa esse modo em produção.
 * - "none": não há provedor configurado; a recuperação responde que está indisponível.
 *
 * Pendência: implementar um Mailer com provedor real (ex.: Resend, Amazon SES,
 * SendGrid) — as credenciais ficam só no .env do backend.
 */
export type MailMessage = { to: string; subject: string; text: string };

export interface Mailer {
  readonly available: boolean;
  send(message: MailMessage): Promise<void>;
}

export function createConsoleMailer(log: (line: string) => void = console.log): Mailer {
  return {
    available: true,
    async send(message) {
      log(`\n[mail:console] Para: ${message.to}\n[mail:console] Assunto: ${message.subject}\n${message.text}\n`);
    },
  };
}

export const unavailableMailer: Mailer = {
  available: false,
  async send() {
    throw new Error('Nenhum provedor de e-mail configurado');
  },
};
