interface ProgressRingProps {
  percent: number
  size?: number
  strokeWidth?: number
  label?: string
}

export function ProgressRing({ percent, size = 56, strokeWidth = 5, label }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-surface-sunken"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-accent transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span className="absolute text-sm font-semibold tabular-nums text-ink">{label ?? `${Math.round(clamped)}%`}</span>
    </div>
  )
}
