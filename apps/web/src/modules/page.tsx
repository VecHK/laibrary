import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Item } from '@laibrary/types'
import { getRpc } from '../lib/rpc'
import { createFileItem, createImageItem } from '../lib/blob'
import { orderAfter } from '../lib/order'
import { mergeTextLine, type SlashCommand } from '../lib/textline-editor'
import type { ItemModule, ViewerCtx } from './types'
import { resolveModule } from './registry'
import { ItemPicker } from './item-picker'
import {
  TextLineBlock,
  type TextLineFocusRequest,
} from './textline'

type FocusRequest = {
  id: number
  request: TextLineFocusRequest
}

type UploadKind = 'image' | 'file'

function sortChildren(items: Item[]): Item[] {
  return [...items].sort((a, b) => (
    a.order_index - b.order_index || a.id - b.id
  ))
}

function useDebouncedTitle(item: Item, ctx: ViewerCtx) {
  const [value, setValue] = useState(item.title)
  const timer_ref = useRef<ReturnType<typeof setTimeout> | null>(null)
  const value_ref = useRef(item.title)

  useEffect(() => {
    setValue(item.title)
    value_ref.current = item.title
  }, [item.title, item.id])

  const save = () => {
    if (timer_ref.current !== null) {
      clearTimeout(timer_ref.current)
      timer_ref.current = null
    }
    getRpc().updateItem({ id: item.id, data: { title: value_ref.current } })
      .then(() => ctx.refresh())
      .catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
  }

  useEffect(() => () => {
    if (timer_ref.current !== null) {
      clearTimeout(timer_ref.current)
      timer_ref.current = null
      getRpc().updateItem({ id: item.id, data: { title: value_ref.current } })
        .catch(() => undefined)
    }
  }, [item.id])

  const scheduleSave = (new_value: string) => {
    setValue(new_value)
    value_ref.current = new_value
    if (timer_ref.current !== null) {clearTimeout(timer_ref.current)}
    timer_ref.current = setTimeout(() => {
      timer_ref.current = null
      getRpc().updateItem({ id: item.id, data: { title: value_ref.current } })
        .catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
    }, 400)
  }

  return [value, scheduleSave, save] as const
}

function PageCard({ item }: { item: Item }) {
  return (
    <div className="card page-card">
      <div className="card-icon">📄</div>
      <div className="card-title">{item.title || '(无标题)'}</div>
    </div>
  )
}

function BlockWrapper({
  item,
  content,
  onDropBlock,
  onDelete,
  onAddAfter,
}: {
  item: Item
  content: ReactNode
  onDropBlock: (dragged_id: number, target_id: number) => void
  onDelete: () => void
  onAddAfter: () => void
}) {
  return (
    <div
      className="page-block"
      onDragOver={ev => {
        ev.preventDefault()
        ev.dataTransfer.dropEffect = 'move'
      }}
      onDrop={ev => {
        ev.preventDefault()
        const dragged = Number(ev.dataTransfer.getData('text/laibrary-block'))
        if (Number.isSafeInteger(dragged) && dragged !== item.id) {
          onDropBlock(dragged, item.id)
        }
      }}
    >
      <span className="block-gutter">
        <span
          className="block-drag-handle"
          title="拖拽排序"
          draggable
          onDragStart={ev => {
            ev.dataTransfer.setData('text/laibrary-block', String(item.id))
            ev.dataTransfer.effectAllowed = 'move'
          }}
        >⠿</span>
        <button
          className="block-add"
          title="在下方插入文本行"
          onClick={ev => {
            ev.stopPropagation()
            onAddAfter()
          }}
        >＋</button>
      </span>
      <div className="page-block-content">
        {content}
      </div>
      <button
        className="tool-button block-delete"
        title="删除 block"
        onClick={ev => {
          ev.stopPropagation()
          onDelete()
        }}
      >✕</button>
    </div>
  )
}

function PageFull({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const [children, setChildren] = useState<Item[] | null>(null)
  const children_ref = useRef<Item[]>([])
  const [active_block_id, setActiveBlockId] = useState<number | null>(null)
  const [focus_request, setFocusRequest] = useState<FocusRequest | null>(null)
  const [picker, setPicker] = useState(false)
  const [link_placeholder, setLinkPlaceholder] = useState<Item | null>(null)
  const [title, scheduleTitle, saveTitle] = useDebouncedTitle(item, ctx)
  const alive_ref = useRef(true)
  const pending_upload_ref = useRef<{ kind: UploadKind, placeholder: Item | null } | null>(null)
  const image_input_ref = useRef<HTMLInputElement>(null)
  const file_input_ref = useRef<HTMLInputElement>(null)

  const syncChildren = (next: Item[]) => {
    const sorted = sortChildren(next)
    children_ref.current = sorted
    setChildren(sorted)
  }

  const patchChild = (id: number, patch: Partial<Item>) => {
    syncChildren(children_ref.current.map(child => (
      child.id === id ? { ...child, ...patch } : child
    )))
  }

  const insertChild = (child: Item) => {
    if (children_ref.current.some(existing => existing.id === child.id)) {return}
    syncChildren([...children_ref.current, child])
  }

  const removeChild = (id: number) => {
    syncChildren(children_ref.current.filter(child => child.id !== id))
    if (active_block_id === id) {setActiveBlockId(null)}
  }

  const appendOrder = (): number => (
    children_ref.current.reduce((max, child) => Math.max(max, child.order_index), 0) + 1
  )

  const orderAfterItem = (item: Item): number => {
    const next = children_ref.current
      .filter(child => (
        child.order_index > item.order_index ||
        (child.order_index === item.order_index && child.id > item.id)
      ))
      .sort((a, b) => a.order_index - b.order_index || a.id - b.id)[0]
    return orderAfter(item.order_index, next?.order_index)
  }

  const focusBlock = (id: number, caret: number | 'end') => {
    setActiveBlockId(id)
    setFocusRequest({ id, request: { caret } })
  }

  const loadChildren = async (
    show_loading: boolean = false,
    auto_focus_first: boolean = false,
  ) => {
    if (show_loading) {setChildren(null)}
    try {
      const list = await getRpc().listing({
        limit: 0,
        sort_by: 'order_index',
        filter_rules: [{ name: 'parent', input: item.id, logic: 'and' }],
      })
      if (!alive_ref.current) {return}
      syncChildren(list)
      const first = list[0]
      if (
        auto_focus_first &&
        list.length === 1 &&
        first?.role === 'textline' &&
        first.title.length === 0
      ) {
        focusBlock(first.id, 0)
      }
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    alive_ref.current = true
    setActiveBlockId(null)
    setFocusRequest(null)
    void loadChildren(true, true)
    return () => { alive_ref.current = false }
  }, [item.id])

  const createTextlineAfter = async (
    after: Item | undefined,
    title_text: string = '',
  ): Promise<Item | null> => {
    const order_index = after === undefined ? appendOrder() : orderAfterItem(after)
    try {
      const created = await getRpc().addItem({
        role: 'textline',
        title: title_text,
        parent_id: item.id,
        order_index,
      })
      insertChild(created)
      focusBlock(created.id, 0)
      return created
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
      return null
    }
  }

  const handleSplit = async (current: Item, left: string, right: string) => {
    const order_index = orderAfterItem(current)
    patchChild(current.id, { title: left })
    try {
      await getRpc().updateItem({ id: current.id, data: { title: left } })
      const created = await getRpc().addItem({
        role: 'textline',
        title: right,
        parent_id: item.id,
        order_index,
      })
      insertChild(created)
      focusBlock(created.id, 0)
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
      void loadChildren()
    }
  }

  const handleBackspace = async (current: Item, value: string) => {
    const list = children_ref.current
    const index = list.findIndex(child => child.id === current.id)
    const previous = index > 0 ? list[index - 1] : undefined

    if (previous?.role === 'textline') {
      const merged = mergeTextLine(previous.title, value)
      try {
        await getRpc().updateItem({ id: previous.id, data: { title: merged.title } })
        await getRpc().deleteItem({ id: current.id })
        patchChild(previous.id, { title: merged.title })
        removeChild(current.id)
        focusBlock(previous.id, merged.caret)
      } catch (err) {
        ctx.showError(err instanceof Error ? err.message : String(err))
        void loadChildren()
      }
      return
    }

    if (value.length !== 0) {return}

    try {
      await getRpc().deleteItem({ id: current.id })
      removeChild(current.id)
      setFocusRequest(null)
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
    }
  }

  const createTextlineAtEnd = () => {
    const last = children_ref.current[children_ref.current.length - 1]
    void createTextlineAfter(last)
  }

  const deleteBlock = async (block_id: number) => {
    try {
      await getRpc().deleteItem({ id: block_id })
      removeChild(block_id)
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDrop = (dragged_id: number, target_id: number) => {
    const dragged = children_ref.current.find(child => child.id === dragged_id)
    const target = children_ref.current.find(child => child.id === target_id)
    if (dragged === undefined || target === undefined) {return}

    syncChildren(children_ref.current.map(child => {
      if (child.id === dragged.id) {return { ...child, order_index: target.order_index }}
      if (child.id === target.id) {return { ...child, order_index: dragged.order_index }}
      return child
    }))

    Promise.all([
      getRpc().updateItem({ id: dragged.id, data: { order_index: target.order_index } }),
      getRpc().updateItem({ id: target.id, data: { order_index: dragged.order_index } }),
    ]).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
      void loadChildren()
    })
  }

  const replacePlaceholder = async (
    placeholder: Item,
    created: Item,
  ): Promise<void> => {
    try {
      await getRpc().deleteItem({ id: placeholder.id })
      removeChild(placeholder.id)
      insertChild(created)
      await createTextlineAfter(created)
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
      void loadChildren()
    }
  }

  const insertManga = async (placeholder: Item | null) => {
    const order_index = placeholder === null ? appendOrder() : placeholder.order_index
    try {
      const created = await getRpc().addItem({
        role: 'entity',
        kind: 'manga',
        title: '新漫画',
        parent_id: item.id,
        order_index,
        attributes: { reading_direction: 'rtl' },
      })
      if (placeholder === null) {
        insertChild(created)
        await createTextlineAfter(created)
      } else {
        await replacePlaceholder(placeholder, created)
      }
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
    }
  }

  const openUpload = (kind: UploadKind, placeholder: Item | null) => {
    pending_upload_ref.current = { kind, placeholder }
    const input = kind === 'image' ? image_input_ref.current : file_input_ref.current
    input?.click()
  }

  const insertUploadedFiles = async (
    kind: UploadKind,
    placeholder: Item | null,
    files: File[],
  ) => {
    let anchor: Item | null = placeholder
    let first_created: Item | null = null

    for (const file of files) {
      const order_index = anchor === null ? appendOrder() : (
        anchor.id === placeholder?.id ? placeholder.order_index : orderAfterItem(anchor)
      )
      try {
        const created = kind === 'image'
          ? await createImageItem(file, item.id, order_index)
          : await createFileItem(file, item.id, order_index)

        if (anchor !== null && anchor.id === placeholder?.id) {
          await getRpc().deleteItem({ id: anchor.id })
          removeChild(anchor.id)
        }
        insertChild(created)
        if (first_created === null) {first_created = created}
        anchor = created
      } catch (err) {
        ctx.showError(err instanceof Error ? err.message : String(err))
        void loadChildren()
        break
      }
    }

    if (first_created !== null) {
      await createTextlineAfter(anchor ?? first_created)
    }
  }

  const handleUploadChange = (kind: UploadKind, files: File[]) => {
    const pending = pending_upload_ref.current
    pending_upload_ref.current = null
    if (files.length === 0) {return}
    const placeholder = pending?.kind === kind ? pending.placeholder : null
    void insertUploadedFiles(kind, placeholder, files)
  }

  const handleSlashCommand = (command: SlashCommand, placeholder: Item) => {
    if (command.id === 'image' || command.id === 'file') {
      openUpload(command.id, placeholder)
      return
    }
    if (command.id === 'itemlink') {
      setLinkPlaceholder(placeholder)
      setPicker(true)
      return
    }
    if (command.id === 'manga') {
      void insertManga(placeholder)
    }
  }

  const handlePickedItem = async (target: Item) => {
    const placeholder = link_placeholder
    setLinkPlaceholder(null)
    const order_index = placeholder === null ? appendOrder() : placeholder.order_index
    try {
      const created = await getRpc().addItem({
        role: 'itemlink',
        title: target.title || `#${target.id}`,
        parent_id: item.id,
        order_index,
        target_id: target.id,
      })
      if (placeholder === null) {
        insertChild(created)
        await createTextlineAfter(created)
      } else {
        await replacePlaceholder(placeholder, created)
      }
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
    }
  }

  const addAfter = (block: Item) => {
    void createTextlineAfter(block)
  }

  return (
    <div className="page-full">
      <input
        className="page-title-input"
        value={title}
        placeholder="无标题"
        onChange={ev => scheduleTitle(ev.target.value)}
        onBlur={saveTitle}
        onKeyDown={ev => {
          if (ev.key === 'Enter') {ev.currentTarget.blur()}
        }}
      />

      <div className="page-toolbar">
        <button className="button" onClick={createTextlineAtEnd}>+ 文本行</button>
        <button className="button" onClick={() => openUpload('image', null)}>+ 图片</button>
        <button className="button" onClick={() => openUpload('file', null)}>+ 附件</button>
        <button className="button" onClick={() => {
          setLinkPlaceholder(null)
          setPicker(true)
        }}>+ 链接</button>
        <button className="button" onClick={() => { void insertManga(null) }}>+ 漫画</button>
        <span className="page-toolbar-hint">输入 / 快速插入</span>
        <input
          ref={image_input_ref}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={ev => {
            const files = [...(ev.target.files ?? [])]
            ev.target.value = ''
            handleUploadChange('image', files)
          }}
        />
        <input
          ref={file_input_ref}
          type="file"
          multiple
          hidden
          onChange={ev => {
            const files = [...(ev.target.files ?? [])]
            ev.target.value = ''
            handleUploadChange('file', files)
          }}
        />
      </div>

      <div className="children-list">
        {children === null ? (
          <div className="loading">加载中…</div>
        ) : children.length === 0 ? (
          <button className="empty-editor" onClick={createTextlineAtEnd}>
            <span>点击开始输入</span>
            <small>按 / 插入 block</small>
          </button>
        ) : children.map(child => {
          const module = resolveModule(child)
          const content = child.role === 'textline' ? (
            <TextLineBlock
              item={child}
              ctx={ctx}
              is_active={active_block_id === child.id}
              focus_request={focus_request?.id === child.id ? focus_request.request : null}
              onFocusHandled={() => setFocusRequest(null)}
              onActivate={() => focusBlock(child.id, 'end')}
              onTitleChange={(id, new_title) => patchChild(id, { title: new_title })}
              onSplit={handleSplit}
              onBackspace={handleBackspace}
              onSlashCommand={handleSlashCommand}
            />
          ) : (
            module.Block !== undefined
              ? module.Block(child, ctx)
              : module.Presenter.card(child, ctx)
          )

          return (
            <BlockWrapper
              key={child.id}
              item={child}
              content={content}
              onDropBlock={handleDrop}
              onDelete={() => { void deleteBlock(child.id) }}
              onAddAfter={() => addAfter(child)}
            />
          )
        })}
      </div>

      <div className="page-footer">输入 / 插入 block · Enter 新行 · Shift+Enter 软换行</div>

      {picker && (
        <ItemPicker
          exclude_ids={link_placeholder === null ? [] : [link_placeholder.id]}
          onClose={() => {
            setPicker(false)
            setLinkPlaceholder(null)
          }}
          onSelect={target => {
            setPicker(false)
            void handlePickedItem(target)
          }}
        />
      )}
    </div>
  )
}

export const pageModule: ItemModule = {
  role: 'page',
  Presenter: {
    card: item => <PageCard item={item} />,
    full: (item, ctx) => <PageFull item={item} ctx={ctx} />,
  },
}
