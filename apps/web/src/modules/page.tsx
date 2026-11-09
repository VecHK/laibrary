import { useEffect, useRef, useState } from 'react'
import type { Item, ItemID } from '@laibrary/types'
import { createFileItem, createImageItem } from '../lib/blob'
import { orderAfter } from '../lib/order'
import { mergeTextLine, type SlashCommand } from '../lib/textline-editor'
import type { ItemModule, ViewerCtx } from './types'
import { PageBlock } from './page-block'
import { PageCard } from './page-card'
import { usePageTitle } from './page-title'
import { ItemPicker } from './item-picker'
import {
  TextLineBlock,
  type TextLineFocusRequest,
} from './textline'

type FocusRequest = {
  id: ItemID
  request: TextLineFocusRequest
}

type UploadKind = 'image' | 'file'

function sortChildren(items: Item[]): Item[] {
  return [...items].sort((a, b) => (
    a.order_index - b.order_index || a.id - b.id
  ))
}

function PageFull({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const [children, setChildren] = useState<Item[] | null>(null)
  const children_ref = useRef<Item[]>([])
  const [active_block_id, setActiveBlockId] = useState<ItemID | null>(null)
  const [focus_request, setFocusRequest] = useState<FocusRequest | null>(null)
  const [picker, setPicker] = useState(false)
  const [link_placeholder, setLinkPlaceholder] = useState<Item | null>(null)
  const [title, scheduleTitle, saveTitle] = usePageTitle(item, ctx)
  const alive_ref = useRef(true)
  const pending_upload_ref = useRef<{ kind: UploadKind, placeholder: Item | null } | null>(null)
  const image_input_ref = useRef<HTMLInputElement>(null)
  const file_input_ref = useRef<HTMLInputElement>(null)

  const syncChildren = (next: Item[]) => {
    const sorted = sortChildren(next)
    children_ref.current = sorted
    setChildren(sorted)
  }

  const patchChild = (id: ItemID, patch: Partial<Item>) => {
    syncChildren(children_ref.current.map(child => (
      child.id === id ? { ...child, ...patch } : child
    )))
  }

  const insertChild = (child: Item) => {
    if (children_ref.current.some(existing => existing.id === child.id)) {return}
    syncChildren([...children_ref.current, child])
  }

  const removeChild = (id: ItemID) => {
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
    return orderAfter(item.order_index, next === undefined ? null : next.order_index)
  }

  const focusBlock = (id: ItemID, caret: number | 'end') => {
    setActiveBlockId(id)
    setFocusRequest({ id, request: { caret } })
  }

  const loadChildren = async (
    show_loading: boolean = false,
    auto_focus_first: boolean = false,
  ) => {
    if (show_loading) {setChildren(null)}
    try {
      const list = await ctx.api.rpc.listing({
        limit: 0,
        sort_by: 'order_index',
        filter_rules: [{ name: 'parent', input: item.id, logic: 'and' }],
      })
      if (alive_ref.current) {
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
      const created = await ctx.api.rpc.addItem({
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
      await ctx.api.rpc.updateItem({ id: current.id, data: { title: left } })
      const created = await ctx.api.rpc.addItem({
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
        await ctx.api.rpc.updateItem({ id: previous.id, data: { title: merged.title } })
        await ctx.api.rpc.deleteItem({ id: current.id })
        patchChild(previous.id, { title: merged.title })
        removeChild(current.id)
        focusBlock(previous.id, merged.caret)
      } catch (err) {
        ctx.showError(err instanceof Error ? err.message : String(err))
        void loadChildren()
      }
    } else if (value.length === 0) {
      try {
        await ctx.api.rpc.deleteItem({ id: current.id })
        removeChild(current.id)
        setFocusRequest(null)
      } catch (err) {
        ctx.showError(err instanceof Error ? err.message : String(err))
      }
    }
  }

  const createTextlineAtEnd = () => {
    const last = children_ref.current[children_ref.current.length - 1]
    void createTextlineAfter(last)
  }

  const deleteBlock = async (block_id: ItemID) => {
    try {
      await ctx.api.rpc.deleteItem({ id: block_id })
      removeChild(block_id)
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDrop = (dragged_id: ItemID, target_id: ItemID) => {
    const dragged = children_ref.current.find(child => child.id === dragged_id)
    const target = children_ref.current.find(child => child.id === target_id)
    if (dragged !== undefined && target !== undefined) {
      syncChildren(children_ref.current.map(child => {
        if (child.id === dragged.id) {
          return { ...child, order_index: target.order_index }
        } else if (child.id === target.id) {
          return { ...child, order_index: dragged.order_index }
        } else {
          return child
        }
      }))

      Promise.all([
        ctx.api.rpc.updateItem({ id: dragged.id, data: { order_index: target.order_index } }),
        ctx.api.rpc.updateItem({ id: target.id, data: { order_index: dragged.order_index } }),
      ]).catch(err => {
        ctx.showError(err instanceof Error ? err.message : String(err))
        void loadChildren()
      })
    }
  }

  const replacePlaceholder = async (
    placeholder: Item,
    created: Item,
  ): Promise<void> => {
    try {
      await ctx.api.rpc.deleteItem({ id: placeholder.id })
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
      const created = await ctx.api.rpc.addItem({
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
    let upload_failed = false

    for (const file of files) {
      if (upload_failed) {
        // 出错后不再继续上传，等待当前批次收尾。
      } else {
        const order_index = anchor === null ? appendOrder() : (
          anchor.id === placeholder?.id ? placeholder.order_index : orderAfterItem(anchor)
        )
        try {
          const created = kind === 'image'
            ? await createImageItem({ api: ctx.api, file, parent_id: item.id, order_index })
            : await createFileItem({ api: ctx.api, file, parent_id: item.id, order_index })

          if (anchor !== null && anchor.id === placeholder?.id) {
            await ctx.api.rpc.deleteItem({ id: anchor.id })
            removeChild(anchor.id)
          }
          insertChild(created)
          if (first_created === null) {first_created = created}
          anchor = created
        } catch (err) {
          upload_failed = true
          ctx.showError(err instanceof Error ? err.message : String(err))
          void loadChildren()
        }
      }
    }

    if (first_created !== null) {
      await createTextlineAfter(anchor ?? first_created)
    }
  }

  const handleUploadChange = (kind: UploadKind, files: File[]) => {
    const pending = pending_upload_ref.current
    pending_upload_ref.current = null
    if (files.length !== 0) {
      const placeholder = pending?.kind === kind ? pending.placeholder : null
      void insertUploadedFiles(kind, placeholder, files)
    }
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
      const created = await ctx.api.rpc.addItem({
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
          const module = ctx.modules.resolve(child)
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
            <PageBlock
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
          ctx={ctx}
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

export const __PAGE_MODULE__: ItemModule = {
  role: 'page',
  Presenter: {
    card: item => <PageCard item={item} />,
    full: (item, ctx) => <PageFull item={item} ctx={ctx} />,
  },
}
