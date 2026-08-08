import { useEffect, useMemo, useState } from 'react'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HeartHandshake, Loader2, Search } from 'lucide-react'
import {
  completeDonation,
  confirmDonationReceived,
  listDonations,
  type CharityDonation,
} from '@/api/donation'
import dayjs from 'dayjs'

const STATUS_MAP: Record<number, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  1: { label: '待取件', variant: 'secondary' },
  2: { label: '已收件', variant: 'outline' },
  3: { label: '已完成', variant: 'default' },
}

export function DonationListPage() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<string>('0')
  const [page, setPage] = useState(1)
  const pageSize = 15
  const [items, setItems] = useState<CharityDonation[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<number | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<{ row: CharityDonation; action: 'receive' | 'complete' } | null>(null)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listDonations({
        page,
        page_size: pageSize,
        status: Number(status) || 0,
        keyword: keyword.trim() || undefined,
      })
      setItems(res.items || [])
      setTotal(res.total || 0)
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [page, status])

  const submitAction = async () => {
    if (!confirmTarget) return
    setActingId(confirmTarget.row.id)
    try {
      if (confirmTarget.action === 'receive') {
        await confirmDonationReceived(confirmTarget.row.id)
      } else {
        await completeDonation(confirmTarget.row.id)
      }
      setConfirmTarget(null)
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || '操作失败')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">公益捐赠</h1>
          <p className="text-sm text-muted-foreground mt-1">
            处理用户捐赠申请：确认收件 → 发放积分，并同步消息中心通知家庭
          </p>
        </div>
        <Badge variant="outline">闭环：申请 → 收件 → 积分</Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <div className="space-y-1 flex-1">
            <CardTitle>捐赠工单</CardTitle>
            <CardDescription>待取件确认收件后，再完成发放积分；用户会在「系统消息」收到进度通知</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="搜索孩子/项目/电话/地址"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPage(1)
                    void load()
                  }
                }}
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">全部状态</SelectItem>
                <SelectItem value="1">待取件</SelectItem>
                <SelectItem value="2">已收件</SelectItem>
                <SelectItem value="3">已完成</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="secondary"
              onClick={() => {
                setPage(1)
                void load()
              }}
            >
              查询
            </Button>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-sm p-3">
              {error}
            </div>
          )}

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>捐赠人</TableHead>
                  <TableHead>重量/积分</TableHead>
                  <TableHead>联系方式</TableHead>
                  <TableHead>地址</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>申请时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      <Loader2 className="inline h-5 w-5 animate-spin mr-2" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      暂无捐赠记录
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => {
                    const st = STATUS_MAP[row.status] || STATUS_MAP[1]
                    return (
                      <TableRow key={row.id}>
                        <TableCell>{row.id}</TableCell>
                        <TableCell className="font-medium">{row.project_title}</TableCell>
                        <TableCell>
                          <div>{row.child_name}</div>
                          <div className="text-xs text-muted-foreground">家庭 #{row.family_id}</div>
                        </TableCell>
                        <TableCell>
                          {row.weight}kg / {row.points} 积分
                        </TableCell>
                        <TableCell>
                          <div>{row.contact_name}</div>
                          <div className="text-xs text-muted-foreground">{row.contact_phone}</div>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate" title={row.address}>
                          {row.address || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {row.created_at ? dayjs(row.created_at).format('YYYY-MM-DD HH:mm') : '-'}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {row.status === 1 && (
                            <Button
                              size="sm"
                              disabled={actingId === row.id}
                              onClick={() => setConfirmTarget({ row, action: 'receive' })}
                            >
                              确认收件
                            </Button>
                          )}
                          {row.status === 2 && (
                            <Button
                              size="sm"
                              disabled={actingId === row.id}
                              onClick={() => setConfirmTarget({ row, action: 'complete' })}
                            >
                              发放积分
                            </Button>
                          )}
                          {row.status === 3 && (
                            <span className="text-xs text-muted-foreground">已闭环</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              共 {total} 条 · 第 {page}/{totalPages} 页
            </span>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmTarget?.action === 'receive' ? '确认收件' : '发放积分并完结'}
            </DialogTitle>
            <DialogDescription>
              {confirmTarget?.action === 'receive'
                ? `确认已上门取到「${confirmTarget?.row.project_title}」（${confirmTarget?.row.child_name}，${confirmTarget?.row.weight}kg）？确认后将通知用户家庭。`
                : `确认为「${confirmTarget?.row.child_name}」发放 ${confirmTarget?.row.points} 积分？发放后订单完结并通知用户。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)}>
              取消
            </Button>
            <Button onClick={() => void submitAction()} disabled={actingId != null}>
              {actingId != null ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default DonationListPage
