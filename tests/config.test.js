import { describe, it, expect } from 'vitest'
import { defaultConfig, parseCode, parseWords, parseTime, clipWindow, youtubeId, cleanStudentCode, normalizeConfig } from '../src/lib/config.js'

const cfg = defaultConfig('ST01')

describe('parseCode (acceptance checks)', () => {
  it('A2K logs a request at cue 2 that plays the clip', () => {
    const r = parseCode('A2K', cfg)
    expect(r.cue).toBe(2)
    expect(r.resp.request).toBe(true)
    expect(r.resp.unlock).toBe(true)
  })
  it('N0K is valid but does not unlock', () => {
    const r = parseCode('N0K', cfg)
    expect(r.resp.unlock).toBe(false)
    expect(r.resp.request).toBe(false)
  })
  it('ZZZ is invalid', () => expect(parseCode('ZZZ', cfg)).toBeNull())
  it('is case-insensitive', () => expect(parseCode('r0k', cfg)?.resp.key).toBe('R'))
  it('rejects wrong private letter, bad cue, wrong length', () => {
    expect(parseCode('R0J', cfg)).toBeNull()
    expect(parseCode('R5K', cfg)).toBeNull()
    expect(parseCode('R0', cfg)).toBeNull()
    expect(parseCode('R0KK', cfg)).toBeNull()
  })
})

describe('parsers', () => {
  it('parses word lines', () => {
    expect(parseWords('run | verb | 🏃\ndog\n\nbig | ADJECTIVE')).toEqual([
      { word: 'run', cat: 'verb', pic: '🏃' },
      { word: 'dog', cat: 'other', pic: '' },
      { word: 'big', cat: 'adjective', pic: '' }
    ])
  })
  it('parses times', () => {
    expect(parseTime('75')).toBe(75)
    expect(parseTime('1:15')).toBe(75)
    expect(parseTime('1:02:03')).toBe(3723)
    expect(parseTime('')).toBeNull()
    expect(parseTime('abc')).toBeNull()
  })
  it('falls back to clipSeconds when end is blank or before start', () => {
    expect(clipWindow({ start: '10', end: '' }, 30)).toEqual({ start: 10, end: 40 })
    expect(clipWindow({ start: '10', end: '5' }, 30)).toEqual({ start: 10, end: 40 })
    expect(clipWindow({ start: '', end: '0:20' }, 30)).toEqual({ start: 0, end: 20 })
  })
  it('extracts YouTube ids', () => {
    for (const u of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?t=4',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
      'dQw4w9WgXcQ'
    ]) expect(youtubeId(u)).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://vimeo.com/123')).toBeNull()
  })
  it('student codes are short and name-proof', () => {
    expect(cleanStudentCode('st 01')).toBe('ST01')
    expect(cleanStudentCode('Jonathan')).toBe('JONAT')
  })
  it('normalizes partial configs', () => {
    const c = normalizeConfig({ student: 'ab1', secret: 'q9', clips: [{ title: 'x' }] })
    expect(c.student).toBe('AB1')
    expect(c.secret).toBe('Q')
    expect(c.clips[0].id).toBeTruthy()
    expect(c.responses.length).toBe(5)
  })
})

import { parseClipLines } from '../src/lib/config.js'
describe('parseClipLines', () => {
  it('reads emoji, title, link, start, end in any amount of detail', () => {
    const { clips, bad } = parseClipLines(
      '🦸 | Elastigirl | https://youtu.be/WXb8z4z2b1U | 0:10 | 0:40\n' +
        'Jack Jack Attack | https://youtu.be/Ze6snJiWLRI\n' +
        'https://youtu.be/sF-k3j_R31w\n' +
        'no link here'
    )
    expect(clips.map((c) => [c.emoji, c.title, c.start, c.end])).toEqual([
      ['🦸', 'Elastigirl', '0:10', '0:40'],
      ['🎬', 'Jack Jack Attack', '', ''],
      ['🎬', 'New clip', '', '']
    ])
    expect(bad).toEqual(['no link here'])
  })
})

import { cleanLink } from '../src/lib/config.js'
describe('cleanLink', () => {
  it('turns share links and pasted embed code into a short link', () => {
    expect(cleanLink('<iframe width="560" src="https://www.youtube.com/embed/5kw9A39j57c?si=4wUOBiS-U0cTZxMW" title="YouTube video player"></iframe>')).toBe('https://youtu.be/5kw9A39j57c')
    expect(cleanLink('https://youtu.be/t5v2qBBD-gE?si=abc')).toBe('https://youtu.be/t5v2qBBD-gE')
    expect(cleanLink('not a link')).toBe('not a link')
  })
  it('bulk add accepts embed code as the link', () => {
    const { clips } = parseClipLines('🦸 | Elastigirl | <iframe src="https://www.youtube.com/embed/5kw9A39j57c?si=x"></iframe>')
    expect(clips[0]).toMatchObject({ title: 'Elastigirl', url: 'https://youtu.be/5kw9A39j57c' })
  })
})
