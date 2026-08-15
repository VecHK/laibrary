import type { Item, Role } from '@laibrary/types'
import type { ItemModule } from './types'
import { resolveTypeTagId } from '../lib/tags'
import { pageModule } from './page'
import { textlineModule } from './textline'
import { imageModule } from './image'
import { fileModule } from './file'
import { tagModule } from './tag'
import { databaseModule } from './database'
import { mangaModule } from './manga'

const RoleModules: Partial<Record<Role, ItemModule>> = {
  textline: textlineModule,
  image: imageModule,
  file: fileModule,
  tag: tagModule,
  database: databaseModule,
}

const TypeTagModules: ItemModule[] = [
  mangaModule,
]

export function resolveModule(
  item: Item,
  resolve_tag_id: (tag_name: string) => number | undefined = resolveTypeTagId,
): ItemModule {
  const role_module = RoleModules[item.role]
  if (role_module !== undefined) {
    return role_module
  }

  for (const module of TypeTagModules) {
    if (module.tag !== undefined) {
      const tag_id = resolve_tag_id(module.tag)
      if (tag_id !== undefined && item.tags.includes(tag_id)) {
        return module
      }
    }
  }

  return pageModule
}
