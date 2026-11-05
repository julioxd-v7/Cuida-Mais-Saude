# Modelo de dados — CUIDAR MAIS

Banco: **PostgreSQL** (Supabase, projeto `cuidar-mais`, região `sa-east-1`), schema **`app`**.
Migrations versionadas em `backend/migrations/` e aplicadas com `npm run migrate`.

| Migration | Conteúdo | Situação |
|---|---|---|
| `001_auth_e_perfis.sql` | usuários, perfis, beneficiários, sessões, recuperação de senha, auditoria | ✅ aplicada no Supabase em 26/10/2026 |
| `002_profissoes_e_verificacao.sql` | profissão, CPF, conselho, bairro; documentos; regras de envio e aprovação; bucket privado | ✅ aplicada em 27/10/2026 |
| `003_mensagens.sql` | conversas, participantes e mensagens (suporte e, depois, atendimento) | ✅ aplicada em 27/10/2026 |

## Diagrama

```text
users ─┬─< sessions
       ├─< password_resets
       ├── client_profiles      (1:1, só papel client)
       ├─< care_recipients      (1:N, só papel client = responsável)
       ├── caregiver_profiles   (1:1, só papel caregiver)
       └─< audit_log            (quem fez)
```

## Tabelas

### `users`, o usuário

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid | PK |
| `email` | text | único, sempre minúsculo |
| `password_hash` | text | `scrypt$N$r$p$salt$hash`, **nunca** sai na API |
| `full_name` | text | 3 a 120 caracteres |
| `phone` | text | só dígitos, DDD + 8 ou 9 dígitos |
| `role` | text | `client` \| `caregiver` \| `admin` — **protegido** |
| `status` | text | `active` \| `suspended` — **protegido** |
| `terms_version`, `terms_accepted_at` | text, timestamptz | registro do aceite |
| `created_at`, `updated_at` | timestamptz | `updated_at` automático |

Não há "identificador do provedor de autenticação" porque a autenticação é do próprio backend. O `id` é o identificador.

### `client_profiles`, o perfil do cliente

`user_id` (PK/FK), `contact_preference` (`whatsapp` \| `phone` \| `email`) e endereço principal opcional (`address_*`, CEP com 8 dígitos).

### `care_recipients`, os beneficiários

As pessoas que recebem o cuidado, separadas do responsável que contrata.

`id`, `guardian_id` (FK do cliente), `full_name`, `relationship` (`self`, `parent`, `grandparent`, `spouse`, `child`, `sibling`, `other`), `assistance_needs` (categorias **gerais**: `mobility`, `hygiene`, `feeding`, `medication_reminder`, `companionship`), endereço de atendimento opcional, `created_at`, `updated_at`.

> **Dados de saúde não existem nesta tabela.** Diagnósticos, medicamentos e alergias são dados sensíveis (LGPD, art. 11). Eles entram numa etapa própria, com consentimento específico, acesso restrito e registro de acesso.

O banco recusa um beneficiário cujo `guardian_id` não seja um cliente.

### `caregiver_profiles`, o perfil do cuidador

| Coluna | Observação |
|---|---|
| `bio` | até 1000 caracteres; ≥ 30 para o perfil contar como completo |
| `experience_years` | 0–60 |
| `specialties` | `elderly`, `post_surgery`, `disability`, `dementia`, `palliative`, `special_needs_children` |
| `service_city`, `service_state`, `service_radius_km` | região de atendimento (raio de 1–100 km) |
| `availability_days`, `availability_periods` | disponibilidade inicial |
| `verification_status` | **protegido**; veja abaixo |
| `verification_note`, `submitted_at`, `reviewed_at`, `reviewed_by` | **protegidos** |

**Estados da verificação** (independentes da autenticação: o cuidador entra no app em qualquer um deles):

```text
incomplete ⇄ completed ──(cuidador envia)──▶ pending_review ──(admin)──▶ approved
     ▲                                             │                        │
     └──(apagou dado obrigatório)──────────────────┴──(admin)──▶ rejected ──(cuidador corrige e reenvia)──▶ pending_review
admin: completed | pending_review | approved | rejected ──▶ suspended ──▶ pending_review
```

| Estado | Requisito da Parte 2 | Quem leva até ele |
|---|---|---|
| `incomplete` | cadastro incompleto | automático (banco) |
| `completed` | cadastro concluído | automático (banco) |
| `pending_review` | verificação pendente | o próprio cuidador (`/submit`) |
| `approved` | aprovado | **só admin** |
| `rejected` | reprovado | **só admin** |
| `suspended` | suspenso | **só admin** |

### `sessions`

`access_token_hash` e `refresh_token_hash` (SHA-256, únicos), as validades, `revoked_at` e `last_used_at`. Logout, troca de senha e suspensão preenchem `revoked_at`.

### `password_resets`

`code_hash` (SHA-256 de `id:código`), `expires_at` (15 min), `attempts` (máx. 5) e `used_at`.

### `audit_log`

Só aceita inclusão: o banco recusa UPDATE e DELETE. Registra cadastro, envio para análise, decisões de verificação, mudança de estado da conta, concessão de admin e troca de senha. **Nunca** guarda senha, token ou dado de saúde.

### Adições da migration 002 (veja `PROFISSOES_E_VERIFICACAO.md`)

- `caregiver_profiles`:
  - `profession`: `caregiver` \| `nurse` \| `physiotherapist`;
  - `cpf`: dígitos verificados por `cpf_is_valid` e **único**;
  - `council_number` e `council_state`;
  - `service_district`.
  - O perfil "completo" passa a exigir profissão, CPF e o conselho, quando a profissão pede. Mudar esses campos depois de aprovado volta o perfil para `completed`.
- `caregiver_documents`:
  - colunas `doc_type`, `storage_path` (caminho no bucket privado), `content_type`, `size_bytes`, `status` (`uploading → submitted → accepted | rejected`), `review_note` e `reviewed_*`;
  - só o admin aceita ou recusa documentos (gatilho);
  - `caregiver_missing_documents()` lista o que falta.
- O envio para análise e a aprovação recusam com `DOCUMENTS_MISSING` enquanto faltar documento obrigatório.

### Adições da migration 003 (veja `MENSAGENS.md`)

- `conversations`: `kind` = `support` \| `service`, `subject`, `status`, `created_by`, `service_request_id` e `last_message_at`.
- `conversation_participants`: `participant_role` = `member` \| `support` e `last_read_at` (base da contagem de não lidas).
- `messages`: só aceita inclusão. Só participantes escrevem; conversa fechada não recebe.
- Conversas `service` só podem ser criadas por função privilegiada, que virá no fluxo de solicitações.

## Proteções no próprio banco

Elas valem mesmo que um bug no backend tente burlar as regras:

1. **Campos privilegiados** (`users.role`, `users.status` e os campos de verificação do cuidador) só mudam dentro das funções privilegiadas. Qualquer `UPDATE` comum é recusado com `insufficient_privilege`.
2. **Ninguém nasce admin.** O INSERT com `role='admin'` é recusado. O papel só é concedido pela função `grant_admin_by_email`, chamada pelo script `npm run admin:grant`, que exige acesso direto ao banco.
3. **Funções administrativas** (`admin_set_caregiver_status`, `admin_set_user_status`) conferem se quem age é um admin ativo e se a transição de estado é permitida. Um admin não pode agir sobre a própria conta.
4. **Cadastro atômico** (`register_user`): usuário, perfil e auditoria entram juntos ou nada entra.
5. **Supabase:** RLS ligado em todas as tabelas, sem políticas, e acesso revogado para `anon` e `authenticated`. A API pública do Supabase não enxerga nada; só o backend, conectado como dono das tabelas, acessa.
   > O painel do Supabase mostra o aviso "RLS Enabled No Policy". Ele é **esperado**: significa "ninguém de fora acessa".

## Como aplicar as migrations

```bash
cd backend
npm run migrate
```

O comando cria o schema, se preciso, e aplica em ordem só as migrations novas. Cada arquivo roda numa transação, e o controle fica em `app.schema_migrations`.

Para criar uma migration nova, adicione `002_descricao.sql` em `backend/migrations/`. Não use o nome do schema nas tabelas: o executor define o `search_path`. Isso é o que permite aos testes rodarem num schema temporário.
