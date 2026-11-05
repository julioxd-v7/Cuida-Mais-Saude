import type { Router } from '../../http/router.ts';
import type { Deps } from '../deps.ts';

type AreaRow = { id: string; city: string; state: string; active: boolean };
type RangeRow = { service_area_id: string; service_type: string; min_hourly_cents: number; max_hourly_cents: number };

/** Áreas ativas com as faixas de preço (rota pública: o app mostra onde o Cuidar+ atende). */
export async function listServiceAreas(deps: Deps, includeInactive = false) {
  const areas = await deps.db.query<AreaRow>(
    `SELECT id, city, state, active FROM service_areas ${includeInactive ? '' : 'WHERE active'} ORDER BY state, city`,
  );
  const ranges = await deps.db.query<RangeRow>(
    `SELECT service_area_id, service_type, min_hourly_cents, max_hourly_cents FROM service_price_ranges ORDER BY service_type`,
  );
  return areas.map((area) => ({
    id: String(area.id),
    city: String(area.city),
    state: String(area.state).trim(),
    active: Boolean(area.active),
    priceRanges: ranges
      .filter((range) => String(range.service_area_id) === String(area.id))
      .map((range) => ({
        serviceType: String(range.service_type),
        minHourlyCents: Number(range.min_hourly_cents),
        maxHourlyCents: Number(range.max_hourly_cents),
      })),
  }));
}

export function registerAreaRoutes(router: Router, deps: Deps): void {
  router.add('GET', '/v1/service-areas', async () => ({
    status: 200,
    body: { areas: await listServiceAreas(deps) },
  }));
}
