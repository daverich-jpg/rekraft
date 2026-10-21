import { LinearMipmapLinearFilter, SRGBColorSpace, Texture, TextureLoader } from 'three'

// Shared texture cache: the field reuses photos across many cards, so each
// URL is decoded and uploaded once.

const loader = new TextureLoader().setCrossOrigin('anonymous')
const cache = new Map<string, Promise<Texture>>()
let anisotropy = 8

export const setMaxAnisotropy = (n: number) => (anisotropy = Math.min(8, n))

export function loadTexture(url: string): Promise<Texture> {
  let p = cache.get(url)
  if (!p) {
    p = loader.loadAsync(url).then((tex) => {
      tex.colorSpace = SRGBColorSpace
      tex.minFilter = LinearMipmapLinearFilter
      tex.generateMipmaps = true
      tex.anisotropy = anisotropy
      tex.needsUpdate = true
      return tex
    })
    // A failed fetch should be retryable, not cached forever.
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return p
}

export const imageAspect = (tex: Texture) => {
  const img = tex.image as { width: number; height: number }
  return img.width / img.height
}
