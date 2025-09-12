import type { LineName } from './index';

export const viewBox = { width: 800, height: 600 };

// Canonical SVG path data per line, extracted from the provided design.
export const linePaths: Record<LineName, { id: string; d: string; kind: 'stroke' | 'fill' }> = {
  azul: {
    id: 'line_blue',
    kind: 'stroke',
    d: 'M49.303 136.5L157.575 136.5C159.695 136.5 161.729 137.342 163.229 138.841L575.897 551.141C577.397 552.64 579.431 553.482 581.551 553.482L693.301 553.48'
  },
  vermelha: {
    id: 'line_red',
    kind: 'stroke',
    d: 'M385 361H582Q598 360 608 350l139-138Q755 204 755 195V130Q755 115 738 115H632'
  },
  amarela: {
    id: 'line_yellow',
    kind: 'stroke',
    d: 'M462 18V465.344C462 467.346 461.25 469.275 459.897 470.75L450.5 481'
  },
  verde: {
    id: 'line_green',
    kind: 'stroke',
    d: 'M419 178H538C551.255 178 562 188.745 562 202V542C562 550.837 554.837 558 546 558H490'
  }
};

