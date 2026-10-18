import { inject } from '@angular/core';
import type { CanActivateFn, CanDeactivateFn } from '@angular/router';

import { DraftDepartureCoordinator } from './draft-departure-coordinator';

export const protectReusedEditor: CanActivateFn = (_route, state) =>
  inject(DraftDepartureCoordinator).navigation(state);

export const protectEditorDeparture: CanDeactivateFn<unknown> = (_component, _route, _state, next) =>
  inject(DraftDepartureCoordinator).navigation(next);
