export interface ProjectWorkItemFilterFormValue {
  search: string;
  status: string;
  assigneeId: string;
  reporterId: string;
  type: string;
  labelId: string;
  milestoneId: string;
  cycleId: string;
  priority: string;
  dueDateState: string;
  dependency: string;
  workRisk: string;
  sort: string;
}

export interface WorkspaceWorkItemFilterFormValue extends ProjectWorkItemFilterFormValue {
  projectId: string;
  workState: string;
  blocked: string;
  archivedProjects: string;
}

export const defaultProjectWorkItemFilterValues: ProjectWorkItemFilterFormValue = {
  search: '',
  status: '',
  assigneeId: '',
  reporterId: '',
  type: '',
  labelId: '',
  milestoneId: '',
  cycleId: '',
  priority: '',
  dueDateState: '',
  dependency: '',
  workRisk: '',
  sort: 'updated_desc'
};

export const defaultWorkspaceWorkItemFilterValues: WorkspaceWorkItemFilterFormValue = {
  ...defaultProjectWorkItemFilterValues,
  projectId: '',
  workState: '',
  blocked: '',
  archivedProjects: 'exclude'
};
