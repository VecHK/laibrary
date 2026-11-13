import { useEffect, useMemo, useRef, useState } from 'react'
import type { Item, ItemID, TextBlockRole } from '@laibrary/types'
import { headingLevelOfRole, parseItemTokens } from '@laibrary/types'
import { InlineText } from './inline-text'
import { caretAtVisualEdge } from '../lib/caret-edge'
import {
  detectHeadingShortcut, detectListShortcut, detectSlashQuery, filterSlashCommands, orderSlashCommands,
  splitTextBlock, splitTextBlocks,
  type SlashCommand,
} from '../lib/text-block-editor'
import type { ItemModule, ViewerCtx } from './types'
import { SlashMenu } from './slash-menu'

export type TextBlockFocusRequest = {
  caret: number | 'end'
}

export type TextBlockProps = {
  item: Item
  ctx: ViewerCtx
  is_active: boolean
  focus_request: TextBlockFocusRequest | null
  onFocusHandled: () => void
  onActivate: () => void
  onTitleChange: (id: ItemID, title: string) => void
  onSplit?: (item: Item, left: string, right: string) => void | Promise<void>
  onBackspace?: (item: Item, value: string) => void | Promise<void>
  onSlashCommand?: (command: SlashCommand, item: Item) => void
  onMoveBlock?: (direction: 'up' | 'down', item: Item) => void
  onSelectBlock?: (item: Item) => void
  onConvertRole?: (item: Item, role: TextBlockRole, title: string, attributes?: Readonly<Record<string, unknown>>) => void
  onPasteBlocks?: (item: Item, blocks: readonly string[]) => void
  marker?: string | null | undefined
  todo_checked?: boolean | undefined
  onToggleTodo?: ((checked: boolean) => void) | undefined
}

function TextBlockEditor({
  item,
  ctx,
  is_active,
  focus_request,
  onFocusHandled,
  onActivate,
  onTitleChange,
  onSplit,
  onBackspace,
  onSlashCommand,
  onMoveBlock,
  onSelectBlock,
  onConvertRole,
  onPasteBlocks,
  marker,
  todo_checked,
  onToggleTodo,
}: TextBlockProps) {
  const [value, setValue] = useState(item.title)
  const [slash_query, setSlashQuery] = useState<string | null>(null)
  const [selected_index, setSelectedIndex] = useState(0)
  const [menu_placement, setMenuPlacement] = useState<'up' | 'down'>('down')
  const [menu_max_height, setMenuMaxHeight] = useState(320)
  const $timer_ref = useRef<ReturnType<typeof setTimeout> | null>(null)
  const $textarea_ref = useRef<HTMLTextAreaElement>(null)
  const $write_chain_ref = useRef<Promise<void>>(Promise.resolve())
  const $alive_ref = useRef(true)
  const $composing_ref = useRef(false)
  const $busy_ref = useRef(false)
  const $skip_blur_save_ref = useRef(false)
  const $was_active_ref = useRef(is_active)
  const $value_ref = useRef(item.title)

  const commands = useMemo(
    () => slash_query === null ? [] : orderSlashCommands(filterSlashCommands(slash_query)),
    [slash_query],
  )

  useEffect(() => {
    $alive_ref.current = true
    return () => {
      $alive_ref.current = false
      if ($timer_ref.current !== null) {clearTimeout($timer_ref.current)}
    }
  }, [])

  useEffect(() => {
    setValue(item.title)
    $value_ref.current = item.title
    setSlashQuery(null)
    $skip_blur_save_ref.current = false
  }, [item.id])

  useEffect(() => {
    if (!is_active) {
      setValue(item.title)
      $value_ref.current = item.title
      setSlashQuery(null)
    } else if (!$was_active_ref.current) {
      // 从只读视图切换到编辑态时，父级可能刚合并/替换了 title。
      setValue(item.title)
      $value_ref.current = item.title
    }
    $was_active_ref.current = is_active
  }, [is_active, item.title])

  const resize = () => {
    const node = $textarea_ref.current
    if (node !== null) {
      node.style.height = '0px'
      node.style.height = `${node.scrollHeight}px`
    }
  }

  useEffect(() => {
    if (is_active) {resize()}
  }, [value, is_active])

  useEffect(() => {
    let $_settle_timer: number | null = null
    if (is_active && focus_request !== null) {
      const node = $textarea_ref.current
      if (node !== null) {
        const caret = focus_request.caret
        node.focus()
        $skip_blur_save_ref.current = false
        const position = caret === 'end'
                         ? node.value.length
                         : Math.max(0, Math.min(caret, node.value.length))
        node.setSelectionRange(position, position)
        resize()
        // Controlled textarea 的值更新可能发生在 focus 之后，用 macrotask 再落一次 caret。
        $_settle_timer = window.setTimeout(() => {
          if ($alive_ref.current) {
            const settled = caret === 'end'
                            ? node.value.length
                            : Math.max(0, Math.min(caret, node.value.length))
            node.setSelectionRange(settled, settled)
            onFocusHandled()
          }
        }, 0)
      }
    }
    return () => {
      if ($_settle_timer !== null) {
        window.clearTimeout($_settle_timer)
      }
    }
  }, [is_active, focus_request, item.id])

  const persist = (title: string): Promise<void> => {
    const run = $write_chain_ref.current.then(async () => {
      await ctx.api.rpc.updateItem({ id: item.id, data: { title } })
    })
    $write_chain_ref.current = run.catch(error => {
      console.warn('text-block save queue', error)
    })
    run.catch(err => {
      if ($alive_ref.current) {
        ctx.showError(err instanceof Error ? err.message : String(err))
      }
    })
    return run.catch(() => undefined)
  }

  const cancelTimer = () => {
    if ($timer_ref.current !== null) {
      clearTimeout($timer_ref.current)
      $timer_ref.current = null
    }
  }

  const scheduleSave = (next: string) => {
    cancelTimer()
    $timer_ref.current = setTimeout(() => { void persist(next) }, 400)
  }

  const flushSave = () => {
    cancelTimer()
    void persist($value_ref.current)
  }

  const clearLine = () => {
    cancelTimer()
    $value_ref.current = ''
    setValue('')
    onTitleChange(item.id, '')
    setSlashQuery(null)
  }

  const pickCommand = (command: SlashCommand) => {
    if (!$busy_ref.current) {
      setSlashQuery(null)
      if (command.id === 'text') {
        clearLine()
        void persist('')
        $textarea_ref.current?.focus()
      } else if (onSlashCommand !== undefined) {
        clearLine()
        $skip_blur_save_ref.current = true
        $busy_ref.current = true
        void (async () => {
          await persist('')
          $busy_ref.current = false
          onSlashCommand(command, item)
        })()
      }
    }
  }

  const handleSplit = async () => {
    if (onSplit !== undefined && !$busy_ref.current) {
      const node = $textarea_ref.current
      if (node !== null) {
        $busy_ref.current = true
        const { left, right } = splitTextBlock($value_ref.current, node.selectionStart, node.selectionEnd)
        cancelTimer()
        $value_ref.current = left
        setValue(left)
        onTitleChange(item.id, left)
        setSlashQuery(null)
        $skip_blur_save_ref.current = true
        try {
          await onSplit(item, left, right)
        } finally {
          $busy_ref.current = false
        }
      }
    }
  }

  const activateIfNoSelection = () => {
    const selection = window.getSelection()
    if (selection === null || selection.isCollapsed || selection.toString().length === 0) {
      onActivate()
    }
  }

  const is_todo = item.role === 'text-todo'
  const has_prefix = is_todo || (marker !== null && marker !== undefined)
  const root_class = [
    'text-block',
    item.role,
    value.length === 0 ? 'is-empty' : '',
    has_prefix ? 'has-prefix' : '',
    is_todo && todo_checked === true ? 'is-checked' : '',
  ].filter(part => part.length !== 0).join(' ')

  const prefix = (
    is_todo ? (
      <input
        type="checkbox"
        className="text-block-checkbox"
        checked={todo_checked === true}
        aria-label="切换完成状态"
        onMouseDown={ev => { ev.stopPropagation() }}
        onClick={ev => { ev.stopPropagation() }}
        onChange={ev => { onToggleTodo?.(ev.target.checked) }}
      />
    ) : (
      marker === null || marker === undefined ? null : (
        <span className="text-block-marker" aria-hidden="true">{marker}</span>
      )
    )
  )

  const inactive_view = (
    <div
      className={root_class}
      onClick={activateIfNoSelection}
    >
      {prefix}
      <div className="text-block-view">
        {value.length === 0 ? null : <InlineText text={value} ctx={ctx} />}
      </div>
    </div>
  )

  return is_active ? (
    <div className={root_class}>
      {prefix}
      <textarea
        ref={$textarea_ref}
        className="text-block-textarea"
        value={value}
        placeholder="按 / 插入内容"
        rows={1}
        spellCheck={false}
        onChange={ev => {
          const next = ev.target.value
          const heading_shortcut = detectHeadingShortcut(next, item.role)
          const list_shortcut = detectListShortcut(next, item.role)
          if (heading_shortcut !== null && onConvertRole !== undefined) {
            cancelTimer()
            $value_ref.current = heading_shortcut.title
            setValue(heading_shortcut.title)
            onTitleChange(item.id, heading_shortcut.title)
            setSlashQuery(null)
            onConvertRole(item, heading_shortcut.role, heading_shortcut.title)
          } else if (list_shortcut !== null && onConvertRole !== undefined) {
            cancelTimer()
            $value_ref.current = list_shortcut.title
            setValue(list_shortcut.title)
            onTitleChange(item.id, list_shortcut.title)
            setSlashQuery(null)
            onConvertRole(
              item,
              list_shortcut.role,
              list_shortcut.title,
              list_shortcut.role === 'text-list'
              ? { list_kind: list_shortcut.list_kind }
              : { checked: false },
            )
          } else {
            $value_ref.current = next
            setValue(next)
            onTitleChange(item.id, next)
            scheduleSave(next)
            const query = onSlashCommand === undefined
                          ? null
                          : detectSlashQuery(next, ev.target.selectionStart)
            setSlashQuery(query)
            if (query !== null) {
              const rect = ev.currentTarget.getBoundingClientRect()
              const above = rect.top - 12
              const below = window.innerHeight - rect.bottom - 12
              const open_up = below < 280 && above > below
              setMenuPlacement(open_up ? 'up' : 'down')
              setMenuMaxHeight(Math.min(320, Math.max(120, open_up ? above : below)))
              setSelectedIndex(0)
            }
          }
        }}
        onPaste={ev => {
          const text = ev.clipboardData.getData('text/plain')
          if (onPasteBlocks !== undefined && (text.includes('\n') || text.includes('\r'))) {
            ev.preventDefault()
            const blocks = splitTextBlocks(text)
            const first = blocks[0]
            if (first !== undefined) {
              const node = ev.currentTarget
              const start = node.selectionStart
              const end = node.selectionEnd
              const next = value.slice(0, start) + first + value.slice(end)
              cancelTimer()
              $value_ref.current = next
              setValue(next)
              onTitleChange(item.id, next)
              scheduleSave(next)
              const rest = blocks.slice(1)
              if (rest.length !== 0) {
                onPasteBlocks(item, rest)
              }
              window.requestAnimationFrame(() => {
                const caret = start + first.length
                node.setSelectionRange(caret, caret)
              })
            }
          }
        }}
        onFocus={() => { $skip_blur_save_ref.current = false }}
        onCompositionStart={() => { $composing_ref.current = true }}
        onCompositionEnd={() => { $composing_ref.current = false }}
        onBlur={() => {
          setSlashQuery(null)
          if ($skip_blur_save_ref.current) {
            $skip_blur_save_ref.current = false
          } else {
            flushSave()
          }
        }}
        onKeyDown={ev => {
          const composing = $composing_ref.current || ev.nativeEvent.isComposing
          if (!composing) {
            let $handled = false
            if (slash_query !== null) {
              if (ev.key === 'ArrowDown') {
                ev.preventDefault()
                if (commands.length !== 0) {
                  setSelectedIndex(index => (index + 1) % commands.length)
                }
                $handled = true
              } else if (ev.key === 'ArrowUp') {
                ev.preventDefault()
                if (commands.length !== 0) {
                  setSelectedIndex(index => (index - 1 + commands.length) % commands.length)
                }
                $handled = true
              } else if ((ev.key === 'Enter' && !ev.shiftKey) || ev.key === 'Tab') {
                ev.preventDefault()
                const command = commands[selected_index]
                if (command !== undefined) {
                  pickCommand(command)
                }
                $handled = true
              } else if (ev.key === 'Escape') {
                ev.preventDefault()
                setSlashQuery(null)
                $handled = true
              }
            }

            if (!$handled) {
              if (
                (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') &&
                !ev.shiftKey &&
                !ev.altKey &&
                !ev.metaKey &&
                !ev.ctrlKey &&
                onMoveBlock !== undefined &&
                caretAtVisualEdge(ev.currentTarget, ev.key === 'ArrowUp' ? 'start' : 'end')
              ) {
                ev.preventDefault()
                onMoveBlock(ev.key === 'ArrowUp' ? 'up' : 'down', item)
              } else if (ev.key === 'Escape' && onSelectBlock !== undefined) {
                ev.preventDefault()
                onSelectBlock(item)
              } else if (ev.key === 'Enter' && !ev.shiftKey) {
                if (onSplit !== undefined) {
                  ev.preventDefault()
                  void handleSplit()
                }
              } else if (
                ev.key === 'Backspace' &&
                ev.currentTarget.selectionStart === 0 &&
                ev.currentTarget.selectionEnd === 0 &&
                onBackspace !== undefined
              ) {
                ev.preventDefault()
                cancelTimer()
                setSlashQuery(null)
                void onBackspace(item, value)
              }
            }
          }
        }}
        onSelect={ev => {
          if (slash_query !== null) {
            const query = detectSlashQuery(value, ev.currentTarget.selectionStart)
            if (query === null) {setSlashQuery(null)}
          }
        }}
      />
      {slash_query !== null && (
        <SlashMenu
          commands={commands}
          selected_index={selected_index}
          query={slash_query}
          placement={menu_placement}
          max_height={menu_max_height}
          onSelectIndex={setSelectedIndex}
          onPick={pickCommand}
        />
      )}
    </div>
  ) : inactive_view
}

export function TextBlock(props: TextBlockProps) {
  return <TextBlockEditor {...props} />
}

function TextBlockCard({ item }: { item: Item }) {
  const tokens = parseItemTokens(item.title)
  const level = headingLevelOfRole(item.role)
  return (
    <div className="card text-block-card">
      <div className="card-title">
        {tokens.length === 0
         ? '(空行)'
         : tokens.map((token, index) => token.type === 'text'
                                        ? <span key={index}>{token.text}</span>
                                        : <span key={index} className="inline-link-text">@{token.label ?? token.target_id}</span>)}
      </div>
      <div className="card-sub">{level === null ? '文本' : `${level} 级标题`}</div>
    </div>
  )
}

function TextBlockFull({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const [focus, setFocus] = useState<TextBlockFocusRequest | null>({ caret: 'end' })
  return (
    <div className="panel">
      <TextBlock
        item={item}
        ctx={ctx}
        is_active
        focus_request={focus}
        onFocusHandled={() => setFocus(null)}
        onActivate={() => undefined}
        onTitleChange={() => undefined}
      />
    </div>
  )
}

export const __TEXT_BLOCK_MODULE__: ItemModule = {
  role: 'text-block',
  Presenter: {
    card: item => <TextBlockCard item={item} />,
    full: (item, ctx) => <TextBlockFull item={item} ctx={ctx} />,
  },
}
