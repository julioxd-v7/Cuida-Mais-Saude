import { EMERGENCY_NOTICE, isServiceType, SERVICE_TYPE_OPTIONS, serviceTypeLabel } from '@/constants/labels';
import { categoriesFor, durationLabel, scopeSpeech } from '@/features/catalog/scope';
import type { ServiceCategory } from '@/features/catalog/types';

const category = (code: string, extra: Partial<ServiceCategory> = {}): ServiceCategory => ({
  code,
  name: `Nome ${code}`,
  description: '',
  includes: ['Presença e conversa'],
  excludes: ['Medicação'],
  requiredDocuments: [],
  minHours: 2,
  maxHours: 12,
  cancellationPolicy: null,
  emergencyNotice: null,
  clinical: false,
  allowedProfessions: [],
  enabled: true,
  ...extra,
});

describe('categorias de serviço (MVP não clínico)', () => {
  it('o app só conhece as 4 categorias não clínicas', () => {
    expect(SERVICE_TYPE_OPTIONS.map((o) => o.value)).toEqual([
      'companionship',
      'daily_support',
      'appointment_escort',
      'family_support',
    ]);
    expect(isServiceType('physiotherapy')).toBe(false);
    expect(isServiceType('care')).toBe(false);
    expect(serviceTypeLabel('nursing_procedure')).toBe('Outro serviço');
    expect(serviceTypeLabel('companionship')).toBe('Companhia e acompanhamento');
  });

  it('aviso de emergência cita 192 e 190', () => {
    expect(EMERGENCY_NOTICE).toContain('192');
    expect(EMERGENCY_NOTICE).toContain('190');
  });

  it('fichas das categorias do profissional, na ordem do catálogo', () => {
    const catalog = [category('companionship'), category('daily_support'), category('appointment_escort')];
    expect(categoriesFor(catalog, ['appointment_escort', 'companionship', 'nao_existe']).map((c) => c.code)).toEqual([
      'companionship',
      'appointment_escort',
    ]);
  });

  it('duração e texto para ouvir', () => {
    expect(durationLabel({ minHours: 2, maxHours: 12 })).toBe('2 a 12 horas por atendimento');
    expect(durationLabel({ minHours: 1, maxHours: null })).toBe('mínimo de 1 hora');
    expect(durationLabel({ minHours: null, maxHours: null })).toBeNull();
    expect(scopeSpeech(category('companionship'))).toBe(
      'Nome companionship. Inclui: Presença e conversa. Não inclui: Medicação.',
    );
  });
});

describe('profissões no lançamento', () => {
  it('novo cadastro só vê cuidador(a); perfil antigo de enfermagem continua vendo a sua', async () => {
    const { professionOptionsFor } = await import('@/constants/labels');
    expect(professionOptionsFor(null).map((o) => o.value)).toEqual(['caregiver']);
    expect(professionOptionsFor('nurse').map((o) => o.value)).toEqual(['caregiver', 'nurse']);
  });
});
