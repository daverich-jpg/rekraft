# ReKraft — spatial gallery

A 3D, infinitely pannable photography field built from the ReKraft landing in Figma
(`3foIRpj43mwJx4JOhrMSUC`, node `1315:187`). At rest it is the Figma frame,
pixel for pixel. Once you move, the photos turn out to be prints floating at
different depths. Switch to **Sphere** and the same field wraps around you.

## Run

```bash
npm install
npm run dev        # http://localhost:5310
npm run build      # type-check + production bundle in dist/
```

### Installing the stack from scratch

```bash
npm i react react-dom three @react-three/fiber @react-three/drei maath lucide-react
npm i -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/three tailwindcss @tailwindcss/vite
```

Pinned here: React 18.3, three 0.169, R3F 8.17, maath 0.10, Tailwind 4.1 (4.0.0 has a build bug).
Drei is installed but not imported: the camera rig is hand-rolled on `maath/easing`,
because both modes, focus and parallax share one spring system. GSAP isn't
used for the same reason.

## Controls

| Input | Plane | Sphere | Focused photo |
|---|---|---|---|
| Drag / two-finger scroll | pan (with momentum) | rotate the sphere | leaves focus and pans |
| Pinch / ⌘-ctrl + scroll | dolly through depth | dolly | leaves focus |
| Click a photo | focus it | focus it | click again (or background) to return |
| ← → ↑ ↓ | pan | rotate | jump to the spatial neighbour |
| Enter | focus the photo nearest centre | same | — |
| S | toggle Plane / Sphere | | |
| Esc | back to the landing | back to the landing | close |

Mouse movement adds real perspective parallax in Plane mode and a slight look-around in Sphere mode.
With `prefers-reduced-motion` the springs shorten, momentum and pointer parallax turn off, and depth
lead/trail is disabled.

## Structure

```
src/
  data/photos.ts           photo library, Figma frames + crops, seeded infinite fill
  lib/rig.ts               shared per-frame state, plane↔sphere transform, wrap, focus maths
  lib/cardMaterial.ts      card shader: Figma crop window / cover-fit, hover loupe, fade-to-paper
  lib/textures.ts          shared texture cache (sRGB, mipmaps, anisotropy)
  components/SpatialCanvas.tsx   Canvas, camera rig, pointer/wheel/keyboard input
  components/ImageCard.tsx       one print: placement, hover lift, focus tilt, hi-res swap
  components/OverlayUI.tsx       Figma hero → header hand-off, mode switch, caption
```

## How it works

- **Rest frame = Figma.** One world unit is 100 Figma px. The camera distance comes from the viewport
  height, so at 1280×832 the plane at z = 0 renders at 1:1. Every card is placed at its Figma box and
  then pushed to its own depth with a `(d − z)/d` size/position compensation, so it still projects onto
  exactly the same pixels (checked: max error 0.000 px across all 11 frames).
- **The Figma crops survive.** Each archive plate keeps the image window chosen in Figma (offset + scale
  inside its frame), done as a UV window in the shader. Other photos use a shader cover-fit.
- **Infinite field without duplicates.** 83 cards tile a 52×22-unit period. Each card wraps around
  the current pan independently, so there are always exactly 83 meshes. The fill is a seeded jittered
  grid, which shrinks into the leftover strips around the Figma cluster instead of leaving a moat (0 overlaps).
- **Elastic depth parallax.** Real per-depth pan rates would make layers drift apart forever on an
  infinite plane, and the composition would collapse into overlaps. Instead, depth layers lead or trail
  while the field moves (`pan − panSlow`) and settle back into the designed layout. Mouse-driven
  camera moves still give real perspective parallax.
- **Sphere.** The same wrapped layout maps to azimuth (one period = 360°) on a bowl-shaped cylinder
  around the camera. Each card faces the axis. Plane↔sphere is a damped blend of position, orientation
  (slerp), size and FOV (40° → 54°).
- **Focus.** Clicking pans the field so the photo comes to rest dead centre, then dollies the camera to
  fill about 72% of the height. That works the same way in both modes, so the camera never has to chase a
  moving target. Unsplash photos swap to a 2000 px texture while focused.

## Debugging

`?clock=manual` freezes the render loop and exposes `window.__rk.step(frames, ms)`, which advances
deterministically and returns ms per frame. `?motion=full` overrides reduced motion.

## Credits

Plates 01–11 come from the Figma design. Plates 12–41 are hotlinked from Unsplash (`images.unsplash.com`,
CORS-enabled). Photographer credit isn't shown because it isn't in the data. Add it before showing this publicly.
