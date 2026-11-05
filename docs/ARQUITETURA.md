# Arquitetura — CUIDAR MAIS

> **Atualizado na Parte 2.** Detalhes de autenticação, dados e permissões estão em [`AUTENTICACAO.md`](./AUTENTICACAO.md), [`MODELO_DE_DADOS.md`](./MODELO_DE_DADOS.md) e [`PERMISSOES.md`](./PERMISSOES.md).

Este documento descreve como o app mobile está organizado e como ele se conectará ao backend e ao painel administrativo. A fonte dos requisitos é o *Documento de Requisitos v1.0* (07/05/2026). Os códigos RF, RNF e RN citados aqui vêm dele.

---

## 1. Visão do ecossistema

```text
┌──────────────────┐     HTTPS/JSON      ┌──────────────────────┐      ┌─────────────┐
│ App mobile       │ ──────────────────▶ │ Backend (API REST)   │ ───▶ │ PostgreSQL  │
│ Expo / RN / TS   │                     │ Node.js + TypeScript │      └─────────────┘
│ cliente,         │ ◀── push / tempo ── │ regras de negócio,   │ ───▶ Provedores: pagamento,
│ responsável,     │     real (chat)     │ autorização, auditoria│      mapas, push, storage,
│ cuidador         │                     └──────────────────────┘      verificação, e-mail/SMS
└──────────────────┘                               ▲
                                                   │ mesma API, rotas /admin
                                          ┌────────┴─────────┐
                                          │ Painel admin web │
                                          └──────────────────┘
```

**Princípio central: o app só exibe e coleta dados.** Quem decide é o backend: autorização, matching, preço final, comissão, estado do atendimento e aprovação de profissionais. O app nunca é a fonte da verdade dessas regras, porque qualquer código no celular pode ser modificado.

## 2. Organização do app (`app/`)

```text
src/
├── app/                    Rotas (Expo Router). Arquivos finos: só reexportam telas.
├── providers/
│   └── AuthProvider.tsx    Sessão para a interface (liga SessionManager ↔ React ↔ cliente HTTP)
├── features/               Um módulo por domínio do negócio
│   ├── auth/               login, cadastro, recuperação, sessão
│   │   ├── screens/        telas
│   │   ├── sessionManager.ts  regras da sessão, sem React (testado)
│   │   ├── authService.ts  chamadas à API
│   │   ├── schemas.ts      validação (zod)
│   │   └── types.ts
│   ├── profile/            "minha conta": profileService, useMe, ProfileScreen
│   ├── client/             início do cliente
│   ├── caregiver/          início, perfil profissional, regras de verificação
│   └── legal/              termos e privacidade (rascunho)
├── components/
│   ├── ui/                 AppText, Button, TextField, PasswordField, Checkbox, ChipGroup,
│   │                       TextLink, Card, FeedbackMessage, Loading/Empty/ErrorState
│   └── layout/Screen.tsx   contêiner padrão de tela
├── hooks/useFormSubmit.ts  envio único, carregamento e erros do servidor
├── services/
│   ├── api/                cliente HTTP único (com renovação automática de sessão)
│   ├── storage/            onde os tokens ficam (SecureStore)
│   └── errors.ts           AppError, mensagens ao usuário, registro de erros
├── constants/labels.ts     rótulos em português dos valores da API
├── config/env.ts           variáveis de ambiente validadas
└── theme/                  tokens: cores, tipografia, espaçamento, raios, elevação
tests/unit/                 testes de lógica (Jest)
```

**Regras de dependência** (de cima para baixo, nunca o inverso):

```text
app/ (rotas)  →  features/*/screens  →  features/*/use*  →  features/*/*Service  →  services/api
                         ↓                                                          ↓
                 components/ui, layout  →  theme                              services/errors, config
```

- Uma feature pode usar o serviço, os hooks, os tipos e os schemas de outra (ex.: `caregiver` usa `profile/profileService`), mas **nunca as telas** de outra. O que for genérico sobe para `components/`, `hooks/` ou `services/`.
- Telas não chamam `fetch` nem `api` diretamente: usam o serviço ou o hook da feature.
- Pastas novas (`features/bookings`, `features/caregiver` etc.) só são criadas quando houver código real para elas.

## 3. Navegação

Usa o **Expo Router** (rotas por arquivo, com *typed routes* ativado). Os grupos entre parênteses organizam as rotas sem aparecer na URL.

### 3.1 Rotas atuais

```text
app/
├── _layout.tsx                 ThemeProvider + AuthProvider + Stack com Stack.Protected por papel
├── index.tsx                   redireciona: /login | /client | /caregiver | /admin-notice
├── (auth)/                     só sem sessão (sem abas)
│   ├── login, welcome, register/client, register/caregiver, register/google
│   └── forgot-password, reset-password
├── client/                     só papel client
│   ├── (tabs)/                 index · search · agenda · messages · profile (menu)
│   ├── caregivers/[id], favorites, addresses
│   └── recipients/             index (lista) · [id] (novo = "new" ou edição)
├── caregiver/                  só papel caregiver
│   ├── (tabs)/                 index · agenda · earnings · messages · profile (menu)
│   └── professional-profile, documents, rates
├── messages/                   conversa ([id]) e novo chamado (new) — cliente e profissional
├── settings/                   index · personal · security · privacy · delete-account — cliente e profissional
├── support.tsx                 segurança e suporte — cliente e profissional
├── accessibility.tsx           aberta a todos (também antes do login)
├── legal/[doc].tsx             termos e privacidade — abertos a todos
├── admin-notice.tsx            só papel admin (o painel é web)
└── +not-found.tsx
```

O grupo `(tabs)` não muda os endereços. As abas usam `RoleTabs` (cores do tema, ícones Ionicons), e o `Screen` deixa de reservar a área segura de baixo dentro delas.

### 3.2 Próximas rotas

`client/booking/…` (pedido agendado ou imediato), `client/recipients/…`, `caregiver/requests.tsx`, agenda e ganhos.

**Proteção de rotas:** o layout raiz usa `Stack.Protected` do Expo Router com `guard` baseado na sessão e no papel. O guard **só esconde telas**; a proteção real é o backend recusar com 401/403 o que o usuário não pode acessar.

A splash nativa (`expo-splash-screen`) mostra o logo enquanto o app carrega. Não há uma "SplashScreen" em React: quando houver sessão persistida, `app/index.tsx` manterá a splash visível até decidir a rota.

## 4. Componentes e design system

- **Tokens** em `src/theme`: `colors`, `typography`, `spacing`, `radius`, `elevation`, `iconSize`, `touchTarget`, `interaction` e `layout`. Nenhuma tela deve ter cor ou tamanho fixos no código; tudo vem dos tokens.
- **Componentes base** em `src/components/ui`, importados de `@/components/ui`.
- **`Screen`** é obrigatório como contêiner de tela. Ele cuida das áreas seguras (notch, barra de status e barra de gestos no Android *edge-to-edge*), do teclado (`KeyboardAvoidingView` e `keyboardShouldPersistTaps`), da rolagem e da largura máxima em tablets.

### 4.1 Identidade visual e temas claro, escuro e automático

Marca **CUIDAR+**, "Cuidadores para cada momento". Detalhes completos em [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).

- **Três preferências:** Automático (segue o aparelho), Claro e Escuro. A escolha fica em "Meu perfil → Aparência", é salva no aparelho (AsyncStorage) e restaurada ao abrir o app.
- **Uma interface só:** as telas não têm versão clara e escura. Todas pegam as cores de `useTheme().colors`, e os estilos que dependem de cor são criados por `useStyles(createStyles)`. Trocar o tema atualiza tudo na hora, sem recarregar.
- **Vidro sutil nos dois temas:** `Screen` desenha o `Backdrop` (fundo do tema + dois brilhos suaves); `GlassPanel`/`Card` desfocam o fundo (`expo-blur`) com uma camada translúcida. No Android o fundo fica num `BlurTargetView`.
- A splash espera a sessão **e** o tema salvo, para a primeira tela não "piscar" com a cor errada. A splash nativa também tem versão clara e escura (`app.json`).
- **Contraste testado:** `tests/unit/theme.test.ts` calcula o contraste WCAG de cada par importante nos dois temas. Mudar uma cor que quebre a legibilidade faz o teste falhar.

### 4.2 Acessibilidade adotada

- Alvo de toque mínimo de 48 (`touchTarget.min`).
- Rótulos sempre visíveis nos campos (não só *placeholder*).
- `accessibilityRole`, `accessibilityState` e `accessibilityLabel` nos componentes base.
- Mensagens de erro anunciadas pelo leitor de tela (`accessibilityLiveRegion`, `role="alert"`).
- O tamanho de fonte do sistema é respeitado, com limite (`maxFontSizeMultiplier = 1.6`) para não quebrar o layout.
- Cor nunca é o único indicador: erros também têm texto e borda.

## 5. Acesso à API

- `src/services/api/client.ts` → `createApiClient()`: timeout (15 s), JSON, cabeçalho `Authorization: Bearer` opcional e conversão de toda falha em `AppError`.
- `src/services/api/index.ts` → instância `api`, configurada com `env.apiUrl`. O token vem de um provedor registrado pelo módulo de auth (`setAccessTokenProvider`).
- Cada feature tem seu serviço (`authService`, futuramente `bookingService` etc.) com tipos de entrada e saída.

### 5.1 Contrato proposto com o backend

**Proposta a ser confirmada ao implementar o backend.**

- Prefixo de versão: `/v1`.
- Erros: status HTTP adequado e corpo `{ "code": "EMAIL_IN_USE", "message": "texto para o usuário", "fieldErrors": { "email": "..." } }`.
- Autenticação: `POST /v1/auth/login` → `{ accessToken, refreshToken, accessExpiresAt, user }`. Tokens opacos (não JWT), access de 15 min e refresh rotativo de 30 dias. Veja `AUTENTICACAO.md`.
- Datas em ISO 8601 UTC. Dinheiro em **centavos (inteiro)**, nunca em ponto flutuante.
- Paginação por cursor nas listagens.
- A documentação da API será gerada em OpenAPI pelo próprio backend.

## 6. Configuração

- `src/config/env.ts` lê `EXPO_PUBLIC_APP_ENV` e `EXPO_PUBLIC_API_URL`, valida (em produção só aceita `https`) e expõe `env`.
- `.env.example` documenta as variáveis. O `.env` real não vai para o Git.
- **Tudo com prefixo `EXPO_PUBLIC_` fica dentro do app e pode ser extraído.** Segredos (chave do gateway de pagamento, chaves de servidor de mapas, credenciais do banco, chaves de storage) ficam **somente no backend**.
- Para builds de produção, as variáveis serão definidas por ambiente no EAS (`eas.json`), quando o EAS for configurado.

## 7. Tratamento de erros

| Camada | Responsabilidade |
|---|---|
| `services/api` | Converte rede, timeout e HTTP em `AppError` com `code` |
| `services/errors.ts` | `getUserMessage()` traduz o erro para texto em português; `reportError()` registra |
| Hooks das features | Fazem `catch`, chamam `reportError` e expõem `formError` e `fieldErrors` para a tela |
| `app/_layout.tsx` → `ErrorBoundary` | Captura erro de renderização em qualquer tela e oferece "Tentar novamente" |

Os códigos de erro são: `CONFIG_MISSING`, `NETWORK`, `TIMEOUT`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION`, `RATE_LIMITED`, `SERVER` e `UNKNOWN`. O monitoramento (ex.: Sentry) será ligado em `setErrorReporter()` sem mexer nas telas. **Nunca registrar senhas, tokens ou dados de saúde.**

## 8. Tipos e validação

- Tipos de domínio em `features/<feature>/types.ts`. Os tipos compartilhados por várias features irão para `src/shared/types` quando surgirem.
- `strict: true`, sem `any` nem `@ts-ignore`.
- Validação de formulário em `features/<feature>/validation.ts`, com funções puras e testadas. Desde a Parte 2, os formulários usam **zod** (`features/auth/schemas.ts`), a mesma biblioteca do backend (`backend/src/validation.ts`). As regras são duplicadas de propósito, com as mesmas mensagens; um pacote compartilhado fica para quando houver monorepo.
- **A validação do app é só conforto.** O backend valida tudo de novo (RN003: CPF; RN002/RN006: documentos e certificações).

## 9. Autenticação e permissões

**Papéis:** `client` (inclui o responsável que cadastra beneficiários), `caregiver` e `admin`. O admin usa apenas o painel web.

**Implementado na Parte 2:**
- Tokens no `expo-secure-store` (Keychain/Keystore), nunca em AsyncStorage. Na web, só em memória.
- `SessionManager` (`features/auth/sessionManager.ts`, sem React e testado) + `AuthProvider` (`providers/AuthProvider.tsx`). Os estados são `restoring`, `signedOut`, `signedIn` e `restoreFailed`.
- Renovação automática em `401 TOKEN_EXPIRED`, compartilhada entre requisições simultâneas. Se falhar, volta ao login com aviso.
- RBAC no backend em toda rota e proteções no banco para papel, estado e verificação.
- Estados de verificação do cuidador: `incomplete`, `completed`, `pending_review`, `approved`, `rejected` e `suspended`. Só admin aprova, reprova ou suspende.
- RF015 (reconhecimento facial) e RF016 (antecedentes): continuam planejados via provedor especializado, chamado pelo backend.

## 10. Backend e banco

- **Node.js + TypeScript** (`backend/`): `node:http` com um roteador mínimo, `zod` para validação e `pg` para o banco. Tem RBAC, auditoria e logs sem dados pessoais. A documentação OpenAPI continua pendente.
- **PostgreSQL no Supabase** (só como banco), com SQL e migrations versionadas em `backend/migrations/`. O Prisma não foi adotado: as regras críticas ficam em funções e gatilhos SQL. Criptografia em trânsito (TLS) e em repouso, além de criptografia de campo para dados de saúde (RNF003, RNF006).
- Entidades planejadas (só serão criadas quando a funcionalidade correspondente for implementada):

| Entidade | Observações |
|---|---|
| `User` | e-mail, hash de senha, CPF (validado — RN003), papel, status (ativo/bloqueado — RN015) |
| `ClientProfile`, `GuardianLink` | vínculo responsável ↔ cliente |
| `CareRecipient` | pessoa cuidada (RF006); observações (RF007) = **dado sensível de saúde** |
| `CaregiverProfile` | experiência, especialidades, preço, raio de atendimento, status de verificação |
| `VerificationDocument` | arquivo em storage privado, tipo, status, quem revisou e quando |
| `Address` | com coordenadas para proximidade (RF010) |
| `Availability` | janelas de disponibilidade do cuidador |
| `ServiceRequest` / `Booking` | imediato ou agendado; **máquina de estados** controlada só no backend |
| `CarePlan` | cronograma de cuidados (RF008) |
| `Payment`, `Refund`, `Payout`, `LedgerEntry` | valores em centavos, conciliáveis |
| `Conversation`, `Message` | chat (RF009) |
| `Review` | avaliação (RF021) |
| `Report`, `Incident` | denúncia e emergência (RF011, RF012, RN014) |
| `Notification`, `DeviceToken` | push (RF025) |
| `AuditLog` | toda ação administrativa e toda mudança de estado sensível |

**Estados do atendimento (proposta):**
`requested → accepted → caregiver_en_route → arrived → in_progress → completed`, com saídas `declined`, `expired`, `cancelled_by_client`, `cancelled_by_caregiver` e `disputed`. A transição para `in_progress` exige o **código de confirmação** (RF017, RN007), informado pelo cliente ao cuidador na chegada.

## 11. Regras de negócio registradas

1. O CUIDAR MAIS **intermedeia** a contratação de cuidadores profissionais.
2. Suporta atendimentos **imediatos** e **agendados**.
3. A disponibilidade depende de profissionais compatíveis e efetivamente disponíveis. O matching é feito no backend.
4. Profissionais são **verificados antes** de atender (documentos, certificações, identidade e antecedentes — RN002, RN006).
5. Localização só com permissão explícita e finalidade clara: proximidade na busca e deslocamento durante o atendimento. Nunca rastreamento contínuo fora de um atendimento.
6. O estado de cada atendimento é controlado **só no backend**.
7. Pagamentos, comissões, reembolsos e repasses são conciliáveis e auditáveis (*ledger* de partidas). **O repasse ao profissional só é liberado após a confirmação do serviço** (RN010).
8. Modelo financeiro inicial: **75% cuidador / 25% plataforma**. É uma premissa que **depende de validação comercial, contratual, fiscal e jurídica** antes de ir para produção. O cálculo é feito só no backend, em centavos.
9. **LGPD**: dados de saúde são dados pessoais sensíveis (art. 11). Exigem consentimento específico, minimização, acesso restrito por papel e por atendimento, registro de acesso e política de retenção e exclusão.
10. Segurança, suporte e incidentes: botão de emergência disponível **durante** o atendimento (RN013), denúncias registradas para análise (RN014) e bloqueio de usuários suspeitos pelo admin (RN015).

Nada aqui é promessa de segurança absoluta ou certificação. São requisitos a implementar e validar.

## 12. Integrações futuras

| Integração | Estratégia | Onde ficam os segredos |
|---|---|---|
| API do backend | `services/api` (já pronto) | — |
| Autenticação | ✅ Backend próprio: scrypt + tokens opacos com refresh rotativo (Parte 2) | backend |
| PostgreSQL | Só via backend. O app nunca acessa o banco. | backend |
| Mapas e localização | `expo-location` (permissão "durante o uso") + `react-native-maps`. Geocodificação e cálculo de proximidade (RF010) no backend, com PostGIS ou similar. | chave restrita ao app no app; chave de servidor no backend |
| Notificações push | `expo-notifications` + Expo Push Service ou FCM/APNs. O backend guarda os tokens e envia. | backend |
| Chat | WebSocket do backend ou serviço gerenciado. Mensagens persistidas e moderáveis. | backend |
| Pagamentos | Gateway brasileiro com Pix e cartão e suporte a *split* (marketplace). Cartão tokenizado pelo SDK do gateway, **nunca trafega pelo nosso backend**. Webhooks idempotentes. | backend |
| Documentos (RF013) | Upload com URL pré-assinada de curta duração para bucket **privado**. O app nunca recebe URL pública de documento. | backend |
| Verificação de identidade (RF015/016) | Provedor especializado, chamado pelo backend | backend |
| Monitoramento de erros | Sentry ou similar via `setErrorReporter`, com filtro de dados pessoais | DSN público no app; token de upload de *sourcemaps* no CI |
| Painel admin | App web separado consumindo a **mesma API** (rotas `/admin/*` com papel `admin`), com auditoria de toda ação | backend |

Nenhuma dessas integrações está conectada. Nenhuma chave foi criada ou embutida.
