import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { PROFESSION_CATALOG, PROFESSIONS } from '../src/catalog.ts';
import { isValidCpf } from '../src/validation.ts';
import {
  caregiverInReview,
  caregiverPayload,
  clientPayload,
  completeCaregiverProfile,
  createAdmin,
  randomCpf,
  register,
  REQUIRED_DOCS,
  setDefaultRates,
  startTestApp,
  uploadDocument,
  type TestApp,
} from './helpers.ts';

let app: TestApp;

before(async () => {
  app = await startTestApp();
});

after(async () => {
  await app?.stop();
});

describe('catálogo de profissões', () => {
  test('rota pública lista as três categorias do MVP (sem técnico de enfermagem)', async () => {
    const response = await app.call('GET', '/v1/catalog/professions');
    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.professions.map((item: { profession: string }) => item.profession),
      ['caregiver', 'nurse', 'physiotherapist'],
    );
  });

  test('catálogo do backend é igual às regras do banco', async () => {
    for (const profession of PROFESSIONS) {
      const [row] = await app.db.query<{ services: string[]; docs: string[]; council: boolean }>(
        `SELECT profession_service_types($1) AS services, profession_required_documents($1) AS docs,
                profession_requires_council($1) AS council`,
        [profession],
      );
      assert.deepEqual(row?.services, PROFESSION_CATALOG[profession].serviceTypes, profession);
      assert.deepEqual(row?.docs, PROFESSION_CATALOG[profession].requiredDocuments, profession);
      assert.equal(row?.council, PROFESSION_CATALOG[profession].requiresCouncil, profession);
    }
  });

  test('técnico de enfermagem herda o serviço de cuidado; fisioterapeuta não', () => {
    assert.ok(PROFESSION_CATALOG.nurse.serviceTypes.includes('care'));
    assert.deepEqual(PROFESSION_CATALOG.physiotherapist.serviceTypes, ['physiotherapy']);
    assert.deepEqual(PROFESSION_CATALOG.caregiver.serviceTypes, ['care']);
  });
});

describe('CPF e conselho', () => {
  test('validação de CPF (backend e banco concordam)', async () => {
    for (const cpf of ['52998224725', randomCpf(), randomCpf()]) {
      assert.equal(isValidCpf(cpf), true, cpf);
      const [row] = await app.db.query<{ ok: boolean }>(`SELECT cpf_is_valid($1) AS ok`, [cpf]);
      assert.equal(row?.ok, true, cpf);
    }
    for (const cpf of ['52998224724', '11111111111', '123']) {
      assert.equal(isValidCpf(cpf), false, cpf);
    }
  });

  test('CPF inválido é recusado com erro no campo', async () => {
    const caregiver = await register(app, caregiverPayload());
    const response = await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: caregiver.accessToken,
      body: { cpf: '529.982.247-24' },
    });
    assert.equal(response.status, 400);
    assert.ok(response.body.fieldErrors.cpf);
  });

  test('CPF com máscara é salvo só com dígitos', async () => {
    const caregiver = await register(app, caregiverPayload());
    const cpf = randomCpf();
    const masked = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
    const response = await app.call('PATCH', '/v1/me/caregiver-profile', { token: caregiver.accessToken, body: { cpf: masked } });
    assert.equal(response.status, 200);
    assert.equal(response.body.caregiverProfile.cpf, cpf);
  });

  test('o mesmo CPF não pode estar em duas contas', async () => {
    const cpf = randomCpf();
    const first = await register(app, caregiverPayload());
    const second = await register(app, caregiverPayload());
    assert.equal((await app.call('PATCH', '/v1/me/caregiver-profile', { token: first.accessToken, body: { cpf } })).status, 200);
    const duplicate = await app.call('PATCH', '/v1/me/caregiver-profile', { token: second.accessToken, body: { cpf } });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, 'CPF_IN_USE');
  });

  test('técnico de enfermagem sem número do COREN fica incompleto', async () => {
    const nurse = await register(app, caregiverPayload());
    const response = await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: nurse.accessToken,
      body: completeCaregiverProfile({ profession: 'nurse' }),
    });
    assert.equal(response.body.caregiverProfile.verificationStatus, 'incomplete');

    const withCouncil = await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: nurse.accessToken,
      body: { councilNumber: '654321', councilState: 'RJ' },
    });
    assert.equal(withCouncil.body.caregiverProfile.verificationStatus, 'completed');
    // Categoria pedida fica pendente até a aprovação; antes disso não oferece nada.
    assert.deepEqual(withCouncil.body.caregiverProfile.serviceTypes, []);
    assert.deepEqual(withCouncil.body.caregiverProfile.categories, [{ code: 'companionship', status: 'pending', note: null }]);
  });

  test('técnico de enfermagem não é aceito no MVP', async () => {
    const caregiver = await register(app, caregiverPayload());
    const response = await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: caregiver.accessToken,
      body: { profession: 'nursing_technician' },
    });
    assert.equal(response.status, 400);
  });
});

describe('documentos', () => {
  test('perfil completo sem documentos não pode ir para análise', async () => {
    const caregiver = await register(app, caregiverPayload());
    await app.call('PATCH', '/v1/me/caregiver-profile', { token: caregiver.accessToken, body: completeCaregiverProfile() });
    await setDefaultRates(app, caregiver.accessToken, 'caregiver');
    const response = await app.call('POST', '/v1/me/caregiver-profile/submit', { token: caregiver.accessToken });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'DOCUMENTS_MISSING');

    const me = await app.call('GET', '/v1/me', { token: caregiver.accessToken });
    assert.deepEqual(me.body.caregiverProfile.missingDocuments, [...REQUIRED_DOCS.caregiver].sort());
  });

  test('envio: link → arquivo → conclusão; a lista de pendências diminui', async () => {
    const caregiver = await register(app, caregiverPayload());
    await app.call('PATCH', '/v1/me/caregiver-profile', { token: caregiver.accessToken, body: completeCaregiverProfile() });

    const doc = await uploadDocument(app, caregiver.accessToken, 'criminal_record');
    assert.equal(doc.status, 'submitted');

    const list = await app.call('GET', '/v1/me/caregiver-documents', { token: caregiver.accessToken });
    assert.equal(list.status, 200);
    assert.equal(list.body.documents.length, 1);
    assert.ok(!list.body.missingDocuments.includes('criminal_record'));
    assert.equal(list.body.documents[0].storage_path, undefined, 'caminho interno não é exposto');
  });

  test('concluir sem o arquivo ter chegado é recusado', async () => {
    const caregiver = await register(app, caregiverPayload());
    const created = await app.call('POST', '/v1/me/caregiver-documents', {
      token: caregiver.accessToken,
      body: { docType: 'identity', contentType: 'image/jpeg', sizeBytes: 1000 },
    });
    const done = await app.call('POST', `/v1/me/caregiver-documents/${created.body.document.id}/complete`, {
      token: caregiver.accessToken,
    });
    assert.equal(done.status, 409);
    assert.equal(done.body.code, 'UPLOAD_NOT_FOUND');
  });

  test('tipo de arquivo e tamanho são validados', async () => {
    const caregiver = await register(app, caregiverPayload());
    const response = await app.call('POST', '/v1/me/caregiver-documents', {
      token: caregiver.accessToken,
      body: { docType: 'identity', contentType: 'application/x-msdownload', sizeBytes: 20 * 1024 * 1024 },
    });
    assert.equal(response.status, 400);
    assert.ok(response.body.fieldErrors.contentType);
    assert.ok(response.body.fieldErrors.sizeBytes);
  });

  test('cliente não envia documentos de profissional', async () => {
    const client = await register(app, clientPayload());
    const response = await app.call('POST', '/v1/me/caregiver-documents', {
      token: client.accessToken,
      body: { docType: 'identity', contentType: 'application/pdf', sizeBytes: 100 },
    });
    assert.equal(response.status, 403);
  });

  test('um profissional não conclui nem apaga documento de outro', async () => {
    const owner = await register(app, caregiverPayload());
    const other = await register(app, caregiverPayload());
    const doc = await uploadDocument(app, owner.accessToken, 'identity');
    assert.equal((await app.call('DELETE', `/v1/me/caregiver-documents/${doc.id}`, { token: other.accessToken })).status, 404);
    assert.equal(
      (await app.call('POST', `/v1/me/caregiver-documents/${doc.id}/complete`, { token: other.accessToken })).status,
      404,
    );
  });

  test('banco impede o profissional de marcar o próprio documento como aceito', async () => {
    const caregiver = await register(app, caregiverPayload());
    const doc = await uploadDocument(app, caregiver.accessToken, 'identity');
    await assert.rejects(
      app.db.query(`UPDATE caregiver_documents SET status = 'accepted' WHERE id = $1 RETURNING id`, [doc.id]),
      (error: Error & { code?: string }) => error.code === '42501',
    );
  });

  test('em análise, não dá para trocar documentos', async () => {
    const caregiver = await caregiverInReview(app);
    const response = await app.call('POST', '/v1/me/caregiver-documents', {
      token: caregiver.accessToken,
      body: { docType: 'other', contentType: 'application/pdf', sizeBytes: 100 },
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'UNDER_REVIEW');
  });

  test('apagar documento remove também o arquivo', async () => {
    const caregiver = await register(app, caregiverPayload());
    const doc = await uploadDocument(app, caregiver.accessToken, 'other');
    const before = app.storage.files.size;
    assert.equal((await app.call('DELETE', `/v1/me/caregiver-documents/${doc.id}`, { token: caregiver.accessToken })).status, 204);
    assert.equal(app.storage.files.size, before - 1);
  });
});

describe('análise e selo de verificado', () => {
  test('admin vê a ficha com links temporários e o acesso fica auditado', async () => {
    const admin = await createAdmin(app);
    const caregiver = await caregiverInReview(app, 'nurse');
    const file = await app.call('GET', `/v1/admin/caregivers/${caregiver.user.id}`, { token: admin.accessToken });
    assert.equal(file.status, 200);
    assert.equal(file.body.caregiverProfile.profession, 'nurse');
    assert.equal(file.body.documents.length, 4);
    assert.ok(file.body.documents.every((doc: { downloadUrl: string }) => doc.downloadUrl.includes('expiresIn=300')));

    const audit = await app.db.query<{ action: string }>(
      `SELECT action FROM audit_log WHERE actor_id = $1 AND action = 'admin.caregiver_file_viewed'`,
      [admin.user.id],
    );
    assert.equal(audit.length, 1);
  });

  test('profissional e cliente não veem a ficha administrativa', async () => {
    const caregiver = await caregiverInReview(app);
    const client = await register(app, clientPayload());
    for (const token of [caregiver.accessToken, client.accessToken]) {
      const response = await app.call('GET', `/v1/admin/caregivers/${caregiver.user.id}`, { token });
      assert.equal(response.status, 403);
    }
  });

  test('aprovação concede o selo e aceita os documentos', async () => {
    const admin = await createAdmin(app);
    const caregiver = await caregiverInReview(app, 'physiotherapist');
    await app.call('POST', `/v1/admin/caregivers/${caregiver.user.id}/verification`, {
      token: admin.accessToken,
      body: { status: 'approved' },
    });

    const me = await app.call('GET', '/v1/me', { token: caregiver.accessToken });
    assert.equal(me.body.caregiverProfile.verified, true);
    assert.ok(me.body.caregiverProfile.verifiedAt);

    const docs = await app.call('GET', '/v1/me/caregiver-documents', { token: caregiver.accessToken });
    assert.ok(docs.body.documents.every((doc: { status: string }) => doc.status === 'accepted'));
  });

  test('mudar de profissão depois de aprovado tira o selo e exige nova análise', async () => {
    const admin = await createAdmin(app);
    const caregiver = await caregiverInReview(app);
    await app.call('POST', `/v1/admin/caregivers/${caregiver.user.id}/verification`, {
      token: admin.accessToken,
      body: { status: 'approved' },
    });

    const changed = await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: caregiver.accessToken,
      body: { profession: 'nurse', councilNumber: '111222', councilState: 'SP' },
    });
    assert.equal(changed.body.caregiverProfile.verified, false);
    assert.equal(changed.body.caregiverProfile.verificationStatus, 'completed');
    assert.ok(changed.body.caregiverProfile.missingDocuments.includes('council_card'));
  });

  test('cuidador sem selo não aparece como verificado', async () => {
    const caregiver = await caregiverInReview(app);
    const me = await app.call('GET', '/v1/me', { token: caregiver.accessToken });
    assert.equal(me.body.caregiverProfile.verified, false);
    assert.equal(me.body.caregiverProfile.verifiedAt, null);
  });
});
