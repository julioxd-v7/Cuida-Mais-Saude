import { parseWhatsappNumber } from '@/config/env';
import { caregiverSpeech } from '@/features/search/format';
import type { PublicCaregiver } from '@/features/search/types';
import {
  ACCESSIBILITY_KEY,
  DEFAULT_ACCESSIBILITY,
  loadAccessibilityPrefs,
  parseAccessibilityPrefs,
  saveAccessibilityPrefs,
  scaleTypography,
  systemFontLimit,
} from '@/theme/accessibility';
import { resolveColors, type AppColors } from '@/theme/colors';
import type { PreferenceStorage } from '@/theme/preference';

function memoryStorage(): PreferenceStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: async (key) => data[key] ?? null,
    setItem: async (key, value) => {
      data[key] = value;
    },
  };
}

describe('preferências de acessibilidade', () => {
  it('padrão: tudo desligado e texto normal', () => {
    expect(parseAccessibilityPrefs(null)).toEqual(DEFAULT_ACCESSIBILITY);
    expect(parseAccessibilityPrefs('não é json')).toEqual(DEFAULT_ACCESSIBILITY);
  });

  it('aproveita o que for válido, campo a campo', () => {
    expect(parseAccessibilityPrefs('{"textSize":"xlarge","highContrast":true,"simpleMode":"sim"}')).toEqual({
      textSize: 'xlarge',
      highContrast: true,
      simpleMode: false,
      readAloud: false,
    });
    expect(parseAccessibilityPrefs('{"textSize":"gigante"}').textSize).toBe('normal');
  });

  it('salva e restaura', async () => {
    const storage = memoryStorage();
    const prefs = { textSize: 'large' as const, highContrast: true, simpleMode: true, readAloud: true };
    await saveAccessibilityPrefs(storage, prefs);
    expect(storage.data[ACCESSIBILITY_KEY]).toBeTruthy();
    expect(await loadAccessibilityPrefs(storage)).toEqual(prefs);
  });

  it('texto grande aumenta tamanho e altura de linha juntos', () => {
    expect(scaleTypography('normal').body.fontSize).toBe(16);
    const large = scaleTypography('large');
    expect(large.body.fontSize).toBe(19);
    expect(large.body.lineHeight).toBe(29);
    const xl = scaleTypography('xlarge');
    expect(xl.title.fontSize).toBe(34);
    expect(xl.caption.lineHeight).toBeGreaterThanOrEqual(xl.caption.fontSize);
  });

  it('limita o aumento do sistema para o texto não estourar a tela', () => {
    expect(systemFontLimit('normal')).toBe(1.8);
    expect(systemFontLimit('large')).toBe(1.5);
    expect(systemFontLimit('xlarge')).toBe(1.3);
  });
});

function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each([
  ['claro', resolveColors('light', true)],
  ['escuro', resolveColors('dark', true)],
] as [string, AppColors][])('alto contraste no tema %s (WCAG AAA)', (_name, c) => {
  it('texto principal e secundário ≥ 7:1; estados ≥ 7:1', () => {
    for (const bg of [c.background, c.surface, c.glass]) {
      expect(contrast(c.text, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(c.textMuted, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(c.accent, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(c.danger, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(c.warning, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(c.info, bg)).toBeGreaterThanOrEqual(7);
    }
  });

  it('superfícies opacas (sem transparência) e bordas visíveis', () => {
    expect(c.glass.startsWith('#')).toBe(true);
    expect(contrast(c.inputBorder, c.inputBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.placeholder, c.inputBackground)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('WhatsApp do suporte', () => {
  it('aceita só número brasileiro completo', () => {
    expect(parseWhatsappNumber('+55 (11) 91234-5678')).toBe('5511912345678');
    expect(parseWhatsappNumber('551133334444')).toBe('551133334444');
    expect(parseWhatsappNumber('11912345678')).toBeNull();
    expect(parseWhatsappNumber('')).toBeNull();
    expect(parseWhatsappNumber(undefined)).toBeNull();
  });
});

describe('leitura do perfil em voz alta', () => {
  it('lê só dados públicos, com valores por extenso', () => {
    const caregiver: PublicCaregiver = {
      id: '1',
      displayName: 'Ana Paula S.',
      profession: 'nurse',
      verified: true,
      council: { name: 'COREN', state: 'SP' },
      bio: 'Técnica de enfermagem há 8 anos.',
      experienceYears: 8,
      specialties: ['elderly'],
      serviceTypes: ['companionship', 'appointment_escort'],
      rates: [{ serviceType: 'companionship', hourlyRateCents: 4500 }],
      region: { district: 'Vila Mariana', city: 'São Paulo', state: 'SP', radiusKm: 15 },
      availabilityDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      availabilityPeriods: ['morning'],
      availableNow: true,
      favorite: false,
      verifiedSince: null,
    };
    const text = caregiverSpeech(caregiver);
    expect(text).toContain('Ana Paula S., Técnico(a) de enfermagem.');
    expect(text).toContain('Disponível agora.');
    expect(text).toContain('Vila Mariana e região, até 15 quilômetros');
    expect(text).toContain('Companhia e acompanhamento: 45 reais por hora.');
    expect(text).toContain('Ida a consultas e compromissos: valor sob consulta.');
    expect(text).toContain('Seg a Sex, Manhã.');
  });
});
