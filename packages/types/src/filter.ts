import type { ItemID, Role } from './roles'

export type FilterRuleLogic = 'and' | 'or'

export interface RuleBase {
  logic: FilterRuleLogic
  invert?: boolean
}

export type AttributeScalar = string | number | boolean

export type FilterRule =
  | (RuleBase & { name: 'role'; input: Role | Role[] })
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

export type ItemSortBy = 'id' | 'create_date' | 'update_date'

export interface ListingParams {
  sort_by?: ItemSortBy
  after_id?: ItemID
  desc?: boolean
  limit: number
  filter_rules?: FilterRule[]
  filter_groups?: FilterGroup[]
}
