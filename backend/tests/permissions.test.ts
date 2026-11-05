import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import {
  caregiverPayload,
  clientPayload,
  caregiverInReview,
  completeCaregiverProfile,
  REQUIRED_DOCS,
  uploadDocument,
  createAdmin,
  register,
  startTestApp,
  VALID_PASSWORD,
  type TestApp,
} from './helpers.ts';

let app: TestApp;

before(async () => {
  app = await startTestApp();
});

after(async () => {
  await app?.stop();
});

async function caregiverReadyForReview() {
  return caregiverInReview(app);
}

describe('separação entre cliente e cuidador', () => {
  test('cliente não acessa rotas exclusivas do cuidador', async () => {
    const client = await register(app, clientPayload());
    const edit = await app.call('PATCH', '/v1/me/caregiver-profile', { token: client.accessToken, body: { bio: 'x' } });
    const submit = await app.call('POST', '/v1/me/caregiver-profile/submit', { token: client.accessToken });
    assert.equal(edit.status, 403);
    assert.equal(submit.status, 403);
  });

  test('cuidador não acessa rotas exclusivas do cliente', async () => {
    const caregiver = await register(app, caregiverPayload());
    const profile = await app.call('PATCH', '/v1/me/client-profile', {
      token: caregiver.accessToken,
      body: { contactPreference: 'email' },
    });
    const recipients = await app.call('GET', '/v1/me/care-recipients', { token: caregiver.accessToken });
    const create = await app.call('POST', '/v1/me/care-recipients', {
      token: caregiver.accessToken,
      body: { fullName: 'Fulano', relationship: 'parent' },
    });
    assert.equal(profile.status, 403);
    assert.equal(recipients.status, 403);
    assert.equal(create.status, 403);
  });

  test('banco recusa beneficiário vinculado a um cuidador mesmo sem passar pela API', async () => {
    const caregiver = await register(app, caregiverPayload());
    await assert.rejects(
      app.db.query(`INSERT INTO care_recipients (guardian_id, full_name, relationship) VALUES ($1, 'Fulano', 'parent') RETURNING id`, [
        caregiver.user.id,
      ]),
      (error: Error & { code?: string }) => error.code === '42501',
    );
  });
});

describe('privilégios administrativos', () => {
  test('usuário comum não acessa rotas de administrador', async () => {
    const client = await register(app, clientPayload());
    const caregiver = await caregiverReadyForReview();
    const list = await app.call('GET', '/v1/admin/caregivers', { token: client.accessToken });
    const approve = await app.call('POST', `/v1/admin/caregivers/${caregiver.user.id}/verification`, {
      token: client.accessToken,
      body: { status: 'approved' },
    });
    assert.equal(list.status, 403);
    assert.equal(approve.status, 403);
  });

  test('tentar mudar o próprio papel pela API é recusado', async () => {
    const client = await register(app, clientPayload());
    const response = await app.call('PATCH', '/v1/me', { token: client.accessToken, body: { role: 'admin' } });
    assert.equal(response.status, 400);
    const me = await app.call('GET', '/v1/me', { token: client.accessToken });
    assert.equal(me.body.user.role, 'client');
  });

  test('banco bloqueia UPDATE comum de papel e de estado da conta', async () => {
    const client = await register(app, clientPayload());
    for (const sql of [
      `UPDATE users SET role = 'admin' WHERE id = $1 RETURNING id`,
      `UPDATE users SET status = 'suspended' WHERE id = $1 RETURNING id`,
    ]) {
      await assert.rejects(app.db.query(sql, [client.user.id]), (error: Error & { code?: string }) => error.code === '42501');
    }
  });

  test('função administrativa recusa quem não é admin', async () => {
    const client = await register(app, clientPayload());
    const caregiver = await caregiverReadyForReview();
    await assert.rejects(
      app.db.query(`SELECT * FROM admin_set_caregiver_status($1, $2, 'approved')`, [client.user.id, caregiver.user.id]),
      (error: Error & { code?: string }) => error.code === '42501',
    );
  });
});

describe('verificação do cuidador', () => {
  test('cuidador não consegue aprovar a própria verificação', async () => {
    const caregiver = await caregiverReadyForReview();

    const viaProfile = await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: caregiver.accessToken,
      body: { verificationStatus: 'approved' },
    });
    assert.equal(viaProfile.status, 400, 'campo de verificação não é aceito');

    const viaAdmin = await app.call('POST', `/v1/admin/caregivers/${caregiver.user.id}/verification`, {
      token: caregiver.accessToken,
      body: { status: 'approved' },
    });
    assert.equal(viaAdmin.status, 403);

    await assert.rejects(
      app.db.query(`UPDATE caregiver_profiles SET verification_status = 'approved' WHERE user_id = $1 RETURNING user_id`, [
        caregiver.user.id,
      ]),
      (error: Error & { code?: string }) => error.code === '42501',
    );

    const me = await app.call('GET', '/v1/me', { token: caregiver.accessToken });
    assert.equal(me.body.caregiverProfile.verificationStatus, 'pending_review');
  });

  test('perfil incompleto não pode ser enviado para análise', async () => {
    const caregiver = await register(app, caregiverPayload());
    const response = await app.call('POST', '/v1/me/caregiver-profile/submit', { token: caregiver.accessToken });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'PROFILE_INCOMPLETE');
  });

  test('preencher todos os campos marca o perfil como completo (ainda não verificado)', async () => {
    const caregiver = await register(app, caregiverPayload());
    const response = await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: caregiver.accessToken,
      body: completeCaregiverProfile(),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.caregiverProfile.verificationStatus, 'completed');
  });

  test('admin aprova cuidador em análise e a decisão fica auditada', async () => {
    const admin = await createAdmin(app);
    const caregiver = await caregiverReadyForReview();

    const pending = await app.call('GET', '/v1/admin/caregivers', { token: admin.accessToken });
    assert.equal(pending.status, 200);
    assert.ok(pending.body.caregivers.some((item: { user: { id: string } }) => item.user.id === caregiver.user.id));

    const approve = await app.call('POST', `/v1/admin/caregivers/${caregiver.user.id}/verification`, {
      token: admin.accessToken,
      body: { status: 'approved' },
    });
    assert.equal(approve.status, 200);
    assert.equal(approve.body.caregiverProfile.verificationStatus, 'approved');

    const audit = await app.db.query<{ action: string }>(
      `SELECT action FROM audit_log WHERE target_id = $1 ORDER BY id`,
      [caregiver.user.id],
    );
    assert.ok(audit.some((row) => row.action === 'caregiver.verification_changed'));
  });

  test('admin não aprova quem não foi enviado para análise', async () => {
    const admin = await createAdmin(app);
    const caregiver = await register(app, caregiverPayload());
    const response = await app.call('POST', `/v1/admin/caregivers/${caregiver.user.id}/verification`, {
      token: admin.accessToken,
      body: { status: 'approved' },
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'INVALID_TRANSITION');
  });

  test('reprovado pode corrigir e reenviar', async () => {
    const admin = await createAdmin(app);
    const caregiver = await caregiverReadyForReview();
    await app.call('POST', `/v1/admin/caregivers/${caregiver.user.id}/verification`, {
      token: admin.accessToken,
      body: { status: 'rejected', note: 'Apresentação muito curta.' },
    });

    const me = await app.call('GET', '/v1/me', { token: caregiver.accessToken });
    assert.equal(me.body.caregiverProfile.verificationStatus, 'rejected');
    assert.equal(me.body.caregiverProfile.verificationNote, 'Apresentação muito curta.');

    const withoutNewDocs = await app.call('POST', '/v1/me/caregiver-profile/submit', { token: caregiver.accessToken });
    assert.equal(withoutNewDocs.status, 409, 'documentos reprovados precisam ser enviados de novo');
    assert.equal(withoutNewDocs.body.code, 'DOCUMENTS_MISSING');
    for (const docType of REQUIRED_DOCS.caregiver) await uploadDocument(app, caregiver.accessToken, docType);

    const resubmit = await app.call('POST', '/v1/me/caregiver-profile/submit', { token: caregiver.accessToken });
    assert.equal(resubmit.status, 200);
    assert.equal(resubmit.body.caregiverProfile.verificationStatus, 'pending_review');
  });

  test('apagar dado obrigatório de um perfil aprovado exige nova análise', async () => {
    const admin = await createAdmin(app);
    const caregiver = await caregiverReadyForReview();
    await app.call('POST', `/v1/admin/caregivers/${caregiver.user.id}/verification`, {
      token: admin.accessToken,
      body: { status: 'approved' },
    });
    const edit = await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: caregiver.accessToken,
      body: { specialties: [] },
    });
    assert.equal(edit.body.caregiverProfile.verificationStatus, 'incomplete');
  });
});

describe('conta suspensa', () => {
  test('suspensão encerra sessões e bloqueia login e acesso', async () => {
    const admin = await createAdmin(app);
    const payload = clientPayload();
    const client = await register(app, payload);

    const suspend = await app.call('POST', `/v1/admin/users/${client.user.id}/status`, {
      token: admin.accessToken,
      body: { status: 'suspended' },
    });
    assert.equal(suspend.status, 200);

    const me = await app.call('GET', '/v1/me', { token: client.accessToken });
    assert.equal(me.status, 401, 'sessão revogada pela suspensão');

    const login = await app.call('POST', '/v1/auth/login', { body: { email: payload.email, password: VALID_PASSWORD } });
    assert.equal(login.status, 403);
    assert.equal(login.body.code, 'ACCOUNT_SUSPENDED');

    const refresh = await app.call('POST', '/v1/auth/refresh', { body: { refreshToken: client.refreshToken } });
    assert.equal(refresh.status, 401);
  });

  test('sessão ativa de conta suspensa por fora da API também é bloqueada', async () => {
    const client = await register(app, clientPayload());
    // Simula uma suspensão feita direto no banco, sem revogar as sessões.
    await app.db.exec(
      `BEGIN; SELECT enable_privileged(); UPDATE users SET status = 'suspended' WHERE id = '${client.user.id}'; COMMIT;`,
    );
    const me = await app.call('GET', '/v1/me', { token: client.accessToken });
    assert.equal(me.status, 403);
    assert.equal(me.body.code, 'ACCOUNT_SUSPENDED');
  });

  test('admin não suspende a si mesmo', async () => {
    const admin = await createAdmin(app);
    const response = await app.call('POST', `/v1/admin/users/${admin.user.id}/status`, {
      token: admin.accessToken,
      body: { status: 'suspended' },
    });
    assert.equal(response.status, 403);
  });
});

describe('dados de outras contas', () => {
  test('cliente não lê, altera nem apaga beneficiário de outro cliente', async () => {
    const owner = await register(app, clientPayload());
    const intruder = await register(app, clientPayload());

    const created = await app.call('POST', '/v1/me/care-recipients', {
      token: owner.accessToken,
      body: { fullName: 'Dona Lurdes', relationship: 'parent', assistanceNeeds: ['mobility'] },
    });
    assert.equal(created.status, 201);
    const id = created.body.careRecipient.id;

    const list = await app.call('GET', '/v1/me/care-recipients', { token: intruder.accessToken });
    assert.equal(list.body.careRecipients.length, 0);

    const edit = await app.call('PATCH', `/v1/me/care-recipients/${id}`, {
      token: intruder.accessToken,
      body: { fullName: 'Hackeado' },
    });
    const remove = await app.call('DELETE', `/v1/me/care-recipients/${id}`, { token: intruder.accessToken });
    assert.equal(edit.status, 404);
    assert.equal(remove.status, 404);

    const ownerList = await app.call('GET', '/v1/me/care-recipients', { token: owner.accessToken });
    assert.equal(ownerList.body.careRecipients[0].fullName, 'Dona Lurdes');
  });

  test('não dá para mover beneficiário para outra conta pelo corpo da requisição', async () => {
    const owner = await register(app, clientPayload());
    const other = await register(app, clientPayload());
    const created = await app.call('POST', '/v1/me/care-recipients', {
      token: owner.accessToken,
      body: { fullName: 'Seu Antônio', relationship: 'grandparent' },
    });
    const response = await app.call('PATCH', `/v1/me/care-recipients/${created.body.careRecipient.id}`, {
      token: owner.accessToken,
      body: { guardianId: other.user.id },
    });
    assert.equal(response.status, 400);
  });

  test('id inválido na URL responde 404 sem erro interno', async () => {
    const client = await register(app, clientPayload());
    const response = await app.call('DELETE', '/v1/me/care-recipients/nao-e-uuid', { token: client.accessToken });
    assert.equal(response.status, 404);
  });

  test('registros de auditoria não podem ser apagados', async () => {
    await register(app, clientPayload());
    await assert.rejects(app.db.query(`DELETE FROM audit_log RETURNING id`), (error: Error & { code?: string }) => error.code === '42501');
  });
});

describe('funções administrativas com alvo inexistente', () => {
  test('suspender usuário que não existe responde 404', async () => {
    const admin = await createAdmin(app);
    const response = await app.call('POST', '/v1/admin/users/00000000-0000-0000-0000-000000000000/status', {
      token: admin.accessToken,
      body: { status: 'suspended' },
    });
    assert.equal(response.status, 404);
  });

  test('conceder admin a e-mail inexistente falha', async () => {
    await assert.rejects(
      app.db.query(`SELECT * FROM grant_admin_by_email('ninguem@exemplo.com')`),
      (error: Error & { code?: string }) => error.code === 'P0002',
    );
  });
});
