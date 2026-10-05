/**
 * Spectrum elements own their size, colour, border and type. Callers still pass utility classes
 * written for native elements (h-8, text-xs, px-3, border...). Only classes that place the
 * element in its parent (width, flex/grid placement, margins, positioning) are kept.
 */
const LAYOUT_CLASS =
  /^(?:(?:sm|md|lg|xl|2xl|max-[a-z]+|min-[a-z]+|hover|focus|disabled|group-[a-z-]+|peer-[a-z-]+|data-\[[^\]]+\]|aria-[a-z-]+):)*-?(?:w|min-w|max-w|flex|grow|shrink|basis|col|row|m|mx|my|mt|mr|mb|ml|self|justify-self|order|hidden|block|inline|inline-block|inline-flex|absolute|relative|fixed|sticky|top|left|right|bottom|inset|z|shrink-0|grow-0|shrink|col-span|row-span|sr-only)(?:-.*)?$/

export function layoutClasses(className?: string) {
  if (!className) return undefined
  const kept = className.split(/\s+/).filter((token) => token && LAYOUT_CLASS.test(token))

  return kept.length ? kept.join(" ") : undefined
}

