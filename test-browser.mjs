import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const THEME_CONTEXTS = [
  { className: '', label: ':root', selector: ':root' },
  { className: 'theme-cyberpunk', label: 'theme-cyberpunk', selector: '.theme-cyberpunk' },
  { className: 'theme-fantasy', label: 'theme-fantasy', selector: '.theme-fantasy' },
  { className: 'theme-horror', label: 'theme-horror', selector: '.theme-horror' },
  { className: 'theme-scifi', label: 'theme-scifi', selector: '.theme-scifi' },
  { className: 'holodeck-idle', label: 'holodeck-idle', selector: 'body.holodeck-idle' }
];
const THEME_VARS = [
  '--theme-primary',
  '--theme-secondary',
  '--theme-bg',
  '--theme-panel',
  '--theme-text',
  '--theme-text-dim',
  '--theme-border'
];
const PROBE_HTML = [
  '<!doctype html>',
  '<html>',
  '<head><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"></head>',
  '<body></body>',
  '</html>'
].join('');
const START_TIMEOUT_MS = 10_000;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(error => {
        if (error) reject(error);
        else if (port === null) reject(new Error('Could not allocate a loopback port.'));
        else resolve(port);
      });
    });
  });
}

async function waitForServer(url, child, readChildLog) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error('Browser harness server exited before it became ready.\n' + readChildLog());
    }

    try {
      const response = await fetch(url);
      await response.arrayBuffer();
      if (response.ok) return;
      lastError = new Error('readiness endpoint returned HTTP ' + response.status);
    } catch (error) {
      lastError = error;
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  throw new Error(
    'Timed out waiting for browser harness server at ' + url +
    (lastError ? ': ' + lastError.message : '') + '\n' + readChildLog()
  );
}

async function runOracle(page) {
  return page.evaluate(async ({ themeContexts, themeVars }) => {
    const result = {
      stylesheetReachable: false,
      cssomErrors: [],
      unitCount: 0,
      distinctCounts: [],
      assertionCount: 0,
      phaseAFailures: [],
      phaseBFailures: [],
      phaseCFailures: [],
      phaseDFailures: [],
      unsupportedCascades: [],
      undefinedConsumers: []
    };

    const themeSelectors = new Set(themeContexts.map(context => context.selector));
    const inheritedSentinel = 'rgb(1, 2, 3)';
    const undefinedFallback = 'rgb(4, 5, 6)';
    const iacvtAllowlist = [];

    function splitDeclarations(cssText) {
      const declarations = [];
      let start = 0;
      let depth = 0;
      let quote = '';
      let escaped = false;

      for (let i = 0; i < cssText.length; i += 1) {
        const char = cssText[i];
        if (quote) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === quote) quote = '';
          continue;
        }
        if (char === '"' || char === "'") quote = char;
        else if (char === '(') depth += 1;
        else if (char === ')') depth = Math.max(0, depth - 1);
        else if (char === ';' && depth === 0) {
          declarations.push(cssText.slice(start, i));
          start = i + 1;
        }
      }
      declarations.push(cssText.slice(start));

      return declarations.flatMap(text => {
        const colon = text.indexOf(':');
        if (colon === -1) return [];
        const name = text.slice(0, colon).trim();
        const value = text
          .slice(colon + 1)
          .trim()
          .replace(/\s*!\s*important\s*$/i, '');
        return name && value ? [{ name, value }] : [];
      });
    }

    function stripQuotedStrings(value) {
      let stripped = '';
      let quote = '';
      let escaped = false;

      for (const char of value) {
        if (quote) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === quote) quote = '';
          stripped += ' ';
        } else if (char === '"' || char === "'") {
          quote = char;
          stripped += ' ';
        } else {
          stripped += char;
        }
      }
      return stripped;
    }

    function consumedCustomProperties(value) {
      const names = [];
      const unquoted = stripQuotedStrings(value);
      const pattern = /var\(\s*(--(?:\\.|[^\s,)])+)/gi;
      let match;
      while ((match = pattern.exec(unquoted)) !== null) names.push(match[1]);
      return names;
    }

    function colorFixture() {
      document.body.innerHTML = [
        '<div id="bh-color-parent">',
        '<div id="bh-color-a"></div>',
        '<div id="bh-color-b"></div>',
        '</div>'
      ].join('');
      return {
        parent: document.querySelector('#bh-color-parent'),
        probeA: document.querySelector('#bh-color-a'),
        probeB: document.querySelector('#bh-color-b')
      };
    }

    function classifyColor(name, fixture, inlineVars = {}) {
      fixture.parent.style.cssText = '';
      fixture.probeA.style.cssText = '';
      fixture.probeB.style.cssText = '';
      fixture.parent.style.setProperty('color', inheritedSentinel);
      for (const [customName, value] of Object.entries(inlineVars)) {
        fixture.parent.style.setProperty(customName, value);
      }
      fixture.probeA.style.setProperty('color', 'var(' + name + ', ' + undefinedFallback + ')');
      fixture.probeB.style.setProperty('color', 'var(' + name + ')');

      const fallbackComputed = getComputedStyle(fixture.probeA).color;
      const noFallbackComputed = getComputedStyle(fixture.probeB).color;
      if (fallbackComputed === undefinedFallback) {
        return { kind: 'undefined', computed: fallbackComputed };
      }
      if (noFallbackComputed === inheritedSentinel) {
        return { kind: 'not-color', computed: noFallbackComputed };
      }
      return { kind: 'valid', computed: noFallbackComputed };
    }

    const expectedStylesheet = new URL('/styles.css', location.href).href;
    const styleSheets = Array.from(document.styleSheets);
    const mainSheet = styleSheets.find(sheet => sheet.href === expectedStylesheet);
    if (!mainSheet) {
      result.cssomErrors.push('Phase E FAIL: styles.css is not reachable through CSSOM.');
    } else {
      try {
        void mainSheet.cssRules;
        result.stylesheetReachable = true;
      } catch (error) {
        result.cssomErrors.push(
          'Phase E FAIL: styles.css is not readable through CSSOM: ' + error.name + ': ' + error.message
        );
      }
    }

    const units = [];
    const definitions = [];
    const consumers = [];
    const scratch = document.createElement('div');
    let nextRuleId = 0;

    function walkRules(rules) {
      for (const rule of Array.from(rules)) {
        const ruleId = nextRuleId;
        nextRuleId += 1;
        const label = rule.selectorText || rule.keyText || rule.cssText.slice(0, 80);

        if (rule.style) {
          const declarations = splitDeclarations(rule.style.cssText);
          const customs = declarations.filter(declaration => declaration.name.startsWith('--'));

          for (const declaration of declarations) {
            if (declaration.name.startsWith('--')) {
              definitions.push({
                name: declaration.name,
                ruleId,
                selector: label,
                inThemeBlock: themeSelectors.has(rule.selectorText)
              });
            }

            for (const name of consumedCustomProperties(declaration.value)) {
              consumers.push({ name, ruleId, selector: label });
            }

            if (
              !declaration.name.startsWith('--') &&
              /var\(/i.test(declaration.value)
            ) {
              scratch.style.cssText = '';
              scratch.style.setProperty(declaration.name, declaration.value);
              const owned = Array.from(
                { length: scratch.style.length },
                (_, index) => scratch.style[index]
              );
              units.push({
                ruleId,
                selector: label,
                name: declaration.name,
                value: declaration.value,
                owned,
                customs
              });
            }
          }
        }

        try {
          if (rule.cssRules) walkRules(rule.cssRules);
          else if (rule.styleSheet?.cssRules) walkRules(rule.styleSheet.cssRules);
        } catch (error) {
          result.cssomErrors.push(
            'Phase E FAIL: could not recurse into ' + label + ': ' + error.name + ': ' + error.message
          );
        }
      }
    }

    for (const sheet of styleSheets) {
      try {
        walkRules(sheet.cssRules);
      } catch (error) {
        result.cssomErrors.push(
          'Phase E FAIL: stylesheet CSSOM is unreadable: ' + error.name + ': ' + error.message
        );
      }
    }
    result.unitCount = units.length;

    const unsupportedSeen = new Set();
    for (const definition of definitions.filter(item => !item.inThemeBlock)) {
      for (const consumer of consumers) {
        if (consumer.name !== definition.name || consumer.ruleId === definition.ruleId) continue;
        const key = [definition.ruleId, definition.name, consumer.ruleId].join('|');
        if (unsupportedSeen.has(key)) continue;
        unsupportedSeen.add(key);
        result.unsupportedCascades.push(
          'Phase B STOP: unsupported cascade: ' + definition.selector + ' defines ' +
          definition.name + ', which ' + consumer.selector +
          ' consumes; the isolated probe cannot model this — extend the harness before shipping this CSS.'
        );
      }
    }

    const definedNames = new Set(definitions.map(definition => definition.name));
    const undefinedSeen = new Set();
    for (const consumer of consumers) {
      if (definedNames.has(consumer.name)) continue;
      const key = [consumer.ruleId, consumer.name].join('|');
      if (undefinedSeen.has(key)) continue;
      undefinedSeen.add(key);
      result.undefinedConsumers.push(
        'Phase B STOP: unsupported: ' + consumer.selector + ' consumes ' + consumer.name +
        ', which the stylesheet never defines — it must come from runtime, and the probe cannot model that.'
      );
    }

    const colorsByContext = new Map();
    for (const context of themeContexts) {
      document.body.className = context.className;
      const fixture = colorFixture();
      const colors = {};
      for (const name of themeVars) {
        const verdict = classifyColor(name, fixture);
        if (verdict.kind === 'undefined') {
          result.phaseAFailures.push(
            'Phase A FAIL: ' + context.label + ' ' + name + ' is UNDEFINED.'
          );
        } else if (verdict.kind === 'not-color') {
          result.phaseAFailures.push(
            'Phase A FAIL: ' + context.label + ' ' + name + ' is DEFINED BUT NOT A COLOUR.'
          );
        } else {
          colors[name] = verdict.computed;
        }
      }
      colorsByContext.set(context.label, colors);
    }

    for (const name of ['--theme-primary', '--theme-bg']) {
      for (let left = 0; left < themeContexts.length; left += 1) {
        for (let right = left + 1; right < themeContexts.length; right += 1) {
          const leftContext = themeContexts[left];
          const rightContext = themeContexts[right];
          const leftValue = colorsByContext.get(leftContext.label)?.[name];
          const rightValue = colorsByContext.get(rightContext.label)?.[name];
          if (leftValue && rightValue && leftValue === rightValue) {
            result.phaseCFailures.push(
              'Phase C FAIL: ' + name + ' is not distinct between ' + leftContext.label +
              ' and ' + rightContext.label + ' (both ' + leftValue + ').'
            );
          }
        }
      }
    }

    document.body.innerHTML = [
      '<div id="bh-wrapper">',
      '<div id="bh-probe"></div>',
      '<div id="bh-control"></div>',
      '</div>'
    ].join('');
    const wrapper = document.querySelector('#bh-wrapper');
    const probe = document.querySelector('#bh-probe');
    const control = document.querySelector('#bh-control');
    const distinctUnits = new Map();
    for (const unit of units) {
      const key = JSON.stringify([unit.name, unit.value, unit.customs]);
      if (!distinctUnits.has(key)) distinctUnits.set(key, unit);
    }

    for (const context of themeContexts) {
      document.body.className = context.className;
      let contextAssertions = 0;
      for (const unit of distinctUnits.values()) {
        wrapper.style.cssText = '';
        probe.style.cssText = '';
        control.style.cssText = '';
        wrapper.style.setProperty('all', 'initial');
        for (const custom of unit.customs) {
          probe.style.setProperty(custom.name, custom.value);
          control.style.setProperty(custom.name, custom.value);
        }
        probe.style.setProperty(unit.name, unit.value);
        control.style.setProperty(unit.name, 'unset');

        const probeStyle = getComputedStyle(probe);
        const controlStyle = getComputedStyle(control);
        const survived = unit.owned.some(
          property => probeStyle.getPropertyValue(property) !== controlStyle.getPropertyValue(property)
        );
        contextAssertions += 1;
        result.assertionCount += 1;

        if (!survived) {
          const allowed = iacvtAllowlist.some(entry =>
            entry.selector === unit.selector &&
            entry.property === unit.name &&
            entry.value === unit.value &&
            entry.reason
          );
          if (!allowed) {
            result.phaseBFailures.push(
              'Phase B FAIL: ' + context.label + ' ' + unit.selector + ' ' + unit.name +
              ': ' + unit.value + ' computed exactly like unset' +
              (unit.owned.length ? ' across ' + unit.owned.join(', ') : ' and owns no browser-reported longhands') +
              '.'
            );
          }
        }
      }
      result.distinctCounts.push({ context: context.label, count: contextAssertions });
    }

    document.body.className = '';
    const moduleFixture = colorFixture();
    try {
      const { baseThemeVars, fullThemeVars } = await import('/theme-vars.js');
      const C = {
        primary: '210, 100%, 50%',
        secondary: '330, 100%, 50%',
        background: '220, 30%, 8%',
        text: '210, 20%, 95%',
        text_dim: '210, 10%, 65%'
      };
      const fixtures = [
        ['fixture 1 fullThemeVars(all fields)', () => fullThemeVars(C)],
        [
          'fixture 2 fullThemeVars(no text_dim)',
          () => fullThemeVars({
            primary: C.primary,
            secondary: C.secondary,
            background: C.background,
            text: C.text
          })
        ],
        [
          'fixture 3 baseThemeVars(all arguments)',
          () => baseThemeVars(C.primary, C.secondary, C.background)
        ],
        [
          'fixture 4 baseThemeVars(defaults)',
          () => baseThemeVars(undefined, undefined, undefined)
        ]
      ];

      for (const [label, makeVars] of fixtures) {
        try {
          const values = makeVars();
          for (const name of Object.keys(values).filter(key => key.startsWith('--theme-'))) {
            const verdict = classifyColor(name, moduleFixture, values);
            if (verdict.kind === 'undefined') {
              result.phaseDFailures.push(
                'Phase D FAIL: ' + label + ' returned an UNDEFINED ' + name + '.'
              );
            } else if (verdict.kind === 'not-color') {
              result.phaseDFailures.push(
                'Phase D FAIL: ' + label + ' returned ' + name + ' as NOT-A-COLOUR.'
              );
            }
          }
        } catch (error) {
          result.phaseDFailures.push(
            'Phase D FAIL: ' + label + ' threw ' + error.name + ': ' + error.message
          );
        }
      }
    } catch (error) {
      result.phaseDFailures.push(
        'Phase D FAIL: could not import the real /theme-vars.js module: ' +
        error.name + ': ' + error.message
      );
    }

    return result;
  }, { themeContexts: THEME_CONTEXTS, themeVars: THEME_VARS });
}

function assessResult(result, external) {
  const failures = [
    ...result.cssomErrors,
    ...result.phaseAFailures,
    ...result.phaseBFailures,
    ...result.phaseCFailures,
    ...result.phaseDFailures,
    ...result.unsupportedCascades,
    ...result.undefinedConsumers
  ];

  if (external.length > 0) {
    failures.push(
      'Phase E FAIL: external requests were attempted and aborted: ' + external.join(', ')
    );
  }
  if (result.unitCount < 150) {
    failures.push(
      'Phase E FAIL: collected only ' + result.unitCount +
      ' var-bearing declarations; expected at least 150.'
    );
  }
  if (result.assertionCount < 250) {
    failures.push(
      'Phase E FAIL: ran only ' + result.assertionCount +
      ' post-dedupe assertions; expected at least 250.'
    );
  }

  const distinctValues = [...new Set(result.distinctCounts.map(item => item.count))];
  const distinctSummary = distinctValues.length === 1
    ? String(distinctValues[0])
    : result.distinctCounts.map(item => item.context + '=' + item.count).join(', ');
  console.log(
    'Browser harness baseline: ' + result.unitCount + ' var-bearing declarations, ' +
    distinctSummary + ' distinct per theme context, ' + result.assertionCount +
    ' assertions, ' + result.phaseBFailures.length + ' failures, ' +
    result.unsupportedCascades.length + ' unsupported cascades, ' +
    result.undefinedConsumers.length + ' undefined-consumed vars, ' +
    external.length + ' external requests attempted.'
  );

  for (const failure of failures) console.error(failure);
  if (failures.length > 0) {
    throw new Error('Browser harness failed with ' + failures.length + ' diagnostic(s).');
  }
  if (!result.stylesheetReachable) {
    throw new Error('Browser harness failed closed because styles.css was not reachable.');
  }

  console.log('Browser harness passed.');
}

async function main() {
  const dbPath = path.join(
    os.tmpdir(),
    'aetheria-browser-' + process.pid + '-' + Date.now() + '.db'
  );
  const port = await getFreePort();
  const origin = 'http://127.0.0.1:' + port;
  const probeUrl = origin + '/__bh1__';
  const external = [];
  const childEnv = { ...process.env, PORT: String(port), RPG_DB_PATH: dbPath, NODE_ENV: 'test' };
  delete childEnv.ACCESS_SECRET;
  delete childEnv.ADMIN_SECRET;

  let child;
  let exited;
  let browser;
  let childOutput = '';
  let runError;
  const cleanupErrors = [];

  try {
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    exited = once(child, 'exit');
    const rememberOutput = chunk => {
      childOutput = (childOutput + chunk.toString()).slice(-20_000);
    };
    child.stdout.on('data', rememberOutput);
    child.stderr.on('data', rememberOutput);

    await waitForServer(origin + '/styles.css', child, () => childOutput);

    try {
      browser = await chromium.launch({ headless: true });
    } catch (error) {
      const tick = String.fromCharCode(96);
      throw new Error(
        'browser harness CANNOT RUN — run ' + tick +
        'npx playwright install chromium' + tick + '\n' + error.message
      );
    }

    const page = await browser.newPage();
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url === probeUrl) {
        return route.fulfill({ contentType: 'text/html', body: PROBE_HTML });
      }
      if (url.startsWith(origin + '/')) return route.continue();
      external.push(url);
      return route.abort();
    });

    await page.goto(probeUrl);
    const result = await runOracle(page);
    assessResult(result, external);
  } catch (error) {
    runError = error;
  } finally {
    if (browser) {
      await browser.close().catch(error => {
        cleanupErrors.push('could not close Chromium: ' + error.message);
      });
    }

    if (child) {
      try {
        if (child.exitCode === null && child.signalCode === null) child.kill();
      } catch (error) {
        cleanupErrors.push('could not stop browser harness server: ' + error.message);
      }
      if (exited) {
        await exited.catch(error => {
          cleanupErrors.push('could not await browser harness server exit: ' + error.message);
        });
      }
    }

    for (const suffix of ['', '-wal', '-shm']) {
      try {
        await fs.unlink(dbPath + suffix);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          cleanupErrors.push('could not remove ' + dbPath + suffix + ': ' + error.message);
        }
      }
    }
  }

  if (cleanupErrors.length > 0) {
    for (const error of cleanupErrors) console.error('Browser harness cleanup failure: ' + error);
    if (!runError) runError = new Error('Browser harness cleanup failed.');
  }
  if (runError) throw runError;
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
