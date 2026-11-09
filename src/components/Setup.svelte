<script>
  import { newClip, normalizeConfig, parseWords, youtubeId, clipWindow, parseClipLines } from '../lib/config.js'
  import * as store from '../lib/db.js'
  import { toCSV, localDate } from '../lib/stats.js'
  import Player from './Player.svelte'

  let { config, students, onChange, onAddStudent, onRemoveStudent, onImported } = $props()

  let newCode = $state('')
  let studentMsg = $state('')
  let setupText = $state('')
  let setupMsg = $state('')
  let fileMsg = $state('')
  let testing = $state(null) // { clip, result }
  let testResult = $state('')
  let bulkText = $state('')
  let bulkMsg = $state('')

  function addBulk() {
    const { clips, bad } = parseClipLines(bulkText)
    if (clips.length) edit((c) => c.clips.push(...clips))
    bulkMsg =
      `Added ${clips.length} clip${clips.length === 1 ? '' : 's'} to ${config.student}.` +
      (bad.length ? ` Skipped ${bad.length} line(s) without a YouTube link.` : '')
    bulkText = bad.join('\n')
  }

  // Every edit goes through here so App saves it (debounced).
  function edit(fn) {
    const next = $state.snapshot(config)
    fn(next)
    onChange(next)
  }

  const setField = (key, value) => edit((c) => (c[key] = value))
  const setClip = (i, key, value) => edit((c) => (c.clips[i][key] = value))
  const setResp = (i, key, value) => edit((c) => (c.responses[i][key] = value))

  function moveClip(i, d) {
    edit((c) => {
      const j = i + d
      if (j < 0 || j >= c.clips.length) return
      ;[c.clips[i], c.clips[j]] = [c.clips[j], c.clips[i]]
    })
  }

  function respKeyProblem(i) {
    const k = config.responses[i].key
    if (!/^[A-Z]$/.test(k)) return 'one letter'
    if (k === config.secret) return 'same as private letter'
    if (config.responses.findIndex((r) => r.key === k) !== i) return 'duplicate'
    return ''
  }

  async function addStudent(copy) {
    studentMsg = await onAddStudent(newCode, copy ? config : null)
    if (!studentMsg) newCode = ''
  }

  async function removeStudent() {
    if (!confirm(`Delete ${config.student} and all of their sessions? Export first if you need the data.`)) return
    await onRemoveStudent(config.student)
  }

  // Copy / Load setup: the clips and code table as text, to clone between students.
  async function copySetup() {
    const { student, ...rest } = $state.snapshot(config)
    setupText = JSON.stringify(rest, null, 1)
    try {
      await navigator.clipboard.writeText(setupText)
      setupMsg = 'Copied. Paste into another student’s Load setup.'
    } catch {
      setupMsg = 'Select the text below and copy it.'
    }
  }
  function loadSetup() {
    try {
      const parsed = JSON.parse(setupText)
      onChange(normalizeConfig({ ...parsed, student: config.student }))
      setupMsg = `Loaded into ${config.student}.`
    } catch {
      setupMsg = 'That text isn’t a copied setup.'
    }
  }

  async function exportJSON() {
    const data = await store.exportAll()
    store.downloadFile(`clip-choice-${localDate()}.json`, JSON.stringify(data, null, 1), 'application/json')
    fileMsg = 'Exported everything (all students).'
  }
  async function exportCSV() {
    const sessions = await store.sessionsFor(config.student)
    store.downloadFile(`clip-choice-${config.student}-${localDate()}.csv`, toCSV(sessions), 'text/csv')
    fileMsg = `Exported ${sessions.length} session(s) for ${config.student}.`
  }
  async function importJSON(e) {
    const file = e.currentTarget.files?.[0]
    e.currentTarget.value = ''
    if (!file) return
    try {
      const n = await store.importAll(JSON.parse(await file.text()))
      fileMsg = `Imported ${n.configs} student setup(s) and ${n.sessions} session(s).`
      await onImported()
    } catch (err) {
      fileMsg = err.message.startsWith('This') ? err.message : 'That file couldn’t be read.'
    }
  }

  // Uploaded tile pictures are shrunk and stored on the device (no image URLs,
  // so nothing but YouTube is ever fetched).
  async function uploadThumb(i, e) {
    const file = e.currentTarget.files?.[0]
    e.currentTarget.value = ''
    if (!file) return
    const img = await createImageBitmap(file)
    const scale = Math.min(1, 400 / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    setClip(i, 'thumb', canvas.toDataURL('image/jpeg', 0.8))
  }

  function testClip(clip) {
    testResult = ''
    testing = clip
  }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
</script>

{#if testing}
  <Player
    {config}
    clip={testing}
    test
    onEnd={() => {
      testResult = `“${testing.title}” played to ${fmt(clipWindow(testing, config.clipSeconds).end)}. If an ad showed first, drop this clip.`
      testing = null
    }}
    onError={(reason) => {
      testResult = `“${testing.title}” won’t load. ${reason}`
      testing = null
    }}
    onBack={() => {
      testResult = 'Test stopped.'
      testing = null
    }}
  />
{/if}

<div class="setup">
  <section>
    <h2>Student</h2>
    <p class="muted">Codes only — up to 5 letters or digits, never a name.</p>
    <div class="row">
      <span>Current: <b>{config.student}</b></span>
      <label>New code <input bind:value={newCode} maxlength="5" size="6" autocomplete="off" /></label>
      <button class="btn" onclick={() => addStudent(false)}>Add student</button>
      <button class="btn" onclick={() => addStudent(true)}>Add with this setup</button>
      <button class="btn danger" onclick={removeStudent}>Delete {config.student}</button>
    </div>
    {#if studentMsg}<p class="msg" role="status">{studentMsg}</p>{/if}
  </section>

  <section>
    <h2>Session</h2>
    <div class="row">
      <label>Request goal <input type="number" min="0" value={config.target} onchange={(e) => setField('target', +e.currentTarget.value || 0)} /></label>
      <label>MLU goal <input type="number" min="0" step="0.1" value={config.mluGoal} onchange={(e) => setField('mluGoal', +e.currentTarget.value || 3)} /></label>
      <label>Private letter
        <input maxlength="1" size="2" value={config.secret}
          onchange={(e) => { const v = e.currentTarget.value.toUpperCase().replace(/[^A-Z]/g, ''); if (v) setField('secret', v); else e.currentTarget.value = config.secret }} />
      </label>
      <label>Default clip length (s) <input type="number" min="1" value={config.clipSeconds} onchange={(e) => setField('clipSeconds', +e.currentTarget.value || 30)} /></label>
    </div>
    <div class="row">
      <label>Word cards after a clip
        <select value={config.talk} onchange={(e) => setField('talk', e.currentTarget.value)}>
          <option value="every">Every clip</option>
          <option value="alternate">Every other clip</option>
          <option value="off">Off (back to menu)</option>
        </select>
      </label>
      <label class="check"><input type="checkbox" checked={config.studentKey} onchange={(e) => setField('studentKey', e.currentTarget.checked)} /> Small code key on the gate in student view</label>
      <label class="check"><input type="checkbox" checked={config.altScoring} onchange={(e) => setField('altScoring', e.currentTarget.checked)} /> Scoring keys need Alt held (Alt+Y, Alt+3…)</label>
    </div>
    <p class="muted">Leave student view with Shift + {config.secret}. Type gate codes without Shift.</p>
  </section>

  <section>
    <h2>Gate codes</h2>
    <p class="muted">Code = response letter + cue digit + private letter. “Request” counts toward the goal; “Plays clip” unlocks the video.</p>
    <table>
      <thead><tr><th>Key</th><th>Label</th><th>Request</th><th>Plays clip</th><th>Echo</th><th></th></tr></thead>
      <tbody>
        {#each config.responses as r, i (i)}
          <tr>
            <td>
              <input maxlength="1" size="2" value={r.key} aria-label="Key" onchange={(e) => setResp(i, 'key', e.currentTarget.value.toUpperCase())} />
              {#if respKeyProblem(i)}<span class="warn">{respKeyProblem(i)}</span>{/if}
            </td>
            <td><input value={r.label} aria-label="Label" onchange={(e) => setResp(i, 'label', e.currentTarget.value)} /></td>
            <td><input type="checkbox" aria-label="Request" checked={r.request} onchange={(e) => setResp(i, 'request', e.currentTarget.checked)} /></td>
            <td><input type="checkbox" aria-label="Plays clip" checked={r.unlock} onchange={(e) => setResp(i, 'unlock', e.currentTarget.checked)} /></td>
            <td>
              <select value={r.echo} aria-label="Echo" onchange={(e) => setResp(i, 'echo', e.currentTarget.value)}>
                <option value="">—</option><option value="immediate">Immediate</option><option value="delayed">Delayed (script)</option>
              </select>
            </td>
            <td><button class="btn small" onclick={() => edit((c) => c.responses.splice(i, 1))} aria-label="Remove {r.label}">✕</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    <button class="btn" onclick={() => edit((c) => c.responses.push({ key: '', label: 'New', request: true, unlock: true, echo: '' }))}>Add code</button>

    <h3>Cue levels</h3>
    <div class="row">
      {#each config.cues as cue, i (i)}
        <label>{i} <input value={cue} size="11" onchange={(e) => edit((c) => (c.cues[i] = e.currentTarget.value || c.cues[i]))} /></label>
      {/each}
    </div>
  </section>

  <section>
    <h2>Clips</h2>
    {#if testResult}<p class="msg" role="status">{testResult}</p>{/if}
    {#each config.clips as clip, i (clip.id)}
      {@const vid = youtubeId(clip.url)}
      <article class="clip">
        <div class="row">
          <label>Emoji <input value={clip.emoji} size="3" onchange={(e) => setClip(i, 'emoji', e.currentTarget.value)} /></label>
          <label class="grow">Title <input value={clip.title} onchange={(e) => setClip(i, 'title', e.currentTarget.value)} /></label>
          <button class="btn small" onclick={() => moveClip(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
          <button class="btn small" onclick={() => moveClip(i, 1)} disabled={i === config.clips.length - 1} aria-label="Move down">↓</button>
          <button class="btn small danger" onclick={() => confirm(`Remove “${clip.title}”?`) && edit((c) => c.clips.splice(i, 1))}>Remove</button>
        </div>
        <div class="row">
          <label class="grow">YouTube link <input value={clip.url} placeholder="https://youtu.be/…" onchange={(e) => setClip(i, 'url', e.currentTarget.value.trim())} /></label>
          <label>Start <input value={clip.start} size="6" placeholder="0:00" onchange={(e) => setClip(i, 'start', e.currentTarget.value.trim())} /></label>
          <label>End <input value={clip.end} size="6" placeholder="0:30" onchange={(e) => setClip(i, 'end', e.currentTarget.value.trim())} /></label>
          <button class="btn" onclick={() => testClip(clip)}>Test clip</button>
        </div>
        {#if clip.url && !vid}<p class="warn">That doesn’t look like a YouTube link.</p>{/if}
        <div class="row">
          <label class="check"><input type="checkbox" checked={clip.ytThumb} disabled={!vid} onchange={(e) => setClip(i, 'ytThumb', e.currentTarget.checked)} /> Use YouTube thumbnail</label>
          <label>Upload picture <input type="file" accept="image/*" onchange={(e) => uploadThumb(i, e)} /></label>
          {#if clip.thumb}<img class="thumb" src={clip.thumb} alt="" /><button class="btn small" onclick={() => setClip(i, 'thumb', '')}>Clear picture</button>{/if}
        </div>
        <div class="cols">
          <label>Word cards <span class="muted">(word | noun/verb/adjective/adverb | picture)</span>
            <textarea value={clip.words} onchange={(e) => setClip(i, 'words', e.currentTarget.value)}></textarea>
            <span class="muted">{parseWords(clip.words).length} words</span>
          </label>
          <label>WH questions <span class="muted">(one per line)</span>
            <textarea value={clip.questions} onchange={(e) => setClip(i, 'questions', e.currentTarget.value)}></textarea>
          </label>
        </div>
      </article>
    {/each}
    <button class="btn primary" onclick={() => edit((c) => c.clips.push(newClip()))}>Add clip</button>

    <h3>Add several clips</h3>
    <p class="muted">One per line: <code>emoji | Title | YouTube link | start | end</code>. Only the link is required.</p>
    <textarea bind:value={bulkText} rows="4" placeholder="🦸 | Elastigirl | https://youtu.be/… | 0:10 | 0:40"></textarea>
    <div class="row">
      <button class="btn" onclick={addBulk} disabled={!bulkText.trim()}>Add these clips</button>
      {#if bulkMsg}<span class="msg" role="status">{bulkMsg}</span>{/if}
    </div>
  </section>

  <section>
    <h2>Copy / load setup</h2>
    <p class="muted">Copies clips, codes, and settings (not data) so another student can start from this one.</p>
    <div class="row">
      <button class="btn" onclick={copySetup}>Copy setup</button>
      <button class="btn" onclick={loadSetup} disabled={!setupText.trim()}>Load setup into {config.student}</button>
    </div>
    <textarea bind:value={setupText} placeholder="Paste a copied setup here, then Load." rows="4"></textarea>
    {#if setupMsg}<p class="msg" role="status">{setupMsg}</p>{/if}
  </section>

  <section>
    <h2>Files</h2>
    <p class="muted">Data lives only in this browser. Export regularly — clearing site data erases it.</p>
    <div class="row">
      <button class="btn" onclick={exportJSON}>Export all (JSON)</button>
      <button class="btn" onclick={exportCSV}>Export {config.student} (CSV)</button>
      <label class="btn">Import JSON <input class="sr-only" type="file" accept=".json,application/json" onchange={importJSON} /></label>
    </div>
    {#if fileMsg}<p class="msg" role="status">{fileMsg}</p>{/if}
  </section>
</div>

<style>
  .setup { max-width: 1100px; margin: 0 auto; padding: 20px; }
  section { background: var(--surface); border: 2px solid var(--line); border-radius: var(--radius); padding: 18px 20px; margin-bottom: 20px; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; margin: 8px 0; }
  label { display: inline-flex; align-items: center; gap: 8px; }
  label.grow { flex: 1 1 260px; }
  label.grow input { flex: 1; min-width: 0; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .cols label { display: flex; flex-direction: column; align-items: stretch; }
  @media (max-width: 800px) { .cols { grid-template-columns: 1fr; } }
  .clip { border-top: 2px solid var(--line); padding: 12px 0; }
  .clip:first-of-type { border-top: 0; }
  table { border-collapse: collapse; margin-bottom: 10px; }
  td, th { padding: 4px 8px; text-align: left; }
  .warn { color: var(--warn); font-size: 0.9rem; margin-left: 6px; }
  .msg { font-weight: 700; }
  .thumb { height: 48px; border-radius: 6px; }
  .check input { width: 22px; height: 22px; }
  label.btn:focus-within { outline: 6px solid var(--ring); box-shadow: 0 0 0 9px var(--ring-edge); }
</style>
