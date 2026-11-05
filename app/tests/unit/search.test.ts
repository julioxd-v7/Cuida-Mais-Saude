import {
  daysLabel,
  experienceLabel,
  formatMoney,
  formatRange,
  initials,
  moneyInput,
  parseMoney,
  periodsLabel,
  rateError,
  regionLabel,
  startingPrice,
} from '@/features/search/format';
import { buildSearchQuery } from '@/features/search/searchService';

const range = { serviceType: 'companionship' as const, minHourlyCents: 2500, maxHourlyCents: 6000 };

describe('valores', () => {
  it('formata em reais', () => {
    expect(formatMoney(4000)).toBe('R$ 40');
    expect(formatMoney(4550)).toBe('R$ 45,50');
    expect(formatMoney(120000)).toBe('R$ 1.200');
    expect(formatRange(range)).toBe('R$ 25 a R$ 60 por hora');
  });

  it('entende o que a pessoa digita', () => {
    expect(parseMoney('40')).toBe(4000);
    expect(parseMoney('45,5')).toBe(4550);
    expect(parseMoney('R$ 1.200,50')).toBe(120050);
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('40,555')).toBeNull();
    expect(moneyInput(4550)).toBe('45,50');
  });

  it('confere a faixa da cidade', () => {
    expect(rateError(4000, range)).toBeNull();
    expect(rateError(2500, range)).toBeNull();
    expect(rateError(6100, range)).toBe('Use um valor entre R$ 25 e R$ 60.');
    expect(rateError(null, range)).toContain('Informe');
    expect(rateError(4000, undefined)).toContain('faixa');
  });

  it('mostra o menor valor como "a partir de"', () => {
    expect(startingPrice([])).toBeNull();
    expect(
      startingPrice([
        { serviceType: 'appointment_escort', hourlyRateCents: 9000 },
        { serviceType: 'companionship', hourlyRateCents: 4500 },
      ]),
    ).toBe('a partir de R$ 45/h');
  });
});

describe('textos do perfil público', () => {
  it('região sem endereço', () => {
    expect(regionLabel({ district: 'Vila Mariana', city: 'São Paulo', state: 'SP', radiusKm: 15 })).toBe(
      'Vila Mariana e região · até 15 km',
    );
    expect(regionLabel({ district: null, city: 'São Paulo', state: 'SP', radiusKm: null })).toBe('São Paulo');
  });

  it('dias seguidos viram intervalo', () => {
    expect(daysLabel(['mon', 'tue', 'wed', 'thu', 'fri'])).toBe('Seg a Sex');
    expect(daysLabel(['fri', 'mon', 'wed'])).toBe('Seg, Qua, Sex');
    expect(daysLabel(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).toBe('Todos os dias');
    expect(daysLabel([])).toBe('Dias não informados');
  });

  it('períodos, experiência e iniciais', () => {
    expect(periodsLabel(['night', 'morning'])).toBe('Manhã, Noite');
    expect(experienceLabel(0)).toBe('Menos de 1 ano de experiência');
    expect(experienceLabel(1)).toBe('1 ano de experiência');
    expect(experienceLabel(8)).toBe('8 anos de experiência');
    expect(initials('Ana Paula S.')).toBe('AP');
    expect(initials('Joana')).toBe('J');
  });
});

describe('busca', () => {
  it('envia só os filtros escolhidos, com acentos codificados', () => {
    expect(buildSearchQuery({ city: 'São Paulo', state: 'SP' }, {})).toBe('city=S%C3%A3o%20Paulo&state=SP');
    expect(
      buildSearchQuery({ city: 'São Paulo', state: 'SP' }, { serviceType: 'daily_support', availableNow: true, district: ' Moema ' }),
    ).toBe('city=S%C3%A3o%20Paulo&state=SP&serviceType=daily_support&availableNow=true&district=Moema');
  });
});
