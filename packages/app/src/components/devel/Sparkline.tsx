interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  className?: string
}

export function Sparkline({ values, width = 80, height = 24, className }: SparklineProps) {
  if (values.length < 2) return null

  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * (height - 2) - 1
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className={className} aria-hidden="true" role="img" aria-label="Sparkline chart">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" points={points} />
    </svg>
  )
}
