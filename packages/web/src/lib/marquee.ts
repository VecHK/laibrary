export type Box = {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export function boxFromPoints(
  start_x: number,
  start_y: number,
  end_x: number,
  end_y: number,
): Box {
  return {
    left: Math.min(start_x, end_x),
    top: Math.min(start_y, end_y),
    width: Math.abs(end_x - start_x),
    height: Math.abs(end_y - start_y),
  }
}

export function boxesIntersect(left: Box, right: Box): boolean {
  return (
    left.left < right.left + right.width &&
    left.left + left.width > right.left &&
    left.top < right.top + right.height &&
    left.top + left.height > right.top
  )
}
