<script>
  import { onMount } from 'svelte'
  import { clipWindow, youtubeId } from '../lib/config.js'
  import { playClip } from '../lib/youtube.js'

  // test: Setup's "Test clip" — plays once, logs nothing, reports back.
  let { config, clip, studentView = false, test = false, onEnd, onError, onBack, onStarted } = $props()

  // svelte-ignore state_referenced_locally — read once; the screen remounts per clip
  const win = clipWindow(clip, config.clipSeconds)
  // svelte-ignore state_referenced_locally — read once; the screen remounts per clip
  const videoId = youtubeId(clip.url)
  let host = $state()
  let loading = $state(!!videoId)
  let waiting = $state(false) // ready but not playing yet: usually an ad
  let left = $state(Math.round(win.end - win.start))
  let handle = null
  let timer = null
  let finished = false
  let reported = false

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  function done(fn) {
    if (finished) return
    finished = true
    clearInterval(timer)
    handle?.destroy()
    fn?.()
  }

  onMount(() => {
    if (videoId) {
      playClip(host, {
        videoId,
        start: win.start,
        end: win.end,
        onPlaying: (info) => {
          loading = false
          waiting = false
          if (info && info.waitedMs != null && !reported) {
            reported = true
            onStarted?.(info)
          }
        },
        onWaiting: () => (waiting = true),
        onEnd: () => done(onEnd),
        onError: (reason) => done(() => onError?.(reason))
      }).then((h) => {
        handle = h
        if (finished) h.destroy()
      })
    } else {
      // No video link: a countdown stands in (same as the prototype).
      timer = setInterval(() => {
        left -= 1
        if (left <= 0) done(onEnd)
      }, 1000)
    }
    return () => done()
  })

  function onkeydown(e) {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      done(onEnd)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      done(onBack)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handle?.play?.()
    }
  }

  // If a click ever puts focus inside the iframe, take it back so Space/Esc work.
  function onblur() {
    setTimeout(() => {
      if (document.activeElement?.tagName === 'IFRAME') document.activeElement.blur()
      window.focus()
    }, 0)
  }
</script>

<svelte:window {onkeydown} {onblur} />

<section class="player" class:test>
  {#if videoId}
    <div class="frame">
      <div bind:this={host}></div>
      {#if loading && !waiting}<p class="loading">Loading…</p>{/if}
    </div>
  {:else}
    <div class="stand-in">
      <span class="emoji" aria-hidden="true">{clip.emoji}</span>
      <p class="title">{clip.title}</p>
      <p class="left">{fmt(left)}</p>
    </div>
  {/if}
  {#if !studentView}
    <p class="help muted">
      {#if waiting}<b>Waiting for the video — probably an ad. Enter = try to start · </b>{/if}
      {test ? `Testing ${fmt(win.start)}–${fmt(win.end)} · ` : ''}Space = done · Esc = {test ? 'stop' : 'menu'}
    </p>
  {/if}
</section>

<style>
  .player {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: inherit;
    padding: 16px;
    background: #000;
    color: #fff;
  }
  .frame {
    position: relative;
    width: min(100%, calc((100vh - 140px) * 16 / 9));
    aspect-ratio: 16 / 9;
  }
  /* The iframe can't be clicked or focused: no YouTube UI, no focus trap. */
  .frame :global(iframe) { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; pointer-events: none; }
  .loading { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; font-size: 1.4rem; }
  .stand-in { text-align: center; }
  .emoji { font-size: 160px; line-height: 1; }
  .title { font-size: 2rem; margin: 10px 0; }
  .left { font-size: 3rem; font-weight: 700; margin: 0; font-variant-numeric: tabular-nums; }
  .help { color: #c9ced6; margin: 12px 0 0; }
  .player.test { position: fixed; inset: 0; z-index: 10; }
</style>
