# Decisões de produto — CUIDAR+

Registradas em 27/10/2026, a partir das respostas do responsável pelo produto. Elas orientam a Parte 3b (pedido no estilo Uber) e as etapas 3 a 7 do plano global.

| Tema | Decisão | Consequência técnica |
|---|---|---|
| Preço | **Faixa definida pela plataforma** (mínimo e máximo por serviço); o profissional escolhe o valor dentro dela | Tabela de faixas por tipo de serviço editável pelo admin; validação no backend; pode variar por região |
| Pagamento | **Dentro do app** (Pix e cartão), com comissão retida e repasse ao profissional | Integração com gateway (a escolher); estados de pagamento; repasses; reembolsos. Até a integração, o fluxo fica claramente marcado como "pagamento em teste" |
| Tipo de atendimento | **Agendado e imediato** | Agendado: data, hora e duração. Imediato: só profissionais "disponíveis agora" num raio, com tempo-limite para aceitar |
| Escolha do profissional | **Os dois**: convidar um profissional da lista ou abrir o pedido para quem estiver perto | Convite direto (um profissional) ou pedido aberto (o primeiro apto que aceitar fica com ele) |
| Cancelamento do cliente | **Grátis até 24 h antes**; depois, taxa parcial para o profissional. Imediato: grátis até o aceite + 5 min | Regra calculada no backend; percentual da taxa a definir |
| Segurança no atendimento | **Código de chegada**, **botão de emergência**, **selfie com documento** no cadastro e **denúncia dos dois lados** | Código de 4 dígitos no check-in; botão que liga 192/190 e avisa suporte e contato de confiança; novo documento "selfie" analisado pelo admin; denúncias viram casos no suporte |
| Família | **Diário do atendimento + vários familiares** acompanhando o mesmo beneficiário | Convites para responsáveis; registros do profissional por atendimento; notificações |
| Abrangência | **Uma cidade só no lançamento: Recife - PE** (plano de negócios). Demais municípios da Região Metropolitana cadastrados e inativos. Brasil todo depois da aprovação *(27/10/2026: São Paulo; 30/10/2026: Recife, pela ESPECIFICACAO_MVP P3)* | Tabela `service_areas`: abrir uma cidade é um cadastro do admin, sem mudar código. Profissionais de outras cidades salvam o perfil e entram na lista de espera; cliente só busca em cidade liberada |

## Pontos de atenção

- **Atendimento imediato:** com poucos profissionais no início, o pedido imediato pode não ter ninguém disponível. A busca diz isso com clareza e sugere "qualquer horário".
- **Serviços:** só não clínicos no lançamento (ESPECIFICACAO_MVP P1). Comissão de 20% (P2), configurável no painel.
- **Cidade de lançamento:** Recife - PE (antes, São Paulo - SP, agora inativa). Para trocar, o admin cadastra a nova cidade e pausa a atual (`POST /v1/admin/service-areas`).
- **Pagamento no app:** exige escolher o gateway (ex.: Asaas, Pagar.me, Mercado Pago, Stripe) e tratar a parte fiscal e contratual da comissão com contador e advogado.
- **Selfie com documento:** é dado biométrico (sensível pela LGPD). Precisa de consentimento explícito, de armazenamento privado e de prazo de retenção.
- **Localização:** o profissional mostra só a região e a distância aproximada. O endereço do paciente só aparece para o profissional depois do aceite.
- **Pendentes:** percentual da comissão, taxa de cancelamento tardio, adicional noturno, tempo-limite de aceite do imediato, gateway e validação jurídica.
