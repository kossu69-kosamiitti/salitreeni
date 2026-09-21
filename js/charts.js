// Kevyet SVG-kaaviot ilman kirjastoja
const NS = 'http://www.w3.org/2000/svg';

function s(tag, attrs, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}

const W = 340;
const H = 170;
const PAD = { l: 8, r: 8, t: 18, b: 22 };

export function barChart(items, { color = 'var(--accent)', fmt = (v) => v } = {}) {
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
  const max = Math.max(1, ...items.map((i) => i.value));
  const n = items.length;
  const bw = (W - PAD.l - PAD.r) / n;
  items.forEach((it, i) => {
    const bh = ((H - PAD.t - PAD.b) * it.value) / max;
    const x = PAD.l + i * bw + bw * 0.15;
    const y = H - PAD.b - bh;
    svg.append(
      s('rect', { x, y, width: bw * 0.7, height: Math.max(bh, it.value > 0 ? 2 : 0), rx: 3, fill: color, opacity: it.current ? 1 : 0.75 }),
      s('text', { x: x + bw * 0.35, y: y - 4, 'text-anchor': 'middle', class: 'ct' }, it.value > 0 ? fmt(it.value) : ''),
      s('text', { x: x + bw * 0.35, y: H - 6, 'text-anchor': 'middle', class: 'ct muted' }, it.label)
    );
  });
  return svg;
}

export function lineChart(points, { color = 'var(--accent2)', fmtY = (v) => v, fmtX = (v) => v } = {}) {
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
  if (points.length === 0) return svg;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const padY = (maxY - minY) * 0.1;
  minY -= padY;
  maxY += padY;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const px = (x) => (maxX === minX ? W / 2 : 28 + ((x - minX) / (maxX - minX)) * (W - 28 - 14));
  const py = (y) => PAD.t + (1 - (y - minY) / (maxY - minY)) * (H - PAD.t - PAD.b);
  svg.append(
    s('line', { x1: 24, x2: W - 8, y1: py(minY + padY), y2: py(minY + padY), stroke: 'var(--line)' }),
    s('line', { x1: 24, x2: W - 8, y1: py(maxY - padY), y2: py(maxY - padY), stroke: 'var(--line)' }),
    s('text', { x: 2, y: py(maxY - padY) + 4, class: 'ct muted' }, fmtY(maxY - padY)),
    s('text', { x: 2, y: py(minY + padY) + 4, class: 'ct muted' }, fmtY(minY + padY))
  );
  if (points.length > 1) {
    svg.append(s('polyline', { points: points.map((p) => `${px(p.x)},${py(p.y)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
  }
  points.forEach((p) => svg.append(s('circle', { cx: px(p.x), cy: py(p.y), r: 3.5, fill: color })));
  svg.append(
    s('text', { x: px(minX), y: H - 6, 'text-anchor': 'start', class: 'ct muted' }, fmtX(minX)),
    s('text', { x: px(maxX), y: H - 6, 'text-anchor': 'end', class: 'ct muted' }, maxX !== minX ? fmtX(maxX) : '')
  );
  return svg;
}
