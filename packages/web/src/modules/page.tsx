import { useEffect, useRef, useState } from 'react'
import type { Item, ItemID, TextBlockRole } from '@laibrary/types'
import { zItemID, isTextBlockRole } from '@laibrary/types'
import { createFileItem, createImageItem, mediaKindForFile } from '../lib/blob'
import { orderAfter } from '../lib/order'
import { blockCanDelete, blockCanDuplicate } from '../lib/page-blocks'
import { listKindOf, listMarkerFor, todoCheckedOf } from '../lib/text-list'
import { mergeTextBlock, splitTextBlocks, type SlashCommand } from '../lib/text-block-editor'
import { boxFromPoints, boxesIntersect, type Box } from '../lib/marquee'
import type { ItemModule, ViewerCtx } from './types'
import { PageBlock } from './page-block'
import { PageBlockLink, PageCard } from './page-card'
import { usePageTitle } from './page-title'
import { ItemPicker } from './item-picker'
import { ItemIconButton } from './item-icon'
import {
  TextBlock,
  type TextBlockFocusRequest,
} from './text-block'

type FocusRequest = {
  id: ItemID
  request: TextBlockFocusRequest
}

type UploadKind = 'image' | 'file'
type DropIndicator = {
  id: ItemID
  position: 'before' | 'after'
}

type PageHistoryEntry = {
  readonly ids: readonly ItemID[]
  readonly items: readonly Item[]
}

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
  const [drop_indicator, setDropIndicator] = useState<DropIndicator | null>(null)
  const [selected_ids, setSelectedIds] = useState<readonly ItemID[]>([])
  const [selection_anchor_id, setSelectionAnchorId] = useState<ItemID | null>(null)
  const [marquee, setMarquee] = useState<Box | null>(null)
  const marquee_cleanup_ref = useRef<(() => void) | null>(null)
  const [undo_stack, setUndoStack] = useState<readonly PageHistoryEntry[]>([])
  const [redo_stack, setRedoStack] = useState<readonly PageHistoryEntry[]>([])
  const page_ref = useRef<HTMLDivElement>(null)
  const history_busy_ref = useRef(false)
  const structural_undo_ref = useRef(false)
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
    if (children_ref.current.some(existing => existing.id === child.id)) {
      // 已存在，不重复插入。
    } else {
      syncChildren([...children_ref.current, child])
    }
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
    setSelectedIds([])
    setSelectionAnchorId(null)
    setActiveBlockId(id)
    setFocusRequest({ id, request: { caret } })
  }

  const focusPage = () => {
    window.requestAnimationFrame(() => {
      page_ref.current?.focus({ preventScroll: true })
    })
  }

  const clearSelection = () => {
    structural_undo_ref.current = false
    setSelectedIds([])
    setSelectionAnchorId(null)
  }

  const selectOne = (id: ItemID) => {
    structural_undo_ref.current = false
    setActiveBlockId(null)
    setFocusRequest(null)
    setSelectedIds([id])
    setSelectionAnchorId(id)
    focusPage()
  }

  const selectRange = (anchor_id: ItemID, target_id: ItemID) => {
    const list = children_ref.current
    const anchor_index = list.findIndex(child => child.id === anchor_id)
    const target_index = list.findIndex(child => child.id === target_id)
    if (anchor_index >= 0 && target_index >= 0) {
      const start = Math.min(anchor_index, target_index)
      const end = Math.max(anchor_index, target_index)
      setSelectedIds(list.slice(start, end + 1).map(child => child.id))
      setSelectionAnchorId(anchor_id)
      focusPage()
    }
  }

  const deleteSelected = async () => {
    if (selected_ids.length === 0 || history_busy_ref.current) {
      // 没有选择或已有历史操作，忽略。
    } else {
      history_busy_ref.current = true
      const ids = [...selected_ids]
      try {
        const snapshots = await ctx.api.rpc.deleteItems(ids)
        for (const id of ids) {
          removeChild(id)
        }
        setUndoStack(prev => [...prev, { ids, items: snapshots }])
        setRedoStack([])
        clearSelection()
        ctx.refreshSidebar()
      } catch (error) {
        ctx.showError(error instanceof Error ? error.message : String(error))
        void loadChildren()
      } finally {
        history_busy_ref.current = false
      }
    }
  }

  const undoDelete = async () => {
    const entry = undo_stack[undo_stack.length - 1]
    if (entry === undefined || history_busy_ref.current) {
      // 没有可撤销记录。
    } else {
      history_busy_ref.current = true
      try {
        const restored = await ctx.api.rpc.restoreItems(entry.items)
        for (const child of restored) {
          if (child.parent_id === item.id) {
            insertChild(child)
          }
        }
        setUndoStack(prev => prev.slice(0, -1))
        setRedoStack(prev => [...prev, entry])
        clearSelection()
        ctx.refreshSidebar()
      } catch (error) {
        ctx.showError(error instanceof Error ? error.message : String(error))
      } finally {
        history_busy_ref.current = false
      }
    }
  }

  const redoDelete = async () => {
    const entry = redo_stack[redo_stack.length - 1]
    if (entry === undefined || history_busy_ref.current) {
      // 没有可重做记录。
    } else {
      history_busy_ref.current = true
      try {
        const snapshots = await ctx.api.rpc.deleteItems(entry.ids)
        for (const id of entry.ids) {
          removeChild(id)
        }
        setRedoStack(prev => prev.slice(0, -1))
        setUndoStack(prev => [...prev, { ids: entry.ids, items: snapshots }])
        clearSelection()
        ctx.refreshSidebar()
      } catch (error) {
        ctx.showError(error instanceof Error ? error.message : String(error))
      } finally {
        history_busy_ref.current = false
      }
    }
  }

  const handleStructuralUndoCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const modifier = event.metaKey || event.ctrlKey
    if (
      structural_undo_ref.current &&
      event.target instanceof HTMLTextAreaElement &&
      modifier &&
      !event.shiftKey &&
      (event.key === 'z' || event.key === 'Z')
    ) {
      event.preventDefault()
      event.stopPropagation()
      structural_undo_ref.current = false
      void undoDelete()
    }
  }

  const handlePageKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const modifier = event.metaKey || event.ctrlKey
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      // 文本编辑仍使用原生行为。
    } else if (modifier && (event.key === 'z' || event.key === 'Z') && (undo_stack.length !== 0 || redo_stack.length !== 0)) {
      event.preventDefault()
      if (event.shiftKey) {
        void redoDelete()
      } else {
        void undoDelete()
      }
    } else if (selected_ids.length === 0) {
      // 只有选中模式拦截这些键。
    } else {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        moveSelection(
          event.key === 'ArrowUp' ? 'up' : 'down',
          event.shiftKey,
        )
      } else if (event.key === 'Escape') {
        event.preventDefault()
        clearSelection()
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        void deleteSelected()
      }
    }
  }

  const focusAdjacentBlock = (direction: 'up' | 'down', current: Item) => {
    const list = children_ref.current
    const index = list.findIndex(child => child.id === current.id)
    const target = direction === 'up' ? list[index - 1] : list[index + 1]
    if (target !== undefined) {
      if (isTextBlockRole(target.role)) {
        focusBlock(target.id, direction === 'up' ? 'end' : 0)
      } else {
        selectOne(target.id)
      }
      window.requestAnimationFrame(() => {
        document.querySelector(`[data-block-id="${target.id}"]`)?.scrollIntoView({ block: 'nearest' })
      })
    }
  }

  const moveSelection = (direction: 'up' | 'down', extend: boolean) => {
    const list = children_ref.current
    const selected_indexes = selected_ids
      .map(id => list.findIndex(child => child.id === id))
      .filter(index => index >= 0)
    if (selected_indexes.length !== 0) {
      const anchor_id = selection_anchor_id
        ?? selected_ids[selected_indexes.length - 1]
        ?? null
      const anchor_index = anchor_id === null ? -1 : list.findIndex(child => child.id === anchor_id)
      const current_index = (
        extend ? selected_indexes[selected_indexes.length - 1] : selected_indexes[0]
      ) ?? -1
      const next_index = direction === 'up' ? current_index - 1 : current_index + 1
      if (current_index >= 0 && next_index >= 0 && next_index < list.length) {
        const next = list[next_index]
        if (next !== undefined) {
          if (extend && anchor_index >= 0 && anchor_id !== null) {
            selectRange(anchor_id, next.id)
          } else {
            selectOne(next.id)
          }
          window.requestAnimationFrame(() => {
            document.querySelector(`[data-block-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' })
          })
        }
      }
    }
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
          first !== undefined && isTextBlockRole(first.role) &&
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
    setSelectedIds([])
    setSelectionAnchorId(null)
    setUndoStack([])
    setRedoStack([])
    structural_undo_ref.current = false
    void loadChildren(true, true)
    return () => { alive_ref.current = false }
  }, [item.id])
  useEffect(() => {
    const idsInside = (box: Box): ItemID[] => {
      const blocks = [...document.querySelectorAll<HTMLElement>('.children-list .page-block')]
      return blocks.flatMap(block => {
        const raw = block.dataset['blockId']
        const parsed = raw === undefined ? null : zItemID.safeParse(Number(raw))
        if (parsed === null || !parsed.success) {
          return []
        } else {
          const rect = block.getBoundingClientRect()
          const block_box: Box = {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }
          return boxesIntersect(box, block_box) ? [parsed.data] : []
        }
      })
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const in_item = target !== null && target.closest('.item-content') !== null
      const in_page = target !== null && target.closest('.page-full') !== null
      const in_control = target !== null && target.closest('button, input, textarea, select, a') !== null
      const has_modifier = event.shiftKey || event.altKey || event.metaKey || event.ctrlKey
      if (
        event.button !== 0 ||
        target === null ||
        !in_item ||
        in_page ||
        in_control ||
        has_modifier
      ) {
        // 文章内容区、控件和修饰键拖拽都交给浏览器。
      } else {
        event.preventDefault()
        marquee_cleanup_ref.current?.()
        const start_x = event.clientX
        const start_y = event.clientY
        let moved = false
        setSelectedIds([])
        setSelectionAnchorId(null)
        setMarquee(boxFromPoints(start_x, start_y, start_x, start_y))
        focusPage()
        document.body.classList.add('marquee-selecting')
        window.getSelection()?.removeAllRanges()

        const update = (current_x: number, current_y: number) => {
          const box = boxFromPoints(start_x, start_y, current_x, current_y)
          if (box.width > 4 || box.height > 4) {
            moved = true
            setMarquee(box)
            const ids = idsInside(box)
            setSelectedIds(ids)
            setSelectionAnchorId(ids[0] ?? null)
          }
        }
        const cleanup = () => {
          window.removeEventListener('pointermove', onPointerMove)
          window.removeEventListener('pointerup', onPointerUp)
          window.removeEventListener('pointercancel', onPointerCancel)
          window.removeEventListener('blur', onBlur)
          window.removeEventListener('scroll', onScroll, true)
          document.body.classList.remove('marquee-selecting')
          marquee_cleanup_ref.current = null
          setMarquee(null)
        }
        const onPointerMove = (move_event: PointerEvent) => {
          update(move_event.clientX, move_event.clientY)
        }
        const onPointerUp = (up_event: PointerEvent) => {
          update(up_event.clientX, up_event.clientY)
          if (!moved) {
            setSelectedIds([])
            setSelectionAnchorId(null)
          }
          cleanup()
        }
        const onPointerCancel = () => {
          cleanup()
        }
        const onBlur = () => {
          cleanup()
        }
        const onScroll = () => {
          cleanup()
        }
        marquee_cleanup_ref.current = cleanup
        window.addEventListener('pointermove', onPointerMove)
        window.addEventListener('pointerup', onPointerUp)
        window.addEventListener('pointercancel', onPointerCancel)
        window.addEventListener('blur', onBlur)
        window.addEventListener('scroll', onScroll, true)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      marquee_cleanup_ref.current?.()
    }
  }, [item.id])


  const createTextBlockAfter = async (
    after: Item | undefined,
    title_text: string = '',
  ): Promise<Item | null> => {
    const order_index = after === undefined ? appendOrder() : orderAfterItem(after)
    try {
      const created = await ctx.api.rpc.addItem({
        role: 'text-block',
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

  const createTextBlocksAfter = async (
    current: Item,
    titles: readonly string[],
  ): Promise<void> => {
    let previous = current
    let last: Item | null = null
    let failed = false
    for (const title of titles) {
      if (failed) {
        // 保持已经创建成功的 block，后续由 reload 校正。
      } else {
        const order_index = orderAfterItem(previous)
        try {
          const created = await ctx.api.rpc.addItem({
            role: 'text-block',
            title,
            parent_id: item.id,
            order_index,
          })
          insertChild(created)
          previous = created
          last = created
        } catch (err) {
          failed = true
          ctx.showError(err instanceof Error ? err.message : String(err))
          void loadChildren()
        }
      }
    }
    if (last !== null) {
      focusBlock(last.id, last.title.length === 0 ? 0 : 'end')
    }
  }

  const handleSplit = async (current: Item, left: string, right: string) => {
    const order_index = orderAfterItem(current)
    patchChild(current.id, { title: left })
    try {
      await ctx.api.rpc.updateItem({ id: current.id, data: { title: left } })
      const next_role = current.role === 'text-list'
                        ? 'text-list'
                        : (current.role === 'text-todo' ? 'text-todo' : 'text-block')
      const next_attributes = current.role === 'text-list'
                              ? { list_kind: listKindOf(current) }
                              : (current.role === 'text-todo' ? { checked: false } : undefined)
      const created = await ctx.api.rpc.addItem({
        role: next_role,
        title: right,
        parent_id: item.id,
        order_index,
        ...(next_attributes === undefined ? {} : { attributes: next_attributes }),
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

    if (value.length === 0 && (current.role === 'text-list' || current.role === 'text-todo')) {
      try {
        const converted = await ctx.api.rpc.convertTextBlock({
          id: current.id,
          role: 'text-block',
          title: '',
          attributes: {},
        })
        patchChild(converted.id, {
          role: converted.role,
          title: converted.title,
          attributes: converted.attributes,
        })
        focusBlock(converted.id, 'end')
      } catch (err) {
        ctx.showError(err instanceof Error ? err.message : String(err))
        void loadChildren()
      }
    } else if (value.length === 0 && isTextBlockRole(current.role)) {
      if (previous !== undefined && isTextBlockRole(previous.role)) {
        try {
          const snapshots = await ctx.api.rpc.deleteItems([current.id])
          removeChild(current.id)
          setUndoStack(prev => [...prev, { ids: [current.id], items: snapshots }])
          setRedoStack([])
          structural_undo_ref.current = true
          focusBlock(previous.id, 'end')
        } catch (err) {
          ctx.showError(err instanceof Error ? err.message : String(err))
          void loadChildren()
        }
      }
    } else if (previous !== undefined && isTextBlockRole(previous.role)) {
      const merged = mergeTextBlock(previous.title, value)
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
    }
  }

  const createTextBlockAtEnd = () => {
    const last = children_ref.current[children_ref.current.length - 1]
    void createTextBlockAfter(last)
  }

  const deleteBlock = async (block_id: ItemID) => {
    try {
      await ctx.api.rpc.deleteItem({ id: block_id })
      removeChild(block_id)
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
    }
  }

  const duplicateBlock = async (source: Item) => {
    const order_index = orderAfterItem(source)
    try {
      const created = await ctx.api.rpc.addItem({
        role: source.role,
        title: source.title,
        parent_id: item.id,
        order_index,
        attributes: source.attributes,
        tags: source.tags,
        ...(source.kind === null ? {} : { kind: source.kind }),
        ...(source.blob === null ? {} : { blob_id: source.blob.id }),
        ...(source.target_id === null ? {} : { target_id: source.target_id }),
      })
      insertChild(created)
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
    }
  }

  const moveBlock = (source: Item, direction: 'up' | 'down') => {
    const index = children_ref.current.findIndex(child => child.id === source.id)
    const target_index = direction === 'up' ? index - 1 : index + 1
    const target = children_ref.current[target_index]
    if (index < 0 || target === undefined) {
      // 已经在边界，菜单项应当禁用；这里只是防御。
    } else {
      const next = children_ref.current.map((child, child_index) => {
        if (child_index === index) {
          return { ...child, order_index: target.order_index }
        } else if (child_index === target_index) {
          return { ...child, order_index: source.order_index }
        } else {
          return child
        }
      })
      syncChildren(next)
      Promise.all([
        ctx.api.rpc.updateItem({ id: source.id, data: { order_index: target.order_index } }),
        ctx.api.rpc.updateItem({ id: target.id, data: { order_index: source.order_index } }),
      ]).catch(err => {
        ctx.showError(err instanceof Error ? err.message : String(err))
        void loadChildren()
      })
    }
  }

  const handleDrop = (
    dragged_id: ItemID,
    target_id: ItemID,
    position: 'before' | 'after',
  ) => {
    setDropIndicator(null)
    const source = children_ref.current.find(child => child.id === dragged_id)
    const target = children_ref.current.find(child => child.id === target_id)
    if (source !== undefined && target !== undefined) {
      const without = children_ref.current.filter(child => child.id !== source.id)
      const target_index = without.findIndex(child => child.id === target.id)
      if (target_index >= 0) {
        const insert_index = target_index + (position === 'after' ? 1 : 0)
        const before = without[insert_index - 1]
        const after = without[insert_index]
        const order_index = before === undefined
                            ? (after === undefined ? appendOrder() : after.order_index - 1)
                            : (after === undefined ? before.order_index + 1 : orderAfter(before.order_index, after.order_index))
        const next = [...without]
        next.splice(insert_index, 0, { ...source, order_index })
        syncChildren(next)
        ctx.api.rpc.updateItem({
          id: source.id,
          data: { order_index },
        }).catch(err => {
          ctx.showError(err instanceof Error ? err.message : String(err))
          void loadChildren()
        })
      }
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
      await createTextBlockAfter(created)
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
        await createTextBlockAfter(created)
      } else {
        await replacePlaceholder(placeholder, created)
      }
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
    }
  }

  const insertPage = async (placeholder: Item | null, open_after: boolean) => {
    const order_index = placeholder === null ? appendOrder() : placeholder.order_index
    try {
      const created = await ctx.api.rpc.addItem({
        role: 'page',
        title: '新页面',
        parent_id: item.id,
        order_index,
      })
      if (placeholder === null) {
        insertChild(created)
        await createTextBlockAfter(created)
      } else {
        await replacePlaceholder(placeholder, created)
      }
      ctx.refreshSidebar()
      if (open_after) {
        ctx.navigate(created.id)
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
        const order_index = anchor === null
                            ? appendOrder()
                            : (
                                anchor.id === placeholder?.id
                                ? placeholder.order_index
                                : orderAfterItem(anchor)
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
      await createTextBlockAfter(anchor ?? first_created)
    }
  }

  const insertDroppedFiles = async (
    files: File[],
    target_id: ItemID | null,
    position: 'before' | 'after',
  ) => {
    const list = children_ref.current
    const target_index = target_id === null
                         ? -1
                         : list.findIndex(child => child.id === target_id)
    const insert_index = target_index >= 0
                         ? target_index + (position === 'after' ? 1 : 0)
                         : list.length
    let previous = list[insert_index - 1]
    const next = list[insert_index]
    let last_created: Item | undefined
    let upload_failed = false
    for (const file of files) {
      if (upload_failed) {
        // 出错后停止后续文件，保留已经成功的 block。
      } else {
        const order_index = previous === undefined
                            ? (next === undefined ? appendOrder() : next.order_index - 1)
                            : (next === undefined ? previous.order_index + 1 : orderAfter(previous.order_index, next.order_index))
        try {
          const kind = mediaKindForFile(file)
          const created = kind === 'image'
                          ? await createImageItem({ api: ctx.api, file, parent_id: item.id, order_index })
                          : await createFileItem({ api: ctx.api, file, parent_id: item.id, order_index })
          insertChild(created)
          previous = created
          last_created = created
        } catch (err) {
          upload_failed = true
          ctx.showError(err instanceof Error ? err.message : String(err))
          void loadChildren()
        }
      }
    }
    if (last_created !== undefined) {
      await createTextBlockAfter(last_created)
    }
  }

  const insertDroppedText = async (
    text: string,
    target_id: ItemID | null,
    position: 'before' | 'after',
  ): Promise<void> => {
    const blocks = splitTextBlocks(text)
    const list = children_ref.current
    const target_index = target_id === null
                         ? -1
                         : list.findIndex(child => child.id === target_id)
    const insert_index = target_index >= 0
                         ? target_index + (position === 'after' ? 1 : 0)
                         : list.length
    let previous = list[insert_index - 1]
    const next = list[insert_index]
    let last: Item | null = null
    let failed = false
    for (const title of blocks) {
      if (failed) {
        // 保持已经成功的 block，后续由 reload 校正。
      } else {
        const order_index = previous === undefined
                            ? (next === undefined ? appendOrder() : next.order_index - 1)
                            : (next === undefined ? previous.order_index + 1 : orderAfter(previous.order_index, next.order_index))
        try {
          const created = await ctx.api.rpc.addItem({
            role: 'text-block',
            title,
            parent_id: item.id,
            order_index,
          })
          insertChild(created)
          previous = created
          last = created
        } catch (err) {
          failed = true
          ctx.showError(err instanceof Error ? err.message : String(err))
          void loadChildren()
        }
      }
    }
    if (last !== null) {
      focusBlock(last.id, last.title.length === 0 ? 0 : 'end')
    }
  }

  const handlePageDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (
      event.dataTransfer.types.includes('Files') ||
      event.dataTransfer.types.includes('text/plain')
    ) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
  }

  const handlePageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setDropIndicator(null)
    const block = event.target instanceof Element
                  ? event.target.closest<HTMLElement>('.page-block')
                  : null
    const parsed_id = block === null
                      ? null
                      : zItemID.safeParse(Number(block.dataset['blockId']))
    const position = block !== null && event.clientY < block.getBoundingClientRect().top + block.getBoundingClientRect().height / 2
                     ? 'before'
                     : 'after'
    if (event.dataTransfer.files.length !== 0) {
      event.preventDefault()
      const files = [...event.dataTransfer.files]
      if (block !== null && parsed_id !== null && parsed_id.success) {
        void insertDroppedFiles(files, parsed_id.data, position)
      } else {
        void insertDroppedFiles(files, null, 'after')
      }
    } else if (
      event.dataTransfer.types.includes('text/plain') &&
      !event.dataTransfer.types.includes('text/laibrary-block')
    ) {
      event.preventDefault()
      const text = event.dataTransfer.getData('text/plain')
      if (block !== null && parsed_id !== null && parsed_id.success) {
        void insertDroppedText(text, parsed_id.data, position)
      } else {
        void insertDroppedText(text, null, 'after')
      }
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

  const toggleTodo = (target: Item, checked: boolean) => {
    const attributes = { ...target.attributes, checked }
    patchChild(target.id, { attributes })
    ctx.api.rpc.updateItem({ id: target.id, data: { attributes } })
      .catch(err => {
        ctx.showError(err instanceof Error ? err.message : String(err))
        void loadChildren()
      })
  }

  const convertTextBlock = async (
    target: Item,
    role: TextBlockRole,
    title: string,
    attributes?: Readonly<Record<string, unknown>>,
  ): Promise<void> => {
    try {
      const converted = await ctx.api.rpc.convertTextBlock({
        id: target.id,
        role,
        title,
        ...(attributes === undefined ? {} : { attributes }),
      })
      patchChild(converted.id, {
        role: converted.role,
        title: converted.title,
        attributes: converted.attributes,
      })
      focusBlock(converted.id, 'end')
      ctx.refreshSidebar()
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
      void loadChildren()
    }
  }

  const handleSlashCommand = (command: SlashCommand, placeholder: Item) => {
    if (command.id === 'image' || command.id === 'file') {
      openUpload(command.id, placeholder)
    } else if (command.id === 'itemlink') {
      setLinkPlaceholder(placeholder)
      setPicker(true)
    } else if (command.id === 'manga') {
      void insertManga(placeholder)
    } else if (command.id === 'page') {
      void insertPage(placeholder, false)
    } else if (command.id === 'page-open') {
      void insertPage(placeholder, true)
    } else if (command.id === 'heading-1') {
      void convertTextBlock(placeholder, 'text-heading-1', '')
    } else if (command.id === 'heading-2') {
      void convertTextBlock(placeholder, 'text-heading-2', '')
    } else if (command.id === 'heading-3') {
      void convertTextBlock(placeholder, 'text-heading-3', '')
    } else if (command.id === 'list-bullet') {
      void convertTextBlock(placeholder, 'text-list', '', { list_kind: 'bullet' })
    } else if (command.id === 'list-number') {
      void convertTextBlock(placeholder, 'text-list', '', { list_kind: 'number' })
    } else if (command.id === 'list-alpha') {
      void convertTextBlock(placeholder, 'text-list', '', { list_kind: 'alpha' })
    } else if (command.id === 'todo') {
      void convertTextBlock(placeholder, 'text-todo', '', { checked: false })
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
        await createTextBlockAfter(created)
      } else {
        await replacePlaceholder(placeholder, created)
      }
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
    }
  }

  const addAfter = (block: Item) => {
    void createTextBlockAfter(block)
  }

  return (
    <div
      ref={page_ref}
      className="page-full"
      tabIndex={-1}
      onKeyDown={handlePageKeyDown}
      onKeyDownCapture={handleStructuralUndoCapture}
      onDragEnter={handlePageDragOver}
      onDragOver={handlePageDragOver}
      onDrop={handlePageDrop}
    >
      <div className="page-header">
        <ItemIconButton item={item} ctx={ctx} />
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
      </div>

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

      <div className="children-list">
        {children === null ? (
          <div className="loading">加载中…</div>
        ) : children.length === 0 ? (
          <button className="empty-editor" onClick={createTextBlockAtEnd}>
            <span>点击开始输入</span>
            <small>按 / 插入 block</small>
          </button>
        ) : children.map((child, index) => {
          const module = ctx.modules.resolve(child)
          const content = isTextBlockRole(child.role) ? (
            <TextBlock
              item={child}
              ctx={ctx}
              is_active={active_block_id === child.id}
              focus_request={focus_request?.id === child.id ? focus_request.request : null}
              onFocusHandled={() => setFocusRequest(null)}
              onActivate={() => {
                structural_undo_ref.current = false
                focusBlock(child.id, 'end')
              }}
              onTitleChange={(id, new_title) => {
                structural_undo_ref.current = false
                patchChild(id, { title: new_title })
              }}
              onSplit={handleSplit}
              onBackspace={handleBackspace}
              onSlashCommand={handleSlashCommand}
              onMoveBlock={direction => focusAdjacentBlock(direction, child)}
              onSelectBlock={() => selectOne(child.id)}
              onConvertRole={(target, role, title, attributes) => {
                void convertTextBlock(target, role, title, attributes)
              }}
              onPasteBlocks={(target, blocks) => { void createTextBlocksAfter(target, blocks) }}
              marker={listMarkerFor(children, index)}
              todo_checked={todoCheckedOf(child)}
              onToggleTodo={checked => toggleTodo(child, checked)}
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
              can_duplicate={blockCanDuplicate(child)}
              can_delete={blockCanDelete(child)}
              can_move_up={index > 0}
              can_move_down={index < children.length - 1}
              onDropBlock={handleDrop}
              onDragOverBlock={position => setDropIndicator({ id: child.id, position })}
              onDragLeaveBlock={() => {
                setDropIndicator(current => current?.id === child.id ? null : current)
              }}
              onDragEndBlock={() => setDropIndicator(null)}
              drop_position={drop_indicator?.id === child.id ? drop_indicator.position : null}
              drag_anywhere={child.role === 'image'}
              selected={selected_ids.includes(child.id)}
              onSelect={() => selectOne(child.id)}
              onDuplicate={() => { void duplicateBlock(child) }}
              onMove={direction => moveBlock(child, direction)}
              onDelete={() => { void deleteBlock(child.id) }}
              onAddAfter={() => addAfter(child)}
            />
          )
        })}
      </div>

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

      {marquee !== null && (
        <div
          className="marquee-box"
          style={{
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height,
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
  Block: (item, ctx) => <PageBlockLink item={item} ctx={ctx} />,
}
