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

function browserAssert(condition, message) {
  if (!condition) throw new Error('Browser guard failed: ' + message);
}

async function addConfiguredModel(page, { label, provider = 'openai', model, keySource = 'provider', apiKey = '' }) {
  await page.locator('#btn-add-model').click();
  let row = page.locator('[data-model-row]').last();
  const id = await row.getAttribute('data-model-row');
  await row.locator('[data-field="label"]').fill(label);
  if (provider !== 'openai') {
    await row.locator('[data-field="provider"]').selectOption(provider);
    row = page.locator(`[data-model-row="${id}"]`);
  }
  await row.locator('[data-field="model"]').fill(model);
  if (keySource === 'custom') {
    await row.locator('[data-field="key-source"]').selectOption('custom');
    row = page.locator(`[data-model-row="${id}"]`);
    await row.locator('[data-field="custom-key"]').fill(apiKey);
  }
  return id;
}

async function runAdminRegistryGuard(page, origin, settingsResponseReads, settingsPosts) {
  const sharedSecret = 'BROWSER_SHARED_SECRET';
  const overrideSecret = 'BROWSER_OVERRIDE_SECRET';
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(origin + '/admin');
  await page.locator('body.show-panel').waitFor();

  browserAssert(await page.locator('[data-provider-row]').count() === 7, 'all seven providers are visible');
  browserAssert(await page.locator('[data-role-row]').count() === 5, 'exactly five Council roles are visible');
  const mainWidth = await page.locator('main').evaluate(node => node.getBoundingClientRect().width);
  browserAssert(mainWidth > 900 && mainWidth <= 1080, 'desktop admin column is compact and table-sized');

  const codeProvider = page.locator('[data-provider-row="claude-code"]');
  browserAssert(await codeProvider.locator('input').count() === 0, 'Claude Code provider has no key or endpoint input');
  await codeProvider.locator('[data-refresh-provider="claude-code"]').click();
  await codeProvider.locator('[data-catalog-state="claude-code"]').filter({ hasText: 'Logged in' }).waitFor();

  await page.locator('#provider-openai-key').fill(sharedSecret);
  await page.locator('[data-refresh-provider="openai"]').click();
  await page.locator('[data-catalog-state="openai"]').filter({ hasText: '2 models loaded' }).waitFor();

  const sharedA = await addConfiguredModel(page, {
    label: 'Shared fast', model: 'gpt-live-a'
  });
  const sharedB = await addConfiguredModel(page, {
    label: 'Shared prose', model: 'gpt-live-b'
  });
  const override = await addConfiguredModel(page, {
    label: 'Custom override', model: 'gpt-override', keySource: 'custom', apiKey: overrideSecret
  });
  const claudeCode = await addConfiguredModel(page, {
    label: 'Claude setup', provider: 'claude-code', model: 'claude-fable-5'
  });

  browserAssert(
    await page.locator(`[data-model-row="${claudeCode}"] [data-field="custom-key"]`).count() === 0,
    'Claude Code model row has no custom-key control'
  );
  browserAssert(
    await page.locator(`[data-model-row="${sharedA}"] [data-field="model"]`).getAttribute('list') === 'catalog-openai',
    'provider refresh supplies a datalist to every matching model row'
  );
  browserAssert(await page.locator('#catalog-openai option').count() === 2, 'live suggestions remain page-local');

  await page.locator('[data-role-row="setup"] [data-tier="primary"]').selectOption(claudeCode);
  await page.locator('[data-role-row="setup"] [data-tier="fallback"]').selectOption(sharedA);
  await page.locator('[data-role-row="interaction"] [data-tier="primary"]').selectOption(sharedA);
  await page.locator('[data-role-row="interaction"] [data-tier="fallback"]').selectOption(sharedB);
  await page.locator('[data-role-row="narration"] [data-tier="primary"]').selectOption(sharedB);
  await page.locator('[data-role-row="narration"] [data-tier="fallback"]').selectOption(override);
  browserAssert(
    await page.locator(`[data-remove-model="${sharedA}"]`).isDisabled(),
    'assigned entries cannot be removed'
  );

  await page.locator('#btn-save').click();
  await page.locator('#status.ok').filter({ hasText: 'Settings saved' }).waitFor();
  browserAssert(
    await page.locator('#catalog-openai option').count() === 2,
    'a normal save preserves the page-memory catalog'
  );
  await page.reload();
  await page.locator('body.show-panel').waitFor();
  browserAssert(await page.locator('[data-model-row]').count() === 4, 'configured model rows survive save/reload');
  browserAssert(
    await page.locator('[data-role-row="setup"] [data-tier="primary"]').inputValue() === claudeCode,
    'Claude Code Setup assignment survives save/reload'
  );
  browserAssert(
    await page.locator('[data-role-row="interaction"] [data-tier="primary"]').inputValue() === sharedA
      && await page.locator('[data-role-row="interaction"] [data-tier="fallback"]').inputValue() === sharedB,
    'shared provider-key primary/fallback assignments survive save/reload'
  );
  browserAssert(
    await page.locator(`[data-model-row="${override}"] [data-field="custom-key"]`).inputValue() === '',
    'stored custom secrets are never rendered back into password inputs'
  );

  await page.locator('[data-refresh-provider="openai"]').click();
  await page.locator('[data-catalog-state="openai"]').filter({ hasText: 'catalog offline' }).waitFor();
  const manualModel = page.locator(`[data-model-row="${sharedA}"] [data-field="model"]`);
  browserAssert(await manualModel.inputValue() === 'gpt-live-a', 'failed refresh does not clear a model selection');
  await manualModel.fill('manual-after-failure');
  await page.locator('#btn-save').click();
  await page.locator('#status.ok').filter({ hasText: 'Settings saved' }).waitFor();
  await page.reload();
  await page.locator('body.show-panel').waitFor();
  browserAssert(
    await page.locator(`[data-model-row="${sharedA}"] [data-field="model"]`).inputValue() === 'manual-after-failure',
    'manual model entry remains usable after catalog failure'
  );

  const responseBodies = await Promise.all(settingsResponseReads);
  for (const secret of [sharedSecret, overrideSecret]) {
    browserAssert(responseBodies.every(body => !body.includes(secret)), 'settings responses do not expose ' + secret);
    browserAssert(!(await page.locator('body').innerText()).includes(secret), 'DOM does not expose ' + secret);
  }
  browserAssert(settingsPosts.length >= 2, 'the UI performs atomic v2 settings saves');
  const firstSave = settingsPosts[0];
  browserAssert(firstSave.configVersion === 2, 'the browser sends the v2 wire contract');
  browserAssert(firstSave.providers.openai.apiKey === sharedSecret, 'one provider key is shared explicitly');
  browserAssert(
    firstSave.modelEntries.filter(entry => entry.provider === 'openai' && entry.keySource === 'provider').length === 2,
    'two OpenAI entries share the provider credential'
  );
  browserAssert(
    firstSave.modelEntries.find(entry => entry.id === override).apiKey === overrideSecret,
    'the custom override is isolated to its model entry'
  );

  await page.setViewportSize({ width: 500, height: 900 });
  const columns = await page.locator('[data-provider-row="openai"]').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  browserAssert(columns.split(' ').length === 1, 'narrow viewport collapses provider rows to one column');
  console.log('Admin model registry browser guard passed.');
}

const REVISION_A = `ak1:${'a'.repeat(64)}`;
const REVISION_B = `ak1:${'b'.repeat(64)}`;
const REVISION_C = `ak1:${'c'.repeat(64)}`;
const REVISION_D = `ak1:${'d'.repeat(64)}`;

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function projectedAbility({ id, definitionId, name, aliases = [], familyKey, familyLabel, help }) {
  return {
    abilityId: id,
    definitionId,
    definitionVersion: 1,
    name,
    trigger: name,
    aliases,
    familyKey,
    familyLabel,
    help
  };
}

function browserCharacter({ id, name, concept, revision, invocableAbilities, passiveName = null }) {
  const abilities = invocableAbilities.map(ability => ({
    id: ability.abilityId,
    definition_id: ability.definitionId,
    definition_version: ability.definitionVersion,
    name: `Internal ${ability.definitionId}`,
    description: 'Canonical mechanic text stays behind campaign presentation.',
    invocation: { schema_version: 1, family_key: ability.familyKey }
  }));
  if (passiveName) {
    abilities.push({
      id: `passive-${id}`,
      name: passiveName,
      tier: 'established',
      description: 'A passive capability that remains readable but is never inserted.',
      source: 'background'
    });
  }
  return {
    id,
    name,
    class: concept,
    level: 2,
    health: 12,
    max_health: 14,
    mana: 5,
    max_mana: 7,
    xp: 125,
    attributes: { strength: 11, agility: 13, intellect: 10, willpower: 12 },
    inventory: [],
    abilities,
    progression_notes: '',
    player_character_id: id + 100,
    abilityTriggerRevision: revision,
    invocableAbilities
  };
}

function campaignBrowserState({ campaignId, title, characters, joinedCharacterId, actingCharacterId, turnNumber = 1 }) {
  return {
    campaignId,
    title,
    genre: 'Browser fixture',
    currentQuest: { active_quest: 'Hold the crossing', quest_description: 'Keep the fiction moving.' },
    currentAct: 1,
    outline: { acts: [] },
    character: jsonClone(characters[0]),
    party: jsonClone(characters),
    joinedCharacterId,
    turnOrder: {
      actingCharacterId,
      order: characters.map(character => ({ id: character.id, name: character.name }))
    },
    npcs: [],
    ruleset: null,
    tableStyle: null,
    turn: {
      number: turnNumber,
      playerAction: null,
      narrative: 'The crossing waits in a hush.',
      suggestedChoices: ['Look around'],
      svg: '',
      rollResults: []
    }
  };
}

function replaceBrowserCharacter(state, character) {
  const next = jsonClone(state);
  next.party = next.party.map(member => member.id === character.id ? jsonClone(character) : member);
  if (next.character?.id === character.id) next.character = jsonClone(character);
  return next;
}

function resolvedBrowserTurn(state, requestBody) {
  const next = jsonClone(state);
  next.turn = {
    ...next.turn,
    number: (next.turn?.number || 0) + 1,
    playerAction: requestBody.playerAction,
    narrative: `Resolved: ${requestBody.playerAction}`,
    suggestedChoices: []
  };
  next.turnOrder.actingCharacterId = requestBody.characterId || next.turnOrder.actingCharacterId;
  return next;
}

async function waitForCount(items, expected, label, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (items.length < expected && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  browserAssert(items.length >= expected, label);
}

async function runSeatAbilityComposerGuard(browser, origin) {
  const seatToken = `seat_${'1'.repeat(48)}`;
  const guard = projectedAbility({
    id: 'seat-guard',
    definitionId: 'guardian.guard',
    name: 'guard',
    familyKey: 'protection',
    familyLabel: 'Protection',
    help: 'Hold the danger away from an ally.'
  });
  const ownCharacter = browserCharacter({
    id: 10,
    name: 'Seat Hero',
    concept: 'Guardian',
    revision: REVISION_D,
    invocableAbilities: [guard],
    passiveName: 'Stone Sense'
  });
  const state = campaignBrowserState({
    campaignId: 11,
    title: 'Seat Table',
    characters: [ownCharacter],
    joinedCharacterId: 10,
    actingCharacterId: 10
  });
  state.seatCharacterId = 10;
  state.party.push({
    id: 11,
    name: 'Other Seat',
    class: 'Opportunist',
    level: 2,
    health: 9,
    max_health: 12
  });
  state.turnOrder.order.push({ id: 11, name: 'Other Seat' });

  const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  await context.addInitScript(({ token }) => {
    localStorage.setItem('aetheria_settings', JSON.stringify({
      accessToken: token,
      enableDiagnostics: false,
      voiceNarration: false,
      voiceAutoPlay: true
    }));
  }, { token: seatToken });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', route => {
    const requestUrl = route.request().url();
    if (requestUrl === origin + '/api/seat/session') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(state) });
    }
    if (requestUrl === origin + '/api/campaigns/11') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(state) });
    }
    if (requestUrl.startsWith(origin + '/')) return route.continue();
    return route.abort();
  });

  try {
    await page.goto(origin + '/');
    await page.locator('#main-game-screen').waitFor({ state: 'visible' });
    await page.locator('.ability-button[data-ability-id="seat-guard"]').waitFor();
    browserAssert(await page.locator('.ability-button').count() === 1,
      'a seat sees only its own invocable ability controls');
    browserAssert((await page.locator('#char-abilities').innerText()).includes('guard'),
      'the seat sees its own campaign term');
    browserAssert(!(await page.locator('#char-abilities').innerText()).includes('backstab'),
      'another seat ability term never crosses the scoped payload');
    await page.locator('.party-member[data-character-id="11"]').click();
    browserAssert(await page.locator('#char-name').textContent() === 'Seat Hero',
      'seat party chips cannot switch the composer identity');
    browserAssert(pageErrors.length === 0, 'seat composer raises no page errors');
  } finally {
    await context.close();
  }
}

async function runAbilityComposerGuard(browser, origin) {
  const backstab = projectedAbility({
    id: 'ability-backstab',
    definitionId: 'opportunist.backstab',
    name: 'backstab',
    aliases: ['back stab'],
    familyKey: 'opportunity',
    familyLabel: 'Opportunity',
    help: 'Exploit an opening from a dangerous angle.'
  });
  const rally = projectedAbility({
    id: 'ability-rally',
    definitionId: 'commander.rally',
    name: 'rally',
    familyKey: 'command',
    familyLabel: 'Command',
    help: 'Steady allies who can hear you.'
  });
  const guard = projectedAbility({
    id: 'ability-guard',
    definitionId: 'guardian.guard',
    name: 'guard',
    familyKey: 'protection',
    familyLabel: 'Protection',
    help: 'Interpose yourself against a threat.'
  });
  const ward = projectedAbility({
    id: 'ability-ward',
    definitionId: 'mystic.ward',
    name: 'ward',
    familyKey: 'protection',
    familyLabel: 'Protection',
    help: 'Raise a brief protective boundary.'
  });
  const aria = browserCharacter({
    id: 1,
    name: 'Aria',
    concept: 'Opportunist',
    revision: REVISION_A,
    invocableAbilities: [backstab, rally],
    passiveName: 'Weather Eye'
  });
  const borin = browserCharacter({
    id: 2,
    name: 'Borin',
    concept: 'Guardian',
    revision: REVISION_B,
    invocableAbilities: [guard],
    passiveName: 'Stone Sense'
  });
  const wren = browserCharacter({
    id: 3,
    name: 'Wren',
    concept: 'Mystic',
    revision: REVISION_D,
    invocableAbilities: [ward],
    passiveName: 'Old Lore'
  });

  const states = new Map([
    [7, campaignBrowserState({
      campaignId: 7,
      title: 'Crossing Test',
      characters: [aria, borin],
      joinedCharacterId: 1,
      actingCharacterId: 2
    })],
    [8, campaignBrowserState({
      campaignId: 8,
      title: 'Ward Test',
      characters: [wren],
      joinedCharacterId: 3,
      actingCharacterId: 3
    })]
  ]);
  const campaignList = [
    { id: 7, title: 'Crossing Test', genre: 'Browser fixture', summary: 'Composer test.', created_at: '2026-08-03T12:00:00Z', character_name: 'Aria', player_character_id: 101 },
    { id: 8, title: 'Ward Test', genre: 'Browser fixture', summary: 'Session test.', created_at: '2026-08-03T12:00:00Z', character_name: 'Wren', player_character_id: 103 }
  ];
  const turnPosts = [];
  const delayedTurnGates = [];
  const unknownApiRequests = [];
  let networkFailed = false;
  let staleReturned = false;

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const requestUrl = request.url();
    if (!requestUrl.startsWith(origin + '/')) return route.abort();
    const url = new URL(requestUrl);

    if (url.pathname === '/api/campaigns' && request.method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(campaignList) });
    }
    const stateMatch = url.pathname.match(/^\/api\/campaigns\/(7|8)$/u);
    if (stateMatch && request.method() === 'GET') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(states.get(Number(stateMatch[1])))
      });
    }
    const journalMatch = url.pathname.match(/^\/api\/campaigns\/(7|8)\/journal$/u);
    if (journalMatch) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ turns: [], memories: [] }) });
    }
    const turnMatch = url.pathname.match(/^\/api\/campaigns\/(7|8)\/turn$/u);
    if (turnMatch && request.method() === 'POST') {
      const campaignId = Number(turnMatch[1]);
      const body = request.postDataJSON();
      turnPosts.push({ campaignId, body });
      if (body.playerAction.includes('OFFTURN')) {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Borin is acting.', code: 'OUT_OF_TURN' })
        });
      }
      if (body.playerAction.includes('NETWORK') && !networkFailed) {
        networkFailed = true;
        return route.abort('failed');
      }
      if (body.playerAction.includes('STALE') && !staleReturned) {
        staleReturned = true;
        const ambush = { ...backstab, name: 'ambush', trigger: 'ambush', aliases: [] };
        const refreshedAria = browserCharacter({
          id: 1,
          name: 'Aria',
          concept: 'Opportunist',
          revision: REVISION_C,
          invocableAbilities: [ambush, rally],
          passiveName: 'Weather Eye'
        });
        states.set(7, replaceBrowserCharacter(states.get(7), refreshedAria));
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Ability list changed.', code: 'ABILITY_TRIGGERS_STALE' })
        });
      }
      if (body.playerAction.includes('DELAY_')) {
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        delayedTurnGates.push({ release });
        await gate;
      }
      const next = resolvedBrowserTurn(states.get(campaignId), body);
      states.set(campaignId, next);
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(next) });
    }
    if (url.pathname.startsWith('/api/')) {
      unknownApiRequests.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"unexpected browser fixture route"}' });
    }
    return route.continue();
  });

  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  try {
    await page.goto(origin + '/');
    await page.locator('.campaign-card').first().waitFor();
    await page.locator('.campaign-card').first().click();
    await page.locator('#main-game-screen').waitFor({ state: 'visible' });
    const input = page.locator('#action-input');
    const send = page.locator('#btn-send-action');
    const backstabButton = page.locator('.ability-button[data-ability-id="ability-backstab"]');
    await backstabButton.waitFor();

    browserAssert(await input.evaluate(node => node.tagName) === 'TEXTAREA',
      'the action source is a native textarea');
    browserAssert(await page.locator('#action-highlight-backdrop').getAttribute('aria-hidden') === 'true',
      'the mirror is aria-hidden');
    browserAssert(await page.locator('#action-highlight-backdrop').evaluate(node => getComputedStyle(node).pointerEvents) === 'none',
      'the mirror is pointer-inert');
    browserAssert(await page.locator('[contenteditable="true"]').count() === 0,
      'the textarea is the only editable composer surface');
    const desktopRects = await page.evaluate(() => {
      const textarea = document.querySelector('#action-input').getBoundingClientRect();
      const backdrop = document.querySelector('#action-highlight-backdrop').getBoundingClientRect();
      return { textarea, backdrop };
    });
    browserAssert(Math.abs(desktopRects.textarea.width - desktopRects.backdrop.width) < 1,
      'desktop mirror and textarea widths align');
    browserAssert(await input.isEnabled(), 'off-turn table talk leaves prose entry enabled');
    browserAssert((await input.getAttribute('placeholder')).startsWith('Table talk'),
      'off-turn entry keeps its table-talk cue');
    browserAssert(await page.locator('.ability-passive').filter({ hasText: 'Weather Eye' }).count() === 1,
      'passive/free-text abilities remain non-button cards');
    browserAssert(await page.locator('.ability-button').count() === 2,
      'only invocable projections become ability buttons');
    browserAssert(await backstabButton.locator('.ability-family-label').textContent() === 'Opportunity',
      'ability buttons expose their family label');
    browserAssert((await backstabButton.innerText()).includes('Exploit an opening'),
      'ability buttons expose campaign help text');

    await input.fill('backstab');
    browserAssert(await page.locator('.ability-highlight').count() === 1,
      'an exact owned term highlights');
    await page.locator('.party-member[data-character-id="2"]').click();
    const switchedName = await page.locator('#char-name').textContent();
    const storedCharacter = await page.evaluate(() => localStorage.getItem('aetheria_my_character_7'));
    browserAssert(switchedName === 'Borin',
      `host character selection changes the displayed sheet (name=${switchedName}, stored=${storedCharacter})`);
    browserAssert(await page.locator('.ability-highlight').count() === 0,
      'the prior character term becomes ordinary prose after a host switch');
    browserAssert(await page.locator('.ability-button[data-ability-id="ability-guard"]').count() === 1,
      'the newly selected character supplies its own ability controls');
    await page.locator('.party-member[data-character-id="1"]').click();
    browserAssert(await page.locator('.ability-highlight').count() === 1,
      'switching back restores recognition from that character projection');

    await input.fill('I orc');
    await input.evaluate(node => {
      node.focus();
      node.setSelectionRange(2, 2);
      node.dispatchEvent(new Event('select', { bubbles: true }));
    });
    await backstabButton.click();
    browserAssert(await input.inputValue() === 'I backstab orc',
      'ability click inserts at the remembered caret with shared spacing');
    browserAssert(await input.evaluate(node => node.selectionStart) === 11,
      'caret lands after the inserted campaign term');

    await input.fill('I poke orc');
    await input.evaluate(node => {
      node.focus();
      node.setSelectionRange(2, 6);
      node.dispatchEvent(new Event('select', { bubbles: true }));
    });
    await page.locator('.ability-button[data-ability-id="ability-rally"]').click();
    browserAssert(await input.inputValue() === 'I rally orc',
      'ability click replaces the remembered selection');

    await input.fill('');
    await input.focus();
    await input.pressSequentially('backstab');
    await page.keyboard.press(`${modifier}+z`);
    const undoneValue = await input.inputValue();
    browserAssert('backstab'.startsWith(undoneValue) && undoneValue.length < 'backstab'.length,
      `mirror updates preserve native undo (value=${undoneValue})`);
    await page.keyboard.press(`${modifier}+Shift+z`);
    browserAssert(await input.inputValue() === 'backstab', 'mirror updates preserve native redo');

    await input.fill('I ');
    await input.focus();
    await page.evaluate(() => navigator.clipboard.writeText('rally'));
    await page.keyboard.press(`${modifier}+v`);
    browserAssert(await input.inputValue() === 'I rally', 'native paste remains available');
    browserAssert(await page.locator('.ability-highlight').count() === 1,
      'pasted owned terms run through the same scanner');

    const multiline = `${Array.from({ length: 18 }, (_, index) => `line ${index}`).join('\n')}\nbackstab`;
    await input.fill(multiline);
    const scroll = await input.evaluate(node => {
      node.scrollTop = node.scrollHeight;
      node.dispatchEvent(new Event('scroll'));
      return { top: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight };
    });
    browserAssert(scroll.scrollHeight > scroll.clientHeight && scroll.top > 0,
      'multiline textarea grows to its cap and then scrolls natively');
    browserAssert(
      (await page.locator('#action-highlight-content').getAttribute('style')).includes(`-${scroll.top}px`),
      'multiline mirror follows the textarea scroll offset'
    );

    await input.fill('I bakcstab now');
    browserAssert(await page.locator('.ability-highlight').count() === 0,
      'a one-edit typo never highlights or invokes');
    const correction = page.locator('#ability-correction');
    await correction.waitFor({ state: 'visible' });
    browserAssert((await correction.innerText()).includes('backstab'),
      'one unambiguous spelling correction is offered');
    await correction.click();
    browserAssert(await input.inputValue() === 'I backstab now',
      'accepting a correction edits only the suggested range');
    browserAssert(await page.locator('.ability-highlight').count() === 1,
      'accepted spelling becomes exact recognition');

    await input.fill('backstab then rally');
    browserAssert(await page.locator('.ability-highlight').count() === 2,
      'multiple non-overlapping owned terms highlight together');
    browserAssert((await page.locator('#ability-recognition-status').textContent()).includes('backstab'),
      'screen-reader status reports the changed recognized ability set');
    const markStyle = await page.locator('.ability-highlight').first().evaluate(node => ({
      width: getComputedStyle(node).borderBottomWidth,
      style: getComputedStyle(node).borderBottomStyle
    }));
    browserAssert(markStyle.width !== '0px' && markStyle.style !== 'none',
      'recognition includes a non-color underline cue');
    await input.focus();
    await page.keyboard.press('Tab');
    browserAssert(await page.evaluate(() => document.activeElement?.id) === 'btn-send-action',
      'focus order moves from the textarea to Send when correction is absent');

    await input.fill('composition in progress');
    const preCompositionPosts = turnPosts.length;
    await input.evaluate(node => {
      node.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '進' }));
      node.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', bubbles: true, cancelable: true, isComposing: true
      }));
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    browserAssert(turnPosts.length === preCompositionPosts,
      'Enter during active IME composition never submits');
    await input.evaluate(node => {
      node.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '進' }));
    });

    await input.fill('line one');
    const preShiftEnterPosts = turnPosts.length;
    await input.focus();
    await page.keyboard.press('Shift+Enter');
    browserAssert((await input.inputValue()).includes('\n'), 'Shift+Enter inserts a newline');
    browserAssert(turnPosts.length === preShiftEnterPosts, 'Shift+Enter does not submit');

    const exactProse = '  I BACKSTAB <mark>plain</mark>\nthen rally.  ';
    const exactPostCount = turnPosts.length;
    await input.fill(exactProse);
    await input.focus();
    await page.keyboard.press('Enter');
    await waitForCount(turnPosts, exactPostCount + 1, 'Enter submits the action');
    await page.waitForFunction(() => document.querySelector('#action-input').value === '');
    const exactRequest = turnPosts[exactPostCount].body;
    browserAssert(exactRequest.playerAction === exactProse,
      'turn request preserves leading/trailing whitespace, casing, markup-like text, and newline exactly');
    browserAssert(exactRequest.characterId === 1 && exactRequest.abilityTriggerRevision === REVISION_A,
      'turn request pairs the selected character with only its opaque revision');
    browserAssert(
      JSON.stringify(Object.keys(exactRequest).sort()) === JSON.stringify(['abilityTriggerRevision', 'characterId', 'playerAction']),
      'turn request contains no client-derived ability IDs, ranges, spellings, or family data'
    );
    const exactBubbles = (await page.locator('.log-player .content').allTextContents())
      .filter(text => text === exactProse);
    browserAssert(exactBubbles.length === 1,
      'optimistic success leaves one exact plain-prose player bubble');

    const bubblesBeforeOffTurn = await page.locator('.log-player').count();
    const offTurnText = '  OFFTURN backstab  ';
    await input.fill(offTurnText);
    await input.evaluate(node => {
      node.focus();
      node.setSelectionRange(4, 11);
      node.dispatchEvent(new Event('select', { bubbles: true }));
    });
    await page.keyboard.press('Enter');
    await page.locator('.log-system .content').filter({ hasText: 'Borin is acting.' }).waitFor();
    browserAssert(await input.inputValue() === offTurnText,
      'off-turn rejection retains exact prose');
    browserAssert(await input.evaluate(node => node.selectionStart === 4 && node.selectionEnd === 11),
      'off-turn rejection restores the exact selection');
    browserAssert(await page.locator('.log-player').count() === bubblesBeforeOffTurn,
      'off-turn rejection removes its optimistic bubble');

    const networkText = 'NETWORK rally';
    await input.fill(networkText);
    await input.evaluate(node => {
      node.focus();
      node.setSelectionRange(3, 8);
      node.dispatchEvent(new Event('select', { bubbles: true }));
    });
    const networkStart = turnPosts.length;
    await page.keyboard.press('Enter');
    await page.locator('.log-system .content').filter({ hasText: 'could not be sent' }).waitFor();
    browserAssert(await input.inputValue() === networkText,
      'network failure keeps the exact draft');
    browserAssert(await input.evaluate(node => node.selectionStart === 3 && node.selectionEnd === 8),
      'network failure restores the exact selection');
    await send.click();
    await waitForCount(turnPosts, networkStart + 2, 'explicit network retry sends a second request');
    await page.waitForFunction(() => document.querySelector('#action-input').value === '');
    const networkBubbles = (await page.locator('.log-player .content').allTextContents())
      .filter(text => text === networkText);
    browserAssert(networkBubbles.length === 1,
      'network retry resolves to one player bubble, not duplicate optimism');

    const staleText = 'STALE backstab';
    await input.fill(staleText);
    await input.evaluate(node => {
      node.focus();
      node.setSelectionRange(6, 10);
      node.dispatchEvent(new Event('select', { bubbles: true }));
    });
    const staleStart = turnPosts.length;
    await page.keyboard.press('Enter');
    await page.locator('.log-system .content').filter({ hasText: 'abilities changed' }).waitFor();
    browserAssert(await input.inputValue() === staleText,
      'stale refresh preserves exact prose');
    browserAssert(await input.evaluate(node => node.selectionStart === 6 && node.selectionEnd === 10),
      'stale refresh preserves the caret selection');
    browserAssert(await page.locator('.ability-highlight').count() === 0,
      'stale refresh rescans against the new sheet rather than old highlights');
    browserAssert((await page.locator('.ability-button[data-ability-id="ability-backstab"]').innerText()).includes('ambush'),
      'stale refresh replaces campaign ability wording atomically');
    await new Promise(resolve => setTimeout(resolve, 150));
    browserAssert(turnPosts.length === staleStart + 1,
      'stale refresh never resends automatically');
    await send.click();
    await waitForCount(turnPosts, staleStart + 2, 'stale action resends only after explicit Send');
    await page.waitForFunction(() => document.querySelector('#action-input').value === '');
    browserAssert(turnPosts[staleStart].body.abilityTriggerRevision === REVISION_A
      && turnPosts[staleStart + 1].body.abilityTriggerRevision === REVISION_C,
    'explicit stale retry echoes the refreshed opaque revision');

    const delayedCharacterText = 'DELAY_CHAR ambush';
    await input.fill(delayedCharacterText);
    const delayedCharacterStart = delayedTurnGates.length;
    await send.click();
    await waitForCount(delayedTurnGates, delayedCharacterStart + 1,
      'delayed character-switch response is held by the fixture');
    await page.locator('.party-member[data-character-id="2"]').click();
    browserAssert(await page.locator('#char-name').textContent() === 'Borin',
      'character may change while an old turn response is in flight');
    delayedTurnGates[delayedCharacterStart].release();
    await send.waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#btn-send-action').disabled);
    browserAssert(await page.locator('#char-name').textContent() === 'Borin',
      'old character response cannot repaint the selected sheet');
    browserAssert(!(await page.locator('.log-player .content').allTextContents()).includes(delayedCharacterText),
      'old character response removes unowned optimistic prose and leaves canonical polling to catch up');

    await page.locator('.party-member[data-character-id="1"]').click();
    await input.fill('ambush draft');
    await page.setViewportSize({ width: 500, height: 900 });
    const narrowLayout = await page.evaluate(() => {
      const composer = document.querySelector('#action-composer').getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
        composerLeft: composer.left,
        composerRight: composer.right
      };
    });
    browserAssert(narrowLayout.scrollWidth <= narrowLayout.viewport + 1,
      'narrow composer does not create horizontal page overflow');
    browserAssert(narrowLayout.composerLeft >= 0 && narrowLayout.composerRight <= narrowLayout.viewport,
      'narrow composer remains inside the viewport');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reducedDurations = await page.locator('.ability-button').first().evaluate(node =>
      getComputedStyle(node).transitionDuration
    );
    browserAssert(reducedDurations.split(',').every(value => parseFloat(value) <= 0.001),
      'reduced-motion preference collapses ability-control transitions');

    const delayedTableText = 'DELAY_TABLE ambush';
    await input.fill(delayedTableText);
    const delayedTableStart = delayedTurnGates.length;
    await send.click();
    await waitForCount(delayedTurnGates, delayedTableStart + 1,
      'delayed table-switch response is held by the fixture');
    await page.locator('#btn-show-campaigns').click();
    await page.locator('.campaign-card').nth(1).waitFor();
    await page.locator('.campaign-card').nth(1).click();
    await page.locator('.ability-button[data-ability-id="ability-ward"]').waitFor();
    delayedTurnGates[delayedTableStart].release();
    await page.waitForFunction(() => !document.querySelector('#btn-send-action').disabled);
    browserAssert(await page.locator('#char-name').textContent() === 'Wren',
      'old table response cannot repaint the replacement campaign');
    browserAssert(await input.inputValue() === '',
      'campaign transition clears the prior table draft');
    browserAssert(await page.locator('.ability-button[data-ability-id="ability-backstab"]').count() === 0,
      'campaign transition replaces the trigger projection instead of merging it');
    browserAssert(!(await page.locator('.log-player .content').allTextContents()).includes(delayedTableText),
      'old table optimistic bubble cannot leak into the replacement campaign');

    browserAssert(unknownApiRequests.length === 0,
      'composer flow makes no unexpected API requests: ' + unknownApiRequests.join(', '));
    browserAssert(pageErrors.length === 0,
      'composer flow raises no page errors: ' + pageErrors.join(', '));
    console.log('Ability composer browser guard passed.');
  } finally {
    for (const gate of delayedTurnGates) gate.release();
    await context.close();
  }

  await runSeatAbilityComposerGuard(browser, origin);
  console.log('Seat ability composer browser guard passed.');
}

// jt-1: a departed campaign's journal response must never paint over the
// live table — not the cards, not the search cache, and not the turn number
// a Fork click carries.
async function runJournalStaleGuard(browser, origin) {
  const hold = projectedAbility({
    id: 'ability-hold',
    definitionId: 'warden.hold',
    name: 'hold',
    familyKey: 'protection',
    familyLabel: 'Protection',
    help: 'Keep the crossing shut for a breath.'
  });
  const mark = projectedAbility({
    id: 'ability-mark',
    definitionId: 'scout.mark',
    name: 'mark',
    familyKey: 'opportunity',
    familyLabel: 'Opportunity',
    help: 'Name the target everyone should watch.'
  });
  const alphaHero = browserCharacter({
    id: 41,
    name: 'Alpha Warden',
    concept: 'Warden',
    revision: REVISION_A,
    invocableAbilities: [hold]
  });
  const betaHero = browserCharacter({
    id: 42,
    name: 'Beta Scout',
    concept: 'Scout',
    revision: REVISION_B,
    invocableAbilities: [mark]
  });

  const states = new Map([
    [21, campaignBrowserState({
      campaignId: 21,
      title: 'Alpha Hold',
      characters: [alphaHero],
      joinedCharacterId: 41,
      actingCharacterId: 41,
      turnNumber: 99
    })],
    [22, campaignBrowserState({
      campaignId: 22,
      title: 'Beta Live',
      characters: [betaHero],
      joinedCharacterId: 42,
      actingCharacterId: 42,
      turnNumber: 2
    })],
    [23, campaignBrowserState({
      campaignId: 23,
      title: 'Fork Result',
      characters: [betaHero],
      joinedCharacterId: 42,
      actingCharacterId: 42,
      turnNumber: 2
    })]
  ]);
  const campaignList = [
    { id: 21, title: 'Alpha Hold', genre: 'Browser fixture', summary: 'Departed table.', created_at: '2026-08-03T12:00:00Z', character_name: 'Alpha Warden', player_character_id: 141 },
    { id: 22, title: 'Beta Live', genre: 'Browser fixture', summary: 'Live table.', created_at: '2026-08-03T12:00:00Z', character_name: 'Beta Scout', player_character_id: 142 }
  ];
  const journals = new Map([
    [21, {
      turns: [{
        turn_number: 99,
        player_action: 'ALPHA-STALE deed',
        narrative: 'ALPHA-STALE narrative',
        state_changes_json: '{}',
        created_at: '2026-08-01T10:00:00Z'
      }],
      memories: []
    }],
    [22, {
      turns: [{
        turn_number: 2,
        player_action: 'BETA-LIVE deed',
        narrative: 'BETA-LIVE narrative',
        state_changes_json: '{}',
        created_at: '2026-08-01T11:00:00Z'
      }],
      memories: []
    }],
    [23, { turns: [], memories: [] }]
  ]);

  const journalGates = [];
  const forkPosts = [];
  const unknownApiRequests = [];

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const requestUrl = request.url();
    if (!requestUrl.startsWith(origin + '/')) return route.abort();
    const url = new URL(requestUrl);

    if (url.pathname === '/api/campaigns' && request.method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(campaignList) });
    }
    const stateMatch = url.pathname.match(/^\/api\/campaigns\/(21|22|23)$/u);
    if (stateMatch && request.method() === 'GET') {
      // The 12s poll may fire mid-guard; serving it keeps the unknown-request
      // assertion honest about the journal flow itself.
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(states.get(Number(stateMatch[1])))
      });
    }
    const journalMatch = url.pathname.match(/^\/api\/campaigns\/(21|22|23)\/journal$/u);
    if (journalMatch && request.method() === 'GET') {
      const campaignId = Number(journalMatch[1]);
      if (campaignId === 21) {
        // Hold the departed table's history in flight until the guard releases it.
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        journalGates.push({ release });
        await gate;
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(journals.get(campaignId)) });
    }
    const forkMatch = url.pathname.match(/^\/api\/campaigns\/(21|22)\/fork$/u);
    if (forkMatch && request.method() === 'POST') {
      forkPosts.push({ campaignId: Number(forkMatch[1]), body: request.postDataJSON() });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(states.get(23)) });
    }
    if (url.pathname.startsWith('/api/')) {
      unknownApiRequests.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"unexpected browser fixture route"}' });
    }
    return route.continue();
  });

  const timeline = page.locator('#journal-timeline-container');
  try {
    await page.goto(origin + '/');
    await page.locator('.campaign-card').first().waitFor();
    await page.locator('.campaign-card').first().click();
    await page.locator('#main-game-screen').waitFor({ state: 'visible' });

    await page.locator('#tab-journal-btn').click();
    await waitForCount(journalGates, 1, 'the departed campaign journal fetch is held by the fixture');

    await page.locator('#btn-show-campaigns').click();
    await page.locator('.campaign-card').nth(1).waitFor();
    await page.locator('.campaign-card').nth(1).click();
    await page.waitForFunction(() =>
      document.querySelector('#journal-timeline-container').textContent.includes('BETA-LIVE'));

    journalGates[0].release();
    await new Promise(resolve => setTimeout(resolve, 150));

    const liveText = await timeline.textContent();
    browserAssert(liveText.includes('BETA-LIVE') && !liveText.includes('ALPHA-STALE'),
      'a departed campaign journal response cannot paint over the live table');
    const badges = await timeline.locator('.timeline-node-badge').allTextContents();
    browserAssert(!badges.some(text => text.includes('Turn 99')),
      'no rendered card carries the departed campaign turn number');

    const search = page.locator('#journal-search-input');
    await search.fill('ALPHA-STALE');
    browserAssert(await timeline.locator('.timeline-node').count() === 0,
      'journal search cannot resurrect a departed campaign cache');
    await search.fill('');
    browserAssert((await timeline.textContent()).includes('BETA-LIVE'),
      'clearing the search restores the live table history');

    await timeline.locator('.timeline-fork-btn').first().click();
    const promptModal = page.locator('.modal').filter({ hasText: 'Branch timeline from Turn' });
    await promptModal.waitFor({ state: 'visible' });
    await promptModal.locator('.btn-primary').click();
    await waitForCount(forkPosts, 1, 'the fork click reaches the fixture');
    browserAssert(forkPosts[0].campaignId === 22 && forkPosts[0].body.turnNumber === 2,
      'Fork posts the live campaign at the live turn, never the departed table turn');

    browserAssert(pageErrors.length === 0,
      'journal stale flow raises no page errors: ' + pageErrors.join(', '));
    browserAssert(unknownApiRequests.length === 0,
      'journal stale flow makes no unexpected API requests: ' + unknownApiRequests.join(', '));
  } finally {
    for (const gate of journalGates) gate.release();
    await context.close();
  }
}

// dr-1: a campaign delete or character release that settles after the user
// has entered another table must not reload the menu. The reload nulls the
// campaign, stops the poll, strips the theme, and forces the menu overlay
// back over whatever table is now live.
async function runMenuSettleGuard(browser, origin) {
  const brace = projectedAbility({
    id: 'ability-brace',
    definitionId: 'warden.brace',
    name: 'brace',
    familyKey: 'protection',
    familyLabel: 'Protection',
    help: 'Set your feet against what comes.'
  });
  const scan = projectedAbility({
    id: 'ability-scan',
    definitionId: 'scout.scan',
    name: 'scan',
    familyKey: 'opportunity',
    familyLabel: 'Opportunity',
    help: 'Read the ground before anyone moves.'
  });
  const doomedHero = browserCharacter({
    id: 71,
    name: 'Doomed Warden',
    concept: 'Warden',
    revision: REVISION_A,
    invocableAbilities: [brace]
  });
  const enteredHero = browserCharacter({
    id: 81,
    name: 'Entered Scout',
    concept: 'Scout',
    revision: REVISION_B,
    invocableAbilities: [scan]
  });

  const states = new Map([
    [7, campaignBrowserState({
      campaignId: 7,
      title: 'Doomed Table',
      characters: [doomedHero],
      joinedCharacterId: 71,
      actingCharacterId: 71
    })],
    [8, campaignBrowserState({
      campaignId: 8,
      title: 'Entered Table',
      characters: [enteredHero],
      joinedCharacterId: 81,
      actingCharacterId: 81
    })]
  ]);
  // The entered table carries a generated theme (a `text` slot marks one),
  // so rendering it replaces the holodeck-idle body class. Without a real
  // theme the idle-class assertion below would hold in both directions and
  // prove nothing.
  states.get(8).themeColors = {
    primary: '18, 90%, 55%',
    secondary: '280, 70%, 60%',
    background: '24, 40%, 10%',
    text: '35, 60%, 92%',
    text_dim: '35, 30%, 70%'
  };

  const campaignList = [
    { id: 7, title: 'Doomed Table', genre: 'Browser fixture', summary: 'Deleted mid-flight.', created_at: '2026-08-03T12:00:00Z', character_name: 'Doomed Warden', player_character_id: 171 },
    { id: 8, title: 'Entered Table', genre: 'Browser fixture', summary: 'Entered during the wait.', created_at: '2026-08-03T12:00:00Z', character_name: 'Entered Scout', player_character_id: 181 }
  ];

  let campaignListGets = 0;
  const deleteGates = [];
  const releaseGates = [];
  const unknownApiRequests = [];

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const requestUrl = request.url();
    if (!requestUrl.startsWith(origin + '/')) return route.abort();
    const url = new URL(requestUrl);

    if (url.pathname === '/api/campaigns' && request.method() === 'GET') {
      campaignListGets += 1;
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(campaignList) });
    }
    if (url.pathname === '/api/campaigns/7' && request.method() === 'DELETE') {
      // Hold the delete in flight until the guard has entered the other table.
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      deleteGates.push({ release });
      await gate;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    if (url.pathname === '/api/campaigns/7/release-character' && request.method() === 'POST') {
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      releaseGates.push({ release });
      await gate;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    const stateMatch = url.pathname.match(/^\/api\/campaigns\/(7|8)$/u);
    if (stateMatch && request.method() === 'GET') {
      // The 12s poll may fire mid-guard; serving it keeps the unknown-request
      // assertion honest about the settle flow itself.
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(states.get(Number(stateMatch[1])))
      });
    }
    const journalMatch = url.pathname.match(/^\/api\/campaigns\/(7|8)\/journal$/u);
    if (journalMatch && request.method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ turns: [], memories: [] }) });
    }
    if (url.pathname.startsWith('/api/')) {
      unknownApiRequests.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"unexpected browser fixture route"}' });
    }
    return route.continue();
  });

  const menuScreen = page.locator('#campaign-menu-screen');
  const menuDisplay = () => menuScreen.evaluate(node => getComputedStyle(node).display);
  const bodyClasses = () => page.evaluate(() => document.body.className);
  // The toast fires in BOTH directions, so it settles the race without
  // asserting the outcome; every assertion below is an instantaneous read.
  const waitForToast = text => page.waitForFunction(
    expected => Array.from(document.body.children).some(node => node.innerText === expected),
    text
  );
  const enterSecondCampaign = async () => {
    await page.locator('.campaign-card').nth(1).click();
    await page.locator('#main-game-screen').waitFor({ state: 'visible' });
    // The generated theme replaces the idle class only once the state
    // response has actually rendered — this is the entered-table signal.
    await page.waitForFunction(() => !document.body.className.includes('holodeck-idle'));
    await page.locator('.ability-button[data-ability-id="ability-scan"]').waitFor();
    browserAssert(await page.locator('#char-name').textContent() === 'Entered Scout',
      'the entered table renders its own character sheet');
  };

  try {
    await page.goto(origin + '/');
    await page.locator('.campaign-card').first().waitFor();
    browserAssert(await page.locator('.campaign-card').count() === 2,
      'the settle fixture lists both campaigns');

    // Scenario A: delete campaign 7, enter campaign 8 while the DELETE is
    // still in flight, then let it settle.
    await page.locator('.campaign-card').first().locator('.delete-camp-btn').click();
    const deleteModal = page.locator('.modal').filter({ hasText: 'delete this campaign' });
    await deleteModal.waitFor({ state: 'visible' });
    await deleteModal.locator('.btn-danger').click();
    await waitForCount(deleteGates, 1, 'the campaign delete is held in flight by the fixture');

    await enterSecondCampaign();
    const getsBeforeDelete = campaignListGets;

    deleteGates[0].release();
    await waitForToast('Campaign deleted.');
    await new Promise(resolve => setTimeout(resolve, 150));

    browserAssert(await menuDisplay() === 'none',
      'a settled delete does not resurrect the menu over an entered table');
    browserAssert(campaignListGets === getsBeforeDelete,
      'a stale delete settle does not re-fetch the campaign list');
    browserAssert(!(await bodyClasses()).includes('holodeck-idle'),
      'a stale delete settle does not strip the entered table theme');

    // Scenario B: the same race against the character release POST.
    await page.locator('#btn-show-campaigns').click();
    await page.locator('.campaign-card').first().waitFor();
    await page.locator('.campaign-card').first().locator('.release-camp-btn').click();
    const releaseModal = page.locator('.modal').filter({ hasText: 'Release this campaign character profile' });
    await releaseModal.waitFor({ state: 'visible' });
    await releaseModal.locator('.btn-primary').click();
    await waitForCount(releaseGates, 1, 'the character release is held in flight by the fixture');

    await enterSecondCampaign();
    const getsBeforeRelease = campaignListGets;

    releaseGates[0].release();
    await waitForToast('Character profile released.');
    await new Promise(resolve => setTimeout(resolve, 150));

    browserAssert(await menuDisplay() === 'none',
      'a settled release does not resurrect the menu over an entered table');
    browserAssert(campaignListGets === getsBeforeRelease,
      'a stale release settle does not re-fetch the campaign list');
    browserAssert(!(await bodyClasses()).includes('holodeck-idle'),
      'a stale release settle does not strip the entered table theme');

    browserAssert(pageErrors.length === 0,
      'menu settle flow raises no page errors: ' + pageErrors.join(', '));
    browserAssert(unknownApiRequests.length === 0,
      'menu settle flow makes no unexpected API requests: ' + unknownApiRequests.join(', '));
  } finally {
    for (const gate of deleteGates) gate.release();
    for (const gate of releaseGates) gate.release();
    await context.close();
  }
}

// tts-1: narration is queued per turn and cancelled only by its queue token.
// A table transition must invalidate that token, or the departed table's GM
// keeps fetching and playing segments over the menu (where the skip pill is
// buried under the full-screen overlay) or over the next campaign. Two paths
// leak: the running queue itself, and the live-synthesis fallback that a
// failed saved-audio attempt starts with a FRESH token after the transition.
async function runNarrationTransitionGuard(browser, origin) {
  const chant = projectedAbility({
    id: 'ability-chant',
    definitionId: 'skald.chant',
    name: 'chant',
    familyKey: 'command',
    familyLabel: 'Command',
    help: 'Lift a verse the whole table can hear.'
  });
  const skald = browserCharacter({
    id: 91,
    name: 'Narrated Skald',
    concept: 'Skald',
    revision: REVISION_A,
    invocableAbilities: [chant]
  });
  let state = campaignBrowserState({
    campaignId: 7,
    title: 'Narrated Table',
    characters: [skald],
    joinedCharacterId: 91,
    actingCharacterId: 91
  });
  const campaignList = [
    { id: 7, title: 'Narrated Table', genre: 'Browser fixture', summary: 'Narration transition test.', created_at: '2026-08-03T12:00:00Z', character_name: 'Narrated Skald', player_character_id: 191 }
  ];

  const manifestGates = [];
  let segmentGets = 0;
  let capabilityGets = 0;
  let narratePosts = 0;
  const unknownApiRequests = [];

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Auto-play narration is the state under test: without both flags the app
  // never queues audio and every assertion below would hold vacuously.
  await context.addInitScript(() => {
    localStorage.setItem('aetheria_settings', JSON.stringify({
      accessToken: '',
      enableDiagnostics: false,
      voiceNarration: true,
      voiceAutoPlay: true
    }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const requestUrl = request.url();
    if (!requestUrl.startsWith(origin + '/')) return route.abort();
    const url = new URL(requestUrl);

    if (url.pathname === '/api/campaigns' && request.method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(campaignList) });
    }
    if (url.pathname === '/api/campaigns/7' && request.method() === 'GET') {
      // The 12s poll may fire mid-guard; serving it keeps the unknown-request
      // assertion honest about the narration flow itself.
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(state) });
    }
    if (url.pathname === '/api/campaigns/7/journal' && request.method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ turns: [], memories: [] }) });
    }
    if (url.pathname === '/api/campaigns/7/turn' && request.method() === 'POST') {
      state = resolvedBrowserTurn(state, request.postDataJSON());
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(state) });
    }
    // Saved-turn audio manifest: held in flight until the guard has left the
    // table, then resolved either way ('ok' = a real one-segment manifest,
    // 'fail' = the 500 that drives the live-synthesis fallback).
    // The campaign segment is deliberately open: a leaked queue keeps running
    // after the transition nulls currentCampaignId, so it requests
    // /api/campaigns/null/audio/... — pinning "7" would make the
    // segment-count assertion below pass vacuously in the broken direction.
    const manifestMatch = url.pathname.match(/^\/api\/campaigns\/[^/]+\/audio\/(\d+)$/u);
    if (manifestMatch && request.method() === 'GET') {
      const turnNumber = Number(manifestMatch[1]);
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      manifestGates.push({ turnNumber, release });
      const outcome = await gate;
      if (outcome === 'fail') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: '{"error":"Turn narration is unavailable."}'
        });
      }
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ turnNumber, segments: [{ id: 0, speaker: 'narrator', mime: 'audio/mpeg' }] })
      });
    }
    if (/^\/api\/campaigns\/[^/]+\/audio\/\d+\/segments\/\d+$/u.test(url.pathname) && request.method() === 'GET') {
      segmentGets += 1;
      return route.fulfill({ contentType: 'audio/mpeg', body: 'ID3' });
    }
    if (url.pathname === '/api/audio/capabilities' && request.method() === 'GET') {
      capabilityGets += 1;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ provider: 'openai', maxSegmentsPerRequest: 1 })
      });
    }
    if (url.pathname === '/api/audio/narrate' && request.method() === 'POST') {
      narratePosts += 1;
      return route.fulfill({ contentType: 'audio/mpeg', body: 'ID3' });
    }
    if (url.pathname.startsWith('/api/')) {
      unknownApiRequests.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"unexpected browser fixture route"}' });
    }
    return route.continue();
  });

  // The pill carries its own computed display, so this read is unaffected by
  // whichever screen is on top — it reports what stopNarration did, or did not.
  const pillDisplay = () => page.locator('#btn-skip-narration')
    .evaluate(node => getComputedStyle(node).display);
  const enterTable = async () => {
    await page.locator('.campaign-card').first().waitFor();
    await page.locator('.campaign-card').first().click();
    await page.locator('#main-game-screen').waitFor({ state: 'visible' });
    await page.locator('.ability-button[data-ability-id="ability-chant"]').waitFor();
  };
  const submitAction = async text => {
    await page.locator('#action-input').fill(text);
    await page.waitForFunction(() => !document.querySelector('#btn-send-action').disabled);
    await page.locator('#btn-send-action').click();
  };

  try {
    await page.goto(origin + '/');
    await enterTable();

    // Scenario A: the narration queue is live when the table changes.
    await submitAction('I chant across the crossing');
    await waitForCount(manifestGates, 1, 'the new turn queues saved narration the fixture holds in flight');
    browserAssert(await pillDisplay() !== 'none',
      'the skip pill is showing while the table narration is queued');

    await page.locator('#btn-show-campaigns').click();
    // Instantaneous read: the transition is synchronous, so no wait here may
    // be load-bearing — a passing assertion must mean the queue was retired.
    browserAssert(await pillDisplay() === 'none',
      'a table transition silences the departed GM and retires its skip pill');

    manifestGates[0].release('ok');
    await new Promise(resolve => setTimeout(resolve, 250));
    browserAssert(segmentGets === 0,
      'no segment of a departed table narration is fetched after the transition');

    // Scenario B: the saved-audio attempt FAILS after the user has left, and
    // the live-synthesis fallback must not restart the departed table's lines.
    await enterTable();
    await submitAction('I chant once more');
    await waitForCount(manifestGates, 2, 'the second turn queues its own held manifest fetch');

    await page.locator('#btn-show-campaigns').click();
    manifestGates[1].release('fail');
    await new Promise(resolve => setTimeout(resolve, 250));
    browserAssert(narratePosts === 0,
      'a failed saved-narration attempt does not fall back to live synthesis for a table the user left');
    browserAssert(await pillDisplay() === 'none',
      'a failed saved-narration attempt leaves no skip pill stranded over the menu');
    browserAssert(capabilityGets === 0,
      'a failed saved-narration attempt for a departed table never reaches the voice provider');

    browserAssert(pageErrors.length === 0,
      'narration transition flow raises no page errors: ' + pageErrors.join(', '));
    browserAssert(unknownApiRequests.length === 0,
      'narration transition flow makes no unexpected API requests: ' + unknownApiRequests.join(', '));
  } finally {
    for (const gate of manifestGates) gate.release('ok');
    await context.close();
  }
}

// fk-1: the fork flow captures no epoch. Its name prompt has no blocking
// overlay at all, and the loading overlay that follows blocks pointers but is
// not a focus trap, so Campaigns stays reachable by keyboard mid-fork. A fork
// that resolves after that must not seize the screen the user moved to:
// adoption renders the fork's narrative, re-adopts its campaign id, and
// restarts the poll behind the menu the user is looking at.
async function runForkEpochGuard(browser, origin) {
  const ward = projectedAbility({
    id: 'ability-ward',
    definitionId: 'warden.ward',
    name: 'ward',
    familyKey: 'protection',
    familyLabel: 'Protection',
    help: 'Hold the line while the branch resolves.'
  });
  const warden = browserCharacter({
    id: 61,
    name: 'Source Warden',
    concept: 'Warden',
    revision: REVISION_A,
    invocableAbilities: [ward]
  });
  const sourceState = campaignBrowserState({
    campaignId: 7,
    title: 'Source Table',
    characters: [warden],
    joinedCharacterId: 61,
    actingCharacterId: 61
  });
  const forkState = campaignBrowserState({
    campaignId: 9,
    title: 'Fork Result',
    characters: [warden],
    joinedCharacterId: 61,
    actingCharacterId: 61,
    turnNumber: 2
  });
  // The sentinel is exactly what an adopted fork paints into the narrative
  // log; its absence is the assertion, so it must appear nowhere else.
  forkState.turn.narrative = 'FORKED-NARRATIVE';

  const campaignList = [
    { id: 7, title: 'Source Table', genre: 'Browser fixture', summary: 'Forked mid-flight.', created_at: '2026-08-03T12:00:00Z', character_name: 'Source Warden', player_character_id: 161 }
  ];

  const forkGates = [];
  const unknownApiRequests = [];

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const requestUrl = request.url();
    if (!requestUrl.startsWith(origin + '/')) return route.abort();
    const url = new URL(requestUrl);

    if (url.pathname === '/api/campaigns' && request.method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(campaignList) });
    }
    if (url.pathname === '/api/campaigns/7/fork' && request.method() === 'POST') {
      // Hold the fork reconstruction in flight until the guard has left the table.
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      forkGates.push({ release });
      await gate;
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(forkState) });
    }
    const stateMatch = url.pathname.match(/^\/api\/campaigns\/(7|9)$/u);
    if (stateMatch && request.method() === 'GET') {
      // The 12s poll may fire mid-guard, and in the broken direction it fires
      // against the ADOPTED fork (9). Serving both keeps the unknown-request
      // assertion honest about the fork flow itself rather than turning a
      // leaked poll into a 404 that masks the real signal.
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(Number(stateMatch[1]) === 7 ? sourceState : forkState)
      });
    }
    if (/^\/api\/campaigns\/(7|9)\/journal$/u.test(url.pathname) && request.method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ turns: [], memories: [] }) });
    }
    if (url.pathname.startsWith('/api/')) {
      unknownApiRequests.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"unexpected browser fixture route"}' });
    }
    return route.continue();
  });

  const displayOf = id => page.locator('#' + id).evaluate(node => getComputedStyle(node).display);
  // showToast appends a bare inline-styled div to the body with no id and no
  // class, so the class-less, id-less body children ARE the toasts.
  const toastTexts = () => page.evaluate(() => Array.from(document.body.children)
    .filter(node => node.tagName === 'DIV' && !node.id && !node.className)
    .map(node => node.innerText));

  try {
    await page.goto(origin + '/');
    await page.locator('.campaign-card').first().waitFor();
    await page.locator('.campaign-card').first().click();
    await page.locator('#main-game-screen').waitFor({ state: 'visible' });
    await page.locator('.ability-button[data-ability-id="ability-ward"]').waitFor();

    // The journal timeline is only the fork's entry point; the flow itself is
    // exposed on window, so start it directly and leave its promise pending
    // on the fixture gate rather than awaiting it here.
    await page.evaluate(() => { window.forkCampaignTimeline(1); });
    const promptModal = page.locator('.modal').filter({ hasText: 'Branch timeline from Turn' });
    await promptModal.waitFor({ state: 'visible' });
    await promptModal.locator('.btn-primary').click();
    await waitForCount(forkGates, 1, 'the fork POST is held in flight by the fixture');
    browserAssert(await displayOf('loading-overlay') === 'flex',
      'the fork holds the loading overlay while the branch reconstructs');

    // A JS click, not a Playwright click: pointer actionability would wait the
    // overlay out and never race. This models the keyboard path the overlay
    // fails to trap.
    await page.evaluate(() => { document.getElementById('btn-show-campaigns').click(); });
    browserAssert(await displayOf('campaign-menu-screen') === 'flex',
      'the campaign menu is reachable through the fork loading overlay');

    forkGates[0].release();
    // Fixed wait, deliberately not a toast wait: the toast text differs
    // between the two directions, so a conditional wait would either hang or
    // auto-satisfy. Every assertion below is an instantaneous read.
    await new Promise(resolve => setTimeout(resolve, 300));

    const narrativeText = await page.locator('#narrative-container').textContent();
    browserAssert(!narrativeText.includes('FORKED-NARRATIVE'),
      'a fork resolving after the user left does not render the fork');
    const toasts = await toastTexts();
    browserAssert(!toasts.some(text => text.includes('Successfully branched')),
      'a stale fork does not announce adoption');
    browserAssert(toasts.some(text => text.includes('find it in your campaign list')),
      'a stale fork tells the player where the fork went');
    browserAssert(await displayOf('loading-overlay') === 'none',
      'the stale fork path still hides the loading overlay');
    browserAssert(await displayOf('campaign-menu-screen') === 'flex',
      'a stale fork does not seize the screen the user moved to');

    browserAssert(pageErrors.length === 0,
      'fork epoch flow raises no page errors: ' + pageErrors.join(', '));
    browserAssert(unknownApiRequests.length === 0,
      'fork epoch flow makes no unexpected API requests: ' + unknownApiRequests.join(', '));
  } finally {
    for (const gate of forkGates) gate.release();
    await context.close();
  }
}

// ds-1: two belts on the same turn submission. (1) Re-entrancy — a submit
// dispatched while one is already in flight must never reach the server:
// the second request would clear turnSubmitInFlight on the FIRST settle
// (re-enabling the controls while the Council still resolves turn two) and
// reopen every poll gate that relies on the flag. Disabled controls are not
// the guard: the composer submits programmatically from the choice buttons
// and the Enter keybinding, so a keyboard or scripted path still fires the
// form. (2) Monotonicity — the server numbers every committed turn strictly
// upward, so an OK /turn response at or below the rendered head is a
// duplicate; rendering it doubles the GM narrative in the log and replays
// dice theater and narration. The poll has that `<=` rule; the submit's own
// render must have it too.
async function runSubmitRaceGuard(browser, origin) {
  const hold = projectedAbility({
    id: 'ability-hold',
    definitionId: 'warden.hold',
    name: 'hold',
    familyKey: 'protection',
    familyLabel: 'Protection',
    help: 'Keep the crossing shut while the Council resolves.'
  });
  const warden = browserCharacter({
    id: 51,
    name: 'Race Warden',
    concept: 'Warden',
    revision: REVISION_A,
    invocableAbilities: [hold]
  });
  // One character, joined == acting: every submit is in turn and resolves,
  // so the assertions below are about the race and nothing else.
  let state = campaignBrowserState({
    campaignId: 7,
    title: 'Race Table',
    characters: [warden],
    joinedCharacterId: 51,
    actingCharacterId: 51
  });
  const campaignList = [
    { id: 7, title: 'Race Table', genre: 'Browser fixture', summary: 'Overlapping submits.', created_at: '2026-08-03T12:00:00Z', character_name: 'Race Warden', player_character_id: 151 }
  ];

  const turnPosts = [];
  const turnGates = [];
  const unknownApiRequests = [];

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const requestUrl = request.url();
    if (!requestUrl.startsWith(origin + '/')) return route.abort();
    const url = new URL(requestUrl);

    if (url.pathname === '/api/campaigns' && request.method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(campaignList) });
    }
    if (url.pathname === '/api/campaigns/7' && request.method() === 'GET') {
      // The 12s poll may fire mid-guard; serving it keeps the unknown-request
      // assertion honest about the submit flow itself.
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(state) });
    }
    if (url.pathname === '/api/campaigns/7/journal' && request.method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ turns: [], memories: [] }) });
    }
    if (url.pathname === '/api/campaigns/7/turn' && request.method() === 'POST') {
      const body = request.postDataJSON();
      turnPosts.push(body);
      // REPLAY marker: an OK response that re-serves the CURRENT committed
      // turn — same number, same narrative. This is what a server or proxy
      // replay looks like to the client, and what a regression of the
      // re-entrancy guard would hand a second in-flight submit.
      if (String(body.playerAction).includes('REPLAY')) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(jsonClone(state)) });
      }
      // HOLD marker: the turn stays in flight until the guard releases it, so
      // the second submit is dispatched into a genuinely open window. The
      // state advances only after the gate, keeping turn numbers in release
      // order however many requests are outstanding.
      if (String(body.playerAction).includes('HOLD')) {
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        turnGates.push({ release });
        await gate;
      }
      state = resolvedBrowserTurn(state, body);
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(state) });
    }
    if (url.pathname.startsWith('/api/')) {
      unknownApiRequests.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"unexpected browser fixture route"}' });
    }
    return route.continue();
  });

  const sendEnabled = () => page.waitForFunction(() => !document.querySelector('#btn-send-action').disabled);
  const submitAction = async text => {
    await page.locator('#action-input').fill(text);
    await sendEnabled();
    await page.locator('#btn-send-action').click();
  };
  const playerBubblesContaining = text => page.evaluate(needle =>
    Array.from(document.querySelectorAll('#narrative-container .log-player'))
      .filter(node => node.textContent.includes(needle)).length, text);
  const gmEntriesForTurn = turnNumber => page.evaluate(n =>
    Array.from(document.querySelectorAll('#narrative-container .log-gm'))
      .filter(node => Number(node.dataset.turn) === n).length, turnNumber);

  try {
    await page.goto(origin + '/');
    await page.locator('.campaign-card').first().waitFor();
    await page.locator('.campaign-card').first().click();
    await page.locator('#main-game-screen').waitFor({ state: 'visible' });
    await page.locator('.ability-button[data-ability-id="ability-hold"]').waitFor();

    // Scenario A: a submit dispatched while another is in flight.
    await submitAction('I steady the line');
    await page.waitForFunction(() => document.querySelector('#action-input').value === '');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#narrative-container .log-gm'))
      .some(node => node.textContent.includes('Resolved: I steady the line')));

    const heldAction = 'I HOLD the crossing';
    await submitAction(heldAction);
    await waitForCount(turnGates, 1, 'the second submit is held in flight by the fixture');
    const postsBeforeRace = turnPosts.length;

    // A programmatic requestSubmit, not a pointer click: this is the vector
    // that survives disabled controls (choice buttons and the Enter
    // keybinding both call it), and a Playwright click on a disabled button
    // would wait the flight out instead of racing it — vacuously passing.
    await page.evaluate(() => { document.getElementById('action-form').requestSubmit(); });
    // Fixed wait, deliberately not a conditional one: the assertion is that
    // NOTHING happens, so there is no event to wait for in the fixed
    // direction and any conditional wait would auto-satisfy.
    await new Promise(resolve => setTimeout(resolve, 150));
    browserAssert(turnPosts.length === postsBeforeRace,
      'a submit dispatched while one is in flight never reaches the server');

    turnGates[0].release();
    await sendEnabled();
    browserAssert(await playerBubblesContaining(heldAction) === 1,
      'a held submit leaves exactly one player bubble for its action');

    // Scenario B: an OK response that re-serves the already-rendered turn.
    const headTurn = state.turn.number;
    const postsBeforeReplay = turnPosts.length;
    await submitAction('I REPLAY the same breath');
    await waitForCount(turnPosts, postsBeforeReplay + 1, 'the replay submit reaches the fixture');
    await sendEnabled();

    // Instantaneous reads: the submit handler's render is synchronous, so a
    // settled send button means the whole path has already run.
    browserAssert(await gmEntriesForTurn(headTurn) === 1,
      'an OK submit response at or below the rendered head renders nothing');
    browserAssert(await page.locator('#action-input').inputValue() === '',
      'an accepted action still clears the composer when its response renders nothing');
    browserAssert(await playerBubblesContaining('REPLAY') === 0,
      'a duplicate-turn response settles the optimistic bubble away instead of stranding it');

    browserAssert(pageErrors.length === 0,
      'submit race flow raises no page errors: ' + pageErrors.join(', '));
    browserAssert(unknownApiRequests.length === 0,
      'submit race flow makes no unexpected API requests: ' + unknownApiRequests.join(', '));
  } finally {
    for (const gate of turnGates) gate.release();
    await context.close();
  }
}

// pa-1: the narrative log is a SHARED transcript. Every entry used to be
// labelled "You", so in multiplayer each browser claimed its partymates' deeds
// as its own — the flagship mode's core surface lying about who acted. The
// author now travels with the turn (turns.character_id, already written) down
// BOTH paths a partymate's turn can arrive on: the 12s poll and the journal
// gap-backfill. This guard drives both, in both directions, plus the
// no-recorded-author rows that must keep rendering exactly as they always did.
async function runAuthorAttributionGuard(browser, origin) {
  const hold = projectedAbility({
    id: 'ability-hold',
    definitionId: 'warden.hold',
    name: 'hold',
    familyKey: 'protection',
    familyLabel: 'Protection',
    help: 'Keep the crossing shut for a breath.'
  });
  const mark = projectedAbility({
    id: 'ability-mark',
    definitionId: 'scout.mark',
    name: 'mark',
    familyKey: 'opportunity',
    familyLabel: 'Opportunity',
    help: 'Name the target everyone should watch.'
  });
  const me = browserCharacter({
    id: 61,
    name: 'Author Warden',
    concept: 'Warden',
    revision: REVISION_C,
    invocableAbilities: [hold]
  });
  const partymate = browserCharacter({
    id: 62,
    name: 'Beta Scout',
    concept: 'Scout',
    revision: REVISION_D,
    invocableAbilities: [mark]
  });

  // This browser plays 61; 62 is another player at the same table.
  let state = campaignBrowserState({
    campaignId: 8,
    title: 'Shared Transcript',
    characters: [me, partymate],
    joinedCharacterId: 61,
    actingCharacterId: 61,
    turnNumber: 1
  });
  const campaignList = [
    { id: 8, title: 'Shared Transcript', genre: 'Browser fixture', summary: 'Two players, one log.', created_at: '2026-08-03T12:00:00Z', character_name: 'Author Warden', player_character_id: 161 }
  ];
  const journalTurn = (turnNumber, characterId, action) => ({
    turn_number: turnNumber,
    character_id: characterId,
    player_action: action,
    narrative: `Narrative for turn ${turnNumber}.`,
    state_changes_json: '{}',
    created_at: `2026-08-01T1${turnNumber}:00:00Z`
  });
  // Turns 2-4 are the gap this browser never saw: its own action, a
  // partymate's, and a pre-attribution row with no recorded author.
  let journal = {
    turns: [
      journalTurn(2, 61, 'OWN-BACKFILL deed'),
      journalTurn(3, 62, 'PARTYMATE-BACKFILL deed'),
      journalTurn(4, null, 'LEGACY-BACKFILL deed')
    ],
    memories: []
  };

  const turnPosts = [];
  const unknownApiRequests = [];

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const requestUrl = request.url();
    if (!requestUrl.startsWith(origin + '/')) return route.abort();
    const url = new URL(requestUrl);

    if (url.pathname === '/api/campaigns' && request.method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(campaignList) });
    }
    if (url.pathname === '/api/campaigns/8' && request.method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(state) });
    }
    if (url.pathname === '/api/campaigns/8/journal' && request.method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(journal) });
    }
    if (url.pathname === '/api/campaigns/8/turn' && request.method() === 'POST') {
      const body = request.postDataJSON();
      turnPosts.push(body);
      // The submit lands at turn 5, three turns above the rendered head: the
      // submit path's own gap backfill pulls 2-4 out of the journal first.
      state = jsonClone(state);
      state.turn = {
        ...state.turn,
        number: 5,
        characterId: 61,
        playerAction: body.playerAction,
        narrative: `Resolved: ${body.playerAction}`,
        suggestedChoices: []
      };
      journal = {
        turns: [...journal.turns, journalTurn(5, 61, body.playerAction)],
        memories: []
      };
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(state) });
    }
    if (url.pathname.startsWith('/api/')) {
      unknownApiRequests.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"unexpected browser fixture route"}' });
    }
    return route.continue();
  });

  // The speaker line of the bubble whose body carries `needle`.
  const speakerFor = needle => page.evaluate(text => {
    const node = Array.from(document.querySelectorAll('#narrative-container .log-player'))
      .find(entry => (entry.querySelector('.content')?.textContent || '').includes(text));
    return node ? node.querySelector('.speaker').textContent.trim() : null;
  }, needle);
  const timelineEntryFor = needle => page.evaluate(text => {
    const node = Array.from(document.querySelectorAll('#journal-timeline-container .timeline-node-action'))
      .find(entry => entry.textContent.includes(text));
    return node ? node.textContent.trim() : null;
  }, needle);

  try {
    await page.goto(origin + '/');
    await page.locator('.campaign-card').first().waitFor();
    await page.locator('.campaign-card').first().click();
    await page.locator('#main-game-screen').waitFor({ state: 'visible' });
    await page.locator('.ability-button[data-ability-id="ability-hold"]').waitFor();

    // --- Path 1: the journal gap-backfill, reached through a submit. ---
    await page.locator('#action-input').fill('I OWN-SUBMIT the crossing');
    await page.waitForFunction(() => !document.querySelector('#btn-send-action').disabled);
    await page.locator('#btn-send-action').click();
    await waitForCount(turnPosts, 1, 'the submit reaches the fixture');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#narrative-container .log-player'))
      .some(entry => entry.textContent.includes('LEGACY-BACKFILL')));

    browserAssert(await speakerFor('PARTYMATE-BACKFILL') === 'Beta Scout',
      'a backfilled partymate action is attributed to the partymate, not to this browser');
    browserAssert(await speakerFor('OWN-BACKFILL') === 'You',
      "a backfilled action of this browser's own character still reads You");
    browserAssert(await speakerFor('LEGACY-BACKFILL') === 'You',
      'a turn with no recorded author renders exactly as it did before attribution');
    browserAssert(await speakerFor('OWN-SUBMIT') === 'You',
      "this browser's own submitted action reads You");

    // --- Path 2: the 12s poll picking up a partymate's live turn. ---
    state = jsonClone(state);
    state.turn = {
      ...state.turn,
      number: 6,
      characterId: 62,
      playerAction: 'I PARTYMATE-LIVE the ford',
      narrative: 'The scout slips across the ford.',
      suggestedChoices: []
    };
    state.turnOrder.actingCharacterId = 62;
    journal = {
      turns: [...journal.turns, journalTurn(6, 62, 'I PARTYMATE-LIVE the ford')],
      memories: []
    };
    // The poll interval is 12s: this wait is the interval, not a race.
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#narrative-container .log-player'))
      .some(entry => entry.textContent.includes('PARTYMATE-LIVE')), null, { timeout: 25_000 });
    browserAssert(await speakerFor('PARTYMATE-LIVE') === 'Beta Scout',
      'a polled partymate action is attributed to the partymate, not to this browser');

    // Nothing this browser did not do may be labelled as its own.
    const misattributed = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#narrative-container .log-player'))
        .filter(entry => entry.querySelector('.speaker').textContent.trim() === 'You')
        .map(entry => entry.querySelector('.content').textContent.trim()));
    browserAssert(!misattributed.some(text => text.includes('PARTYMATE')),
      'no partymate action is labelled You: ' + misattributed.join(' | '));

    // --- The Journal tab reads from the same author. ---
    await page.locator('#tab-journal-btn').click();
    await page.waitForFunction(() =>
      document.querySelector('#journal-timeline-container').textContent.includes('PARTYMATE-LIVE'));
    browserAssert((await timelineEntryFor('PARTYMATE-BACKFILL')).startsWith('Beta Scout:'),
      'the Journal timeline names the partymate who acted');
    browserAssert((await timelineEntryFor('OWN-BACKFILL')).startsWith('You:'),
      "the Journal timeline reads You for this browser's own turn");
    browserAssert((await timelineEntryFor('LEGACY-BACKFILL')).startsWith('Player:'),
      'a Journal row with no recorded author keeps its generic label');

    browserAssert(pageErrors.length === 0,
      'author attribution flow raises no page errors: ' + pageErrors.join(', '));
    browserAssert(unknownApiRequests.length === 0,
      'author attribution flow makes no unexpected API requests: ' + unknownApiRequests.join(', '));
  } finally {
    await context.close();
  }
}

// jd-1: Join hands the client the CURRENT HEAD state, not a new turn. The
// party changed; the fiction did not. Re-appending that head beat corrupts the
// shared transcript with a repeated GM narrative, a repeated dice card and a
// repeated Current Situation block that only a full campaign reload clears.
// This guard pins both directions: the head beat stays at exactly one copy of
// each, AND the join genuinely happened (notice posted, party strip grew) so
// the counts cannot be satisfied by a Join that silently does nothing.
async function runJoinDuplicateGuard(browser, origin) {
  const brace = projectedAbility({
    id: 'ability-brace',
    definitionId: 'warden.brace',
    name: 'brace',
    familyKey: 'protection',
    familyLabel: 'Protection',
    help: 'Set your shoulder against the gate.'
  });
  const sight = projectedAbility({
    id: 'ability-sight',
    definitionId: 'scout.sight',
    name: 'sight',
    familyKey: 'opportunity',
    familyLabel: 'Opportunity',
    help: 'Read the ground ahead.'
  });
  const me = browserCharacter({
    id: 71,
    name: 'Gate Warden',
    concept: 'Warden',
    revision: REVISION_A,
    invocableAbilities: [brace]
  });
  const newcomer = browserCharacter({
    id: 72,
    name: 'Newcomer Scout',
    concept: 'Deck scout',
    revision: REVISION_B,
    invocableAbilities: [sight]
  });

  // A head turn carrying all three appendable surfaces at once: narrative,
  // a d20 card, and scene grounding. Each needle is unique to this turn, so a
  // count of 2 can only mean the same beat was appended twice.
  let state = campaignBrowserState({
    campaignId: 9,
    title: 'The Held Gate',
    characters: [me],
    joinedCharacterId: 71,
    actingCharacterId: 71,
    turnNumber: 3
  });
  state.turn = {
    ...state.turn,
    characterId: 71,
    playerAction: 'I set my shoulder to the gate',
    narrative: 'HEAD-NARRATIVE the gate holds against the tide.',
    sceneGrounding: 'HEAD-GROUNDING the gate stands; the water climbs the steps.',
    rollResults: [{
      attribute: 'willpower',
      roll: 17,
      modifier: 2,
      total: 19,
      dc: 12,
      success: true,
      reason: 'HEAD-ROLL brace the gate'
    }]
  };
  const campaignList = [
    { id: 9, title: 'The Held Gate', genre: 'Browser fixture', summary: 'One warden, one gate.', created_at: '2026-08-03T12:00:00Z', character_name: 'Gate Warden', player_character_id: 171 }
  ];
  const journal = { turns: [], memories: [] };

  const joinPosts = [];
  const unknownApiRequests = [];

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const requestUrl = request.url();
    if (!requestUrl.startsWith(origin + '/')) return route.abort();
    const url = new URL(requestUrl);

    if (url.pathname === '/api/campaigns' && request.method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(campaignList) });
    }
    if (url.pathname === '/api/campaigns/9' && request.method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(state) });
    }
    if (url.pathname === '/api/campaigns/9/journal' && request.method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(journal) });
    }
    if (url.pathname === '/api/campaigns/9/join' && request.method() === 'POST') {
      joinPosts.push(request.postDataJSON());
      // What the server really returns (rpg-engine joinCampaign): the current
      // campaign state, head turn untouched, plus the new character.
      state = jsonClone(state);
      state.party = [...state.party, jsonClone(newcomer)];
      state.turnOrder.order = state.party.map(member => ({ id: member.id, name: member.name }));
      state.joinedCharacterId = 72;
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(state) });
    }
    if (url.pathname.startsWith('/api/')) {
      unknownApiRequests.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"unexpected browser fixture route"}' });
    }
    return route.continue();
  });

  // How many log entries of one kind carry this turn's needle.
  const countEntries = (selector, needle) => page.evaluate(({ sel, text }) =>
    Array.from(document.querySelectorAll('#narrative-container ' + sel))
      .filter(entry => entry.textContent.includes(text)).length,
    { sel: selector, text: needle });
  // Both join prompts use the same dialog shell; waiting on the message text
  // keeps the second answer from racing the first dialog's teardown.
  const answerPrompt = async (messageNeedle, value) => {
    const dialog = page.locator('.modal', { has: page.locator('h2', { hasText: 'Input Needed' }) });
    await dialog.locator('p', { hasText: messageNeedle }).waitFor();
    await dialog.locator('input[type="text"]').fill(value);
    await dialog.locator('button.btn-primary').click();
  };

  try {
    await page.goto(origin + '/');
    await page.locator('.campaign-card').first().waitFor();
    await page.locator('.campaign-card').first().click();
    await page.locator('#main-game-screen').waitFor({ state: 'visible' });
    await page.locator('.ability-button[data-ability-id="ability-brace"]').waitFor();
    await page.waitForFunction(() =>
      document.querySelector('#narrative-container').textContent.includes('HEAD-NARRATIVE'));

    // The fixture must actually put ONE of each in the log first, or "still 1"
    // after the join would prove nothing.
    browserAssert(await countEntries('.log-gm', 'HEAD-NARRATIVE') === 1,
      'the campaign load puts the head narrative in the log exactly once');
    browserAssert(await countEntries('.log-roll', 'HEAD-ROLL') === 1,
      'the campaign load puts the head dice card in the log exactly once');
    browserAssert(await countEntries('.log-scene', 'HEAD-GROUNDING') === 1,
      'the campaign load puts the head scene grounding in the log exactly once');

    // --- Join the table. ---
    await page.locator('#party-join-btn').click();
    await answerPrompt('Character name', 'Newcomer Scout');
    await answerPrompt('Character concept', 'Deck scout');
    await waitForCount(joinPosts, 1, 'the join reaches the fixture');
    // appendSystemNotice runs immediately after renderGame returns, so the
    // notice landing means every append the join could make has happened.
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#narrative-container .log-system'))
      .some(entry => entry.textContent.includes('joins the table')));

    // --- The join really happened. ---
    browserAssert(joinPosts[0].characterName === 'Newcomer Scout'
      && joinPosts[0].characterClass === 'Deck scout',
      'the join posts the name and concept the player typed: ' + JSON.stringify(joinPosts[0]));
    const noticeText = await page.evaluate(() => {
      const node = Array.from(document.querySelectorAll('#narrative-container .log-system'))
        .find(entry => entry.textContent.includes('joins the table'));
      return node ? node.textContent.trim() : null;
    });
    browserAssert(noticeText !== null && noticeText.includes('Newcomer Scout joins the table'),
      'the join notice names the new character: ' + noticeText);
    const partyNames = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#party-strip .party-member[data-character-id]'))
        .map(chip => chip.textContent.trim()));
    browserAssert(partyNames.some(name => name.includes('Newcomer Scout')),
      'the party strip gains the new character: ' + partyNames.join(' | '));
    browserAssert(partyNames.some(name => name.includes('Gate Warden')),
      'the party strip keeps the character who was already at the table: ' + partyNames.join(' | '));

    // --- ...and it appended the head beat exactly zero more times. ---
    const gmCount = await countEntries('.log-gm', 'HEAD-NARRATIVE');
    browserAssert(gmCount === 1,
      'joining does not duplicate the head GM narrative (found ' + gmCount + ' copies)');
    const rollCount = await countEntries('.log-roll', 'HEAD-ROLL');
    browserAssert(rollCount === 1,
      'joining does not duplicate the head dice card (found ' + rollCount + ' copies)');
    const sceneCount = await countEntries('.log-scene', 'HEAD-GROUNDING');
    browserAssert(sceneCount === 1,
      'joining does not duplicate the head scene grounding (found ' + sceneCount + ' copies)');
    const totalGm = await page.evaluate(() =>
      document.querySelectorAll('#narrative-container .log-gm').length);
    browserAssert(totalGm === 1,
      'the log holds exactly one GM entry after the join (found ' + totalGm + ')');

    browserAssert(pageErrors.length === 0,
      'join flow raises no page errors: ' + pageErrors.join(', '));
    browserAssert(unknownApiRequests.length === 0,
      'join flow makes no unexpected API requests: ' + unknownApiRequests.join(', '));
  } finally {
    await context.close();
  }
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
  const settingsResponseReads = [];
  const settingsPosts = [];
  let openAiCatalogCalls = 0;
  const childEnv = { ...process.env, PORT: String(port), RPG_DB_PATH: dbPath, NODE_ENV: 'test' };
  childEnv.ACCESS_SECRET = '';
  childEnv.ADMIN_SECRET = '';

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
    page.on('response', response => {
      const request = response.request();
      if (request.url() === origin + '/api/admin/settings') settingsResponseReads.push(response.text());
    });
    page.on('request', request => {
      if (request.url() === origin + '/api/admin/settings' && request.method() === 'POST') {
        settingsPosts.push(request.postDataJSON());
      }
    });
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url === probeUrl) {
        return route.fulfill({ contentType: 'text/html', body: PROBE_HTML });
      }
      if (url === origin + '/api/admin/models/catalog') {
        const body = route.request().postDataJSON();
        if (body.provider === 'openai') {
          openAiCatalogCalls += 1;
          if (openAiCatalogCalls === 1) {
            return route.fulfill({
              contentType: 'application/json',
              body: JSON.stringify({ models: ['gpt-live-a', 'gpt-live-b'], manualEntry: true })
            });
          }
          return route.fulfill({
            status: 502,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'OpenAI catalog offline; manual entry remains available.' })
          });
        }
        if (body.provider === 'claude-code') {
          return route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              models: [],
              manualEntry: true,
              status: {
                installed: true,
                loggedIn: true,
                authMethod: 'claude.ai',
                subscriptionType: 'max',
                version: '2.1.210'
              }
            })
          });
        }
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ models: [], manualEntry: true }) });
      }
      if (url.startsWith(origin + '/')) return route.continue();
      external.push(url);
      return route.abort();
    });

    await page.goto(probeUrl);
    const result = await runOracle(page);
    assessResult(result, external);
    await runAdminRegistryGuard(page, origin, settingsResponseReads, settingsPosts);
    await runAbilityComposerGuard(browser, origin);
    await runJournalStaleGuard(browser, origin);
    console.log('Journal stale-response browser guard passed.');
    await runMenuSettleGuard(browser, origin);
    console.log('Menu settle browser guard passed.');
    await runNarrationTransitionGuard(browser, origin);
    console.log('Narration transition browser guard passed.');
    await runForkEpochGuard(browser, origin);
    console.log('Fork epoch browser guard passed.');
    await runSubmitRaceGuard(browser, origin);
    console.log('Submit race browser guard passed.');
    await runAuthorAttributionGuard(browser, origin);
    console.log('Author attribution browser guard passed.');
    await runJoinDuplicateGuard(browser, origin);
    console.log('Join duplicate browser guard passed.');
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
