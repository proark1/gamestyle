import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const roots = ['app', 'games', 'shared', 'platform', 'db', 'scripts'];
const files = roots.flatMap((root) =>
  readdirSync(root, { recursive: true })
    .filter((file) => /\.(ts|tsx|mjs)$/.test(file))
    .map((file) => `${root}/${file.replaceAll('\\', '/')}`),
);
const gameOf = (file) => /^games\/([^/]+)\//.exec(file)?.[1];
const isTest = (file) => file.includes('.test.') || file.includes('/scripts/');
const violations = [];
const dependencies = new Map();
const clients = [];
const serverFiles = new Set();
let imports = 0;

for (const file of files) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  if (
    source.statements.some(
      (node) =>
        ts.isExpressionStatement(node) &&
        ts.isStringLiteral(node.expression) &&
        node.expression.text === 'use client',
    )
  )
    clients.push(file);
  if (
    /^(db\/(?!contract|schema|env)|platform\/audio\/(?!.*catalog)|app\/api\/)|\/server\/|shared\/(http\/|peer\/coordinator|voice\/server|audio\/(?:construction\/)?(?:access|http|storage|provider|crypto))/.test(
      file,
    )
  )
    serverFiles.add(file);
  dependencies.set(file, []);
  function visit(node) {
    const specifier =
      ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
        ? node.moduleSpecifier
        : ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword
          ? node.arguments[0]
          : undefined;
    if (specifier && ts.isStringLiteral(specifier)) {
      const name = specifier.text;
      const typeOnly =
        (ts.isImportDeclaration(node) &&
          (node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword ||
            (!node.importClause?.name &&
              node.importClause?.namedBindings &&
              ts.isNamedImports(node.importClause.namedBindings) &&
              node.importClause.namedBindings.elements.every(
                (item) => item.isTypeOnly,
              )))) ||
        (ts.isExportDeclaration(node) && node.isTypeOnly);
      if (!typeOnly && name.startsWith('node:')) serverFiles.add(file);
      const base = name.startsWith('@/')
        ? name.slice(2)
        : name.startsWith('.')
          ? path.posix.normalize(
              path.posix.join(path.posix.dirname(file), name),
            )
          : null;
      if (base) {
        imports++;
        const target = [
          base,
          `${base}.ts`,
          `${base}.tsx`,
          `${base}.mjs`,
          `${base}/index.ts`,
          `${base}/index.tsx`,
        ].find(
          (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
        );
        if (target && !typeOnly) dependencies.get(file).push(target);
        if (!target) violations.push(`${file}: unresolved import ${name}`);
        else if (!isTest(file)) {
          if (gameOf(file) && gameOf(target) && gameOf(file) !== gameOf(target))
            violations.push(
              `${file}: imports another game's implementation (${target})`,
            );
          if (
            file.startsWith('shared/') &&
            /^(games|platform|app)\//.test(target)
          )
            violations.push(
              `${file}: shared code depends on application composition (${target})`,
            );
          if (!file.startsWith('app/') && target.startsWith('app/'))
            violations.push(
              `${file}: implementation imports a route (${target})`,
            );
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

for (const client of clients) {
  const visited = new Set();
  const walk = (file, chain) => {
    if (visited.has(file)) return;
    visited.add(file);
    if (serverFiles.has(file)) {
      violations.push(
        `${client}: client code reaches server implementation (${[...chain, file].join(' -> ')})`,
      );
      return;
    }
    for (const target of dependencies.get(file) ?? [])
      walk(target, [...chain, file]);
  };
  walk(client, []);
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Architecture checked: ${files.length} files, ${imports} local imports, ${clients.length} client entries; game, shared and server boundaries hold.`,
  );
