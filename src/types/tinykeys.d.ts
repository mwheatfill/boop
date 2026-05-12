// tinykeys 3.0.0 ships .d.ts at the root but omits a "types" entry from
// its package.json "exports" field, so TypeScript can't resolve it under
// strict module resolution. This shim re-declares the public surface we use
// until upstream fixes the exports.

declare module 'tinykeys' {
  export interface KeyBindingMap {
    [keybinding: string]: (event: KeyboardEvent) => void
  }

  export interface KeyBindingHandlerOptions {
    timeout?: number
  }

  export interface KeyBindingOptions extends KeyBindingHandlerOptions {
    event?: 'keydown' | 'keyup'
    capture?: boolean
  }

  export function tinykeys(
    target: Window | HTMLElement,
    keyBindingMap: KeyBindingMap,
    options?: KeyBindingOptions,
  ): () => void
}
