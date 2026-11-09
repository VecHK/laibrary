export const __RPC_ACTION_NAMES__ = [
  'addItem',
  'getItem',
  'getItems',
  'updateItem',
  'deleteItem',
  'listing',
  'getItemByUnityName',
  'newTag',
  'updateTag',
  'deleteTag',
  'searchTag',
  'getTagByTitle',
  'getConfig',
  'updateConfig',
] as const

export type RpcActionName = (typeof __RPC_ACTION_NAMES__)[number]

export const __THUMBNAIL_SIZES__ = [96, 384, 800, 1440] as const

export type ThumbSize = (typeof __THUMBNAIL_SIZES__)[number]

export const __SYSTEM_CONFIG_UNITY_NAME__ = 'sys.config'
export const __SYSTEM_UNITY_PREFIX__ = 'sys.'
