import { HttpError } from '../http/errors.ts';
import { isDbError } from './types.ts';

/**
 * Traduz erros do PostgreSQL em respostas HTTP. Os detalhes técnicos nunca
 * vão para o cliente; erros não reconhecidos seguem como erro interno.
 */
export function translateDbError(error: unknown): unknown {
  if (!isDbError(error)) return error;

  switch (error.code) {
    case '23505': // unique_violation
      if (error.constraint === 'users_email_key') {
        return new HttpError(409, 'EMAIL_IN_USE', 'Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.', {
          email: 'Este e-mail já está cadastrado.',
        });
      }
      if (error.constraint === 'caregiver_profiles_cpf_key') {
        return new HttpError(409, 'CPF_IN_USE', 'Este CPF já está cadastrado em outra conta. Fale com o suporte se precisar de ajuda.', {
          cpf: 'Este CPF já está cadastrado.',
        });
      }
      return new HttpError(409, 'CONFLICT', 'Esta informação já está em uso.');
    case '42501': // insufficient_privilege (gatilhos de proteção)
      return new HttpError(403, 'FORBIDDEN', 'Você não tem permissão para realizar esta ação.');
    case '23514': // check_violation
      if (error.message.includes('PROFILE_INCOMPLETE')) {
        return new HttpError(409, 'PROFILE_INCOMPLETE', 'Complete todos os campos obrigatórios do perfil profissional antes de continuar.');
      }
      if (error.message.includes('DOCUMENTS_MISSING')) {
        return new HttpError(409, 'DOCUMENTS_MISSING', 'Envie todos os documentos obrigatórios antes de continuar.');
      }
      if (error.message.includes('SERVICE_AREA_UNAVAILABLE')) {
        return new HttpError(
          409,
          'SERVICE_AREA_UNAVAILABLE',
          'O Cuidar+ ainda não atende esta cidade. Seu cadastro fica salvo e avisaremos quando chegarmos aí.',
          { serviceCity: 'Cidade ainda não atendida.' },
        );
      }
      if (error.message.includes('RATES_MISSING')) {
        return new HttpError(409, 'RATES_MISSING', 'Informe o valor por hora de pelo menos um serviço antes de enviar para verificação.');
      }
      if (error.message.includes('RATE_OUT_OF_RANGE')) {
        return new HttpError(400, 'RATE_OUT_OF_RANGE', 'O valor precisa ficar dentro da faixa permitida para o serviço na sua cidade.');
      }
      if (error.message.includes('SERVICE_NOT_ALLOWED')) {
        return new HttpError(400, 'SERVICE_NOT_ALLOWED', 'Escolha esta categoria de serviço no seu perfil antes de definir o valor.');
      }
      if (error.message.includes('CATEGORIES_MISSING')) {
        return new HttpError(409, 'CATEGORIES_MISSING', 'Escolha pelo menos uma categoria de serviço antes de enviar para verificação.');
      }
      if (error.message.includes('CATEGORY_NOT_AVAILABLE')) {
        return new HttpError(400, 'CATEGORY_NOT_AVAILABLE', 'Esta categoria de serviço não está disponível.', {
          categories: 'Categoria indisponível.',
        });
      }
      if (error.message.includes('CLINICAL_CLEARANCE_REQUIRED')) {
        return new HttpError(
          409,
          'CLINICAL_CLEARANCE_REQUIRED',
          'Categorias clínicas só podem ser ativadas depois de registrar o parecer jurídico e regulatório.',
        );
      }
      if (error.message.includes('CONVERSATION_CLOSED')) {
        return new HttpError(409, 'CONVERSATION_CLOSED', 'Esta conversa foi encerrada.');
      }
      if (error.message.includes('INVALID_TRANSITION')) {
        return new HttpError(409, 'INVALID_TRANSITION', 'Esta mudança de situação não é permitida agora.');
      }
      return new HttpError(400, 'VALIDATION', 'Alguns dados estão inválidos. Revise e tente novamente.');
    case '22P02': // invalid_text_representation (ex.: id que não é uuid)
      return new HttpError(404, 'NOT_FOUND', 'Não encontramos o que você procurou.');
    case 'P0002': // no_data_found
      return new HttpError(404, 'NOT_FOUND', 'Não encontramos o que você procurou.');
    default:
      return error;
  }
}
