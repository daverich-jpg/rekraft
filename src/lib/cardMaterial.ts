import { Color, ShaderMaterial, Texture, Vector4 } from 'three'

// One material per card. object-fit: cover is done in the shader so any
// photo fills any frame without stretching; hover pushes the photo in
// inside its frame (an editorial print-loupe move rather than a glow).

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uPlaneAspect;
  uniform float uImageAspect;
  uniform float uHover;
  uniform float uLoaded;
  uniform float uOpacity;
  uniform vec3 uPaper;
  uniform vec3 uChip;
  uniform vec4 uCrop; // x,y = window origin (y from top), z,w = size; z < 0 → cover
  varying vec2 vUv;

  void main() {
    vec2 scale = uPlaneAspect > uImageAspect
      ? vec2(1.0, uImageAspect / uPlaneAspect)
      : vec2(uPlaneAspect / uImageAspect, 1.0);
    vec2 uv = (vUv - 0.5) * scale / (1.0 + 0.07 * uHover) + 0.5;
    if (uCrop.z > 0.0) {
      vec2 local = (vUv - 0.5) / (1.0 + 0.07 * uHover) + 0.5;
      uv = vec2(uCrop.x + local.x * uCrop.z, 1.0 - (uCrop.y + (1.0 - local.y) * uCrop.w));
    }

    vec3 photo = texture2D(uMap, uv).rgb;
    photo *= 1.0 + 0.06 * uHover;

    vec3 col = mix(uChip, photo, uLoaded);
    // Fade toward the paper colour rather than to transparent: no sorting
    // artefacts, and it reads as the print receding into the page.
    col = mix(uPaper, col, uOpacity);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

export function createCardMaterial(planeAspect: number, crop?: [number, number, number, number]) {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uMap: { value: null as Texture | null },
      uPlaneAspect: { value: planeAspect },
      uImageAspect: { value: 1 },
      uHover: { value: 0 },
      uLoaded: { value: 0 },
      uOpacity: { value: 1 },
      uPaper: { value: new Color('#ffffff') },
      uChip: { value: new Color('#ecefec') },
      uCrop: { value: crop ? new Vector4(...crop) : new Vector4(0, 0, -1, -1) },
    },
  })
}
