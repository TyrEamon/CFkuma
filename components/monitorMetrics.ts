import { IncidentRecord, MonitorState, MonitorTarget } from '@/types/config'

type MonitorStatus = 'up' | 'down' | 'unknown'

function getLatestIncident(incidents?: IncidentRecord[]) {
  return incidents && incidents.length > 0 ? incidents[incidents.length - 1] : undefined
}

export function getMonitorStatus(state: MonitorState, monitorId: string): MonitorStatus {
  const latestIncident = getLatestIncident(state.incident[monitorId])
  if (!latestIncident) return 'unknown'
  return latestIncident.end === null ? 'down' : 'up'
}

export function getMonitorDownCount(state: MonitorState, ids: string[]) {
  return ids.filter((id) => getMonitorStatus(state, id) === 'down').length
}

export function getMonitorStatusColor(status: MonitorStatus) {
  if (status === 'up') return '#059669'
  if (status === 'down') return '#df484a'
  return '#70778c'
}

export function getMonitorAvailability(state: MonitorState, monitorId: string) {
  const incidents = state.incident[monitorId]
  if (!incidents || incidents.length === 0) return Number.NaN

  const currentTime = Date.now() / 1000
  const totalTime = currentTime - incidents[0].start[0]
  if (totalTime <= 0) return Number.NaN

  const downTime = incidents.reduce((total, incident) => {
    return total + (incident.end ?? currentTime) - incident.start[0]
  }, 0)

  return ((totalTime - downTime) / totalTime) * 100
}

export function formatAvailability(percent: number) {
  if (Number.isNaN(percent)) return '--'
  return percent.toFixed(percent >= 99.95 ? 2 : 1)
}

export function getOverallAvailability(state: MonitorState, monitors: MonitorTarget[]) {
  const values = monitors
    .map((monitor) => getMonitorAvailability(state, monitor.id))
    .filter((value) => !Number.isNaN(value))

  if (values.length === 0) return Number.NaN
  return values.reduce((total, value) => total + value, 0) / values.length
}

export function getLatestLatency(state: MonitorState, monitorId: string) {
  const points = state.latency[monitorId]
  if (!points || points.length === 0) return undefined
  return points[points.length - 1]
}
