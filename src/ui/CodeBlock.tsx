import { Check, Copy } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { cx } from './cx'
import s from './CodeBlock.module.css'

const KEYWORDS = new Set(
  'def return if elif else for while in not and or class import from as with try except finally raise pass break continue lambda yield is global nonlocal assert del'.split(
    ' ',
  ),
)
const CONSTANTS = new Set(['None', 'True', 'False', 'self'])
const BUILTINS = new Set(
  'len range min max sum sorted enumerate zip map filter list dict set tuple int str float bool abs any all print reversed heapq deque defaultdict Counter collections bisect divmod ord chr'.split(
    ' ',
  ),
)

const TOKEN = /(#.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(\d+(?:\.\d+)?)\b|([A-Za-z_]\w*)|(\s+|.)/gm

/** A small Python highlighter: enough for the field-guide templates, nothing more. */
function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = []
  let previous = ''
  let key = 0
  for (const match of code.matchAll(TOKEN)) {
    const [text, comment, string, number, word] = match
    let cls: string | null = null
    if (comment) cls = s.comment
    else if (string) cls = s.string
    else if (number) cls = s.number
    else if (word) {
      if (KEYWORDS.has(word)) cls = s.keyword
      else if (CONSTANTS.has(word)) cls = s.constant
      else if (previous === 'def' || previous === 'class') cls = s.fn
      else if (BUILTINS.has(word)) cls = s.builtin
    }
    out.push(cls ? <span key={key++} className={cls}>{text}</span> : text)
    if (word) previous = word
    else if (text.trim()) previous = ''
  }
  return out
}

interface CodeBlockProps {
  code: string
  /** A caption over the block. */
  label?: string
  className?: string
}

/** A Python snippet with a copy button. */
export function CodeBlock({ code, label = 'Python', className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const nodes = useMemo(() => highlight(code), [code])

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <figure className={cx(s.block, className)}>
      <figcaption className={s.bar}>
        <span className="eyebrow">{label}</span>
        <button type="button" className={s.copy} onClick={copy} aria-label={copied ? 'Copied' : 'Copy code'}>
          {copied ? <Check /> : <Copy />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </figcaption>
      <pre className={s.pre} tabIndex={0}>
        <code>{nodes}</code>
      </pre>
    </figure>
  )
}
