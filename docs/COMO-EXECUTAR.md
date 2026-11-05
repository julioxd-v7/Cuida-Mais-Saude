# Como executar e testar o CUIDAR MAIS

A partir da Parte 2, o projeto tem **duas partes que rodam juntas**:

| Pasta | O que é | Comando |
|---|---|---|
| `backend/` | servidor (API) em Node.js, ligado ao banco no Supabase | `npm run dev` |
| `app/` | aplicativo (Expo) | `npx expo start` |

O backend roda no seu computador e o celular conversa com ele pela rede Wi-Fi.

---

## 1. Pré-requisitos (uma vez só)

| Programa | Versão | Conferir |
|---|---|---|
| Node.js | **22.9 ou mais nova** (LTS) | `node -v` |
| Git | qualquer | `git --version` |
| Expo Go no celular | atualizado pela loja | — |

---

## 2. Atualizar seu repositório com a Parte 2

O zip mais recente (`cuidar-mais-menu-conta.zip`) traz só o que mudou. **Não traz** o `package.json` do app, para não apagar o que você já instalou (Jest, ESLint e Prettier).

1. Crie uma branch: `git checkout -b feature/parte2-autenticacao`
2. No repositório, **apague** as pastas `app/src`, `app/tests` e `app/assets` e a pasta `docs`.
   > É preciso apagar antes de copiar: arquivos antigos que saíram (como `useLoginForm.ts` e o logo `.jpeg`) não ficam para trás.
3. Copie do zip para o repositório: `backend/`, `docs/`, `README.md`, `app/src/`, `app/tests/`, `app/assets/`, `app/.env.example` e `app/app.json` (nome Cuidar+, ícones, splash clara e escura, tema automático).
4. Instale as bibliotecas novas do app. No PowerShell, dentro de `app`:
   ```powershell
   npx expo install expo-secure-store
   npx expo install expo-document-picker
   npx expo install expo-blur expo-linear-gradient
   npx expo install @react-native-async-storage/async-storage
   npx expo install @expo/vector-icons
   npx expo install expo-speech
   npx expo install @react-native-google-signin/google-signin
   npm install --save-exact zod@3.25.76
   ```

---

## 3. Banco de dados (Supabase)

O projeto **`cuidar-mais`** já foi criado na sua conta do Supabase, na região de São Paulo, e as tabelas já estão lá. Falta só a senha do banco, que ninguém conhece porque o projeto foi criado automaticamente.

1. Entre em [supabase.com](https://supabase.com) e abra o projeto **cuidar-mais**.
2. **Project Settings → Database → Reset database password.** Gere uma senha e guarde num lugar seguro. Não mande por chat e não coloque no código.
3. Clique em **Connect** (no topo) e copie a URI do **Session pooler** (porta **5432**).
   > Não use o "Transaction pooler" (porta 6543) nem a "Direct connection", que costuma não funcionar em redes domésticas.

---

## 4. Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Abra o `backend/.env` e cole a URI do passo 3 em `DATABASE_URL`, trocando `[YOUR-PASSWORD]` pela senha. Deixe `MAIL_TRANSPORT=console`.

**Envio de documentos (armazenamento privado):** no Supabase, vá em **Project Settings → API Keys → Secret keys** e copie a chave (começa com `sb_secret_`). Cole em `SUPABASE_SECRET_KEY` no `backend/.env`. O `SUPABASE_URL` já vem preenchido.
> ⚠️ Essa chave dá acesso total ao projeto. Só no `backend/.env`; nunca no app, no Git ou no chat. Sem ela, o resto funciona e o envio de documentos aparece como "indisponível".

```powershell
npm run migrate     # aplica o que faltar (hoje: a 006, catálogo + Recife + comissão) e diz que está atualizado
npm run dev         # sobe a API em http://0.0.0.0:3333
```

Para conferir, abra **http://localhost:3333/v1/health** no navegador. O esperado é `{"status":"ok"}`.

Deixe esse terminal aberto. É nele que aparecem os **códigos de recuperação de senha** enquanto não houver provedor de e-mail.

### Testes do backend

Em outro terminal:

```powershell
cd backend
Copy-Item .env.test.example .env.test   # cole a mesma URI do .env em TEST_DATABASE_URL
npm test
npm run typecheck
```

O esperado é **135 testes passando** e o typecheck sem erros. Os testes criam um schema temporário (`test_xxxxxxxx`) no banco, rodam e apagam esse schema no final. Os dados reais do schema `app` não são tocados.

---

## 5. App

1. Descubra o IP do seu computador na rede: `ipconfig` (Windows), na linha "Endereço IPv4", por exemplo `192.168.0.10`.
2. No `app/.env` (crie a partir do `.env.example` se não existir):
   ```env
   EXPO_PUBLIC_APP_ENV=development
   EXPO_PUBLIC_API_URL=http://192.168.0.10:3333
   ```
   > Use o IP, não `localhost`: para o celular, "localhost" é o próprio celular.
3. Para testar no **navegador** (Expo web), acrescente `CORS_ORIGINS=http://localhost:8081` no `backend/.env`. Nesse caso o app pode usar `http://localhost:3333`.
4. Rode as verificações e abra o app:
   ```powershell
   cd app
   npm run check          # typecheck + lint + 106 testes
   npx expo start -c      # -c limpa o cache (necessário depois de mudar o .env)
   ```

**Se o celular não alcançar o backend:**
- O celular e o PC precisam estar no mesmo Wi-Fi.
- Na primeira vez, o Windows pergunta se libera o Node.js no firewall: marque **Redes privadas**.
- Teste abrindo `http://SEU-IP:3333/v1/health` no navegador do celular.

---

## 6. Roteiro de teste manual

Faça no celular, com o backend rodando.

**Cliente**
1. Na tela "Entrar", toque em **Criar conta** e depois em **Preciso de um cuidador**.
2. Toque em **Criar conta** com tudo vazio. Cada campo obrigatório mostra o seu erro.
3. Digite senhas diferentes. Aparece "As senhas não são iguais."
4. Preencha certo, aceite os termos e crie a conta. Você cai em **Olá, (nome)**.
5. Em **Meu perfil**, troque o telefone e salve. Feche o app por completo e abra de novo. Você continua logado e o telefone novo está lá.
6. Toque em **Sair da conta**. Você volta para "Entrar".
7. Tente se cadastrar de novo com o **mesmo e-mail**. Aparece "Este e-mail já está cadastrado."
8. Entre com a senha errada. Aparece "E-mail ou senha incorretos." Depois entre com a certa.

**Profissional**

9. Saia e crie uma conta em **Sou profissional de cuidado**. O app abre o **Perfil profissional**.
10. Escolha **Cuidador(a)** (no lançamento, só ela aparece para novos cadastros) e marque **Serviços** (ex.: Companhia e acompanhamento). Digite um CPF inválido (ex.: 111.111.111-11) e salve: aparece "CPF inválido".
11. Complete o perfil com um CPF válido (você pode gerar um num gerador de CPF de teste), cidade **Recife** e UF **PE**, e salve. Em **Valor por hora**, informe um valor entre R$ 20 e R$ 45. Volte ao início e confira as etapas.
12. Abra **Documentos** e envie um PDF ou uma foto em cada item obrigatório. Cada um passa a "Enviado".
13. No início, toque em **Enviar para verificação**. Aparece "Em análise", e não dá mais para trocar documentos.

**Administrador (analisar e aprovar)**

14. Crie uma terceira conta pelo app, como cliente, que será o admin. Depois, no terminal:
    ```powershell
    cd backend
    npm run admin:grant -- email.do.admin@exemplo.com
    ```
15. No PowerShell, entre como admin, veja a ficha com os documentos e aprove:
    ```powershell
    $login = Invoke-RestMethod -Method Post -Uri http://localhost:3333/v1/auth/login -ContentType 'application/json' -Body '{"email":"email.do.admin@exemplo.com","password":"SENHA_DO_ADMIN"}'
    $h = @{ Authorization = "Bearer $($login.accessToken)" }
    (Invoke-RestMethod -Uri http://localhost:3333/v1/admin/caregivers -Headers $h).caregivers | ForEach-Object { $_.user }
    $ficha = Invoke-RestMethod -Uri "http://localhost:3333/v1/admin/caregivers/ID_DO_PROFISSIONAL" -Headers $h
    $ficha.documents | Select-Object docType, status, downloadUrl     # abra os links no navegador (valem 5 min)
    Invoke-RestMethod -Method Post -Uri "http://localhost:3333/v1/admin/caregivers/ID_DO_PROFISSIONAL/verification" -Headers $h -ContentType 'application/json' -Body '{"status":"approved"}'
    ```
16. No app, entre como o profissional. Aparece o selo **✓ Verificado**.
17. Em **Perfil profissional**, troque a profissão e salve. O selo some e o perfil volta a precisar de análise.

**Suporte**

18. Como cliente, toque em **Mensagens e suporte → Falar com o suporte**, escolha um assunto e envie.
19. Responda como admin, usando o mesmo `$h` do passo 15:
    ```powershell
    $fila = (Invoke-RestMethod -Uri http://localhost:3333/v1/admin/support/conversations -Headers $h).conversations
    $id = $fila[0].id
    Invoke-RestMethod -Method Post -Uri "http://localhost:3333/v1/conversations/$id/messages" -Headers $h -ContentType 'application/json' -Body '{"body":"Olá! Como podemos ajudar?"}'
    ```
20. Em até 4 segundos, a resposta aparece no chat como **Equipe Cuidar Mais**. Na lista de mensagens aparece o contador de não lidas.

**Recuperar senha**

21. Em "Entrar", toque em **Esqueci minha senha**, digite o e-mail e toque em **Enviar código**.
22. Copie o código de 8 números que aparece **no terminal do backend**, digite-o com a nova senha e salve. Entre com a senha nova.

Anote o que não funcionar, com print, modelo do celular e a mensagem do terminal do backend, se houver.

---

## 7. Subir para o GitHub

```powershell
git add -A
git status      # confira: NENHUM .env, .env.test ou node_modules na lista
git commit -m "Parte 2: autenticação, cadastros, permissões e backend"
git push -u origin feature/parte2-autenticacao
```

Depois abra um Pull Request para a `main`.

> ⚠️ Nunca faça commit de `backend/.env` ou `backend/.env.test`: eles têm a senha do banco. Os dois já estão no `.gitignore`.

---

## 8. Problemas comuns

| Sintoma | Solução |
|---|---|
| Backend: `Configuração inválida: DATABASE_URL` | Confira o `backend/.env` |
| Backend: `password authentication failed` | Senha errada na URI; refaça o passo 3 |
| Backend: `ENOTFOUND` / `timeout` ao conectar | Use a URI do **Session pooler** |
| App: "não está conectado ao servidor" | `EXPO_PUBLIC_API_URL` vazio; preencha e rode `npx expo start -c` |
| App: "Não foi possível conectar" | Backend parado, IP errado ou firewall (seção 5) |
| `npm test` do backend: "Defina TEST_DATABASE_URL" | Crie o `backend/.env.test` |
| Código de recuperação não chega | Ele aparece no terminal do backend (`MAIL_TRANSPORT=console`) |
| "Envio de documentos indisponível" | Falta `SUPABASE_SECRET_KEY` no `backend/.env`; reinicie o backend |
| Documento: "O arquivo não chegou" | Conexão caiu no meio do envio; tente de novo |
| Expo web: erro de CORS | `CORS_ORIGINS=http://localhost:8081` no `backend/.env` e reinicie o backend |
