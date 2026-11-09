// IndexedDB storage (Dexie). Everything is keyed by student code.
// localStorage is used only for UI conveniences (last student picked).
import Dexie from 'dexie'
import { normalizeConfig } from './config.js'
import { newSession } from './stats.js'

export const db = new Dexie('clip-choice')
db.version(1).stores({
  configs: '&student',
  sessions: '&id, student, date, ended',
  history: '&sessionId, student, date'
})

export async function listStudents() {
  return (await db.configs.toArray()).map((c) => c.student).sort()
}

export async function loadConfig(student) {
  const c = await db.configs.get(student)
  return c ? normalizeConfig(c) : null
}

export async function saveConfig(config) {
  await db.configs.put(JSON.parse(JSON.stringify(config)))
}

export async function deleteStudent(student) {
  await db.transaction('rw', db.configs, db.sessions, db.history, async () => {
    await db.configs.delete(student)
    await db.sessions.where('student').equals(student).delete()
    await db.history.where('student').equals(student).delete()
  })
}

// The open (not yet ended) session for a student, created on demand.
export async function openSession(student) {
  const open = (await db.sessions.where('student').equals(student).toArray())
    .filter((s) => !s.ended)
    .sort((a, b) => b.started.localeCompare(a.started))
  if (open[0]) return open[0]
  const s = newSession(student)
  await db.sessions.put(s)
  return s
}

// Each event is written straight away, so a reload mid-session loses nothing.
export async function appendEvent(sessionId, event) {
  await db.sessions
    .where('id')
    .equals(sessionId)
    .modify((s) => {
      s.events.push(event)
    })
  return db.sessions.get(sessionId)
}

export async function patchEvent(sessionId, index, patch) {
  await db.sessions
    .where('id')
    .equals(sessionId)
    .modify((s) => {
      if (s.events[index]) Object.assign(s.events[index], patch)
    })
  return db.sessions.get(sessionId)
}

export async function removeEvent(sessionId, index) {
  await db.sessions
    .where('id')
    .equals(sessionId)
    .modify((s) => {
      s.events.splice(index, 1)
    })
  return db.sessions.get(sessionId)
}

export async function endSession(session, row) {
  await db.transaction('rw', db.sessions, db.history, async () => {
    await db.sessions.update(session.id, { ended: new Date().toISOString() })
    await db.history.put(row)
  })
}

export async function historyFor(student) {
  return (await db.history.where('student').equals(student).toArray()).sort((a, b) =>
    a.date === b.date ? a.sessionId.localeCompare(b.sessionId) : a.date.localeCompare(b.date)
  )
}

export async function sessionsFor(student) {
  return (await db.sessions.where('student').equals(student).toArray()).sort((a, b) =>
    a.started.localeCompare(b.started)
  )
}

// ---- Export / import (one JSON file holds everything) ----
export async function exportAll() {
  return {
    app: 'clip-choice',
    version: 1,
    exported: new Date().toISOString(),
    configs: await db.configs.toArray(),
    sessions: await db.sessions.toArray(),
    history: await db.history.toArray()
  }
}

// Merge: configs and sessions are replaced by key; nothing local is deleted.
export async function importAll(data) {
  if (!data || data.app !== 'clip-choice') throw new Error('This is not a Clip Choice export file.')
  const configs = (data.configs || []).map(normalizeConfig)
  const sessions = (data.sessions || []).filter((s) => s && s.id && s.student && Array.isArray(s.events))
  const history = (data.history || []).filter((h) => h && h.sessionId && h.student)
  await db.transaction('rw', db.configs, db.sessions, db.history, async () => {
    await db.configs.bulkPut(configs)
    await db.sessions.bulkPut(sessions)
    await db.history.bulkPut(history)
  })
  return { configs: configs.length, sessions: sessions.length, history: history.length }
}

// ---- UI conveniences only ----
export const prefs = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(`clip-choice:${key}`)
      return v == null ? fallback : JSON.parse(v)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`clip-choice:${key}`, JSON.stringify(value))
    } catch {
      /* storage blocked: conveniences just don't persist */
    }
  }
}

export function downloadFile(name, text, type) {
  const blob = new Blob([text], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
