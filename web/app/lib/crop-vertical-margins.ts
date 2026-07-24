/** RGB distance from background above which a pixel counts as content. */
const COLOR_TOLERANCE = 28;

/** Fraction of row width that must differ from background to count as content. */
const MIN_CONTENT_RATIO = 0.004;

/** Keep a little padding so staff lines / headers are not clipped. */
const SAFETY_RATIO = 0.015;

type Rgb = { r: number; g: number; b: number };

function sampleBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Rgb {
  const samples: Rgb[] = [];
  const block = Math.max(2, Math.min(12, Math.floor(Math.min(width, height) / 40)));
  const corners: Array<[number, number]> = [
    [0, 0],
    [width - block, 0],
    [0, height - block],
    [width - block, height - block],
  ];

  for (const [sx, sy] of corners) {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = sy; y < sy + block; y++) {
      for (let x = sx; x < sx + block; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3]! < 16) continue;
        r += data[i]!;
        g += data[i + 1]!;
        b += data[i + 2]!;
        n++;
      }
    }
    if (n > 0) {
      samples.push({ r: r / n, g: g / n, b: b / n });
    }
  }

  if (samples.length === 0) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: samples.reduce((s, c) => s + c.r, 0) / samples.length,
    g: samples.reduce((s, c) => s + c.g, 0) / samples.length,
    b: samples.reduce((s, c) => s + c.b, 0) / samples.length,
  };
}

function isContentPixel(
  data: Uint8ClampedArray,
  index: number,
  bg: Rgb,
): boolean {
  const a = data[index + 3]!;
  if (a < 16) return false;
  const dr = data[index]! - bg.r;
  const dg = data[index + 1]! - bg.g;
  const db = data[index + 2]! - bg.b;
  return dr * dr + dg * dg + db * db > COLOR_TOLERANCE * COLOR_TOLERANCE;
}

function rowHasContent(
  data: Uint8ClampedArray,
  width: number,
  y: number,
  bg: Rgb,
): boolean {
  const minHits = Math.max(2, Math.floor(width * MIN_CONTENT_RATIO));
  // Ignore far left/right (often page edges / artifacts)
  const x0 = Math.floor(width * 0.04);
  const x1 = Math.ceil(width * 0.96);
  let hits = 0;
  const row = y * width * 4;
  for (let x = x0; x < x1; x++) {
    if (isContentPixel(data, row + x * 4, bg)) {
      hits++;
      if (hits >= minHits) return true;
    }
  }
  return false;
}

function detectVerticalContentBounds(imageData: ImageData): {
  top: number;
  bottom: number;
} {
  const { data, width, height } = imageData;
  if (width === 0 || height === 0) {
    return { top: 0, bottom: 0 };
  }

  const bg = sampleBackground(data, width, height);
  let top = 0;
  let bottom = height - 1;

  while (top < height && !rowHasContent(data, width, top, bg)) top++;
  while (bottom > top && !rowHasContent(data, width, bottom, bg)) bottom--;

  if (top >= height) {
    return { top: 0, bottom: height - 1 };
  }

  const pad = Math.max(4, Math.round(height * SAFETY_RATIO));
  return {
    top: Math.max(0, top - pad),
    bottom: Math.min(height - 1, bottom + pad),
  };
}

/** Crop empty top/bottom margins from a rendered PDF page canvas. */
export function cropVerticalMargins(source: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = source.getContext("2d");
  if (!ctx || source.width === 0 || source.height === 0) return source;

  const imageData = ctx.getImageData(0, 0, source.width, source.height);
  const { top, bottom } = detectVerticalContentBounds(imageData);
  const croppedHeight = bottom - top + 1;

  // Skip tiny crops — not worth the extra canvas
  if (croppedHeight >= source.height * 0.97) return source;
  if (croppedHeight <= 0) return source;

  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = croppedHeight;
  const outCtx = out.getContext("2d");
  if (!outCtx) return source;
  outCtx.drawImage(
    source,
    0,
    top,
    source.width,
    croppedHeight,
    0,
    0,
    source.width,
    croppedHeight,
  );
  return out;
}
