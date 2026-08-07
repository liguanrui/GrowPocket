import { useEffect, useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Users,
  Baby,
  Target,
  Coins,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getOverview,
  getTrends,
  getAbilityRadar,
} from '@/api/dashboard'
import type {
  OverviewStats,
  TrendStats,
  AbilityRadar,
} from '@/types'
import dayjs from 'dayjs'

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--ring))',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#ec4899',
]

function SimpleAlert({
  variant = 'default',
  children,
}: {
  variant?: 'default' | 'destructive'
  children: React.ReactNode
}) {
  const tone =
    variant === 'destructive'
      ? 'border-destructive/50 bg-destructive/10 text-destructive'
      : 'border-border bg-muted text-muted-foreground'
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <div className="flex items-start gap-3">{children}</div>
    </div>
  )
}

function SimpleProgress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className="h-full bg-primary transition-all"
        style={{ width: `${v}%` }}
      />
    </div>
  )
}

function ChartSkeleton({ height = 320 }: { height?: number }) {
  return (
    <div
      style={{ height }}
      className="w-full rounded-md bg-gradient-to-r from-muted via-muted/50 to-muted animate-pulse"
    />
  )
}

export function DashboardPage() {
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [trends, setTrends] = useState<TrendStats | null>(null)
  const [radar, setRadar] = useState<AbilityRadar | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gradeKey, setGradeKey] = useState<string>('__all__')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [o, t, r] = await Promise.all([
          getOverview(),
          getTrends(30),
          getAbilityRadar(),
        ])
        if (cancelled) return
        setOverview(o)
        setTrends(t)
        setRadar(r)
      } catch (e: any) {
        if (!cancelled) {
          const msg = e?.response?.data?.message || e?.message || '加载统计数据失败'
          setError(msg)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const statCards = useMemo(() => {
    if (!overview) return []
    const netPoints = overview.today_income_points - overview.today_expense_points
    return [
      {
        title: '注册家庭数',
        value: overview.total_families,
        delta: overview.today_new_families,
        icon: Users,
        tone: 'from-primary/10 to-primary/5 text-primary',
      },
      {
        title: '孩子总数',
        value: overview.total_children,
        delta: overview.today_new_children,
        icon: Baby,
        tone: 'from-accent/30 to-accent/10 text-accent-foreground',
      },
      {
        title: '今日完成任务',
        value: overview.today_completed_tasks,
        delta: overview.today_completed_tasks,
        icon: Target,
        tone: 'from-secondary to-secondary/60 text-secondary-foreground',
      },
      {
        title: '今日净积分',
        value: netPoints,
        delta: netPoints,
        icon: Coins,
        tone: 'from-primary/10 to-primary/5 text-primary',
      },
    ]
  }, [overview])

  const familyAndTaskLine = useMemo(() => {
    if (!trends) return []
    const a = trends.family_registration_trend
    const b = trends.task_completion_trend
    const map = new Map<string, { date: string; 家庭注册?: number; 任务完成?: number }>()
    a.forEach((x) => {
      map.set(x.date, { date: x.date, 家庭注册: x.value })
    })
    b.forEach((x) => {
      const cur = map.get(x.date) || { date: x.date }
      cur.任务完成 = x.value
      map.set(x.date, cur)
    })
    return Array.from(map.values()).sort((x, y) => (x.date < y.date ? -1 : 1))
  }, [trends])

  const pointsLine = useMemo(() => {
    if (!trends) return []
    const a = trends.points_income_trend
    const b = trends.points_expense_trend
    const map = new Map<string, { date: string; 积分收入?: number; 积分支出?: number }>()
    a.forEach((x) => {
      map.set(x.date, { date: x.date, 积分收入: x.value })
    })
    b.forEach((x) => {
      const cur = map.get(x.date) || { date: x.date }
      cur.积分支出 = x.value
      map.set(x.date, cur)
    })
    return Array.from(map.values()).sort((x, y) => (x.date < y.date ? -1 : 1))
  }, [trends])

  const gradeKeys = useMemo(() => {
    if (!radar) return []
    return Object.keys(radar.by_grade || {})
  }, [radar])

  const radarData = useMemo(() => {
    if (!radar) return []
    return radar.dimensions.map((dim, idx) => {
      const row: Record<string, any> = {
        dimension: dim.name,
        fullMark: 100,
        平台平均: radar.platform_avg[idx] ?? 0,
      }
      gradeKeys.forEach((g) => {
        row[`年级 ${g}`] = radar.by_grade[g]?.[idx] ?? 0
      })
      return row
    })
  }, [radar, gradeKeys])

  const formatDateTick = (d: string) => {
    if (!d) return d
    return dayjs(d).format('MM/DD')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">数据概览</h1>
          <p className="text-sm text-muted-foreground mt-1">
            欢迎回到 GrowPocket 管理后台
          </p>
        </div>
      </div>

      {error && (
        <SimpleAlert variant="destructive">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-medium">加载失败</div>
            <div className="text-sm">{error}</div>
          </div>
        </SimpleAlert>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-8 w-8 bg-muted rounded-lg animate-pulse" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="h-8 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-28 bg-muted rounded animate-pulse" />
                </CardContent>
              </Card>
            ))
          : statCards.map((s) => {
              const Icon = s.icon
              const deltaTone =
                s.delta >= 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
              const deltaLabel =
                s.title === '今日完成任务' || s.title === '今日净积分'
                  ? s.delta >= 0
                    ? `今日 ${s.delta >= 0 ? '+' : ''}${s.delta}`
                    : `今日 ${s.delta}`
                  : `今日 +${s.delta}`
              return (
                <Card key={s.title} className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {s.title}
                    </CardTitle>
                    <div
                      className={`p-2 rounded-lg bg-gradient-to-br ${s.tone}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <div className="text-2xl font-bold">{s.value}</div>
                      <Badge
                        variant="secondary"
                        className={`${deltaTone} border-0`}
                      >
                        {deltaLabel}
                      </Badge>
                    </div>
                    {overview && (
                      <CardDescription className="text-xs">
                        {s.title === '注册家庭数' && `家长总数 ${overview.total_parents}`}
                        {s.title === '孩子总数' && `累计任务 ${overview.total_tasks} · 兑换 ${overview.total_redeem_orders}`}
                        {s.title === '今日完成任务' && `进行中 ${overview.today_active_tasks}`}
                        {s.title === '今日净积分' &&
                          `收入 ${overview.today_income_points} · 支出 ${overview.today_expense_points}`}
                      </CardDescription>
                    )}
                  </CardContent>
                </Card>
              )
            })}
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="trends">趋势</TabsTrigger>
          <TabsTrigger value="distribution">分布</TabsTrigger>
          <TabsTrigger value="ability">能力雷达</TabsTrigger>
          <TabsTrigger value="ranking">排行榜</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">家庭注册 & 任务完成（近 30 天）</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                {loading ? (
                  <ChartSkeleton height={320} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={familyAndTaskLine}
                      margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatDateTick}
                      />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip labelFormatter={(d: any) => (typeof d === 'string' ? formatDateTick(d) : String(d ?? ''))} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="家庭注册"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="任务完成"
                        stroke="hsl(var(--accent))"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">积分收入 & 支出（近 30 天）</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                {loading ? (
                  <ChartSkeleton height={320} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={pointsLine}
                      margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatDateTick}
                      />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip labelFormatter={(d: any) => (typeof d === 'string' ? formatDateTick(d) : String(d ?? ''))} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="积分收入"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="积分支出"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">年级分布</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                {loading ? (
                  <ChartSkeleton height={320} />
                ) : !trends?.grade_distribution?.length ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={trends.grade_distribution}
                        dataKey="count"
                        nameKey="grade_label"
                        outerRadius={90}
                        label
                      >
                        {trends.grade_distribution.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">任务分类分布</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                {loading ? (
                  <ChartSkeleton height={320} />
                ) : !trends?.task_category_distribution?.length ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={trends.task_category_distribution}
                        dataKey="count"
                        nameKey="category"
                        outerRadius={90}
                        label
                      >
                        {trends.task_category_distribution.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">兑换分类分布</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                {loading ? (
                  <ChartSkeleton height={320} />
                ) : !trends?.redeem_category_distribution?.length ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={trends.redeem_category_distribution}
                        dataKey="count"
                        nameKey="name"
                        outerRadius={90}
                        label
                      >
                        {trends.redeem_category_distribution.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ability" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base">能力维度雷达</CardTitle>
                <CardDescription className="text-xs">
                  平台平均值与各年级对比
                </CardDescription>
              </div>
              <div className="w-full sm:w-56">
                {gradeKeys.length > 0 && (
                  <Select value={gradeKey} onValueChange={setGradeKey}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择年级" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">全部（平台平均）</SelectItem>
                      {gradeKeys.map((g) => (
                        <SelectItem key={g} value={g}>
                          年级 {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="h-[400px]">
              {loading ? (
                <ChartSkeleton height={400} />
              ) : !radar?.dimensions?.length ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="dimension" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar
                      name="平台平均"
                      dataKey="平台平均"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.3}
                    />
                    {gradeKey !== '__all__' && radar.by_grade[gradeKey] && (
                      <Radar
                        name={`年级 ${gradeKey}`}
                        dataKey={`年级 ${gradeKey}`}
                        stroke="hsl(var(--accent))"
                        fill="hsl(var(--accent))"
                        fillOpacity={0.3}
                      />
                    )}
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">热门任务 Top 10</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <TableSkeleton rows={8} />
                ) : !overview?.top_hot_tasks?.length ? (
                  <EmptyTable text="暂无热门任务数据" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>标题</TableHead>
                        <TableHead>分类</TableHead>
                        <TableHead className="text-right">积分</TableHead>
                        <TableHead className="text-right">完成次数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.top_hot_tasks.slice(0, 10).map((t, i) => {
                        const total = overview.top_hot_tasks[0]?.completed_count || 1
                        const pct = (t.completed_count / total) * 100
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="font-medium">
                              <span className="text-xs text-muted-foreground mr-2">
                                #{i + 1}
                              </span>
                              {t.title}
                            </TableCell>
                            <TableCell>{t.category}</TableCell>
                            <TableCell className="text-right">{t.points}</TableCell>
                            <TableCell className="text-right w-40">
                              <div className="flex flex-col gap-1">
                                <div className="text-sm">{t.completed_count}</div>
                                <SimpleProgress value={pct} />
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">热门兑换 Top 10</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <TableSkeleton rows={8} />
                ) : !overview?.top_redeem_items?.length ? (
                  <EmptyTable text="暂无兑换数据" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>商品名称</TableHead>
                        <TableHead className="text-right">所需积分</TableHead>
                        <TableHead className="text-right">兑换次数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.top_redeem_items.slice(0, 10).map((t, i) => {
                        const total = overview.top_redeem_items[0]?.redeemed_count || 1
                        const pct = (t.redeemed_count / total) * 100
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="font-medium">
                              <span className="text-xs text-muted-foreground mr-2">
                                #{i + 1}
                              </span>
                              {t.name}
                            </TableCell>
                            <TableCell className="text-right">{t.points}</TableCell>
                            <TableCell className="text-right w-40">
                              <div className="flex flex-col gap-1">
                                <div className="text-sm">{t.redeemed_count}</div>
                                <SimpleProgress value={pct} />
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
      暂无数据
    </div>
  )
}

function EmptyTable({ text }: { text: string }) {
  return (
    <div className="py-12 flex items-center justify-center text-muted-foreground text-sm">
      {text}
    </div>
  )
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-6 bg-muted rounded animate-pulse"
          style={{ width: `${100 - i * 4}%` }}
        />
      ))}
    </div>
  )
}
