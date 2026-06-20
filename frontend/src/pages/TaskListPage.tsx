import { useState, useEffect } from 'react';
import { Plus, Clock, CheckCircle2, Inbox, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import * as tasksService from '../services/tasks';
import type { Task, TaskStatus } from '../services/tasks';

const STATUS_TABS: { id: 'all' | TaskStatus; label: string; icon: any }[] = [
  { id: 'all', label: '全部', icon: FileText },
  { id: 1, label: '进行中', icon: Clock },
  { id: 2, label: '待验收', icon: Inbox },
  { id: 3, label: '已完成', icon: CheckCircle2 },
  { id: 4, label: '已拒绝', icon: CheckCircle2 },
];

export function TaskListPage() {
  const navigate = useNavigate();
  const childStore = useChildStore();
  const [statusTab, setStatusTab] = useState<'all' | TaskStatus>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        await childStore.fetchChildren();
        const child = useChildStore.getState().getCurrentChild();
        if (!child) {
          if (mounted) setLoading(false);
          return;
        }

        const params: { childId: number; status?: TaskStatus; page: number; pageSize: number } = {
          childId: child.id,
          page: 1,
          pageSize: 50,
        };
        if (statusTab !== 'all') {
          params.status = statusTab;
        }

        const result = await tasksService.getTasks(params);
        if (mounted) {
          setTasks(result.items);
        }
      } catch (e: any) {
        if (mounted) setError(e.message || '加载失败');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [statusTab]);

  const currentChild = useChildStore.getState().getCurrentChild();
  const childrenList = useChildStore.getState().children;

  const inProgressCount = tasks.filter((t) => t.status === 1).length;
  const submittedCount = tasks.filter((t) => t.status === 2).length;
  const completedCount = tasks.filter((t) => t.status === 3).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm">
          <div className="text-danger font-medium">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-xl"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!currentChild) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm">
          <div className="text-text-primary font-medium">暂无孩子档案</div>
          <p className="text-sm text-text-tertiary mt-2">请先添加孩子</p>
          <button
            onClick={() => navigate('/family')}
            className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-xl"
          >
            添加孩子
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-6 pb-6 px-4 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-white">任务列表</h1>
              <p className="text-white/80 text-sm mt-0.5">
                {currentChild.nickname} 的所有任务
              </p>
            </div>
            <button
              onClick={() => navigate('/tasks/new')}
              className="flex items-center gap-1 px-3 py-2 bg-white/20 text-white text-sm rounded-xl hover:bg-white/30 transition-colors"
            >
              <Plus size={16} /> 新建
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-5">
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <div className="text-white text-2xl font-bold">{tasks.length}</div>
              <div className="text-white/70 text-xs mt-0.5">全部</div>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <div className="text-white text-2xl font-bold">{inProgressCount}</div>
              <div className="text-white/70 text-xs mt-0.5">进行中</div>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <div className="text-yellow-200 text-2xl font-bold">{submittedCount}</div>
              <div className="text-white/70 text-xs mt-0.5">待验收</div>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <div className="text-emerald-200 text-2xl font-bold">{completedCount}</div>
              <div className="text-white/70 text-xs mt-0.5">已完成</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-2 mb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex gap-2 overflow-x-auto bg-card rounded-2xl p-1 shadow-sm">
            {STATUS_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={String(tab.id)}
                  onClick={() => setStatusTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap text-xs font-medium transition-all flex-1 justify-center ${
                    statusTab === tab.id
                      ? 'bg-primary text-white shadow'
                      : 'text-text-secondary hover:bg-gray-50'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto">
        {tasks.length > 0 ? (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => navigate(`/task/${task.id}`)}
                className="cursor-pointer bg-card rounded-2xl p-4 shadow-sm"
              >
                <div className="font-medium text-text-primary">{task.title}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-text-tertiary">{task.points} 积分</span>
                  <span className="text-xs text-text-tertiary">
                    {task.status === 1 ? '进行中' : task.status === 2 ? '待验收' : task.status === 3 ? '已完成' : '已拒绝'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-card rounded-2xl shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-3xl">📋</span>
            </div>
            <p className="text-text-primary font-medium">暂无任务</p>
            <p className="text-text-tertiary text-sm mt-1">
              {currentChild.nickname} 这个分类下没有任务
            </p>
            <button
              onClick={() => navigate('/tasks/new')}
              className="mt-4 px-4 py-2 bg-primary text-white text-sm rounded-xl hover:bg-primary-dark transition-colors"
            >
              发布任务
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => navigate('/tasks/new')}
        className="fixed bottom-24 right-4 w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-40"
      >
          <Plus size={24} />
        </button>
    </div>
  );
}

export default TaskListPage;
