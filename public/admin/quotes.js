// Quotes tab. Thin wrapper over the shared document list/editor.
import { loadDocList } from './doc-list.js';
import { openDocEditor } from './doc-form.js';

export function load() { return loadDocList('quote'); }

// Called from the Leads tab ("Create quote from lead").
export function openQuoteEditor(opts = {}) {
  return openDocEditor('quote', { ...opts, onSaved: opts.onSaved || load });
}
