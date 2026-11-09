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
// onError is called if the video won't play. Returns { destroy }.
export async function playClip(el, { videoId, start, end, onEnd, onError, onPlaying }) {
  let done = false
  let poll = null
  let player = null
  let startTimer = null

  const finish = (fn) => {
    if (done) return
    done = true
    clearInterval(poll)
    clearTimeout(startTimer)
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
    finish(onError)
    return { destroy: () => finish() }
  }
  if (done) return { destroy: () => {} }

  // If playback never starts (blocked video, network), fail cleanly.
  startTimer = setTimeout(() => finish(onError), 15000)

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
      modestbranding: 1
    },
    events: {
      onReady: (e) => {
        const iframe = e.target.getIframe?.()
        if (iframe) iframe.tabIndex = -1 // keyboard focus stays on the page
        e.target.playVideo()
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PLAYING) {
          clearTimeout(startTimer)
          onPlaying?.()
        }
        if (e.data === YT.PlayerState.ENDED) finish(onEnd)
      },
      onError: () => finish(onError)
    }
  })

  poll = setInterval(() => {
    try {
      if (player?.getCurrentTime && player.getCurrentTime() >= end - 0.25) finish(onEnd)
    } catch {
      /* player not ready yet */
    }
  }, 250)

  return { destroy: () => finish() }
}

export function youtubeThumb(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}
