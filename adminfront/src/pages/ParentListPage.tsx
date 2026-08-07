import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Search, AlertTriangle, UserCircle } from 'lucide-react'
import { listParents } from '@/api/family'
import type { Paged, ParentListItem } from '@/types'
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

export function ParentListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [familyId, setFamilyId] = useState('')
  const debouncedFamily = useDebouncedValue(familyId, 300)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [data, setData] = useState<Paged<ParentListItem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, debouncedFamily])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await listParents({
          page,
          page_size: pageSize,
          search: debouncedSearch || undefined,
          family_id: debouncedFamily ? Number(debouncedFamily) : undefined,
        })
        if (!cancelled) setData(res)
      } catch (e: any) {
        if (!cancelled) {
          const msg = e?.response?.data?.message || e?.message || '加载家长列表失败'
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
  }, [page, debouncedSearch, debouncedFamily])

  const totalPages = useMemo(() => {
    if (!data) return 0
    return Math.max(1, Math.ceil(data.total / data.page_size))
  }, [data])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">家长管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            查看和管理平台的家长账号
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
          <div className="flex flex-col sm:flex-row gap-2 sm:max-w-2xl w-full">
            <div className="relative sm:max-w-sm w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="家长昵称"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Input
              placeholder="家庭 ID（可选）"
              inputMode="numeric"
              value={familyId}
              onChange={(e) =>
                setFamilyId(e.target.value.replace(/\D/g, '').slice(0, 8))
              }
              className="sm:max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>家长</TableHead>
                  <TableHead>所属家庭</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !data?.items?.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-40 text-center text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <UserCircle className="h-8 w-8 opacity-40" />
                        暂无数据
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{row.id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {row.avatar ? (
                              <img src={row.avatar} alt={row.nickname} />
                            ) : (
                              <AvatarFallback>
                                {row.nickname?.charAt(0) || 'P'}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="font-medium">{row.nickname}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/families/${row.family_id}`}
                          className="hover:text-primary transition-colors"
                        >
                          家庭 #{row.family_id}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {row.created_at
                          ? dayjs(row.created_at).format('YYYY/MM/DD HH:mm')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/families/${row.family_id}`)}
                          >
                            查看家庭
                          </Button>
                          <Button size="sm" variant="outline" disabled>
                            重置密码
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
