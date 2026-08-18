#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

const files = {
  runtime: path.join(root, 'components', 'reportos-client-runtime.tsx'),
  deck: path.join(root, 'components', 'composer-operator-deck.tsx'),
  deckCss: path.join(root, 'components', 'composer-operator-deck.module.css'),
  cockpitCss: path.join(root, 'app', 'ui-composer-cockpit-v2.css'),
  flowGuide: path.join(root, 'components', 'composer-flow-guide.tsx'),
  flowGuideCss: path.join(root, 'components', 'composer-flow-guide.module.css'),
};

function die(message) {
  console.error(`\n[composer-dense-unified-control] ${message}\n`);
  process.exit(1);
}

function mustExist(file) {
  if (!fs.existsSync(file)) {
    die(`Missing required file: ${path.relative(root, file)}`);
  }
}

function read(file) {
  mustExist(file);
  return fs.readFileSync(file, 'utf8');
}

function backup(file) {
  if (!fs.existsSync(file)) return;
  const backupPath = `${file}.bak-${stamp}`;
  fs.copyFileSync(file, backupPath);
  console.log(`backup  ${path.relative(root, backupPath)}`);
}

function write(file, content) {
  fs.writeFileSync(file, content.replace(/\r\n/g, '\n'), 'utf8');
  console.log(`write   ${path.relative(root, file)}`);
}

function remove(file) {
  if (!fs.existsSync(file)) return;
  fs.rmSync(file, { force: true });
  console.log(`remove  ${path.relative(root, file)}`);
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) die(`Patch anchor not found: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    die(`Patch anchor is ambiguous: ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

for (const file of [files.runtime, files.deck, files.deckCss, files.cockpitCss]) {
  mustExist(file);
}

for (const file of Object.values(files)) {
  backup(file);
}

/* 1) Remove standalone floating Flow Dock from global runtime. */
let runtime = read(files.runtime);
runtime = runtime.replace(/\nconst ComposerFlowGuide = dynamic\([\s\S]*?\n\);\n/, '\n');
runtime = runtime.replace(/\n\s*<ComposerFlowGuide \/>\s*/, '\n      ');
if (runtime.includes('ComposerFlowGuide')) {
  die('ComposerFlowGuide still exists in runtime after patch.');
}
write(files.runtime, runtime);

/* 2) Keep guided flow, but merge it into the existing Operator Deck. */
let deck = read(files.deck);

deck = replaceOnce(
  deck,
  `  const copyReport =\n`,
  `  const continueFlow =\n    useCallback(() => {\n      const nextIssue =\n        readiness?.blockers[0] ??\n        readiness?.advisories[0];\n\n      jumpTo(\n        nextIssue?.section ??\n        'preview'\n      );\n    }, [\n      jumpTo,\n      readiness,\n    ]);\n\n  const copyReport =\n`,
  'continue flow callback'
);

deck = replaceOnce(
  deck,
  `      if (event.key === 'Escape') {\n        closePalette();\n      }\n`,
  `      if (\n        event.altKey &&\n        event.key\n          .toLocaleLowerCase(\n            'en-US'\n          ) === 'j'\n      ) {\n        event.preventDefault();\n        continueFlow();\n      }\n\n      if (event.key === 'Escape') {\n        closePalette();\n      }\n`,
  'Alt+J shortcut'
);

deck = replaceOnce(
  deck,
  `    closePalette,\n    visible,\n  ]);\n`,
  `    closePalette,\n    continueFlow,\n    visible,\n  ]);\n`,
  'keyboard effect dependencies'
);

deck = replaceOnce(
  deck,
  `          <strong>Operator Deck</strong>\n          <small>\n            {issues.length === 0\n              ? 'Ready · Ctrl K'\n              : \`\${issues.length} signal\${issues.length === 1 ? '' : 's'} · Ctrl K\`}\n          </small>\n`,
  `          <strong>Composer control</strong>\n          <small>\n            {issues.length === 0\n              ? 'Ready · Ctrl K'\n              : \`\${issues.length} gap\${issues.length === 1 ? '' : 's'} · Alt J\`}\n          </small>\n`,
  'launcher copy'
);

deck = replaceOnce(
  deck,
  `                <strong>Composer cockpit</strong>\n                <small>\n                  Readiness, reusable templates, and rapid actions.\n                </small>\n`,
  `                <strong>Composer control</strong>\n                <small>\n                  Guided flow, templates, and rapid actions in one place.\n                </small>\n`,
  'panel heading'
);

deck = replaceOnce(
  deck,
  `                ['readiness', 'Readiness'],\n`,
  `                ['readiness', 'Flow'],\n`,
  'readiness tab label'
);

const readinessOpen = `          {tab === 'readiness' ? (\n            <div className={styles.panelBody}>\n              <div className={styles.scoreGrid}>`;

const integratedFlow = `          {tab === 'readiness' ? (\n            <div className={styles.panelBody}>\n              <div className={styles.compactFlowRail}>\n                {(\n                  [\n                    ['identity', 'Identity'],\n                    ['dispatch', 'Dispatch'],\n                    ['progress', 'Progress'],\n                    ['closure', 'Closure'],\n                  ] as const\n                ).map(([section, label], index) => {\n                  const hasGap = issues.some(\n                    (issue) =>\n                      issue.section === section\n                  );\n\n                  return (\n                    <button\n                      className={styles.compactFlowStep}\n                      data-state={\n                        hasGap\n                          ? 'pending'\n                          : 'clear'\n                      }\n                      type=\"button\"\n                      key={section}\n                      onClick={() =>\n                        jumpTo(section)\n                      }\n                    >\n                      <span>\n                        {hasGap ? (\n                          index + 1\n                        ) : (\n                          <Check size={11} />\n                        )}\n                      </span>\n                      <strong>{label}</strong>\n                    </button>\n                  );\n                })}\n              </div>\n\n              <button\n                className={styles.compactNextAction}\n                data-ready={\n                  readiness?.readyForHandover\n                    ? 'true'\n                    : 'false'\n                }\n                type=\"button\"\n                onClick={continueFlow}\n              >\n                <span className={styles.compactNextIcon}>\n                  {readiness?.readyForHandover ? (\n                    <Check size={14} />\n                  ) : (\n                    <ChevronRight size={14} />\n                  )}\n                </span>\n                <span className={styles.compactNextCopy}>\n                  <small>NEXT</small>\n                  <strong>\n                    {issues[0]?.label ??\n                      'Review formatted report'}\n                  </strong>\n                </span>\n                <kbd>ALT J</kbd>\n              </button>\n\n              <div className={styles.scoreGrid}>`;

deck = replaceOnce(
  deck,
  readinessOpen,
  integratedFlow,
  'integrated flow rail'
);

write(files.deck, deck);

/* 3) Dense visual language: one launcher, one sidecar, no center floating bar. */
let deckCss = read(files.deckCss);
const deckPatch = `\n\n/* Composer Control V3 — unified dense flow inside Operator Deck. */\n.compactFlowRail {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: 5px;\n  margin-bottom: 7px;\n}\n\n.compactFlowStep {\n  display: grid;\n  min-width: 0;\n  min-height: 38px;\n  grid-template-columns: 20px minmax(0, 1fr);\n  align-items: center;\n  gap: 5px;\n  padding: 5px 6px;\n  border: 1px solid rgba(65, 72, 101, 0.075);\n  border-radius: 9px;\n  color: #6f778a;\n  text-align: left;\n  background: rgba(250, 251, 254, 0.74);\n  cursor: pointer;\n  transition: border-color 140ms ease, background 140ms ease, transform 140ms ease;\n}\n\n.compactFlowStep:hover,\n.compactFlowStep:focus-visible {\n  transform: translateY(-1px);\n  border-color: rgba(103, 84, 234, 0.18);\n  background: rgba(255, 255, 255, 0.96);\n  outline: none;\n}\n\n.compactFlowStep > span {\n  display: grid;\n  width: 20px;\n  height: 20px;\n  place-items: center;\n  border-radius: 7px;\n  color: #705fdb;\n  background: rgba(103, 84, 234, 0.07);\n  font-size: 10px;\n  font-weight: 820;\n}\n\n.compactFlowStep[data-state='clear'] {\n  border-color: rgba(35, 158, 114, 0.13);\n  color: #287c61;\n  background: rgba(35, 158, 114, 0.04);\n}\n\n.compactFlowStep[data-state='clear'] > span {\n  color: #239e72;\n  background: rgba(35, 158, 114, 0.075);\n}\n\n.compactFlowStep strong {\n  overflow: hidden;\n  color: currentColor;\n  font-size: 11px;\n  font-weight: 760;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.compactNextAction {\n  display: grid;\n  width: 100%;\n  min-height: 46px;\n  grid-template-columns: 28px minmax(0, 1fr) auto;\n  align-items: center;\n  gap: 7px;\n  margin-bottom: 7px;\n  padding: 6px 7px;\n  border: 1px solid rgba(103, 84, 234, 0.14);\n  border-radius: 10px;\n  color: #5f4bd4;\n  text-align: left;\n  background: linear-gradient(90deg, rgba(103, 84, 234, 0.075), rgba(103, 84, 234, 0.015)), rgba(255, 255, 255, 0.8);\n  cursor: pointer;\n  transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;\n}\n\n.compactNextAction:hover,\n.compactNextAction:focus-visible {\n  transform: translateY(-1px);\n  border-color: rgba(103, 84, 234, 0.24);\n  box-shadow: 0 8px 20px rgba(70, 58, 145, 0.07);\n  outline: none;\n}\n\n.compactNextAction[data-ready='true'] {\n  border-color: rgba(35, 158, 114, 0.15);\n  color: #267d61;\n  background: linear-gradient(90deg, rgba(35, 158, 114, 0.07), rgba(35, 158, 114, 0.01)), rgba(255, 255, 255, 0.82);\n}\n\n.compactNextIcon {\n  display: grid;\n  width: 28px;\n  height: 28px;\n  place-items: center;\n  border-radius: 8px;\n  color: currentColor;\n  background: color-mix(in srgb, currentColor 9%, transparent);\n}\n\n.compactNextCopy {\n  display: flex;\n  min-width: 0;\n  flex-direction: column;\n}\n\n.compactNextCopy small {\n  color: #969dad;\n  font-size: 10px;\n  font-weight: 820;\n  letter-spacing: 0.07em;\n}\n\n.compactNextCopy strong {\n  overflow: hidden;\n  margin-top: 1px;\n  color: #454d61;\n  font-size: 11.5px;\n  font-weight: 790;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.compactNextAction kbd {\n  padding: 3px 5px;\n  border: 1px solid rgba(79, 75, 107, 0.1);\n  border-radius: 6px;\n  color: #7f8798;\n  background: rgba(255, 255, 255, 0.72);\n  font-family: inherit;\n  font-size: 10px;\n  font-weight: 740;\n}\n\n@media (max-width: 520px) {\n  .compactFlowRail {\n    gap: 3px;\n  }\n\n  .compactFlowStep {\n    min-height: 36px;\n    grid-template-columns: 1fr;\n    place-items: center;\n    padding: 4px;\n  }\n\n  .compactFlowStep strong {\n    display: none;\n  }\n\n  .compactNextAction kbd {\n    display: none;\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .compactFlowStep,\n  .compactNextAction {\n    transition: none;\n  }\n\n  .compactFlowStep:hover,\n  .compactFlowStep:focus-visible,\n  .compactNextAction:hover,\n  .compactNextAction:focus-visible {\n    transform: none;\n  }\n}\n`;

if (!deckCss.includes('Composer Control V3 — unified dense flow')) {
  deckCss = deckCss.trimEnd() + deckPatch + '\n';
}
write(files.deckCss, deckCss);

/* 4) Compact the existing sidecar and launcher without shrinking readable text. */
let cockpitCss = read(files.cockpitCss);
cockpitCss = cockpitCss
  .replace('  min-width: 184px;\n  min-height: 46px;', '  min-width: 158px;\n  min-height: 42px;')
  .replace('  width: min(360px, calc(100vw - 36px));', '  width: min(336px, calc(100vw - 36px));')
  .replace('    padding-right: 390px;', '    padding-right: 364px;')
  .replace('    width: min(348px, calc(100vw - 28px));', '    width: min(332px, calc(100vw - 28px));')
  .replace('    min-width: 166px;', '    min-width: 150px;');

const cockpitPatch = `\n\n/* Composer Control V3 final density calibration. */\nbutton[data-ready][aria-expanded] {\n  right: 18px;\n  bottom: 90px;\n  grid-template-columns: 30px minmax(0, 1fr) 14px;\n  gap: 7px;\n  padding: 5px 8px 5px 6px;\n}\n\nbutton[data-ready][aria-expanded] > span:first-child {\n  width: 30px;\n  height: 30px;\n  border-radius: 9px;\n}\n\naside[aria-label='Composer operator deck'] {\n  top: 78px;\n  bottom: 92px;\n}\n\naside[aria-label='Composer operator deck'] > header {\n  min-height: 48px;\n  padding: 11px 12px 9px;\n}\n\naside[aria-label='Composer operator deck'] > div[role='tablist'] {\n  padding: 5px 7px;\n}\n\naside[aria-label='Composer operator deck'] > div[role='tablist'] button {\n  min-height: 29px;\n}\n\naside[aria-label='Composer operator deck'] > div:not([role]) {\n  padding: 8px;\n}\n\naside[aria-label='Composer operator deck'] button[data-severity] {\n  min-height: 46px;\n  padding: 7px 8px;\n}\n\n@media (min-width: 1720px) {\n  html:has(aside[aria-label='Composer operator deck'])\n    .app-shell[data-workspace-mode='compose']\n    .main-stage {\n    padding-right: 364px;\n  }\n}\n\n@media (max-width: 1023px) {\n  aside[aria-label='Composer operator deck'] {\n    right: 8px;\n    left: 8px;\n    max-height: min(64dvh, 620px);\n  }\n}\n`;

if (!cockpitCss.includes('Composer Control V3 final density calibration')) {
  cockpitCss = cockpitCss.trimEnd() + cockpitPatch + '\n';
}
write(files.cockpitCss, cockpitCss);

/* 5) Obsolete floating FlowGuide UI files are removed; business flow logic remains. */
remove(files.flowGuide);
remove(files.flowGuideCss);

console.log('\n[composer-dense-unified-control] DONE');
console.log('Standalone center Flow Dock removed.');
console.log('Guided flow merged into the single Composer Control sidecar.');
