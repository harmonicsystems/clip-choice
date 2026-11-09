// Arrow-key movement between tiles by on-screen position, so it works for any
// grid width (window size, zoom) without knowing the column count.

export function nextIndex(rects, current, dir) {
  const here = rects[current]
  if (!here) return 0
  const cx = here.left + here.width / 2
  const cy = here.top + here.height / 2
  let best = -1
  let bestScore = Infinity
  rects.forEach((r, i) => {
    if (i === current) return
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    const dx = x - cx
    const dy = y - cy
    const along = { left: -dx, right: dx, up: -dy, down: dy }[dir]
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx)
    if (along <= 1) return
    // Prefer staying in the same row/column; distance breaks ties.
    const score = across * 3 + along
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  })
  return best === -1 ? current : best
}

export const ARROWS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
