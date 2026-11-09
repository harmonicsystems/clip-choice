<script>
  import { onMount, tick } from 'svelte'
  import { parseWords, parseQuestions } from '../lib/config.js'
  import { ARROWS, nextIndex } from '../lib/gridnav.js'

  let { config, clip, studentView, events, onVocab, onUtt, onAgain, onNew } = $props()

  // svelte-ignore state_referenced_locally — read once; the screen remounts per clip
  const words = parseWords(clip.words)
  // svelte-ignore state_referenced_locally — read once; the screen remounts per clip
  const questions = parseQuestions(clip.questions)
  const items = [...words.map((w) => ({ kind: 'word', w })), { kind: 'again' }, { kind: 'new' }]

  let index = $state(0)
  let els = []
  let last = $state('')
  let blip = $state(0)

  async function focusCurrent() {
    await tick()
    els[index]?.focus()
  }
  onMount(focusCurrent)

  // Scores this session for each word on this clip, for the clinician badges.
  const scores = $derived.by(() => {
    const out = {}
    for (const e of events) {
      if (e.type === 'vocab' && e.clipId === clip.id) (out[e.word] ||= []).push(e.score)
    }
    return out
  })

  const SCORE_NAMES = { Y: 'used correctly', P: 'with prompt', X: 'not yet' }

  function activate(item) {
    if (item.kind === 'again') onAgain()
    else if (item.kind === 'new') onNew()
  }

  function onkeydown(e) {
    if (e.target.closest?.('input, select, textarea, .bar')) return
    const dir = ARROWS[e.key]
    if (dir) {
      e.preventDefault()
      index = nextIndex(els.map((el) => el.getBoundingClientRect()), index, dir)
      focusCurrent()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      activate(items[index])
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onNew()
      return
    }
    // Clinician scoring keys (optionally only with Alt held).
    if (config.altScoring !== e.altKey || e.ctrlKey || e.metaKey) return
    const letter = e.code?.startsWith('Key') ? e.code.slice(3) : ''
    const digit = e.code?.match(/^(?:Digit|Numpad)([1-9])$/)?.[1]
    const item = items[index]
    if (['Y', 'P', 'X'].includes(letter) && item?.kind === 'word') {
      e.preventDefault()
      onVocab(item.w, letter)
      last = `${item.w.word}: ${SCORE_NAMES[letter]}`
      blip += 1
    } else if (digit) {
      e.preventDefault()
      onUtt(Number(digit))
      last = `${digit}-word utterance`
      blip += 1
    }
  }
</script>

<svelte:window {onkeydown} />

<section class="talk">
  {#if !studentView}
    <div class="strip">
      <div>
        <strong>Ask:</strong>
        {#if questions.length}{questions.join(' · ')}{:else}<span class="muted">No questions for this clip.</span>{/if}
      </div>
      <div class="muted">
        {config.altScoring ? 'Alt + ' : ''}Y used · P prompt · X not yet · 1–9 words in utterance
        {#if last}<span class="last" role="status"> — logged {last}</span>{/if}
      </div>
    </div>
  {:else if blip}
    {#key blip}<span class="tick" aria-hidden="true"></span>{/key}
  {/if}

  <ul class="tiles">
    {#each items as item, i (i)}
      <li>
        <button
          class="tile"
          class:focused={i === index}
          class:action={item.kind !== 'word'}
          tabindex={i === index ? 0 : -1}
          bind:this={els[i]}
          onfocus={() => (index = i)}
          onclick={() => activate(item)}
        >
          {#if item.kind === 'word'}
            <span class="pic" aria-hidden="true">{item.w.pic || '💬'}</span>
            <span class="label">{item.w.word}</span>
            {#if !studentView && scores[item.w.word]}
              <span class="badge">{scores[item.w.word].join(' ')}</span>
            {/if}
          {:else if item.kind === 'again'}
            <span class="pic" aria-hidden="true">🔁</span>
            <span class="label">Again</span>
          {:else}
            <span class="pic" aria-hidden="true">📺</span>
            <span class="label">New video</span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
</section>

<style>
  li { display: contents; }
  .strip {
    margin: 16px 28px 0;
    padding: 10px 16px;
    border-radius: 12px;
    background: var(--warn-soft);
    border: 2px solid var(--line);
  }
  .last { color: var(--ink); font-weight: 700; }
  .tile.action { background: var(--accent-soft); }
  .badge {
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--muted);
  }
  /* Student view: a tiny neutral mark so the clinician knows a key registered. */
  .tick {
    position: fixed;
    top: 10px;
    right: 10px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--muted);
    animation: fade 1.2s forwards;
  }
  @keyframes fade { to { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .tick { opacity: 0.6; } }
</style>
