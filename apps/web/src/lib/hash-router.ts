import { useCallback, useEffect, useState } from 'react'
import type { ItemID } from '@laibrary/types'
import { zItemID } from '@laibrary/types'

export type HashRoute =
  | { name: 'plaza' }
  | { name: 'item'; id: ItemID }
  | { name: 'settings' }

export function hashParse(hash: string): HashRoute {
  const cleaned = hash.replace(/^#\/?/, '')
  const parts = cleaned.split('/').filter(part => part.length > 0)
  const item_id = zItemID.safeParse(Number.parseInt(parts[1] ?? '', 10))

  if (parts[0] === 'item' && item_id.success) {
    return { name: 'item', id: item_id.data }
  } else if (parts[0] === 'settings') {
    return { name: 'settings' }
  } else {
    return { name: 'plaza' }
  }
}

export function hashRouteTo(route: HashRoute): string {
  if (route.name === 'item') {
    return `#/item/${route.id}`
  } else if (route.name === 'settings') {
    return '#/settings'
  } else {
    return '#/plaza'
  }
}

export function useHashRoute(): [HashRoute, (route: HashRoute) => void] {
  const [route, setRoute] = useState<HashRoute>(() => hashParse(window.location.hash))

  useEffect(() => {
    const onHashChange = () => {
      setRoute(hashParse(window.location.hash))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((next_route: HashRoute) => {
    window.location.hash = hashRouteTo(next_route)
  }, [])

  return [route, navigate]
}
