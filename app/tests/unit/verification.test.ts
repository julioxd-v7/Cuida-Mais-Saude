import { PROFESSION_INFO } from '@/constants/labels';
import { formatCpf, isValidCpf } from '@/features/auth/validation';
import { checkFile, latestByType, MAX_FILE_BYTES } from '@/features/caregiver/documentService';
import { missingFields, toInput, type FormValues } from '@/features/caregiver/profileForm';
import { verificationSteps } from '@/features/caregiver/verification';
import type { CaregiverDocument } from '@/features/profile/types';

const complete: FormValues = {
  profession: 'caregiver',
  cpf: '529.982.247-25',
  councilNumber: '',
  councilState: '',
  serviceDistrict: 'Centro',
  bio: 'Cuidadora há 8 anos, com curso de cuidador de idosos e primeiros socorros.',
  experienceYears: '8',
  specialties: ['elderly'],
  serviceCity: 'Recife',
  serviceState: 'PE',
  serviceRadiusKm: '10',
  availabilityDays: ['mon'],
  availabilityPeriods: ['morning'],
  categories: ['companionship'],
};

describe('CPF', () => {
  it('valida dígitos verificadores', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224724')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });

  it('formata enquanto digita', () => {
    expect(formatCpf('529')).toBe('529');
    expect(formatCpf('5299')).toBe('529.9');
    expect(formatCpf('5299822')).toBe('529.982.2');
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(formatCpf('529982247259999')).toBe('529.982.247-25');
  });
});

describe('perfil profissional', () => {
  it('cuidador completo não tem pendências', () => {
    expect(missingFields(complete)).toEqual([]);
  });

  it('sem profissão e CPF inválido aparecem como pendência', () => {
    const missing = missingFields({ ...complete, profession: null, cpf: '123' });
    expect(missing.includes('profissão')).toBe(true);
    expect(missing.includes('CPF')).toBe(true);
  });

  it('técnico de enfermagem precisa do COREN; fisioterapeuta do CREFITO', () => {
    expect(missingFields({ ...complete, profession: 'nurse' })).toEqual(['registro no COREN']);
    expect(missingFields({ ...complete, profession: 'physiotherapist' })).toEqual(['registro no CREFITO']);
    expect(missingFields({ ...complete, profession: 'nurse', councilNumber: '123456', councilState: 'SP' })).toEqual([]);
    expect(missingFields({ ...complete, categories: [] })).toEqual(['serviços que você oferece']);
    expect(toInput(complete).categories).toEqual(['companionship']);
  });

  it('envia o CPF só com dígitos e limpa o conselho de quem não precisa', () => {
    const input = toInput({ ...complete, councilNumber: '999', councilState: 'RJ' });
    expect(input.cpf).toBe('52998224725');
    expect(input.councilNumber).toBeNull();
    expect(input.councilState).toBeNull();
    expect(toInput({ ...complete, profession: 'nurse', councilNumber: '123', councilState: 'rj' }).councilState).toBe('RJ');
  });

  it('documentos exigidos por profissão', () => {
    expect(PROFESSION_INFO.caregiver.requiredDocuments.includes('course_certificate')).toBe(true);
    expect(PROFESSION_INFO.nurse.requiredDocuments.includes('council_card')).toBe(true);
    for (const info of Object.values(PROFESSION_INFO)) {
      expect(info.requiredDocuments.includes('criminal_record')).toBe(true);
    }
  });
});

describe('documentos', () => {
  it('recusa tipo e tamanho inválidos antes de enviar', () => {
    expect(checkFile({ uri: 'x', mimeType: 'application/pdf', size: 1000, name: 'a.pdf' })).toBeNull();
    expect(checkFile({ uri: 'x', mimeType: 'video/mp4', size: 1000, name: 'a.mp4' })).toContain('PDF');
    expect(checkFile({ uri: 'x', mimeType: 'image/jpeg', size: MAX_FILE_BYTES + 1, name: 'a.jpg' })).toContain('10 MB');
    expect(checkFile({ uri: 'x', mimeType: 'image/jpeg', size: 0, name: 'a.jpg' })).toContain('vazio');
  });

  it('considera o envio mais recente de cada tipo', () => {
    const doc = (id: string, docType: CaregiverDocument['docType'], createdAt: string): CaregiverDocument => ({
      id,
      docType,
      contentType: 'application/pdf',
      sizeBytes: 1,
      status: 'submitted',
      reviewNote: null,
      createdAt,
      submittedAt: null,
      reviewedAt: null,
    });
    const latest = latestByType([
      doc('a', 'identity', '2026-10-01T10:00:00Z'),
      doc('b', 'identity', '2026-10-02T10:00:00Z'),
      doc('c', 'criminal_record', '2026-10-01T10:00:00Z'),
    ]);
    expect(latest.identity?.id).toBe('b');
    expect(latest.criminal_record?.id).toBe('c');
  });
});

describe('etapas até o selo', () => {
  it('perfil incompleto: nada concluído', () => {
    const steps = verificationSteps({ verificationStatus: 'incomplete', missingDocuments: ['identity'], rates: [], serviceAreaActive: false });
    expect(steps.map((s) => s.done)).toEqual([false, false, false, false]);
  });

  it('perfil completo com documentos faltando', () => {
    const steps = verificationSteps({ verificationStatus: 'completed', missingDocuments: ['identity', 'criminal_record'], rates: [], serviceAreaActive: true });
    expect(steps.map((s) => s.done)).toEqual([true, false, false, false]);
    expect(steps[2]?.description).toContain('Faltam 2');
    expect(steps[1]?.href).toBe('/caregiver/rates');
  });

  it('aprovado: tudo concluído', () => {
    const steps = verificationSteps({ verificationStatus: 'approved', missingDocuments: [], rates: [{}], serviceAreaActive: true });
    expect(steps.map((s) => s.done)).toEqual([true, true, true, true]);
  });

  it('cidade ainda não atendida: lista de espera e valores bloqueados', () => {
    const steps = verificationSteps({ verificationStatus: 'completed', missingDocuments: [], rates: [], serviceAreaActive: false });
    expect(steps[0]?.description).toContain('lista de espera');
    expect(steps[1]?.href).toBeNull();
  });
});
