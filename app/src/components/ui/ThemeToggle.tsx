import { THEME_PREFERENCES, type ThemePreference, useTheme } from '@/theme';

import { SegmentedControl } from './SegmentedControl';

const LABELS: Record<ThemePreference, { title: string; description: string }> = {
  system: { title: 'Automático', description: 'Segue o modo do seu aparelho.' },
  light: { title: 'Claro', description: 'Fundo claro, ideal em ambientes iluminados.' },
  dark: { title: 'Escuro', description: 'Fundo escuro, mais confortável à noite.' },
};

/**
 * Escolha de aparência: Automático, Claro ou Escuro.
 * A troca vale na hora para o app inteiro e fica salva no aparelho.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl
      label="Aparência"
      value={preference}
      onChange={setPreference}
      options={THEME_PREFERENCES.map((value) => ({ value, label: LABELS[value].title, hint: LABELS[value].description }))}
      description={LABELS[preference].description}
    />
  );
}
