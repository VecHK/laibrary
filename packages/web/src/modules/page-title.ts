import { useEffect, useRef, useState } from 'react'
import type { Item } from '@laibrary/types'
import type { ViewerCtx } from './types'

export function usePageTitle(item: Item, ctx: ViewerCtx) {
  const [value, setValue] = useState(item.title)
  const $timer_ref = useRef<ReturnType<typeof setTimeout> | null>(null)
  const $value_ref = useRef(item.title)

  useEffect(() => {
    setValue(item.title)
    $value_ref.current = item.title
  }, [item.title, item.id])

  const save = () => {
    if ($timer_ref.current !== null) {
      clearTimeout($timer_ref.current)
      $timer_ref.current = null
    }
    ctx.api.rpc.updateItem({ id: item.id, data: { title: $value_ref.current } })
      .then(() => ctx.refreshSidebar())
      .catch(error => ctx.showError(error instanceof Error ? error.message : String(error)))
  }

  useEffect(() => () => {
    if ($timer_ref.current !== null) {
      clearTimeout($timer_ref.current)
      $timer_ref.current = null
      ctx.api.rpc.updateItem({ id: item.id, data: { title: $value_ref.current } })
        .then(() => ctx.refreshSidebar())
        .catch(error => { console.warn('page title save on unmount', error) })
    }
  }, [item.id])

  const scheduleSave = (new_value: string) => {
    setValue(new_value)
    $value_ref.current = new_value
    if ($timer_ref.current !== null) {
      clearTimeout($timer_ref.current)
    }
    $timer_ref.current = setTimeout(() => {
      $timer_ref.current = null
      ctx.api.rpc.updateItem({ id: item.id, data: { title: $value_ref.current } })
        .then(() => ctx.refreshSidebar())
        .catch(error => ctx.showError(error instanceof Error ? error.message : String(error)))
    }, 400)
  }

  return [value, scheduleSave, save] as const
}
