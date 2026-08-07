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
  Loader2,
  Users,
  Coins,
  ListTodo,
  Gift,
} from 'lucide-react'
import { getFamilyDetail, toggleFamilyStatus } from '@/api/family'
import type { FamilyDetailDTO } from '@/types'
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

const ABILITY_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  '#f59e0b',
  '#8b5cf6',
  '#14b8a6',
  '#ec4899',
]

export function FamilyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const familyId = Number(id)
  const [detail, setDetail] = useState<FamilyDetailDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggleLoading, setToggleLoading] = useState(false)

  useEffect(() => {
    if (!familyId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await getFamilyDetail(familyId)
        if (!cancelled) setDetail(res)
      } catch (e: any) {
        if (!cancelled) {
          const msg = e?.response?.data?.message || e?.message || '加载家庭详情失败'
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
  }, [familyId])

  const overviewCards = useMemo(() => {
    if (!detail) return []
    const tasks = detail.recent_tasks || []
    const completed = tasks.filter((t: any) => t?.status === 'completed').length
    const rate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0
    const redeemCount = detail.family ? (detail as any).family?.redeem_count ?? 0 : 0
    const spentPoints = (detail.recent_transactions || [])
      .filter((t: any) => (t?.type || '').includes('expense') || (t?.delta || 0) < 0)
      .reduce((s: number, t: any) => s + Math.abs(t?.delta || 0), 0)
    return [
      {
        title: '任务总数',
        value: tasks.length,
        sub: `完成率 ${rate}%`,
        icon: ListTodo,
        tone: 'from-primary/10 to-primary/5 text-primary',
      },
      {
        title: '兑换订单',
        value: (detail.recent_redeems || []).length || redeemCount,
        sub: '累计消耗见下方流水',
        icon: Gift,
        tone: 'from-accent/30 to-accent/10 text-accent-foreground',
      },
      {
        title: '累计消耗积分',
        value: spentPoints,
        sub: '从最近交易流水估算',
        icon: Coins,
        tone: 'from-secondary to-secondary/60 text-secondary-foreground',
      },
      {
        title: '成员数',
        value: (detail.parents?.length || 0) + (detail.children?.length || 0),
        sub: `家长 ${detail.parents?.length || 0} · 孩子 ${detail.children?.length || 0}`,
        icon: Users,
        tone: 'from-primary/10 to-primary/5 text-primary',
      },
    ]
  }, [detail])

  const abilityRadarData = useMemo(() => {
    if (!detail?.children?.length) return []
    const first = detail.children.find(
      (c) => c.ability_scores && c.ability_scores.length > 0
    )
    if (!first) return []
    return first.ability_scores.map((dim, idx) => {
      const row: Record<string, any> = {
        dimension: dim.dimension_name,
        fullMark: 100,
      }
      detail.children.forEach((c) => {
        const score = c.ability_scores?.[idx]?.score ?? 0
        row[c.nickname] = score
      })
      return row
    })
  }, [detail])

  const handleToggle = async () => {
    if (!detail) return
    setToggleLoading(true)
    try {
      await toggleFamilyStatus(detail.family.id)
      const res = await getFamilyDetail(familyId)
      setDetail(res)
      window.dispatchEvent(
        new CustomEvent('admin-toast', {
          detail: { type: 'success', message: '状态更新成功' },
        })
      )
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '操作失败'
      window.dispatchEvent(
        new CustomEvent('admin-toast', {
          detail: { type: 'error', message: msg },
        })
      )
    } finally {
      setToggleLoading(false)
    }
  }

  const family = detail?.family
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => navigate('/families')}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回家庭列表
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {loading ? '加载中...' : family?.name || `家庭 #${familyId}`}
            </h1>
            {family &&
              (family.is_active ? (
                <Badge variant="default" className="bg-primary/15 text-primary hover:bg-primary/20">
                  启用
                </Badge>
              ) : (
                <Badge variant="destructive">停用</Badge>
              ))}
          </div>
          <p className="text-sm text-muted-foreground">
            家庭 ID #{familyId} · 创建时间：
            {family?.created_at ? dayjs(family.created_at).format('YYYY/MM/DD HH:mm') : '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/families')}
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            返回列表
          </Button>
          <Button
            variant={family?.is_active ? 'outline' : 'default'}
            onClick={handleToggle}
            disabled={toggleLoading || loading}
            size="sm"
          >
            {toggleLoading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {family?.is_active ? '停用家庭' : '启用家庭'}
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

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="members">成员</TabsTrigger>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="ability">能力</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">家长列表</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={3} />
              ) : !detail?.parents?.length ? (
                <EmptyHint text="该家庭暂无家长账号" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>家长</TableHead>
                      <TableHead>创建时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.parents.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          #{p.id}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              {p.avatar ? (
                                <img src={p.avatar} alt={p.nickname} />
                              ) : (
                                <AvatarFallback>
                                  {p.nickname?.charAt(0) || 'P'}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div className="font-medium">{p.nickname}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {p.created_at
                            ? dayjs(p.created_at).format('YYYY/MM/DD HH:mm')
                            : '—'}
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
              <CardTitle className="text-base">孩子列表</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={3} />
              ) : !detail?.children?.length ? (
                <EmptyHint text="该家庭暂无孩子档案" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>孩子</TableHead>
                      <TableHead>年级</TableHead>
                      <TableHead>年龄</TableHead>
                      <TableHead className="text-right">当前积分</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.children.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          #{c.id}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              {c.avatar ? (
                                <img src={c.avatar} alt={c.nickname} />
                              ) : (
                                <AvatarFallback>
                                  {c.nickname?.charAt(0) || 'C'}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <Link
                              to={`/children/${c.id}`}
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {c.nickname}
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell>{c.grade ? `${c.grade} 年级` : '—'}</TableCell>
                        <TableCell>{c.age ? `${c.age} 岁` : '—'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {c.balance.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {c.created_at
                            ? dayjs(c.created_at).format('YYYY/MM/DD HH:mm')
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/children/${c.id}`)}
                          >
                            查看详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
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
              : overviewCards.map((c) => {
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
                        <div className="text-xl font-bold">{c.value}</div>
                        <CardDescription className="text-xs">
                          {c.sub}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  )
                })}
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">最近任务（最近 20 条）</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <TableSkeleton rows={5} />
                ) : !detail?.recent_tasks?.length ? (
                  <EmptyHint text="暂无任务数据" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>任务标题</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">积分</TableHead>
                        <TableHead>时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail.recent_tasks || []).slice(0, 20).map((t: any, i: number) => {
                        const status = t?.status || 'unknown'
                        return (
                          <TableRow key={t?.id || i}>
                            <TableCell className="font-medium">
                              {t?.title || `任务 #${i + 1}`}
                            </TableCell>
                            <TableCell>
                              <TaskStatusBadge status={status} />
                            </TableCell>
                            <TableCell className="text-right">
                              {t?.points ?? 0}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {t?.created_at || t?.updated_at
                                ? dayjs(t.created_at || t.updated_at).format(
                                    'MM/DD HH:mm'
                                  )
                                : '—'}
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
                <CardTitle className="text-base">最近交易流水</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <TableSkeleton rows={5} />
                ) : !detail?.recent_transactions?.length ? (
                  <EmptyHint text="暂无交易数据" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>类型</TableHead>
                        <TableHead>描述</TableHead>
                        <TableHead className="text-right">变动</TableHead>
                        <TableHead>时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail.recent_transactions || []).slice(0, 20).map((tx: any, i: number) => {
                        const delta = Number(tx?.delta || 0)
                        return (
                          <TableRow key={tx?.id || i}>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={
                                  delta >= 0
                                    ? 'bg-primary/10 text-primary border-0'
                                    : 'bg-destructive/10 text-destructive border-0'
                                }
                              >
                                {delta >= 0 ? '收入' : '支出'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {tx?.reason || tx?.title || '—'}
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${
                                delta >= 0 ? 'text-primary' : 'text-destructive'
                              }`}
                            >
                              {delta >= 0 ? '+' : ''}
                              {delta}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {tx?.created_at
                                ? dayjs(tx.created_at).format('MM/DD HH:mm')
                                : '—'}
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">最近兑换订单</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={4} />
              ) : !detail?.recent_redeems?.length ? (
                <EmptyHint text="暂无兑换订单" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品</TableHead>
                      <TableHead>孩子</TableHead>
                      <TableHead className="text-right">消耗积分</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.recent_redeems || []).slice(0, 20).map((r: any, i: number) => (
                      <TableRow key={r?.id || i}>
                        <TableCell className="font-medium">
                          {r?.item_name || r?.name || `兑换 #${i + 1}`}
                        </TableCell>
                        <TableCell>{r?.child_name || r?.child_nickname || '—'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {r?.points ?? r?.cost ?? 0}
                        </TableCell>
                        <TableCell>
                          <RedeemStatusBadge status={r?.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {r?.created_at
                            ? dayjs(r.created_at).format('YYYY/MM/DD HH:mm')
                            : '—'}
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">孩子能力雷达对比</CardTitle>
              <CardDescription className="text-xs">
                同家庭内每个孩子 6 维能力叠加对比
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[420px]">
              {loading ? (
                <div className="h-full w-full rounded-md bg-gradient-to-r from-muted via-muted/50 to-muted animate-pulse" />
              ) : !abilityRadarData.length ? (
                <EmptyHint text="暂无能力维度数据" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={abilityRadarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="dimension" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    {(detail?.children || []).map((c, i) => (
                      <Radar
                        key={c.id}
                        name={c.nickname}
                        dataKey={c.nickname}
                        stroke={ABILITY_COLORS[i % ABILITY_COLORS.length]}
                        fill={ABILITY_COLORS[i % ABILITY_COLORS.length]}
                        fillOpacity={0.15}
                      />
                    ))}
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
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

function RedeemStatusBadge({ status }: { status?: string }) {
  const s = status || 'unknown'
  if (s === 'completed' || s === 'delivered')
    return <Badge variant="default" className="bg-primary/15 text-primary hover:bg-primary/20">已完成</Badge>
  if (s === 'pending' || s === 'processing')
    return <Badge variant="secondary">处理中</Badge>
  if (s === 'cancelled' || s === 'rejected')
    return <Badge variant="destructive">已取消</Badge>
  return <Badge variant="outline">{s}</Badge>
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
