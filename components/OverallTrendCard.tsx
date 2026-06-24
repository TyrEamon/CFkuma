import { IncidentRecord, MonitorState, MonitorTarget } from '@/types/config'
import { formatAvailability } from '@/components/monitorMetrics'
import { getColor } from '@/util/color'
import { Badge, Box, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Tooltip, rem } from '@mantine/core'
import { IconActivityHeartbeat, IconMinus, IconTrendingDown, IconTrendingUp } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

type TrendBucket = {
  start: number
  end: number
  availability: number | null
  downSeconds: number
  totalSeconds: number
}

const BUCKET_COUNT = 24
const BUCKET_SECONDS = 60 * 60

function overlapLen(x1: number, x2: number, y1: number, y2: number) {
  return Math.max(0, Math.min(x2, y2) - Math.max(x1, y1))
}

function getIncidentDownSeconds(incident: IncidentRecord, start: number, end: number, now: number) {
  const incidentStart = incident.start[0]
  if (!Number.isFinite(incidentStart)) return 0

  return overlapLen(start, end, incidentStart, incident.end ?? now)
}

function getTrendBuckets(state: MonitorState, monitors: MonitorTarget[]) {
  const now = Math.round(Date.now() / 1000)
  const rangeStart = now - BUCKET_COUNT * BUCKET_SECONDS

  return Array.from({ length: BUCKET_COUNT }, (_, index): TrendBucket => {
    const start = rangeStart + index * BUCKET_SECONDS
    const end = start + BUCKET_SECONDS
    let totalSeconds = 0
    let downSeconds = 0

    for (const monitor of monitors) {
      const incidents = state.incident[monitor.id]
      if (!incidents || incidents.length === 0) continue

      const monitorStart = incidents[0]?.start[0]
      if (!Number.isFinite(monitorStart)) continue

      totalSeconds += overlapLen(start, end, monitorStart, now)
      downSeconds += incidents.reduce((total, incident) => {
        return total + getIncidentDownSeconds(incident, start, end, now)
      }, 0)
    }

    downSeconds = Math.min(downSeconds, totalSeconds)
    return {
      start,
      end,
      availability: totalSeconds > 0 ? ((totalSeconds - downSeconds) / totalSeconds) * 100 : null,
      downSeconds,
      totalSeconds,
    }
  })
}

function average(values: number[]) {
  if (values.length === 0) return Number.NaN
  return values.reduce((total, value) => total + value, 0) / values.length
}

function formatMinutes(seconds: number) {
  const minutes = Math.round(seconds / 60)
  if (minutes < 1 && seconds > 0) return '<1 min'
  return `${minutes} min`
}

function getTrendSummary(values: number[]) {
  const midpoint = Math.floor(values.length / 2)
  const firstHalf = average(values.slice(0, midpoint))
  const secondHalf = average(values.slice(midpoint))

  if (!Number.isFinite(firstHalf) || !Number.isFinite(secondHalf)) {
    return { labelKey: 'Trend stable', color: 'gray', icon: IconMinus }
  }

  const delta = secondHalf - firstHalf
  if (delta > 0.1) return { labelKey: 'Trend improved', color: 'green', icon: IconTrendingUp }
  if (delta < -0.1) return { labelKey: 'Trend degraded', color: 'red', icon: IconTrendingDown }
  return { labelKey: 'Trend stable', color: 'gray', icon: IconMinus }
}

function buildSparkline(values: number[]) {
  if (values.length === 0) return ''

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100
      const y = 8 + ((100 - Math.min(Math.max(value, 0), 100)) / 100) * 44
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

export default function OverallTrendCard({
  state,
  monitors,
}: {
  state: MonitorState
  monitors: MonitorTarget[]
}) {
  const { t } = useTranslation('common')
  const buckets = getTrendBuckets(state, monitors)
  const availableBuckets = buckets.filter((bucket) => bucket.availability !== null)
  const availabilityValues = availableBuckets.map((bucket) => bucket.availability as number)
  const totalSeconds = buckets.reduce((total, bucket) => total + bucket.totalSeconds, 0)
  const downSeconds = buckets.reduce((total, bucket) => total + bucket.downSeconds, 0)
  const windowAvailability = totalSeconds > 0 ? ((totalSeconds - downSeconds) / totalSeconds) * 100 : Number.NaN
  const sampleCount = monitors.reduce((total, monitor) => {
    return total + (state.latency[monitor.id] ?? []).filter((point) => point.time >= buckets[0].start).length
  }, 0)
  const trendSummary = getTrendSummary(availabilityValues)
  const TrendIcon = trendSummary.icon
  const sparklinePoints = buildSparkline(availabilityValues)

  return (
    <Paper className="cfkuma-surface" withBorder radius="md" p="lg" shadow="xs" mt="md">
      <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <ThemeIcon color="teal" variant="light" radius="md" size="lg">
            <IconActivityHeartbeat style={{ width: rem(19), height: rem(19) }} />
          </ThemeIcon>
          <div>
            <Text fw={800} style={{ lineHeight: 1.2 }}>
              {t('Availability trend')}
            </Text>
            <Text size="sm" c="dimmed">
              {t('Last 24 hours')}
            </Text>
          </div>
        </Group>
        <Badge color={trendSummary.color} variant="light" leftSection={<TrendIcon size={13} />}>
          {t(trendSummary.labelKey)}
        </Badge>
      </Group>

      <Box mt="md" style={{ position: 'relative' }}>
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" style={{ width: '100%', height: 96, display: 'block' }}>
          <line x1="0" y1="8" x2="100" y2="8" stroke="currentColor" opacity="0.08" />
          <line x1="0" y1="30" x2="100" y2="30" stroke="currentColor" opacity="0.08" />
          <line x1="0" y1="52" x2="100" y2="52" stroke="currentColor" opacity="0.08" />
          {sparklinePoints && (
            <>
              <polyline points={sparklinePoints} fill="none" stroke="#14b8a6" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
              <polyline points={`0,60 ${sparklinePoints} 100,60`} fill="rgba(20, 184, 166, 0.12)" stroke="none" />
            </>
          )}
        </svg>

        <Box mt="xs" style={{ overflowX: 'auto', paddingBottom: 2 }}>
          <Box
            style={{
              minWidth: 720,
              display: 'grid',
              gridTemplateColumns: `repeat(${BUCKET_COUNT}, minmax(0, 1fr))`,
              gap: 4,
              alignItems: 'end',
            }}
          >
          {buckets.map((bucket) => {
            const value = bucket.availability
            const color = value === null ? '#94a3b8' : getColor(value, false)
            const height = value === null ? 8 : 8 + Math.round((value / 100) * 24)
            const label = value === null ? '--' : `${formatAvailability(value)}%`
            return (
              <Tooltip
                key={bucket.start}
                label={
                  value === null
                    ? t('No trend data yet')
                    : `${formatAvailability(value)}% - ${new Date(bucket.start * 1000).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                }
              >
                <Box
                  style={{
                    minWidth: 0,
                    display: 'grid',
                    gridTemplateRows: '18px 34px',
                    alignItems: 'end',
                    justifyItems: 'stretch',
                  }}
                >
                  <Text
                    component="span"
                    c={value === null ? 'dimmed' : undefined}
                    style={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textAlign: 'center',
                      textOverflow: 'clip',
                      whiteSpace: 'nowrap',
                      fontSize: 10,
                      fontWeight: 700,
                      lineHeight: '14px',
                    }}
                  >
                    {label}
                  </Text>
                  <Box
                    aria-hidden
                    style={{
                      height,
                      borderRadius: 4,
                      background: color,
                      opacity: value === null ? 0.28 : 0.62 + (height / 32) * 0.32,
                    }}
                  />
                </Box>
              </Tooltip>
            )
          })}
          </Box>
        </Box>
      </Box>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mt="md">
        <Stack gap={2}>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            {t('Window availability')}
          </Text>
          <Text fw={800} size="xl">
            {formatAvailability(windowAvailability)}%
          </Text>
        </Stack>
        <Stack gap={2}>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            {t('Downtime minutes')}
          </Text>
          <Text fw={800} size="xl">
            {formatMinutes(downSeconds)}
          </Text>
        </Stack>
        <Stack gap={2}>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            {t('Tracked checks')}
          </Text>
          <Text fw={800} size="xl">
            {sampleCount}
          </Text>
        </Stack>
      </SimpleGrid>
    </Paper>
  )
}
