import { useCallback, useEffect, useState } from 'react'

export type HashRoute =
  | { name: 'plaza' }
  | { name: 'item'; id: number }
  | { name: 'settings' }

export function parseHash(hash: string): HashRoute {
  const cleaned = hash.replace(/^#\/?/, '')
  const parts = cleaned.split('/').filter(p => p.length > 0)

  if (parts[0] === 'item' && parts[1] !== undefined) {
    const id = Number.parseInt(parts[1] as string)
    if (!Number.isNaN(id)) {
      return { name: 'item', id }
    }
  }
  if (parts[0] === 'settings') {
    return { name: 'settings' }
  }
  return { name: 'plaza' }
}

export function routeToHash(route: HashRoute): string {
  if (route.name === 'item') {
    return `#/item/${route.id}`
  } else if (route.name === 'settings') {
    return '#/settings'
  } else {
    return '#/plaza'
  }
}

export function useHashRoute(): [HashRoute, (route: HashRoute) => void] {
  const [route, setRoute] = useState<HashRoute>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHash(window.location.hash))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((next_route: HashRoute) => {
    window.location.hash = routeToHash(next_route)
  }, [])

  return [route, navigate]
}
