import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Share2, Sparkles, RefreshCw, Image as ImageIcon, Calendar, Star, Trophy, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useChildStore } from '../stores/childStore';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { IPPAvatar } from '../components/IPPAvatar';
import {
  generateStory,
  getStory,
  getStoryById,
  getCurrentCycle,
  getCycleTasks,
  parseAbilitySummary,
  parseAbilitySummaryAny,
  parsePhotoUrls,
} from '../services/growthStory';
import type { GrowthStory, ProjectAbilitySummary } from '../services/growthStory';
import type { Task } from '../services/tasks';
import * as communityService from '../services/community';
// V3.1 思路 C：IP 不再按成长指数切形态，无需 getGrowthIndex import

// 生成中轮播文案
const LOADING_TIPS = [
  '正在回顾本阶段的成长足迹...',
  '正在整理能力提升数据...',
  '正在挑选精彩瞬间...',
  '正在撰写成长故事...',
];

export function GrowthStoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const childStore = useChildStore();
  const authStore = useAuthStore();
  const isParent = authStore.user?.role === 'parent';
  const toast = useToastStore();

  const childId = Number(searchParams.get('child_id')) || 0;
  const cycleIdParam = searchParams.get('cycle_id');
  const storyIdParam = searchParams.get('story_id'); // 新增：按故事主键 ID 查询（project 类型必须用）

  const child = childStore.children.find((c) => c.id === childId) || null;
  const childName = child?.nickname || '宝宝';

  const [story, setStory] = useState<GrowthStory | null>(null);
  const [cycleTasks, setCycleTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const mountedRef = useRef(true);
  // 每一轮 effect 的唯一请求 key：StrictMode 下 cleanup 会在同一轮 mount 后快速触发，
  // 用 key 来区分「本轮到没轮到我执行」，避免旧轮次的 finally 把新轮次 generatingRef 给误清
  // 也避免 StrictMode 的第二次 effect 因为 generatingRef=true 直接 return（死锁）
  // 额外加 effectRunId：即使 [storyIdParam, cycleIdParam, childId, reloadKey] 全都一样，
  // 每一次 useEffect 运行（包括 StrictMode 的模拟重挂载）都会有独有的 runId，
  // 保证第一轮的 finally 不会误把第二轮的 generatingRef 给清掉（否则第二轮 setStory 条件会失败）
  const generatingRef = useRef<string | null>(null);
  const effectRunIdRef = useRef(0);

  // 轮播加载文案
  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => {
      if (mountedRef.current) {
        setTipIndex((i) => (i + 1) % LOADING_TIPS.length);
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 生成/拉取成长故事
  useEffect(() => {
    let cancelled = false;
    // 每一轮 useEffect 调用都有独有的 runId（StrictMode 的模拟 re-mount 会有不同的 runId）
    effectRunIdRef.current += 1;
    const effectRunId = effectRunIdRef.current;
    // 生成唯一请求 ID：effectRunId 保证 StrictMode 两轮也不会撞，避免第一轮 finally 误清第二轮锁
    const reqKey = `s${storyIdParam ?? 'x'}-c${cycleIdParam ?? 'g'}-${childId}-${reloadKey}-r${effectRunId}`;
    async function load() {
      if (!childId) {
        setError('缺少孩子信息');
        setLoading(false);
        return;
      }
      // 【修复点 1】首次进入页面时（直接刷新 / 通过外链），childStore 可能还没有 fetch，
      // 先确保 children 列表存在，避免 childName 退化成 '宝宝' 以及后续权限校验误判。
      // 增加 loading 并发锁保护：若 childStore 已在请求 fetchChildren 中，就不要重复触发
      try {
        if (childStore.children.length === 0 && !childStore.loading) {
          await childStore.fetchChildren();
        }
      } catch {
        // fetchChildren 失败不阻塞：URL 里已经有 child_id，仍可继续请求后端故事 API
      }

      // 防止同一轮次重复进入（多次快速 setState 触发 effect rerun，但 key 相同）
      // 注意：generatingRef 存的是 key，不是布尔。相同 key 才算重复，不同 key（reload 之后）会正常覆盖
      if (generatingRef.current === reqKey) {
        return;
      }
      generatingRef.current = reqKey;
      setLoading(true);
      setError(null);
      try {
        let result: GrowthStory;
        let cycleIdForTasks: number | null = null;

        if (storyIdParam) {
          // ===== 分支 A：URL 带 story_id（精确查询模式）—— cycle / project 通用
          const storyId = Number(storyIdParam);
          if (!storyId || isNaN(storyId)) {
            throw new Error('无效的故事 ID');
          }
          try {
            result = await getStoryById(storyId);
          } catch (histErr: any) {
            const msg = histErr?.message || '';
            if (msg.includes('不存在') || msg.includes('未找到') || msg.includes('NotFound') || msg.includes('404')) {
              throw new Error(
                isParent
                  ? '这条成长故事记录不存在，可能已被删除或 ID 有误。'
                  : '这条成长故事不存在哦。',
              );
            }
            throw histErr;
          }
          // project 类型 cycle_id=0，不要去调 getCycleTasks
          if ((result.type || 'cycle') === 'cycle' && result.cycle_id > 0) {
            cycleIdForTasks = result.cycle_id;
          }
        } else {
          // ===== 分支 B：无 story_id → 沿用 cycle 模式（原逻辑）
          let cycleId: number | null = cycleIdParam ? Number(cycleIdParam) : null;
          const isHistorical = !!cycleIdParam;
          if (!cycleId || isNaN(cycleId)) {
            const current = await getCurrentCycle(childId);
            cycleId = current.cycle?.id ?? null;
            if (!cycleId) {
              throw new Error('未找到当前成长周期');
            }
          }

          if (isHistorical) {
            // 历史回看模式：只读已有故事，绝不回落触发生成。
            try {
              result = await getStory(cycleId);
            } catch (histErr: any) {
              const msg = histErr?.message || '';
              if (msg.includes('不存在') || msg.includes('未找到') || msg.includes('NotFound') || msg.includes('404')) {
                throw new Error(
                  isParent
                    ? '这个阶段还没有生成成长故事，请到「成长」主页点击该阶段的“生成回顾”来生成。'
                    : '这个阶段的成长故事还没有生成，请让家长点击“生成回顾”。',
                );
              }
              throw histErr;
            }
          } else {
            // 生成模式：触发生成（仅家长权限）
            result = await generateStory(cycleId, childId, childName);
          }
          cycleIdForTasks = cycleId;
        }

        // 【修复点 3】拿到故事后做归属/有效性校验：
        //   a) request() 在后端返回 null 时会 fallback 到空对象 {}，
        //      这里用 id 字段是否存在判断是不是真的拿到了故事记录
        //   b) 故事的 child_id 必须与 URL 参数的 child_id 一致，防止串号
        if (!result || typeof result.id !== 'number' || result.id <= 0) {
          throw new Error('成长故事记录无效，请重新进入本页');
        }
        if (Number(result.child_id) !== childId) {
          throw new Error(
            isParent
              ? '这条成长故事不属于当前选择的孩子，请到「成长」主页选择正确的阶段再查看。'
              : '这条成长故事不属于你，已自动返回。',
          );
        }

        // 拉取周期内任务时间线（仅 cycle 类型且有 cycle_id）
        // project 类型故事没有"周期任务"概念，跳过以免 404
        let tasks: Task[] = [];
        if (cycleIdForTasks != null && cycleIdForTasks > 0) {
          try {
            tasks = await getCycleTasks(cycleIdForTasks);
            if (!Array.isArray(tasks)) tasks = [];
          } catch (tasksErr) {
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console
              console.warn('[GrowthStoryPage] 任务时间线加载失败，已跳过：', tasksErr);
            }
          }
        }
        // 注意：1) 组件必须仍然挂载；2) 当前 effect 没有被 cleanup（没被取消）；3) 同一轮 reqKey 没被后来的轮次覆盖
        // 只要这三条满足，才真正把结果写进 state（防止 StrictMode + 并发请求产生的竞态）
        if (mountedRef.current && !cancelled && generatingRef.current === reqKey) {
          setStory(result);
          setCycleTasks(tasks);
        }
      } catch (e: any) {
        if (mountedRef.current && !cancelled && generatingRef.current === reqKey) {
          const msg = e.message || '成长故事加载失败';
          // 开发模式下把完整错误堆栈打到 Console，便于排查
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.error('[GrowthStoryPage] 加载失败：', e);
          }
          setError(msg);
        }
      } finally {
        // 同样只在 reqKey 匹配的情况下清 generating 锁和 loading
        // （如果后来的轮次已经覆盖了 generatingRef，就不应该动新轮次的状态，让它的 finally 自己清）
        if (generatingRef.current === reqKey) {
          generatingRef.current = null;
          if (mountedRef.current) {
            setLoading(false);
          }
        }
      }
    }
    load();
    return () => {
      cancelled = true;
      // StrictMode / 快速切 route 时，本 effect 会被提前 cleanup
      // 如果当前 flying 的请求恰好属于这一轮，直接释放锁，让下一轮 re-mount / 新 reqKey 的 load() 能正常启动
      if (generatingRef.current === reqKey) {
        generatingRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, cycleIdParam, storyIdParam, reloadKey]);

  // 分享到社区
  async function handleShare() {
    if (!story) return;
    setSharing(true);
    try {
      const shareContent = `${story.title}\n${story.content.slice(0, 200)}`;
      await communityService.createShare({
        share_type: 'growth_story',
        content: shareContent,
        growth_story_id: story.id,
        ability_summary: story.ability_summary,
        child_name: childName,
      });
      toast.success('已分享到社区');
      navigate('/community');
    } catch (e: any) {
      toast.error(e.message || '分享失败');
    } finally {
      setSharing(false);
    }
  }

  function handleRetry() {
    setStory(null);
    setError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  // 加载中
  if (loading) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex flex-col items-center justify-center px-6">
        {/* 思路 C 专属场景：成长故事生成 AI Loading */}
        <IPPAvatar animationName="loading" size={88} />
        <h2 className="text-lg font-semibold text-text-primary mt-6">正在生成成长故事</h2>
        <p className="text-sm text-text-tertiary mt-2">{LOADING_TIPS[tipIndex]}</p>
        <div className="w-48 h-1 bg-gray-100 rounded-full mt-6 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-green-600 rounded-full animate-pulse"
            style={{ width: '60%' }}
          />
        </div>
        {/* 开发模式下把所有关键诊断信息钉在 Loading 底部，方便排查为什么迟迟不显示 */}
        {import.meta.env.DEV && (
          <div className="mt-8 w-full max-w-md text-[10px] text-text-tertiary bg-gray-50 rounded-lg p-3 text-left space-y-1">
            <div>[dev] URL  child_id={childId} cycle_id={cycleIdParam ?? '(generate mode)'} story_id={storyIdParam ?? '(none)'}</div>
            <div>[dev] childStore.children.length={childStore.children.length} loading={childStore.loading} selected={child?.id ?? '-'}</div>
            <div>[dev] story.id={story?.id ?? '-'} story.child_id={story?.child_id ?? '-'} story.type={story?.type ?? 'cycle'} cycle_tasks={cycleTasks.length}</div>
            <div>[dev] err={error ?? 'none'}</div>
          </div>
        )}
      </div>
    );
  }

  // 错误
  if (error || !story) {
    const userFacingMsg =
      error && error.includes('暂未配置')
        ? '系统 AI 服务暂未配置，暂时无法为你生成成长故事正文。'
        : error || '成长故事加载失败';
    const isAIMissing = error?.includes('暂未配置') || false;
    return (
      <div className="min-h-screen bg-bg pb-24 flex flex-col items-center justify-center px-6">
        <IPPAvatar animationName="comfort" size={72} />
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm max-w-sm w-full mt-6">
          <div className="text-base font-semibold text-text-primary">这一阶段的故事还没准备好</div>
          <div className="text-sm text-text-tertiary mt-2 whitespace-pre-line leading-relaxed">
            {userFacingMsg}
            {isAIMissing ? (
              <>
                {'\n\n'}
                请先让管理员在 .env 中配置 AI_API_KEY，之后再回到这里看故事。
                你依然可以在「成长」里查看能力指数、阶段目标和完成的任务哦。
              </>
            ) : null}
          </div>
          {error && !isAIMissing && (
            <div className="mt-3 text-xs text-text-tertiary bg-gray-50 rounded-lg px-3 py-2 text-left">
              详情：{error}
            </div>
          )}
          {/* 开发模式诊断面板：把所有运行时状态直接显示，不用开 Console 猜 */}
          {import.meta.env.DEV && (
            <div className="mt-4 text-[10px] text-text-tertiary bg-amber-50 border border-amber-100 rounded-lg p-3 text-left space-y-1">
              <div className="font-medium text-amber-700">[dev 诊断] 为什么显示错误？</div>
              <div>· URL child_id={childId} cycle_id={cycleIdParam ?? '(generate mode)'} story_id={storyIdParam ?? '(none)'}</div>
              <div>· auth.role={authStore.user?.role ?? '-'} isParent={isParent}</div>
              <div>· childStore  children.len={childStore.children.length}  loading={childStore.loading}</div>
              <div>· child={child ? `id=${child.id} name=${child.nickname}` : 'NULL'}</div>
              <div>· story={story ? `id=${story.id} child_id=${story.child_id} cycle_id=${story.cycle_id} type=${story.type || 'cycle'} title=${story.title?.slice(0, 20) || '""'}` : 'NULL'}</div>
              <div>· cycleTasks.len={cycleTasks.length} {Array.isArray(cycleTasks) ? '' : 'NOT AN ARRAY!!'}</div>
              <div>· current error = {error || '(无 error，但 story 为 null，说明是 !story 分支进来的)'}</div>
              <div className="pt-1 text-[10px] text-amber-600">提示：请查看 Console 搜 [GrowthStoryPage]，或打开 Network 看 /api/growth-stories 实际返回。</div>
            </div>
          )}
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={handleRetry}
              className="w-full px-5 py-2.5 bg-primary text-white text-sm rounded-xl flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} /> 重新生成
            </button>
            <button
              onClick={() => navigate('/growth')}
              className="w-full px-5 py-2.5 bg-white border border-gray-200 text-text-secondary text-sm rounded-xl flex items-center justify-center gap-2"
            >
              返回成长主页
            </button>
          </div>
        </div>
      </div>
    );
  }

  const parsedAbility = parseAbilitySummaryAny(story.ability_summary, story.type || 'cycle');
  const photoList = parsePhotoUrls(story.photo_urls);
  const storyType = story.type || 'cycle';
  const isProjectStory = storyType === 'project';

  return (
    <div className="min-h-screen bg-bg pb-28">
      {/* 顶部 */}
      <div className="bg-gradient-to-br from-emerald-500 to-green-600 pt-3 pb-4 px-4 rounded-b-2xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-white">成长故事</h1>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-3">
        {/* 故事卡片 */}
        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-text-primary">{story.title}</h2>
              <p className="text-xs text-text-tertiary mt-1">
                {new Date(story.created_at).toLocaleDateString()} · {childName}
              </p>
            </div>
            <IPPAvatar expression="proud" size={48} />
          </div>
        </div>

        {/* 能力提升摘要 / 大师挑战验收评分 */}
        {parsedAbility.kind !== 'empty' && (
          <div className="bg-card rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-3">
              {isProjectStory ? (
                <>
                  <Trophy size={14} className="text-amber-500" />
                  <span className="text-sm font-medium text-text-primary">大师挑战验收</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-emerald-500" />
                  <span className="text-sm font-medium text-text-primary">能力提升</span>
                </>
              )}
            </div>

            {/* cycle 类型：六维 delta 胶囊 */}
            {parsedAbility.kind === 'cycle' && parsedAbility.deltas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {parsedAbility.deltas.map((item, idx) => {
                  const isUp = item.delta > 0;
                  const isDown = item.delta < 0;
                  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
                  const colorClass = isUp
                    ? 'bg-green-50 text-green-700'
                    : isDown
                    ? 'bg-red-50 text-red-700'
                    : 'bg-gray-100 text-text-tertiary';
                  return (
                    <span
                      key={idx}
                      className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1 ${colorClass}`}
                    >
                      <Icon size={12} />
                      {item.dimension_name} {isUp ? '+' : ''}{item.delta}
                    </span>
                  );
                })}
              </div>
            )}

            {/* project 类型：三维评分 + 通过状态 + 积分 */}
            {parsedAbility.kind === 'project' && (
              <ProjectAbilityCard summary={parsedAbility.summary} />
            )}
          </div>
        )}

        {/* 子任务时间线（仅 cycle 类型：project 类型无周期任务概念）*/}
        {!isProjectStory && cycleTasks.length > 0 && (
          <div className="bg-card rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-3">
              <Calendar size={14} className="text-emerald-500" />
              <span className="text-sm font-medium text-text-primary">子任务时间线</span>
              <span className="text-xs text-text-tertiary bg-gray-100 px-2 py-0.5 rounded-full">
                {cycleTasks.length}
              </span>
            </div>
            <div className="space-y-3">
              {cycleTasks.map((task, idx) => (
                <div key={task.id || idx} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Star size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary">{task.title}</div>
                    <div className="text-xs text-text-tertiary mt-0.5">
                      {new Date(task.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-xs text-primary font-medium flex-shrink-0">
                    +{task.points}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 故事正文 */}
        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
            {story.content}
          </div>
        </div>

        {/* 相册精选 */}
        {photoList.length > 0 && (
          <div className="bg-card rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-3">
              <ImageIcon size={14} className="text-emerald-500" />
              <span className="text-sm font-medium text-text-primary">精彩瞬间</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {photoList.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt=""
                  className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 底部分享按钮（仅家长可见） */}
      {isParent && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-gray-100 p-4 z-40">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleShare}
              disabled={sharing}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/20 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Share2 size={18} />
              {sharing ? '分享中...' : '分享到社区'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 大师挑战验收评分卡（project 类型故事能力区专用）
 * 三维 1-5 星评分 + 通过徽章 + 稀有积分奖励
 */
function ProjectAbilityCard({ summary }: { summary: ProjectAbilitySummary }) {
  const dims: { key: keyof Pick<ProjectAbilitySummary, 'participation_score' | 'application_score' | 'quality_score'>; label: string; desc: string }[] = [
    { key: 'participation_score', label: '参与度', desc: '孩子是否全程主动投入' },
    { key: 'application_score', label: '能力应用', desc: '解决问题时是否灵活运用知识' },
    { key: 'quality_score', label: '成果质量', desc: '最终成品的完成度与惊喜感' },
  ];

  return (
    <div className="space-y-3">
      {/* 三维评分 */}
      <div className="space-y-2">
        {dims.map((d) => {
          const score = summary[d.key] || 0;
          return (
            <div key={d.key} className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary">{d.label}</div>
                <div className="text-[10px] text-text-tertiary mt-0.5">{d.desc}</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    size={14}
                    className={i <= score ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-100'}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 分割线 */}
      <div className="border-t border-dashed border-gray-100" />

      {/* 结果 + 积分 */}
      <div className="flex items-center justify-between">
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            summary.passed
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          }`}
        >
          <CheckCircle2 size={12} />
          {summary.passed ? '挑战通过' : '继续努力'}
        </div>
        {summary.points_awarded > 0 && (
          <div className="text-xs text-text-secondary">
            获得稀有积分 <span className="text-primary font-semibold">+{summary.points_awarded}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default GrowthStoryPage;
