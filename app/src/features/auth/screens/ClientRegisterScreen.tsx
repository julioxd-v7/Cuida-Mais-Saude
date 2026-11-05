import { RegisterForm } from './RegisterForm';

/** Cadastro de quem contrata o cuidado (para si ou para um familiar). */
export default function ClientRegisterScreen() {
  return (
    <RegisterForm
      role="client"
      title="Criar conta de cliente"
      subtitle="Os dados da pessoa que vai receber o cuidado você informa depois, quando for solicitar um atendimento."
    />
  );
}
