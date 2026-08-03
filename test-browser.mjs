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
