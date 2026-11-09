import { useEffect, useMemo, useRef, useState } from 'react'
import type { Item, ItemID } from '@laibrary/types'
import { parseItemTokens } from '@laibrary/types'
import { InlineText } from './inline-text'
import {
  detectSlashQuery, filterSlashCommands, splitTextLine,
  type SlashCommand,
} from '../lib/textline-editor'
import type { ItemModule, ViewerCtx } from './types'
import { SlashMenu } from './slash-menu'

export type TextLineFocusRequest = {
  caret: number | 'end'
}

export type TextLineBlockProps = {
  item: Item
  ctx: ViewerCtx
  is_active: boolean
  focus_request: TextLineFocusRequest | null
  onFocusHandled: () => void
  onActivate: () => void
  onTitleChange: (id: ItemID, title: string) => void
  onSplit?: (item: Item, left: string, right: string) => void | Promise<void>
  onBackspace?: (item: Item, value: string) => void | Promise<void>
  onSlashCommand?: (command: SlashCommand, item: Item) => void
}

function TextLineEditor({
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
}: TextLineBlockProps) {
  const [value, setValue] = useState(item.title)
  const [slash_query, setSlashQuery] = useState<string | null>(null)
  const [selected_index, setSelectedIndex] = useState(0)
  const [menu_placement, setMenuPlacement] = useState<'up' | 'down'>('down')
  const [menu_max_height, setMenuMaxHeight] = useState(320)
  const timer_ref = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textarea_ref = useRef<HTMLTextAreaElement>(null)
  const write_chain_ref = useRef<Promise<void>>(Promise.resolve())
  const alive_ref = useRef(true)
  const composing_ref = useRef(false)
  const busy_ref = useRef(false)
  const skip_blur_save_ref = useRef(false)
  const was_active_ref = useRef(is_active)
  const value_ref = useRef(item.title)

  const commands = useMemo(
    () => slash_query === null ? [] : filterSlashCommands(slash_query),
    [slash_query],
  )

  useEffect(() => {
    alive_ref.current = true
    return () => {
      alive_ref.current = false
      if (timer_ref.current !== null) {clearTimeout(timer_ref.current)}
    }
  }, [])

  useEffect(() => {
    setValue(item.title)
    value_ref.current = item.title
    setSlashQuery(null)
    skip_blur_save_ref.current = false
  }, [item.id])

  useEffect(() => {
    if (!is_active) {
      setValue(item.title)
      value_ref.current = item.title
      setSlashQuery(null)
    } else if (!was_active_ref.current) {
      // 从只读视图切换到编辑态时，父级可能刚合并/替换了 title。
      setValue(item.title)
      value_ref.current = item.title
    }
    was_active_ref.current = is_active
  }, [is_active, item.title])

  const resize = () => {
    const node = textarea_ref.current
    if (node !== null) {
      node.style.height = '0px'
      node.style.height = `${node.scrollHeight}px`
    }
  }

  useEffect(() => {
    if (is_active) {resize()}
  }, [value, is_active])

  useEffect(() => {
    let settle_timer: number | null = null
    if (is_active && focus_request !== null) {
      const node = textarea_ref.current
      if (node !== null) {
        const caret = focus_request.caret
        node.focus()
        skip_blur_save_ref.current = false
        const position = caret === 'end'
          ? node.value.length
          : Math.max(0, Math.min(caret, node.value.length))
        node.setSelectionRange(position, position)
        resize()
        // Controlled textarea 的值更新可能发生在 focus 之后，用 macrotask 再落一次 caret。
        settle_timer = window.setTimeout(() => {
          if (alive_ref.current) {
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
      if (settle_timer !== null) {
        window.clearTimeout(settle_timer)
      }
    }
  }, [is_active, focus_request, item.id])

  const persist = (title: string): Promise<void> => {
    const run = write_chain_ref.current.then(async () => {
      await ctx.api.rpc.updateItem({ id: item.id, data: { title } })
    })
    write_chain_ref.current = run.catch(error => {
      console.warn('textline save queue', error)
    })
    run.catch(err => {
      if (alive_ref.current) {
        ctx.showError(err instanceof Error ? err.message : String(err))
      }
    })
    return run.catch(() => undefined)
  }

  const cancelTimer = () => {
    if (timer_ref.current !== null) {
      clearTimeout(timer_ref.current)
      timer_ref.current = null
    }
  }

  const scheduleSave = (next: string) => {
    cancelTimer()
    timer_ref.current = setTimeout(() => { void persist(next) }, 400)
  }

  const flushSave = () => {
    cancelTimer()
    void persist(value_ref.current)
  }

  const clearLine = () => {
    cancelTimer()
    value_ref.current = ''
    setValue('')
    onTitleChange(item.id, '')
    setSlashQuery(null)
  }

  const pickCommand = (command: SlashCommand) => {
    if (!busy_ref.current) {
      setSlashQuery(null)
      if (command.id === 'text') {
        clearLine()
        void persist('')
        textarea_ref.current?.focus()
      } else if (onSlashCommand !== undefined) {
        clearLine()
        skip_blur_save_ref.current = true
        busy_ref.current = true
        void (async () => {
          await persist('')
          busy_ref.current = false
          onSlashCommand(command, item)
        })()
      }
    }
  }

  const handleSplit = async () => {
    if (onSplit !== undefined && !busy_ref.current) {
      const node = textarea_ref.current
      if (node !== null) {
        busy_ref.current = true
        const { left, right } = splitTextLine(value_ref.current, node.selectionStart, node.selectionEnd)
        cancelTimer()
        value_ref.current = left
        setValue(left)
        onTitleChange(item.id, left)
        setSlashQuery(null)
        skip_blur_save_ref.current = true
        try {
          await onSplit(item, left, right)
        } finally {
          busy_ref.current = false
        }
      }
    }
  }

  const inactive_view = (
    <div
      className="textline-block"
      onClick={onActivate}
    >
      <div className="textline-view">
        {value.length === 0
          ? <span className="textline-placeholder">输入 / 插入内容</span>
          : <InlineText text={value} ctx={ctx} />}
      </div>
    </div>
  )

  return is_active ? (
    <div className="textline-block is-active">
      <textarea
        ref={textarea_ref}
        className="textline-textarea"
        value={value}
        placeholder="输入 / 插入内容"
        rows={1}
        spellCheck={false}
        onChange={ev => {
          const next = ev.target.value
          value_ref.current = next
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
        }}
        onFocus={() => { skip_blur_save_ref.current = false }}
        onCompositionStart={() => { composing_ref.current = true }}
        onCompositionEnd={() => { composing_ref.current = false }}
        onBlur={() => {
          setSlashQuery(null)
          if (skip_blur_save_ref.current) {
            skip_blur_save_ref.current = false
          } else {
            flushSave()
          }
        }}
        onKeyDown={ev => {
          const composing = composing_ref.current || ev.nativeEvent.isComposing
          if (!composing) {
            let handled = false
            if (slash_query !== null) {
              if (ev.key === 'ArrowDown') {
                ev.preventDefault()
                if (commands.length !== 0) {
                  setSelectedIndex(index => (index + 1) % commands.length)
                }
                handled = true
              } else if (ev.key === 'ArrowUp') {
                ev.preventDefault()
                if (commands.length !== 0) {
                  setSelectedIndex(index => (index - 1 + commands.length) % commands.length)
                }
                handled = true
              } else if ((ev.key === 'Enter' && !ev.shiftKey) || ev.key === 'Tab') {
                ev.preventDefault()
                const command = commands[selected_index]
                if (command !== undefined) {
                  pickCommand(command)
                }
                handled = true
              } else if (ev.key === 'Escape') {
                ev.preventDefault()
                setSlashQuery(null)
                handled = true
              }
            }

            if (!handled) {
              if (ev.key === 'Enter' && !ev.shiftKey) {
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

export function TextLineBlock(props: TextLineBlockProps) {
  return <TextLineEditor {...props} />
}

function TextLineCard({ item }: { item: Item }) {
  const tokens = parseItemTokens(item.title)
  return (
    <div className="card textline-card">
      <div className="card-title">
        {tokens.length === 0
          ? '(空行)'
          : tokens.map((token, index) => token.type === 'text'
            ? <span key={index}>{token.text}</span>
            : <span key={index} className="inline-link-text">@{token.label ?? token.target_id}</span>)}
      </div>
      <div className="card-sub">文本</div>
    </div>
  )
}

function TextLineFull({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const [focus, setFocus] = useState<TextLineFocusRequest | null>({ caret: 'end' })
  return (
    <div className="panel">
      <TextLineBlock
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

export const __TEXTLINE_MODULE__: ItemModule = {
  role: 'textline',
  Presenter: {
    card: item => <TextLineCard item={item} />,
    full: (item, ctx) => <TextLineFull item={item} ctx={ctx} />,
  },
}
