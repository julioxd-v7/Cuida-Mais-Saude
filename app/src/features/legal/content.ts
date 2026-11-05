/**
 * RASCUNHO — estes textos são um esqueleto para o desenvolvimento e
 * PRECISAM ser escritos/revisados por profissional jurídico antes de
 * qualquer uso real. A versão aceita fica registrada no cadastro
 * (TERMS_VERSION no backend).
 */
export const LEGAL_DOCS = {
  terms: {
    title: 'Termos de Uso',
    sections: [
      {
        heading: 'O que é o Cuidar+',
        body: 'Plataforma que aproxima pessoas que precisam de cuidados e cuidadores profissionais. O Cuidar+ intermedeia a contratação; o atendimento é prestado pelo profissional.',
      },
      {
        heading: 'Cadastro',
        body: 'Você se compromete a informar dados verdadeiros e a manter sua senha em segredo. Cuidadores só recebem solicitações depois de terem o perfil verificado e aprovado.',
      },
      {
        heading: 'Pendências deste rascunho',
        body: 'Regras de pagamento, cancelamento, reembolso, responsabilidades das partes e foro ainda precisam ser definidas com assessoria jurídica.',
      },
    ],
  },
  privacy: {
    title: 'Política de Privacidade',
    sections: [
      {
        heading: 'Dados que coletamos agora',
        body: 'Nome, e-mail, telefone e senha (guardada apenas de forma irreversível). Para cuidadores, também região de atendimento, experiência, especialidades e disponibilidade.',
      },
      {
        heading: 'Para que usamos',
        body: 'Criar e proteger sua conta, permitir o contato entre cliente e cuidador e verificar profissionais. Não vendemos seus dados.',
      },
      {
        heading: 'Dados de saúde',
        body: 'Informações de saúde da pessoa cuidada são dados sensíveis pela LGPD. Elas não são pedidas no cadastro e só serão coletadas, com consentimento específico, quando forem necessárias para um atendimento.',
      },
      {
        heading: 'Seus direitos',
        body: 'Você pode pedir acesso, correção ou exclusão dos seus dados. O canal oficial de contato e o encarregado (DPO) ainda serão definidos — pendência deste rascunho.',
      },
    ],
  },
} as const;

export type LegalDocKey = keyof typeof LEGAL_DOCS;
