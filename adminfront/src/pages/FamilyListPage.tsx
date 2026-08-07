import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Users, Plus, Search, AlertTriangle, Loader2 } from 'lucide-react'
import { listFamilies, toggleFamilyStatus } from '@/api/family'
import type { FamilyListDTO, Paged } from '@/types'
import dayjs from 'dayjs'

type StatusKey = 'all' | 'active' | 'inactive'
type SortKey = 'created_desc' | 'balance_desc' | 'tasks_desc' | 'children_desc'

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

export function FamilyListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [status, setStatus] = useState<StatusKey>('all')
  const [sort, setSort] = useState<SortKey>('created_desc')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [data, setData] = useState<Paged<FamilyListDTO> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [toggleOpen, setToggleOpen] = useState(false)
  const [toggleTarget, setToggleTarget] = useState<FamilyListDTO | null>(null)
  const [toggleReason, setToggleReason] = useState('')
  const [toggleLoading, setToggleLoading] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status, sort])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await listFamilies({
          page,
          page_size: pageSize,
          search: debouncedSearch || undefined,
          status,
          sort,
        })
        if (!cancelled) setData(res)
      } catch (e: any) {
        if (!cancelled) {
          const msg = e?.response?.data?.message || e?.message || '加载家庭列表失败'
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
  }, [page, debouncedSearch, status, sort])

  const totalPages = useMemo(() => {
    if (!data) return 0
    return Math.max(1, Math.ceil(data.total / data.page_size))
  }, [data])

  const openToggle = (row: FamilyListDTO) => {
    setToggleTarget(row)
    setToggleReason('')
    setToggleOpen(true)
  }

  const submitToggle = async () => {
    if (!toggleTarget) return
    setToggleLoading(true)
    try {
      await toggleFamilyStatus(
        toggleTarget.id,
        toggleReason.trim() || undefined
      )
      setToggleOpen(false)
      setToggleTarget(null)
      setToggleReason('')
      const res = await listFamilies({
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        status,
        sort,
      })
      setData(res)
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">家庭管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            查看和管理平台注册的家庭账号
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-col sm:flex-row gap-2 flex-1 max-w-3xl">
              <div className="relative sm:max-w-sm w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="家庭名称/家长昵称"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:max-w-xs w-full">
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as StatusKey)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="active">启用</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={sort}
                  onValueChange={(v) => setSort(v as SortKey)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="排序" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_desc">创建时间倒序</SelectItem>
                    <SelectItem value="balance_desc">积分 高→低</SelectItem>
                    <SelectItem value="tasks_desc">任务数 高→低</SelectItem>
                    <SelectItem value="children_desc">孩子数 多→少</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled>
                <Plus className="h-4 w-4 mr-1.5" />
                新建家庭
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>家庭名称</TableHead>
                  <TableHead className="text-right">家长数</TableHead>
                  <TableHead className="text-right">孩子数</TableHead>
                  <TableHead className="text-right">总积分余额</TableHead>
                  <TableHead className="text-right">任务总数</TableHead>
                  <TableHead className="text-right">兑换订单</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 10 }).map((__, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !data?.items?.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="h-40 text-center text-muted-foreground"
                    >
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/families/${row.id}`)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{row.id}
                      </TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{row.parent_count}</TableCell>
                      <TableCell className="text-right">{row.child_count}</TableCell>
                      <TableCell className="text-right font-medium">
                        {row.total_balance.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{row.task_count}</TableCell>
                      <TableCell className="text-right">{row.redeem_count}</TableCell>
                      <TableCell>
                        {row.is_active ? (
                          <Badge variant="default" className="bg-primary/15 text-primary hover:bg-primary/20">
                            启用
                          </Badge>
                        ) : (
                          <Badge variant="destructive">停用</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {row.created_at
                          ? dayjs(row.created_at).format('YYYY/MM/DD HH:mm')
                          : '—'}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/families/${row.id}`)}
                          >
                            查看详情
                          </Button>
                          <Button
                            size="sm"
                            variant={row.is_active ? 'outline' : 'default'}
                            onClick={() => openToggle(row)}
                          >
                            {row.is_active ? '停用' : '启用'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
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

      <Dialog open={toggleOpen} onOpenChange={setToggleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleTarget?.is_active ? '停用家庭' : '启用家庭'}：
              {toggleTarget?.name}
            </DialogTitle>
            <DialogDescription>
              {toggleTarget?.is_active
                ? '停用后该家庭账号将无法登录和操作，请谨慎操作。'
                : '启用后该家庭账号恢复正常使用。'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="toggle-reason">
              原因（可选，{toggleTarget?.is_active ? '停用' : '启用'}备注）
            </Label>
            <Input
              id="toggle-reason"
              placeholder="请输入备注原因..."
              value={toggleReason}
              onChange={(e) => setToggleReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={toggleLoading}>
                取消
              </Button>
            </DialogClose>
            <Button
              variant={toggleTarget?.is_active ? 'destructive' : 'default'}
              disabled={toggleLoading}
              onClick={submitToggle}
            >
              {toggleLoading && (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              )}
              确认{toggleTarget?.is_active ? '停用' : '启用'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
