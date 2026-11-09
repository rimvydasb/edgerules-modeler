import type {StoreContext} from './storeSupport';
import type {ReadmeStore} from './types';

export function createReadmeStore(context: StoreContext): ReadmeStore {
    const listeners = context.listeners();
    let markdown = '';

    function changed(next: string): void {
        markdown = next;
        context.onChange();
        listeners.notify();
    }

    return {
        setMarkdown(next) {
            if (next !== markdown) changed(next);
        },

        exportDocument: () => markdown,

        replaceDocument(document) {
            changed(document);
        },

        subscribe: listeners.subscribe,
    };
}
