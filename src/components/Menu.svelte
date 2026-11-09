<script>
  import { onMount, tick } from 'svelte'
  import { ARROWS, nextIndex } from '../lib/gridnav.js'
  import { youtubeId } from '../lib/config.js'
  import { youtubeThumb } from '../lib/youtube.js'

  let { clips, start = 0, onChoose } = $props()
  // svelte-ignore state_referenced_locally — read once; the screen remounts per clip
  let index = $state(Math.min(start, Math.max(0, clips.length - 1)))
  let els = []

  async function focusCurrent() {
    await tick()
    els[index]?.focus({ preventScroll: false })
  }
  onMount(focusCurrent)

  function onkeydown(e) {
    if (e.target.closest?.('input, select, textarea, .bar')) return
    const dir = ARROWS[e.key]
    if (dir) {
      e.preventDefault()
      index = nextIndex(els.map((el) => el.getBoundingClientRect()), index, dir)
      focusCurrent()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (clips[index]) onChoose(clips[index], index)
    }
  }

  function pictureFor(c) {
    if (c.thumb) return { img: c.thumb }
    const id = c.ytThumb && youtubeId(c.url)
    return id ? { img: youtubeThumb(id) } : { emoji: c.emoji || '🎬' }
  }
</script>

<svelte:window {onkeydown} />

{#if clips.length}
  <ul class="tiles" aria-label="Videos">
    {#each clips as c, i (c.id)}
      {@const p = pictureFor(c)}
      <li>
        <button
          class="tile"
          class:focused={i === index}
          tabindex={i === index ? 0 : -1}
          bind:this={els[i]}
          onclick={() => onChoose(c, i)}
          onfocus={() => (index = i)}
        >
          {#if p.img}<img class="pic" src={p.img} alt="" />{:else}<span class="pic" aria-hidden="true">{p.emoji}</span>{/if}
          <span class="label">{c.title}</span>
        </button>
      </li>
    {/each}
  </ul>
{:else}
  <p class="empty">No clips yet. Add some in Setup.</p>
{/if}

<style>
  li { display: contents; }
  .empty { padding: 40px; font-size: 1.3rem; }
</style>
