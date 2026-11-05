# Roadmap — CUIDAR MAIS

Etapas pequenas, testáveis e em ordem de dependência. Cada etapa só começa quando a anterior roda no celular sem erros conhecidos.

Legenda: ✅ feito · 🔜 próxima · ⬜ pendente

---

## Parte 1 — Fundação ✅

- ✅ Auditoria do repositório (`docs/AUDITORIA.md`)
- ✅ Arquitetura documentada (`docs/ARQUITETURA.md`)
- ✅ Limpeza do código de exemplo do template
- ✅ Estrutura `features / components / services / config / theme`
- ✅ Design system inicial com tokens e componentes base (base neutra, a partir do logo)
- ✅ Contêiner de tela com área segura, teclado, rolagem e tablet
- ✅ Configuração de ambiente validada e `.env.example`
- ✅ Cliente HTTP e tratamento centralizado de erros
- ✅ Tela de login preservada e ligada ao serviço real (sem simulação)
- ✅ Ícones e splash com o logo do CUIDAR MAIS
- ✅ Testes unitários da lógica (18 testes)
- ✅ Validação no computador do time: `typecheck`, `lint`, 18/18 testes no Jest, `expo-doctor` 21/21 e login conferido no Expo web
- ⬜ Abrir no celular pelo Expo Go (Android e iOS)

---

## Parte 2 — Autenticação, cadastros, permissões e persistência ✅ (falta validar aí)

- ✅ Backend Node.js + TypeScript (`backend/`), com PostgreSQL no Supabase (`cuidar-mais`, São Paulo)
- ✅ Migration 001 aplicada: usuários, perfis, beneficiários, sessões, recuperação de senha e auditoria
- ✅ Proteções no banco: papel, estado e verificação só mudam pelo fluxo autorizado
- ✅ Cadastro de cliente e de cuidador, login, logout, refresh com rotação e restauração da sessão
- ✅ Recuperação de senha com código (envio por e-mail **pendente** de provedor)
- ✅ Estados de verificação do cuidador separados da autenticação; aprovação só por admin
- ✅ Rotas protegidas por papel no app (`Stack.Protected`) e no backend
- ✅ Telas: seleção de tipo, cadastro (cliente/cuidador), recuperação, termos (rascunho), início do cliente, início do cuidador, perfil, perfil profissional
- ✅ 58 testes do backend contra PostgreSQL real e 48 testes de lógica do app
- ⬜ Rodar aí: `npm test` no backend contra o Supabase, `npm run check` no app e o roteiro manual no celular
- ⬜ Configurar provedor de e-mail para a recuperação de senha em produção

### Validação da Parte 2

| Verificação | Resultado |
|---|---|
| Testes do backend (58) contra PostgreSQL 16 real | ✅ todos passaram, com um adaptador de teste (psql) no lugar do driver `pg`, que não pôde ser instalado no ambiente de desenvolvimento |
| Tipos do backend (modo estrito) | ✅ sem erros (com tipos provisórios do `pg`) |
| Migration no Supabase + teste de fumaça (cadastro e tentativa de virar admin) | ✅ cadastro funcionou, escalada bloqueada, tudo desfeito |
| Avisos de segurança do Supabase | ✅ só "RLS sem políticas", que é intencional |
| Testes de lógica do app (48) | ✅ com executor compatível com Jest; **rodar `npm test` aí** |
| Tipos das telas e componentes do app | ⚠️ não verificados aqui (sem os tipos do React Native); **rodar `npm run typecheck` aí** |
| Backend com o driver `pg` de verdade contra o Supabase | ⚠️ **rodar `npm test` no backend aí** |
| Fluxo completo no celular | ⚠️ não executado |

---

## Parte 3a — Profissões, verificação e suporte ✅ (falta validar aí)

- ✅ Categorias: cuidador(a), técnico(a) de enfermagem, fisioterapeuta, com tipos de serviço por categoria
- ✅ CPF validado e único; registro no COREN/CREFITO para técnico de enfermagem e fisioterapeuta
- ✅ Documentos (antecedentes, identidade, comprovante, certificados, conselho) no Supabase Storage privado, por link de envio
- ✅ Etapas até o selo, análise pelo admin com links temporários e auditoria, **selo de verificado**
- ✅ Mensagens: estrutura única; **suporte** funcionando no app (cliente e profissional)
- ✅ 94 testes do backend e 63 testes de lógica do app
- ⬜ Configurar `SUPABASE_SECRET_KEY` no `backend/.env` e testar o envio de documentos no celular

## Plano global de interfaces — Etapa 1: design system e temas ✅ (falta validar aí)

- ✅ Paleta nova (verde #10B981, azul #1685E8, verde profundo #073B3A) com tema **claro** e **escuro**
- ✅ Preferência **Automático / Claro / Escuro** em "Meu perfil → Aparência", salva e restaurada ao abrir o app
- ✅ Todas as telas e componentes existentes usam tokens do tema; nenhuma cor fixa fora de `src/theme/` (conferido por varredura)
- ✅ Vidro sutil nos dois temas; sombras e degradê reduzidos
- ✅ Logo e splash na versão certa para cada tema; status bar acompanha o tema
- ✅ Contraste WCAG testado automaticamente nos dois temas
- ✅ 72 testes de lógica do app (9 novos) · `docs/DESIGN_SYSTEM.md`
- ⬜ Validar no aparelho: troca de tema, desfoque no Android, `npm run typecheck`, `npm run lint`, `npm test`

Próximas etapas do plano: 2 autenticação e perfis · 3 home, busca e detalhes do cuidador · 4 solicitação e agendamento (junto da Parte 3b) · 5 operação do atendimento · 6 agenda, mensagens e avaliações · 7 financeiro · 8 painel admin · 9 site · 10 testes finais.

## Menu do usuário, configurações e login com Google ✅ (falta validar aí)

- ✅ Menus do cliente e do profissional com cabeçalho e informação de contexto no topo
- ✅ Abas: cliente (Início, Buscar, Agenda, Mensagens, Perfil) e profissional (Início, Agenda, Ganhos, Mensagens, Perfil)
- ✅ Beneficiários (CRUD) e endereços salvos
- ✅ Central de segurança e suporte (denúncia, incidente, 192/190)
- ✅ Configurações: aparência, dados pessoais, senha e aparelhos, privacidade, acessibilidade, termos, exclusão de conta, versão
- ✅ Login com Google com verificação real do token no backend (botão aparece só quando configurado)
- ⏳ "Em breve" (sem ação): pagamentos e recibos, notificações, avaliações, extrato e repasses
- ✅ 125 testes do backend · 101 testes de lógica do app · `docs/CONTA_E_ACESSO.md`
- ⬜ Aplicar a migration 005 no Supabase · criar credenciais Google · validar no aparelho

## Acessibilidade ✅ (falta validar aí)

- ✅ Tela de Acessibilidade aberta também antes do login
- ✅ Tamanho do texto (Normal, Grande, Muito grande), sem cortar texto
- ✅ Alto contraste nos temas claro e escuro (≥ 7:1, testado)
- ✅ Leitura em voz alta (botão "Ouvir") em avisos, chat, perfil do profissional e início simplificado
- ✅ Modo simplificado do cliente, com botões grandes e emergência 192
- ✅ WhatsApp do suporte opcional (só aparece se configurado)
- ✅ 92 testes de lógica do app
- ⬜ Validar aí: voz no celular (no iPhone, sem modo silencioso), layout com "Muito grande", TalkBack/VoiceOver

## Plano global — Etapa 3: busca e perfil do cuidador ✅ (falta validar aí)

- ✅ Lançamento em **uma cidade** (São Paulo - SP), configurável pelo admin; outras cidades entram na lista de espera
- ✅ Faixas de preço por cidade e serviço (valores de exemplo) e valor por hora do profissional dentro da faixa
- ✅ "Disponível agora" para aprovados, com expiração em 8 h
- ✅ Busca com filtros (serviço, disponível agora, bairro), perfil público sem dados pessoais e favoritos
- ✅ Abas inferiores do cliente e do profissional
- ✅ Migration 004 aplicada no Supabase · 110 testes do backend · 81 testes de lógica do app · `docs/BUSCA_E_PRECOS.md`
- ⬜ Validar aí: `npm run typecheck`, `npm run lint`, `npm test`, telas no celular

## Parte 3b — Pedido de atendimento no estilo Uber 🔜

1. Cliente escolhe o **tipo de serviço** (cuidado, procedimento de enfermagem, avaliação de enfermagem, fisioterapia), o beneficiário e o local; declaração de prescrição para procedimentos.
2. **Localização com privacidade:** o paciente informa o local; o profissional mostra só região e distância aproximada; o endereço completo só aparece após o aceite.
3. Busca de profissionais **aprovados e habilitados** para o serviço, por proximidade, com selo e avaliação.
4. Solicitação imediata ou agendada; o profissional vê a **ficha do atendimento** antes de aceitar ou recusar; máquina de estados no banco.
5. **Chat cliente ↔ profissional** aberto automaticamente com a solicitação (estrutura da Parte 3a).
6. **Avaliações** depois do atendimento, nos dois sentidos.
7. Visual no estilo Uber com as cores do Cuidar Mais (painel inferior, ação principal grande, acompanhamento do status).

## Parte 3 (plano anterior) — Fluxo central do marketplace

1. **Beneficiários no app** (a API já existe): telas de listar, cadastrar e editar a pessoa cuidada, com endereço de atendimento.
2. **Endereços e localização:** CEP → endereço (serviço de CEP chamado pelo backend), coordenadas e permissão de localização "durante o uso".
3. **Disponibilidade do cuidador** com agenda semanal de verdade (janelas de horário), substituindo os dias e períodos iniciais.
4. **Busca de cuidadores:** só `approved`, filtrando por cidade, raio, especialidade e disponibilidade; listagem e detalhe (`SearchScreen`, `CaregiverDetailScreen`).
5. **Solicitação de atendimento:** imediata ou agendada (`BookingScreen`, `BookingConfirmationScreen`), com tabela `service_requests` e máquina de estados no banco.
6. **Estrutura inicial do matching** no backend: candidatos compatíveis por região, especialidade e horário. Aceite e recusa pelo cuidador, bloqueados para quem não está `approved`.
7. Painel admin mínimo (web) para a fila de verificação, usando as rotas `/v1/admin/*` que já existem.

## Parte 4 — Design com referências ⬜

Pode correr em paralelo, sem bloquear as outras partes.

1. Coletar referências (apps e sites que o time gosta), anotando o que agrada em cada uma.
2. Definir tipografia (fonte própria com `expo-font`), refinar a paleta, ícones, ilustrações e tom de voz.
3. Atualizar apenas `src/theme` e `src/components/ui`. As telas herdam as mudanças.
4. Avaliar o modo escuro.

## Parte 5 — Dados sensíveis e documentos ⬜

- Observações de saúde da pessoa cuidada (RF007), com consentimento específico, criptografia de campo e registro de acesso.
- Upload de documentos do cuidador para bucket privado (RF013); o envio para análise passa a exigir documentos (RF014, RN002, RN006).
- Provedor de e-mail transacional (recuperação de senha e verificação de e-mail).

## Parte 6 — Atendimento: execução e histórico ⬜

- Aceite e recusa pelo cuidador, deslocamento, chegada e código de confirmação (RF017, RN007).
- `AppointmentsScreen` com histórico (RN011) e cronograma de cuidados (RF008).

## Parte 7 — Comunicação ⬜

- Chat (RF009, `MessagesScreen`) e notificações push (RF025).

## Parte 8 — Pagamentos ⬜

- Gateway com split, ledger em centavos, repasse só após a confirmação (RN010), conta bancária do cuidador (RF024), cancelamentos e reembolsos.
- **Antes de produção:** validar o modelo 75/25 com contador e advogado.

## Parte 9 — Segurança e confiança ⬜

- Botão de emergência durante o atendimento (RF012, RN013), denúncia (RF011, RN014), bloqueio (RN015), avaliações (RF021), reconhecimento facial e antecedentes via provedor (RF015, RF016).

## Parte 10 — Painel administrativo completo e operação ⬜

- Gestão de usuários (RF018, RF019), relatórios (RF020), incidentes, finanças e auditoria.
- Monitoramento de erros, builds EAS, lojas, testes de carga (RNF004, RNF005) e revisão de LGPD.

## Especificação do MVP — F0: ajuste de escopo ✅ (falta aplicar e validar aí)

- ✅ Catálogo só não clínico (4 categorias) com ficha completa; clínicas desativadas e travadas por parecer jurídico
- ✅ Aprovação por categoria; busca usa só categorias aprovadas
- ✅ Recife - PE ativo; demais municípios da RMR e São Paulo inativos; faixas provisórias de Recife
- ✅ Comissão configurável (20%) e padrões provisórios da seção 11 em `platform_settings`
- ✅ App: escolha de serviços no perfil, situação de cada um, ficha "inclui / não inclui" para o cliente, aviso 192/190
- ✅ 135 testes do backend · 106 testes de lógica do app · `docs/CATALOGO_E_COMISSAO.md`
- ⬜ `npm run migrate` (aplica a 006 no Supabase) · validar no celular
- ⏭️ Próxima: **F1, painel admin web**

