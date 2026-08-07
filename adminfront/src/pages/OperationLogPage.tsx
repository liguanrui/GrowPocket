import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Wrench } from 'lucide-react'

export function OperationLogPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">操作日志</h1>
          <p className="text-sm text-muted-foreground mt-1">
            记录所有管理员后台的关键操作
          </p>
        </div>
        <Badge variant="outline">阶段2 接入真实数据</Badge>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <CardTitle>操作记录</CardTitle>
            <CardDescription>
              按管理员、操作类型、时间范围筛选与导出功能将在阶段2实现
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
          <div className="flex flex-col items-center gap-2 text-center">
            <Wrench className="h-10 w-10 opacity-40" />
            <p className="text-sm">操作日志页面开发中，敬请期待</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
