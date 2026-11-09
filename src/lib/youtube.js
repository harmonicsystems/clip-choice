// YouTube IFrame Player API, loaded on demand. The only network calls the
// app makes are to YouTube, and only when a clip is played or tested.

let apiPromise = null

export function loadYouTubeAPI(timeoutMs = 8000) {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      apiPromise = null // allow a retry later (network may come back)
      reject(new Error('timeout'))
    }, timeoutMs)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer)
      prev?.()
      resolve(window.YT)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.onerror = () => {
      clearTimeout(timer)
      s.remove()
      apiPromise = null
      reject(new Error('blocked'))
    }
    document.head.appendChild(s)
  })
  return apiPromise
}

// Creates a player that plays [start, end) once and calls onEnd exactly once,
// either on ENDED or when currentTime reaches end (YouTube's own `end` can
// leave the player paused on the last frame with suggestions showing).
// onError(reason) is called if the video won't play; reason is a short,
// clinician-facing explanation (see REASONS). Returns { destroy }.
export const REASONS = {
  blocked: 'YouTube didn’t load. This network or device may block YouTube — try the same clip on another network.',
  2: 'The link isn’t a valid YouTube video. Check the link in Setup.',
  5: 'The browser couldn’t play this video. Try another clip, or update Chrome.',
  100: 'This video was removed or made private. Pick a different upload.',
  101: 'The owner doesn’t allow this video to play inside other sites. Pick a different upload of the clip.',
  150: 'The owner doesn’t allow this video to play inside other sites. Pick a different upload of the clip.',
  153: 'YouTube rejected the player setup (error 153). This needs a fix in the app.',
  stalled: 'The YouTube player never finished loading. The network may be slow or filtered.'
}
const reasonFor = (code) => REASONS[code] || `YouTube error ${code}.`

export async function playClip(el, { videoId, start, end, onEnd, onError, onPlaying, onWaiting }) {
  let done = false
  let poll = null
  let player = null
  let startTimer = null
  let waitTimer = null

  const finish = (fn) => {
    if (done) return
    done = true
    clearInterval(poll)
    clearTimeout(startTimer)
    clearTimeout(waitTimer)
    try {
      player?.destroy()
    } catch {
      /* already gone */
    }
    fn?.()
  }

  let YT
  try {
    YT = await loadYouTubeAPI()
  } catch {
    finish(() => onError?.(REASONS.blocked))
    return { destroy: () => finish(), play: () => {} }
  }
  if (done) return { destroy: () => {}, play: () => {} }

  // Only a player that never gets ready counts as a failure. Once ready,
  // pre-roll ads can hold the real video back for 30s or more, so a slow
  // start is reported with onWaiting (clinician hint), not as an error.
  startTimer = setTimeout(() => finish(() => onError?.(REASONS.stalled)), 20000)
  player = new YT.Player(el, {
    host: 'https://www.youtube-nocookie.com',
    videoId,
    width: '100%',
    height: '100%',
    playerVars: {
      start: Math.floor(start),
      end: Math.ceil(end),
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      rel: 0,
      playsinline: 1,
      iv_load_policy: 3,
      fs: 0,
      modestbranding: 1,
      origin: location.origin,
      widget_referrer: location.href
    },
    events: {
      onReady: (e) => {
        clearTimeout(startTimer)
        const iframe = e.target.getIframe?.()
        if (iframe) iframe.tabIndex = -1 // keyboard focus stays on the page
        e.target.playVideo()
        waitTimer = setTimeout(() => !done && onWaiting?.(), 6000)
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PLAYING) {
          clearTimeout(waitTimer)
          onPlaying?.()
        }
        if (e.data === YT.PlayerState.ENDED) finish(onEnd)
      },
      onError: (e) => finish(() => onError?.(reasonFor(e.data)))
    }
  })

  poll = setInterval(() => {
    try {
      if (player?.getCurrentTime && player.getCurrentTime() >= end - 0.25) finish(onEnd)
    } catch {
      /* player not ready yet */
    }
  }, 250)

  return {
    destroy: () => finish(),
    // A key press is a user gesture, so this can start a video Chrome held back.
    play: () => {
      try {
        player?.playVideo()
      } catch {
        /* not ready */
      }
    }
  }
}

export function youtubeThumb(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}
