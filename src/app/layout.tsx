import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CreativeOps — управление креативным отделом',
  description:
    'Мини-сервис для постановки, отслеживания и контроля задач между медиабайерами и креативщиками: Kanban, учёт времени, AI-кредитов и аналитика.',
}

export const viewport: Viewport = {
  themeColor: '#07080b',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}