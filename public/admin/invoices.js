// Invoices tab. Thin wrapper over the shared document list/editor.
import { loadDocList } from './doc-list.js';

export function load() { return loadDocList('invoice'); }
