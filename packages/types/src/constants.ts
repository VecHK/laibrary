export const RPC_ACTION_NAMES = [
  'addItem',
  'getItem',
  'getItems',
  'updateItem',
  'deleteItem',
  'deleteItems',
  'restoreItems',
  'convertTextBlock',
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

export type RpcActionName = (typeof RPC_ACTION_NAMES)[number]

export const THUMBNAIL_SIZES = [96, 384, 800, 1440] as const

export type ThumbSize = (typeof THUMBNAIL_SIZES)[number]

export const SYSTEM_CONFIG_UNITY_NAME = 'sys.config'
export const SYSTEM_UNITY_PREFIX = 'sys.'
