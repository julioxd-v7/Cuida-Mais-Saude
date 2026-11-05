# Auditoria do repositório — CUIDAR MAIS

**Data:** 21/10/2026 · **Repositório:** `github.com/julioxd-v7/Cuida-Mais-Saude` · **Branch auditada:** `main` (commit `990eaf5`)

Este documento registra o estado do repositório **antes** da Parte 1 (fundação), o que foi encontrado e o que se decidiu fazer.

---

## 1. Resumo

O repositório contém um projeto Expo recém-criado a partir do template oficial (`create-expo-app`), com **uma única tela do produto: a tela de login**. O código do "MVP backend + frontend" citado no histórico **não está no repositório**. Nenhuma das 14 telas previstas existe.

## 2. Estrutura encontrada

```text
Cuida-Mais-Saude/
├── app/        ← app Expo (template + tela de login)
└── cuidarmais            ← "gitlink" (ponteiro de submódulo) SEM conteúdo
```

### 2.1 O problema do MVP ausente

| Commit | O que diz | O que realmente contém |
|---|---|---|
| `c4d2b0d` (16/09/2026) | "Adiciona MVP do CUIDAR MAIS (backend + frontend)" | Apenas um ponteiro de submódulo (`mode 160000`) com o nome antigo do repositório, apontando para o commit `c4dd4a0` do próprio repositório. **Nenhum arquivo.** |
| `8b4358d` | "Primeiro commit" | Renomeia esse ponteiro para `cuidarmais`. |

Não existe `.gitmodules`. Isso acontece quando se executa `git add` numa pasta que tem o próprio `.git` dentro: o Git guarda só a referência e não os arquivos. **Se o MVP existe, ele está apenas no computador de quem fez esse commit.**

A branch remota `dev` contém somente esse ponteiro e **apaga todo o `app`** em relação à `main`. Não faça merge de `dev` na `main` sem revisar.

## 3. Tecnologias e versões (app)

| Item | Versão |
|---|---|
| Expo SDK | ~57.0.23 |
| React Native | 0.86.3 |
| React | 19.2.3 |
| Expo Router | ~57.0.21 (rotas em `src/app`, typed routes e React Compiler ativos) |
| TypeScript | ~6.0.3, `strict: true` |
| react-native-reanimated / worklets | 4.5.1 / 0.10.1 |
| react-native-safe-area-context | ~5.7.0 |
| react-native-screens | ~4.26.0 |
| Gerenciador de pacotes | npm (`package-lock.json`) |

- Não há backend, banco de dados, variáveis de ambiente, testes ou configuração de ESLint. O script `lint` (`expo lint`) existia, mas sem configuração.
- `AGENTS.md` / `CLAUDE.md` orientam a seguir a documentação do Expo v57.

## 4. Telas previstas × encontradas

| # | Tela | Situação |
|---|---|---|
| 1 | SplashScreen | Não existe como tela. A splash nativa usava o **logo do Expo**. |
| 2 | UserTypeSelectionScreen | Não existe |
| 3 | RegisterScreen | Não existe |
| 4 | ClientRegisterScreen | Não existe |
| 5 | CaregiverRegisterScreen | Não existe |
| 6 | HomeScreen | O nome existe, mas o componente `HomeScreen` em `src/app/index.tsx` era, na verdade, a **tela de login** |
| 7–14 | CaregiverDetail, Booking, BookingConfirmation, Appointments, Search, Messages, Profile, CaregiverHome | Não existem |

**Tela de login (commit `df1e904`)**: logo, título "Entrar", campos de e-mail e senha e botão. Componentes próprios `Button` e `Input`. Problemas: o botão não fazia nada (`onPress={() => {}}`), não havia rótulos visíveis nem validação, os campos tinham altura de 40 (abaixo do mínimo recomendado de 48), a ilustração tinha 330 de altura com 62 de margem (empurrava o formulário para fora da tela em celulares pequenos) e as cores estavam fixas no código.

## 5. Outros problemas encontrados

1. Código de exemplo do template ainda ativo: aba "Explore", tabs nativas experimentais (`unstable-native-tabs`), animação da splash com logo do Expo, `web-badge`, `collapsible` e outros.
2. Ícones (`icon.png`, ícones adaptativos do Android, `assets/expo.icon` do iOS) e splash eram os padrões do Expo.
3. `.gitignore` não ignorava `.env` (só `.env*.local`), o que dava risco de versionar segredos.
4. A imagem da tela de login ficava dentro de `src/app/`, a pasta de rotas.
5. `userInterfaceStyle: automatic` sem tema escuro implementado na tela de login, o que gerava inconsistência no modo escuro.

## 6. Riscos de migração

Não há migração de tecnologia: o projeto já é React Native + Expo + TypeScript, como pede a especificação. Os riscos são outros:

- **MVP perdido**: se o código do MVP aparecer depois, será preciso conciliá-lo com esta fundação. As telas dele devem ser adaptadas à estrutura `src/features/*` e aos componentes de `src/components/ui`, não copiadas por cima.
- **Expo SDK 57 é recente**: bibliotecas novas devem ser instaladas sempre com `npx expo install`, que escolhe versões compatíveis.

## 7. Decisões

| Decisão | Motivo |
|---|---|
| Manter Expo SDK 57 e Expo Router em `src/app` | É o que já existe e atende à especificação; não há razão para mudar. |
| Preservar a tela de login, evoluindo-a | É o único trabalho do time no app. Mantidos o layout (logo → título → campos → botão) e os textos. |
| Evoluir `Button` e `Input` no lugar (sem duplicar) | Viraram `src/components/ui/Button.tsx` e `TextField.tsx`. |
| Remover o código de exemplo do template | Nada do produto dependia dele, e ele confundia a estrutura. |
| Não criar as 13 telas ausentes | O prompt proíbe telas falsas. Elas entram no roadmap com o fluxo real. |
| Não simular login | A tela chama o serviço real. Sem backend, ela informa que o servidor ainda não está disponível. |
| Tema claro fixo por enquanto | Evita telas meio escuras. O modo escuro entra junto com a identidade visual final. |
| Manter as dependências do template no `package.json` | Algumas ficaram sem uso (`@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-web-browser`, `expo-device`). Removê-las sem rodar o app seria arriscado; fica como pendência depois da validação. |
| Base visual neutra a partir do logo | A identidade final será desenhada com o time, a partir de referências. |

## 8. Limitações desta auditoria

A fundação foi preparada num ambiente sem acesso ao registro do npm. Por isso, **não foi possível instalar as dependências, rodar o app, o `tsc` completo, o ESLint ou o Jest**. O que foi verificado está em [`ROADMAP.md` › Validação da Parte 1](./ROADMAP.md#validação-da-parte-1). A validação completa no computador do time está descrita em [`COMO-EXECUTAR.md`](./COMO-EXECUTAR.md).

---

## 9. Auditoria da Parte 2 (26/10/2026)

| Item | Encontrado |
|---|---|
| O que a Parte 1 concluiu | Fundação validada pelo time: `typecheck`, `lint`, 18/18 testes, `expo-doctor` 21/21 e login no Expo web. Falta o teste em celular. |
| Telas de cadastro existentes | Nenhuma. Só o login. |
| Backend | Não existia. O MVP citado no histórico continua ausente do repositório. |
| Banco de dados | Não havia. A conta do Supabase do time tinha um projeto de outro assunto ("TattoinLine"), que **não foi tocado**. |
| Autenticação | Nenhuma. A tela de login chamava um endpoint que não existia. |
| Dados simulados | Nenhum. |
| Dependências | `expo-secure-store` e `zod` precisavam ser instalados no app. O backend foi criado do zero. |

**Decisões:**
- Backend próprio em Node.js, por escolha do time.
- PostgreSQL num projeto novo do Supabase (`cuidar-mais`, São Paulo), usado apenas como banco.
- Detalhes em `AUTENTICACAO.md`.
