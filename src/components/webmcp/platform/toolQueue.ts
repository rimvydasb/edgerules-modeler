/** Runs one task at a time, in arrival order. A task that fails does not stop the tasks after it. */
export interface ToolQueue {
    run<T>(task: () => Promise<T>): Promise<T>;
}

export function createToolQueue(): ToolQueue {
    let tail: Promise<unknown> = Promise.resolve();
    return {
        run(task) {
            const result = tail.then(task);
            // The next task waits for this one to settle, whether it fulfils or rejects.
            tail = result.catch(() => undefined);
            return result;
        },
    };
}
