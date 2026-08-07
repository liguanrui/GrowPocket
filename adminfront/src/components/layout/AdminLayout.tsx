import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAdminUIStore } from '@/stores/adminUIStore'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'
import { useState } from 'react'

type ToastItem = {
  id: string
  type?: 'default' | 'destructive'
  title?: string
  description?: string
}

export function AdminLayout() {
  const applyTheme = useAdminUIStore((s) => s.applyTheme)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    applyTheme()
  }, [applyTheme])

  useEffect(() => {
    const handler = (e: Event) => {
      const evt = e as CustomEvent<{ type?: string; message: string }>
      const detail = evt.detail
      const id = Math.random().toString(36).slice(2, 9)
      setToasts((prev) => [
        ...prev,
        {
          id,
          type: detail?.type === 'error' ? 'destructive' : 'default',
          title: detail?.type === 'error' ? '操作失败' : '提示',
          description: detail?.message,
        },
      ])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    }
    window.addEventListener('admin-toast', handler)
    return () => window.removeEventListener('admin-toast', handler)
  }, [])

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
      {toasts.map((t) => (
        <Toast key={t.id} variant={t.type}>
          <div className="grid gap-1">
            {t.title && <ToastTitle>{t.title}</ToastTitle>}
            {t.description && (
              <ToastDescription>{t.description}</ToastDescription>
            )}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
