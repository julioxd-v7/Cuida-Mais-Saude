import { RegisterForm } from './RegisterForm';

/**
 * Cadastro do cuidador: primeiro a conta; em seguida o app abre o perfil
 * profissional (região, experiência, especialidades e disponibilidade),
 * que pode ser completado depois.
 */
export default function CaregiverRegisterScreen() {
  return (
    <RegisterForm
      role="caregiver"
      title="Criar conta de profissional"
      subtitle="Depois da conta, você informa sua profissão, envia os documentos (como antecedentes criminais e certificados) e passa pela verificação. Só perfis aprovados recebem solicitações."
    />
  );
}
