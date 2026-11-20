# CUIDAR MAIS — Especificação de implementação do MVP

> **Versão:** 1.0 (proposta para aprovação) · **Data:** 30/10/2026
> **Fonte:** "CUIDAR MAIS — Projeto empresarial / Plano de implantação e operação" (PDF de 22 páginas, 30/10/2026), cruzado com o código atual do repositório e com `docs/DECISOES_PRODUTO.md`.
> **Situação:** aguardando autorização do responsável pelo produto. Nada desta especificação foi implementado ainda.

---

## 0. Como usar este documento (instruções para o Claude Code)

1. **Leia antes de codar:** este arquivo, depois `docs/ARQUITETURA.md`, `docs/DESIGN_SYSTEM.md`, `docs/PERMISSOES.md`, `docs/MODELO_DE_DADOS.md` e `docs/DECISOES_PRODUTO.md`.
2. **Implemente por fase** (seção 10), **uma fase por vez**, na ordem. Não comece uma fase com a anterior incompleta.
3. **Cada requisito tem um ID** (`CLI-03`, `ADM-12`…). Cite os IDs nos commits, nos testes e no relatório de cada fase.
4. **Reaproveite a arquitetura existente.** Não reescreva o que funciona:
   - backend Node + `node:http` + PostgreSQL (Supabase, schema `app`);
   - app Expo SDK 57 + Expo Router;
   - funções SQL privilegiadas, auditoria e testes `node:test`.
5. **Nenhuma funcionalidade falsa.** O que depende de decisão pendente (seção 11) usa o **valor padrão provisório** indicado aqui, guardado em configuração editável pelo admin, nunca fixo no código. Integrações reais (gateway, push, SMS) ficam atrás de uma interface com implementação de **teste** claramente rotulada na interface ("pagamento de teste").
6. **Definição de pronto** de cada requisito:
   - migração SQL com proteções no banco;
   - rota no backend com validação (zod);
   - testes cobrindo o caminho feliz, as permissões negadas e os casos de borda;
   - tela com estados de carregamento, vazio, erro e sucesso;
   - temas claro, escuro e alto contraste;
   - acessibilidade (rótulos, alvo de toque ≥ 48, tamanho de texto);
   - documentação atualizada.
7. **Segurança inegociável:**
   - nenhum segredo no app ou no Git;
   - permissões conferidas no backend, nunca só na interface;
   - dados pessoais minimizados;
   - toda ação administrativa relevante vai para o `audit_log`.
8. **Ao terminar cada fase:** rode todos os testes (backend e app), o typecheck e o lint. Relate o que foi implementado e testado e o que ficou pendente, **sem declarar pronto o que não foi testado**.

---

## 1. Premissas do PDF que viram regra de produto

| # | Premissa (fonte) | Regra no software |
|---|---|---|
| P1 | MVP = marketplace de **cuidado, companhia e apoio domiciliar não clínico** (p. 2, 4) | Só categorias marcadas `clinical = false` podem ser ofertadas. Serviços clínicos ficam cadastrados como **desativados**, e só um admin com permissão específica os ativa, depois do registro do parecer jurídico (ADM-21) |
| P2 | Receita = **20% de comissão** sobre o serviço **concluído**; **80%** de repasse; sem mensalidade nem plano Premium (p. 1, 5) | `commission_rate = 0.20`, configurável. Comissão reconhecida só na conclusão confirmada. Não existe cobrança ao profissional por assinatura |
| P3 | Mercado inicial: **Recife e Região Metropolitana** (p. 1) | Área de atendimento ativa: **Recife**. Demais municípios da RMR cadastrados como **inativos**, ativados pelo admin. São Paulo passa a **inativo** |
| P4 | Preço, duração, escopo e cancelamento **exibidos antes da contratação** (p. 4, 8) | A tela de resumo do pedido mostra os quatro itens e exige confirmação explícita |
| P5 | A plataforma **não é serviço de emergência** (p. 4, 8) | Avisos e atalhos para 192/190. Nenhum texto promete socorro |
| P6 | Execução com **check-in/out, sem vigilância excessiva** (p. 8) | Check-in por código de chegada. **Sem rastreamento contínuo de localização** |
| P7 | **Nenhum profissional publicado sem aprovação** da sua categoria (p. 8) | Aprovação por categoria (não só por perfil). Documento vencido tira o profissional da busca |
| P8 | Integrações (pagamento, mensagens, mapas) **só após análise de custo, segurança e dependência** (p. 7) | Interfaces com implementação de teste. A escolha do fornecedor é decisão pendente (seção 11) |
| P9 | Proteção de dados e **minimização** (p. 3, 7, 17) | Registro de consentimentos, política de retenção, menor dado possível por perfil de acesso |
| P10 | **Portões de decisão** (p. 15): não lançar pagamentos sem conciliação, estorno e disputa testados | Pagamento real fica bloqueado por configuração (`PAYMENTS_LIVE=false`) até o checklist F6 passar |

### 1.1 Conflitos com o que já existe (decisão desta especificação)

| Tema | Hoje no código | PDF | Esta especificação adota |
|---|---|---|---|
| Cidade de lançamento | São Paulo - SP | Recife e RMR | **Recife** (P3). Migração troca as áreas, sem apagar dados |
| Profissões | Cuidador(a), Enfermeiro(a), Fisioterapeuta | Não clínico no MVP | **Cuidador(a) / acompanhante** ativo. Enfermeiro e fisioterapeuta **ocultos no cadastro** (`CLINICAL_SERVICES_ENABLED=false`); dados existentes preservados |
| Tipos de serviço | `care`, `nursing_procedure`, `nursing_assessment`, `physiotherapy` | Companhia, apoio cotidiano, acompanhamento a compromissos, apoio à família | **Novo catálogo** de categorias (CAT-01). Os tipos clínicos atuais ficam `clinical = true` e desativados |
| Comissão | Não implementada (havia menção a 75/25 em rascunho) | 20% / 80% | **20% / 80%** |
| Faixas de preço | Exemplos de São Paulo | Ticket de R$ 200 é só hipótese | Faixas de **Recife** com valores **provisórios**, marcados como tal até validação |

---

## 2. Escopo do MVP

**Dentro:**
- jornada completa (p. 8, "Fluxo operacional recomendado"): cadastro → aprovação → busca → solicitação → confirmação → execução → pagamento/repasse → avaliação/suporte;
- painel administrativo web;
- painel de atendimento (central de chamados e incidentes);
- indicadores.

**Fora** (não implementar agora):

| Item | Motivo |
|---|---|
| Serviços clínicos (medicação, curativos, enfermagem, reabilitação) | P1: só depois de parecer jurídico |
| Canal de parceiros/instituições | Citado como público-alvo, sem requisito funcional definido |
| Site institucional | Fica para a etapa 9 do plano global |
| Orçamento, equipe, sede, equipamentos, projeções de 5 anos, cronograma de negócio (p. 9–15, 20–21) | É planejamento empresarial, não software. Serve só de contexto para os indicadores |
| Mapas e rastreamento de localização | P6 e P8 |
| SMS, WhatsApp oficial, push | Integrações pendentes de análise (P8). Push entra na F2 como interface, com fornecedor a decidir |

---

## 3. Estado atual × requisitos (ponto de partida)

Legenda: ✅ existe e testado · ⚠️ parcial · ❌ não existe.

| Área | Requisito do PDF (p. 7) | Situação | Observação |
|---|---|---|---|
| Cliente | Cadastro, login e **validação de contato** | ⚠️ | Cadastro, login, Google e recuperação de senha existem. **Falta validar o e-mail** |
| Cliente | Busca por região, categoria, disponibilidade e **faixa de preço** | ⚠️ | Busca por cidade, bairro, tipo e "disponível agora" existe. **Falta filtro de preço** e o novo catálogo |
| Cliente | Perfil do profissional com **foto**, qualificações verificadas e **avaliações** | ⚠️ | Perfil e selo existem. **Faltam foto e avaliações** |
| Cliente | Solicitação, confirmação, agendamento e cancelamento | ❌ | Não existe |
| Cliente | Pagamento, comprovante, histórico e avaliação | ❌ | Não existe |
| Cliente | Suporte e registro de ocorrência | ⚠️ | Chamados, denúncia e incidente existem como assunto. **Falta vincular ao atendimento** e ter gravidade e prazo |
| Profissional | Cadastro, documentos, qualificações e aceite dos termos | ✅ | Falta **validade de documento** (OPS-01) |
| Profissional | Agenda, raio e **categorias autorizadas** | ⚠️ | Dias, períodos, raio e "disponível agora" existem. **Faltam categorias aprovadas por categoria** e bloqueio de datas |
| Profissional | Recebimento e resposta a solicitações | ❌ | Não existe |
| Profissional | Confirmação de início e conclusão | ❌ | Não existe |
| Profissional | Extrato de serviços, comissão, repasses e avaliações | ❌ | Tela de Ganhos com "Em breve" |
| Admin | Usuários, documentos, categorias e regiões | ⚠️ | API de verificação, suspensão e áreas existe. **Não existe painel web** |
| Admin | Aprovação, suspensão e revisão de perfis | ⚠️ | API existe, falta a tela |
| Admin | Pedidos, pagamentos, repasses, estornos e conciliação | ❌ | Não existe |
| Admin | Atendimento, incidentes, reclamações e trilha de auditoria | ⚠️ | Fila de chamados e `audit_log` existem. Falta tela, gravidade, prazo e visualização da auditoria |
| Admin | Indicadores operacionais, financeiros e de qualidade | ❌ | Não existe |
| NFR | Controle de acesso por função | ⚠️ | Papéis client/caregiver/admin existem. **Faltam funções internas do admin** (ADM-01) |
| NFR | Consentimentos e retenção | ❌ | Só a versão dos termos aceitos |
| NFR | Monitoramento, logs e recuperação | ⚠️ | Health check e logs sem dados pessoais existem. Falta monitoramento e plano de recuperação |
| NFR | Acessibilidade | ✅ | Texto grande, alto contraste, voz e modo simplificado |

---

## 4. Catálogo de serviços (CAT)

**CAT-01: categorias não clínicas do MVP** (p. 4). Nova tabela `service_categories`:

| Código | Nome | Inclui (exemplo a validar) | Não inclui |
|---|---|---|---|
| `companionship` | Companhia e acompanhamento | Presença, conversa, acompanhamento em atividades externas, apoio não clínico | Qualquer ato de saúde |
| `daily_support` | Apoio cotidiano domiciliar | Tarefas rotineiras permitidas, organização leve, suporte não especializado | Medicação, curativos, procedimentos |
| `appointment_escort` | Acompanhamento a compromissos | Ir junto a consultas, exames e atividades | Executar atos de saúde |
| `family_support` | Apoio à família | Comunicação operacional, registro de horários, confirmação do atendimento | Diagnóstico, orientação clínica |

**CAT-02: ficha obrigatória de cada categoria** (regra de produto, p. 4):
- o que está incluído;
- o que está excluído;
- requisitos mínimos do profissional (documentos e cursos);
- duração mínima e máxima (em horas);
- faixa de preço por hora, por área (já existe `service_price_ranges`);
- política de cancelamento aplicável;
- aviso do canal de emergência.

A categoria só pode ser ativada com todos esses campos preenchidos (checado no banco).

**CAT-03: campo `clinical` (boolean).** Uma categoria clínica só é ativada se:
- houver o registro `legal_clearances` (parecer, data, responsável técnico);
- e a ação for feita por um admin com a permissão `catalog.clinical`.

Os tipos atuais `nursing_procedure`, `nursing_assessment` e `physiotherapy` migram como clínicos e desativados.

**CAT-04: aprovação por categoria.** Tabela `caregiver_categories` (profissional × categoria, com estado `pending | approved | rejected | suspended`):
- a busca e os pedidos usam só as categorias **aprovadas**;
- o valor por hora (`caregiver_service_rates`) passa a ser por categoria.

**CAT-05: textos para o cliente.** Antes de contratar (P4), o cliente vê "inclui / não inclui" de cada categoria.

---

## 5. Requisitos funcionais

### 5.1 Cliente (CLI)

| ID | Requisito | Critérios de aceite |
|---|---|---|
| CLI-01 | Validação de contato (e-mail) | Código de 6 dígitos por e-mail, válido por 15 min e com limite de tentativas. Sem e-mail confirmado, o cliente **não cria pedido** (o servidor responde `CONTACT_NOT_VERIFIED`). Em desenvolvimento, o código aparece no terminal (mesmo mecanismo da recuperação de senha). O provedor de e-mail real é decisão D7 |
| CLI-02 | Busca com filtro de **faixa de preço** e por **categoria** do novo catálogo | Filtros: categoria, preço mínimo e máximo por hora, disponível agora, bairro. Resultado só com profissionais aprovados na categoria, com documentos válidos, em área ativa |
| CLI-03 | Perfil com **foto** e **avaliações** | Foto aprovada pela moderação (PRO-02). Nota média e contagem aparecem só com **≥ 3 avaliações**; antes disso, "Novo no Cuidar+". Lista das últimas avaliações publicadas |
| CLI-04 | Solicitar atendimento **agendado** | O cliente escolhe beneficiário, categoria, data, hora de início e duração (dentro dos limites da categoria) e observações não clínicas. Pode **convidar** um profissional específico **ou abrir** para os aptos da área (decisão já tomada: os dois). O preço total é mostrado (valor por hora × horas) |
| CLI-05 | Solicitar atendimento **imediato** | Só profissionais "disponíveis agora". Pedido aberto com **tempo-limite de aceite** (D5, padrão provisório: 10 min). Sem aceite no prazo, o pedido expira e o app sugere agendar |
| CLI-06 | Resumo antes de confirmar (P4) | Mostra categoria, inclui/não inclui, data, duração, preço total, política de cancelamento e aviso de emergência. Exige marcar "Li e concordo". Fica registrada a versão da política aceita |
| CLI-07 | Pagamento | Na confirmação do aceite, o cliente paga pelo `PaymentProvider` (seção 7). Enquanto `PAYMENTS_LIVE=false`, a tela mostra **"Pagamento de teste — nenhuma cobrança real"** |
| CLI-08 | Comprovante e histórico | Comprovante por atendimento: valor, data, serviço, profissional (nome de exibição) e identificador do pagamento. Histórico na Agenda (Próximos, Agora, Histórico), com filtros e PDF ou compartilhamento do comprovante |
| CLI-09 | Cancelamento pelo cliente | Regra já decidida: **grátis até 24 h antes**. Depois disso, taxa para o profissional (D3, padrão provisório: 50% do valor). No imediato, grátis até 5 min depois do aceite. O valor do reembolso aparece **antes** de confirmar o cancelamento. Reembolso pelo provedor, com registro no razão financeiro |
| CLI-10 | Acompanhar o atendimento | Estados visíveis: aguardando aceite → confirmado → profissional a caminho (opcional, sem mapa) → em andamento → concluído. Código de chegada de 4 dígitos mostrado ao cliente |
| CLI-11 | Confirmar a conclusão e avaliar | Depois do check-out, o cliente **confirma** ou **contesta** em até 24 h (D4). Sem resposta, a conclusão é confirmada automaticamente. Avaliação de 1 a 5 com comentário opcional (até 500 caracteres), uma por atendimento |
| CLI-12 | Ocorrência vinculada ao atendimento | No atendimento: "Relatar problema" com tipo (OPS-03), gravidade sugerida e descrição. Vira incidente com protocolo e prazo |
| CLI-13 | Emergência | Atalhos 192/190 visíveis no atendimento em andamento, com o texto "o Cuidar+ não substitui serviços de emergência" |

### 5.2 Profissional (PRO)

| ID | Requisito | Critérios de aceite |
|---|---|---|
| PRO-01 | Categorias autorizadas | O profissional pede as categorias desejadas e o admin aprova cada uma (CAT-04). A tela mostra o estado de cada categoria e o motivo da recusa |
| PRO-02 | Foto de perfil | Envio para o armazenamento privado, entra em moderação e só aparece ao cliente depois de aprovada. É diferente da foto de documento e nunca reaproveita documento |
| PRO-03 | Agenda com bloqueios | Além de dias e períodos: bloquear datas ou intervalos (férias). O sistema impede aceitar dois atendimentos sobrepostos (checado no banco) |
| PRO-04 | Receber solicitações | Lista de pedidos compatíveis (categoria aprovada, área, agenda livre). Convites diretos aparecem primeiro. Antes de aceitar, o profissional vê **a ficha mínima**: categoria, data, duração, valor a receber (80%), bairro e necessidades não clínicas. **Sem endereço completo e sem nome completo do beneficiário** |
| PRO-05 | Aceitar ou recusar | Aceite com controle de corrida: no pedido aberto, o primeiro aceite válido leva (transação no banco). Recusa com motivo opcional. No convite direto, recusar libera para o cliente escolher outro |
| PRO-06 | Endereço depois do aceite | O endereço completo e o contato do responsável só aparecem depois do aceite **e** do pagamento confirmado. O acesso fica no registro de auditoria |
| PRO-07 | Check-in | Na chegada, o profissional digita o código de 4 dígitos que o cliente informa. Cinco tentativas no máximo. Sem localização (P6) |
| PRO-08 | Check-out | Encerramento com registro opcional e curto do atendimento (texto não clínico, até 1.000 caracteres), visível ao cliente e aos familiares autorizados |
| PRO-09 | Cancelamento ou ausência do profissional | Cancelar com menos de 24 h ou faltar (no-show) registra ocorrência, devolve 100% ao cliente e conta nos indicadores de qualidade. Reincidência (D6, padrão provisório: 3 em 30 dias) gera alerta para operações |
| PRO-10 | Extrato | Por atendimento: valor do serviço, comissão de 20%, valor líquido de 80%, estado (a receber, liberado, repassado, estornado) e data prevista do repasse. Totais por período |
| PRO-11 | Repasses | Lista de repasses com data, valor e comprovante. Os dados bancários (chave Pix) ficam cadastrados, mascarados na exibição e alterados só com a senha. O repasse real depende do gateway (D1) |
| PRO-12 | Avaliações recebidas | Média, contagem e comentários publicados. O profissional também avalia o cliente (1 a 5); essa nota é **privada** e vista só por operações |

### 5.3 Painel administrativo web (ADM)

Aplicação web **separada**, `admin-web/` (React + Vite + TypeScript), consumindo o **mesmo backend**. Usa a paleta e os tokens do design system, com temas claro e escuro.

| ID | Requisito | Critérios de aceite |
|---|---|---|
| ADM-01 | Funções internas (RBAC) | Funções: `super_admin`, `operacoes`, `atendimento`, `financeiro`, `leitura`, com matriz de permissões na seção 5.5. Funções atribuídas só por `super_admin`, com auditoria. Cada rota `/v1/admin/*` confere a **permissão**, não só o papel `admin` |
| ADM-02 | Login do admin | O mesmo login do backend. Sessão separada do app. Exige 2º fator por e-mail (código) para funções com acesso financeiro. Expira por inatividade (30 min) |
| ADM-03 | Painel inicial | Fila do dia (p. 18): pedidos pendentes, profissionais aguardando análise, documentos vencendo, pagamentos pendentes, incidentes por gravidade, chamados abertos |
| ADM-04 | Gestão de clientes | Lista com busca (nome, e-mail), filtros e paginação. Detalhe com dados mínimos conforme a função, pedidos e ocorrências. Suspender ou reativar com motivo |
| ADM-05 | Gestão de profissionais | Lista por estado de verificação, categoria e área. Detalhe com perfil, categorias, documentos, avaliações e ocorrências |
| ADM-06 | Verificação documental | Fila de análise com checklist por categoria (p. 8: identidade, documentos, referências e qualificações). Documento aberto por link temporário. Aprovar ou recusar **cada documento** com motivo. Definir **validade** (OPS-01). Tudo auditado |
| ADM-07 | Aprovação, suspensão e revisão de perfis | Aprovar ou recusar o perfil e **cada categoria** (CAT-04). Suspender com motivo e reativar. Revisão periódica agendada (OPS-02) |
| ADM-08 | Moderação de fotos e avaliações | Aprovar ou recusar a foto de perfil. Ocultar avaliação abusiva (com motivo; o original fica guardado) |
| ADM-09 | Categorias e regiões | CRUD das categorias (CAT-02) e das áreas e faixas de preço (já existem na API). Ativar categoria clínica só com `catalog.clinical` e parecer registrado |
| ADM-10 | Gestão de pedidos | Lista e detalhe com a linha do tempo de eventos. Ações: cancelar com regra de reembolso, reatribuir profissional, marcar no-show. Tudo com motivo e auditoria |
| ADM-11 | Pagamentos | Lista de cobranças com estado do provedor e vínculo ao pedido |
| ADM-12 | Repasses | Lote de repasses liberados (atendimento concluído, fora da janela de disputa, D+N, D2). Repasse **acima do limite** (D8, padrão provisório: R$ 500) exige **aprovação em dois níveis**, por dois admins diferentes (p. 18) |
| ADM-13 | Estornos e reembolsos | Reembolso total ou parcial com motivo. Acima do limite, dois níveis de aprovação. Ajusta o razão financeiro (seção 7) |
| ADM-14 | Conciliação | Rotina diária (p. 8, 18) comparando o provedor com o razão interno. Divergências ficam listadas para tratamento. O fechamento do dia mostra totais |
| ADM-15 | Gestão de comissões | Taxa de comissão vigente (20%), com histórico de alterações e data de vigência. Cada pedido grava a taxa usada no momento da confirmação, então mudar a taxa nunca altera pedidos já confirmados |
| ADM-16 | Painel de atendimento | Chamados e incidentes num só lugar: filtros por tipo, gravidade, estado, responsável e prazo (SLA). Atribuir a um atendente, responder pelo chat existente, escalar, resolver com registro e reabrir |
| ADM-17 | Incidentes com protocolo | OPS-03 e OPS-04: gravidade, prazo, escalonamento, vínculo ao pedido, ações tomadas e encerramento com causa |
| ADM-18 | Trilha de auditoria | Consulta ao `audit_log` por pessoa, alvo, ação e período. Somente leitura. Exportar CSV (função `super_admin`) |
| ADM-19 | Relatórios financeiros | Por período: GMV, comissão bruta, taxas do provedor, tributo estimado (parâmetro), contribuição, repasses, estornos, chargebacks. Exportar CSV |
| ADM-20 | Indicadores | Seção 8: marketplace, comercial, financeiro, qualidade e produto. Período selecionável e comparação com o período anterior |
| ADM-21 | Registro de pareceres | `legal_clearances`: tema, documento, data, responsável e validade. Pré-requisito para categoria clínica (CAT-03) e para `PAYMENTS_LIVE` (seção 7) |
| ADM-22 | Configurações comerciais | Parâmetros editáveis e auditados: comissão, prazos de cancelamento e taxa, janela de disputa, D+N do repasse, tempo-limite do imediato, limite dos dois níveis, tributo estimado para relatórios |

### 5.4 Operação e qualidade (OPS)

| ID | Requisito | Critérios de aceite |
|---|---|---|
| OPS-01 | Validade de documentos | Cada documento aprovado tem `expires_at`. A certidão de antecedentes vale **90 dias** (regra já usada no app); os outros, conforme a categoria. **30 dias antes**, o profissional e operações recebem aviso. **Vencido**: o profissional sai da busca até reenviar e ser aprovado (P7) |
| OPS-02 | Revisão periódica | Cada profissional aprovado entra numa fila de revisão a cada 12 meses (D9). Operações confirma ou suspende |
| OPS-03 | Tipos de ocorrência (p. 8) | Atraso, ausência, reclamação, suspeita de fraude, acidente, violação de privacidade, risco à pessoa atendida, outro |
| OPS-04 | Gravidade e prazo (p. 8) | `critica`, `alta`, `media`, `baixa`, com primeira resposta (D10, padrão provisório: 1 h / 4 h / 24 h / 72 h). Risco à pessoa e acidente começam como **crítica**. Prazo estourado escala para `operacoes` e aparece em destaque no painel |
| OPS-05 | Bloqueio preventivo | Incidente crítico contra um profissional permite a `operacoes` suspender preventivamente, com motivo e auditoria. O cliente vê "em análise", nunca a acusação |
| OPS-06 | Revisão mensal | Relatório mensal de reclamações, incidentes, cancelamentos e qualidade (p. 8), gerado no painel e exportável |
| OPS-07 | Acordos fora da plataforma | Antes do aceite, o chat bloqueia telefone, e-mail e links (aviso, não punição automática). Denúncias de pagamento por fora viram ocorrência. Sem práticas abusivas (p. 5) |

### 5.5 Matriz de permissões do admin (ADM-01)

| Permissão | super_admin | operacoes | atendimento | financeiro | leitura |
|---|:-:|:-:|:-:|:-:|:-:|
| Ver indicadores | ✔ | ✔ | ✔ | ✔ | ✔ |
| Clientes e profissionais (ver) | ✔ | ✔ | ✔ (dados mínimos) | ✔ (dados mínimos) | ✔ (dados mínimos) |
| Suspender/reativar conta | ✔ | ✔ | — | — | — |
| Verificar documentos / aprovar categorias | ✔ | ✔ | — | — | — |
| Moderar fotos e avaliações | ✔ | ✔ | ✔ | — | — |
| Chamados e incidentes | ✔ | ✔ | ✔ | — | — |
| Pedidos (cancelar, reatribuir) | ✔ | ✔ | ✔ (cancelar com regra) | — | — |
| Pagamentos, repasses, estornos, conciliação | ✔ | — | — | ✔ | — |
| 2º nível de aprovação financeira | ✔ | — | — | ✔ (outra pessoa) | — |
| Categorias e regiões | ✔ | ✔ | — | — | — |
| Categoria clínica (`catalog.clinical`) | ✔ | — | — | — | — |
| Configurações comerciais | ✔ | — | — | ✔ (só comissão e financeiro) | — |
| Auditoria (consultar) | ✔ | ✔ | — | ✔ | — |
| Atribuir funções | ✔ | — | — | — | — |

---

## 6. Ciclo do atendimento (máquina de estados)

```
rascunho → solicitado ─┬─ (convite) aguardando_profissional ─┐
                       └─ (aberto)  aberto ───────────────────┤
                                                              ▼
                          aceito → pago(confirmado) → em_andamento → concluido_pendente → concluido
                             │            │                │                │
                             ▼            ▼                ▼                ▼
                          expirado    cancelado_cliente  ocorrencia     contestado → resolvido
                                      cancelado_profissional / no_show
```

Regras (todas validadas no banco):
- **Uma transição por vez**, com o evento gravado em `booking_events` (quem, quando, motivo).
- **Aceite:** só profissional aprovado na categoria, com agenda livre e documentos válidos (PRO-03/05).
- **pago:** endereço liberado ao profissional (PRO-06).
- **em_andamento:** só com o código de chegada correto (PRO-07).
- **concluido:**
  - confirmação do cliente, ou automática depois da janela (D4);
  - a comissão é **reconhecida** nesse momento (P2);
  - o repasse fica **liberado** em D+N (D2).
- **contestado:** congela o repasse até a resolução no painel (ADM-13/17).
- O preço e a taxa de comissão ficam **congelados no pedido** no momento da confirmação.

---

## 7. Pagamentos, comissão e razão financeiro

**Valores:** sempre em **centavos inteiros**.
- comissão = `round(preço × taxa)`;
- repasse = `preço − comissão`.

A soma fecha exatamente. Exemplo do PDF: R$ 200 → R$ 40 de comissão e R$ 160 de repasse.

**Taxa do gateway:**
- pela modelagem do PDF (p. 13), sai da parte da plataforma (R$ 40 − R$ 5);
- **padrão provisório: a plataforma absorve** (D1b);
- o profissional recebe 80% cheio.

**`PaymentProvider` (interface):**
- operações: `createCharge`, `getCharge`, `refund`, `createPayout`, `listTransactions(dia)` (para a conciliação) e recebimento de webhook com verificação de assinatura;
- implementações:
  - `TestProvider`: usado em desenvolvimento e piloto fechado. Aprova ou recusa conforme cenários de teste e mostra "pagamento de teste" na interface;
  - `<GatewayEscolhido>Provider`: implementado só depois da decisão D1, com sandbox do fornecedor.

**Razão (`ledger_entries`):** todo movimento vira lançamento.
- tipos: cobrança, comissão, a repassar, taxa do gateway, estorno, chargeback, repasse;
- regra: a soma por pedido sempre fecha (teste obrigatório).

**Segregação** (p. 18): valores "a repassar" ficam separados dos da empresa nos relatórios. A separação bancária real é decisão contábil.

**Portão para pagamento real (P10):** `PAYMENTS_LIVE=true` só é aceito se:
1. o gateway estiver contratado e o parecer registrado (ADM-21);
2. houver testes automatizados de cobrança, estorno total e parcial, chargeback, conciliação com divergência e repasse com dois níveis;
3. um piloto com o `TestProvider` estiver concluído sem divergência.

---

## 8. Indicadores (ADM-20)

Fonte: p. 16 e 18. Todos calculados no backend, por período.

| Dimensão | Indicador | Fórmula |
|---|---|---|
| Marketplace | Clientes ativos | Clientes com pedido ou login nos últimos 30 dias |
| | Profissionais ativos | Aprovados com aceite ou disponibilidade nos últimos 30 dias |
| | Pedidos / serviços concluídos | Contagem por estado |
| | Taxa de atendimento (liquidez) | Pedidos aceitos ÷ pedidos solicitados |
| | Tempo para encontrar profissional | Mediana de (aceite − solicitação) |
| Comercial | Conversão | Cadastro → 1ª solicitação → 1º concluído (funil) |
| | Recorrência | % de clientes com 2 ou mais concluídos no período |
| | Ticket médio | GMV ÷ concluídos |
| | CAC | Gasto de marketing **informado manualmente** no painel ÷ novos clientes (ou profissionais ativados) |
| | Origem dos clientes | Campo opcional "como conheceu" no cadastro |
| Financeiro | GMV | Soma dos serviços concluídos |
| | Comissão efetiva | Comissão ÷ GMV |
| | Repasses, taxas, estornos, chargebacks | Soma no razão |
| | Contribuição por serviço | (Comissão − taxa do gateway − tributo estimado) ÷ concluídos. O tributo usa um parâmetro (padrão 8% da comissão, hipótese do PDF, a confirmar com o contador) |
| Qualidade | Nota média | Média das avaliações publicadas |
| | Reclamações, incidentes, cancelamentos, no-show | Contagens e taxas |
| | Tempo de resolução | Mediana por gravidade e % dentro do prazo |
| Produto | Sucesso de pagamento | Pagas ÷ tentativas |
| | Abandono | Pedidos iniciados e não confirmados |
| | Falhas e tempo de resposta | Erros 5xx e latência p95 da API (dos logs) |

Caixa, runway e DRE (p. 16 e 18) ficam **fora do software**: são ferramentas financeiras da empresa.

---

## 9. Requisitos não funcionais (NFR)

| ID | Requisito | Critério |
|---|---|---|
| NFR-01 | Segurança por desenho | Todas as tabelas novas com RLS ligado e sem acesso público. Funções privilegiadas conferem a permissão. Gatilhos impedem alterar estados financeiros e de verificação fora do fluxo |
| NFR-02 | Criptografia | TLS em trânsito. Chave Pix e dados bancários criptografados em repouso (chave no `.env` do backend). Senhas com scrypt (já existe) |
| NFR-03 | Consentimentos | Tabela `consents` (tipo, versão, data, revogação): termos, privacidade, dados biométricos (selfie, quando existir), ficha do beneficiário, marketing (opcional). A tela mostra e permite revogar o que for revogável |
| NFR-04 | Retenção | Política por tipo de dado (D11), com rotina de eliminação ou anonimização. Conclui a exclusão de conta (já iniciada na migração 005) |
| NFR-05 | Backups e recuperação | Documentar o plano do Supabase (backup diário e PITR, conforme o plano contratado), teste de restauração trimestral e procedimento de recuperação em `docs/OPERACAO.md` |
| NFR-06 | Monitoramento e logs | Logs estruturados sem dados pessoais (já é a regra). Health check e alerta de indisponibilidade. Ferramenta de erros (ex.: Sentry) só depois da análise P8 |
| NFR-07 | Acessibilidade | Manter o padrão atual em todas as telas novas, inclusive no painel web (WCAG AA) |
| NFR-08 | Linguagem simples | Textos curtos, sem jargão, para usuários com pouca familiaridade digital (p. 7) |
| NFR-09 | Testes | Cada fase mantém 100% dos testes passando. Fluxos financeiros com testes de soma do razão e de concorrência (aceite duplo, repasse duplo) |
| NFR-10 | Desempenho | Busca e listas paginadas, com p95 abaixo de 500 ms no volume do piloto |

---

## 10. Fases de implementação (ordem obrigatória)

Cada fase termina com testes passando, relatório e aprovação do responsável antes da próxima.

| Fase | Entrega | Requisitos |
|---|---|---|
| **F0: Ajuste de escopo** | Recife ativo e SP inativo; novo catálogo não clínico; profissões clínicas ocultas; aprovação por categoria; comissão configurável em 20% | P1–P3, CAT-01..05, ADM-22 (comissão) |
| **F1: Painel admin web (base)** | `admin-web/`, login com 2º fator, RBAC, painel inicial, clientes, profissionais, verificação documental, aprovação por categoria, fotos, categorias e regiões, auditoria | ADM-01..09, ADM-18, PRO-01, PRO-02, OPS-01 |
| **F2: Pedido de atendimento** | Validação de e-mail, busca com preço, solicitação agendada e imediata, resumo, aceite e recusa, agenda com bloqueios, endereço depois do aceite, notificações no app | CLI-01, 02, 04, 05, 06, 09, PRO-03..06, ADM-10 |
| **F3: Execução e avaliação** | Check-in por código, check-out, confirmação e contestação, avaliações nos dois sentidos, emergência | CLI-10, 11, 13, PRO-07..09, PRO-12, CLI-03 |
| **F4: Atendimento e incidentes** | Ocorrência ligada ao pedido, gravidade, prazo, escalonamento, painel de atendimento, bloqueio preventivo, bloqueio de contato no chat | CLI-12, ADM-16, 17, OPS-03..05, OPS-07 |
| **F5: Pagamentos (teste)** | `PaymentProvider` + `TestProvider`, razão, cobrança, comprovante, reembolso por cancelamento | CLI-07, 08, seção 7 |
| **F6: Repasses e conciliação** | Extrato, repasses D+N, dois níveis, estornos, chargeback, conciliação diária, gestão de comissões | PRO-10, 11, ADM-11..15 |
| **F7: Relatórios e indicadores** | Relatórios financeiros, indicadores, revisão mensal | ADM-19, 20, OPS-06 |
| **F8: Conformidade e operação** | Consentimentos, retenção, revisão periódica, backups e recuperação documentados, monitoramento | NFR-03..06, OPS-02, ADM-21 |
| **F9: Prontidão** | Checklist da p. 19 aplicado ao software: fluxos críticos de ponta a ponta, segurança, recuperação, gateway real (só com D1 decidido) | P10, NFR-09 |

---

## 11. Decisões pendentes (bloqueiam ou usam padrão provisório)

Os padrões abaixo **destravam o desenvolvimento**, mas ficam **configuráveis** e marcados como provisórios na interface do admin.

| # | Decisão | Padrão provisório nesta especificação | Bloqueia |
|---|---|---|---|
| D1 | Gateway de pagamento (Asaas, Pagar.me, Mercado Pago, Stripe…) | `TestProvider` | Pagamento real (F9) |
| D1b | Quem absorve a taxa do gateway, Pix e chargeback | A plataforma absorve | — |
| D2 | Prazo do repasse | D+7 depois da conclusão confirmada | — |
| D3 | Taxa de cancelamento tardio (menos de 24 h) | 50% para o profissional | — |
| D4 | Janela de confirmação e contestação | 24 h | — |
| D5 | Tempo-limite de aceite do imediato | 10 min | — |
| D6 | Limite de reincidência (no-show) | 3 em 30 dias | — |
| D7 | Provedor de e-mail transacional | Console em desenvolvimento | Validação de e-mail em produção |
| D8 | Limite para aprovação em dois níveis | R$ 500 | — |
| D9 | Periodicidade da revisão de perfil | 12 meses | — |
| D10 | Prazos por gravidade | 1 h / 4 h / 24 h / 72 h | — |
| D11 | Prazos de retenção por tipo de dado | A definir com o jurídico | F8 |
| D12 | Bairros e raio da área-piloto em Recife | Recife inteiro; raio do profissional como hoje | — |
| D13 | Faixas de preço de Recife por categoria | Valores provisórios (o ticket de R$ 200 do PDF é hipótese) | — |
| D14 | Fornecedor de push | Notificação dentro do app (polling) | Aviso com o app fechado |
| D15 | Enfermeiros e fisioterapeutas já cadastrados | Ficam com o perfil guardado, sem aparecer, até haver categoria clínica liberada | — |

---

## 12. Aprovação

Marque para autorizar a implementação:

- [ ] Escopo não clínico no MVP (P1), com enfermagem e fisioterapia ocultas
- [ ] Recife como área ativa e São Paulo inativo (P3)
- [ ] Comissão de 20% / repasse de 80% sobre o serviço concluído (P2)
- [ ] Painel admin como aplicação web separada (`admin-web/`)
- [ ] Ordem das fases F0 → F9
- [ ] Padrões provisórios da seção 11

**Autorizado por:** ______________________ **Data:** ___/___/______
