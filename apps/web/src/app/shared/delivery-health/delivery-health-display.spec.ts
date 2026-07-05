import type { DeliveryHealthReasonDto, WorkItemQuery } from '@worktrail/contracts';

import {
  deliveryHealthLabel,
  deliveryHealthReasonLabel,
  deliveryHealthReasonQueryParams,
  deliveryHealthSeverityLabel,
  deliveryHealthSeverityTone,
  deliveryHealthTone,
  workItemQueryToRouterQueryParams
} from './delivery-health-display';

describe('delivery health display helpers', () => {
  it('maps delivery health states to product labels and tones', () => {
    expect(deliveryHealthLabel('healthy')).toBe('On track');
    expect(deliveryHealthLabel('at_risk')).toBe('At risk');
    expect(deliveryHealthLabel('blocked')).toBe('Blocked');
    expect(deliveryHealthLabel('complete')).toBe('Complete');
    expect(deliveryHealthLabel('inactive')).toBe('Inactive');

    expect(deliveryHealthTone('healthy')).toBe('positive');
    expect(deliveryHealthTone('at_risk')).toBe('warning');
    expect(deliveryHealthTone('blocked')).toBe('critical');
    expect(deliveryHealthTone('complete')).toBe('info');
    expect(deliveryHealthTone('inactive')).toBe('neutral');
  });

  it('maps delivery health severities to labels and tones', () => {
    expect(deliveryHealthSeverityLabel('info')).toBe('Info');
    expect(deliveryHealthSeverityLabel('warning')).toBe('Warning');
    expect(deliveryHealthSeverityLabel('critical')).toBe('Critical');

    expect(deliveryHealthSeverityTone('info')).toBe('info');
    expect(deliveryHealthSeverityTone('warning')).toBe('warning');
    expect(deliveryHealthSeverityTone('critical')).toBe('critical');
  });

  it('uses server-provided reason messages as display labels', () => {
    const reason: DeliveryHealthReasonDto = {
      key: 'dependency_blocked',
      severity: 'critical',
      message: '2 dependency-blocked work items',
      count: 2,
      query: {
        dependency: 'dependency_blocked',
        sort: 'priority_desc'
      }
    };

    expect(deliveryHealthReasonLabel(reason)).toBe('2 dependency-blocked work items');
  });

  it('converts reason queries to router query params', () => {
    const reason: DeliveryHealthReasonDto = {
      key: 'blocked_work',
      severity: 'critical',
      message: '1 blocked work item',
      count: 1,
      query: {
        milestoneId: '10000000-0000-4000-8000-000000000351',
        status: 'blocked',
        blocked: true,
        sort: 'priority_desc'
      }
    };

    expect(deliveryHealthReasonQueryParams(reason)).toEqual({
      milestoneId: '10000000-0000-4000-8000-000000000351',
      status: 'blocked',
      blocked: 'true',
      sort: 'priority_desc'
    });
  });

  it('omits empty work item query values and returns null when no params remain', () => {
    const query: WorkItemQuery = {
      status: 'blocked',
      search: '',
      assigneeId: undefined,
      blocked: false,
      sort: 'priority_desc'
    };

    expect(workItemQueryToRouterQueryParams(query)).toEqual({
      status: 'blocked',
      blocked: 'false',
      sort: 'priority_desc'
    });
    expect(workItemQueryToRouterQueryParams(null)).toBeNull();
    expect(workItemQueryToRouterQueryParams({ search: '' })).toBeNull();
  });
});
