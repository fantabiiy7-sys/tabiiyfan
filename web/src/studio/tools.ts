// Og'ir kutubxonalar (prettier, acorn) faqat kerak bo'lganda yuklanadi.
export interface Problem { kind: 'html' | 'css' | 'js'; line?: number; col?: number; message: string }

export async function formatCode(kind: 'html' | 'css' | 'js', src: string): Promise<string> {
  const prettier = await import('prettier/standalone');
  if (kind === 'css') { const p = await import('prettier/plugins/postcss'); return prettier.format(src, { parser: 'css', plugins: [p as any], tabWidth: 2 }); }
  if (kind === 'js') { const [b, e] = await Promise.all([import('prettier/plugins/babel'), import('prettier/plugins/estree')]); return prettier.format(src, { parser: 'babel', plugins: [b as any, e as any], tabWidth: 2, singleQuote: true, printWidth: 100 }); }
  const [h, c, b, e] = await Promise.all([import('prettier/plugins/html'), import('prettier/plugins/postcss'), import('prettier/plugins/babel'), import('prettier/plugins/estree')]);
  return prettier.format(src, { parser: 'html', plugins: [h as any, c as any, b as any, e as any], tabWidth: 2, printWidth: 100 });
}
export async function checkJs(src: string): Promise<Problem | null> {
  if (!src.trim()) return null;
  const acorn = await import('acorn');
  try { acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' }); return null; }
  catch (e: any) { return { kind: 'js', line: e.loc?.line, col: e.loc ? e.loc.column + 1 : undefined, message: String(e.message).replace(/\s*\(\d+:\d+\)$/, '') }; }
}
export async function checkCss(src: string): Promise<Problem | null> {
  if (!src.trim()) return null;
  try { await formatCode('css', src); return null; }
  catch (e: any) { return { kind: 'css', line: e.loc?.start?.line, col: e.loc?.start?.column, message: String(e.message).split('\n')[0].replace(/^CssSyntaxError:\s*/, '') }; }
}
