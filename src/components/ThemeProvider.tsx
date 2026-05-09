// next-themes is the shadcn-canonical theme provider.
// Despite the "next-" prefix it's framework-agnostic and works in TanStack Start.
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export function ThemeProvider({ children }: Props) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
