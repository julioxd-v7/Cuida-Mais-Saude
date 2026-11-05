import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createSupabaseStorage } from '../src/storage/fileStorage.ts';

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift() ?? { status: 200 };
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), {
      status: next.status,
      headers: next.headers,
    });
  }) as typeof fetch;
  return { calls, impl };
}

describe('Supabase Storage (REST)', () => {
  test('gera link de envio com a chave nova só no apikey', async () => {
    const { calls, impl } = fakeFetch([{ status: 200, body: { url: '/object/upload/sign/docs/c/1.pdf?token=abc' } }]);
    const storage = createSupabaseStorage({
      projectUrl: 'https://proj.supabase.co/',
      secretKey: 'sb_secret_123456789012345678901234',
      bucket: 'docs',
      fetchImpl: impl,
    });
    const target = await storage.createUploadUrl('c/1.pdf', 'application/pdf');

    assert.equal(calls[0]?.url, 'https://proj.supabase.co/storage/v1/object/upload/sign/docs/c/1.pdf');
    assert.equal(calls[0]?.init.method, 'POST');
    const headers = calls[0]?.init.headers as Record<string, string>;
    assert.equal(headers.apikey, 'sb_secret_123456789012345678901234');
    assert.equal(headers.Authorization, undefined);
    assert.equal(target.url, 'https://proj.supabase.co/storage/v1/object/upload/sign/docs/c/1.pdf?token=abc');
    assert.equal(target.method, 'PUT');
    assert.equal(target.headers['Content-Type'], 'application/pdf');
  });

  test('chave antiga (JWT) vai também no Authorization', async () => {
    const { calls, impl } = fakeFetch([{ status: 200, body: { signedURL: '/object/sign/docs/a.pdf?token=t' } }]);
    const storage = createSupabaseStorage({ projectUrl: 'https://p.supabase.co', secretKey: 'eyJhbGciOiJIUzI1NiJ9.x.y', bucket: 'docs', fetchImpl: impl });
    const url = await storage.createDownloadUrl('a.pdf', 300);
    const headers = calls[0]?.init.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer eyJhbGciOiJIUzI1NiJ9.x.y');
    assert.equal(calls[0]?.init.body, JSON.stringify({ expiresIn: 300 }));
    assert.equal(url, 'https://p.supabase.co/storage/v1/object/sign/docs/a.pdf?token=t');
  });

  test('stat devolve tamanho, ou null quando o arquivo não existe', async () => {
    const { calls, impl } = fakeFetch([
      { status: 200, headers: { 'content-length': '2048', 'content-type': 'application/pdf' } },
      { status: 400 },
    ]);
    const storage = createSupabaseStorage({ projectUrl: 'https://p.supabase.co', secretKey: 'sb_secret_123456789012345678901234', bucket: 'docs', fetchImpl: impl });
    assert.deepEqual(await storage.stat('a.pdf'), { size: 2048, contentType: 'application/pdf' });
    assert.equal(await storage.stat('b.pdf'), null);
    assert.equal(calls[0]?.init.method, 'HEAD');
    assert.equal(calls[0]?.url, 'https://p.supabase.co/storage/v1/object/docs/a.pdf');
  });

  test('erro do Storage vira exceção (sem expor a chave)', async () => {
    const { impl } = fakeFetch([{ status: 403, body: { message: 'denied' } }]);
    const storage = createSupabaseStorage({ projectUrl: 'https://p.supabase.co', secretKey: 'sb_secret_123456789012345678901234', bucket: 'docs', fetchImpl: impl });
    await assert.rejects(storage.createUploadUrl('a.pdf', 'application/pdf'), (error: Error) => {
      assert.match(error.message, /HTTP 403/);
      assert.doesNotMatch(error.message, /sb_secret/);
      return true;
    });
  });

  test('remover envia o caminho no corpo', async () => {
    const { calls, impl } = fakeFetch([{ status: 200, body: [] }]);
    const storage = createSupabaseStorage({ projectUrl: 'https://p.supabase.co', secretKey: 'sb_secret_123456789012345678901234', bucket: 'docs', fetchImpl: impl });
    await storage.remove('c/1.pdf');
    assert.equal(calls[0]?.init.method, 'DELETE');
    assert.equal(calls[0]?.url, 'https://p.supabase.co/storage/v1/object/docs');
    assert.equal(calls[0]?.init.body, JSON.stringify({ prefixes: ['c/1.pdf'] }));
  });
});
