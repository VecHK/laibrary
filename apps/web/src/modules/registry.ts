import type { Item, Role } from '@laibrary/types'
import type { ItemModule } from './types'
import { pageModule } from './page'
import { textlineModule } from './textline'
import { imageModule } from './image'
import { fileModule } from './file'
import { itemlinkModule } from './itemlink'
import { tagModule } from './tag'
import { databaseModule } from './database'
import { entityModule } from './entity'

const RoleModules: Record<Role, ItemModule> = {
  page: pageModule,
  entity: entityModule,
  textline: textlineModule,
  image: imageModule,
  file: fileModule,
  itemlink: itemlinkModule,
  tag: tagModule,
  database: databaseModule,
}

export function resolveModule(item: Item): ItemModule {
  return RoleModules[item.role] ?? pageModule
}
