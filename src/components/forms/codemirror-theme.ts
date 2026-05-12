import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

const baseTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
      fontSize: '12px',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-content': {
      caretColor: 'var(--primary)',
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      padding: '8px 10px',
    },
    '.cm-line': {
      padding: '0',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--muted-foreground)',
      border: 'none',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--primary)',
    },
    '.cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'color-mix(in oklch, var(--primary) 25%, transparent)',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: 'color-mix(in oklch, var(--primary) 35%, transparent)',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--popover)',
      color: 'var(--popover-foreground)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      boxShadow: '0 4px 12px color-mix(in oklch, var(--foreground) 18%, transparent)',
      fontSize: '12px',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul': {
      fontFamily: 'inherit',
      maxHeight: '14em',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
      padding: '4px 8px',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'var(--accent)',
      color: 'var(--accent-foreground)',
    },
    '.cm-completionLabel': {
      color: 'var(--foreground)',
    },
    '.cm-completionDetail': {
      color: 'var(--muted-foreground)',
      fontStyle: 'normal',
      marginLeft: '8px',
    },
    '.cm-completionMatchedText': {
      color: 'var(--primary)',
      textDecoration: 'none',
      fontWeight: '600',
    },
    '.cm-tooltip.cm-tooltip-hover': {
      padding: '6px 8px',
    },
    '.cm-diagnostic': {
      borderLeftWidth: '3px',
      borderLeftStyle: 'solid',
      padding: '4px 8px',
    },
    '.cm-diagnostic-error': {
      borderLeftColor: 'var(--destructive)',
    },
    '.cm-diagnostic-warning': {
      borderLeftColor: 'var(--warning)',
    },
    '.cm-diagnostic-info': {
      borderLeftColor: 'var(--info)',
    },
    '.cm-lintRange-error': {
      backgroundImage:
        'linear-gradient(45deg, transparent 65%, var(--destructive) 80%, transparent 90%), linear-gradient(135deg, transparent 65%, var(--destructive) 80%, transparent 90%)',
      backgroundRepeat: 'repeat-x',
      backgroundSize: '6px 3px',
      backgroundPosition: 'left bottom',
    },
    '.cm-lintRange-warning': {
      backgroundImage:
        'linear-gradient(45deg, transparent 65%, var(--warning) 80%, transparent 90%), linear-gradient(135deg, transparent 65%, var(--warning) 80%, transparent 90%)',
      backgroundRepeat: 'repeat-x',
      backgroundSize: '6px 3px',
      backgroundPosition: 'left bottom',
    },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
      backgroundColor: 'color-mix(in oklch, var(--primary) 20%, transparent)',
      color: 'inherit',
    },
  },
  { dark: true },
)

const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword], color: 'var(--info)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--success)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--chart-4)' },
  { tag: [t.variableName, t.propertyName], color: 'var(--foreground)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--primary)' },
  { tag: [t.tagName, t.angleBracket], color: 'var(--primary)' },
  { tag: [t.attributeName], color: 'var(--info)' },
  { tag: [t.attributeValue], color: 'var(--success)' },
  {
    tag: [t.comment, t.lineComment, t.blockComment],
    color: 'var(--muted-foreground)',
    fontStyle: 'italic',
  },
  { tag: [t.punctuation, t.bracket, t.paren, t.brace], color: 'var(--muted-foreground)' },
  { tag: [t.meta, t.processingInstruction], color: 'var(--warning)' },
  { tag: [t.invalid], color: 'var(--destructive)' },
])

export const boopTheme = [baseTheme, syntaxHighlighting(highlightStyle)]
