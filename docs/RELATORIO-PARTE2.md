# Relatório — Parte 2: autenticação, cadastros, permissões e persistência

**Data:** 26/10/2026

## 1. Funcionalidades implementadas

- **Backend Node.js + TypeScript** (`backend/`) com PostgreSQL no Supabase (projeto `cuidar-mais`, São Paulo).
- **Cadastro** de cliente e de cuidador, com validação no app e no servidor:
  - e-mail único;
  - telefone brasileiro;
  - senha forte e confirmação;
  - aceite dos termos.
- **Login, logout, sessão persistente** (SecureStore), renovação automática com rotação do refresh token e restauração ao reabrir o app.
- **Recuperação de senha** com código de 8 dígitos, uso único, 5 tentativas e 15 minutos de validade.
- **Perfis:** dados básicos e preferência de contato do cliente; perfil profissional do cuidador, que pode ser preenchido aos poucos.
- **Beneficiários** (API pronta: criar, listar, editar e remover; só os próprios). As telas ficam para a Parte 3.
- **Verificação do cuidador** separada da autenticação: `incomplete → completed → pending_review → approved/rejected/suspended`. Só admin decide.
- **Permissões:**
  - no app, por papel (`Stack.Protected`);
  - no backend, em toda rota;
  - no banco, por gatilhos que bloqueiam mudança de papel, estado e verificação.
- **Erros tratados:** rede, credenciais inválidas, e-mail duplicado, sessão expirada, conta suspensa e servidor fora do ar.
- **Telas:** seleção de tipo, cadastros, recuperação de senha, termos (rascunho), início do cliente, início do cuidador, perfil, perfil profissional e aviso de admin.

## 2. Arquivos

**Criados**

| Onde | O quê |
|---|---|
| `backend/` | servidor completo: `src/` (config, db, http, security, mail, modules/auth, me, recipients, admin), `migrations/001_auth_e_perfis.sql`, `tests/` (3 arquivos, 58 testes), scripts `migrate` e `admin:grant` |
| `app/src/features/auth/` | `schemas.ts`, `sessionManager.ts`, telas `UserTypeSelection`, `RegisterForm`, `ClientRegister`, `CaregiverRegister`, `ForgotPassword`, `ResetPassword` e `AdminNotice` |
| `app/src/features/profile/`, `client/`, `caregiver/`, `legal/` | perfil, inícios, perfil profissional, regras de verificação, termos |
| `app/src/providers/AuthProvider.tsx` | sessão para a interface |
| `app/src/services/storage/sessionStorage.ts` | tokens no SecureStore |
| `app/src/components/ui/` | `PasswordField`, `Checkbox`, `ChipGroup`, `TextLink` |
| `app/src/hooks/useFormSubmit.ts`, `src/constants/labels.ts` | envio de formulário e rótulos |
| `app/src/app/...` | rotas `welcome`, `register/*`, `forgot-password`, `reset-password`, `legal/[doc]`, `client/*`, `caregiver/*`, `admin-notice` |
| `app/tests/unit/` | `schemas.test.ts`, `sessionManager.test.ts` |
| `app/assets/images/` | `logo-mark.png` e `logo-cuidar-mais.png` (fundo transparente) |
| `docs/` | `AUTENTICACAO.md`, `MODELO_DE_DADOS.md`, `PERMISSOES.md` e este relatório |

**Modificados**

| Arquivo | Mudança |
|---|---|
| `src/app/_layout.tsx`, `src/app/index.tsx` | `AuthProvider`, rotas protegidas, splash até restaurar a sessão |
| `src/features/auth/screens/LoginScreen.tsx` | login real, "mostrar senha", links para cadastro e recuperação, avisos de sessão |
| `src/features/auth/types.ts`, `authService.ts`, `validation.ts` | contrato real da API; validação via zod |
| `src/services/api/client.ts`, `index.ts`, `errors.ts` | renovação automática, `serverCode`, `patch` e `delete`, aviso de suspensão |
| `src/components/ui/TextField.tsx` | indicação de obrigatório, elemento à direita, multilinha, `ref` |
| `tests/unit/apiClient.test.ts` | 5 testes novos |
| `docs/ARQUITETURA.md`, `ROADMAP.md`, `AUDITORIA.md`, `COMO-EXECUTAR.md` | atualizados para a Parte 2 |

**Removidos:** `src/features/auth/useLoginForm.ts` (substituído por `AuthProvider` e `useFormSubmit`) e `assets/images/logo-cuidar-mais.jpeg` (substituído pelos PNGs transparentes).

## 3. Estratégia de autenticação

Backend próprio com scrypt e tokens opacos (access de 15 minutos e refresh rotativo de 30 dias). O banco guarda só os hashes. O Supabase é usado apenas como PostgreSQL. Detalhes em `AUTENTICACAO.md`.

## 4. Modelo de dados

São 8 tabelas no schema `app`: `users`, `client_profiles`, `care_recipients`, `caregiver_profiles`, `sessions`, `password_resets`, `audit_log` e `schema_migrations`. Há também 16 funções e gatilhos de proteção. Detalhes em `MODELO_DE_DADOS.md`.

## 5. Regras de autorização

Detalhes em `PERMISSOES.md`. Em resumo:
- Cada papel só acessa as próprias rotas.
- Recursos de outra conta respondem `404`.
- Campos privilegiados são recusados pela API e bloqueados no banco.
- Admin só é concedido por linha de comando com acesso ao banco.
- Suspensão revoga as sessões na hora.

## 6. Testes executados

| Suíte | Onde | Resultado |
|---|---|---|
| Backend: 58 testes de integração (cadastro, login, sessão, refresh, logout, recuperação, permissões, verificação, suspensão, persistência, erros) | PostgreSQL 16 real, com adaptador psql no lugar do driver `pg` | ✅ 58/58 |
| Tipos do backend | TypeScript 6, modo estrito, com tipos provisórios do `pg` | ✅ |
| Migration no Supabase + teste de fumaça | Supabase `cuidar-mais` | ✅ cadastro ok, escalada para admin bloqueada, tudo desfeito |
| Avisos de segurança do Supabase | Supabase | ✅ só "RLS sem políticas" (intencional) |
| App: 48 testes de lógica (sessão, validação, renovação, rotas por papel) | executor compatível com Jest | ✅ 48/48 |
| Tipos da lógica do app | TypeScript 6, modo estrito | ✅ |
| **Não executados aqui** | Jest real e typecheck das telas do app, backend com o driver `pg` contra o Supabase, app no celular | ⚠️ rodar com o guia `COMO-EXECUTAR.md` |

Motivo: o ambiente de desenvolvimento não tinha acesso ao registro do npm, então não foi possível instalar `pg`, React Native nem Jest.

## 7. Comandos

```powershell
# Backend
cd backend; npm install; Copy-Item .env.example .env   # preencher DATABASE_URL
npm run migrate; npm run dev
npm test                                               # com .env.test

# App
cd app
npx expo install expo-secure-store
npm install --save-exact zod@3.25.76
npm run check
npx expo start -c
```

## 8. Variáveis de ambiente

- **Backend:** `DATABASE_URL` (obrigatória), `DATABASE_SCHEMA`, `DATABASE_SSL`, `DATABASE_CA_CERT`, `HOST`, `PORT`, `ACCESS_TOKEN_TTL_MINUTES`, `REFRESH_TOKEN_TTL_DAYS`, `TERMS_VERSION`, `CORS_ORIGINS`, `MAIL_TRANSPORT`. Para os testes: `TEST_DATABASE_URL` e `TEST_DATABASE_SSL`.
- **App:** `EXPO_PUBLIC_APP_ENV` e `EXPO_PUBLIC_API_URL`.

## 9. Pendências e limitações

- **Provedor de e-mail:** a recuperação de senha mostra o código no terminal em desenvolvimento. Falta integrar um provedor para produção.
- Upload de documentos do cuidador e exigência de documentos para enviar à análise (Parte 5).
- Telas de beneficiários (a API está pronta) e painel admin web (a API `/v1/admin/*` está pronta).
- O limite de tentativas fica em memória (uma instância). Não há detecção de reuso de refresh roubado nem verificação de e-mail.
- Os termos e a política de privacidade são **rascunhos**, sem revisão jurídica.
- No Expo web, a sessão não sobrevive a um recarregamento (sem armazenamento seguro no navegador).

## 10. Problemas conhecidos

- Ainda não verificado no celular nem com o Jest e o typecheck reais (ver item 6).
- A Parte 1 ainda tem pendente o teste no Expo Go.

## 11. Plano da Parte 3

Em `ROADMAP.md`:
1. Beneficiários no app.
2. Endereços com CEP e coordenadas.
3. Agenda real de disponibilidade.
4. Busca de cuidadores aprovados por região, especialidade e disponibilidade.
5. Solicitação de atendimento imediata ou agendada, com máquina de estados no banco.
6. Estrutura inicial do matching, com aceite bloqueado para quem não está aprovado.
7. Painel admin mínimo para a fila de verificação.
