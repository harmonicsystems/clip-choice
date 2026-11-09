// Session events, the Data-page math, the draft note, and CSV export.
// The note wording lives only in noteText() so it can change without
// touching the math.

export function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function newSession(student, now = new Date()) {
  return {
    id: `s-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    student,
    date: localDate(now),
    started: now.toISOString(),
    ended: null,
    events: []
  }
}

// The response's request/echo flags are copied onto the event at log time,
// so editing the code table later never rewrites old sessions.
export function requestEvent({ code, resp, cue, config, clip, again = false, t = new Date() }) {
  return {
    t: t.toISOString(),
    type: 'request',
    code: String(code).toUpperCase().slice(0, 2), // never store the private letter
    resp: resp.key,
    label: resp.label,
    cue,
    cueLabel: config.cues[cue],
    request: !!resp.request,
    echo: resp.echo || '',
    unlocked: !!resp.unlock,
    clip: clip?.title || '',
    clipId: clip?.id || '',
    again: !!again
  }
}

export function vocabEvent({ word, cat, score, clip, t = new Date() }) {
  return { t: t.toISOString(), type: 'vocab', word, cat, score, clip: clip?.title || '', clipId: clip?.id || '' }
}

export function uttEvent({ n, clip, t = new Date() }) {
  return { t: t.toISOString(), type: 'utt', n, clip: clip?.title || '', clipId: clip?.id || '' }
}

export const CAT_ORDER = ['noun', 'verb', 'adjective', 'adverb', 'other']
const CAT_PLURAL = { noun: 'nouns', verb: 'verbs', adjective: 'adjectives', adverb: 'adverbs', other: 'other words' }

export function computeStats(events) {
  const gate = events.filter((e) => e.type === 'request')
  const requests = gate.filter((e) => e.request)
  const byCue = [0, 0, 0, 0, 0]
  for (const e of requests) if (e.cue >= 0 && e.cue <= 4) byCue[e.cue] += 1

  const vocab = {}
  for (const e of events.filter((e) => e.type === 'vocab')) {
    const v = (vocab[e.cat] ||= { Y: 0, P: 0, X: 0, total: 0, wordsY: new Set() })
    if (!(e.score in v)) continue
    v[e.score] += 1
    v.total += 1
    if (e.score === 'Y') v.wordsY.add(e.word.toLowerCase())
  }
  const vocabRows = CAT_ORDER.filter((c) => vocab[c]).map((c) => ({
    cat: c,
    Y: vocab[c].Y,
    P: vocab[c].P,
    X: vocab[c].X,
    total: vocab[c].total,
    differentY: vocab[c].wordsY.size
  }))

  const utts = events.filter((e) => e.type === 'utt')
  const uttWords = utts.reduce((a, e) => a + e.n, 0)

  return {
    turns: gate.length,
    requests: requests.length,
    indep: byCue[0],
    byCue,
    imm: gate.filter((e) => e.echo === 'immediate').length,
    del: gate.filter((e) => e.echo === 'delayed').length,
    vocab: vocabRows,
    utts: utts.length,
    mlu: utts.length ? Math.round((uttWords / utts.length) * 10) / 10 : null
  }
}

export function historyRow(session, stats) {
  return {
    sessionId: session.id,
    date: session.date,
    student: session.student,
    turns: stats.turns,
    requests: stats.requests,
    indep: stats.indep,
    imm: stats.imm,
    del: stats.del,
    mlu: stats.mlu
  }
}

export const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)
const times = (n) => `${n} ${n === 1 ? 'time' : 'times'}`

export function joinList(items) {
  if (items.length <= 1) return items.join('')
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

// ---- The draft note. Edit wording here; the math above stays put. ----
export function noteText(stats, config, prev = null) {
  const s = stats
  const out = []
  const who = config.student

  if (s.requests) {
    out.push(`${who} requested preferred video clips ${times(s.requests)} (goal: ${config.target}).`)
    const prompted = s.byCue
      .map((n, i) => ({ n, i }))
      .filter(({ n, i }) => i > 0 && n > 0)
      .map(({ n, i }) => `${n} after a ${config.cues[i].toLowerCase()} cue`)
    out.push(
      `${s.indep}/${s.requests} requests (${pct(s.indep, s.requests)}%) were independent` +
        (prompted.length ? `; ${joinList(prompted)}.` : '.')
    )
  } else if (s.turns) {
    out.push(`${who} did not request video clips this session (goal: ${config.target}).`)
  }

  if (s.turns) {
    let line = `Immediate echolalia occurred on ${s.imm} of ${s.turns} coded verbal turns (${pct(s.imm, s.turns)}%)`
    if (prev && prev.turns) {
      line += `, compared with ${prev.imm}/${prev.turns} (${pct(prev.imm, prev.turns)}%) on ${prev.date}`
    }
    out.push(line + '.')
  }

  if (s.del) out.push(`Delayed echolalia (scripted lines) was used to request ${times(s.del)}.`)

  if (s.vocab.length) {
    const parts = s.vocab.map(
      (v) => `${CAT_PLURAL[v.cat]} ${v.Y}/${v.total} independent (${v.differentY} different)`
    )
    out.push(`Vocabulary use during clip discussion: ${parts.join('; ')}.`)
  }

  if (s.utts) {
    out.push(
      `Mean length of ${s.utts} logged ${s.utts === 1 ? 'utterance' : 'utterances'}: ` +
        `${s.mlu.toFixed(1)} words (goal: ${Number(config.mluGoal ?? 3).toFixed(1)}).`
    )
  }

  if (!out.length) return `${who}: no data logged this session.`
  return out.join(' ')
}

// ---- CSV: one row per event, every session given. ----
const CSV_COLS = [
  'session', 'date', 'time', 'student', 'type', 'clip', 'again', 'code', 'response', 'label',
  'request', 'echo', 'unlocked', 'cue', 'cue_label', 'word', 'category', 'score', 'words'
]

function cell(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(sessions) {
  const rows = [CSV_COLS.join(',')]
  for (const s of sessions) {
    for (const e of s.events) {
      const time = new Date(e.t).toTimeString().slice(0, 8)
      const row = {
        session: s.id, date: s.date, time, student: s.student, type: e.type, clip: e.clip,
        again: e.type === 'request' ? (e.again ? 'yes' : 'no') : '',
        code: e.code, response: e.resp, label: e.label,
        request: e.type === 'request' ? (e.request ? 'yes' : 'no') : '',
        echo: e.echo, unlocked: e.type === 'request' ? (e.unlocked ? 'yes' : 'no') : '',
        cue: e.cue, cue_label: e.cueLabel, word: e.word, category: e.cat, score: e.score, words: e.n
      }
      rows.push(CSV_COLS.map((c) => cell(row[c])).join(','))
    }
  }
  return rows.join('\r\n') + '\r\n'
}
