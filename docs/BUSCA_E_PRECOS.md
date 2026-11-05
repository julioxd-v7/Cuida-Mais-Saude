# Busca de profissionais, área de atendimento e preços

Etapa 3 do plano global (home, busca e detalhes do cuidador). Migration `004_area_busca_e_precos.sql`, aplicada no Supabase em 27/10/2026.

> **Atualizado na F0 (30/10/2026, migration `006_catalogo_recife_comissao.sql`):** a cidade-piloto passou a ser **Recife - PE** e os serviços passaram a ser as **4 categorias não clínicas** do catálogo. Detalhes em `docs/CATALOGO_E_COMISSAO.md`.

## Área de atendimento (lançamento por cidade)

- O app começa em **uma cidade** (Recife - PE). Os outros 13 municípios da Região Metropolitana estão cadastrados e inativos; São Paulo ficou inativa. Tabela `service_areas`; só o admin cadastra ou pausa cidades (`admin_upsert_service_area`, com auditoria).
- Cidades são comparadas sem acento e sem maiúsculas (`normalize_city`): "São Paulo" = "sao paulo".
- **Profissional de outra cidade:** salva o perfil e os documentos, mas não envia para análise (`SERVICE_AREA_UNAVAILABLE`). O app mostra "lista de espera".
- **Cliente:** só busca em cidade liberada. Pedido para outra cidade responde `SERVICE_AREA_UNAVAILABLE`.
- **Abrir o Brasil todo:** cadastrar as cidades. Não precisa mudar código.

## Faixas de preço

- Por cidade e tipo de serviço, em centavos por hora (`service_price_ranges`). Só o admin altera (`admin_set_price_range`, com auditoria).
- **Valores provisórios de Recife** (decisão D13 pendente; o time define):

| Serviço | Faixa por hora |
|---|---|
| Companhia e acompanhamento | R$ 20 a R$ 45 |
| Apoio cotidiano | R$ 20 a R$ 45 |
| Ida a consultas e compromissos | R$ 25 a R$ 50 |
| Apoio à família | R$ 20 a R$ 40 |

## Valor do profissional

- Um valor por hora para cada categoria que o profissional escolheu no perfil (`caregiver_service_rates`).
- O banco recusa: categoria não escolhida ou desativada (`SERVICE_NOT_ALLOWED`), cidade não atendida, valor fora da faixa (`RATE_OUT_OF_RANGE`).
- Sem pelo menos um valor, o perfil não vai para análise (`RATES_MISSING`).

## Disponível agora

- Só perfis **aprovados** podem ligar (`NOT_APPROVED`). Desliga sozinho em **8 horas** e ao perder a aprovação (suspensão, nova análise).
- Quem está disponível aparece primeiro na busca e no filtro "Disponível agora".

## Busca (cliente)

`GET /v1/caregivers?city=&state=&serviceType=&specialty=&availableNow=&district=`

- Só perfis aprovados, de contas ativas, em cidades liberadas, com pelo menos uma categoria aprovada. O filtro de serviço usa só categorias **aprovadas**. Máximo de 50 por busca.
- Ordem: disponível agora → mesmo bairro informado → mais experiência → aprovado há mais tempo.
- **O cliente vê:** primeiro nome + inicial do sobrenome ("Ana Paula S."), profissão, selo, conselho e UF (sem o número), apresentação, experiência, especialidades, serviços e valores, bairro + cidade + raio, dias e períodos.
- **O cliente nunca vê:** CPF, número do conselho, telefone, e-mail, nome completo, endereço, documentos. Um teste automatizado confere isso.
- **Distância em km:** ainda não é mostrada. Exige a localização do aparelho e coordenadas aproximadas do bairro; entra com o pedido de atendimento.

## Favoritos

`GET /v1/favorites`, `POST /v1/favorites/:id`, `DELETE /v1/favorites/:id`. Só clientes, e só profissionais visíveis na busca. Quem for suspenso some dos favoritos.

## App

- **Abas do cliente:** Início, Buscar, Mensagens, Perfil.
- **Abas do profissional:** Início, Mensagens, Perfil. Agenda e Ganhos entram com os atendimentos.
- **Telas novas do cliente:** atalhos por tipo de serviço no Início, Busca com filtros, Perfil do profissional, Favoritos.
- **Telas novas do profissional:** Valor por hora, interruptor "Disponível agora" (aprovados) e aviso de lista de espera.
- O botão "Solicitar atendimento" aparece **desativado**, com aviso de que os pedidos chegam na próxima etapa.
