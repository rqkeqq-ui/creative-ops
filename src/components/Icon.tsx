import type { SVGProps } from 'react'

export type IconName =
  | 'board'
  | 'plus'
  | 'chart'
  | 'logout'
  | 'spark'
  | 'clock'
  | 'calendar'
  | 'check'
  | 'alert'
  | 'arrow-right'
  | 'search'
  | 'coins'
  | 'user'
  | 'link'
  | 'layers'
  | 'target'
  | 'refresh'
  | 'shield'
  | 'flame'
  | 'inbox'

const PATHS: Record<IconName, string[]> = {
  board: ['M4 4h6v16H4zM14 4h6v9h-6zM14 17h6v3h-6z'],
  plus: ['M12 5v14M5 12h14'],
  chart: ['M4 20V10M10 20V4M16 20v-7M22 20H2'],
  logout: ['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l-5-5 5-5M15 12H5'],
  spark: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  calendar: ['M4 5h16v16H4z', 'M4 10h16M9 3v4M15 3v4'],
  check: ['M20 6 9 17l-5-5'],
  alert: ['M12 3 2 20h20z', 'M12 9v5M12 17h.01'],
  'arrow-right': ['M5 12h14M13 6l6 6-6 6'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  coins: ['M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3z', 'M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5', 'M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21c0-3.3 3.6-6 8-6s8 2.7 8 6'],
  link: ['M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1', 'M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1'],
  layers: ['M12 2 2 7l10 5 10-5z', 'M2 17l10 5 10-5M2 12l10 5 10-5'],
  target: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
  refresh: ['M3 12a9 9 0 0 1 15-6.7L21 8', 'M21 4v4h-4', 'M21 12a9 9 0 0 1-15 6.7L3 16', 'M3 20v-4h4'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  flame: ['M12 22c4 0 7-2.7 7-6.5 0-4-3-6.2-4.5-9.5-1 2-2 3-3.5 4C10 11 10 9 9 7c-1.5 3-4 4.5-4 8.5C5 19.3 8 22 12 22z'],
  inbox: ['M3 12h5l2 3h4l2-3h5', 'M5 5h14l2 7v7H3v-7z'],
}

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  )
}