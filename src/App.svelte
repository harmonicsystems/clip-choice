<script>
  import { onMount } from 'svelte'
  import * as store from './lib/db.js'
  import { defaultConfig, cleanStudentCode, normalizeConfig, recordPlay } from './lib/config.js'
  import { requestEvent, vocabEvent, uttEvent, computeStats } from './lib/stats.js'
  import Menu from './components/Menu.svelte'
  import Gate from './components/Gate.svelte'
  import Player from './components/Player.svelte'
  import Talk from './components/Talk.svelte'
  import Setup from './components/Setup.svelte'
  import Data from './components/Data.svelte'

  let ready = $state(false)
  let students = $state([])
  let config = $state(null)
  let session = $state(null)
  let screen = $state('menu') // menu | gate | player | talk | setup | data
  let clip = $state(null)
  let again = $state(false)
  let gateMsg = $state('')
  let gateDetail = $state('') // why a clip failed, shown to the clinician only
  let plays = 0 // clips played this visit, for the "alternate" talk setting
  let menuIndex = $state(0)
  let studentView = $state(store.prefs.get('studentView', false))

  const stats = $derived(session ? computeStats(session.events) : null)

  onMount(async () => {
    students = await store.listStudents()
    let code = store.prefs.get('student')
    if (!students.length) {
      const c = defaultConfig('ST01')
      await store.saveConfig(c)
      students = ['ST01']
      code = 'ST01'
    }
    await pickStudent(students.includes(code) ? code : students[0])
    ready = true
  })

  async function pickStudent(code) {
    config = await store.loadConfig(code)
    session = await store.openSession(code)
    store.prefs.set('student', code)
    menuIndex = 0
    if (screen !== 'setup' && screen !== 'data') screen = 'menu'
  }

  async function addStudent(raw, copyFrom = null) {
    const code = cleanStudentCode(raw)
    if (!code) return 'Use 1–5 letters or digits.'
    if (students.includes(code)) return `${code} already exists.`
    const c = copyFrom ? normalizeConfig({ ...$state.snapshot(copyFrom), student: code }) : defaultConfig(code)
    await store.saveConfig(c)
    students = await store.listStudents()
    await pickStudent(code)
    return ''
  }

  async function removeStudent(code) {
    await store.deleteStudent(code)
    students = await store.listStudents()
    if (!students.length) return addStudent('ST01')
    await pickStudent(students[0])
  }

  let saveTimer
  function saveConfig(next) {
    config = next
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => store.saveConfig($state.snapshot(config)), 300)
  }

  async function log(event) {
    session = await store.appendEvent(session.id, event)
  }

  // ---- core loop ----
  function choose(c, i) {
    clip = c
    menuIndex = i ?? menuIndex
    again = false
    gateMsg = ''
    gateDetail = ''
    screen = 'gate'
  }

  async function onCode(code, parsed) {
    const ev = requestEvent({ code, resp: parsed.resp, cue: parsed.cue, config, clip, again })
    ev.played = parsed.resp.unlock
    await log(ev)
    if (parsed.resp.unlock) {
      gateMsg = ''
      screen = 'player'
    }
    return parsed.resp.unlock ? '' : 'Logged. Try again.'
  }

  async function onClipFailed(reason = '') {
    // The request still happened; record that the clip did not play.
    const i = session.events.length - 1
    if (session.events[i]?.type === 'request') session = await store.patchEvent(session.id, i, { played: false })
    gateMsg = "This clip won't load."
    gateDetail = reason
    screen = 'gate'
  }

  // Keep a running count of real plays that started with an ad.
  function onClipStarted({ adLikely }) {
    const next = $state.snapshot(config)
    const i = next.clips.findIndex((c) => c.id === clip.id)
    if (i === -1) return
    next.clips[i] = recordPlay(next.clips[i], adLikely)
    saveConfig(next)
  }

  function onClipEnded() {
    plays += 1
    const t = config.talk
    if (t === 'off' || (t === 'alternate' && plays % 2 === 0)) screen = 'menu'
    else screen = 'talk'
  }

  function onAgain() {
    again = true
    gateMsg = ''
    screen = 'gate'
  }

  const onVocab = (w, score) => log(vocabEvent({ word: w.word, cat: w.cat, score, clip }))
  const onUtt = (n) => log(uttEvent({ n, clip }))

  async function onRemoveEvent(i) {
    session = await store.removeEvent(session.id, i)
  }

  async function onEndSession(row) {
    await store.endSession($state.snapshot(session), row)
    session = await store.openSession(config.student)
  }

  function setStudentView(on) {
    studentView = on
    store.prefs.set('studentView', on)
    if (on && (screen === 'setup' || screen === 'data')) screen = 'menu'
  }

  // Shift + private letter leaves student view. Capture phase, so it runs
  // before any screen's own key handling.
  function onKeyCapture(e) {
    if (!studentView || !config) return
    if (e.shiftKey && e.key.toUpperCase() === config.secret) {
      e.preventDefault()
      e.stopImmediatePropagation()
      setStudentView(false)
    }
  }
  onMount(() => {
    document.addEventListener('keydown', onKeyCapture, true)
    return () => document.removeEventListener('keydown', onKeyCapture, true)
  })
</script>

{#if ready && config}
  {#if !studentView}
    <header class="bar">
      <strong class="brand">Clip Choice</strong>
      <label class="picker">
        <span class="sr-only">Student</span>
        <select value={config.student} onchange={(e) => pickStudent(e.currentTarget.value)}>
          {#each students as s (s)}<option value={s}>{s}</option>{/each}
        </select>
      </label>
      <nav>
        <button class="btn" class:primary={['menu', 'gate', 'player', 'talk'].includes(screen)} onclick={() => (screen = 'menu')}>Play</button>
        <button class="btn" class:primary={screen === 'setup'} onclick={() => (screen = 'setup')}>Setup</button>
        <button class="btn" class:primary={screen === 'data'} onclick={() => (screen = 'data')}>Data &amp; note</button>
        <button class="btn" onclick={() => setStudentView(true)} title="Shift + your private letter exits">Student view</button>
      </nav>
      {#if stats}
        <span class="count" aria-live="polite">
          Requests <b>{stats.requests}</b>/{config.target}
          {#if stats.requests}· indep {Math.round((stats.indep / stats.requests) * 100)}%{/if}
        </span>
      {/if}
    </header>
  {/if}

  <main class:full={studentView}>
    {#if screen === 'menu'}
      <Menu clips={config.clips} start={menuIndex} onChoose={choose} />
    {:else if screen === 'gate'}
      <Gate {config} {clip} message={gateMsg} detail={gateDetail} {studentView} {again} {onCode} onBack={() => (screen = 'menu')} />
    {:else if screen === 'player'}
      <Player {config} {clip} {studentView} onEnd={onClipEnded} onError={onClipFailed} onStarted={onClipStarted} onBack={() => (screen = 'menu')} />
    {:else if screen === 'talk'}
      <Talk {config} {clip} {studentView} events={session.events} {onVocab} {onUtt} {onAgain} onNew={() => (screen = 'menu')} />
    {:else if screen === 'setup'}
      <Setup {config} {students} onChange={saveConfig} onAddStudent={addStudent} onRemoveStudent={removeStudent} onImported={async () => { students = await store.listStudents(); await pickStudent(config.student) }} />
    {:else if screen === 'data'}
      <Data {config} {session} {stats} onRemoveEvent={onRemoveEvent} {onEndSession} />
    {/if}
  </main>
{/if}

<style>
  .bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px 16px;
    padding: 10px 20px;
    background: var(--surface);
    border-bottom: 2px solid var(--line);
  }
  .brand { font-size: 1.2rem; }
  nav { display: flex; gap: 8px; flex-wrap: wrap; }
  .count { margin-left: auto; color: var(--muted); }
  .count b { color: var(--ink); }
  main { min-height: calc(100vh - 70px); }
  main.full { min-height: 100vh; }
</style>
