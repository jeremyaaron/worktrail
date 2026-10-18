export function captureDraftFocus(document: Document): () => void {
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const selection = trigger instanceof HTMLTextAreaElement || trigger instanceof HTMLInputElement
    ? { start: trigger.selectionStart, end: trigger.selectionEnd, direction: trigger.selectionDirection } : null;
  return () => {
    if (!trigger?.isConnected) return;
    trigger.focus({ preventScroll: true });
    if (selection !== null && selection.start !== null && selection.end !== null &&
      (trigger instanceof HTMLTextAreaElement || trigger instanceof HTMLInputElement)) {
      trigger.setSelectionRange(selection.start, selection.end, selection.direction ?? undefined);
    }
  };
}
