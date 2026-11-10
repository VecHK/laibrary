type CaretEdge = 'start' | 'end'

function copyTextStyles(source: HTMLTextAreaElement, target: HTMLDivElement): void {
  const style = window.getComputedStyle(source)
  target.style.boxSizing = 'content-box'
  target.style.width = `${source.clientWidth}px`
  target.style.fontFamily = style.fontFamily
  target.style.fontSize = style.fontSize
  target.style.fontWeight = style.fontWeight
  target.style.fontStyle = style.fontStyle
  target.style.letterSpacing = style.letterSpacing
  target.style.lineHeight = style.lineHeight
  target.style.tabSize = style.tabSize
  target.style.whiteSpace = 'pre-wrap'
  target.style.overflowWrap = 'break-word'
  target.style.wordBreak = style.wordBreak
  target.style.padding = style.padding
  target.style.border = '0'
  target.style.position = 'fixed'
  target.style.left = '-100000px'
  target.style.top = '0'
  target.style.visibility = 'hidden'
  target.style.pointerEvents = 'none'
}

function marker(text: string): HTMLSpanElement {
  const node = document.createElement('span')
  node.textContent = text
  return node
}

export function caretAtVisualEdge(textarea: HTMLTextAreaElement, edge: CaretEdge): boolean {
  if (textarea.selectionStart !== textarea.selectionEnd) {
    return false
  } else {
    const caret = textarea.selectionStart
    const mirror = document.createElement('div')
    copyTextStyles(textarea, mirror)

    const first = marker('\u200b')
    const caret_marker = marker('\u200b')
    const last = marker('\u200b')
    mirror.append(
      first,
      document.createTextNode(textarea.value.slice(0, caret)),
      caret_marker,
      document.createTextNode(textarea.value.slice(caret)),
      last,
    )
    document.body.appendChild(mirror)
    const caret_top = caret_marker.offsetTop
    const first_top = first.offsetTop
    const last_top = last.offsetTop
    document.body.removeChild(mirror)

    if (edge === 'start') {
      return caret_top <= first_top
    } else {
      return caret_top >= last_top
    }
  }
}
