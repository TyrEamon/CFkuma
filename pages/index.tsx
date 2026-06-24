import Head from 'next/head'

import { Inter } from 'next/font/google'
import { useEffect, useState } from 'react'
import { MonitorTarget, PageConfig } from '@/types/config'
import { maintenances } from '@/uptime.config'
import OverallStatus from '@/components/OverallStatus'
import Header from '@/components/Header'
import MonitorList from '@/components/MonitorList'
import { Center, Container, Text } from '@mantine/core'
import type { CSSProperties } from 'react'
import MonitorDetail from '@/components/MonitorDetail'
import Footer from '@/components/Footer'
import { useTranslation } from 'react-i18next'
import { CompactedMonitorStateWrapper, getFromStore } from '@/worker/src/store'
import { getRuntimeConfig } from '@/util/runtimeConfig'

export const runtime = 'experimental-edge'
const inter = Inter({ subsets: ['latin'] })
const detailSurfaceStyle: CSSProperties = {
  borderRadius: 8,
  padding: 16,
}

export default function Home({
  compactedStateStr,
  monitors,
  runtimePageConfig,
}: {
  compactedStateStr: string
  monitors: MonitorTarget[]
  runtimePageConfig: PageConfig
  tooltip?: string
  statusPageLink?: string
}) {
  const { t } = useTranslation('common')
  const [monitorId, setMonitorId] = useState('')
  let state = new CompactedMonitorStateWrapper(compactedStateStr).uncompact()

  // Specify monitorId in URL hash to view a specific monitor (can be used in iframe)
  useEffect(() => {
    const updateMonitorId = () => setMonitorId(window.location.hash.substring(1))
    updateMonitorId()
    window.addEventListener('hashchange', updateMonitorId)
    return () => window.removeEventListener('hashchange', updateMonitorId)
  }, [])
  if (monitorId) {
    const monitor = monitors.find((monitor) => monitor.id === monitorId)
    if (!monitor || !state || !state.incident[monitor.id] || !state.latency[monitor.id]) {
      return <Text fw={700}>{t('Monitor not found', { id: monitorId })}</Text>
    }
    return (
      <Container size="md" mt="xl" px="md" className="cfkuma-surface" style={detailSurfaceStyle}>
        <MonitorDetail monitor={monitor} state={state} />
      </Container>
    )
  }

  return (
    <>
      <Head>
        <title>{runtimePageConfig.title}</title>
        <link rel="icon" href={runtimePageConfig.favicon ?? '/favicon.png'} />
      </Head>

      <main className={inter.className}>
        <Header config={runtimePageConfig} />

        {state.lastUpdate === 0 ? (
          <Center>
            <Text fw={700}>{t('Monitor State not defined')}</Text>
          </Center>
        ) : (
          <div>
            <OverallStatus state={state} monitors={monitors} maintenances={maintenances} />
            <MonitorList monitors={monitors} state={state} group={runtimePageConfig.group} />
          </div>
        )}

        <Footer config={runtimePageConfig} />
      </main>
    </>
  )
}

export async function getServerSideProps() {
  const runtimeConfig = await getRuntimeConfig(process.env as any)
  // Read state as string from storage, to avoid hitting server-side cpu time limit
  const compactedStateStr = await getFromStore(process.env as any, 'state')

  // Only present these values to client
  const monitors = runtimeConfig.workerConfig.monitors.map((monitor) => {
    const clientMonitor: Pick<MonitorTarget, 'id' | 'name'> & Partial<MonitorTarget> = {
      id: monitor.id,
      name: monitor.name,
    }

    if (monitor.tooltip !== undefined) clientMonitor.tooltip = monitor.tooltip
    if (monitor.statusPageLink !== undefined) clientMonitor.statusPageLink = monitor.statusPageLink
    if (monitor.icon !== undefined) clientMonitor.icon = monitor.icon
    if (monitor.category !== undefined) clientMonitor.category = monitor.category
    if (monitor.hideLatencyChart !== undefined) {
      clientMonitor.hideLatencyChart = monitor.hideLatencyChart
    }

    return clientMonitor
  })

  return {
    props: {
      compactedStateStr,
      monitors,
      runtimePageConfig: runtimeConfig.pageConfig,
      adminAppearance: runtimeConfig.adminConfig.appearance,
    },
  }
}
