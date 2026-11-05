# Profissões, verificação e selo — CUIDAR MAIS

## 1. Categorias profissionais (MVP)

| Categoria | Função principal | Conselho | Serviços que pode atender |
|---|---|---|---|
| Cuidador(a) de idosos | apoio nas atividades diárias, conforto, companhia e segurança | — | Cuidado e companhia |
| Técnico(a) de enfermagem | cuidados e procedimentos de enfermagem, sob supervisão de enfermeiro | **COREN** | Cuidado e companhia · Procedimentos de enfermagem · Avaliação e plano de enfermagem |
| Fisioterapeuta | reabilitação, mobilidade, força, equilíbrio e prevenção de quedas | **CREFITO** | Fisioterapia |

- **Uma categoria por profissional.** O técnico de enfermagem "herda" o serviço de cuidado; o fisioterapeuta não.
- **Técnico de enfermagem.** Pela legislação de enfermagem, o técnico atua sob supervisão de enfermeiro. Atender sozinho em domicílio por um marketplace é um risco a validar juridicamente.
- O **cliente escolhe o tipo de serviço** (cuidado, procedimento de enfermagem, avaliação de enfermagem ou fisioterapia), e o sistema só oferece profissionais habilitados. Isso entra no fluxo de solicitação, na próxima etapa.
- **Procedimentos de enfermagem:** o cliente vai declarar que possui prescrição, e o profissional confere no local. Também entra no fluxo de solicitação.

A fonte única dessas regras são as funções SQL `profession_service_types`, `profession_required_documents` e `profession_requires_council`. O backend tem um espelho em `backend/src/catalog.ts`, e um teste garante que os dois são iguais. O catálogo é público em `GET /v1/catalog/professions`.

> As atribuições de cada profissão podem variar conforme a legislação profissional, o tipo de serviço e o grau de dependência do paciente. Antes de entrar em produção, validar com assessoria jurídica e com os conselhos (COFEN/COREN, COFFITO/CREFITO).

## 2. O que o profissional precisa informar

**No perfil profissional:**
- profissão, **CPF** (com dígitos verificadores, único no sistema) e registro no conselho (número + UF) para técnico de enfermagem e fisioterapeuta;
- apresentação, experiência, especialidades;
- região de atendimento (cidade, UF, bairro opcional, raio) e disponibilidade.

**Documentos** (PDF ou foto de até 10 MB):

| Documento | Cuidador | Técnico de enfermagem | Fisioterapeuta |
|---|:-:|:-:|:-:|
| Documento com foto (RG/CNH) | ✅ | ✅ | ✅ |
| **Certidão de antecedentes criminais** | ✅ | ✅ | ✅ |
| Comprovante de residência | ✅ | ✅ | ✅ |
| Certificado de curso de cuidador | ✅ | — | — |
| Registro no conselho (COREN/CREFITO) | — | ✅ | ✅ |
| Outros certificados | opcional | opcional | opcional |

## 3. Fluxo até o selo de verificado

```text
1. Perfil profissional completo         → status "completed"
2. Documentos obrigatórios enviados     → "faltam: …" zera
3. Enviar para verificação              → "pending_review" (não dá para trocar documentos)
4. Admin analisa a ficha e os arquivos  → "approved"  ⇒ SELO ✓  (documentos viram "aceitos")
                                        → "rejected"  ⇒ motivo; documentos viram "recusados";
                                                         reenviar exige arquivos novos
```

- **O selo** é `verified: true` na API, mostrado pelo componente `VerifiedBadge`. Só existe quando o servidor diz `approved`. O app não tem como "se dar" o selo: o banco bloqueia (veja `PERMISSOES.md`).
- **Mudar profissão, CPF ou conselho** depois de aprovado ou em análise **tira o selo** e exige nova análise.
- Só profissionais aprovados poderão aceitar atendimentos. Essa regra será aplicada no backend no fluxo de solicitações.

## 4. Como os documentos são guardados

- **Supabase Storage**, bucket **privado** `caregiver-documents` (limite de 10 MB; aceita PDF, JPG, PNG, WEBP e HEIC).
- O arquivo **não passa pelo backend**, e o app nunca recebe credenciais:
  1. O app pede um link de envio: `POST /v1/me/caregiver-documents`.
  2. O app envia o arquivo direto para esse link, que é de uso único.
  3. O app avisa que terminou: `POST /v1/me/caregiver-documents/:id/complete`. O backend confere se o arquivo chegou e o tamanho.
- O **admin** abre a ficha (`GET /v1/admin/caregivers/:id`) com links de leitura que **expiram em 5 minutos**. Cada abertura fica registrada na auditoria (LGPD).
- A chave secreta do Supabase fica **só** no `backend/.env` (`SUPABASE_SECRET_KEY`). Sem ela, o envio responde "indisponível".

## 5. Privacidade de localização (próxima etapa)

Como você pediu, o funcionamento vai ser parecido com o do LinkedIn:
- **O profissional** mostra só a **região de atendimento** (cidade, bairro e raio) e a distância aproximada até o paciente. **Nunca** o endereço de casa: o comprovante de residência é usado só na verificação.
- **O paciente** informa o local do atendimento ao fazer a solicitação. O profissional só vê o endereço completo depois de aceitar o atendimento.
- **A segurança vale para os dois lados:** antes de aceitar, o profissional vê a **ficha do atendimento**: tipo de serviço, necessidades gerais, região, quem está contratando (conta verificada) e a avaliação do cliente.

## 6. Pendências

- Painel admin web para analisar fichas. Por enquanto, a análise é feita pela API (veja `COMO-EXECUTAR.md`).
- Validação automática de antecedentes e do registro no conselho junto aos órgãos (consulta ao COREN/CREFITO, provedor de background check).
- Validade da certidão de antecedentes (hoje o admin confere a data).
- Avaliações (rating) de clientes sobre profissionais e vice-versa, depois de cada atendimento.
