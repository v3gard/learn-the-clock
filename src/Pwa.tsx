import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { Language } from './i18n'
import { ToolbarPanelHeading } from './ToolbarPanelHeading'
import { applyPwaUpdate, dismissOfflineReadyNotice, dismissPwaNotice, getPwaState, retryPwa, subscribePwa } from './pwaRuntime'
import { pwaText } from './pwaText'

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: InstallPromptEvent
  }
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && navigator.standalone === true)
}

export function Pwa({ language }: { language: Language }) {
  const text = pwaText[language]
  const state = useSyncExternalStore(subscribePwa, getPwaState)
  const [standalone, setStandalone] = useState(isStandalone)
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [installFailed, setInstallFailed] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const confirmation = useRef<HTMLDialogElement>(null)
  const updateButton = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    function changed() { setStandalone(isStandalone()) }
    function installed() {
      setPrompt(null)
      panel.current?.hidePopover()
      changed()
    }
    function offered(event: InstallPromptEvent) {
      event.preventDefault()
      setPrompt(event)
    }
    window.addEventListener('beforeinstallprompt', offered)
    window.addEventListener('appinstalled', installed)
    displayMode.addEventListener('change', changed)
    return () => {
      window.removeEventListener('beforeinstallprompt', offered)
      window.removeEventListener('appinstalled', installed)
      displayMode.removeEventListener('change', changed)
    }
  }, [])

  useEffect(() => {
    if (!state.readyNotice) return
    const timeout = window.setTimeout(dismissOfflineReadyNotice, 6000)
    return () => window.clearTimeout(timeout)
  }, [state.readyNotice])

  useEffect(() => {
    const dialog = confirmation.current
    const trigger = updateButton.current
    if (!confirming || !dialog) return
    dialog.showModal()
    cancelButton.current?.focus()
    return () => {
      dialog.close()
      trigger?.focus()
    }
  }, [confirming])

  async function install() {
    if (!prompt) return
    setInstalling(true)
    setInstallFailed(false)
    try {
      await prompt.prompt()
      await prompt.userChoice
    } catch (error) {
      console.warn('Could not open the app installation prompt.', error)
      setInstallFailed(true)
    } finally {
      setPrompt(null)
      setInstalling(false)
    }
  }

  function requestUpdate() {
    document.querySelectorAll<HTMLElement>('.toolbar-panel:popover-open').forEach(item => item.hidePopover())
    setConfirming(true)
  }

  function cancelUpdate() {
    setConfirming(false)
  }

  const message = state.error === 'setup' ? text.setupFailed
    : state.error === 'update' ? text.updateFailed
      : state.error === 'windows' ? text.windows
        : state.updateAvailable ? text.update : state.readyNotice ? text.ready : null
  const canUpdate = state.updateAvailable || state.error === 'windows'

  return <>
    {!standalone && <button type="button" className="icon-button" data-install-control
      popoverTarget="install-panel" aria-label={text.title} title={text.title}
      aria-expanded={open} aria-controls="install-panel" aria-haspopup="dialog"
      onPointerDown={event => event.preventDefault()}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12m-4-4 4 4 4-4M5 15v6h14v-6" />
      </svg>
    </button>}
    {createPortal(<>
      {!standalone && <div ref={panel} id="install-panel" className="toolbar-panel"
        popover="auto" role="dialog" aria-labelledby="install-title" aria-describedby="install-description"
        onToggle={event => {
          const expanded = event.newState === 'open'
          setOpen(expanded)
          if (expanded) panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
        }}>
        <ToolbarPanelHeading titleId="install-title" title={text.title} closeLabel={text.close}
          onClose={() => panel.current?.hidePopover()} />
        <p id="install-description">{text.description}</p>
        <p>{apple ? text.apple : text.browser}</p>
        {prompt && <button type="button" className="pwa-action primary" disabled={installing} onClick={() => void install()}>
          {installing ? text.busy : text.install}
        </button>}
        {installFailed && <p role="alert">{text.installFailed}</p>}
        <p>{text.limitation}</p>
      </div>}
      {message && <aside className="pwa-notice" aria-label={text.title}>
        <p role="status" aria-live="polite">{message}</p>
        {(canUpdate || state.error) && <div className="pwa-actions">
          <button type="button" className="pwa-action" ref={updateButton} disabled={state.busy}
            onClick={() => canUpdate ? requestUpdate() : void retryPwa()}>
            {state.busy ? text.busy : canUpdate ? text.updateAction : text.retry}
          </button>
          <button type="button" className="pwa-action" disabled={state.busy} onClick={dismissPwaNotice}>{text.dismiss}</button>
        </div>}
      </aside>}
      {confirming && <dialog ref={confirmation} className="quiz-dialog pwa-dialog"
        aria-labelledby="pwa-confirm-title" aria-describedby="pwa-confirm-description"
        onCancel={event => { event.preventDefault(); cancelUpdate() }}>
        <h2 id="pwa-confirm-title">{text.confirmTitle}</h2>
        <p id="pwa-confirm-description">{text.confirmDescription}</p>
        <div className="pwa-actions">
          <button type="button" className="pwa-action" onClick={() => {
            setConfirming(false)
            void applyPwaUpdate()
          }}>{text.confirm}</button>
          <button type="button" className="pwa-action" ref={cancelButton} onClick={cancelUpdate}>{text.cancel}</button>
        </div>
      </dialog>}
    </>, document.body)}
  </>
}
