import '@mantine/core/styles.css'
import '@/styles/theme.css'
import type { AppProps } from 'next/app'
import { MantineProvider, localStorageColorSchemeManager } from '@mantine/core'
import NoSsr from '@/components/NoSsr'
import { CfkumaThemeProvider } from '@/util/theme'
import '@/util/i18n'

const colorSchemeManager = localStorageColorSchemeManager()

export default function App({ Component, pageProps }: AppProps) {
  return (
    <NoSsr>
      <MantineProvider defaultColorScheme="auto" colorSchemeManager={colorSchemeManager}>
        <CfkumaThemeProvider>
          <Component {...pageProps} />
        </CfkumaThemeProvider>
      </MantineProvider>
    </NoSsr>
  )
}
