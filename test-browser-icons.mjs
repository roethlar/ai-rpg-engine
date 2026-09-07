import assert from 'node:assert/strict';

export async function verifyLocalIcon(page, selector) {
  const icon = page.locator(selector).first();
  await icon.waitFor({ state: 'visible' });
  const result = await icon.evaluate(async node => {
    const style = getComputedStyle(node, '::before');
    const family = style.fontFamily;
    const content = style.content.slice(1, -1);
    await document.fonts.load(`${style.fontWeight} 28px ${family}`);
    const loaded = [...document.fonts].some(face =>
      family.includes(face.family.replaceAll('"', '')) && face.status === 'loaded');
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.font = `${style.fontWeight} 28px ${family}`;
    context.textBaseline = 'top';
    context.fillText(content, 8, 8);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    let ink = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) ink += 1;
    return { family, loaded, content, ink };
  });
  assert.match(result.family, /Font Awesome 6/);
  assert.equal(result.loaded, true, 'The actual icon font has loaded');
  assert.ok(result.content && !['none', 'normal'].includes(result.content));
  assert.ok(result.ink > 30, `The glyph paints nonblank pixels (${result.ink})`);
  return result;
}
