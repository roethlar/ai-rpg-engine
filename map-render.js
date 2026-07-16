/**
 * Deterministic tactical-map render (Phase V2): a location's stored layout +
 * occupancy becomes a top-down SVG with no AI in the render path — the same
 * state always draws the same map. Colors ride the app's theme variables
 * (inline SVG inherits CSS custom properties) with dark-theme fallbacks.
 *
 * Vocabulary (from docs/mockups/heroic-layouts.html): areas as labelled
 * rounded rects, exits as dashed connectors, fixed features as small diamonds,
 * occupants as colored tokens with initials — player highlighted.
 */
import { LOCATION_CANVAS } from './rpg-state.js';

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function initialsFor(name) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const AREA_LABEL = {
  fontSize: 2.8,
  padding: 1.5,
  // Average glyph advance as a fraction of font-size. Deliberately generous:
  // overestimating glyph width keeps fewer characters, so a wide-glyph name
  // ("WWW") still fits rather than spilling. There is no text measurement
  // available here — the render is a pure string builder with no DOM.
  glyphRatio: 0.62
};

/**
 * Fits an area label to its box. SVG <text> neither wraps nor clips, so a name
 * longer than its rect runs straight out of it and over the neighbouring area.
 * Returns '' when the box cannot hold even one glyph (caller draws no label).
 */
function fitAreaLabel(name, boxWidth) {
  const available = boxWidth - AREA_LABEL.padding * 2;
  const maxChars = Math.floor(available / (AREA_LABEL.fontSize * AREA_LABEL.glyphRatio));
  if (maxChars < 1) return '';
  const text = String(name).trim();
  // Measure and cut in code points, not UTF-16 units — String#slice on a
  // unit boundary would emit a lone surrogate (renders as U+FFFD) for names
  // containing emoji or other astral glyphs.
  const glyphs = Array.from(text);
  if (glyphs.length <= maxChars) return text;
  if (maxChars === 1) return '…';
  return glyphs.slice(0, maxChars - 1).join('').trimEnd() + '…';
}

/** Stable, collision-free clip-path id — the render must stay deterministic. */
function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

const TOKEN_FILL = {
  player: 'var(--theme-primary, hsl(210 100% 55%))',
  npc: 'var(--theme-secondary, hsl(290 100% 60%))',
  creature: 'hsl(0, 70%, 50%)',
  object: 'hsl(0, 0%, 55%)'
};

/**
 * Renders a validated layout + occupancy to an SVG string. Returns null when
 * there is no layout to draw.
 */
export function renderLocationMap(layout, occupancy = []) {
  if (!layout || !Array.isArray(layout.areas) || layout.areas.length === 0) return null;
  const { width, height } = LOCATION_CANVAS;
  const parts = [];

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height + 6}" class="location-map" role="img" aria-label="Map of ${escapeXml(layout.name)}">`);
  parts.push(`<rect width="${width}" height="${height + 6}" rx="2" fill="var(--theme-bg, hsl(220 25% 8%))" />`);

  const centers = new Map();
  for (const area of layout.areas) {
    centers.set(area.id, { cx: area.x + area.w / 2, cy: area.y + area.h / 2 });
  }

  // Exits first so connectors sit under the area boxes.
  for (const exit of layout.exits || []) {
    const from = centers.get(exit.from);
    if (!from) continue;
    let to = centers.get(exit.to);
    if (!to && String(exit.to).startsWith('out:')) {
      // Out-of-location exits point toward the nearest canvas edge.
      to = { cx: from.cx < width / 2 ? 2 : width - 2, cy: from.cy };
    }
    if (!to) continue;
    parts.push(`<line x1="${from.cx}" y1="${from.cy}" x2="${to.cx}" y2="${to.cy}" stroke="var(--theme-text-dim, hsl(210 10% 65%))" stroke-width="0.6" stroke-dasharray="2,1.5" opacity="0.7" />`);
  }

  const clipPrefix = `am-${slugify(layout.name)}`;
  layout.areas.forEach((area, areaIndex) => {
    parts.push(`<rect x="${area.x}" y="${area.y}" width="${area.w}" height="${area.h}" rx="1.5" fill="var(--theme-panel, hsl(220 25% 12%))" stroke="var(--theme-border, hsl(220 20% 20%))" stroke-width="0.5" />`);
    const label = fitAreaLabel(area.name, area.w);
    if (!label) return;
    // Ellipsis fits the common case; the clip is the backstop, so a glyph-width
    // underestimate still cannot bleed a label into the next area.
    // Index-qualified: slugify is lossy ('east wing' and 'east-wing' collide),
    // and duplicate ids would make every later <text> clip to the first rect.
    const clipId = `${clipPrefix}-a${areaIndex}-${slugify(area.id)}`;
    parts.push(`<clipPath id="${clipId}"><rect x="${area.x}" y="${area.y}" width="${area.w}" height="${area.h}" rx="1.5" /></clipPath>`);
    parts.push(`<text clip-path="url(#${clipId})" x="${area.x + AREA_LABEL.padding}" y="${area.y + 3.4}" font-size="${AREA_LABEL.fontSize}" fill="var(--theme-text-dim, hsl(210 10% 65%))" font-family="inherit">${escapeXml(label)}</text>`);
  });

  // Fixed features: small diamonds along the top of their area.
  const featureCounts = new Map();
  for (const feature of layout.features || []) {
    const area = layout.areas.find(a => a.id === feature.area);
    if (!area) continue;
    const index = featureCounts.get(feature.area) || 0;
    featureCounts.set(feature.area, index + 1);
    const fx = area.x + 3 + index * 5;
    const fy = area.y + area.h - 3;
    if (fx > area.x + area.w - 2) continue;
    parts.push(`<g transform="translate(${fx}, ${fy})"><rect x="-1.2" y="-1.2" width="2.4" height="2.4" transform="rotate(45)" fill="var(--theme-secondary, hsl(290 100% 60%))" opacity="0.55"><title>${escapeXml(feature.name)}</title></rect></g>`);
  }

  // Occupancy tokens: rows of circles inside their area, player highlighted.
  const tokenCounts = new Map();
  for (const occupant of occupancy || []) {
    const area = layout.areas.find(a => a.id === occupant.area) || layout.areas[0];
    const index = tokenCounts.get(area.id) || 0;
    tokenCounts.set(area.id, index + 1);
    const perRow = Math.max(1, Math.floor((area.w - 4) / 5));
    const tx = area.x + 4 + (index % perRow) * 5;
    const ty = area.y + 7 + Math.floor(index / perRow) * 5;
    const fill = TOKEN_FILL[occupant.kind] || TOKEN_FILL.object;
    const ring = occupant.kind === 'player' ? ` stroke="var(--theme-text, hsl(210 20% 95%))" stroke-width="0.5"` : '';
    parts.push(`<g><circle cx="${tx}" cy="${ty}" r="2.1" fill="${fill}"${ring}><title>${escapeXml(occupant.name)}${occupant.note ? ` — ${escapeXml(occupant.note)}` : ''}</title></circle>` +
      `<text x="${tx}" y="${ty + 0.9}" font-size="1.9" text-anchor="middle" fill="hsl(220, 25%, 10%)" font-weight="bold" font-family="inherit">${escapeXml(initialsFor(occupant.name))}</text></g>`);
  }

  parts.push(`<text x="${width / 2}" y="${height + 4.2}" font-size="2.4" text-anchor="middle" fill="var(--theme-text-dim, hsl(210 10% 65%))" font-family="inherit" letter-spacing="0.4">${escapeXml(layout.name)}</text>`);
  parts.push('</svg>');
  return parts.join('');
}
