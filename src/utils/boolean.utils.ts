export function not<T>(exp: T | null | undefined): exp is null | undefined {
  return !exp;
}
