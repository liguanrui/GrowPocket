import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Star, Clock, Trophy, Sparkles, Loader2, Target } from 'lucide-react';
import { useChildStore } from '../stores/childStore';
import { useToastStore } from '../stores/toastStore';
import { masterChallengeApi } from '../services/masterChallenge';
import type { MasterChallengeTemplate, MasterChallengeInstance } from '../services/masterChallenge';
import { getAbilities } from '../services/ability';
import type { AbilityDimension } from '../services/ability';

// 模板分类 → 中文标签
const CATEGORY_LABELS: Record<string, string> = {
  family_cocreation: '家庭共创',
  creative_expression: '创意表达',
  community_service: '社区服务',
  financial_literacy: '财商启蒙',
};

function categoryLabel(code: string): string {
  return CATEGORY_LABELS[code] || code || '大师挑战';
}

// 解析 primary_dim_ids JSON 字符串为 ID 数组
function parseDimIds(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function MasterChallengePoolPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { children } = useChildStore();
  const toast = useToastStore();

  const childId = Number(searchParams.get('child_id')) || 0;
  const child = children.find((c) => c.id === childId);
  const childName = child?.nickname || '宝宝';

  const [templates, setTemplates] = useState<MasterChallengeTemplate[]>([]);
  const [instances, setInstances] = useState<MasterChallengeInstance[]>([]);
  const [dimensions, setDimensions] = useState<AbilityDimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!childId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [tplRes, instRes, dims] = await Promise.all([
          masterChallengeApi.getTemplates(childId),
          masterChallengeApi.getInstances(childId),
          getAbilities(),
        ]);
        if (!mounted) return;
        setTemplates(tplRes.items || []);
        setInstances(instRes.items || []);
        setDimensions(dims);
      } catch (e: any) {
        if (mounted) setError(e?.message || '加载失败');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [childId]);

  const dimNameMap = new Map<number, string>();
  dimensions.forEach((d) => dimNameMap.set(d.id, d.name));

  const handleStart = async (tpl: MasterChallengeTemplate) => {
    if (!childId) return;
    setStartingId(tpl.id);
    try {
      const res = await masterChallengeApi.start(childId, tpl.id);
      toast.success('已立项，开始挑战！');
      navigate(`/master-challenges/${res.instance.id}?child_id=${childId}`);
    } catch (e: any) {
      toast.error(e?.message || '立项失败');
    } finally {
      setStartingId(null);
    }
  };

  // 进行中实例（in_progress / submitted）
  const inProgressInstances = instances.filter(
    (i) => i.status === 'in_progress' || i.status === 'submitted',
  );

  const handleBack = () => navigate(-1);

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-br from-amber-400 to-yellow-500 text-white rounded-b-3xl pt-8 pb-10 px-5">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-8 h-8 -ml-1 text-white"
            aria-label="返回"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">大师挑战</h1>
          <Trophy size={22} />
        </div>
        <p className="text-white/85 text-sm mt-2 text-center">
          能力进阶后的高阶玩法 · {childName}
        </p>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-5">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-text-tertiary">
            <Loader2 size={28} className="animate-spin text-amber-400" />
            <span className="mt-2 text-sm">加载中...</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">{error}</div>
        ) : (
          <>
            {/* 进行中实例 */}
            {inProgressInstances.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <Sparkles size={14} className="text-amber-500" />
                  <span className="text-xs font-semibold text-text-primary">
                    进行中（{inProgressInstances.length}）
                  </span>
                </div>
                <div className="space-y-2">
                  {inProgressInstances.map((ins) => (
                    <button
                      key={ins.id}
                      onClick={() => navigate(`/master-challenges/${ins.id}?child_id=${childId}`)}
                      className="w-full text-left bg-card rounded-2xl p-4 shadow-sm border border-amber-100 active:scale-[0.99] transition-transform"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-text-primary line-clamp-1">
                          {ins.title}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 flex-shrink-0 ml-2">
                          {ins.status === 'submitted' ? '待验收' : '进行中'}
                        </span>
                      </div>
                      <div className="text-xs text-text-tertiary mt-1">
                        开始于 {new Date(ins.started_at).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 可挑战模板 */}
            {templates.length > 0 ? (
              <>
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <Target size={14} className="text-amber-500" />
                  <span className="text-xs font-semibold text-text-primary">
                    可挑战的模板（{templates.length}）
                  </span>
                </div>
                <div className="space-y-3">
                  {templates.map((tpl) => {
                    const dimNames = parseDimIds(tpl.primary_dim_ids)
                      .map((id) => dimNameMap.get(id))
                      .filter(Boolean) as string[];
                    return (
                      <div
                        key={tpl.id}
                        className="bg-card rounded-2xl p-4 shadow-sm border border-gray-100"
                      >
                        {/* 标题行 */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-text-primary">
                                {tpl.title}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                                {categoryLabel(tpl.category)}
                              </span>
                            </div>
                            {tpl.description && (
                              <p className="text-xs text-text-tertiary mt-1 line-clamp-2">
                                {tpl.description}
                              </p>
                            )}
                          </div>
                          <span className="text-lg flex-shrink-0">{tpl.icon || '🎯'}</span>
                        </div>

                        {/* 元信息：难度 / 周期 / 主轴维度 */}
                        <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-text-tertiary">
                          {/* 难度星级 */}
                          <span className="flex items-center gap-0.5">
                            <span className="text-text-tertiary">难度</span>
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star
                                key={i}
                                size={11}
                                className={
                                  i < tpl.difficulty_level
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-gray-300'
                                }
                              />
                            ))}
                          </span>
                          {/* 预计天数 */}
                          <span className="flex items-center gap-0.5">
                            <Clock size={11} />
                            {tpl.estimated_days} 天
                          </span>
                          {/* 主轴维度 */}
                          {dimNames.length > 0 && (
                            <span className="text-text-tertiary">
                              主轴：{dimNames.join('、')}
                            </span>
                          )}
                        </div>

                        {/* 底部：积分 + 立项按钮 */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                          <span className="flex items-center gap-1 text-sm font-medium text-amber-600">
                            <Trophy size={14} />
                            +{tpl.points_reward} 稀有积分
                          </span>
                          <button
                            onClick={() => handleStart(tpl)}
                            disabled={startingId === tpl.id}
                            className="flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-amber-400 to-yellow-500 text-white disabled:opacity-50 transition-opacity"
                          >
                            {startingId === tpl.id ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                立项中
                              </>
                            ) : (
                              <>立项挑战</>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              /* 无可用模板（未解锁） */
              <div className="bg-card rounded-2xl p-8 shadow-sm text-center mt-2">
                <div className="text-5xl mb-3">🌱</div>
                <div className="text-sm font-semibold text-text-primary">
                  继续提升能力，解锁大师挑战！
                </div>
                <p className="text-xs text-text-tertiary mt-2 leading-relaxed">
                  当某项能力维度达到精通（≥95 分）后，将解锁对应难度的大师挑战项目，
                  完成后可获得稀有积分与专属成长故事。
                </p>
                <button
                  onClick={() => navigate(`/growth?child_id=${childId}`)}
                  className="mt-4 px-5 py-2 rounded-full text-xs font-medium bg-primary text-white"
                >
                  去看能力成长
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default MasterChallengePoolPage;
