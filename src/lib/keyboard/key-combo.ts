// Platform-aware key combo rendering. `$mod` is tinykeys' cross-platform
// modifier; this helper maps it (and the four named modifiers) to the
// canonical glyphs operators expect on each platform.

const MAC_GLYPHS: Record<string, string> = {
  $mod: '⌘',
  Mod: '⌘',
  Meta: '⌘',
  Cmd: '⌘',
  Command: '⌘',
  Ctrl: '⌃',
  Control: '⌃',
  Alt: '⌥',
  Option: '⌥',
  Shift: '⇧',
  Enter: '↵',
  Escape: 'Esc',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backspace: '⌫',
}

const NON_MAC_GLYPHS: Record<string, string> = {
  $mod: 'Ctrl',
  Mod: 'Ctrl',
  Meta: 'Win',
}

export function isMac(
  platform = typeof navigator === 'undefined' ? '' : navigator.platform,
): boolean {
  return platform.toLowerCase().includes('mac')
}

export function formatKeyToken(token: string, mac = isMac()): string {
  if (mac && MAC_GLYPHS[token]) return MAC_GLYPHS[token]
  if (!mac && NON_MAC_GLYPHS[token]) return NON_MAC_GLYPHS[token]
  return token.length === 1 ? token.toUpperCase() : token
}

/**
 * Split a tinykeys combo into rendered tokens.
 * `"$mod+k"` → on macOS `["⌘", "K"]`; on others `["Ctrl", "K"]`.
 * `"g j"` (sequence) → `["G", "J"]`.
 */
export function renderKeyCombo(combo: string, mac = isMac()): string[] {
  if (!combo) return []
  if (combo.includes(' ')) {
    return combo.split(' ').map((seq) =>
      seq
        .split('+')
        .map((t) => formatKeyToken(t, mac))
        .join(''),
    )
  }
  return combo.split('+').map((t) => formatKeyToken(t, mac))
}

/** Space-joined form for inline display surfaces like CommandShortcut. */
export function formatKeyCombo(combo: string, mac = isMac()): string {
  return renderKeyCombo(combo, mac).join(' ')
}
