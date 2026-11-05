# Docker — servidor do CUIDAR+

O que roda no Docker é **só o servidor (backend)**.
- **App (Expo):** continua fora, com `npx expo start` dentro de `app`. App de celular não roda em container.
- **Banco:** é o PostgreSQL do Supabase, na nuvem. Não precisa de container.

## Arquivos

| Arquivo | O que é |
|---|---|
| `docker-compose.yml` (raiz) | Sobe o servidor na porta 3333, lendo a configuração de `backend/.env` |
| `backend/Dockerfile` | Imagem Node 22 (Alpine), roda como usuário sem privilégios, com verificação de saúde em `/v1/health` |
| `backend/.dockerignore` | Impede que `.env`, `node_modules` e testes entrem na imagem |

**Nenhum segredo vai para dentro da imagem:** o Compose passa as variáveis do `backend/.env` na hora de rodar.

## Usar (Windows, com o Docker Desktop aberto)

Na pasta do projeto (a que tem `docker-compose.yml`):

```powershell
docker compose up --build -d      # constrói e sobe o servidor
docker compose ps                 # deve mostrar cuidar-backend "healthy" depois de ~20 s
docker compose logs -f backend    # logs (Ctrl+C para sair; o servidor continua rodando)
docker compose down               # desliga
```

Atualizar o banco (quando vier uma migração nova):
```powershell
docker compose run --rm backend node_modules/.bin/tsx src/scripts/migrate.ts
```

O app continua igual: `EXPO_PUBLIC_API_URL=http://SEU-IP:3333` no `app/.env`.

**Antes de subir pelo Docker, feche a janela do `npm run dev`.** Os dois usam a porta 3333 e não rodam juntos.

## Limitações atuais
- A imagem roda o TypeScript com `tsx`, sem etapa de compilação. Para produção, o próximo passo é compilar para JavaScript e usar uma imagem só com dependências de produção.
- A imagem ainda não foi construída e testada no ambiente de desenvolvimento do Claude, que não consegue baixar a imagem base do Node. Valide no seu computador.
