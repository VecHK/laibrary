import type { Role } from '@laibrary/types'
import type { ItemModule, ItemModuleRegistry } from './types'
import { __PAGE_MODULE__ } from './page'
import { __TEXTLINE_MODULE__ } from './textline'
import { __IMAGE_MODULE__ } from './image'
import { __FILE_MODULE__ } from './file'
import { __ITEMLINK_MODULE__ } from './itemlink'
import { __TAG_MODULE__ } from './tag'
import { __DATABASE_MODULE__ } from './database'
import { __ENTITY_MODULE__ } from './entity'
import { __MANGA_MODULE__ } from './manga'

const role_modules: Record<Role, ItemModule> = {
  page: __PAGE_MODULE__,
  entity: __ENTITY_MODULE__,
  textline: __TEXTLINE_MODULE__,
  image: __IMAGE_MODULE__,
  file: __FILE_MODULE__,
  itemlink: __ITEMLINK_MODULE__,
  tag: __TAG_MODULE__,
  database: __DATABASE_MODULE__,
}

const kind_modules: readonly ItemModule[] = [__MANGA_MODULE__]

export function CreateModuleRegistry(): ItemModuleRegistry {
  return {
    resolve: item => role_modules[item.role],
    getKind: kind => kind_modules.find(module => module.kind === kind),
  }
}
