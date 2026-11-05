import { parseApiUrl, parseAppEnvironment } from '@/config/env';

describe('configuração de ambiente', () => {
  it('usa development como padrão', () => {
    expect(parseAppEnvironment(undefined)).toBe('development');
    expect(parseAppEnvironment('qualquer')).toBe('development');
    expect(parseAppEnvironment('production')).toBe('production');
  });

  it('valida a URL da API', () => {
    expect(parseApiUrl(undefined, 'development')).toBeNull();
    expect(parseApiUrl('   ', 'development')).toBeNull();
    expect(parseApiUrl('não é url', 'development')).toBeNull();
    expect(parseApiUrl('http://192.168.0.10:3333/', 'development')).toBe('http://192.168.0.10:3333');
  });

  it('exige https em produção', () => {
    expect(parseApiUrl('http://api.exemplo.com', 'production')).toBeNull();
    expect(parseApiUrl('https://api.exemplo.com', 'production')).toBe('https://api.exemplo.com');
  });
});
