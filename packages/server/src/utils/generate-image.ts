import sharp from 'sharp'
import type { Metadata } from 'sharp'

sharp.cache(false)

export async function generateThumb({
  source_image_path,
  thumb_image_path,
}: {
  source_image_path: string
  thumb_image_path: string
}): Promise<string> {
  const sharp_p = sharp(source_image_path)
  const thumb_size = 300

  await sharp_p
    .rotate()
    .flatten({ background: '#FFFFFF' })
    .resize(thumb_size, null, { withoutEnlargement: true })
    .avif({
      quality: 40,
      effort: 8,
    })
    .toFile(thumb_image_path)

  sharp_p.destroy()

  return thumb_image_path
}

export type ImageDimession = {
  orientation: number | undefined
  width: number | undefined
  height: number | undefined
}

export function sizeNormalize({ width, height, orientation }: Metadata): ImageDimession {
  return (orientation || 0) >= 5
    ? { orientation, width: height, height: width }
    : { orientation, width, height }
}

export async function getImageDimession(filePath: string): Promise<ImageDimession> {
  const meta = await sharp(filePath).metadata()
  return sizeNormalize(meta)
}
