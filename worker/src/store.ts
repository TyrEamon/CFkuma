import type { Env } from '.'
import {
  IncidentRecord,
  LatencyRecord,
  MonitorState,
  MonitorStateCompacted,
} from '../../types/config'

function numberToLittleEndianHex(value: number, bytes: number): string {
  let remaining = Math.trunc(value)
  let hex = ''

  for (let i = 0; i < bytes; i++) {
    const byte = remaining % 256
    hex += byte.toString(16).padStart(2, '0')
    remaining = Math.floor(remaining / 256)
  }

  return hex
}

function encodeUint32(values: number[]): string {
  return values.map((value) => numberToLittleEndianHex(value, 4)).join('')
}

function encodeUint16(values: number[]): string {
  return values.map((value) => numberToLittleEndianHex(value, 2)).join('')
}

function hexToUint8Array(hex: string): Uint8Array {
  const ret = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    ret[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return ret
}

function decodeUint32(hex: string): number {
  return new Uint32Array(hexToUint8Array(hex).buffer)[0]
}

function decodeUint16(hex: string): number {
  return new Uint16Array(hexToUint8Array(hex).buffer)[0]
}

function createLatencySeries(now: number, basePing: number, variance: number) {
  const times = Array.from({ length: 24 }, (_, index) => now - (23 - index) * 5 * 60)
  const pings = times.map((_, index) => basePing + ((index * 7) % variance))

  return {
    loc: {
      v: ['SJC'],
      c: [times.length],
    },
    ping: encodeUint16(pings),
    time: encodeUint32(times),
  }
}

function createLocalDevMockState(): string {
  const now = Math.round(Date.now() / 1000)
  const monitorStart = now - 90 * 24 * 60 * 60
  const recentIncidentStart = now - 45 * 60
  const recentIncidentEnd = now - 35 * 60

  const state: MonitorStateCompacted = {
    lastUpdate: now,
    overallUp: 2,
    overallDown: 0,
    incident: {
      foo_monitor: {
        start: [[monitorStart], [recentIncidentStart]],
        end: [monitorStart, recentIncidentEnd],
        error: [['dummy'], ['Local dev mock: sample HTTP timeout']],
      },
      test_tcp_monitor: {
        start: [[monitorStart]],
        end: [monitorStart],
        error: [['dummy']],
      },
    },
    latency: {
      foo_monitor: createLatencySeries(now, 82, 37),
      test_tcp_monitor: createLatencySeries(now, 124, 53),
    },
  }

  return JSON.stringify(state)
}

export async function getFromStore(env: Env | undefined, key: string): Promise<string | null> {
  const db = env?.UPTIMEFLARE_D1

  if (db == null) {
    // Local next dev has no Cloudflare D1 binding; return mock state for UI iteration only.
    return key === 'state' ? createLocalDevMockState() : null
  }

  const stmt = db.prepare('SELECT value FROM uptimeflare WHERE key = ?')
  const result = await stmt.bind(key).first<{ value: string }>()
  return result?.value || null
}

export async function setToStore(env: Env, key: string, value: string): Promise<void> {
  const stmt = env.UPTIMEFLARE_D1.prepare(
    'INSERT INTO uptimeflare (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;'
  )
  await stmt.bind(key, value).run()
}

export class CompactedMonitorStateWrapper {
  data: MonitorStateCompacted

  constructor(compactedStateStr: string | null) {
    if (!compactedStateStr) {
      // Initialize empty state
      this.data = {
        lastUpdate: 0,
        overallUp: 0,
        overallDown: 0,
        incident: {},
        latency: {},
      }
      return
    }
    this.data = JSON.parse(compactedStateStr)
  }

  getCompactedStateStr(): string {
    return JSON.stringify(this.data)
  }

  // Don't use this method at server-side
  uncompact(): MonitorState {
    let state: MonitorState = {
      lastUpdate: this.data.lastUpdate,
      overallUp: this.data.overallUp,
      overallDown: this.data.overallDown,
      incident: {},
      latency: {},
    }

    Object.keys(this.data.incident).forEach((monitorId) => {
      state.incident[monitorId] = []
      const incidents = this.data.incident[monitorId]

      if (
        incidents.start.length !== incidents.end.length ||
        incidents.start.length !== incidents.error.length
      ) {
        throw new Error(
          'Inconsistent incident data lengths, please report an issue at https://github.com/lyc8503/UptimeFlare'
        )
      }

      for (let i = 0; i < incidents.start.length; i++) {
        state.incident[monitorId].push({
          start: incidents.start[i],
          end: incidents.end[i],
          error: incidents.error[i],
        })
      }
    })

    Object.keys(this.data.latency).forEach((monitorId) => {
      state.latency[monitorId] = []
      const latencies = this.data.latency[monitorId]
      const locUncompacted: string[] = []
      latencies.loc.c.forEach((count, index) => {
        for (let i = 0; i < count; i++) {
          locUncompacted.push(latencies.loc.v[index])
        }
      })

      const timeArr = new Uint32Array(hexToUint8Array(latencies.time).buffer)
      const pingArr = new Uint16Array(hexToUint8Array(latencies.ping).buffer)

      if (timeArr.length !== pingArr.length || timeArr.length !== locUncompacted.length) {
        throw new Error(
          'Inconsistent latency data lengths, please report an issue at https://github.com/lyc8503/UptimeFlare.'
        )
      }

      for (let i = 0; i < timeArr.length; i++) {
        state.latency[monitorId].push({
          time: timeArr[i],
          ping: pingArr[i],
          loc: locUncompacted[i],
        })
      }
    })

    return state
  }

  incidentLen(monitorId: string): number {
    const incidents = this.data.incident[monitorId]
    if (!incidents) return 0
    return incidents.start.length
  }

  getIncident(monitorId: string, index: number): IncidentRecord {
    const incidents = this.data.incident[monitorId]
    if (!incidents || index < 0 || index >= incidents.start.length) {
      throw new Error('Index out of bounds or monitor not found')
    }
    return {
      start: incidents.start[index],
      end: incidents.end[index],
      error: incidents.error[index],
    }
  }

  setIncident(monitorId: string, index: number, incident: IncidentRecord) {
    const incidents = this.data.incident[monitorId]
    if (!incidents || index < 0 || index >= incidents.start.length) {
      throw new Error('Index out of bounds or monitor not found')
    }
    incidents.start[index] = incident.start
    incidents.end[index] = incident.end
    incidents.error[index] = incident.error
  }

  appendIncident(monitorId: string, incident: IncidentRecord) {
    let incidents = this.data.incident[monitorId]
    if (!incidents) {
      // Initialize incident arrays
      this.data.incident[monitorId] = {
        start: [],
        end: [],
        error: [],
      }
      incidents = this.data.incident[monitorId]
    }
    incidents.start.push(incident.start)
    incidents.end.push(incident.end)
    incidents.error.push(incident.error)
  }

  shiftIncident(monitorId: string) {
    const incidents = this.data.incident[monitorId]
    incidents.start.shift()
    incidents.end.shift()
    incidents.error.shift()
  }

  unshiftIncident(monitorId: string, incident: IncidentRecord) {
    const incidents = this.data.incident[monitorId]
    incidents.start.unshift(incident.start)
    incidents.end.unshift(incident.end)
    incidents.error.unshift(incident.error)
  }

  latencyLen(monitorId: string): number {
    const latencies = this.data.latency[monitorId]
    if (!latencies) return 0
    return latencies.ping.length / 4 // Uint16Array, 4 characters per entry in hex
  }

  appendLatency(monitorId: string, record: LatencyRecord) {
    let latencies = this.data.latency[monitorId]
    if (!latencies) {
      // Initialize latency arrays
      this.data.latency[monitorId] = {
        time: '',
        ping: '',
        loc: {
          c: [],
          v: [],
        },
      }
      latencies = this.data.latency[monitorId]
    }

    // @ts-expect-error
    latencies.time += new Uint8Array(new Uint32Array([record.time]).buffer).toHex()
    // @ts-expect-error
    latencies.ping += new Uint8Array(new Uint16Array([record.ping]).buffer).toHex()

    if (latencies.loc.v[latencies.loc.v.length - 1] !== record.loc) {
      latencies.loc.c.push(1)
      latencies.loc.v.push(record.loc)
    } else {
      latencies.loc.c[latencies.loc.c.length - 1] += 1
    }
  }

  getFirstLatency(monitorId: string): LatencyRecord {
    let latencies = this.data.latency[monitorId]

    return {
      time: decodeUint32(latencies.time.slice(0, 8)),
      ping: decodeUint16(latencies.ping.slice(0, 4)),
      loc: latencies.loc.v[0],
    }
  }

  getLastLatency(monitorId: string): LatencyRecord {
    let latencies = this.data.latency[monitorId]

    return {
      time: decodeUint32(latencies.time.slice(-8)),
      ping: decodeUint16(latencies.ping.slice(-4)),
      loc: latencies.loc.v[latencies.loc.v.length - 1],
    }
  }

  unshiftLatency(monitorId: string) {
    let latencies = this.data.latency[monitorId]

    latencies.time = latencies.time.slice(8)
    latencies.ping = latencies.ping.slice(4)

    latencies.loc.c[0] -= 1
    if (latencies.loc.c[0] === 0) {
      latencies.loc.c.shift()
      latencies.loc.v.shift()
    }
  }
}
