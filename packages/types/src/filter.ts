import type { ItemID, Kind, Role, UnityName } from './roles'

export type FilterRuleLogic = 'and' | 'or'

export interface RuleBase {
  logic: FilterRuleLogic
  invert?: boolean | undefined
}

export type AttributeScalar = string | number | boolean

export type FilterRule =
  | (RuleBase & { name: 'role'; input: Role | Role[] })
  | (RuleBase & { name: 'kind'; input: Kind })
  | (RuleBase & { name: 'unity_name'; input: UnityName })
  | (RuleBase & { name: 'title'; input: string })
  | (RuleBase & { name: 'has_tag'; input: ItemID })
  | (RuleBase & { name: 'empty_tag'; input: null })
  | (RuleBase & { name: 'parent'; input: ItemID | null })
  | (RuleBase & { name: 'attribute_equal'; input: { name: string; value: AttributeScalar } })

export interface FilterGroup {
  logic: FilterRuleLogic
  invert: boolean
  rules: FilterRule[]
}

export type ItemSortBy = 'id' | 'create_date' | 'update_date' | 'order_index'

export type SortField = { name: string; type: 'string' | 'number' }

export interface ListingParams {
  sort_by?: ItemSortBy | undefined
  sort_field?: SortField | undefined
  after_id?: ItemID | undefined
  desc?: boolean | undefined
  limit: number
  filter_rules?: FilterRule[] | undefined
  filter_groups?: FilterGroup[] | undefined
}
