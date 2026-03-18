import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'aiMATA — Multi-Agent Trading Advisor',
  description: 'Short-term opportunities, instant basket intelligence.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  )
}
