export type EditorEventHandler = (...args: unknown[]) => void;

export class EventEmitter {
  private handlers: Map<string, Set<EditorEventHandler>> = new Map();

  on(event: string, handler: EditorEventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: EditorEventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  once(event: string, handler: EditorEventHandler): void {
    const wrapper: EditorEventHandler = (...args: unknown[]) => {
      this.off(event, wrapper);
      handler(...args);
    };
    this.on(event, wrapper);
  }

  emit(event: string, ...args: unknown[]): void {
    this.handlers.get(event)?.forEach((handler) => {
      handler(...args);
    });
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }
}
