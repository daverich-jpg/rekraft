// Photography for the field.
// The 11 "archive" plates are the exact images and frames from the Figma
// landing (node 1315:187); everything else is a seeded fill of Unsplash
// editorial work so the field can extend infinitely around them.

export type Photo = {
  plate: string // "07"
  src: string // card-resolution texture
  srcHi: string // swapped in when the plate is focused
  source: 'ReKraft archive' | 'Unsplash'
}

export type Card = {
  id: number
  photo: Photo
  /** frame size in world units (1 unit = 100 Figma px) */
  w: number
  h: number
  /** layout position on the rest plane, in world units, y up */
  lx: number
  ly: number
  /** depth layer; rest frame is compensated so the Figma layout reads 1:1 */
  z: number
  /** explicit image-UV window [u0, v0 (from top), uSize, vSize]; else cover-crop */
  crop?: [number, number, number, number]
}

/** The field repeats on this period (world units). Must exceed the widest view. */
export const PERIOD = { x: 52, y: 22 } as const

/** Figma frame the rest frame reproduces (MacBook Air, 1280×832). */
export const FRAME = { w: 1280, h: 832 } as const

// (`?.` lets the layout run outside Vite, e.g. in the overlap check)
const local = (n: number): string => `${import.meta.env?.BASE_URL ?? "/"}photos/img${n}.jpg`

const unsplash = (id: string, w: number) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&fm=jpg&fit=max`

const UNSPLASH_IDS = [
  '1500648767791-00dcc994a43e', '1494790108377-be9c29b29330', '1534528741775-53994a69daeb',
  '1506794778202-cad84cf45f1d', '1517841905240-472988babdf9', '1544005313-94ddf0286df2',
  '1531746020798-e6953c6e8e04', '1529626455594-4ff0802cfb7e', '1488426862026-3ee34a7d66df',
  '1524504388940-b1c1722653e1', '1515886657613-9f3515b0c78f', '1509631179647-0177331693ae',
  '1469334031218-e382a71b716b', '1483985988355-763728e1935b', '1490481651871-ab68de25d43d',
  '1496747611176-843222e1e57c', '1485968579580-b6d095142e6e', '1502823403499-6ccfcf4fb453',
  '1500917293891-ef795e70e1f6', '1504703395950-b89145a5425b', '1513379733131-47fc74b45fc7',
  '1519699047748-de8e457a634e', '1492288991661-058aa541ff43', '1520975954732-35dd22299614',
  '1475180098004-ca77a66827be', '1503104834685-7205e8607eb9', '1508214751196-bcfd4ca60f91',
  '1487412720507-e7ab37603c6f', '1539109136881-3be0616acf4b', '1523264939339-c89f9dadde2e',
]

const pad = (n: number) => String(n).padStart(2, '0')

const ARCHIVE: Photo[] = Array.from({ length: 11 }, (_, i) => ({
  plate: pad(i + 1),
  src: local(40 + i),
  srcHi: local(40 + i),
  source: 'ReKraft archive',
}))

const FILL: Photo[] = UNSPLASH_IDS.map((id, i) => ({
  plate: pad(ARCHIVE.length + i + 1),
  src: unsplash(id, 720),
  srcHi: unsplash(id, 2000),
  source: 'Unsplash',
}))

export const PHOTOS: Photo[] = [...ARCHIVE, ...FILL]

// --- Figma frames ----------------------------------------------------------
// [left, top, width, height, archive index, depth, crop?]
// crop = the photo's own box inside the frame (Figma px, frame-relative), so
// each plate keeps exactly the framing chosen in the design. Depths are
// art-directed: near and far mixed so parallax reads as volume.
type Box = [number, number, number, number]
const FIGMA: [number, number, number, number, number, number, Box?][] = [
  [482, 37, 191.274, 201, 0, -1.6, [-40.52, -84.67, 308.09, 547.41]],
  [906, 261, 167.132, 215, 1, 0.7, [-76.5, -157, 300, 375]],
  [165, 295, 165, 194.857, 2, -0.5, [-48.71, -13.36, 215.6, 269.5]],
  [288, 590, 173.047, 189.178, 3, 1.0, [-90.4, -2.2, 343.4, 228.96]],
  [142, 0, 254, 173.389, 4, -2.2, [-127.76, -231.6, 509.73, 637.2]],
  [658, 614, 312, 212.982, 6, 0.3, [-133.3, -350.57, 679.2, 849.03]],
  [745, -69, 348, 237.557, 5, -1.1, [-175, -148, 698.37, 569.69]],
  [1145, 519, 348, 237.557, 7, 0.8, [-175.05, -230, 698.37, 698.37]],
  [-213, 238, 334, 228, 8, -0.7],
  [1145, 196, 226, 165, 9, -1.8],
  [-206, 572, 348, 212, 10, 0.4, [-175.05, -330.3, 698.37, 872.97]],
]

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildField(): Card[] {
  const cards: Card[] = FIGMA.map(([left, top, w, h, idx, z, box], id) => ({
    id,
    photo: ARCHIVE[idx],
    w: w / 100,
    h: h / 100,
    lx: (left + w / 2 - FRAME.w / 2) / 100,
    ly: -(top + h / 2 - FRAME.h / 2) / 100,
    z,
    crop: box && [-box[0] / box[2], -box[1] / box[3], w / box[2], h / box[3]],
  }))

  // Keep-out box around the Figma composition so the fill never collides with it.
  const keep = { x0: -8.85, x1: 8.85, y0: -4.45, y1: 5.15 }

  const rand = mulberry32(1315187)
  const cols = 12
  const rows = 7
  const cw = PERIOD.x / cols
  const ch = PERIOD.y / rows
  const aspects = [0.75, 0.8, 1, 1.25, 1.46, 0.67, 1.33]
  let pick = 0

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const aspect = aspects[Math.floor(rand() * aspects.length)]
      let h = Math.min(1.55 + rand() * 0.95, ch - 0.45)
      let w = Math.min(h * aspect, cw - 0.55)
      const jx = rand() * 2 - 1
      const jy = rand() * 2 - 1
      const z = -2.2 + rand() * 3.2

      // Usable part of this cell: the whole cell, or — where it straddles the
      // Figma keep-out box — only the strip outside it, so the cluster gets
      // neighbours instead of a moat of white.
      let x0 = -PERIOD.x / 2 + cw * i + 0.2
      let x1 = x0 + cw - 0.4
      let y0 = -PERIOD.y / 2 + ch * j + 0.15
      let y1 = y0 + ch - 0.3
      const inKeep = x1 > keep.x0 && x0 < keep.x1 && y1 > keep.y0 && y0 < keep.y1
      if (inKeep) {
        const gap = 0.3
        const strips = [
          { x0, x1: Math.min(x1, keep.x0 - gap), y0, y1 },
          { x0: Math.max(x0, keep.x1 + gap), x1, y0, y1 },
          { x0, x1, y0, y1: Math.min(y1, keep.y0 - gap) },
          { x0, x1, y0: Math.max(y0, keep.y1 + gap), y1 },
        ].filter((s) => s.x1 - s.x0 >= 1.2 && s.y1 - s.y0 >= 1.2)
        if (!strips.length) continue
        const best = strips.reduce((a, b) => ((b.x1 - b.x0) * (b.y1 - b.y0) > (a.x1 - a.x0) * (a.y1 - a.y0) ? b : a))
        ;({ x0, x1, y0, y1 } = best)
        // Shrink to fit the strip, keeping the photo's proportions.
        const fit = Math.min(1, (x1 - x0) / w, (y1 - y0) / h)
        w *= fit
        h *= fit
      }
      const lx = (x0 + x1) / 2 + (jx * (x1 - x0 - w)) / 2
      const ly = (y0 + y1) / 2 + (jy * (y1 - y0 - h)) / 2

      // Stride through the library so neighbours rarely repeat a photo.
      const photo = pick % 4 === 3 ? ARCHIVE[(pick * 5) % ARCHIVE.length] : FILL[(pick * 7) % FILL.length]
      pick++
      cards.push({ id: cards.length, photo, w, h, lx, ly, z })
    }
  }
  return cards
}

export const CARDS: Card[] = buildField()
