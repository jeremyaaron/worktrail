export function populatedRiskSections<T extends { count: number }>(sections: readonly T[]): T[] {
  return sections.filter(section => section.count > 0);
}
