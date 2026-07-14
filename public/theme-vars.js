const DEFAULT_PRIMARY = '210, 100%, 50%';
const DEFAULT_SECONDARY = '330, 100%, 50%';
const DEFAULT_BACKGROUND = '220, 30%, 8%';

export function toThemeColor(components) {
  return `hsl(${components.trim()})`;
}

export function derivePanelBorder(background) {
  const bgParts = background.match(/\d+/g);
  if (!bgParts || bgParts.length < 3) return {};

  const panelLightness = Math.min(95, parseInt(bgParts[2]) + 4);
  return {
    '--theme-panel': toThemeColor(`${bgParts[0]}, ${bgParts[1]}%, ${panelLightness}%`),
    '--theme-border': toThemeColor(`${bgParts[0]}, ${bgParts[1]}%, ${panelLightness + 8}%`)
  };
}

export function fullThemeVars(colors) {
  const primary = typeof colors?.primary === 'string' ? colors.primary.trim() : DEFAULT_PRIMARY;
  const secondary = typeof colors?.secondary === 'string' ? colors.secondary.trim() : DEFAULT_SECONDARY;
  const background = typeof colors?.background === 'string' ? colors.background.trim() : DEFAULT_BACKGROUND;
  const vars = {
    '--theme-primary': toThemeColor(primary),
    '--theme-secondary': toThemeColor(secondary),
    '--theme-bg': toThemeColor(background),
    '--theme-text': toThemeColor(colors.text)
  };
  if (typeof colors.text_dim === 'string') {
    vars['--theme-text-dim'] = toThemeColor(colors.text_dim);
  }
  return { ...vars, ...derivePanelBorder(background) };
}

export function baseThemeVars(primary, secondary, background) {
  const resolvedPrimary = typeof primary === 'string' ? primary.trim() : DEFAULT_PRIMARY;
  const resolvedSecondary = typeof secondary === 'string' ? secondary.trim() : DEFAULT_SECONDARY;
  const resolvedBackground = typeof background === 'string' ? background.trim() : DEFAULT_BACKGROUND;
  return {
    '--theme-primary': toThemeColor(resolvedPrimary),
    '--theme-secondary': toThemeColor(resolvedSecondary),
    '--theme-bg': toThemeColor(resolvedBackground),
    ...derivePanelBorder(resolvedBackground)
  };
}
