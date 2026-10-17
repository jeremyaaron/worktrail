// A transaction owns one PostgreSQL connection; never start its next query before the previous settles.
export async function mapSequential<T, R>(
  values: readonly T[],
  operation: (value: T, index: number) => R | Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (const [index, value] of values.entries()) {
    results.push(await operation(value, index));
  }
  return results;
}
