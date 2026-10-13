type ToolbarPanelHeadingProps = {
  titleId: string
  title: string
  closeLabel: string
  onClose: () => void
}

export function ToolbarPanelHeading({ titleId, title, closeLabel, onClose }: ToolbarPanelHeadingProps) {
  return <div className="toolbar-panel-heading">
    <h2 id={titleId}>{title}</h2>
    <button type="button" className="icon-button" aria-label={closeLabel} onClick={onClose}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    </button>
  </div>
}
