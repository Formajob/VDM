'use client'

interface GaugeChartProps {
  shiftPercent: number
  pausePercent: number
  lunchPercent: number
  otherPercent: number
}

export default function GaugeChart({ 
  shiftPercent, 
  pausePercent, 
  lunchPercent, 
  otherPercent 
}: GaugeChartProps) {
  const total = shiftPercent + pausePercent + lunchPercent + otherPercent
  if (total === 0) return null

  const radius = 80
  const strokeWidth = 20
  const center = 100
  const circumference = 2 * Math.PI * radius
  
  let currentOffset = 0
  const segments = [
    { percent: shiftPercent, color: '#6366f1', label: 'Shift', dash: '#818cf8' },
    { percent: pausePercent, color: '#f59e0b', label: 'Pause', dash: '#fbbf24' },
    { percent: lunchPercent, color: '#f97316', label: 'Lunch', dash: '#fdba74' },
    { percent: otherPercent, color: '#8b5cf6', label: 'Autres', dash: '#a78bfa' },
  ]

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-slate-50 rounded-xl">
      <div className="relative">
        <svg width="200" height="200" className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
          />
          
          {/* Segments */}
          {segments.map((segment, index) => {
            if (segment.percent === 0) return null
            const strokeDasharray = `${(segment.percent / 100) * circumference} ${circumference}`
            const strokeDashoffset = -currentOffset
            currentOffset += (segment.percent / 100) * circumference
            
            return (
              <circle
                key={index}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500"
              />
            )
          })}
          
          {/* Center text */}
          <g className="transform rotate-90">
            <text x="100" y="90" textAnchor="middle" className="text-2xl font-bold fill-slate-700">
              {shiftPercent.toFixed(0)}%
            </text>
            <text x="100" y="110" textAnchor="middle" className="text-xs fill-slate-500">
              Shift
            </text>
          </g>
        </svg>
      </div>
      
      {/* Legend */}
      <div className="grid grid-cols-2 gap-3 w-full">
        {segments.map((segment, index) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-xs text-muted-foreground">
              {segment.label}: {segment.percent.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}