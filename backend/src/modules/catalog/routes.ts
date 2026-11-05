import type { Router } from '../../http/router.ts';
import { PROFESSION_CATALOG, PROFESSIONS } from '../../catalog.ts';
import type { Deps } from '../deps.ts';
import { toCategory } from '../mappers.ts';

/** Categorias do catálogo. Público: só as ativas. Admin: todas. */
export async function listCategories(deps: Deps, includeDisabled = false) {
  const rows = await deps.db.query(
    `SELECT * FROM service_categories ${includeDisabled ? '' : 'WHERE enabled'} ORDER BY sort_order, code`,
  );
  return rows.map(toCategory);
}

/** Catálogo público: profissões e categorias de serviço que o Cuidar+ oferece. */
export function registerCatalogRoutes(router: Router, deps: Deps): void {
  router.add('GET', '/v1/catalog/professions', async () => ({
    status: 200,
    body: {
      professions: PROFESSIONS.map((profession) => ({ profession, ...PROFESSION_CATALOG[profession] })),
    },
  }));

  /** CAT-05: o app mostra o que está e o que NÃO está incluído antes de contratar. */
  router.add('GET', '/v1/catalog/categories', async () => ({
    status: 200,
    body: { categories: await listCategories(deps) },
  }));
}
