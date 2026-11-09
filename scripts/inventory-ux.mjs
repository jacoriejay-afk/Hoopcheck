import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const refArgument = process.argv.find(argument => argument.startsWith('--ref='));
const ref = refArgument ? execFileSync('git', ['rev-parse', '--verify', refArgument.slice(6)], { encoding: 'utf8' }).trim() : null;
const files = (ref ? execFileSync('git', ['ls-tree', '-r', '--name-only', ref, '--', 'app', 'components'], { encoding: 'utf8' }).trim().split('\n') : [...walk('app'), ...walk('components')]).filter(file => /\.(tsx|ts)$/.test(file));
const inventory = files.map(file => {
  const source = ref ? execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8' }) : readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const controls = [];
  const visit = node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      const attributes = node.attributes.properties.map(attribute => attribute.getText(ast));
      if (['Link', 'a', 'button', 'input', 'textarea', 'select', 'form', 'summary'].includes(tag)) {
        const label = ts.isJsxElement(node.parent) ? node.parent.children.map(child => child.getText(ast)).join(' ').replace(/\s+/g, ' ').trim().slice(0, 240) : null;
        controls.push({ tag, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, label, attributes });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return {
    file,
    sourceRef: ref || 'working tree',
    route: /\/(page|route)\.tsx?$/.test(file) ? '/' + file.replace(/^app\//, '').replace(/\/?(page|route)\.tsx?$/, '') : null,
    kind: file.endsWith('/route.ts') ? 'API' : file.endsWith('/page.tsx') ? 'page' : 'shared',
    roleSignals: [...new Set(source.match(/(?:account_type|accountType|entitlements|player_verified|adminRole|profile_claim_requests|subscription|can[A-Z]\w*)/g) || [])],
    stateSignals: [...new Set(source.match(/\b(?:loading|error|empty|success|message|disabled|aria-busy|role="alert"|role="status")\b/gi) || [])],
    controls,
    verification: 'Source inventory only; state signals do not establish working behavior or authorization.',
  };
});
writeFileSync('reports/ux-inventory.json', JSON.stringify(inventory, null, 2) + '\n');
const routes = inventory.filter(entry => entry.route);
writeFileSync('reports/ux-route-inventory.md', `# UX source inventory\n\nGenerated with \`node scripts/inventory-ux.mjs\`. ${routes.filter(r => r.kind === 'page').length} pages, ${routes.filter(r => r.kind === 'API').length} API routes, ${inventory.reduce((sum, r) => sum + r.controls.length, 0)} control declarations across app and shared components.\n\nThis is a source inventory, not a completed runtime audit. Dynamic destinations and conditional controls require role-specific interaction verification. Full control attributes and line references are in ux-inventory.json. Authorization remains in each existing page, API and RLS policy.\n\n| Route | Kind | Source | Controls | Access signals |\n| --- | --- | --- | ---: | --- |\n` + routes.map(r => `| ${r.route} | ${r.kind} | ${r.file} | ${r.controls.length} | ${r.roleSignals.join(', ') || 'Inspect parent layout / middleware / server policies'} |`).join('\n') + '\n');
console.log(`Inventoried ${routes.length} routes and ${inventory.length} source files.`);
