# Permissões — CUIDAR MAIS

**A regra de ouro: quem protege os dados é o backend.** A navegação do app só evita que a pessoa caia numa tela que não é dela. Esconder um botão não é controle de acesso.

## Camadas

| Camada | O que faz | Onde |
|---|---|---|
| 1. App (navegação) | `Stack.Protected` mostra a cada papel só a sua área; se a sessão muda, tira a pessoa da tela | `app/src/app/_layout.tsx` |
| 2. Backend (rotas) | toda rota autenticada confere o token no banco e o papel exigido | `backend/src/modules/guard.ts` |
| 3. Backend (dados) | consultas sempre filtradas pelo usuário da sessão; o id nunca vem do corpo da requisição | `backend/src/modules/*/routes.ts` |
| 4. Banco | gatilhos e funções impedem mudança de papel, estado e verificação fora do fluxo autorizado | `backend/migrations/001_auth_e_perfis.sql` |

## Matriz

| Ação | Cliente | Cuidador | Admin | Sem login |
|---|:-:|:-:|:-:|:-:|
| Cadastrar-se | ✅ | ✅ | ❌ (nunca pelo cadastro) | — |
| Ver e editar a própria conta (nome, telefone) | ✅ | ✅ | ✅ | ❌ |
| Editar o próprio papel ou estado | ❌ | ❌ | ❌ | ❌ |
| Perfil de cliente e preferências | ✅ próprio | ❌ 403 | ❌ | ❌ |
| Beneficiários | ✅ só os próprios | ❌ 403 | ❌ | ❌ |
| Perfil profissional | ❌ 403 | ✅ próprio | ❌ | ❌ |
| Enviar o próprio perfil para análise | ❌ | ✅ | ❌ | ❌ |
| Aprovar, reprovar ou suspender cuidador | ❌ | ❌ (nem o próprio) | ✅ (nunca a si mesmo) | ❌ |
| Suspender ou reativar conta | ❌ | ❌ | ✅ (nunca a si mesmo) | ❌ |
| Conceder admin | ❌ | ❌ | ❌ pela API — só `npm run admin:grant` com acesso ao banco | ❌ |
| Enviar documentos de verificação | ❌ 403 | ✅ próprios (não durante a análise) | — | ❌ |
| Ver documentos de verificação | ❌ | ✅ só a lista dos próprios (sem o arquivo) | ✅ ficha com links de 5 min, auditado | ❌ |
| Aceitar ou recusar documentos | ❌ | ❌ (bloqueado no banco) | ✅ ao aprovar ou reprovar | ❌ |
| Abrir chamado no suporte | ✅ | ✅ | — | ❌ |
| Ler e responder chamados | ✅ os próprios | ✅ os próprios | ✅ todos | ❌ |
| Conversar cliente ↔ profissional | só com solicitação (próxima etapa) | só com solicitação | — | ❌ |
| Editar ou apagar mensagem | ❌ | ❌ | ❌ | ❌ |
| Aceitar atendimentos | — | **só `approved`** (próxima etapa) | — | — |

## Comportamentos importantes

- **Recurso de outra conta responde `404`**, não `403`, para não confirmar que ele existe.
- **Campos desconhecidos são recusados (`400`)**, não ignorados. Enviar `role`, `status`, `verificationStatus` ou `guardianId` dá erro.
- **Conta suspensa:**
  - A suspensão revoga todas as sessões na hora.
  - Qualquer requisição com uma sessão antiga responde `403 ACCOUNT_SUSPENDED`, mesmo que a suspensão tenha sido feita direto no banco.
  - O login é recusado.
  - O app volta ao login com o aviso.
- **Admin no app:** cai na tela "Conta administrativa", porque o painel é web, e pode só sair.
- **Troca de conta no mesmo aparelho:**
  - Os dados de perfil ficam só em memória e são recarregados quando o usuário muda.
  - O logout apaga os tokens do SecureStore.
  - Nada da conta anterior fica guardado no aparelho.

## Como criar o primeiro administrador

1. Cadastre a conta normalmente pelo app, como cliente.
2. No computador com o `backend/.env` configurado, rode:
   ```bash
   cd backend
   npm run admin:grant -- email.da.pessoa@exemplo.com
   ```
3. As sessões dessa conta são encerradas. Ao entrar de novo, ela é admin. O perfil de cliente da conta é removido.

## Testes que comprovam as regras

Ficam em `backend/tests/permissions.test.ts`, rodando contra um PostgreSQL real:
- cliente × cuidador;
- usuário comum × admin;
- cuidador tentando se aprovar por três caminhos: API de perfil, rota de admin e UPDATE direto no banco;
- conta suspensa;
- dados de outra conta;
- auditoria imutável;
- alvos inexistentes.
