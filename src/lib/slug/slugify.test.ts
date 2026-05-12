import { describe, expect, it } from 'vitest'
import { slugify } from './slugify'

describe('slugify', () => {
  it('lowercases and replaces whitespace with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('collapses consecutive non-alphanumeric runs into a single hyphen', () => {
    expect(slugify('Foo  ___ bar!!! baz')).toBe('foo-bar-baz')
  })

  it('strips leading and trailing hyphens', () => {
    expect(slugify('  --hello world--  ')).toBe('hello-world')
  })

  it('strips diacritics from unicode characters', () => {
    expect(slugify('Café Münster')).toBe('cafe-munster')
    expect(slugify('Crème Brûlée')).toBe('creme-brulee')
  })

  it('replaces non-Latin scripts with hyphens (ASCII-only output)', () => {
    expect(slugify('日本語')).toBe('')
    expect(slugify('Hello 世界')).toBe('hello')
  })

  it('returns an empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })

  it('returns an empty string for whitespace-only input', () => {
    expect(slugify('   \t\n  ')).toBe('')
  })

  it('caps output at the default max length of 64 characters', () => {
    const long = 'a'.repeat(100)
    expect(slugify(long).length).toBe(64)
  })

  it('respects an explicit max length and never leaves a trailing hyphen after the slice', () => {
    expect(slugify('hello-world-foo', 8)).toBe('hello-wo')
    expect(slugify('hello world foo bar', 12)).toBe('hello-world')
  })

  it('handles digits and preserves them', () => {
    expect(slugify('Job 42 — backup #1')).toBe('job-42-backup-1')
  })

  it('produces stable slugs for inputs that differ only in punctuation', () => {
    expect(slugify('Acme, Inc.')).toBe('acme-inc')
    expect(slugify('Acme; Inc.')).toBe('acme-inc')
  })

  it('is idempotent: slugify(slugify(x)) === slugify(x)', () => {
    const inputs = ['Hello World', '  --foo--  ', 'Café', 'Acme, Inc.']
    for (const input of inputs) {
      const once = slugify(input)
      expect(slugify(once)).toBe(once)
    }
  })
})
