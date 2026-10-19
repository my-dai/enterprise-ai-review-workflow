// Smooth text selection in pdf.js text layers, ported from pdf.js's TextLayerBuilder.
// Without it, starting a drag in the empty space beside a line anchors the selection at the end of the page,
// so everything below the cursor gets selected. An "endOfContent" element covers the layer while selecting and
// is moved next to the selection's moving end, giving the browser a sensible anchor.
const layers = new Map<HTMLElement, HTMLDivElement>();
let listening: AbortController | null = null;
let prevRange: Range | null = null;
let nativeSelectionIsFine: boolean | undefined;

const reset = (end: HTMLDivElement, layer: HTMLElement) => {
  layer.append(end);
  end.style.width = '';
  end.style.height = '';
  end.style.userSelect = '';
  layer.classList.remove('selecting');
};

function listen() {
  if (listening) return;
  listening = new AbortController();
  const { signal } = listening;
  let pointerDown = false;
  document.addEventListener('pointerdown', () => { pointerDown = true; }, { signal });
  document.addEventListener('pointerup', () => { pointerDown = false; layers.forEach(reset); }, { signal });
  window.addEventListener('blur', () => { pointerDown = false; layers.forEach(reset); }, { signal });
  document.addEventListener('keyup', () => { if (!pointerDown) layers.forEach(reset); }, { signal });
  document.addEventListener('selectionchange', () => {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) { layers.forEach(reset); return; }
    const active = new Set<HTMLElement>();
    for (let i = 0; i < selection.rangeCount; i += 1) {
      const range = selection.getRangeAt(i);
      for (const layer of layers.keys()) if (range.intersectsNode(layer)) active.add(layer);
    }
    for (const [layer, end] of layers) {
      if (active.has(layer)) layer.classList.add('selecting');
      else reset(end, layer);
    }
    // Like pdf.js, skip moving the element in Firefox and Chromium 148+, which anchor these selections natively.
    if (nativeSelectionIsFine === undefined) {
      const first = layers.keys().next().value;
      nativeSelectionIsFine = Boolean(first) && getComputedStyle(first!).getPropertyValue('-moz-user-select') === 'none';
      if (!nativeSelectionIsFine) {
        const version = /\bChrome\/(\d+)\b/.exec(navigator.userAgent)?.[1];
        nativeSelectionIsFine = Boolean(version) && Number(version) >= 148;
      }
    }
    if (nativeSelectionIsFine) return;
    const range = selection.getRangeAt(0);
    const modifyStart = prevRange && (range.compareBoundaryPoints(Range.END_TO_END, prevRange) === 0 || range.compareBoundaryPoints(Range.START_TO_END, prevRange) === 0);
    let anchor: Node | null = modifyStart ? range.startContainer : range.endContainer;
    if (anchor.nodeType === Node.TEXT_NODE) anchor = anchor.parentNode;
    if (anchor && !modifyStart && range.endOffset === 0) {
      do {
        while (anchor && !anchor.previousSibling) anchor = anchor.parentNode;
        anchor = anchor?.previousSibling ?? null;
      } while (anchor && !anchor.childNodes.length);
    }
    const layer = anchor?.parentElement?.closest<HTMLElement>('[data-pdf-text-layer]');
    const end = layer ? layers.get(layer) : undefined;
    if (anchor && layer && end) {
      end.style.width = layer.style.width;
      end.style.height = layer.style.height;
      end.style.userSelect = 'text';
      anchor.parentElement!.insertBefore(end, modifyStart ? anchor : anchor.nextSibling);
    }
    prevRange = range.cloneRange();
  }, { signal });
}

// Call after the text layer has rendered; returns a cleanup function.
export function enableSmoothSelection(layer: HTMLElement): () => void {
  const end = document.createElement('div');
  end.className = 'endOfContent';
  layer.append(end);
  const onMouseDown = () => layer.classList.add('selecting');
  layer.addEventListener('mousedown', onMouseDown);
  layers.set(layer, end);
  listen();
  return () => {
    layer.removeEventListener('mousedown', onMouseDown);
    end.remove();
    layers.delete(layer);
    if (!layers.size) { listening?.abort(); listening = null; prevRange = null; }
  };
}
