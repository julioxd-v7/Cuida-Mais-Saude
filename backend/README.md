# CUIDAR MAIS — Backend

API em Node.js + TypeScript, com PostgreSQL (Supabase, usado só como banco).

```bash
npm install
cp .env.example .env      # preencha DATABASE_URL
npm run migrate
npm run dev               # http://0.0.0.0:3333
```

| Script | Para quê |
|---|---|
| `npm run dev` | servidor com recarga automática |
| `npm run migrate` | aplica as migrations novas de `migrations/` |
| `npm run admin:grant -- email` | concede o papel de admin a uma conta existente |
| `npm test` | testes de integração contra um PostgreSQL real (`.env.test`) |
| `npm run typecheck` | verificação de tipos |

Estrutura: `src/modules/*` (rotas por domínio), `src/security` (senhas, tokens e limites), `src/db` (acesso ao banco e migrations) e `migrations/` (SQL versionado).

Documentação: [`../docs/AUTENTICACAO.md`](../docs/AUTENTICACAO.md), [`../docs/MODELO_DE_DADOS.md`](../docs/MODELO_DE_DADOS.md), [`../docs/PERMISSOES.md`](../docs/PERMISSOES.md) e [`../docs/COMO-EXECUTAR.md`](../docs/COMO-EXECUTAR.md).
