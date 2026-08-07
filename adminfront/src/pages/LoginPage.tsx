import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { login } from '@/api/auth'

const loginSchema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符'),
  password: z.string().min(6, '密码至少 6 个字符'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const authLogin = useAdminAuthStore((s) => s.login)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const from = searchParams.get('from')

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await login(values)
      authLogin(res.token, res.user)
      const decoded = from ? decodeURIComponent(from) : '/dashboard'
      navigate(decoded || '/dashboard', { replace: true })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      const msg = err.response?.data?.message || '登录失败，请检查用户名和密码'
      setSubmitError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sidebar-accent via-background to-accent p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-md">
              <Sprout className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">GrowPocket 管理后台</CardTitle>
            <CardDescription>请使用管理员账号登录</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用户名</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入用户名"
                        autoComplete="username"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>密码</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="请输入密码"
                          autoComplete="current-password"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                          aria-label={showPassword ? '隐藏密码' : '显示密码'}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {submitError && (
                <p className="text-sm text-destructive font-medium">
                  {submitError}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={submitting}
              >
                {submitting ? '登录中...' : '登 录'}
              </Button>
              <div className="text-xs text-muted-foreground text-center pt-2">
                <Label className="font-normal">
                  默认账号请在后端种子中查看
                </Label>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
