<script>
  import { parseCode, youtubeId } from '../lib/config.js'
  import { loadYouTubeAPI } from '../lib/youtube.js'

  let { config, clip, message = '', studentView, again, onCode, onBack } = $props()

  // Keys are read at the document level instead of a text field, so focus can
  // never get lost and nothing is typed anywhere else by accident.
  let code = $state('')
  let shaking = $state(false)
  let note = $state('')
  let busy = false
  let apiProblem = $state(false)

  $effect(() => {
    note = message
  })

  // Warm up the YouTube API while the student asks, and warn early if blocked.
  $effect(() => {
    if (youtubeId(clip?.url)) loadYouTubeAPI().catch(() => (apiProblem = true))
  })

  async function submit() {
    const entered = code
    code = ''
    const parsed = parseCode(entered, config)
    if (!parsed) {
      note = ''
      shaking = false
      requestAnimationFrame(() => (shaking = true))
      return
    }
    busy = true
    try {
      const msg = await onCode(entered.toUpperCase(), parsed)
      if (msg) note = msg
    } finally {
      busy = false
    }
  }

  function onkeydown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.target.closest?.('input, select, textarea')) return
    if (e.key === 'Escape') {
      e.preventDefault()
      onBack()
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      code = code.slice(0, -1)
    } else if (/^[a-z0-9]$/i.test(e.key) && !busy) {
      e.preventDefault()
      code += e.key
      if (code.length === 3) submit()
    }
  }
</script>

<svelte:window {onkeydown} />

<section class="gate">
  <div class="clip" aria-hidden="true">
    {#if clip.thumb}<img src={clip.thumb} alt="" />{:else}<span class="emoji">{clip.emoji}</span>{/if}
  </div>
  <h1>Ask for it!</h1>
  <p class="title">{clip.title}</p>

  <div class="code" class:shake={shaking} onanimationend={() => (shaking = false)} aria-label="Code entry">
    {#each [0, 1, 2] as i (i)}
      <span class="dot" class:on={i < code.length}></span>
    {/each}
  </div>

  {#if note}<p class="note" role="status">{note}</p>{/if}
  {#if apiProblem && !note}<p class="note" role="status">This clip won't load.</p>{/if}

  {#if !studentView}
    <p class="help muted">
      {again ? 'Again · ' : ''}Type response + cue + your letter (e.g. {config.responses[0]?.key ?? 'R'}0{config.secret}). Esc = menu.
    </p>
    <p class="keys muted">
      {#each config.responses as r (r.key)}<span><b>{r.key}</b> {r.label}{r.unlock ? '' : ' (no play)'}</span>{/each}
      ·
      {#each config.cues as c, i (i)}<span><b>{i}</b> {c}</span>{/each}
    </p>
  {/if}
</section>

<style>
  .gate {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px;
    min-height: inherit;
  }
  .clip .emoji { font-size: 120px; line-height: 1; }
  .clip img { width: 260px; max-height: 170px; object-fit: cover; border-radius: var(--radius); }
  h1 { font-size: 3.2rem; margin: 16px 0 0; }
  .title { font-size: 1.5rem; margin: 4px 0 20px; }
  .code { display: flex; gap: 18px; padding: 12px 20px; border-radius: 12px; background: var(--surface); border: 2px solid var(--line); }
  .dot { width: 22px; height: 22px; border-radius: 50%; border: 3px solid var(--muted); }
  .dot.on { background: var(--ink); border-color: var(--ink); }
  .note { font-size: 1.4rem; font-weight: 700; margin: 18px 0 0; }
  .help { margin: 24px 0 4px; }
  .keys { display: flex; flex-wrap: wrap; gap: 6px 14px; justify-content: center; max-width: 900px; font-size: 0.9rem; margin: 0; }
  @media (prefers-reduced-motion: reduce) {
    .code.shake { border-color: var(--bad); background: var(--bad-soft); }
  }
</style>
