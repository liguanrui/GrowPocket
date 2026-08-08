import { useState, useEffect } from 'react';
import { BackHeader } from '../components/Header';
import * as templateService from '../services/taskTemplates';
import type { TaskTemplate, TemplateFilter } from '../services/taskTemplates';
import {
  ABILITY_DIMENSION_OPTIONS,
  getDimensionLabel,
  getDimensionIcon,
  getDifficultyLabel,
  getDifficultyColor,
  TEMPLATE_TYPE_OPTIONS,
  getTemplateTypeLabel,
  getTemplateTypeIcon,
  getTemplateTypeColor,
} from '../services/taskTemplates';
import type { PlazaList } from '../services/taskTemplates';
import { useToastStore } from '../stores/toastStore';
import {
  ListTodo,
  Plus,
  Edit2,
  Trash2,
  Star,
  RotateCcw,
  Share2,
  Store,
  CheckSquare,
  X,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type SourceFilter = 'all' | 'system' | 'custom';

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'system', label: '系统' },
  { value: 'custom', label: '自建' },
];

const AGE_OPTIONS = [
  { value: undefined as number | undefined, label: '全部' },
  { value: 6, label: '6-7岁' },
  { value: 7, label: '7-8岁' },
  { value: 8, label: '8-9岁' },
  { value: 9, label: '9-10岁' },
  { value: 10, label: '10-11岁' },
  { value: 11, label: '11-12岁' },
];

function getDimensionColor(id: number): string {
  return ABILITY_DIMENSION_OPTIONS.find((d) => d.value === id)?.color ?? '#999';
}

export function TemplateSettingsPage() {
  const navigate = useNavigate();
  const toast = useToastStore();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [ageFilter, setAgeFilter] = useState<number | undefined>(undefined);
  const [dimensionFilter, setDimensionFilter] = useState<number | undefined>(undefined);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  // C 多选模式
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const buildFilter = (): TemplateFilter => {
    const filter: TemplateFilter = {};
    // 类型优先级最高
    if (typeFilter) filter.template_type = typeFilter;
    if (ageFilter !== undefined) filter.age = ageFilter;
    if (dimensionFilter) filter.dimension_id = dimensionFilter;
    if (sourceFilter === 'system') filter.is_system = true;
    if (sourceFilter === 'custom') filter.is_system = false;
    return filter;
  };

  const loadData = async (filter?: TemplateFilter) => {
    setLoading(true);
    try {
      const result = await templateService.listTaskTemplates(filter);
      setTemplates(result);
    } catch (e) {
      console.error('加载数据失败:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData(buildFilter());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, ageFilter, dimensionFilter, sourceFilter]);

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('确定删除这个任务模板吗？')) return;
    try {
      await templateService.deleteTaskTemplate(id);
      loadData(buildFilter());
    } catch (e) {
      console.error('删除任务模板失败:', e);
    }
  };

  const handleResetTemplate = async (title: string) => {
    if (!confirm('确定将此系统模板恢复为默认设置吗？')) return;
    try {
      await templateService.resetSystemTemplate(title);
      toast.success('已恢复为默认设置');
      loadData(buildFilter());
    } catch (e: any) {
      toast.error(e.message || '恢复失败');
    }
  };

  const handleShare = async (id: number) => {
    try {
      await templateService.shareToPlaza(id);
      toast.success('已分享到模板广场');
      loadData(buildFilter());
    } catch (e: any) {
      toast.error(e.message || '分享失败');
    }
  };

  const handleRestoreAll = async () => {
    if (!confirm('确定恢复所有系统模板为默认设置吗？自定义修改将被覆盖。')) return;
    try {
      const res = await templateService.restoreAllSystemTemplates();
      toast.success(`已恢复 ${res.restored} 个系统模板`);
      loadData(buildFilter());
    } catch (e: any) {
      toast.error(e.message || '恢复失败');
    }
  };

  // C 多选批量启停
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(templates.map((t) => t.id)));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBatchToggle = async (isActive: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`确定${isActive ? '启用' : '停用'}选中的 ${ids.length} 个模板吗？`)) return;
    try {
      const res = await templateService.batchToggleByIDs(ids, isActive);
      toast.success(`已${isActive ? '启用' : '停用'} ${res.affected} 个模板`);
      exitSelectMode();
      loadData(buildFilter());
    } catch (e: any) {
      toast.error(e.message || '操作失败');
    }
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`确定删除选中的 ${ids.length} 个模板吗？此操作不可撤销。`)) return;
    try {
      let successCount = 0;
      for (const id of ids) {
        try {
          await templateService.deleteTaskTemplate(id);
          successCount++;
        } catch (e) {
          console.error('删除模板失败:', id, e);
        }
      }
      toast.success(`已删除 ${successCount} 个模板`);
      exitSelectMode();
      loadData(buildFilter());
    } catch (e: any) {
      toast.error(e.message || '操作失败');
    }
  };

  // D 模板广场
  const [plazaOpen, setPlazaOpen] = useState(false);
  const [plazaList, setPlazaList] = useState<TaskTemplate[]>([]);
  const [plazaLoading, setPlazaLoading] = useState(false);

  const handlePlaza = async () => {
    setPlazaOpen(true);
    setPlazaLoading(true);
    try {
      const res: PlazaList = await templateService.listPlaza(undefined, 1, 50);
      setPlazaList(res.list || []);
    } catch (e) {
      console.error('加载广场失败:', e);
    }
    setPlazaLoading(false);
  };

  const handleImportFromPlaza = async (id: number) => {
    try {
      await templateService.importFromPlaza(id);
      toast.success('已导入到我的模板');
      loadData(buildFilter());
    } catch (e: any) {
      toast.error(e.message || '导入失败');
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-24">
      <BackHeader title="任务模板" />

      <div className="max-w-lg mx-auto px-4 -mt-3">
        {/* 创建 + 多选按钮 */}
        <div className="flex gap-3 mb-3">
          <button
            onClick={() => navigate('/settings/templates/new')}
            className="flex-1 bg-card rounded-2xl p-4 shadow-sm flex items-center justify-center gap-2 text-primary hover:bg-primary/5 transition-colors"
          >
            <Plus size={20} />
            <span className="font-medium">创建任务模板</span>
          </button>
          {!selectMode ? (
            <button
              onClick={() => setSelectMode(true)}
              className="bg-card rounded-2xl p-4 shadow-sm flex items-center justify-center gap-2 text-text-secondary hover:bg-gray-50 transition-colors"
            >
              <CheckSquare size={20} />
              <span className="font-medium text-sm">多选</span>
            </button>
          ) : (
            <button
              onClick={exitSelectMode}
              className="bg-card rounded-2xl p-4 shadow-sm flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 transition-colors"
            >
              <X size={20} />
              <span className="font-medium text-sm">取消</span>
            </button>
          )}
        </div>

        {/* 筛选栏 */}
        <div className="bg-card rounded-2xl p-3 shadow-sm mb-3 space-y-3">
          {/* 模板类型筛选（优先级最高） */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <span className="text-xs text-text-tertiary shrink-0">类型</span>
            <button
              onClick={() => setTypeFilter(undefined)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === undefined ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'
              }`}
            >
              全部
            </button>
            {TEMPLATE_TYPE_OPTIONS.map((t) => {
              const selected = typeFilter === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setTypeFilter(t.value)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors`}
                  style={
                    selected
                      ? { backgroundColor: t.color, color: '#fff' }
                      : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  <span className="mr-1">{t.icon}</span>
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* 年龄筛选 */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <span className="text-xs text-text-tertiary shrink-0">年龄</span>
            {AGE_OPTIONS.map((opt) => {
              const selected = ageFilter === opt.value;
              return (
                <button
                  key={opt.label}
                  onClick={() => setAgeFilter(opt.value)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-text-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* 能力维度筛选 */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <span className="text-xs text-text-tertiary shrink-0">维度</span>
            <button
              onClick={() => setDimensionFilter(undefined)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                dimensionFilter === undefined
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              全部
            </button>
            {ABILITY_DIMENSION_OPTIONS.map((d) => {
              const selected = dimensionFilter === d.value;
              return (
                <button
                  key={d.value}
                  onClick={() => setDimensionFilter(d.value)}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style={
                    selected
                      ? { backgroundColor: d.color, color: '#fff' }
                      : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                  }
                >
                  <span className="mr-1">{d.icon}</span>
                  {d.label}
                </button>
              );
            })}
          </div>

          {/* 来源筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary shrink-0">来源</span>
            {SOURCE_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSourceFilter(s.value)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  sourceFilter === s.value
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-text-secondary'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 多选模式下的全选提示 */}
        {selectMode && templates.length > 0 && (
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs text-text-secondary">
              已选 {selectedIds.size} / {templates.length} 个
            </span>
            <button
              onClick={selectAll}
              className="text-xs text-primary font-medium"
            >
              全选
            </button>
          </div>
        )}

        {/* 模板列表 */}
        {loading ? (
          <div className="text-center py-8 text-text-tertiary">加载中...</div>
        ) : templates.length > 0 ? (
          <div className="space-y-3">
            {templates.map((template) => {
              const dimColor = getDimensionColor(template.ability_dimension_id);
              const diffColor = getDifficultyColor(template.difficulty);
              const typeColor = getTemplateTypeColor(template.template_type);
              const isSelected = selectedIds.has(template.id);
              return (
                <div
                  key={template.id}
                  className={`bg-card rounded-2xl p-4 shadow-sm transition-all ${
                    !template.is_active ? 'opacity-60' : ''
                  } ${selectMode && isSelected ? 'ring-2 ring-primary' : ''} ${
                    selectMode ? 'cursor-pointer' : ''
                  }`}
                  onClick={selectMode ? () => toggleSelect(template.id) : undefined}
                >
                  <div className="flex items-start gap-3">
                    {/* 多选 checkbox */}
                    {selectMode && (
                      <div
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-1 ${
                          isSelected
                            ? 'bg-primary border-primary'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check size={14} className="text-white" />}
                      </div>
                    )}
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-2xl shrink-0">
                      {template.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-text-primary">{template.title}</span>
                        {!template.is_active && (
                          <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                            已禁用
                          </span>
                        )}
                        {template.is_system && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                            系统
                          </span>
                        )}
                        {template.is_customized && (
                          <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                            已改
                          </span>
                        )}
                        {template.share_status === 'shared' && (
                          <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
                            已分享
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-text-tertiary mt-1 line-clamp-1">
                          {template.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-text-secondary flex-wrap">
                        <span className="flex items-center gap-1">
                          <Star size={12} />
                          +{template.points}积分
                        </span>
                        <span>{template.category}</span>
                        {/* 模板类型 */}
                        <span
                          className="px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${typeColor}1A`, color: typeColor }}
                        >
                          {getTemplateTypeIcon(template.template_type)}
                          {getTemplateTypeLabel(template.template_type)}
                        </span>
                        {/* 能力维度 */}
                        <span
                          className="px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${dimColor}1A`, color: dimColor }}
                        >
                          {getDimensionIcon(template.ability_dimension_id)}
                          {getDimensionLabel(template.ability_dimension_id)}
                        </span>
                        {/* 适龄范围 */}
                        <span className="text-text-tertiary">
                          {template.min_age}-{template.max_age}岁
                        </span>
                        {/* 难度 */}
                        <span
                          className="px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${diffColor}1A`, color: diffColor }}
                        >
                          {getDifficultyLabel(template.difficulty)}
                        </span>
                      </div>
                    </div>
                    {/* 非多选模式显示操作按钮 */}
                    {!selectMode && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => navigate(`/settings/templates/${template.id}/edit`)}
                          className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-text-secondary hover:bg-gray-200"
                          title="编辑"
                        >
                          <Edit2 size={14} />
                        </button>
                        {template.is_system && template.is_customized && (
                          <button
                            onClick={() => handleResetTemplate(template.title)}
                            className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 hover:bg-amber-100"
                            title="恢复默认"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleShare(template.id)}
                          className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600 hover:bg-green-100"
                          title="分享到广场"
                        >
                          <Share2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
            <ListTodo size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-text-primary font-medium">暂无任务模板</p>
            <p className="text-text-tertiary text-sm mt-1">点击上方按钮创建常见任务模板</p>
          </div>
        )}

        {/* 底部操作区 */}
        {!selectMode && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <button
              onClick={handleRestoreAll}
              className="bg-card rounded-2xl p-4 shadow-sm flex items-center justify-center gap-2 text-text-secondary hover:bg-gray-50 transition-colors"
            >
              <RotateCcw size={18} />
              <span className="text-sm font-medium">恢复全部系统模板</span>
            </button>
            <button
              onClick={handlePlaza}
              className="bg-card rounded-2xl p-4 shadow-sm flex items-center justify-center gap-2 text-primary hover:bg-primary/5 transition-colors"
            >
              <Store size={18} />
              <span className="text-sm font-medium">模板广场</span>
            </button>
          </div>
        )}

        <div className="h-8" />
      </div>

      {/* C 多选模式浮动操作栏（z-[60] 确保在 BottomNav 之上） */}
      {selectMode && (
        <div className="fixed bottom-[80px] left-0 right-0 z-[60] bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={exitSelectMode}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors shrink-0"
            >
              取消
            </button>
            <span className="text-sm text-text-secondary shrink-0">
              已选 {selectedIds.size} / {templates.length}
            </span>
            {!selectedIds.size || selectedIds.size < templates.length ? (
              <button
                onClick={selectAll}
                className="text-sm text-primary font-medium shrink-0"
              >
                全选
              </button>
            ) : null}
            <div className="flex-1" />
            <button
              onClick={() => handleBatchToggle(true)}
              disabled={selectedIds.size === 0}
              className="rounded-xl px-3 py-2 text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              启用
            </button>
            <button
              onClick={() => handleBatchToggle(false)}
              disabled={selectedIds.size === 0}
              className="rounded-xl px-3 py-2 text-sm font-medium bg-gray-400 text-white hover:bg-gray-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              停用
            </button>
            <button
              onClick={handleBatchDelete}
              disabled={selectedIds.size === 0}
              className="rounded-xl px-3 py-2 text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              删除
            </button>
          </div>
        </div>
      )}

      {/* D 模板广场 Modal */}
      {plazaOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={() => setPlazaOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-3xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-text-primary">模板广场</h2>
              <button
                onClick={() => setPlazaOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-text-secondary"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {plazaLoading ? (
                <div className="text-center py-8 text-text-tertiary">加载中...</div>
              ) : plazaList.length > 0 ? (
                <div className="space-y-3">
                  {plazaList.map((tpl) => {
                    const dimColor = getDimensionColor(tpl.ability_dimension_id);
                    return (
                      <div key={tpl.id} className="bg-gray-50 rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-2xl shrink-0">
                            {tpl.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-text-primary">{tpl.title}</span>
                              <span
                                className="px-2 py-0.5 rounded-full text-xs"
                                style={{ backgroundColor: `${dimColor}1A`, color: dimColor }}
                              >
                                {getDimensionIcon(tpl.ability_dimension_id)}
                                {getDimensionLabel(tpl.ability_dimension_id)}
                              </span>
                            </div>
                            {tpl.description && (
                              <p className="text-sm text-text-tertiary mt-1 line-clamp-2">{tpl.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
                              <span className="flex items-center gap-1">
                                <Star size={12} />+{tpl.points}积分
                              </span>
                              <span>{tpl.category}</span>
                              <span>
                                {tpl.min_age}-{tpl.max_age}岁
                              </span>
                              <span>{getDifficultyLabel(tpl.difficulty)}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleImportFromPlaza(tpl.id)}
                            className="shrink-0 rounded-xl px-4 py-2 text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
                          >
                            导入
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Store size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-text-primary font-medium">广场暂无分享模板</p>
                  <p className="text-text-tertiary text-sm mt-1">分享你的模板到广场，让更多家庭使用</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplateSettingsPage;
