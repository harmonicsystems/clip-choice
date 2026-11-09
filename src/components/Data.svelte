<script>
  import { onMount } from 'svelte'
  import * as store from '../lib/db.js'
  import { noteText, historyRow, pct } from '../lib/stats.js'

  let { config, session, stats, onRemoveEvent, onEndSession } = $props()

  let history = $state([])
  let copied = $state('')

  async function loadHistory() {
    history = await store.historyFor(config.student)
  }
  onMount(loadHistory)

  const prev = $derived(history.filter((h) => h.sessionId !== session.id).at(-1) ?? null)
  const note = $derived(noteText(stats, config, prev))

  async function copyNote() {
    try {
      await navigator.clipboard.writeText(note)
      copied = 'Copied — paste into the SOAP note.'
    } catch {
      copied = 'Select the text and copy it.'
    }
  }

  async function endSession() {
    if (!confirm('Save this session to history and start a new one?')) return
    await onEndSession(historyRow(session, stats))
    await loadHistory()
    copied = ''
  }

  function describe(e) {
    if (e.type === 'request')
      return `${e.code} · ${e.label}, ${e.cueLabel}${e.again ? ' · again' : ''}${e.unlocked && e.played === false ? ' · clip didn’t load' : ''}`
    if (e.type === 'vocab') return `${e.word} (${e.cat}) · ${e.score}`
    return `utterance · ${e.n} word${e.n === 1 ? '' : 's'}`
  }
  const time = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
</script>

<div class="data">
  <section>
    <h2>Session {session.date} · {config.student}</h2>
    <div class="cards">
      <div class="card"><span class="big">{stats.requests}<small>/{config.target}</small></span>requests</div>
      <div class="card"><span class="big">{pct(stats.indep, stats.requests)}%</span>independent ({stats.indep}/{stats.requests})</div>
      <div class="card">
        <span class="big">{pct(stats.imm, stats.turns)}%</span>immediate echo ({stats.imm}/{stats.turns} turns)
        {#if prev?.turns}<span class="muted">last: {pct(prev.imm, prev.turns)}% on {prev.date}</span>{/if}
      </div>
      <div class="card"><span class="big">{stats.del}</span>scripted requests</div>
      <div class="card"><span class="big">{stats.mlu ?? '—'}</span>MLU ({stats.utts} utt · goal {config.mluGoal})</div>
    </div>

    <div class="tables">
      <table>
        <caption>Requests by cue</caption>
        <tbody>
          {#each config.cues as c, i (i)}<tr><th>{i} {c}</th><td>{stats.byCue[i]}</td></tr>{/each}
        </tbody>
      </table>
      <table>
        <caption>Vocabulary</caption>
        <thead><tr><th></th><th>Y</th><th>P</th><th>X</th><th>diff. Y</th></tr></thead>
        <tbody>
          {#each stats.vocab as v (v.cat)}
            <tr><th>{v.cat}</th><td>{v.Y}</td><td>{v.P}</td><td>{v.X}</td><td>{v.differentY}</td></tr>
          {:else}
            <tr><td colspan="5" class="muted">No words scored yet.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>Draft note</h2>
    <textarea readonly rows="5" value={note}></textarea>
    <div class="row">
      <button class="btn primary" onclick={copyNote}>Copy note</button>
      <button class="btn" onclick={endSession} disabled={!session.events.length}>End &amp; save session</button>
      {#if copied}<span class="msg" role="status">{copied}</span>{/if}
    </div>
  </section>

  <section>
    <h2>Log ({session.events.length})</h2>
    <p class="muted">Mis-keyed something? Remove it here.</p>
    <ol class="log">
      {#each session.events as e, i (e.t + i)}
        <li>
          <span class="muted">{time(e.t)}</span>
          <span class="clip">{e.clip}</span>
          <span>{describe(e)}</span>
          <button class="btn small" onclick={() => onRemoveEvent(i)} aria-label="Remove event {i + 1}">Remove</button>
        </li>
      {:else}
        <li class="muted">Nothing logged yet.</li>
      {/each}
    </ol>
  </section>

  {#if history.length}
    <section>
      <h2>Saved sessions</h2>
      <table class="hist">
        <thead><tr><th>Date</th><th>Requests</th><th>Indep.</th><th>Imm. echo</th><th>Scripted</th><th>MLU</th></tr></thead>
        <tbody>
          {#each [...history].reverse() as h (h.sessionId)}
            <tr>
              <td>{h.date}</td><td>{h.requests}</td><td>{pct(h.indep, h.requests)}%</td>
              <td>{h.imm}/{h.turns} ({pct(h.imm, h.turns)}%)</td><td>{h.del}</td><td>{h.mlu ?? '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/if}
</div>

<style>
  .data { max-width: 1100px; margin: 0 auto; padding: 20px; }
  section { background: var(--surface); border: 2px solid var(--line); border-radius: var(--radius); padding: 18px 20px; margin-bottom: 20px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
  .card { display: flex; flex-direction: column; padding: 12px; border-radius: 12px; background: var(--accent-soft); }
  .big { font-size: 2rem; font-weight: 700; }
  .big small { font-size: 1rem; color: var(--muted); }
  .tables { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 32px; margin-top: 16px; }
  caption { text-align: left; font-weight: 700; padding-bottom: 4px; }
  th, td { padding: 3px 10px; text-align: left; }
  td { font-variant-numeric: tabular-nums; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 10px; }
  .msg { font-weight: 700; }
  .log { padding-left: 1.6em; max-height: 360px; overflow: auto; margin: 0; }
  .log li { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; padding: 4px 0; border-bottom: 1px solid var(--line); }
  .log .clip { font-weight: 700; }
  .log button { margin-left: auto; }
  .hist { width: 100%; border-collapse: collapse; }
  .hist td, .hist th { border-bottom: 1px solid var(--line); }
</style>
