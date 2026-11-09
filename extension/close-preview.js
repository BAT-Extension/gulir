// A close request never carries a target ID. Chrome authenticates the sender.
// Keep this queue in the service worker, so overlapping previews cannot both
// decide to remove the last browser tab from the same stale snapshot.
export const CLOSE_PREVIEW = 'gulir:close-preview';
export function createPreviewCloser(api) {
  let queue = Promise.resolve();
  const previewUrl = api.runtime.getURL('preview.html');
  const isPreview = value => {
    try {
      const url = new URL(value), expected = new URL(previewUrl);
      return url.protocol === expected.protocol && url.host === expected.host && url.pathname === expected.pathname;
    } catch { return false; }
  };
  async function close(sender) {
    if (sender?.id !== api.runtime.id || sender.frameId !== 0 || !sender.documentId ||
        !Number.isInteger(sender.tab?.id) || sender.tab.id < 0 || !isPreview(sender.url)) return false;
    const tabId = sender.tab.id;
    const contexts = await api.runtime.getContexts({contextTypes:['TAB']});
    const ownsDocument = items => items.some(context => context.documentId === sender.documentId &&
      context.tabId === tabId && context.frameId === 0 && context.documentUrl === sender.url);
    if (!ownsDocument(contexts)) return false;
    const current = await api.tabs.get(tabId);
    // URL fields may be redacted without the broad tabs permission. The live
    // extension document above is the authority; any visible mismatch is fatal.
    if (current.windowId !== sender.tab.windowId ||
        (current.url !== undefined && current.url !== sender.url) ||
        (current.pendingUrl !== undefined && current.pendingUrl !== sender.url)) return false;
    const previewIds = new Set(contexts.filter(context => isPreview(context.documentUrl)).map(context => context.tabId));
    const windows = await api.windows.getAll({populate:true});
    const hasNormalTab = windows.some(window => window.type === 'normal' && window.tabs?.some(tab =>
      Number.isInteger(tab.id) && tab.id !== tabId && !previewIds.has(tab.id)));
    if (!hasNormalTab) {
      // A popup/another expiring preview is not a safe browser survivor. Create
      // and verify a normal New Tab before removing the last preview instead.
      const created = await api.windows.create({type:'normal',url:'chrome://newtab/',focused:false});
      if (!Number.isInteger(created?.id)) return false;
      const survivor = await api.windows.get(created.id,{populate:true});
      if (survivor.type !== 'normal' || !survivor.tabs?.some(tab => Number.isInteger(tab.id) && tab.id !== tabId)) return false;
    }
    // A navigation while awaiting the safety checks cancels the close request.
    if (!ownsDocument(await api.runtime.getContexts({documentIds:[sender.documentId],contextTypes:['TAB']}))) return false;
    await api.tabs.remove(tabId);
    return true;
  }
  return sender => {
    const pending = queue.then(() => close(sender));
    queue = pending.catch(() => {});
    return pending;
  };
}
