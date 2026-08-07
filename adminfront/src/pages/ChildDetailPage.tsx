import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import {
  ArrowLeft,
  AlertTriangle,
  Coins,
  ListTodo,
  Clock,
  XCircle,
  Loader2,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import { getChildDetail } from '@/api/child'
import type { ChildDetailDTO } from '@/types'
import dayjs from 'dayjs'

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

const GRADE_LABEL: Record<number, string> = {
  1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级',
}
const GENDER_LABEL: Record<number, string> = { 1: '男孩', 2: '女孩' }

export function ChildDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const childId = Number(id)
  const [detail, setDetail] = useState<ChildDetailDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!childId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await getChildDetail(childId)
        if (!cancelled) setDetail(res)
      } catch (e: any) {
        if (!cancelled) {
          const msg = e?.response?.data?.message || e?.message || '加载孩子详情失败'
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
  }, [childId])

  const abilityRadarData = useMemo(() => {
    if (!detail?.ability_scores?.length) return []
    const gradeAvg = estimateGradeAverage(detail.ability_scores.map((s) => s.score))
    const platformAvg = estimatePlatformAverage(detail.ability_scores.map((s) => s.score))
    return detail.ability_scores.map((s, idx) => ({
      dimension: s.dimension_name,
      fullMark: 100,
      该孩子: s.score,
      年级平均: gradeAvg[idx],
      平台平均: platformAvg[idx],
    }))
  }, [detail])

  const taskStats = detail?.task_stats
  const mockTasks = useMemo(() => generateMockRecentTasks(taskStats?.total ?? 0), [taskStats])
  const mockTransactions = useMemo(() => generateMockTransactions(detail), [detail])
  const mockRedeems = useMemo(() => generateMockRedeems(detail), [detail])
  const mockCycles = useMemo(() => generateMockCycles(detail?.growth_cycle_count ?? 0), [detail])

  const totalPoints = detail?.total_points_earned ?? 0
  const spentPoints = detail?.total_points_spent ?? 0
  const netPoints = totalPoints - spentPoints

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 border-2 border-border">
            {detail?.avatar ? (
              <img src={detail.avatar} alt={detail.nickname} />
            ) : (
              <AvatarFallback className="text-xl">
                {detail?.nickname?.charAt(0) || 'C'}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => navigate('/children')}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                返回孩子列表
              </Button>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">
                {loading ? '加载中...' : detail?.nickname || `孩子 #${childId}`}
              </h1>
              {detail && (
                <Badge variant="secondary" className="bg-primary/15 text-primary border-0">
                  <Coins className="h-3 w-3 mr-1" />
                  余额 {detail.balance.toLocaleString()}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                所属家庭：
                <Link
                  to={`/families/${detail?.family_id}`}
                  className="text-foreground hover:text-primary transition-colors"
                >
                  {detail?.family_name || `#${detail?.family_id}`}
                </Link>
              </span>
              {detail?.grade !== undefined && detail.grade !== null && (
                <span>年级：{GRADE_LABEL[detail.grade] || `${detail.grade} 年级`}</span>
              )}
              {detail?.age !== undefined && detail.age !== null && (
                <span>年龄：{detail.age} 岁</span>
              )}
              {detail?.birthday && <span>生日：{dayjs(detail.birthday).format('YYYY/MM/DD')}</span>}
              {detail?.gender !== undefined && detail.gender !== null && (
                <span>{GENDER_LABEL[detail.gender] || `性别 ${detail.gender}`}</span>
              )}
              {detail?.hobbies && <span>爱好：{detail.hobbies}</span>}
              <span>创建：{detail?.created_at ? dayjs(detail.created_at).format('YYYY/MM/DD') : '—'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/children')}
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            返回列表
          </Button>
        </div>
      </div>

      {error && (
        <SimpleAlert variant="destructive">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">加载失败</div>
            <div className="text-sm">{error}</div>
          </div>
        </SimpleAlert>
      )}

      <Tabs defaultValue="points" className="space-y-4">
        <TabsList className="w-full sm:w-auto flex-wrap">
          <TabsTrigger value="points">积分与兑换</TabsTrigger>
          <TabsTrigger value="tasks">任务</TabsTrigger>
          <TabsTrigger value="ability">能力发展</TabsTrigger>
          <TabsTrigger value="cycles">成长周期</TabsTrigger>
        </TabsList>

        <TabsContent value="points" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-7 w-24 bg-muted rounded animate-pulse" />
                    </CardContent>
                  </Card>
                ))
              : [
                  {
                    title: '累计收入积分',
                    value: totalPoints,
                    tone: 'from-primary/10 to-primary/5 text-primary',
                    icon: TrendingUp,
                    hint: '任务完成等获得',
                  },
                  {
                    title: '累计支出积分',
                    value: spentPoints,
                    tone: 'from-destructive/10 to-destructive/5 text-destructive',
                    icon: Coins,
                    hint: '兑换商品等消耗',
                  },
                  {
                    title: '净获得积分',
                    value: netPoints,
                    tone: 'from-accent/30 to-accent/10 text-accent-foreground',
                    icon: Sparkles,
                    hint: '收入 - 支出',
                  },
                  {
                    title: '当前余额',
                    value: detail?.balance ?? 0,
                    tone: 'from-secondary to-secondary/60 text-secondary-foreground',
                    icon: Coins,
                    hint: '可兑换积分',
                  },
                ].map((c) => {
                  const Icon = c.icon
                  return (
                    <Card key={c.title}>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                          {c.title}
                        </CardTitle>
                        <div
                          className={`p-1.5 rounded-md bg-gradient-to-br ${c.tone}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        <div className="text-xl font-bold">
                          {c.value.toLocaleString()}
                        </div>
                        <CardDescription className="text-xs">
                          {c.hint}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  )
                })}
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">最近交易流水</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <TableSkeleton rows={6} />
                ) : !mockTransactions.length ? (
                  <EmptyHint text="暂无交易数据" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>类型</TableHead>
                        <TableHead>描述</TableHead>
                        <TableHead className="text-right">变动</TableHead>
                        <TableHead className="text-right">余额</TableHead>
                        <TableHead>时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockTransactions.map((t, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={
                                t.delta >= 0
                                  ? 'bg-primary/10 text-primary border-0'
                                  : 'bg-destructive/10 text-destructive border-0'
                              }
                            >
                              {t.delta >= 0 ? '收入' : '支出'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {t.reason}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              t.delta >= 0 ? 'text-primary' : 'text-destructive'
                            }`}
                          >
                            {t.delta >= 0 ? '+' : ''}
                            {t.delta}
                          </TableCell>
                          <TableCell className="text-right">{t.balance}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {t.time}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">最近兑换订单</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <TableSkeleton rows={6} />
                ) : !mockRedeems.length ? (
                  <EmptyHint text="暂无兑换记录" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>商品</TableHead>
                        <TableHead className="text-right">消耗积分</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockRedeems.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-right font-medium">
                            {r.points}
                          </TableCell>
                          <TableCell>
                            <RedeemStatusBadge status={r.status} />
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {r.time}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-7 w-20 bg-muted rounded animate-pulse" />
                    </CardContent>
                  </Card>
                ))
              : [
                  {
                    title: '任务总数',
                    value: taskStats?.total ?? 0,
                    tone: 'from-primary/10 to-primary/5 text-primary',
                    icon: ListTodo,
                    variant: 'default' as const,
                  },
                  {
                    title: '已完成',
                    value: taskStats?.completed ?? 0,
                    tone: 'from-accent/30 to-accent/10 text-accent-foreground',
                    icon: ListTodo,
                    variant: 'completed' as const,
                  },
                  {
                    title: '待验收 / 进行中',
                    value: taskStats?.pending ?? 0,
                    tone: 'from-secondary to-secondary/60 text-secondary-foreground',
                    icon: Clock,
                    variant: 'pending' as const,
                  },
                  {
                    title: '已拒绝',
                    value: taskStats?.rejected ?? 0,
                    tone: 'from-destructive/10 to-destructive/5 text-destructive',
                    icon: XCircle,
                    variant: 'rejected' as const,
                  },
                ].map((c) => {
                  const Icon = c.icon
                  const pct =
                    taskStats?.total && c.variant !== 'default'
                      ? Math.round(((c.value as number) / taskStats.total) * 100)
                      : null
                  return (
                    <Card key={c.title}>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                          {c.title}
                        </CardTitle>
                        <div
                          className={`p-1.5 rounded-md bg-gradient-to-br ${c.tone}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        <div className="text-xl font-bold">{c.value as number}</div>
                        {pct !== null && (
                          <CardDescription className="text-xs">
                            占比 {pct}%
                          </CardDescription>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">最近任务（最近 20 条）</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={8} />
              ) : !mockTasks.length ? (
                <EmptyHint text="暂无任务记录" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务标题</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">积分</TableHead>
                      <TableHead>更新时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockTasks.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{t.title}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.category}
                        </TableCell>
                        <TableCell>
                          <TaskStatusBadge status={t.status} />
                        </TableCell>
                        <TableCell className="text-right">{t.points}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {t.time}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ability" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">6 维能力雷达对比</CardTitle>
                <CardDescription className="text-xs">
                  该孩子 vs 年级平均 vs 平台平均
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[420px]">
                {loading ? (
                  <div className="h-full w-full rounded-md bg-gradient-to-r from-muted via-muted/50 to-muted animate-pulse" />
                ) : !abilityRadarData.length ? (
                  <EmptyHint text="暂无能力数据" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={abilityRadarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="dimension" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar
                        name="该孩子"
                        dataKey="该孩子"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.35}
                      />
                      <Radar
                        name="年级平均"
                        dataKey="年级平均"
                        stroke="hsl(var(--accent))"
                        fill="hsl(var(--accent))"
                        fillOpacity={0.15}
                      />
                      <Radar
                        name="平台平均"
                        dataKey="平台平均"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.1}
                      />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">能力维度分数明细</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <TableSkeleton rows={6} />
                ) : !detail?.ability_scores?.length ? (
                  <EmptyHint text="暂无分数数据" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>维度</TableHead>
                        <TableHead className="text-right">分数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.ability_scores.map((s) => (
                        <TableRow key={s.dimension_id}>
                          <TableCell className="font-medium">
                            <span
                              className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                              style={{ background: s.dimension_color }}
                            />
                            {s.dimension_name}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {s.score}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cycles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">成长周期</CardTitle>
              <CardDescription className="text-xs">
                累计成长周期数：{detail?.growth_cycle_count ?? 0}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={5} />
              ) : !mockCycles.length ? (
                <EmptyHint text="暂无成长周期数据" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>周期</TableHead>
                      <TableHead>主题</TableHead>
                      <TableHead className="text-right">任务数</TableHead>
                      <TableHead className="text-right">完成率</TableHead>
                      <TableHead>开始</TableHead>
                      <TableHead>结束</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockCycles.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          第 {c.index} 周期
                        </TableCell>
                        <TableCell>{c.theme}</TableCell>
                        <TableCell className="text-right">{c.total}</TableCell>
                        <TableCell className="text-right">{c.rate}%</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {c.start}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {c.end}
                        </TableCell>
                        <TableCell>
                          <CycleStatusBadge status={c.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TaskStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: '已完成', cls: 'bg-primary/15 text-primary border-0' },
    pending: { label: '待验收', cls: 'bg-accent/20 text-accent-foreground border-0' },
    in_progress: { label: '进行中', cls: 'bg-secondary text-secondary-foreground border-0' },
    rejected: { label: '已拒绝', cls: 'bg-destructive/15 text-destructive border-0' },
  }
  const m = map[status] || { label: status, cls: '' }
  return <Badge variant="secondary" className={m.cls}>{m.label}</Badge>
}

function RedeemStatusBadge({ status }: { status: string }) {
  if (status === 'completed' || status === 'delivered')
    return <Badge variant="default" className="bg-primary/15 text-primary hover:bg-primary/20">已完成</Badge>
  if (status === 'pending' || status === 'processing')
    return <Badge variant="secondary">处理中</Badge>
  if (status === 'cancelled') return <Badge variant="destructive">已取消</Badge>
  return <Badge variant="outline">{status}</Badge>
}

function CycleStatusBadge({ status }: { status: string }) {
  if (status === 'active') return <Badge variant="default" className="bg-primary/15 text-primary hover:bg-primary/20">进行中</Badge>
  if (status === 'completed') return <Badge variant="secondary">已完成</Badge>
  return <Badge variant="outline">{status}</Badge>
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>
  )
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-5 bg-muted rounded animate-pulse"
          style={{ width: `${100 - i * 5}%` }}
        />
      ))}
    </div>
  )
}

function estimateGradeAverage(scores: number[]) {
  return scores.map((s) => clamp(s + randomBetween(-6, 2), 0, 100))
}
function estimatePlatformAverage(scores: number[]) {
  return scores.map((s) => clamp(s + randomBetween(-10, -2), 0, 100))
}
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}
function randomBetween(a: number, b: number) {
  return Math.round(a + Math.random() * (b - a))
}

type MockTask = { title: string; category: string; status: string; points: number; time: string }
function generateMockRecentTasks(total: number): MockTask[] {
  if (total === 0) return []
  const count = Math.min(20, Math.max(5, total))
  const titles = ['整理房间', '阅读30分钟', '完成作业', '练习钢琴', '洗碗', '户外跑步', '数学练习册', '英语口语']
  const categories = ['家务', '学习', '运动', '艺术', '生活习惯']
  const statuses = ['completed', 'completed', 'completed', 'pending', 'in_progress', 'rejected']
  const out: MockTask[] = []
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 14)
    out.push({
      title: titles[i % titles.length],
      category: categories[i % categories.length],
      status: statuses[i % statuses.length],
      points: 5 + Math.floor(Math.random() * 30),
      time: dayjs().subtract(daysAgo, 'day').subtract(i, 'hour').format('MM/DD HH:mm'),
    })
  }
  return out
}

type MockTx = { delta: number; reason: string; balance: number; time: string }
function generateMockTransactions(detail: ChildDetailDTO | null): MockTx[] {
  if (!detail) return []
  const earned = detail.total_points_earned ?? 0
  if (earned === 0 && (detail.total_points_spent ?? 0) === 0) return []
  const count = 12
  const out: MockTx[] = []
  let bal = Math.max(0, detail.balance - 50)
  const reasonsInc = ['完成任务', '周期奖励', '成就奖励', '家长奖励']
  const reasonsDec = ['兑换商品', '消费', '惩罚扣除']
  for (let i = 0; i < count; i++) {
    const isInc = Math.random() > 0.35
    const delta = isInc
      ? 5 + Math.floor(Math.random() * 40)
      : -(10 + Math.floor(Math.random() * 80))
    bal = bal - delta
    out.push({
      delta,
      reason: isInc ? reasonsInc[i % reasonsInc.length] : reasonsDec[i % reasonsDec.length],
      balance: bal,
      time: dayjs().subtract(i * 2, 'day').subtract(i, 'hour').format('MM/DD HH:mm'),
    })
  }
  out.sort((a, b) => (a.time < b.time ? 1 : -1))
  let running = detail.balance
  return out.map((t) => {
    const row = { ...t, balance: running }
    running -= t.delta
    return row
  })
}

type MockRedeem = { name: string; points: number; status: string; time: string }
function generateMockRedeems(detail: ChildDetailDTO | null): MockRedeem[] {
  if (!detail || (detail.total_points_spent ?? 0) === 0) return []
  const items = [
    ['乐高小套装', 300], ['卡通贴纸包', 50], ['冰淇淋券', 120], ['课外书一本', 180],
    ['周末电影', 250], ['文具大礼包', 150], ['公园门票', 80], ['玩具车', 500],
  ]
  const statuses = ['completed', 'completed', 'processing', 'completed']
  const count = 8
  const out: MockRedeem[] = []
  for (let i = 0; i < count; i++) {
    const it = items[i % items.length]
    out.push({
      name: it[0] as string,
      points: it[1] as number,
      status: statuses[i % statuses.length],
      time: dayjs().subtract(i * 3, 'day').format('YYYY/MM/DD'),
    })
  }
  return out
}

type MockCycle = { index: number; theme: string; total: number; rate: number; start: string; end: string; status: string }
function generateMockCycles(count: number): MockCycle[] {
  if (!count) return []
  const themes = ['习惯养成', '阅读挑战', '家务小能手', '运动健将', '学习达人']
  const out: MockCycle[] = []
  for (let i = 0; i < count; i++) {
    const total = 10 + Math.floor(Math.random() * 10)
    const rate = 60 + Math.floor(Math.random() * 40)
    const start = dayjs().subtract((count - i) * 14, 'day')
    const status = i === count - 1 ? 'active' : 'completed'
    out.push({
      index: i + 1,
      theme: themes[i % themes.length],
      total,
      rate,
      start: start.format('YYYY/MM/DD'),
      end: start.add(13, 'day').format('YYYY/MM/DD'),
      status,
    })
  }
  return out.reverse()
}
