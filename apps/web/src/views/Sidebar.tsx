import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Item, ItemID } from '@laibrary/types'
import { zDatabaseAttributes } from '@laibrary/types'
import type { HashRoute } from '../lib/hash-router'
import { openItem } from '../lib/open-item'
import type { ViewerCtx } from '../modules/types'
import { ItemIcon } from '../modules/item-icon'
import { treeCanAddInside } from '../lib/sidebar-tree'
import { MoveToDialog } from './MoveToDialog'
import { SidebarItemMenu } from './SidebarItemMenu'

const __TREE_ROLES__ = ['page', 'database', 'itemlink'] as const
const __TREE_PAGE_SIZE__ = 200

type MenuAnchor = {
  left: number
  right: number
  bottom: number
}

type OpenMenu = {
  item: Item
  anchor: MenuAnchor
}

function isTreeItem(item: Item): boolean {
  return item.role === 'page' || item.role === 'database' || item.role === 'itemlink'
}

function collectItemlinks(
  roots: readonly Item[] | null,
  children: Readonly<Record<string, Item[]>>,
): Item[] {
  const all = [...(roots ?? []), ...Object.values(children).flat()]
  return all.filter(item => item.role === 'itemlink')
}

export function Sidebar({
  route,
  ctx,
  refresh_key,
  onOpenPeek,
}: {
  route: HashRoute
  ctx: ViewerCtx
  refresh_key: number
  onOpenPeek: (id: ItemID) => void
}) {
  const [roots, setRoots] = useState<Item[] | null>(null)
  const [children, setChildren] = useState<Record<string, Item[]>>({})
  const [expanded, setExpanded] = useState<ReadonlySet<ItemID>>(new Set())
  const [loading, setLoading] = useState<ReadonlySet<ItemID>>(new Set())
  const [targets, setTargets] = useState<Record<string, Item>>({})
  const [open_menu, setOpenMenu] = useState<OpenMenu | null>(null)
  const [renaming_id, setRenamingId] = useState<ItemID | null>(null)
  const [rename_value, setRenameValue] = useState('')
  const [move_item, setMoveItem] = useState<Item | null>(null)
  const [creating_id, setCreatingId] = useState<ItemID | null>(null)
  const alive_ref = useRef(true)
  const loading_ref = useRef<ReadonlySet<ItemID>>(new Set())
  const expanded_ref = useRef<ReadonlySet<ItemID>>(new Set())
  const children_ref = useRef<Record<string, Item[]>>({})
  const targets_ref = useRef<Record<string, Item>>({})
  const target_loading_ref = useRef<Set<ItemID>>(new Set())
  const rename_cancel_ref = useRef(false)

  useEffect(() => {
    expanded_ref.current = expanded
  }, [expanded])

  useEffect(() => {
    children_ref.current = children
  }, [children])

  useEffect(() => {
    targets_ref.current = targets
  }, [targets])

  const loadRoots = useCallback(async () => {
    try {
      const list = await ctx.api.rpc.listing({
        limit: __TREE_PAGE_SIZE__,
        sort_by: 'order_index',
        filter_rules: [
          { name: 'parent', input: null, logic: 'and' },
          { name: 'role', input: [...__TREE_ROLES__], logic: 'and' },
        ],
      })
      if (alive_ref.current) {
        setRoots(list.filter(isTreeItem))
      }
    } catch (error) {
      ctx.showError(error instanceof Error ? error.message : String(error))
    }
  }, [ctx.api.rpc, ctx.showError])

  const loadChildren = useCallback(async (parent_id: ItemID) => {
    if (loading_ref.current.has(parent_id)) {
      // 同一 parent 已有请求，去重。
    } else {
      const next_loading = new Set(loading_ref.current)
      next_loading.add(parent_id)
      loading_ref.current = next_loading
      setLoading(next_loading)
      try {
        const list = await ctx.api.rpc.listing({
          limit: __TREE_PAGE_SIZE__,
          sort_by: 'order_index',
          filter_rules: [
            { name: 'parent', input: parent_id, logic: 'and' },
            { name: 'role', input: [...__TREE_ROLES__], logic: 'and' },
          ],
        })
        if (alive_ref.current) {
          const next_children = {
            ...children_ref.current,
            [String(parent_id)]: list.filter(isTreeItem),
          }
          children_ref.current = next_children
          setChildren(next_children)
        }
      } catch (error) {
        ctx.showError(error instanceof Error ? error.message : String(error))
      } finally {
        const done_loading = new Set(loading_ref.current)
        done_loading.delete(parent_id)
        loading_ref.current = done_loading
        if (alive_ref.current) {
          setLoading(done_loading)
        }
      }
    }
  }, [ctx.api.rpc, ctx.showError])

  useEffect(() => {
    alive_ref.current = true
    targets_ref.current = {}
    target_loading_ref.current.clear()
    setTargets({})
    void loadRoots()
    for (const parent_id of expanded_ref.current) {
      void loadChildren(parent_id)
    }
    return () => {
      alive_ref.current = false
    }
  }, [refresh_key, loadRoots, loadChildren])

  useEffect(() => {
    const itemlinks = collectItemlinks(roots, children)
    for (const itemlink of itemlinks) {
      const target_id = itemlink.target_id
      if (target_id !== null) {
        const key = String(target_id)
        if (targets_ref.current[key] === undefined && !target_loading_ref.current.has(target_id)) {
          target_loading_ref.current.add(target_id)
          void ctx.api.rpc.getItem({ id: target_id })
            .then(target => {
              if (alive_ref.current) {
                const next_targets = {
                  ...targets_ref.current,
                  [key]: target,
                }
                targets_ref.current = next_targets
                setTargets(next_targets)
              }
            })
            .catch(() => {
              // target 不存在时只是不显示 +，点击 itemlink 时再报错。
            })
            .finally(() => {
              target_loading_ref.current.delete(target_id)
            })
        }
      }
    }
  }, [roots, children, ctx.api.rpc])

  const togglePage = (page_id: ItemID) => {
    const next = new Set(expanded_ref.current)
    if (next.has(page_id)) {
      next.delete(page_id)
    } else {
      next.add(page_id)
      if (children_ref.current[String(page_id)] === undefined) {
        void loadChildren(page_id)
      }
    }
    expanded_ref.current = next
    setExpanded(next)
  }

  const rowActive = (item: Item): boolean => (
    route.name === 'item' && route.id === item.id
  )

  const openTreeItem = (item: Item) => {
    if (item.role === 'itemlink') {
      void openItem(item, ctx)
    } else {
      ctx.navigate(item.id)
    }
  }

  const canAddInside = (item: Item): boolean => (
    treeCanAddInside(
      item,
      item.target_id === null ? undefined : targets[String(item.target_id)],
    )
  )

  const canOpenMenu = (item: Item): boolean => (
    item.role === 'page' || item.role === 'database'
  )

  const lastOrderFor = async (parent_id: ItemID): Promise<number> => {
    const last = await ctx.api.rpc.listing({
      limit: 1,
      sort_by: 'order_index',
      desc: true,
      filter_rules: [{ name: 'parent', input: parent_id, logic: 'and' }],
    })
    return (last[0]?.order_index ?? 0) + 1
  }

  const createChildPage = async (parent_id: ItemID) => {
    const order_index = await lastOrderFor(parent_id)
    const page = await ctx.api.rpc.addItem({
      role: 'page',
      title: '新页面',
      parent_id,
      order_index,
    })
    await ctx.api.rpc.addItem({
      role: 'textline',
      title: '',
      parent_id: page.id,
      order_index: 1,
    })
    ctx.refresh()
    ctx.navigate(page.id)
  }

  const createDatabaseRow = async (database: Item) => {
    const attributes = zDatabaseAttributes.safeParse(database.attributes)
    const fields = attributes.success ? attributes.data.schema : []
    const unity_field = fields.find(field => field.type === 'unity_name')
    let unity_name: string | undefined
    let proceed = true
    if (unity_field !== undefined) {
      const value = window.prompt(`请输入 ${unity_field.name}（全局唯一）`)
      if (value === null || value.trim().length === 0) {
        proceed = false
      } else {
        unity_name = value.trim()
      }
    }
    if (proceed) {
      const order_index = await lastOrderFor(database.id)
      await ctx.api.rpc.addItem({
        role: 'page',
        title: '',
        parent_id: database.id,
        order_index,
        ...(unity_name === undefined ? {} : { unity_name }),
      })
      ctx.refresh()
      ctx.navigate(database.id)
    }
  }

  const addInside = (item: Item) => {
    if (creating_id === null) {
      setCreatingId(item.id)
      void (async () => {
        try {
          if (item.role === 'database') {
            await createDatabaseRow(item)
          } else if (item.role === 'itemlink') {
            const target = item.target_id === null ? undefined : targets_ref.current[String(item.target_id)]
            if (target?.role === 'page') {
              await createChildPage(target.id)
            }
          } else {
            await createChildPage(item.id)
          }
        } catch (error) {
          ctx.showError(error instanceof Error ? error.message : String(error))
        } finally {
          setCreatingId(null)
        }
      })()
    }
  }

  const startRename = (item: Item) => {
    rename_cancel_ref.current = false
    setRenamingId(item.id)
    setRenameValue(item.title)
  }

  const commitRename = async (item: Item, value: string) => {
    const title = value.trim()
    if (title.length === 0) {
      setRenamingId(null)
    } else {
      try {
        await ctx.api.rpc.updateItem({ id: item.id, data: { title } })
        setRenamingId(null)
        ctx.refreshSidebar()
        if (route.name === 'item' && route.id === item.id) {
          ctx.refresh()
        }
      } catch (error) {
        setRenamingId(null)
        ctx.showError(error instanceof Error ? error.message : String(error))
      }
    }
  }

  const removeItem = async (item: Item) => {
    try {
      const child_list = await ctx.api.rpc.listing({
        limit: 0,
        filter_rules: [{ name: 'parent', input: item.id, logic: 'and' }],
      })
      const has_content = child_list.some(child => (
        child.role !== 'textline' || child.title.trim().length !== 0
      ))
      if (has_content) {
        ctx.showError('当前没有回收站；请先移动或清空子项，再删除这个容器。')
      } else if (window.confirm('当前没有回收站，删除后不可恢复。继续？')) {
        for (const child of child_list) {
          await ctx.api.rpc.deleteItem({ id: child.id })
        }
        await ctx.api.rpc.deleteItem({ id: item.id })
        if (route.name === 'item' && route.id === item.id) {
          ctx.navigate({ name: 'plaza' })
        }
        ctx.refresh()
      }
    } catch (error) {
      ctx.showError(error instanceof Error ? error.message : String(error))
    }
  }

  const openMenuFor = (item: Item, button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect()
    setOpenMenu({
      item,
      anchor: { left: rect.left, right: rect.right, bottom: rect.bottom },
    })
  }

  const createPage = async () => {
    try {
      const page = await ctx.api.rpc.addItem({ role: 'page', title: '新页面' })
      await ctx.api.rpc.addItem({
        role: 'textline',
        title: '',
        parent_id: page.id,
        order_index: 1,
      })
      ctx.refresh()
      ctx.navigate(page.id)
    } catch (error) {
      ctx.showError(error instanceof Error ? error.message : String(error))
    }
  }

  const createDatabase = () => {
    ctx.api.rpc.addItem({
      role: 'database',
      title: '新数据库',
      attributes: { schema: [] },
    }).then(item => {
      ctx.refresh()
      ctx.navigate(item.id)
    }).catch(error => ctx.showError(error instanceof Error ? error.message : String(error)))
  }

  const renderNode = (item: Item, depth: number): ReactNode => {
    const page = item.role === 'page'
    const is_expanded = expanded.has(item.id)
    const child_list = children[String(item.id)]
    const is_renaming = renaming_id === item.id
    const addable = canAddInside(item)
    const menuable = canOpenMenu(item)
    return (
      <div key={item.id} className="tree-node">
        <div
          className={rowActive(item) ? 'tree-row active' : 'tree-row'}
          role="button"
          tabIndex={0}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => {
            if (!is_renaming) {
              if (page) {
                ctx.navigate(item.id)
              } else {
                openTreeItem(item)
              }
            }
          }}
          onKeyDown={ev => {
            if ((ev.key === 'Enter' || ev.key === ' ') && !is_renaming) {
              ev.preventDefault()
              if (page) {
                ctx.navigate(item.id)
              } else {
                openTreeItem(item)
              }
            }
          }}
        >
          {page ? (
            <button
              type="button"
              className={is_expanded ? 'tree-caret open' : 'tree-caret'}
              aria-label={is_expanded ? '收起' : '展开'}
              onClick={ev => {
                ev.stopPropagation()
                togglePage(item.id)
              }}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M4 2.5 8 6l-4 3.5" />
              </svg>
            </button>
          ) : (
            <span className="tree-caret-spacer" />
          )}
          <ItemIcon item={item} />
          {is_renaming ? (
            <input
              className="tree-rename"
              autoFocus
              value={rename_value}
              onClick={ev => ev.stopPropagation()}
              onChange={ev => setRenameValue(ev.target.value)}
              onBlur={() => {
                if (rename_cancel_ref.current) {
                  rename_cancel_ref.current = false
                  setRenamingId(null)
                } else {
                  void commitRename(item, rename_value)
                }
              }}
              onKeyDown={ev => {
                if (ev.key === 'Enter') {
                  ev.preventDefault()
                  ev.currentTarget.blur()
                } else if (ev.key === 'Escape') {
                  ev.preventDefault()
                  rename_cancel_ref.current = true
                  ev.currentTarget.blur()
                }
              }}
            />
          ) : (
            <span className="tree-title">{item.title || '(无标题)'}</span>
          )}
          <span className="tree-actions">
            {addable && (
              <button
                type="button"
                className="tree-action tree-add"
                title={item.role === 'database' ? 'Add an entry inside' : 'Add a page inside'}
                aria-label={item.role === 'database' ? '新增条目' : '新增子页面'}
                disabled={creating_id !== null}
                onClick={ev => {
                  ev.stopPropagation()
                  addInside(item)
                }}
              >＋</button>
            )}
            {menuable && (
              <button
                type="button"
                className="tree-action tree-more"
                title="Remove, rename, and more…"
                aria-label="更多操作"
                onClick={ev => {
                  ev.stopPropagation()
                  openMenuFor(item, ev.currentTarget)
                }}
              >···</button>
            )}
          </span>
        </div>
        {page && is_expanded && (
          child_list === undefined ? (
            loading.has(item.id) ? (
              <div
                className="tree-loading"
                style={{ paddingLeft: `${8 + (depth + 1) * 14}px` }}
              >加载中…</div>
            ) : null
          ) : child_list.length === 0 ? (
            <div
              className="tree-empty"
              style={{ paddingLeft: `${8 + (depth + 1) * 14}px` }}
            >没有子页面</div>
          ) : (
            child_list.map(child => renderNode(child, depth + 1))
          )
        )}
      </div>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-title">Laibrary</div>
      <button
        className={route.name === 'plaza' ? 'side-button active' : 'side-button'}
        onClick={() => ctx.navigate({ name: 'plaza' })}
      >🧭 广场</button>
      <div className="sidebar-section sidebar-tree-section">
        <div className="sidebar-label">根条目</div>
        <div className="sidebar-tree">
          {roots === null ? (
            <div className="tree-loading">加载中…</div>
          ) : roots.length === 0 ? (
            <div className="tree-empty">还没有页面</div>
          ) : (
            roots.map(item => renderNode(item, 0))
          )}
        </div>
      </div>
      <div className="sidebar-actions">
        <button className="sidebar-create" onClick={() => { void createPage() }}>＋ 新页面</button>
        <button className="sidebar-create" onClick={createDatabase}>＋ 新数据库</button>
        <div className="sidebar-footer">
          <button
            className={route.name === 'settings' ? 'side-button active' : 'side-button'}
            onClick={() => ctx.navigate({ name: 'settings' })}
          >⚙ 设置</button>
        </div>
      </div>
      {open_menu !== null && (
        <SidebarItemMenu
          item={open_menu.item}
          ctx={ctx}
          anchor={open_menu.anchor}
          on_close={() => setOpenMenu(null)}
          on_rename={() => startRename(open_menu.item)}
          on_move={() => setMoveItem(open_menu.item)}
          on_peek={() => onOpenPeek(open_menu.item.id)}
          on_remove={() => { void removeItem(open_menu.item) }}
        />
      )}
      {move_item !== null && (
        <MoveToDialog
          item={move_item}
          ctx={ctx}
          on_close={() => setMoveItem(null)}
        />
      )}
    </aside>
  )
}
