import type { SVGProps } from "react"

// The Studio presets describe things Spectrum's icon set has no glyph for (furniture, floors,
// walls, ceilings). These are drawn to the same spec as the design system's own icons: 24 grid,
// 1.5 stroke, round caps, currentColor. Each preset has a distinct, literal shape.
const PATHS: Record<string, string[]> = {
  // sofa crossed out
  "remove-furniture": [
    "M5 11V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2",
    "M3 14a2 2 0 0 1 4 0v1.5h10V14a2 2 0 0 1 4 0v4H3z",
    "M3 3l18 18",
  ],
  // paint roller
  "fresh-paint": ["M4 4h13v5H4z", "M17 6.5h3v5l-8 2V16", "M11 16h2v5h-2z"],
  // house with a sparkle: renovating the place
  renovate: ["M3 11l9-7 9 7", "M5 10v10h14V10", "M12 12.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"],
  // sofa
  furnish: ["M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3", "M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2z", "M5 18v2", "M19 18v2"],
  // brick wall
  "wall-covering": ["M3 5h18v14H3z", "M3 9.7h18", "M3 14.3h18", "M9 5v4.7", "M15 9.7v4.6", "M9 14.3V19"],
  // floor in perspective
  flooring: ["M2 20 7 8h10l5 12z", "M12 8v12", "M4.5 14h15", "M9.5 8 7 20", "M14.5 8 17 20"],
  // pendant lamp under the ceiling
  ceiling: ["M3 4h18", "M12 4v5", "M8 9h8l1.5 5h-11z", "M10 17.5h4"],
}

export type PresetIconName = keyof typeof PATHS

export function PresetIcon({ preset, size = 18, ...rest }: { preset: string; size?: number } & Omit<SVGProps<SVGSVGElement>, "width" | "height">) {
  const paths = PATHS[preset] ?? PATHS.renovate

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icon=""
      {...rest}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
