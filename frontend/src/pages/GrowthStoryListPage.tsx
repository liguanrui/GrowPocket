import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, TrendingUp, Sparkles, BookOpen } from 'lucide-react';
import { useChildStore } from '../stores/childStore';
import { IPPAvatar } from '../components/IPPAvatar';
import { listStories, parseAbilitySummary } from '../services/growthStory';
import type { GrowthStory } from '../services/growthStory';
import { getGrowthIndex } from '../services/ability';

// 维度颜色映射
const DIMENSION_COLORS = ['#10b981', '#6DBF7B', '#5B9BD5', '#F0B848', '#E87461'];
const DIMENSION_NAMES = ['语言', '认知', '运动', '社交', '情感'];

function getDimensionColor(dimName: string): string {
  const idx = DIMENSION_NAMES.findIndex((n) => dimName.includes(n));
  return idx >= 0 ? DIMENSION_COLORS[idx] : '#10b981';
}

function getDimensionBgClass(dimName: string): string {
  const idx = DIMENSION_NAMES.findIndex((n) => dimName.includes(n));
  const classes = [
    'bg-emerald-50 text-emerald-700',
    'bg-green-50 text-green-700',
    'bg-blue-50 text-blue-700',
    'bg-amber-50 text-amber-700',
    'bg-orange-50 text-orange-700',
  ];
  return idx >= 0 ? classes[idx] : 'bg-emerald-50 text-emerald-700';
}

// 格式化日期
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}.${month}.${day}`;
  } catch {
    return dateStr;
  }
}

export function GrowthStoryListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { children, currentChildId } = useChildStore();

  // 从 searchParams 获取 child_id 或使用 store 中的当前 child
  const childId = Number(searchParams.get('child_id')) || currentChildId || 0;
  const child = children.find((c) => c.id === childId);
  const childName = child?.nickname || '宝宝';

  const [stories, setStories] = useState<GrowthStory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<string>('全部');
  const [growthIndex, setGrowthIndex] = useState<number>(0);

  // 加载故事列表
  const loadStories = async (pageNum: number, append: boolean) => {
    if (!childId) {
      setLoading(false);
      return;
    }
    try {
      if (!append) setLoading(true);
      setError(null);
      const res = await listStories(childId, pageNum, 20);
      setStories((prev) => (append ? [...prev, ...res.items] : res.items));
      setTotal(res.total);
      setPage(pageNum);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载 + childId 变化时重新加载
  useEffect(() => {
    loadStories(1, false);
    if (childId) {
      getGrowthIndex(childId)
        .then((idx) => setGrowthIndex(idx))
        .catch(() => setGrowthIndex(0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  // 维度统计
  const dimensionStats = DIMENSION_NAMES.map((name, i) => {
    const count = stories.filter((s) => {
      const deltas = parseAbilitySummary(s.ability_summary);
      return deltas.some((d) => d.dimension_name.includes(name));
    }).length;
    return { name, count, color: DIMENSION_COLORS[i] };
  });

  // 过滤后的故事
  const filteredStories =
    activeFilter === '全部'
      ? stories
      : stories.filter((s) => {
          const deltas = parseAbilitySummary(s.ability_summary);
          return deltas.some((d) => d.dimension_name.includes(activeFilter));
        });

  const handleBack = () => navigate(-1);

  const handleLoadMore = () => {
    loadStories(page + 1, true);
  };

  const handleStoryClick = (story: GrowthStory) => {
    navigate(`/growth/story?cycle_id=${story.cycle_id}&child_id=${childId}`);
  };

  const hasMore = total > stories.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 1. Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-b-3xl pt-8 pb-10 px-5">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-8 h-8 -ml-1 text-white"
            aria-label="返回"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">成长故事</h1>
          <button
            className="flex items-center justify-center w-8 h-8 text-white"
            aria-label="筛选"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-5 -mt-6 relative z-10">
        {/* 2. Summary Banner */}
        <div
          className="rounded-2xl border border-gray-100 p-4 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)' }}
        >
          <IPPAvatar growthIndex={growthIndex} expression="happy" size={56} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-text-primary">{childName}的故事集</div>
            <div className="text-xs text-text-tertiary mt-0.5">
              共记录 {total} 个成长瞬间
            </div>
            {/* 五维度统计 */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              {dimensionStats.map((stat) => (
                <div key={stat.name} className="flex items-center gap-1">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: stat.color }}
                  />
                  <span className="text-xs text-text-tertiary">{stat.name}</span>
                  <span className="text-xs text-text-secondary font-medium">{stat.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Dimension Filter Tags */}
        <div className="mt-4 overflow-x-auto flex gap-2 pb-1" style={{ scrollbarWidth: 'none' }}>
          {['全部', ...DIMENSION_NAMES].map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveFilter(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeFilter === tag
                  ? 'bg-primary text-white'
                  : 'bg-card border border-gray-200 text-text-primary'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* 4. Vertical Timeline */}
        {loading ? (
          <div className="py-16 text-center text-sm text-text-tertiary">加载中...</div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">{error}</div>
        ) : filteredStories.length === 0 ? (
          /* 6. Empty State */
          <div className="py-20 flex flex-col items-center justify-center">
            <BookOpen size={48} className="text-gray-300" />
            <div className="mt-3 text-sm text-text-tertiary">还没有成长故事记录</div>
          </div>
        ) : (
          <div className="relative pl-6 mt-5">
            {/* vertical line */}
            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" />
            {filteredStories.map((story) => {
              const deltas = parseAbilitySummary(story.ability_summary);
              const totalDelta = deltas.reduce((sum, d) => sum + Math.max(0, d.delta), 0);
              const firstDelta = deltas[0];
              const dimName = firstDelta?.dimension_name || '成长';
              const dotColor = getDimensionColor(dimName);
              const bgClass = getDimensionBgClass(dimName);
              const previewContent = story.content
                .replace(/[#*`-]/g, '')
                .slice(0, 100);
              const aiComment = story.content.slice(0, 80);

              return (
                <div key={story.id} className="relative mb-4">
                  {/* dot */}
                  <div
                    className="absolute -left-4 top-3 w-3 h-3 rounded-full border-2 border-white"
                    style={{ backgroundColor: dotColor }}
                  />
                  {/* card */}
                  <div
                    className="bg-card rounded-2xl p-4 shadow-sm cursor-pointer active:scale-[0.99] transition-transform"
                    onClick={() => handleStoryClick(story)}
                  >
                    {/* top row: dimension label + date */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${bgClass}`}>
                        {dimName}
                      </span>
                      <span className="text-xs text-text-tertiary">
                        {formatDate(story.created_at)}
                      </span>
                    </div>

                    {/* title */}
                    <div className="text-sm font-semibold text-text-primary mb-1">
                      {story.title}
                    </div>

                    {/* content preview */}
                    <div className="text-xs text-text-tertiary leading-relaxed mb-2.5">
                      {previewContent}
                    </div>

                    {/* AI comment section */}
                    <div className="bg-gray-50 rounded-lg p-2.5 flex items-start gap-2 mb-2.5">
                      <IPPAvatar growthIndex={growthIndex} expression="happy" size={24} />
                      <div className="text-xs text-text-secondary leading-relaxed flex-1">
                        {aiComment}
                      </div>
                    </div>

                    {/* bottom row */}
                    <div className="flex items-center justify-between">
                      {firstDelta ? (
                        <div className="flex items-center gap-1">
                          <TrendingUp size={12} className="text-emerald-600" />
                          <span className="text-xs text-emerald-600">
                            {firstDelta.dimension_name} +{firstDelta.delta}
                          </span>
                        </div>
                      ) : (
                        <span />
                      )}
                      <div className="flex items-center gap-1">
                        <Sparkles size={12} className="text-amber-500" />
                        <span className="text-xs text-amber-500">
                          +{totalDelta * 10} 成长值
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5. Load More Button */}
        {!loading && !error && filteredStories.length > 0 && hasMore && (
          <button
            onClick={handleLoadMore}
            className="w-full py-3 text-sm text-text-tertiary border border-gray-200 rounded-xl mt-2 mb-8 active:bg-gray-50 transition-colors"
          >
            加载更多
          </button>
        )}
      </div>
    </div>
  );
}

export default GrowthStoryListPage;
