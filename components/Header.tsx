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
import { PageConfigLink } from '@/types/config'
import { useCfkumaTheme } from '@/util/theme'
import { IconMoon, IconPhoto, IconSparkles, IconSun } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

export default function Header({ style }: { style?: React.CSSProperties }) {
  const { t } = useTranslation('common')
  const { setColorScheme } = useMantineColorScheme()
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

  const links = [{ label: t('Incidents'), link: '/incidents' }, ...(pageConfig.links || [])]
  const nextColorScheme = computedColorScheme === 'dark' ? 'light' : 'dark'
  const colorSchemeLabel =
    nextColorScheme === 'dark' ? t('Switch to dark mode') : t('Switch to light mode')
  const ColorSchemeIcon = computedColorScheme === 'dark' ? IconSun : IconMoon
  const skinLabel = skin === 'aurora' ? t('Switch to plain skin') : t('Switch to aurora skin')
  const SkinIcon = skin === 'aurora' ? IconPhoto : IconSparkles

  return (
    <header className={classes.header} style={style}>
      <Container size="xl" className={classes.inner}>
        <div className={classes.brand}>
          <a
            href={isHome ? 'https://github.com/lyc8503/UptimeFlare' : '/'}
            target={isHome ? '_blank' : undefined}
          >
            <Image
              src={pageConfig.logo ?? '/logo.svg'}
              h={56}
              w={{ base: 122, sm: 190 }}
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
          </Group>
        </Group>
      </Container>
    </header>
  )
}
