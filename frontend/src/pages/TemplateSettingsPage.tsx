import { useState, useEffect } from 'react';
import { BackHeader } from '../components/Header';
import * as templateService from '../services/taskTemplates';
import type { TaskTemplate } from '../services/taskTemplates';
import { ListTodo, Plus, Edit2, Trash2, Star, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function TemplateSettingsPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await templateService.listTaskTemplates();
      setTemplates(result);
    } catch (e) {
      console.error('加载数据失败:', e);
    }
    setLoading(false);
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('确定删除这个任务模板吗？')) return;
    try {
      await templateService.deleteTaskTemplate(id);
      loadData();
    } catch (e) {
      console.error('删除任务模板失败:', e);
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-24">
      <BackHeader title="任务模板" />

      <div className="max-w-lg mx-auto px-4 -mt-3">
        <button
          onClick={() => navigate('/settings/templates/new')}
          className="w-full bg-card rounded-2xl p-4 shadow-sm mb-3 flex items-center justify-center gap-2 text-primary hover:bg-primary/5 transition-colors"
        >
          <Plus size={20} />
          <span className="font-medium">创建任务模板</span>
        </button>

        {loading ? (
          <div className="text-center py-8">加载中...</div>
        ) : templates.length > 0 ? (
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`bg-card rounded-2xl p-4 shadow-sm ${
                  !template.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-2xl">
                    {template.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary">{template.title}</span>
                      {!template.is_active && (
                        <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">已禁用</span>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-text-tertiary mt-1 line-clamp-1">{template.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Star size={12} />
                        +{template.points}积分
                      </span>
                      <span>{template.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/settings/templates/${template.id}/edit`)}
                      className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-text-secondary hover:bg-gray-200"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
            <ListTodo size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-text-primary font-medium">暂无任务模板</p>
            <p className="text-text-tertiary text-sm mt-1">点击上方按钮创建常见任务模板</p>
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}

export default TemplateSettingsPage;
