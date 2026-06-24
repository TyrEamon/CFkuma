import { DurableObject } from 'cloudflare:workers'
import { MonitorTarget } from '../../types/config'
import { workerConfig } from '../../uptime.config'
import { doMonitor, getStatus } from './monitor'
import { formatAndNotify, getWorkerLocation } from './util'
import { CompactedMonitorStateWrapper, getFromStore, setToStore } from './store'
import { getRuntimeConfig } from '../../util/runtimeConfig'
import pLimit from 'p-limit'

export interface Env {
  REMOTE_CHECKER_DO: DurableObjectNamespace<RemoteChecker>
  UPTIMEFLARE_D1: D1Database
}

const Worker = {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const workerLocation = (await getWorkerLocation()) || 'ERROR'
    console.log(`Running scheduled event on ${workerLocation}...`)

    // Create a wrapped MonitorState from stored compacted state
    const state = new CompactedMonitorStateWrapper(await getFromStore(env, 'state'))
    const runtimeConfig = await getRuntimeConfig(env)
    const runtimeWorkerConfig = runtimeConfig.workerConfig
    state.data.overallDown = 0
    state.data.overallUp = 0

    let statusChanged = false
    const currentTimeSecond = Math.round(Date.now() / 1000)

    // Parallel check multiple monitors
    // Max concurrent connection is 6 limited by Cloudflare Workers, we use 5 here to be safe
    type CheckResult = { id: string; location: string; status: { ping: number; up: boolean; err: string } }
    const getCheckIntervalSeconds = (monitor: MonitorTarget) => Math.max(1, Math.round(monitor.checkInterval ?? 1)) * 60
    const getLastKnownCheckResult = (monitor: MonitorTarget): CheckResult | null => {
      if (state.incidentLen(monitor.id) === 0) return null

      const latestIncident = state.getIncident(monitor.id, state.incidentLen(monitor.id) - 1)
      const latestLatency = state.latencyLen(monitor.id) > 0 ? state.getLastLatency(monitor.id) : null
      const up = latestIncident.end !== null
      return {
        id: monitor.id,
        location: latestLatency?.loc ?? workerLocation,
        status: {
          ping: latestLatency?.ping ?? 0,
          up,
          err: up ? '' : latestIncident.error.slice(-1)[0] ?? 'Unknown',
        },
      }
    }
    const shouldCheckMonitor = (monitor: MonitorTarget) => {
      if (state.incidentLen(monitor.id) === 0 || state.latencyLen(monitor.id) === 0) return true

      const latestLatency = state.getLastLatency(monitor.id)
      return currentTimeSecond - latestLatency.time >= getCheckIntervalSeconds(monitor) - 10
    }
    let checkQueue: Promise<CheckResult>[] = []
    let checkResult: Record<string, CheckResult> = {};
    const checkedMonitorIds = new Set<string>()
    const limit = pLimit(5);
    const monitorsToCheck = runtimeWorkerConfig.monitors.filter(shouldCheckMonitor)
    for (const monitor of monitorsToCheck) {
      checkedMonitorIds.add(monitor.id)
      checkQueue.push(limit(() => doMonitor(monitor, workerLocation, env)))
    }
    for (const result of await Promise.all(checkQueue)) {
      checkResult[result.id] = result
    }
    for (const monitor of runtimeWorkerConfig.monitors) {
      if (checkedMonitorIds.has(monitor.id)) continue

      const lastKnownResult = getLastKnownCheckResult(monitor)
      if (lastKnownResult) checkResult[monitor.id] = lastKnownResult
      console.log(
        `[${monitor.id}] Skipping check; interval ${Math.round(getCheckIntervalSeconds(monitor) / 60)}m not reached.`
      )
    }

    // Update each monitor's state based on check results
    for (const monitor of runtimeWorkerConfig.monitors) {
      console.log(`Processing monitor result: ${monitor.name} (${monitor.id})`)

      let monitorStatusChanged = false
      const result = checkResult[monitor.id]
      if (!result) {
        console.log(`[${monitor.id}] No current or previous check result, skipping state processing.`)
        continue
      }

      const { location: checkLocation, status } = result
      const didCheck = checkedMonitorIds.has(monitor.id)

      // Update counters
      status.up ? state.data.overallUp++ : state.data.overallDown++

      if (!didCheck) continue

      // Update incidents
      // Create a dummy incident to store the start time of the monitoring and simplify logic
      if (state.incidentLen(monitor.id) === 0) {
        state.appendIncident(monitor.id, {
          start: [currentTimeSecond],
          end: currentTimeSecond,
          error: ['dummy'],
        })
      }

      // Then lastIncident here must not be null
      let lastIncident = state.getIncident(monitor.id, state.incidentLen(monitor.id) - 1)

      if (status.up) {
        // Current status is up
        // close existing incident if any
        if (lastIncident.end === null) {
          lastIncident.end = currentTimeSecond
          // write back the modified last incident
          state.setIncident(monitor.id, state.incidentLen(monitor.id) - 1, lastIncident)

          monitorStatusChanged = true
          try {
            if (
              // grace period not set OR ...
              runtimeWorkerConfig.notification?.gracePeriod === undefined ||
              // only when we have sent a notification for DOWN status, we will send a notification for UP status (within 30 seconds of possible drift)
              currentTimeSecond - lastIncident.start[0] >=
                (runtimeWorkerConfig.notification.gracePeriod + 1) * 60 - 30
            ) {
              await formatAndNotify(monitor, true, lastIncident.start[0], currentTimeSecond, 'OK')
            } else {
              console.log(
                `grace period (${runtimeWorkerConfig.notification?.gracePeriod}m) not met, skipping webhook UP notification for ${monitor.name}`
              )
            }

            console.log('Calling config onStatusChange callback...')
            await workerConfig.callbacks?.onStatusChange?.(
              env,
              monitor,
              true,
              lastIncident.start[0],
              currentTimeSecond,
              'OK'
            )
          } catch (e) {
            console.log('Error calling callback: ')
            console.log(e)
          }
        }
      } else {
        // Current status is down
        // open new incident if not already open
        if (lastIncident.end !== null) {
          state.appendIncident(monitor.id, {
            start: [currentTimeSecond],
            end: null,
            error: [status.err],
          })
          monitorStatusChanged = true
        } else if (lastIncident.end === null && lastIncident.error.slice(-1)[0] !== status.err) {
          // append if the error message changes
          lastIncident.start.push(currentTimeSecond)
          lastIncident.error.push(status.err)

          // write back the modified last incident
          state.setIncident(monitor.id, state.incidentLen(monitor.id) - 1, lastIncident)
          monitorStatusChanged = true
        }

        const currentIncident = state.getIncident(monitor.id, state.incidentLen(monitor.id) - 1)
        try {
          if (
            // monitor status changed AND...
            (monitorStatusChanged &&
              // grace period not set OR ...
              (runtimeWorkerConfig.notification?.gracePeriod === undefined ||
                // have sent a notification for DOWN status
                currentTimeSecond - currentIncident.start[0] >=
                  (runtimeWorkerConfig.notification.gracePeriod + 1) * 60 - 30)) ||
            // grace period is set AND...
            (runtimeWorkerConfig.notification?.gracePeriod !== undefined &&
              // grace period is met
              currentTimeSecond - currentIncident.start[0] >=
                runtimeWorkerConfig.notification.gracePeriod * 60 - 30 &&
              currentTimeSecond - currentIncident.start[0] <
                runtimeWorkerConfig.notification.gracePeriod * 60 + 30)
          ) {
            if (
              currentIncident.start[0] !== currentTimeSecond &&
              runtimeWorkerConfig.notification?.skipErrorChangeNotification
            ) {
              console.log(
                'Skipping notification for following error reason change due to user config'
              )
            } else {
              await formatAndNotify(
                monitor,
                false,
                currentIncident.start[0],
                currentTimeSecond,
                status.err
              )
            }
          } else {
            console.log(
              `Grace period (${runtimeWorkerConfig.notification
                ?.gracePeriod}m) not met or no change (currently down for ${
                currentTimeSecond - currentIncident.start[0]
              }s, changed ${monitorStatusChanged}), skipping webhook DOWN notification for ${
                monitor.name
              }`
            )
          }

          if (monitorStatusChanged) {
            console.log('Calling config onStatusChange callback...')
            await workerConfig.callbacks?.onStatusChange?.(
              env,
              monitor,
              false,
              currentIncident.start[0],
              currentTimeSecond,
              status.err
            )
          }
        } catch (e) {
          console.log('Error calling callback: ')
          console.log(e)
        }

        try {
          console.log('Calling config onIncident callback...')
          await workerConfig.callbacks?.onIncident?.(
            env,
            monitor,
            currentIncident.start[0],
            currentTimeSecond,
            status.err
          )
        } catch (e) {
          console.log('Error calling callback: ')
          console.log(e)
        }
      }

      // append to latency data
      state.appendLatency(monitor.id, {
        loc: checkLocation,
        ping: status.ping,
        time: currentTimeSecond,
      })

      // discard old data
      while (state.getFirstLatency(monitor.id).time < currentTimeSecond - 12 * 60 * 60) {
        state.unshiftLatency(monitor.id)
      }

      // discard old incidents
      while (
        state.incidentLen(monitor.id) > 0 &&
        state.getIncident(monitor.id, 0).end &&
        state.getIncident(monitor.id, 0).end! < currentTimeSecond - 90 * 24 * 60 * 60
      ) {
        state.shiftIncident(monitor.id)
      }

      if (
        state.incidentLen(monitor.id) === 0 ||
        (state.getIncident(monitor.id, 0).start[0] > currentTimeSecond - 90 * 24 * 60 * 60 &&
          state.getIncident(monitor.id, 0).error[0] != 'dummy')
      ) {
        // put the dummy incident back
        state.unshiftIncident(monitor.id, {
          start: [currentTimeSecond - 90 * 24 * 60 * 60],
          end: currentTimeSecond - 90 * 24 * 60 * 60,
          error: ['dummy'],
        })
      }

      statusChanged ||= monitorStatusChanged
    }

    console.log(
      `statusChanged: ${statusChanged}, lastUpdate: ${state.data.lastUpdate}, currentTime: ${currentTimeSecond}`
    )
    // Update state
    // Allow for a cooldown period before writing to storage
    if (
      statusChanged ||
      checkedMonitorIds.size > 0 ||
      currentTimeSecond - state.data.lastUpdate >=
        (runtimeWorkerConfig.kvWriteCooldownMinutes ?? 3) * 60 - 10 // Allow for 10 seconds of clock drift
    ) {
      console.log('Updating state...')
      state.data.lastUpdate = currentTimeSecond
      await setToStore(env, 'state', state.getCompactedStateStr())
    } else {
      console.log('Skipping state update due to cooldown period.')
    }
  },
}

export default Worker

export class RemoteChecker extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
  }

  async getLocationAndStatus(
    monitor: MonitorTarget
  ): Promise<{ location: string; status: { ping: number; up: boolean; err: string } }> {
    const colo = (await getWorkerLocation()) as string
    console.log(`Running remote checker (DurableObject) at ${colo}...`)
    const status = await getStatus(monitor)
    return {
      location: colo,
      status: status,
    }
  }

  async kill() {
    // Throwing an error in `blockConcurrencyWhile` will terminate the Durable Object instance
    // https://developers.cloudflare.com/durable-objects/api/state/#blockconcurrencywhile
    this.ctx.blockConcurrencyWhile(async () => {
      throw 'killed'
    })
  }
}
