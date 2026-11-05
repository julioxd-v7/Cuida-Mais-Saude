import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { caregiverPayload, clientPayload, createAdmin, register, startTestApp, type TestApp } from './helpers.ts';

let app: TestApp;

before(async () => {
  app = await startTestApp();
});

after(async () => {
  await app?.stop();
});

async function openTicket(token: string, subject = 'Dúvida sobre o cadastro', message = 'Como envio meus documentos?') {
  const response = await app.call('POST', '/v1/support/conversations', { token, body: { subject, message } });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.conversation as { id: string };
}

describe('suporte', () => {
  test('cliente e profissional abrem chamado com a primeira mensagem', async () => {
    for (const payload of [clientPayload(), caregiverPayload()]) {
      const user = await register(app, payload);
      const ticket = await openTicket(user.accessToken);
      const detail = await app.call('GET', `/v1/conversations/${ticket.id}`, { token: user.accessToken });
      assert.equal(detail.status, 200);
      assert.equal(detail.body.conversation.kind, 'support');
      assert.equal(detail.body.messages.length, 1);
      assert.equal(detail.body.messages[0].mine, true);
    }
  });

  test('admin vê a fila, responde e a resposta aparece como "suporte"', async () => {
    const admin = await createAdmin(app);
    const client = await register(app, clientPayload());
    const ticket = await openTicket(client.accessToken);

    const queue = await app.call('GET', '/v1/admin/support/conversations', { token: admin.accessToken });
    assert.ok(queue.body.conversations.some((c: { id: string }) => c.id === ticket.id));

    const reply = await app.call('POST', `/v1/conversations/${ticket.id}/messages`, {
      token: admin.accessToken,
      body: { body: 'Olá! Vá em Perfil > Documentos.' },
    });
    assert.equal(reply.status, 201);

    const list = await app.call('GET', '/v1/conversations', { token: client.accessToken });
    const mine = list.body.conversations.find((c: { id: string }) => c.id === ticket.id);
    assert.equal(mine.unreadCount, 1);
    assert.equal(mine.lastMessage, 'Olá! Vá em Perfil > Documentos.');

    const detail = await app.call('GET', `/v1/conversations/${ticket.id}`, { token: client.accessToken });
    assert.equal(detail.body.messages[1].fromSupport, true);
    assert.equal(detail.body.messages[1].mine, false);

    const afterRead = await app.call('GET', '/v1/conversations', { token: client.accessToken });
    assert.equal(afterRead.body.conversations.find((c: { id: string }) => c.id === ticket.id).unreadCount, 0);
  });

  test('busca incremental: só mensagens depois da última recebida', async () => {
    const client = await register(app, clientPayload());
    const ticket = await openTicket(client.accessToken);
    const first = await app.call('GET', `/v1/conversations/${ticket.id}`, { token: client.accessToken });
    const lastId = first.body.messages.at(-1).id;
    await app.call('POST', `/v1/conversations/${ticket.id}/messages`, { token: client.accessToken, body: { body: 'Mais um detalhe.' } });
    const incremental = await app.call('GET', `/v1/conversations/${ticket.id}?after=${lastId}`, {
      token: client.accessToken,
    });
    assert.equal(incremental.body.messages.length, 1);
    assert.equal(incremental.body.messages[0].body, 'Mais um detalhe.');
  });

  test('outra pessoa não lê nem escreve no chamado (404)', async () => {
    const owner = await register(app, clientPayload());
    const intruder = await register(app, caregiverPayload());
    const ticket = await openTicket(owner.accessToken);
    assert.equal((await app.call('GET', `/v1/conversations/${ticket.id}`, { token: intruder.accessToken })).status, 404);
    const write = await app.call('POST', `/v1/conversations/${ticket.id}/messages`, {
      token: intruder.accessToken,
      body: { body: 'oi' },
    });
    assert.equal(write.status, 404);
  });

  test('chamado encerrado não recebe mensagens; só admin reabre', async () => {
    const admin = await createAdmin(app);
    const client = await register(app, clientPayload());
    const ticket = await openTicket(client.accessToken);

    const close = await app.call('POST', `/v1/conversations/${ticket.id}/status`, {
      token: client.accessToken,
      body: { status: 'closed' },
    });
    assert.equal(close.status, 200);

    const write = await app.call('POST', `/v1/conversations/${ticket.id}/messages`, {
      token: client.accessToken,
      body: { body: 'Ainda tenho dúvida' },
    });
    assert.equal(write.status, 409);
    assert.equal(write.body.code, 'CONVERSATION_CLOSED');

    const reopenByClient = await app.call('POST', `/v1/conversations/${ticket.id}/status`, {
      token: client.accessToken,
      body: { status: 'open' },
    });
    assert.equal(reopenByClient.status, 403);

    const reopen = await app.call('POST', `/v1/conversations/${ticket.id}/status`, {
      token: admin.accessToken,
      body: { status: 'open' },
    });
    assert.equal(reopen.status, 200);
  });

  test('mensagem vazia ou longa demais é recusada', async () => {
    const client = await register(app, clientPayload());
    const ticket = await openTicket(client.accessToken);
    for (const body of ['   ', 'x'.repeat(2001)]) {
      const response = await app.call('POST', `/v1/conversations/${ticket.id}/messages`, { token: client.accessToken, body: { body } });
      assert.equal(response.status, 400);
    }
  });

  test('mensagens não podem ser editadas nem apagadas (nem direto no banco)', async () => {
    const client = await register(app, clientPayload());
    const ticket = await openTicket(client.accessToken);
    await assert.rejects(
      app.db.query(`UPDATE messages SET body = 'editado' WHERE conversation_id = $1 RETURNING id`, [ticket.id]),
      (error: Error & { code?: string }) => error.code === '42501',
    );
    await assert.rejects(
      app.db.query(`DELETE FROM messages WHERE conversation_id = $1 RETURNING id`, [ticket.id]),
      (error: Error & { code?: string }) => error.code === '42501',
    );
  });
});

describe('chat entre cliente e profissional', () => {
  test('não dá para abrir conversa direta sem solicitação de atendimento', async () => {
    const client = await register(app, clientPayload());
    await assert.rejects(
      app.db.query(`INSERT INTO conversations (kind, created_by) VALUES ('service', $1) RETURNING id`, [client.user.id]),
      (error: Error & { code?: string }) => error.code === '42501',
    );
  });
});
