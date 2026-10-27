import { parseNoteText } from '@/lib/logic/notesText'

interface LinkifiedTextProps {
  text: string
  className?: string
}

/** Renders note text with line breaks preserved and http(s) links tappable (opened in a new tab). */
export function LinkifiedText({ text, className = '' }: LinkifiedTextProps) {
  return (
    <p dir="auto" className={`whitespace-pre-wrap break-words ${className}`}>
      {parseNoteText(text).map((segment, i) =>
        segment.type === 'link' ? (
          <a
            key={i}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-accent underline underline-offset-2 [overflow-wrap:anywhere]"
          >
            {segment.text}
          </a>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </p>
  )
}
