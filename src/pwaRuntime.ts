import { isPwaReply } from './pwaMessages'
import type { PwaReply, PwaRequest } from './pwaMessages'
import { readPreference, writePreference } from './preferences'

type PwaError = 'setup' | 'update' | 'windows' | null
type PwaState = {
  readyNotice: boolean
  updateAvailable: boolean
  error: PwaError
  busy: boolean
}

let state: PwaState = { readyNotice: false, updateAvailable: false, error: null, busy: false }
let registration: ServiceWorkerRegistration | undefined
let started = false
let lastUpdateCheck = 0
const listeners = new Set<() => void>()
const watchedWorkers = new WeakSet<ServiceWorker>()
const updateInterval = 60 * 60 * 1000

export function subscribePwa(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getPwaState() {
  return state
}

function publish(change: Partial<PwaState>) {
  state = { ...state, ...change }
  listeners.forEach(listener => listener())
}

export function dismissPwaNotice() {
  publish({ readyNotice: false, updateAvailable: false, error: null })
}

export function dismissOfflineReadyNotice() {
  publish({ readyNotice: false })
}

function fail(kind: Exclude<PwaError, null>, error: unknown) {
  console.warn(`Could not complete PWA ${kind}.`, error)
  publish({ error: kind, busy: false })
}

async function send(worker: ServiceWorker, request: PwaRequest): Promise<PwaReply> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const timeout = window.setTimeout(() => {
      channel.port1.close()
      reject(new Error(`PWA worker did not answer ${request}.`))
    }, 10000)
    channel.port1.onmessage = event => {
      window.clearTimeout(timeout)
      channel.port1.close()
      if (isPwaReply(event.data)) resolve(event.data)
      else reject(new Error('Invalid PWA worker response.'))
    }
    worker.postMessage(request, [channel.port2])
  })
}

async function verifyOfflineReady(worker: ServiceWorker) {
  try {
    if (await send(worker, 'STATUS') !== 'READY') throw new Error('The offline cache is incomplete.')
    if (!readPreference('offlineReadyNotified')) {
      writePreference('offlineReadyNotified', true)
      publish({ readyNotice: true })
    }
  } catch (error) {
    fail('setup', error)
  }
}

function watchInstallation(worker: ServiceWorker) {
  if (watchedWorkers.has(worker)) return
  watchedWorkers.add(worker)
  const isUpdate = !!registration?.active
  let installed = worker.state === 'installed'
  function changed() {
    if (worker.state === 'installed') installed = true
    if (worker.state === 'installed' && isUpdate) publish({ updateAvailable: true, error: null })
    if (worker.state === 'activated' && !isUpdate) void verifyOfflineReady(worker)
    if (worker.state === 'redundant' && !installed) {
      fail(isUpdate ? 'update' : 'setup', new Error('The service worker could not finish installing.'))
    }
    if (worker.state === 'activated' || worker.state === 'redundant') worker.removeEventListener('statechange', changed)
  }
  worker.addEventListener('statechange', changed)
  changed()
}

function updateFound() {
  if (registration?.installing) watchInstallation(registration.installing)
}

async function register() {
  try {
    registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    })
    registration.removeEventListener('updatefound', updateFound)
    registration.addEventListener('updatefound', updateFound)
    if (registration.installing) watchInstallation(registration.installing)
    if (registration.waiting) publish({ updateAvailable: true })
    if (registration.active?.state === 'activated') void verifyOfflineReady(registration.active)
    lastUpdateCheck = Date.now()
  } catch (error) {
    fail('setup', error)
  }
}

async function checkForUpdate(force = false) {
  if (!registration || (!force && Date.now() - lastUpdateCheck < updateInterval)) return
  if (!navigator.onLine && !force) return
  lastUpdateCheck = Date.now()
  try {
    await registration.update()
    if (registration.waiting) publish({ updateAvailable: true })
  } catch (error) {
    // A routine offline check must not interrupt an otherwise working cached app.
    if (navigator.onLine || force) fail('update', error)
  }
}

export function startPwa() {
  if (started || !import.meta.env.PROD || !('serviceWorker' in navigator)) return
  started = true
  void register()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate()
  })
}

export async function retryPwa() {
  const repairCache = state.error === 'setup'
  publish({ error: null, busy: true })
  if (!registration) await register()
  else if (!registration.active && !registration.installing && !registration.waiting) {
    try {
      await registration.unregister()
      // Discard partial first-install data, never a working offline version or another app's cache.
      for (const name of await caches.keys()) {
        if (name.startsWith('learn-the-clock-') && name.endsWith(registration.scope)) await caches.delete(name)
      }
      await register()
    } catch (error) {
      fail('setup', error)
    }
  } else {
    await checkForUpdate(true)
    if (!registration.installing && !registration.waiting && registration.active) {
      try {
        if (repairCache && await send(registration.active, 'REPAIR') !== 'READY') {
          throw new Error('The offline cache could not be restored.')
        }
        await verifyOfflineReady(registration.active)
      } catch (error) {
        fail('setup', error)
      }
    }
  }
  publish({ busy: false })
}

export async function applyPwaUpdate() {
  const waiting = registration?.waiting
  if (!waiting) {
    fail('update', new Error('No waiting update is available.'))
    return
  }
  const worker = waiting
  publish({ busy: true, error: null })
  try {
    const reply = await send(worker, 'APPLY_UPDATE')
    if (reply === 'OTHER_WINDOWS') {
      publish({ busy: false, error: 'windows' })
      return
    }
    if (reply !== 'ACTIVATING') throw new Error('The update could not be activated.')
    // Only this explicitly confirmed window reloads; never react globally to controllerchange.
    await new Promise<void>((resolve, reject) => {
      if (worker.state === 'activated') return resolve()
      const timeout = window.setTimeout(() => {
        worker.removeEventListener('statechange', changed)
        reject(new Error('The update did not finish activating.'))
      }, 10000)
      function changed() {
        if (worker.state !== 'activated' && worker.state !== 'redundant') return
        window.clearTimeout(timeout)
        worker.removeEventListener('statechange', changed)
        if (worker.state === 'activated') resolve()
        else reject(new Error('The update became redundant.'))
      }
      worker.addEventListener('statechange', changed)
    })
    window.location.reload()
  } catch (error) {
    fail('update', error)
  }
}
