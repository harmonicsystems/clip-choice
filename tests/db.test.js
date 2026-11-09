import { describe, it, expect } from 'vitest'
import { db, saveConfig, loadConfig, openSession, appendEvent, removeEvent, endSession, historyFor, exportAll, importAll, listStudents } from '../src/lib/db.js'
import { defaultConfig } from '../src/lib/config.js'
import { uttEvent, historyRow, computeStats } from '../src/lib/stats.js'

describe('storage', () => {
  it('persists configs, events, and history; reload keeps the open session', async () => {
    await saveConfig(defaultConfig('AB1'))
    expect(await listStudents()).toContain('AB1')
    expect((await loadConfig('AB1')).secret).toBe('K')
    const s = await openSession('AB1')
    await appendEvent(s.id, uttEvent({ n: 2 }))
    await appendEvent(s.id, uttEvent({ n: 4 }))
    const again = await openSession('AB1') // what a reload does
    expect(again.id).toBe(s.id)
    expect(again.events.map((e) => e.n)).toEqual([2, 4])
    const after = await removeEvent(s.id, 0)
    expect(after.events.map((e) => e.n)).toEqual([4])
    await endSession(after, historyRow(after, computeStats(after.events)))
    expect((await historyFor('AB1'))[0].mlu).toBe(4)
    expect((await openSession('AB1')).id).not.toBe(s.id)
  })
  it('export → import round trip', async () => {
    const dump = await exportAll()
    await db.delete()
    await db.open()
    const n = await importAll(JSON.parse(JSON.stringify(dump)))
    expect(n.configs).toBeGreaterThan(0)
    expect(await listStudents()).toContain('AB1')
    await expect(importAll({ nope: 1 })).rejects.toThrow()
  })
})
