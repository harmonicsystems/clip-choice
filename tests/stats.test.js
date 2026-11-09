import { describe, it, expect } from 'vitest'
import { defaultConfig, parseCode } from '../src/lib/config.js'
import { computeStats, noteText, requestEvent, vocabEvent, uttEvent, toCSV, historyRow, newSession } from '../src/lib/stats.js'

const cfg = defaultConfig('ST01')
const clip = cfg.clips[0]
const req = (code, again = false) => {
  const p = parseCode(code, cfg)
  return requestEvent({ code, resp: p.resp, cue: p.cue, config: cfg, clip, again })
}

describe('handoff example', () => {
  // 12 requests (7 independent, 5 model), 4 immediate echoes, 2 no-response = 18 turns;
  // 2 of the requests were scripted (D).
  const events = [
    ...Array(5).fill('R0K'), 'D0K', 'D0K',
    ...Array(5).fill('A3K'),
    ...Array(4).fill('E0K'),
    'N0K', 'N0K'
  ].map((c) => req(c))
  events.push(
    vocabEvent({ word: 'run', cat: 'verb', score: 'Y', clip }),
    vocabEvent({ word: 'jump', cat: 'verb', score: 'Y', clip }),
    vocabEvent({ word: 'Run', cat: 'verb', score: 'Y', clip }),
    vocabEvent({ word: 'eat', cat: 'verb', score: 'Y', clip }),
    vocabEvent({ word: 'go', cat: 'verb', score: 'P', clip })
  )
  for (const n of [2, 2, 3, 2, 3, 2, 3, 2, 3]) events.push(uttEvent({ n, clip }))
  // 22/9 = 2.44 → 2.4

  const s = computeStats(events)
  it('counts', () => {
    expect(s).toMatchObject({ turns: 18, requests: 12, indep: 7, imm: 4, del: 2, utts: 9, mlu: 2.4 })
    expect(s.byCue).toEqual([7, 0, 0, 5, 0])
    expect(s.vocab).toEqual([{ cat: 'verb', Y: 4, P: 1, X: 0, total: 5, differentY: 3 }])
  })
  it('matches the handoff note wording', () => {
    const prev = { date: '2026-11-03', imm: 6, turns: 15 }
    expect(noteText(s, cfg, prev)).toBe(
      'ST01 requested preferred video clips 12 times (goal: 10). ' +
        '7/12 requests (58%) were independent; 5 after a model cue. ' +
        'Immediate echolalia occurred on 4 of 18 coded verbal turns (22%), compared with 6/15 (40%) on 2026-11-03. ' +
        'Delayed echolalia (scripted lines) was used to request 2 times. ' +
        'Vocabulary use during clip discussion: verbs 4/5 independent (3 different). ' +
        'Mean length of 9 logged utterances: 2.4 words (goal: 3.0).'
    )
  })
})

describe('edge cases', () => {
  it('empty session', () => {
    expect(noteText(computeStats([]), cfg)).toBe('ST01: no data logged this session.')
  })
  it('turns but no requests, singular wording, several cue levels', () => {
    expect(noteText(computeStats([req('N0K')]), cfg)).toMatch(/did not request/)
    const t = noteText(computeStats([req('R1K'), req('R2K'), req('R4K')]), cfg)
    expect(t).toContain('0/3 requests (0%) were independent; 1 after a gestural cue, 1 after a verbal cue, and 1 after a physical cue.')
    expect(noteText(computeStats([req('D0K')]), cfg)).toContain('1 time.')
  })
  it('never stores the private letter', () => {
    expect(req('A2K').code).toBe('A2')
  })
  it('flags are copied at log time', () => {
    const e = req('E0K')
    cfg.responses.find((r) => r.key === 'E').echo = ''
    expect(e.echo).toBe('immediate')
    cfg.responses.find((r) => r.key === 'E').echo = 'immediate'
  })
})

describe('CSV', () => {
  it('one row per event, quoted where needed', () => {
    const s = newSession('ST01')
    s.events = [req('A2K', true), vocabEvent({ word: 'big, red', cat: 'adjective', score: 'X', clip }), uttEvent({ n: 3, clip })]
    const lines = toCSV([s]).trim().split('\r\n')
    expect(lines).toHaveLength(4)
    expect(lines[1]).toContain(',request,Puppy runs,yes,A2,A,Verbal approximation,yes,,yes,2,Verbal,')
    expect(lines[2]).toContain('"big, red",adjective,X,')
    expect(lines[3].endsWith(',3')).toBe(true)
  })
  it('history row', () => {
    const s = newSession('ST01')
    expect(historyRow(s, computeStats([req('E0K')]))).toMatchObject({ student: 'ST01', turns: 1, imm: 1, requests: 0 })
  })
})
