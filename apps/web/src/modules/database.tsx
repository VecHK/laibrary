import { useEffect, useState } from 'react'
import {
  DatabaseFieldDef, Item, zDatabaseAttributes,
} from '@laibrary/types'
import { getRpc } from '../lib/rpc'
import { cycleSortState, type FieldSortState } from '../lib/order'
import type { ItemModule, ViewerCtx } from './types'

function schemaOf(item: Item): DatabaseFieldDef[] {
  const parsed = zDatabaseAttributes.safeParse(item.attributes)
  return parsed.success ? parsed.data.schema : []
}

function DatabaseCard({ item }: { item: Item }) {
  const fields = schemaOf(item)
  return (
    <div className="card database-card">
      <div className="card-icon">🗄️</div>
      <div className="card-title">{item.title || '(数据库)'}</div>
      <div className="card-sub">{fields.length} 个字段</div>
    </div>
  )
}

function DatabaseFull({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const [rows, setRows] = useState<Item[] | null>(null)
  const [sort, setSort] = useState<FieldSortState>(null)
  const [editing_cell, setEditingCell] = useState<{ row_id: number; field: string } | null>(null)
  const [editing_title_row, setEditingTitleRow] = useState<number | null>(null)

  const fields = schemaOf(item)

  const loadRows = () => {
    getRpc().listing({
      limit: 0,
      sort_by: 'order_index',
      sort_field: sort ?? undefined,
      desc: sort?.desc,
      filter_rules: [{ name: 'parent', input: item.id, logic: 'and' }],
    }).then(setRows).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }

  useEffect(loadRows, [item.id, sort])

  const refresh = () => {
    loadRows()
    ctx.refresh()
  }

  const cycleSort = (field: DatabaseFieldDef) => {
    setSort(prev => cycleSortState(prev, field.name, field.type))
  }

  const addRow = () => {
    getRpc().addItem({
      role: 'custom',
      title: '',
      parent_id: item.id,
    }).then(() => refresh()).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }

  const addField = () => {
    const name = window.prompt('字段名')
    if (!name || name.trim().length === 0) {
      return
    }
    const type = window.confirm('类型: 确定 = number, 取消 = string') ? 'number' : 'string'
    const new_fields = [...fields, { name: name.trim(), type }]
    getRpc().updateItem({
      id: item.id,
      data: { attributes: { schema: new_fields } as never },
    }).then(() => refresh()).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }

  const removeField = (field_name: string) => {
    const new_fields = fields.filter(f => f.name !== field_name)
    getRpc().updateItem({
      id: item.id,
      data: { attributes: { schema: new_fields } as never },
    }).then(() => refresh()).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }

  const updateRowAttributes = (row: Item, new_attrs: Record<string, unknown>) => {
    getRpc().updateItem({
      id: row.id,
      data: { attributes: { ...row.attributes, ...new_attrs } as never },
    }).then(() => {
      setEditingCell(null)
      refresh()
    }).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
      setEditingCell(null)
      refresh()
    })
  }

  const commitCell = (row: Item, field: DatabaseFieldDef, raw: string) => {
    if (field.type === 'number') {
      const num = Number(raw)
      if (raw.trim().length !== 0 && Number.isNaN(num)) {
        ctx.showError(`字段[${field.name}]需要数字`)
        return
      }
      updateRowAttributes(row, { [field.name]: raw.trim().length === 0 ? null : num })
    } else {
      updateRowAttributes(row, { [field.name]: raw })
    }
  }

  const deleteRow = (row: Item) => {
    getRpc().deleteItem({ id: row.id }).then(() => refresh()).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }

  const sort_marker = (field: DatabaseFieldDef): string => {
    if (sort === null || sort.name !== field.name) {
      return ''
    }
    return sort.desc ? ' ↓' : ' ↑'
  }

  return (
    <div className="database-full">
      <div className="page-toolbar">
        <button className="button" onClick={addRow}>+ 行</button>
        <button className="button" onClick={addField}>+ 字段</button>
      </div>

      <table className="db-table">
        <thead>
          <tr>
            <th>标题</th>
            {fields.map(field => (
              <th key={field.name}>
                <span
                  className="sortable-th"
                  title="点击排序"
                  onClick={() => cycleSort(field)}
                >
                  {field.name}{sort_marker(field)}
                </span>
                <button
                  className="tool-button"
                  title="删除字段"
                  onClick={() => removeField(field.name)}
                >✕</button>
              </th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows === null ? null : rows.map(row => (
            <tr key={row.id}>
              <td onClick={() => ctx.navigate(row.id)}>
                {editing_title_row === row.id ? (
                  <input
                    autoFocus
                    defaultValue={row.title}
                    onBlur={ev => {
                      getRpc().updateItem({
                        id: row.id,
                        data: { title: ev.target.value },
                      }).then(() => {
                        setEditingTitleRow(null)
                        refresh()
                      }).catch(err => {
                        ctx.showError(err instanceof Error ? err.message : String(err))
                      })
                    }}
                    onKeyDown={ev => {
                      if (ev.key === 'Enter') {
                        (ev.target as HTMLInputElement).blur()
                      }
                    }}
                  />
                ) : (
                  <span
                    className="row-title"
                    onClick={() => setEditingTitleRow(row.id)}
                  >{row.title || '(无标题)'}</span>
                )}
              </td>
              {fields.map(field => {
                const value = (row.attributes as Record<string, unknown>)[field.name]
                const is_editing = (
                  editing_cell !== null &&
                  editing_cell.row_id === row.id &&
                  editing_cell.field === field.name
                )
                return (
                  <td
                    key={field.name}
                    className="cell"
                    onClick={() => setEditingCell({ row_id: row.id, field: field.name })}
                  >
                    {is_editing ? (
                      <input
                        autoFocus
                        defaultValue={value === null || value === undefined ? '' : String(value)}
                        onBlur={ev => commitCell(row, field, ev.target.value)}
                        onKeyDown={ev => {
                          if (ev.key === 'Enter') {
                            (ev.target as HTMLInputElement).blur()
                          } else if (ev.key === 'Escape') {
                            setEditingCell(null)
                          }
                        }}
                      />
                    ) : (
                      <span className="cell-value">
                        {value === null || value === undefined ? '' : String(value)}
                      </span>
                    )}
                  </td>
                )
              })}
              <td>
                <button className="tool-button" title="删除行" onClick={() => deleteRow(row)}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows !== null && rows.length === 0 && (
        <div className="empty-hint">没有行。</div>
      )}
    </div>
  )
}

export const databaseModule: ItemModule = {
  role: 'database',
  Presenter: {
    card: (item) => <DatabaseCard item={item} />,
    full: (item, ctx) => <DatabaseFull item={item} ctx={ctx} />,
  },
}
