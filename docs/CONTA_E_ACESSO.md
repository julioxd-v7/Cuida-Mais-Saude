# Menu da conta, configurações, acesso e login com Google

Migration `005_conta_google_e_exclusao.sql`. **Ainda não foi aplicada no Supabase**: o servidor pediu uma confirmação que não foi respondida a tempo. Rode `npm run migrate` no backend, ou autorize a aplicação pelo chat.

## Menu do usuário (aba Perfil)

**Cliente** (`features/menu/ClientMenuScreen.tsx`):

| Item | Situação |
|---|---|
| Cabeçalho (avatar com iniciais, nome, e-mail, status) | ✅ abre "Dados pessoais" |
| Próximo atendimento (topo) | ✅ mostra "nenhum agendado" de verdade, com atalho para a busca |
| Meus atendimentos | ✅ abre a aba Agenda (próximos / agora / histórico, vazias até existirem pedidos) |
| Beneficiários | ✅ listar, cadastrar, editar, remover (`/v1/me/care-recipients`) |
| Endereços salvos | ✅ meu endereço + endereços dos beneficiários |
| Cuidadores favoritos | ✅ |
| Pagamentos, métodos e recibos | ⏳ "Em breve" (sem toque) |
| Mensagens | ✅ · Notificações ⏳ "Em breve" |
| Segurança e suporte | ✅ suporte, denúncia, incidente, 192/190, WhatsApp (se configurado) |
| Configurações · Sair | ✅ |

**Profissional** (`features/menu/CaregiverMenuScreen.tsx`):

| Item | Situação |
|---|---|
| Cabeçalho (nome, profissão, status da verificação) | ✅ abre o perfil profissional |
| Disponibilidade / verificação (topo) | ✅ interruptor "Disponível agora" (aprovados) ou situação da verificação |
| Minha agenda | ✅ aba Agenda: disponibilidade semanal real; atendimentos vazios até existirem |
| Ganhos, extrato e repasses | ✅ aba Ganhos: valores por hora reais; extrato e repasses "Em breve" |
| Valor por hora, perfil profissional, documentos, região | ✅ |
| Minhas avaliações | ⏳ "Em breve" |
| Mensagens · Segurança e suporte · Configurações · Sair | ✅ (Notificações ⏳) |

O componente `MenuItem` só tem duas formas: **com ação** (abre algo real) ou **"Em breve"**, que não é botão e é anunciado ao leitor de tela como indisponível.

## Navegação inferior

- **Cliente:** Início · Buscar · Agenda · Mensagens · Perfil
- **Profissional:** Início · Agenda · Ganhos · Mensagens · Perfil

## Configurações compartilhadas (`/settings`)

| Opção | O que faz |
|---|---|
| Aparência | Claro / Escuro / Automático, salvo no aparelho |
| Dados pessoais | Nome, telefone, preferência de contato |
| Senha e acesso | Alterar senha (ou criar, para quem entrou com Google), ver aparelhos conectados, sair dos outros |
| Privacidade e localização | Explica o que cada pessoa vê; o app **não usa localização** hoje; abre os ajustes do aparelho; pedido LGPD pelo suporte |
| Notificações | ⏳ "Em breve" |
| Acessibilidade | Tela de acessibilidade |
| Termos e privacidade | Abrem com ou sem login |
| Excluir conta | Pede "EXCLUIR" + senha |
| Versão | `expo-constants` + ambiente |

## Backend novo

| Rota | Regra |
|---|---|
| `POST /v1/me/password` | Exige a senha atual (se houver). Encerra as **outras** sessões. Auditoria. Limite de tentativas |
| `GET /v1/me/sessions` | Sessões ativas (só datas; nenhum dado do aparelho é guardado) |
| `POST /v1/me/sessions/revoke-others` | Sai dos outros aparelhos. Auditoria |
| `POST /v1/me/deletion` | `confirm: "EXCLUIR"` + senha. Efeito imediato: login bloqueado (`ACCOUNT_DELETED`), sessões encerradas, some da busca e dos favoritos, "disponível agora" desligado. Auditoria. Admin não se exclui pelo app |
| `POST /v1/auth/google` | Ver abaixo |

**Exclusão definitiva:** o pedido é registrado na hora, e a **eliminação dos dados e dos arquivos é feita pela equipe em até 30 dias** (prazo informado no app). Falta criar a rotina/ferramenta administrativa para isso e validar o prazo com o jurídico.

## Login com Google

**Como funciona:**
1. O app abre a escolha de conta do Google (`@react-native-google-signin/google-signin`) e recebe um **ID token**.
2. O backend confere esse token sozinho, sem confiar no app: assinatura com as chaves públicas do Google (JWKS, com cache), emissor, destinatário (nossos client IDs), validade e e-mail verificado. Isso está em `src/security/google.ts`, com testes que usam chaves RSA reais.
3. A partir daí:
   - **conta existente** (mesmo Google, ou mesmo e-mail verificado): entra, e o Google fica vinculado;
   - **e-mail já ligado a outro Google:** recusado;
   - **conta nova:** a resposta é `needsSignup`; o app pede papel, nome, celular e aceite dos termos e cria a conta **sem senha**. A pessoa pode criar uma senha depois em "Senha e acesso".
4. O token do primeiro acesso fica só na memória do app, nunca na URL nem no disco.
5. Contas só com Google não entram por senha, e a resposta é a mesma de senha errada.

**O que você precisa fazer para ligar** (enquanto isso, o botão não aparece):
1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crie um projeto e configure a **tela de consentimento OAuth**.
2. Crie os client IDs OAuth:
   - **Web:** obrigatório. É ele que vai no token.
   - **Android:** pacote do app + SHA-1 do certificado (do build do EAS ou da Play Console).
   - **iOS:** bundle ID do app.
3. Preencha:
   - App (`.env`): `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` e `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`;
   - Backend (`.env`): `GOOGLE_CLIENT_IDS=<client ID Web>`.
4. Instale a biblioteca: `npx expo install @react-native-google-signin/google-signin`.
5. Adicione o plugin no `app.json` com o "iOS URL scheme" do client iOS (o client ID invertido):
   ```json
   ["@react-native-google-signin/google-signin", { "iosUrlScheme": "com.googleusercontent.apps.SEU-ID" }]
   ```
6. Gere um **development build** (`npx expo run:android` / `npx expo run:ios` ou EAS). **Não funciona no Expo Go.**

Esses client IDs **não são segredos** (identificam o app). Mesmo assim, só use os que você criou: não há valores de exemplo no código.
