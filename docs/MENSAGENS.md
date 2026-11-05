# Mensagens e suporte — CUIDAR MAIS

## O que existe

| Tipo | Quem conversa | Situação |
|---|---|---|
| **Suporte** | cliente ou profissional ↔ equipe do Cuidar Mais | ✅ funcionando |
| **Atendimento** | cliente ↔ profissional | estrutura pronta; abre junto com as solicitações (próxima etapa) |

A conversa entre cliente e profissional **só pode existir ligada a uma solicitação de atendimento**. Assim nenhum desconhecido manda mensagem para um cuidador ou para uma família. O banco bloqueia a criação de conversa desse tipo por qualquer outro caminho.

## Regras

- Só participantes leem e escrevem. Pessoas de fora recebem `404`.
- Administradores acessam todos os chamados de suporte e respondem como **"Equipe Cuidar Mais"**.
- **Mensagens não podem ser editadas nem apagadas**, nem direto no banco. Isso protege as duas partes numa mediação.
- Conversa encerrada não recebe mensagens. Quem abriu o chamado pode encerrá-lo; só o admin reabre.
- Até 2000 caracteres por mensagem e 30 mensagens por minuto por pessoa.
- A tela de novo chamado lembra os números de emergência: **192 (SAMU)** e **190 (polícia)**.

## Como o app atualiza

Ainda não há servidor de tempo real. A tela de chat busca mensagens novas **a cada 4 segundos** enquanto está aberta (`GET /v1/conversations/:id?after=<id da última mensagem>`). O cursor é o id da mensagem, não a data, porque o banco guarda microssegundos e o JavaScript não. Notificações push e tempo real (WebSocket) ficam para uma etapa futura.

## API

| Método | Rota | Quem |
|---|---|---|
| GET | `/v1/conversations` | cliente, profissional (as próprias, com contagem de não lidas) |
| POST | `/v1/support/conversations` | cliente, profissional (`{ subject, message }`) |
| GET | `/v1/conversations/:id?after=` | participante; admin em chamados de suporte |
| POST | `/v1/conversations/:id/messages` | participante; admin em chamados de suporte |
| POST | `/v1/conversations/:id/status` | dono do chamado (encerrar) ou admin (encerrar/reabrir) |
| GET | `/v1/admin/support/conversations` | admin (fila: abertos primeiro) |

## Telas

| Tela | Rota | Acesso |
|---|---|---|
| Mensagens (lista + "Falar com o suporte") | `/messages` | início do cliente e do profissional; botão "Mensagens e suporte" |
| Novo chamado | `/messages/new` | também pelo botão "Falar com o suporte" em Minha conta |
| Conversa | `/messages/[id]` | — |
