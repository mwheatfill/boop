import { describe, expect, it } from 'vitest'
import { renderKeyCombo } from './key-combo'

describe('renderKeyCombo', () => {
  it('renders $mod+k as two glyph tokens on macOS', () => {
    expect(renderKeyCombo('$mod+k', true)).toEqual(['⌘', 'K'])
  })

  it('renders $mod+k as Ctrl + K on non-Mac', () => {
    expect(renderKeyCombo('$mod+k', false)).toEqual(['Ctrl', 'K'])
  })

  it('renders Shift+Enter as separate platform glyphs on macOS', () => {
    expect(renderKeyCombo('Shift+Enter', true)).toEqual(['⇧', '↵'])
  })

  it('renders chord sequence as separate tokens', () => {
    expect(renderKeyCombo('g j', true)).toEqual(['G', 'J'])
    expect(renderKeyCombo('g j', false)).toEqual(['G', 'J'])
  })

  it('renders single letters uppercased', () => {
    expect(renderKeyCombo('r', true)).toEqual(['R'])
  })

  it('renders ? as ?', () => {
    expect(renderKeyCombo('?', true)).toEqual(['?'])
  })

  it('renders Escape as Esc', () => {
    expect(renderKeyCombo('Escape', true)).toEqual(['Esc'])
  })

  it('returns empty array for empty combo', () => {
    expect(renderKeyCombo('', true)).toEqual([])
  })
})
