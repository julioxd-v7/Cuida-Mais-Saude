/** Coloca um nome de schema entre aspas, aceitando só nomes seguros. */
export function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) {
    throw new Error(`Nome de schema inválido: ${name}`);
  }
  return `"${name}"`;
}
