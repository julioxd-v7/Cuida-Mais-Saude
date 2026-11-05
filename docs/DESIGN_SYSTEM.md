# Design system — CUIDAR+

Etapa 1 do plano global de interfaces. Este documento descreve a identidade, os temas e as regras para criar telas novas.

## 1. Identidade

- **Marca:** CUIDAR+, "Cuidadores para cada momento". Símbolo de cuidado em verde e azul.
- **Logos** (`app/assets/images/`):
  - `logo-horizontal-dark.png`: letras escuras, para o tema claro;
  - `logo-horizontal-light.png`: letras claras, para o tema escuro;
  - `logo-mark.png`: só o símbolo;
  - `splash-icon-light.png` / `splash-icon.png`: splash clara e escura.
- O componente `BrandLogo` escolhe a versão certa sozinho. Não use `<Image>` direto para a logo.
- **Tom visual:** confiança, segurança e acolhimento. Vidro sutil, poucas sombras, degradê quase imperceptível, nada de cards desnecessários.

## 2. Paleta

| Papel | Claro | Escuro |
|---|---|---|
| Marca: verde / azul / verde profundo | `#10B981` / `#1685E8` / `#073B3A` | iguais |
| Fundo | `#F5F8F7` | `#0B1718` |
| Superfície | `#FFFFFF` | `#142526` |
| Texto principal | `#153330` | `#F0F7F5` |
| Texto secundário | `#526563` | `#B3C5C2` |
| Links e destaques (`accent`) | `#047857` | `#34D399` |
| Botão principal | verde com texto `#073B3A` | verde com texto `#0B1718` |
| Seleção (chips, aparência) | fundo `#073B3A`, texto branco | fundo `#F0F7F5`, texto `#0B1718` |
| Erro / aviso / informação | `#B42318` / `#8A5A00` / `#0B63C4` | `#FF8A80` / `#FBBF24` / `#6CB6FF` |

**Por que o texto do botão é escuro:** branco sobre o verde `#10B981` tem contraste 2,5:1 e não passa no WCAG. O verde com texto escuro passa (≥ 4,5:1).

**Contraste validado por teste** (`tests/unit/theme.test.ts`), nos dois temas, sobre fundo e superfície:
- texto principal ≥ 7:1 (AAA);
- secundário, links, erro, aviso, informação, sucesso, placeholder ≥ 4,5:1 (AA);
- botão principal e item selecionado ≥ 4,5:1.

## 3. Tokens

Tudo sai de `@/theme`:

| Grupo | Onde | O que tem |
|---|---|---|
| Cores | `colors.ts` | `AppColors` com os mesmos nomes nos dois temas: fundo, superfície, vidro, texto, botão, campos, seleção, bordas, estados (`success`, `danger`, `warning`, `info` + versões `Soft`) e `statusBar` |
| Tipografia | `tokens.ts` | `display`, `title`, `subtitle`, `body`, `bodyStrong`, `label`, `caption` (com `lineHeight` para não cortar texto no Android) |
| Espaçamento | `tokens.ts` | escala de 4: `xxs` 2 … `xxxl` 48 |
| Bordas | `tokens.ts` | `radius.sm` 6, `md` 12, `lg` 18, `xl` 26, `pill` |
| Elevação | `tokens.ts` | `elevation.card` (sombra leve só no iOS) |
| Ícones | `tokens.ts` | `iconSize.sm` 16 … `xl` 32 |
| Estados | `tokens.ts` | `interaction.pressedOpacity`, `disabledOpacity`; `touchTarget.min` 48 |
| Vidro | `tokens.ts` | `glass.blurIntensity` |

## 4. Como escrever uma tela que respeita o tema

```tsx
import { StyleSheet } from 'react-native';
import { spacing, type AppColors, useStyles, useTheme } from '@/theme';

export function MinhaTela() {
  const styles = useStyles(createStyles);   // estilos com cor
  const { colors } = useTheme();             // cor solta (ícone, spinner)
  return <View style={styles.box} />;
}

// Fora do componente, para ser criado uma vez por tema.
const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    box: { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing.md },
  });
```

Regras:
1. **Nenhuma cor fixa** (`#...`, `rgba(...)`) fora de `src/theme/`. Texto usa `<AppText tone="...">`.
2. Precisa de uma cor nova? Crie o token nos **dois** temas em `colors.ts` e um teste de contraste se for texto.
3. Use os componentes de `@/components/ui` antes de criar outros.
4. Alvo de toque mínimo de 48.

## 5. Componentes adaptados aos dois temas

`AppText`, `Button` (primary, secondary, ghost), `Card`/`GlassPanel`, `TextField`, `PasswordField`, `Checkbox`, `ChipGroup`, `FeedbackMessage`, `LoadingState`, `EmptyState`, `ErrorState`, `TextLink`, `VerifiedBadge`, `BrandLogo` (novo), `ThemeToggle` (novo), e o layout `Screen` + `Backdrop`.

Os componentes do plano global que dependem de funcionalidades ainda inexistentes (CaregiverCard, AppointmentCard, RatingStars, PaymentMethodCard, PriceBreakdown, BottomNavigation etc.) entram nas etapas em que essas funcionalidades forem construídas, para não criar componentes sem uso.

## 6. Preferência de tema

- `src/theme/preference.ts`: lógica pura (ler, validar, salvar, resolver "automático").
- `src/theme/ThemeProvider.tsx`: guarda a escolha em AsyncStorage (`cuidarmais.theme.v1`), ouve o modo do aparelho com `useColorScheme` e expõe `useTheme()`.
- Se o armazenamento falhar, o app usa "Automático" e continua funcionando.
- `app.json`: `"userInterfaceStyle": "automatic"`, necessário para o aparelho informar o modo escuro.

## 7. Acessibilidade

Tela **Acessibilidade** (`/accessibility`). Abre do login, da escolha de conta e do Perfil, e funciona também sem login. As escolhas ficam salvas no aparelho (`cuidarmais.a11y.v1`) e valem na hora.

| Opção | O que faz | Onde está no código |
|---|---|---|
| **Tamanho do texto** (Normal, Grande, Muito grande) | Multiplica tamanho **e** altura de linha por 1 / 1,2 / 1,4, somando-se ao tamanho de fonte do sistema. O aumento do sistema é limitado (1,8 / 1,5 / 1,3) para o total não estourar as telas | `theme/accessibility.ts` (`scaleTypography`, `systemFontLimit`); `useTheme().typography` |
| **Alto contraste** | Texto secundário quase igual ao principal, superfícies opacas (sem vidro), sem brilhos no fundo, bordas fortes. Funciona nos temas claro e escuro | `highContrastOverrides` em `theme/colors.ts`; testado ≥ 7:1 (AAA) |
| **Leitura em voz alta** | Botão "Ouvir" em avisos (`FeedbackMessage`), mensagens recebidas no chat, perfil do profissional e início simplificado. Usa a voz do aparelho (`expo-speech`, pt-BR) | `components/ui/ReadAloudButton.tsx` |
| **Modo simplificado** (cliente) | Início com 5 ou 6 botões grandes, um por linha: encontrar cuidador, alguém agora, favoritos, suporte, WhatsApp (se configurado) e emergência 192 (abre o discador). A busca esconde o filtro de bairro | `features/client/screens/SimpleClientHome.tsx` |

Regras para telas novas:
- Texto sempre por `<AppText>`. Se precisar de `fontSize` (ex.: `TextInput`), use `useTheme().typography`, **não** o `typography` fixo de `@/theme`.
- Nada de cor fixa: o alto contraste só funciona se a tela usar os tokens.
- Ações importantes com rótulo para leitor de tela (`accessibilityLabel`) e alvo de toque de pelo menos 48.
- O leitor de tela do sistema (TalkBack/VoiceOver) continua sendo o principal recurso para cegos. O "Ouvir" é um apoio para quem lê com dificuldade.

**WhatsApp do suporte:** opcional, em `EXPO_PUBLIC_SUPPORT_WHATSAPP` (público). Sem número, o botão não aparece.

## 8. Limitações conhecidas

- O desfoque real no Android exige Android 12+; antes disso aparece só a camada translúcida.
- Fonte ainda é a do sistema; uma fonte própria pode entrar depois, se você quiser.
- Telas web (painel admin e site) terão o próprio tema nas etapas 8 e 9, reaproveitando esta paleta.
