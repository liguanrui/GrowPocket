import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Share2, Sparkles, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { useChildStore } from '../stores/childStore';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { IPPAvatar } from '../components/IPPAvatar';
import { generateStory, getCurrentCycle, parseAbilitySummary, parsePhotoUrls } from '../services/growthStory';
import type { GrowthStory } from '../services/growthStory';
import * as communityService from '../services/community';
import { getGrowthIndex } from '../services/ability';

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

  const child = childStore.children.find((c) => c.id === childId) || null;
  const childName = child?.nickname || '宝宝';

  const [story, setStory] = useState<GrowthStory | null>(null);
  const [growthIndex, setGrowthIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const mountedRef = useRef(true);

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

  // 拉取成长指数（用于 IP 形态展示）
  useEffect(() => {
    if (!childId) return;
    getGrowthIndex(childId)
      .then((idx) => {
        if (mountedRef.current) setGrowthIndex(idx);
      })
      .catch(() => {});
  }, [childId]);

  // 生成/拉取成长故事
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!childId) {
        setError('缺少孩子信息');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        let cycleId: number | null = cycleIdParam ? Number(cycleIdParam) : null;
        if (!cycleId || isNaN(cycleId)) {
          const current = await getCurrentCycle(childId);
          cycleId = current.cycle?.id;
          if (!cycleId) {
            throw new Error('未找到当前成长周期');
          }
        }
        const result = await generateStory(cycleId, childId, childName);
        if (!cancelled && mountedRef.current) {
          setStory(result);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled && mountedRef.current) {
          setError(e.message || '成长故事生成失败');
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, cycleIdParam, reloadKey]);

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
        <IPPAvatar growthIndex={growthIndex} expression="think" size={88} animated />
        <h2 className="text-lg font-semibold text-text-primary mt-6">正在生成成长故事</h2>
        <p className="text-sm text-text-tertiary mt-2">{LOADING_TIPS[tipIndex]}</p>
        <div className="w-48 h-1 bg-gray-100 rounded-full mt-6 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full animate-pulse"
            style={{ width: '60%' }}
          />
        </div>
      </div>
    );
  }

  // 错误
  if (error || !story) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex flex-col items-center justify-center px-6">
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm max-w-sm w-full">
          <div className="text-danger font-medium">{error || '成长故事生成失败'}</div>
          <button
            onClick={handleRetry}
            className="mt-4 px-5 py-2.5 bg-primary text-white text-sm rounded-xl flex items-center gap-2 mx-auto"
          >
            <RefreshCw size={16} /> 重试
          </button>
        </div>
      </div>
    );
  }

  const abilityList = parseAbilitySummary(story.ability_summary);
  const photoList = parsePhotoUrls(story.photo_urls);

  return (
    <div className="min-h-screen bg-bg pb-28">
      {/* 顶部 */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-700 pt-8 pb-10 px-5 rounded-b-3xl">
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

      <div className="max-w-lg mx-auto px-4 -mt-4">
        {/* 故事卡片 */}
        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-text-primary">{story.title}</h2>
              <p className="text-xs text-text-tertiary mt-1">
                {new Date(story.created_at).toLocaleDateString()} · {childName}
              </p>
            </div>
            <IPPAvatar growthIndex={growthIndex} expression="proud" size={48} />
          </div>

          {/* 故事正文 */}
          <div className="mt-4 text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
            {story.content}
          </div>

          {/* 能力提升摘要 */}
          {abilityList.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={14} className="text-purple-500" />
                <span className="text-sm font-medium text-text-primary">能力提升</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {abilityList.map((item, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full"
                  >
                    {item.dimension} +{item.delta}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 相册精选 */}
          {photoList.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center gap-1.5 mb-2">
                <ImageIcon size={14} className="text-purple-500" />
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
      </div>

      {/* 底部分享按钮（仅家长可见） */}
      {isParent && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-gray-100 p-4 z-40">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleShare}
              disabled={sharing}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-xl font-medium shadow-lg shadow-purple-500/20 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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

export default GrowthStoryPage;
