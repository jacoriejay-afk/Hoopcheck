// Source parity, semantic contrast, and unchanged data-contract checks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const ts = require('typescript');
const mobile = path.resolve(__dirname, '..');
const root = path.resolve(mobile, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const run = (source, imports = {}) => {
  const context = { exports: {}, require: name => imports[name] };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return context.exports;
};
const { getEntryTheme, tokens } = run(read('apps/mobile/src/theme.ts'), { 'react-native': { Platform: { select: x => x.default } } });
const crest = run(read('apps/mobile/src/crest.ts'), { './theme': { tokens } });
const webLogo = read('components/TeamLogo.tsx');
const ast = ts.createSourceFile('logo.tsx', webLogo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = ast.statements.filter(ts.isFunctionDeclaration).filter(n => ['initials', 'hashName'].includes(n.name?.text)).map(n => n.getText(ast)).join('\n');
const palette = webLogo.match(/const PALETTE = (\[.*?\]) as const/)[1];
const web = run(`const PALETTE = ${palette};\n${functions}\nexport { initials, hashName };`);
for (const name of ['', '  ', 'Real Madrid', 'Barcelona', 'Fenerbahçe SK', 'Žalgiris Kaunas', '東京 Team', 'A  B', 'İstanbul']) {
  assert.equal(crest.crestInitials(name), web.initials(name));
  assert.equal(crest.crestColor(name), tokens.crest.palette[web.hashName(name)]);
}
assert.equal(read('apps/mobile/src/countryFlag.ts').split('\n').slice(1).join('\n'), read('lib/countryFlag.ts'));
const luminance = hex => {
  const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
function check(fg, bg, label) {
  const a = luminance(fg), b = luminance(bg);
  assert.ok((Math.max(a,b) + .05) / (Math.min(a,b) + .05) >= 4.5, label);
}
const routes = ['teams','leagues','coaches','players','teams/[id]','leagues/[id]','players/[id]'];
for (const dark of [false,true]) {
  const theme = getEntryTheme(dark);
  for (const [fg,bg] of [['foreground','background'],['foreground','surface'],['muted','surface'],['accent','surface'],['onButton','button'],['onChip','chip'],['error','errorSurface']]) check(theme[fg], theme[bg], `${dark}: ${fg}/${bg}`);
  check(theme.entityHero.ink, theme.entityHero.background, 'entity hero');
  for (const route of routes) {
    const file = `apps/mobile/app/${route}.tsx`, source = read(file);
    const factory = source.slice(source.indexOf('const createStyles'));
    const { styles } = run(`const theme = ${JSON.stringify(theme)}; const StyleSheet = { create: x => x };\n${factory}\nexport const styles = createStyles(theme);`, {});
    for (const [key, style] of Object.entries(styles)) {
      if (style.color && style.backgroundColor) check(style.color, style.backgroundColor, `${route}/${key}/${dark}`);
    }
    check(styles.body?.color || styles.meta.color, theme.surface, `${route} body ${dark}`);
  }
}

// Compare exact query expressions with merged PARITY-1. No selects, filters, limits,
// ordering, tables or data endpoints may change in this visual-only phase.
function dataCalls(source) {
  const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const calls = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.getText(ast).startsWith('supabase.') && !(ts.isPropertyAccessExpression(node.parent) || ts.isCallExpression(node.parent))) calls.push(node.getText(ast).replace(/\s+/g, ''));
    ts.forEachChild(node, visit);
  }
  visit(ast); return calls;
}
for (const route of [...routes, 'dashboard']) {
  const file = `apps/mobile/app/${route}.tsx`;
  const before = cp.execFileSync('git', ['show', `6513c89e:${file}`], { cwd: root, encoding: 'utf8' });
  assert.deepEqual(dataCalls(read(file)), dataCalls(before), `${route}: data calls changed`);
}
console.log('PASS: web crest/flag parity, both-theme contrast, and unchanged mobile data calls');
