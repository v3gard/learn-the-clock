import { cacheNames, clientsClaim, setCacheNameDetails } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, getCacheKeyForURL, precacheAndRoute } from 'workbox-precaching'
import type { PrecacheEntry } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import type { PwaReply, PwaRequest } from './src/pwaMessages'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (PrecacheEntry | string)[] }

setCacheNameDetails({ prefix: 'learn-the-clock' })
const manifest = self.__WB_MANIFEST
precacheAndRoute(manifest)
cleanupOutdatedCaches()
clientsClaim()

const scopePath = new URL(self.registration.scope).pathname
registerRoute(new NavigationRoute(createHandlerBoundToURL(`${scopePath}index.html`), {
  allowlist: [new RegExp(`^${scopePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)],
}))

self.addEventListener('message', event => {
  const request: unknown = event.data
  const port = event.ports[0]
  if (!port || (request !== 'STATUS' && request !== 'REPAIR' && request !== 'APPLY_UPDATE')) return

  event.waitUntil(handleRequest(request, event.source).then(reply => {
    port.postMessage(reply)
  }).catch(error => {
    console.error('Could not complete PWA worker request.', error)
    port.postMessage('ERROR' satisfies PwaReply)
  }))
})

async function handleRequest(request: PwaRequest, source: ExtendableMessageEvent['source']): Promise<PwaReply> {
  if (request === 'STATUS' || request === 'REPAIR') {
    const cache = await caches.open(cacheNames.precache)
    for (const entry of manifest) {
      const key = getCacheKeyForURL(typeof entry === 'string' ? entry : entry.url)
      if (!key) return 'INCOMPLETE'
      if (await cache.match(key)) continue
      if (request !== 'REPAIR') return 'INCOMPLETE'
      if (typeof entry === 'string' || !entry.integrity) throw new Error('Missing integrity for offline cache repair.')
      // Never store a newer deployment's HTML under an older version's cache key.
      const response = await fetch(key, { cache: 'reload', credentials: 'same-origin', integrity: entry.integrity })
      if (!response.ok) throw new Error(`Could not restore offline asset: ${entry.url}`)
      await cache.put(key, response)
    }
    return 'READY'
  }

  const windows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
    .filter(client => new URL(client.url).origin === self.location.origin
      && new URL(client.url).pathname.startsWith(scopePath))
  // The waiting worker, not a stale tab count in the UI, authorizes activation.
  if (!source || !('id' in source) || windows.some(client => client.id !== source.id)) return 'OTHER_WINDOWS'
  await self.skipWaiting()
  return 'ACTIVATING'
}
