# Autenticação — CUIDAR MAIS

## 1. Estratégia escolhida

**Backend próprio em Node.js + TypeScript** (pasta `backend/`), com PostgreSQL hospedado no **Supabase**, projeto `cuidar-mais`, região São Paulo.

- O Supabase é usado **apenas como banco PostgreSQL**. O Supabase Auth e a API pública do Supabase **não** são usados. Toda a autenticação e autorização acontecem no nosso backend, sem misturar provedores.
- Senhas: hash **scrypt**, nativo do Node, com N=2¹⁴, r=8, p=5. É uma das combinações recomendadas pela OWASP. Nunca em texto puro.
- Sessão: **tokens opacos** de 256 bits. O banco guarda só o **SHA-256** de cada token, então se o banco vazar os tokens não servem para nada.
  - *Access token* válido por **15 minutos**, enviado em `Authorization: Bearer …`.
  - *Refresh token* válido por **30 dias**, com **rotação**: cada uso gera um par novo e invalida o anterior.
  - Por que não JWT: com tokens opacos guardados no banco, logout, troca de senha e suspensão **encerram a sessão na hora**. Um JWT continuaria válido até expirar.
- No app, os tokens ficam no **expo-secure-store**, que usa o Keychain no iOS e o Keystore no Android, com `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`. No Expo web (só desenvolvimento) ficam apenas em memória.

## 2. Fluxos

### Cadastro

```text
App: escolher tipo (/welcome) → formulário (/register/client | /register/caregiver)
  → validação local (zod) → POST /v1/auth/register
Backend: valida de novo → scrypt → register_user() no banco (usuário + perfil + auditoria, atômico)
  → cria sessão → 201 { accessToken, refreshToken, user }
App: guarda tokens no SecureStore → estado "signedIn" → navegação leva à área do papel
  → cuidador recém-cadastrado vai direto ao Perfil profissional (pode pular)
```

- Papéis aceitos no cadastro: `client` e `caregiver`. **`admin` é recusado** pela API (400) e pelo banco (gatilho).
- E-mail é único sem diferenciar maiúsculas de minúsculas. Duplicado → `409 EMAIL_IN_USE`, com o erro no campo `email`.
- Telefone brasileiro (DDD + número) é guardado só com dígitos. Celular de 11 dígitos precisa começar com 9.
- Aceite dos termos é obrigatório. O backend registra a versão (`TERMS_VERSION`) e a data.

### Login

`POST /v1/auth/login` → `200 { accessToken, refreshToken, accessExpiresAt, user }`

- E-mail inexistente e senha errada recebem **a mesma resposta** (`401 INVALID_CREDENTIALS`), e o servidor gasta o mesmo tempo nos dois casos. Assim não dá para descobrir quais e-mails têm conta.
- Conta suspensa → `403 ACCOUNT_SUSPENDED`.
- Limite: 10 tentativas a cada 15 minutos por IP + e-mail → `429 RATE_LIMITED`.

### Restauração da sessão (abrir o app de novo)

1. A splash nativa fica visível.
2. O app lê os tokens do SecureStore. Se não houver nada, vai para o login.
3. Chama `GET /v1/auth/session`. Se o access token expirou, o cliente HTTP renova sozinho com o refresh e repete a chamada.
4. Os resultados possíveis:
   - Sessão válida: a pessoa vai para a sua área.
   - Sessão inválida ou expirada (`401`): os tokens são apagados e o login aparece com o aviso "Sua sessão expirou".
   - Conta suspensa: os tokens são apagados e aparece o aviso de suspensão.
   - **Sem conexão:** os tokens **são mantidos** e aparece a tela "Sem conexão" com "Tentar novamente". Ninguém é deslogado por falta de internet.

### Sessão expirada durante o uso

Toda requisição autenticada que recebe `401 TOKEN_EXPIRED` dispara **uma** renovação. Várias requisições simultâneas compartilham a mesma renovação. Depois disso:
- Se a renovação der certo, a requisição é repetida.
- Se falhar, a sessão local é apagada e o app volta ao login com aviso.

### Logout

`POST /v1/auth/logout` revoga a sessão no servidor. O app apaga os tokens **antes** de chamar o servidor: mesmo sem internet, a sessão local some. No servidor, ela expira sozinha.

### Recuperação de senha

```text
/forgot-password → POST /v1/auth/password/forgot { email }
  → 202 sempre com a mesma mensagem (não revela se o e-mail existe)
  → se existir conta ativa: código de 8 dígitos, válido por 15 min, enviado por e-mail
/reset-password → POST /v1/auth/password/reset { email, code, password }
  → 204: senha trocada e TODAS as sessões da conta encerradas
```

- O código é de uso único e guardado só como hash. Depois de **5 tentativas erradas** fica bloqueado. Pedir um código novo invalida o anterior.
- **Envio do e-mail (pendência):** ainda não há provedor de e-mail configurado.
  - `MAIL_TRANSPORT=console`: o código aparece **no terminal do backend**. Use só em desenvolvimento; o backend se recusa a iniciar assim em produção.
  - `MAIL_TRANSPORT=none`: a recuperação responde `503 PASSWORD_RESET_UNAVAILABLE`.
  - Para produção, falta implementar um `Mailer` com um provedor, como Resend, Amazon SES ou SendGrid (`backend/src/mail/mailer.ts`).

## 3. Contrato de erros

Todas as respostas de erro têm o formato:

```json
{ "code": "EMAIL_IN_USE", "message": "texto para o usuário", "fieldErrors": { "email": "..." } }
```

| HTTP | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION`, `INVALID_JSON`, `INVALID_RESET_CODE` | dados inválidos (com `fieldErrors`) |
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED` | sem sessão, login errado, token vencido |
| 403 | `FORBIDDEN`, `ACCOUNT_SUSPENDED` | papel sem permissão, conta suspensa |
| 404 | `NOT_FOUND` | inexistente **ou de outra conta** |
| 409 | `EMAIL_IN_USE`, `PROFILE_INCOMPLETE`, `INVALID_TRANSITION` | conflito de estado |
| 429 | `RATE_LIMITED` | excesso de tentativas |
| 500 | `SERVER_ERROR` | erro inesperado (detalhes **só** no log do servidor) |
| 503 | `PASSWORD_RESET_UNAVAILABLE` | sem provedor de e-mail |

## 4. Rotas da API

| Método | Rota | Quem |
|---|---|---|
| GET | `/v1/health` | público |
| POST | `/v1/auth/register` | público |
| POST | `/v1/auth/login` | público |
| POST | `/v1/auth/refresh` | público (com refresh token) |
| POST | `/v1/auth/logout` | público (com token) |
| POST | `/v1/auth/password/forgot` | público |
| POST | `/v1/auth/password/reset` | público |
| GET | `/v1/auth/session` | logado |
| GET / PATCH | `/v1/me` | logado |
| PATCH | `/v1/me/client-profile` | cliente |
| GET / POST | `/v1/me/care-recipients` | cliente |
| PATCH / DELETE | `/v1/me/care-recipients/:id` | cliente (só os próprios) |
| PATCH | `/v1/me/caregiver-profile` | cuidador |
| POST | `/v1/me/caregiver-profile/submit` | cuidador |
| GET | `/v1/admin/caregivers` | admin |
| POST | `/v1/admin/caregivers/:id/verification` | admin |
| POST | `/v1/admin/users/:id/status` | admin |
| GET | `/v1/catalog/professions` | público |
| GET / POST | `/v1/me/caregiver-documents` | profissional |
| POST | `/v1/me/caregiver-documents/:id/complete` | profissional |
| DELETE | `/v1/me/caregiver-documents/:id` | profissional |
| GET | `/v1/admin/caregivers/:id` | admin (ficha com documentos) |
| — | mensagens e suporte | veja `MENSAGENS.md` |

## 5. Variáveis de ambiente

**Backend (`backend/.env`, nunca vai para o Git):** veja `backend/.env.example`.

| Variável | Obrigatória | Padrão | Observação |
|---|---|---|---|
| `DATABASE_URL` | sim | — | Supabase → *Connect* → **Session pooler** (porta 5432) |
| `DATABASE_SCHEMA` | não | `app` | |
| `DATABASE_SSL` | não | `require` | `verify` exige `DATABASE_CA_CERT` |
| `PORT` / `HOST` | não | `3333` / `0.0.0.0` | `0.0.0.0` para o celular alcançar o PC |
| `ACCESS_TOKEN_TTL_MINUTES` | não | `15` | |
| `REFRESH_TOKEN_TTL_DAYS` | não | `30` | |
| `TERMS_VERSION` | não | `2026-10-rascunho` | |
| `CORS_ORIGINS` | não | vazio | ex.: `http://localhost:8081` para o Expo web |
| `MAIL_TRANSPORT` | não | `none` | `console` só em desenvolvimento |
| `SUPABASE_URL` | para documentos | — | `https://bmchxezjuextpdpkcewv.supabase.co` |
| `SUPABASE_SECRET_KEY` | para documentos | — | chave secreta (`sb_secret_…`); **só no backend** |
| `STORAGE_BUCKET` | não | `caregiver-documents` | |

**App (`app/.env`):** `EXPO_PUBLIC_API_URL`, o endereço do backend. No celular, use o IP do computador na rede (ex.: `http://192.168.0.10:3333`), nunca `localhost`.

## 6. Limitações conhecidas

- O limite de tentativas fica em memória, por processo. Com mais de uma instância do backend, é preciso mover para Redis ou para o banco.
- Não há detecção de reuso de refresh token roubado: um refresh antigo só é recusado, não derruba as outras sessões. Fica para uma melhoria futura.
- Não há verificação de e-mail no cadastro, porque depende do provedor de e-mail.
- Não há bloqueio de conta por tentativas: só o limite por IP + e-mail.
- `DATABASE_SSL=require` criptografa a conexão mas não confere o certificado. Para produção, use `verify` com o certificado do Supabase.
