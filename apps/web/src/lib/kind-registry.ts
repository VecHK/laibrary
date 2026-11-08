import type { ItemModule } from '../modules/types'
import { mangaModule } from '../modules/manga'

export const kindModules: ItemModule[] = [
  mangaModule,
]

export function getKindModule(kind: string): ItemModule | undefined {
  return kindModules.find(module => module.kind === kind)
}

export function hasKindModule(kind: string | null): boolean {
  return kind !== null && getKindModule(kind) !== undefined
}
