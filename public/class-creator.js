function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function validateCatalog(value) {
  if (!value || typeof value !== 'object' || !value.catalogVersion
    || value.optionSet !== 'expert' || !Array.isArray(value.families)) {
    throw new Error('The class catalog is unavailable.');
  }
  const familyIds = new Set();
  for (const family of value.families) {
    if (!family || typeof family.id !== 'string' || !family.id || familyIds.has(family.id)
      || typeof family.name !== 'string' || !family.name || !Array.isArray(family.branches)) {
      throw new Error('The class catalog could not be read.');
    }
    familyIds.add(family.id);
    const branchIds = new Set();
    for (const branch of family.branches) {
      const abilities = branch?.starterAbilities ?? branch?.abilities;
      if (!branch || typeof branch.id !== 'string' || !branch.id || branchIds.has(branch.id)
        || typeof branch.name !== 'string' || !branch.name || !Array.isArray(abilities) || !abilities.length
        || abilities.some(ability => !ability || typeof ability.name !== 'string'
          || typeof ability.description !== 'string')) {
        throw new Error('The class catalog could not be read.');
      }
      branchIds.add(branch.id);
    }
  }
  return value;
}

export function createClassCreator(root, { fetchCatalog, onChange = () => {} }) {
  let catalog = null;
  let requestSerial = 0;
  let currentGenre = '';
  let enabled = true;
  let pendingSelection = null;

  const status = element('div', 'class-catalog-status');
  status.setAttribute('role', 'status');
  const retry = element('button', 'btn btn-secondary class-catalog-retry', 'Retry');
  retry.type = 'button';
  retry.hidden = true;
  const fields = element('div', 'class-choice-fields');
  const familyGroup = element('div', 'form-group');
  const familyLabel = element('label', '', 'Archetype');
  const familySelect = element('select');
  familySelect.id = 'class-family';
  familyLabel.htmlFor = familySelect.id;
  familyGroup.append(familyLabel, familySelect);
  const branchGroup = element('div', 'form-group');
  const branchLabel = element('label', '', 'Class');
  const branchSelect = element('select');
  branchSelect.id = 'class-branch';
  branchLabel.htmlFor = branchSelect.id;
  branchGroup.append(branchLabel, branchSelect);
  fields.append(familyGroup, branchGroup);
  const familyDescription = element('p', 'class-family-description');
  const unavailable = element('ul', 'class-unavailable');
  const preview = element('section', 'class-preview');
  preview.setAttribute('aria-live', 'polite');
  root.replaceChildren(status, retry, fields, familyDescription, preview, unavailable);

  function family() {
    return catalog?.families.find(item => item.id === familySelect.value && item.available !== false);
  }

  function branch() {
    return family()?.branches.find(item => item.id === branchSelect.value);
  }

  function getSelection() {
    const selectedFamily = family();
    const selectedBranch = branch();
    if (!enabled || !catalog || !selectedFamily || !selectedBranch) return null;
    return {
      catalogVersion: catalog.catalogVersion,
      optionSet: catalog.optionSet,
      familyId: selectedFamily.id,
      branchId: selectedBranch.id,
      modules: selectedFamily.id === 'rider' ? ['rider'] : []
    };
  }

  function option(value, label, disabled = false) {
    const node = element('option', '', label);
    node.value = value;
    node.disabled = disabled;
    return node;
  }

  function renderPreview() {
    preview.replaceChildren();
    const selected = branch();
    familyDescription.textContent = family()?.description ?? family()?.summary ?? '';
    if (!selected) {
      preview.hidden = true;
      onChange(getSelection());
      return;
    }
    preview.hidden = false;
    const heading = element('div', 'class-preview-heading');
    heading.append(element('h3', '', selected.classLabel || selected.name));
    const complexity = selected.complexity || family()?.complexity;
    if (['low', 'moderate', 'high'].includes(complexity)) {
      heading.append(element('span', 'class-complexity', `${complexity[0].toUpperCase()}${complexity.slice(1)} complexity`));
    }
    preview.append(heading, element('p', 'class-description', selected.description || selected.summary || ''));
    preview.append(element('h4', '', 'Starting abilities'));
    const list = element('ul', 'class-starting-abilities');
    for (const ability of selected.starterAbilities ?? selected.abilities) {
      const item = element('li');
      const top = element('div', 'class-grant-heading');
      top.append(element('strong', '', ability.name));
      const details = [ability.activation === 'passive' ? 'Passive' : ability.activation === 'ritual' ? 'Ritual' : 'Action'];
      if (typeof ability.costLabel === 'string' && ability.costLabel) details.push(ability.costLabel);
      top.append(element('span', 'class-grant-cost', details.join(' / ')));
      item.append(top, element('p', '', ability.description));
      list.append(item);
    }
    preview.append(list);
    const later = Array.isArray(selected.progression)
      ? selected.progression.filter(step => step.level > 1 && Array.isArray(step.grants) && step.grants.length)
      : [];
    if (later.length) {
      const progression = element('details', 'class-progression');
      progression.append(element('summary', '', 'Progression'));
      const levels = element('ul');
      for (const step of later) {
        levels.append(element('li', '', `Level ${step.level}: ${step.grants.map(grant => grant.name).join(', ')}`));
      }
      progression.append(levels);
      preview.append(progression);
    }
    onChange(getSelection());
  }

  function renderBranches(preferred = '') {
    const selected = family();
    branchSelect.replaceChildren(option('', 'Choose a class'));
    for (const item of selected?.branches || []) {
      branchSelect.append(option(item.id, item.classLabel || item.name));
    }
    branchSelect.disabled = !enabled || !selected;
    branchGroup.hidden = selected?.branches.length === 1;
    if (selected?.branches.some(item => item.id === preferred)) branchSelect.value = preferred;
    else if (selected?.branches.length === 1) branchSelect.value = selected.branches[0].id;
    renderPreview();
  }

  function invalidate() {
    requestSerial += 1;
    catalog = null;
    familySelect.disabled = true;
    branchSelect.disabled = true;
    preview.hidden = true;
    familyDescription.textContent = '';
    unavailable.replaceChildren();
    status.textContent = 'Loading classes...';
    root.setAttribute('aria-busy', 'true');
    retry.hidden = true;
    onChange(null);
  }

  async function load(genre = '', selection = getSelection()) {
    currentGenre = genre.trim();
    pendingSelection = selection;
    invalidate();
    const serial = requestSerial;
    try {
      const response = validateCatalog(await fetchCatalog(currentGenre));
      if (serial !== requestSerial) return;
      catalog = response;
      familySelect.replaceChildren(option('', 'Choose an archetype'));
      for (const item of catalog.families) {
        familySelect.append(option(item.id, item.name, item.available === false || item.branches.length === 0));
        if (item.available === false) {
          unavailable.append(element('li', '', `${item.name}: ${item.unavailableReason || 'Unavailable in this campaign.'}`));
        }
      }
      const available = catalog.families.filter(item => item.available !== false && item.branches.length);
      familySelect.disabled = !enabled || available.length === 0;
      if (available.some(item => item.id === pendingSelection?.familyId)) familySelect.value = pendingSelection.familyId;
      status.textContent = available.length ? 'Expert catalog / Development' : 'No classes are available for this campaign.';
      retry.hidden = available.length > 0;
      renderBranches(pendingSelection?.branchId);
    } catch (error) {
      if (serial !== requestSerial) return;
      catalog = null;
      status.textContent = error instanceof Error ? error.message : 'The class catalog is unavailable.';
      retry.hidden = false;
      onChange(null);
    } finally {
      if (serial === requestSerial) root.setAttribute('aria-busy', 'false');
    }
  }

  familySelect.addEventListener('change', () => renderBranches());
  branchSelect.addEventListener('change', renderPreview);
  retry.addEventListener('click', () => load(currentGenre, pendingSelection));
  invalidate();

  return {
    load,
    invalidate,
    getSelection,
    setEnabled(value) {
      enabled = value;
      root.hidden = !value;
      familySelect.disabled = !value || !catalog?.families.some(item => item.available !== false && item.branches.length);
      branchSelect.disabled = !value || !family();
      onChange(getSelection());
    },
    focus() { (!family() ? familySelect : branchSelect).focus(); }
  };
}
