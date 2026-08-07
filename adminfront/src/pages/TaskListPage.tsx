import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ListTodo, Wrench } from 'lucide-react'

export function TaskListPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">任务管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            查看平台任务完成情况、模板库与申诉处理
          </p>
        </div>
        <Badge variant="outline">阶段2 接入真实数据</Badge>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <ListTodo className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <CardTitle>任务中心</CardTitle>
            <CardDescription>
              任务列表、详情、任务模板管理、审核申诉记录将在阶段2实现
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
          <div className="flex flex-col items-center gap-2 text-center">
            <Wrench className="h-10 w-10 opacity-40" />
            <p className="text-sm">任务管理页面开发中，敬请期待</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
