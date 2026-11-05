# Catálogo de serviços, Recife e comissão (Fase F0)

Primeira fase da `docs/ESPECIFICACAO_MVP.md`. Migration `006_catalogo_recife_comissao.sql`.

| Requisito | Como ficou | Onde |
|---|---|---|
| **P1: só não clínico** | 4 categorias ativas: Companhia e acompanhamento, Apoio cotidiano, Ida a consultas e compromissos, Apoio à família. As clínicas (procedimentos e avaliação de enfermagem, fisioterapia) ficam cadastradas e **desativadas** | `service_categories` |
| **P2: comissão 20%** | `commission_rate = 0.20` em `platform_settings`, editável pelo admin com auditoria. O app informa "80% é seu, 20% fica com o Cuidar+" na tela de valores | `admin_set_setting` |
| **P3: Recife** | Recife - PE ativo; Olinda, Jaboatão dos Guararapes, Paulista, Camaragibe, Cabo de Santo Agostinho, São Lourenço da Mata, Igarassu, Abreu e Lima, Ipojuca, Moreno, Itapissuma, Ilha de Itamaracá e Araçoiaba cadastrados e inativos; São Paulo inativa | `service_areas` |
| **CAT-01/02** | Cada categoria tem nome, o que inclui, o que não inclui, documentos exigidos, duração mínima e máxima, política de cancelamento e aviso de emergência. O banco **não deixa ativar** categoria com a ficha incompleta | CHECK em `service_categories` |
| **CAT-03** | Categoria clínica só ativa com **parecer jurídico** válido registrado (`legal_clearances`, tópico `clinical_services`). Nem SQL direto consegue | gatilho `guard_service_category` |
| **CAT-04** | O profissional escolhe as categorias; cada uma é **aprovada separadamente**. Ao aprovar o perfil, as categorias pedidas são aprovadas juntas; categoria pedida depois fica pendente até o admin aprovar. Busca e filtros usam só as aprovadas | `caregiver_categories`, `admin_set_caregiver_category` |
| **CAT-05** | O perfil do profissional, no app do cliente, mostra a ficha de cada serviço (inclui / não inclui / duração / cancelamento), com botão "Ouvir", e o aviso de emergência (192/190) | `ServiceScopeCard` |

## Profissões no lançamento

Novos cadastros veem só **Cuidador(a)**. Perfis que já eram de enfermagem ou fisioterapia continuam funcionando, mas oferecem só as categorias não clínicas. *Observação honesta:* o esconderijo é feito no app; o servidor ainda aceita as três profissões (sem risco, porque nenhuma categoria clínica está ativa).

## Configurações comerciais (valores provisórios = decisões pendentes da seção 11)

| Chave | Valor | Provisório? |
|---|---|---|
| `commission_rate` | 0,20 | não (P2) |
| `cancel_free_hours` | 24 h | não |
| `immediate_free_cancel_minutes` | 5 min | não |
| `late_cancel_fee_ratio` | 0,50 | sim (D3) |
| `immediate_accept_timeout_minutes` | 10 min | sim (D5) |
| `completion_confirm_hours` | 24 h | sim (D4) |
| `payout_delay_days` | 7 dias | sim (D2) |
| `two_level_approval_cents` | R$ 500 | sim (D8) |
| `no_show_alert_count` | 3 | sim (D6) |
| `profile_review_months` | 12 | sim (D9) |
| `estimated_tax_ratio` | 0,08 | sim (hipótese do plano) |

Quando o admin altera um valor, ele deixa de ser "provisório" e a mudança vai para a auditoria (valor antigo e novo). Cada chave tem mínimo e máximo; fora disso, o banco recusa.

## Rotas novas

| Rota | Quem | Para quê |
|---|---|---|
| `GET /v1/catalog/categories` | todos | categorias ativas com a ficha completa |
| `PATCH /v1/me/caregiver-profile` com `categories` | profissional | escolher as categorias (substitui a lista; tirar uma apaga o valor dela) |
| `POST /v1/admin/caregivers/:id/categories/:code` | admin | aprovar, recusar ou suspender uma categoria do profissional |
| `GET /v1/admin/categories` · `PATCH /v1/admin/categories/:code` | admin | ver todas; editar a ficha; ativar ou desativar |
| `GET/POST /v1/admin/legal-clearances` | admin | registrar pareceres jurídicos |
| `GET /v1/admin/settings` · `POST /v1/admin/settings/:key` | admin | configurações comerciais |

Códigos de erro novos: `CATEGORIES_MISSING`, `CATEGORY_NOT_AVAILABLE`, `CLINICAL_CLEARANCE_REQUIRED`.

## Dados antigos

Valores do tipo antigo "Cuidado e companhia" (`care`) viram, automaticamente, Companhia e Apoio cotidiano, mantendo a aprovação de quem já era aprovado. Cadastros antigos em São Paulo continuam salvos, mas saem da busca até São Paulo ser reativada.

## Testes

Backend: **135** (10 novos em `tests/catalog.test.ts`; busca, verificação e perfil passaram a usar Recife e categorias). App: **106** testes de lógica (novo `tests/unit/catalog.test.ts`).
