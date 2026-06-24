import { useEffect, useState } from 'react'
import {
  ActionIcon,
  Container,
  Group,
  Image,
  Tooltip,
  rem,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import classes from '@/styles/Header.module.css'
import { pageConfig } from '@/uptime.config'
import { PageConfig, PageConfigLink } from '@/types/config'
import { useCfkumaTheme } from '@/util/theme'
import { IconMoon, IconPhoto, IconSettings, IconSparkles, IconSun } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

function formatClockTime(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export default function Header({
  style,
  config = pageConfig,
}: {
  style?: React.CSSProperties
  config?: PageConfig
}) {
  const { t } = useTranslation('common')
  const { setColorScheme } = useMantineColorScheme()
  const [clockTime, setClockTime] = useState('')
  const computedColorScheme = useComputedColorScheme('light', {
    getInitialValueInEffect: false,
  })
  const { skin, toggleSkin } = useCfkumaTheme()
  const isHome = typeof location !== 'undefined' && location.pathname === '/'
  const linkToElement = (link: PageConfigLink, i: number) => {
    return (
      <a
        key={i}
        href={link.link}
        target={link.link.startsWith('/') ? undefined : '_blank'}
        className={classes.link}
        data-active={link.highlight}
      >
        {link.label}
      </a>
    )
  }

  const links = [{ label: t('Incidents'), link: '/incidents' }, ...(config.links || [])]
  const nextColorScheme = computedColorScheme === 'dark' ? 'light' : 'dark'
  const colorSchemeLabel =
    nextColorScheme === 'dark' ? t('Switch to dark mode') : t('Switch to light mode')
  const ColorSchemeIcon = computedColorScheme === 'dark' ? IconSun : IconMoon
  const skinLabel = skin === 'aurora' ? t('Switch to plain skin') : t('Switch to aurora skin')
  const SkinIcon = skin === 'aurora' ? IconPhoto : IconSparkles
  const adminLabel = t('Open admin console')
  const visibleClockTime = clockTime || '--:--:--'

  useEffect(() => {
    const updateClock = () => setClockTime(formatClockTime(new Date()))
    updateClock()
    const timer = window.setInterval(updateClock, 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <header className={classes.header} style={style}>
      <Container size="xl" className={classes.inner}>
        <div className={classes.brand}>
          <time
            className={classes.clock}
            dateTime={clockTime || undefined}
            aria-label={`Current time ${visibleClockTime}`}
          >
            {visibleClockTime}
          </time>
          <a
            className={classes.logoLink}
            href={isHome ? 'https://github.com/TyrEamon/CFkuma' : '/'}
            target={isHome ? '_blank' : undefined}
          >
            <Image
              className={classes.logoImage}
              src={config.logo ?? '/logo.svg'}
              h={{ base: 44, sm: 56 }}
              w={{ base: 44, sm: 56 }}
              fit="contain"
              alt="logo"
            />
          </a>
        </div>

        <Group gap="xs" wrap="nowrap" className={classes.navWrap}>
          <Group gap={5} visibleFrom="sm" className={classes.links} wrap="nowrap">
            {links?.map(linkToElement)}
          </Group>

          <Group gap={4} hiddenFrom="sm" className={classes.links} wrap="nowrap">
            {links?.filter((link) => link.highlight || link.link.startsWith('/')).map(linkToElement)}
          </Group>

          <Group gap={4} wrap="nowrap" className={classes.themeControls}>
            <Tooltip label={colorSchemeLabel} withArrow>
              <ActionIcon
                aria-label={colorSchemeLabel}
                className="cfkuma-glass-control"
                variant="default"
                size="lg"
                radius="md"
                onClick={() => setColorScheme(nextColorScheme)}
              >
                <ColorSchemeIcon style={{ width: rem(18), height: rem(18) }} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label={skinLabel} withArrow>
              <ActionIcon
                aria-label={skinLabel}
                className="cfkuma-glass-control"
                variant={skin === 'aurora' ? 'light' : 'default'}
                color="teal"
                size="lg"
                radius="md"
                onClick={toggleSkin}
              >
                <SkinIcon style={{ width: rem(18), height: rem(18) }} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label={adminLabel} withArrow>
              <ActionIcon
                aria-label={adminLabel}
                className="cfkuma-glass-control"
                component="a"
                href="/admin"
                variant="default"
                color="gray"
                size="lg"
                radius="md"
              >
                <IconSettings style={{ width: rem(18), height: rem(18) }} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Container>
    </header>
  )
}
