import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Wrench } from 'lucide-react'

export function AchievementPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">成就体系</h1>
          <p className="text-sm text-muted-foreground mt-1">
            配置成就徽章、挑战任务与解锁规则
          </p>
        </div>
        <Badge variant="outline">阶段2 接入真实数据</Badge>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <CardTitle>成就配置中心</CardTitle>
            <CardDescription>
              徽章、里程碑、大师挑战模板等配置能力将在阶段2实现
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
          <div className="flex flex-col items-center gap-2 text-center">
            <Wrench className="h-10 w-10 opacity-40" />
            <p className="text-sm">成就体系页面开发中，敬请期待</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
