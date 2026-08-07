import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar'
import { Search, AlertTriangle, Baby } from 'lucide-react'
import { listChildren } from '@/api/child'
import type { ChildListItem, Paged } from '@/types'
import dayjs from 'dayjs'

type GradeKey = 'all' | '1' | '2' | '3' | '4' | '5' | '6'

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

export function ChildListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [grade, setGrade] = useState<GradeKey>('all')
  const [familyId, setFamilyId] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [data, setData] = useState<Paged<ChildListItem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, grade, familyId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await listChildren({
          page,
          page_size: pageSize,
          search: debouncedSearch || undefined,
          grade: grade === 'all' ? undefined : Number(grade),
          family_id: familyId ? Number(familyId) : undefined,
        })
        if (!cancelled) setData(res)
      } catch (e: any) {
        if (!cancelled) {
          const msg = e?.response?.data?.message || e?.message || '加载孩子列表失败'
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
  }, [page, debouncedSearch, grade, familyId])

  const totalPages = useMemo(() => {
    if (!data) return 0
    return Math.max(1, Math.ceil(data.total / data.page_size))
  }, [data])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">孩子管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            查看平台所有孩子档案与成长数据
          </p>
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

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative sm:max-w-sm w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="孩子昵称"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:max-w-lg w-full">
              <Select
                value={grade}
                onValueChange={(v) => setGrade(v as GradeKey)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="年级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部年级</SelectItem>
                  <SelectItem value="1">1 年级</SelectItem>
                  <SelectItem value="2">2 年级</SelectItem>
                  <SelectItem value="3">3 年级</SelectItem>
                  <SelectItem value="4">4 年级</SelectItem>
                  <SelectItem value="5">5 年级</SelectItem>
                  <SelectItem value="6">6 年级</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="家庭 ID（可选）"
                inputMode="numeric"
                value={familyId}
                onChange={(e) =>
                  setFamilyId(e.target.value.replace(/\D/g, '').slice(0, 8))
                }
                className="col-span-1"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>孩子</TableHead>
                  <TableHead>所属家庭</TableHead>
                  <TableHead>年级</TableHead>
                  <TableHead>年龄</TableHead>
                  <TableHead className="text-right">当前积分</TableHead>
                  <TableHead className="w-56">任务完成率</TableHead>
                  <TableHead className="text-right">兑换次数</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((__, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !data?.items?.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-40 text-center text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Baby className="h-8 w-8 opacity-40" />
                        暂无数据
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((row) => {
                    const total = row.stats?.task_total || 0
                    const done = row.stats?.task_completed || 0
                    const rate = total ? Math.round((done / total) * 100) : 0
                    return (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/children/${row.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              {row.avatar ? (
                                <img src={row.avatar} alt={row.nickname} />
                              ) : (
                                <AvatarFallback>
                                  {row.nickname?.charAt(0) || 'C'}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div className="font-medium">{row.nickname}</div>
                          </div>
                        </TableCell>
                        <TableCell
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            to={`/families/${row.family_id}`}
                            className="hover:text-primary transition-colors"
                          >
                            {row.family_name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {row.grade ? `${row.grade} 年级` : '—'}
                        </TableCell>
                        <TableCell>{row.age ? `${row.age} 岁` : '—'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {row.balance.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {done}/{total}
                              </span>
                              <span className="font-medium">{rate}%</span>
                            </div>
                            <SimpleProgress value={rate} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.stats?.redeem_count ?? 0}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {row.created_at
                            ? dayjs(row.created_at).format('YYYY/MM/DD')
                            : '—'}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/children/${row.id}`)}
                          >
                            查看详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.total > 0 && (
            <PageNav
              page={page}
              totalPages={totalPages}
              onChange={setPage}
              total={data.total}
              pageSize={pageSize}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PageNav({
  page,
  totalPages,
  onChange,
  total,
  pageSize,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
  total: number
  pageSize: number
}) {
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const pages = buildPageList(page, totalPages)
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="text-xs text-muted-foreground">
        共 {total} 条，当前 {from}-{to}
      </div>
      <Pagination className="mx-0 justify-start sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => page > 1 && onChange(page - 1)}
              aria-disabled={page <= 1}
              className={page <= 1 ? 'opacity-50 pointer-events-none' : ''}
            />
          </PaginationItem>
          {pages.map((p, idx) =>
            p === '...' ? (
              <PaginationItem key={`e${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  isActive={p === page}
                  onClick={() => onChange(p as number)}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext
              onClick={() => page < totalPages && onChange(page + 1)}
              aria-disabled={page >= totalPages}
              className={page >= totalPages ? 'opacity-50 pointer-events-none' : ''}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}

function buildPageList(
  current: number,
  total: number
): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) pages.push('...')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < total - 1) pages.push('...')
  pages.push(total)
  return pages
}

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  const timer = useRef<number | null>(null)
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setDebounced(value), delay)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [value, delay])
  return debounced
}
