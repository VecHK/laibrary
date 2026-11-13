import type { ThumbSize } from '@laibrary/types'
import { THUMBNAIL_SIZES } from '@laibrary/types'

export function pickThumbSize(display_width: number, device_pixel_ratio = 1): ThumbSize {
  if (!Number.isFinite(display_width) || display_width <= 0) {
    return 384
  } else {
    const target = display_width * Math.max(1, device_pixel_ratio)
    return THUMBNAIL_SIZES.find(size => size >= target) ?? 1440
  }
}

export function clampImageWidth(value: number, max_width: number): number {
  return Math.min(1440, Math.max(80, Math.min(value, max_width)))
}
