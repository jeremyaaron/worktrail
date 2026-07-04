import type { ApiReadinessResponse } from '@worktrail/contracts';

export interface HealthCheckPool {
  query(sql: string): Promise<unknown>;
}

export class HealthCheckService {
  constructor(private readonly pool: HealthCheckPool) {}

  async checkReadiness(checkedAt = new Date()): Promise<ApiReadinessResponse> {
    await this.pool.query('select 1');

    return {
      status: 'ready',
      service: 'worktrail-api',
      checks: {
        database: 'ok'
      },
      checkedAt: checkedAt.toISOString()
    };
  }
}
