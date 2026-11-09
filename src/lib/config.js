// Student configuration: defaults, validation, and the small parsers the
// screens share. Pure functions only — no storage, no DOM.

export const DEFAULT_CUES = ['Independent', 'Gestural', 'Verbal', 'Model', 'Physical']

export const DEFAULT_RESPONSES = [
  { key: 'R', label: 'Relevant turn', request: true, unlock: true, echo: '' },
  { key: 'A', label: 'Verbal approximation', request: true, unlock: true, echo: '' },
  { key: 'D', label: 'Script/movie line', request: true, unlock: true, echo: 'delayed' },
  { key: 'E', label: 'Immediate echo', request: false, unlock: true, echo: 'immediate' },
  { key: 'N', label: 'No response', request: false, unlock: false, echo: '' }
]

export const WORD_CATS = ['noun', 'verb', 'adjective', 'adverb']

let idCounter = 0
export function newId(prefix = 'c') {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`
}

export function newClip(overrides = {}) {
  return {
    id: newId('clip'),
    emoji: '🎬',
    thumb: '', // data: URL of an uploaded picture, or '' for the emoji
    ytThumb: false, // use YouTube's own thumbnail (a YouTube request, so allowed)
    title: 'New clip',
    url: '',
    start: '',
    end: '',
    words: '',
    questions: '',
    ...overrides
  }
}

export function defaultConfig(student = 'ST01') {
  return {
    student,
    target: 10,
    secret: 'K',
    clipSeconds: 30,
    mluGoal: 3,
    altScoring: false, // when true, Y/P/X and digits only count with Alt held
    talk: 'every', // 'every' | 'alternate' | 'off' — when the word-card screen follows a clip
    studentKey: true, // small code reference on the gate in student view (never shows the private letter)
    cues: [...DEFAULT_CUES],
    responses: DEFAULT_RESPONSES.map((r) => ({ ...r })),
    clips: [
      newClip({
        emoji: '🐶',
        title: 'Puppy runs',
        words: 'dog | noun | 🐶\nrun | verb | 🏃\nfast | adverb | 💨',
        questions: 'Who is running?\nWhat is the dog doing?'
      }),
      newClip({
        emoji: '🚂',
        title: 'Train ride',
        words: 'train | noun | 🚂\ngo | verb | ➡️\nbig | adjective | 🐘',
        questions: 'What is going?\nWhere is the train going?'
      })
    ]
  }
}

// Student codes: letters/digits only, 1–5 chars. Never a name — the field is
// deliberately too short for one, same rule as SOAP and Transcribe.
export function cleanStudentCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 5)
}

// Fill gaps in a config loaded from storage or pasted in, so older or
// hand-edited configs never crash the screens.
export function normalizeConfig(raw) {
  const base = defaultConfig(cleanStudentCode(raw?.student) || 'ST01')
  const c = { ...base, ...(raw || {}) }
  c.student = cleanStudentCode(c.student) || 'ST01'
  c.target = Math.max(0, parseInt(c.target, 10) || 0)
  c.clipSeconds = Math.max(1, parseInt(c.clipSeconds, 10) || 30)
  c.mluGoal = Math.max(0, parseFloat(c.mluGoal) || 3)
  c.secret = (String(c.secret || 'K').toUpperCase().match(/[A-Z]/) || ['K'])[0]
  c.altScoring = !!c.altScoring
  c.talk = ['every', 'alternate', 'off'].includes(c.talk) ? c.talk : 'every'
  c.studentKey = c.studentKey !== false
  c.cues = Array.isArray(c.cues) && c.cues.length === 5 ? c.cues.map(String) : [...DEFAULT_CUES]
  c.responses = (Array.isArray(c.responses) ? c.responses : base.responses)
    .map((r) => ({
      key: String(r.key || '').toUpperCase().slice(0, 1),
      label: String(r.label || ''),
      request: !!r.request,
      unlock: !!r.unlock,
      echo: ['immediate', 'delayed'].includes(r.echo) ? r.echo : ''
    }))
    .filter((r) => /^[A-Z]$/.test(r.key))
  c.clips = (Array.isArray(c.clips) ? c.clips : []).map((clip) => newClip({ ...clip }))
  return c
}

// "word | category | picture" per line. Category and picture are optional.
export function parseWords(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.split('|').map((s) => s.trim()))
    .filter((parts) => parts[0])
    .map(([word, cat = '', pic = '']) => {
      const c = cat.toLowerCase()
      return { word, cat: WORD_CATS.includes(c) ? c : 'other', pic }
    })
}

export function parseQuestions(text) {
  return String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

// Accepts "75", "1:15", "1:02:03". Blank or junk → null.
export function parseTime(v) {
  const s = String(v ?? '').trim()
  if (!s) return null
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(s)) return null
  return s.split(':').reduce((acc, part) => acc * 60 + parseFloat(part), 0)
}

// Start/end in seconds for a clip; end falls back to start + clipSeconds.
export function clipWindow(clip, clipSeconds) {
  const start = parseTime(clip.start) ?? 0
  let end = parseTime(clip.end)
  if (end == null || end <= start) end = start + clipSeconds
  return { start, end }
}

// YouTube video id from any common URL shape, or a bare 11-char id.
export function youtubeId(url) {
  const s = String(url || '').trim()
  if (/^[\w-]{11}$/.test(s)) return s
  const m =
    s.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/) ||
    s.match(/youtu\.be\/([\w-]{11})/)
  return m ? m[1] : null
}

// Any YouTube link, share link, or pasted <iframe> embed code → a short
// https://youtu.be/ID link (drops tracking like ?si=). Non-YouTube text is kept.
export function cleanLink(raw) {
  const s = String(raw || '').trim()
  const id = youtubeId(s)
  return id ? `https://youtu.be/${id}` : s
}

// The gate code: response key + cue digit + private letter. Case-insensitive.
// Returns null for anything invalid (nothing gets logged).
export function parseCode(code, config) {
  const s = String(code || '').toUpperCase()
  if (s.length !== 3) return null
  const resp = config.responses.find((r) => r.key === s[0])
  if (!resp) return null
  if (!/^[0-4]$/.test(s[1])) return null
  if (s[2] !== config.secret) return null
  return { resp, cue: Number(s[1]) }
}

// Bulk add: one clip per line, "emoji | Title | link | start | end".
// Only the link is required; pieces are matched by what they look like.
export function parseClipLines(text) {
  const clips = []
  const bad = []
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split('|').map((s) => s.trim()).filter(Boolean)
    const urlIdx = parts.findIndex((p) => youtubeId(p) && /youtu|^[\w-]{11}$/.test(p))
    if (urlIdx === -1) {
      bad.push(line)
      continue
    }
    const url = cleanLink(parts[urlIdx])
    const before = parts.slice(0, urlIdx)
    const after = parts.slice(urlIdx + 1)
    const emojiIdx = before.findIndex((p) => !/[\p{L}\p{N}]/u.test(p))
    const emoji = emojiIdx === -1 ? '🎬' : before[emojiIdx]
    const title = before.filter((_, i) => i !== emojiIdx).join(' ') || 'New clip'
    const [start = '', end = ''] = after.filter((p) => parseTime(p) != null)
    clips.push(newClip({ emoji, title, url, start, end }))
  }
  return { clips, bad }
}
