# CUIDAR MAIS — App mobile

React Native + Expo SDK 57 + TypeScript, com rotas do Expo Router em `src/app`.

```bash
npm install
cp .env.example .env
npx expo start
```

| Script | Para quê |
|---|---|
| `npm start` | Servidor de desenvolvimento (QR code para o Expo Go) |
| `npm run typecheck` | Verificação de tipos |
| `npm run lint` | ESLint |
| `npm test` | Testes unitários (`tests/unit`) |
| `npm run check` | Os três acima de uma vez |
| `npm run format` | Formata o código com Prettier |

Guia completo, incluindo a configuração inicial do Jest e do ESLint: [`../docs/COMO-EXECUTAR.md`](../docs/COMO-EXECUTAR.md).
Organização do código: [`../docs/ARQUITETURA.md`](../docs/ARQUITETURA.md).
