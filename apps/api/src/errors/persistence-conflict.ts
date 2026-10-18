import { ConflictError } from './app-error.js';

export function rethrowConstraintConflict(error: unknown, messages: Readonly<Record<string, string>>): never {
  const visited = new Set<unknown>();
  let current = error;
  while (typeof current === 'object' && current !== null && !visited.has(current)) {
    visited.add(current);
    if ('code' in current && current.code === '23505' && 'constraint' in current &&
      typeof current.constraint === 'string' && Object.hasOwn(messages, current.constraint)) {
      throw new ConflictError(messages[current.constraint]!);
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  throw error;
}

export const cycleConstraintConflicts = {
  project_cycles_project_id_active_unique: 'This project already has an active cycle.',
  project_cycles_project_id_active_name_unique: 'A cycle with this name already exists.'
} as const;

export const projectConstraintConflicts = {
  projects_workspace_id_key_unique: 'Project key is already in use.'
} as const;

export const labelConstraintConflicts = {
  labels_project_id_active_name_unique: 'An active label with this name already exists.'
} as const;

export const milestoneConstraintConflicts = {
  milestones_project_id_active_name_unique: 'An active milestone with this name already exists.'
} as const;
