import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  Share2,
  RefreshCw,
  Camera,
  Star,
  CheckCircle2,
  Music2,
  Pause,
} from 'lucide-react';
import { useChildStore } from '../stores/childStore';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import {
  IPPAvatar,
  STORY_PLAYLISTS,
  preloadIPAvatars,
  type IPAnimationName,
} from '../components/IPPAvatar';
import {
  generateStory,
  getStory,
  getStoryById,
  getCurrentCycle,
  getCycleTasks,
  parseAbilitySummaryAny,
  parseYearbookCopy,
  ensureYearbookCopy,
} from '../services/growthStory';
import type { GrowthStory, ProjectAbilitySummary, YearbookCopy } from '../services/growthStory';
import type { Task } from '../services/tasks';
import * as communityService from '../services/community';
import {
  buildYearbookStats,
  formatDateCN,
  formatDateRangeCN,
  daysBetweenInclusive,
} from '../utils/yearbookStats';

const LOADING_TIPS = [
  '正在整理本阶段回顾…',
  '汇总任务与精彩瞬间…',
  '计算积分与成长变化…',
  '马上就好，回顾即将呈现…',
];

const ENCOURAGE_LINES = [
  '这一阶段的每一步，都值得被看见。',
  '小小坚持，攒成大大的成长。',
  '下一阶段，继续闪光吧！',
];

/** 阶段回顾背景音乐（伴奏） */
const REVIEW_BGM_SRC = '/audio/growth-review-bgm.mp3';

export function GrowthStoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const childStore = useChildStore();
  const authStore = useAuthStore();
  const isParent = authStore.user?.role === 'parent';
  const toast = useToastStore();

  const childId = Number(searchParams.get('child_id')) || 0;
  const cycleIdParam = searchParams.get('cycle_id');
  const storyIdParam = searchParams.get('story_id');

  const child = childStore.children.find((c) => c.id === childId) || null;
  const childName = child?.nickname || '宝宝';

  const [story, setStory] = useState<GrowthStory | null>(null);
  const [cycleTasks, setCycleTasks] = useState<Task[]>([]);
  const [cycleStart, setCycleStart] = useState<string | null>(null);
  const [cycleEnd, setCycleEnd] = useState<string | null>(null);
  const [cycleName, setCycleName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);
  /** 淡出中的上一页；有值时与当前页交叉溶解 */
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const [leaveFading, setLeaveFading] = useState(false);
  const [enterVisible, setEnterVisible] = useState(true);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const fadeLockRef = useRef(false);
  const fadeTimerRef = useRef<number | null>(null);
  const autoplayTimerRef = useRef<number | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const FADE_MS = 720;
  /** 每页停留时长（含淡入），末页不自动翻页 */
  const AUTO_DWELL_MS = 3800;
  /** 默认开启；用户手动暂停后为 false，不再自动恢复 */
  const bgmWantedOnRef = useRef(true);
  const mountedRef = useRef(true);
  const generatingRef = useRef<string | null>(null);
  const effectRunIdRef = useRef(0);

  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => {
      if (mountedRef.current) {
        setTipIndex((i) => (i + 1) % LOADING_TIPS.length);
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [loading]);

  // 进入回顾页即预加载小萌芽全套 APNG，滑动切页更顺
  useEffect(() => {
    preloadIPAvatars();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const tryPlayBgm = useCallback(async () => {
    const audio = bgmRef.current;
    if (!audio || !bgmWantedOnRef.current) return false;
    try {
      if (audio.paused) {
        await audio.play();
      }
      return true;
    } catch {
      setBgmPlaying(false);
      return false;
    }
  }, []);

  // 回顾页 BGM：挂载时准备，离开时停止
  useEffect(() => {
    const audio = new Audio(REVIEW_BGM_SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.55;
    bgmRef.current = audio;
    bgmWantedOnRef.current = true;
    const onPlay = () => setBgmPlaying(true);
    const onPause = () => setBgmPlaying(false);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      audio.src = '';
      bgmRef.current = null;
      setBgmPlaying(false);
    };
  }, []);

  // 回顾内容就绪后默认开播；若被浏览器拦截，在首次触摸时再启播
  useEffect(() => {
    if (loading || !story) return;
    let cancelled = false;
    let resumeAttached = false;
    const resume = () => {
      void tryPlayBgm().then((played) => {
        if (played) {
          window.removeEventListener('pointerdown', resume);
          window.removeEventListener('touchstart', resume);
          resumeAttached = false;
        }
      });
    };
    void (async () => {
      const ok = await tryPlayBgm();
      if (cancelled || ok || !bgmWantedOnRef.current) return;
      window.addEventListener('pointerdown', resume, { passive: true });
      window.addEventListener('touchstart', resume, { passive: true });
      resumeAttached = true;
    })();
    return () => {
      cancelled = true;
      if (resumeAttached) {
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('touchstart', resume);
      }
    };
  }, [loading, story, tryPlayBgm]);

  const toggleBgm = useCallback(async () => {
    const audio = bgmRef.current;
    if (!audio) return;
    try {
      if (!audio.paused) {
        bgmWantedOnRef.current = false;
        audio.pause();
        return;
      }
      bgmWantedOnRef.current = true;
      await audio.play();
    } catch {
      setBgmPlaying(false);
      toast.error('背景音乐暂时无法播放');
    }
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    effectRunIdRef.current += 1;
    const effectRunId = effectRunIdRef.current;
    const reqKey = `s${storyIdParam ?? 'x'}-c${cycleIdParam ?? 'g'}-${childId}-${reloadKey}-r${effectRunId}`;
    async function load() {
      if (!childId) {
        setError('缺少孩子信息');
        setLoading(false);
        return;
      }
      try {
        if (childStore.children.length === 0 && !childStore.loading) {
          await childStore.fetchChildren();
        }
      } catch {
        /* ignore */
      }

      if (generatingRef.current === reqKey) {
        return;
      }
      generatingRef.current = reqKey;
      setLoading(true);
      setError(null);
      try {
        let result: GrowthStory;
        let cycleIdForTasks: number | null = null;
        let nextCycleStart: string | null = null;
        let nextCycleEnd: string | null = null;
        let nextCycleName = '';

        if (storyIdParam) {
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
          if ((result.type || 'cycle') === 'cycle' && result.cycle_id > 0) {
            cycleIdForTasks = result.cycle_id;
          }
          nextCycleName = result.title || '';
        } else {
          let cycleId: number | null = cycleIdParam ? Number(cycleIdParam) : null;
          const isHistorical = !!cycleIdParam;
          if (!cycleId || isNaN(cycleId)) {
            const current = await getCurrentCycle(childId);
            cycleId = current.cycle?.id ?? null;
            if (!cycleId) {
              throw new Error('未找到当前成长周期');
            }
            nextCycleStart = current.cycle?.start_date || null;
            nextCycleEnd = current.cycle?.end_date || null;
            nextCycleName = current.cycle?.name || '';
          }

          if (isHistorical) {
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
            if (!nextCycleName) nextCycleName = result.title || '';
          } else {
            // 生成前若尚未拿到周期元数据，再取一次（历史分支不会走到这里）
            if (!nextCycleStart) {
              try {
                const current = await getCurrentCycle(childId);
                if (current.cycle?.id === cycleId) {
                  nextCycleStart = current.cycle.start_date || null;
                  nextCycleEnd = current.cycle.end_date || null;
                  nextCycleName = current.cycle.name || nextCycleName;
                }
              } catch {
                /* ignore */
              }
            }
            result = await generateStory(cycleId, childId, childName);
            if (!nextCycleName) nextCycleName = result.title || '';
          }
          cycleIdForTasks = cycleId;
        }

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

        if (mountedRef.current && !cancelled && generatingRef.current === reqKey) {
          setStory(result);
          setCycleTasks(tasks);
          setCycleStart(nextCycleStart);
          setCycleEnd(nextCycleEnd);
          setCycleName(nextCycleName || result.title || '');
          setCardIndex(0);
        }
      } catch (e: any) {
        if (mountedRef.current && !cancelled && generatingRef.current === reqKey) {
          const msg = e.message || '阶段回顾加载失败';
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.error('[GrowthStoryPage] 加载失败：', e);
          }
          setError(msg);
        }
      } finally {
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
      if (generatingRef.current === reqKey) {
        generatingRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, cycleIdParam, storyIdParam, reloadKey]);

  const stats = useMemo(
    () =>
      buildYearbookStats({
        tasks: cycleTasks,
        cycleStart,
        cycleEnd,
        storyPhotoUrls: story?.photo_urls,
      }),
    [cycleTasks, cycleStart, cycleEnd, story?.photo_urls],
  );

  const stageTitle = cycleName || story?.title || '成长阶段';
  const yearbook: YearbookCopy | null = useMemo(
    () => parseYearbookCopy(story?.yearbook_copy),
    [story?.yearbook_copy],
  );
  const encourage =
    yearbook?.close ||
    ENCOURAGE_LINES[Math.abs((story?.id || 0) % ENCOURAGE_LINES.length)];
  const parsedAbility = story
    ? parseAbilitySummaryAny(story.ability_summary, story.type || 'cycle')
    : { kind: 'empty' as const };
  const isProjectStory = (story?.type || 'cycle') === 'project';
  const stageDays = useMemo(
    () => daysBetweenInclusive(stats.startDate, stats.endDate),
    [stats.startDate, stats.endDate],
  );
  const storyMarkdown = useMemo(
    () => cleanStoryMarkdown(story?.content || ''),
    [story?.content],
  );
  const albumPhotos = stats.photos;

  // 缺旁白或有相册却无配文时，后台补齐（不阻塞首屏）
  useEffect(() => {
    if (!story?.id || loading) return;
    const yb = parseYearbookCopy(story.yearbook_copy);
    const needCaptions = albumPhotos.length > 0 && !(yb?.photo_captions && yb.photo_captions.length > 0);
    if (yb && !needCaptions) return;
    let cancelled = false;
    (async () => {
      try {
        const updated = await ensureYearbookCopy(story.id);
        if (!cancelled && mountedRef.current && updated?.yearbook_copy) {
          setStory(updated);
        }
      } catch {
        /* 保留静态 fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [story?.id, story?.yearbook_copy, loading, albumPhotos.length]);

  const cards = useMemo(() => {
    if (!story) return [] as { key: string; node: ReactNode }[];
    const list: { key: string; node: ReactNode }[] = [];
    // 有 BGM 时用加油舞序列，否则挥手欢迎序列
    const coverAnim: IPAnimationName = bgmPlaying ? 'encourage' : 'welcome';

    list.push({
      key: 'cover',
      node: (
        <ReviewCardLayout
          line={
            yearbook?.cover ||
            `嗨，我是小萌芽！一起来看看 ${childName} 这一阶段的闪光时刻吧～`
          }
          animationName={coverAnim}
          avatarAlt="小萌芽在跳舞庆祝"
          avatarSize={120}
          title={isProjectStory ? '挑战回顾' : '阶段回顾'}
        >
          <h1 className="mb-1 text-3xl font-bold leading-tight text-white drop-shadow-sm">
            {childName}
          </h1>
          <p className="max-w-xs text-lg text-white/90">{stageTitle}</p>
          <p className="mt-4 text-xs text-white/60">回忆即将自动展开…</p>
        </ReviewCardLayout>
      ),
    });

    list.push({
      key: 'period',
      node: (
        <ReviewCardLayout
          line={
            yearbook?.period ||
            (isProjectStory ? '大师挑战的收官一刻，值得记住！' : '从目标定下那天起，每一天都在长大哦')
          }
          animationName="think"
          avatarAlt="小萌芽介绍时间"
          title={isProjectStory ? '完成时间' : '本阶段时间'}
        >
          <p className="text-2xl font-bold leading-snug text-white">
            {isProjectStory
              ? formatDateCN(
                  story.created_at
                    ? new Date(story.created_at).toISOString().slice(0, 10)
                    : null,
                )
              : formatDateRangeCN(stats.startDate, stats.endDate)}
          </p>
        </ReviewCardLayout>
      ),
    });

    if (!isProjectStory) {
      list.push({
        key: 'days',
        node: (
          <ReviewCardLayout
            line={
              stageDays > 0
                ? `一共走过 ${stageDays} 天，日子不长，却装了好多第一次。`
                : '这段时光虽然短，但每一步都算数。'
            }
            animationName="happy"
            avatarAlt="小萌芽数日子"
            title="经历了多少天"
          >
            <p className="text-5xl font-bold text-white">{stageDays || '—'}</p>
            <p className="mt-2 text-sm text-white/75">天</p>
          </ReviewCardLayout>
        ),
      });
    }

    list.push({
      key: 'first',
      node: (
        <ReviewCardLayout
          line={
            yearbook?.first_task ||
            (stats.firstTaskDate
              ? '第一步迈出去啦，后面就会越来越有劲！'
              : '下一阶段从第一个小任务开始就好～')
          }
          animationName="surprise"
          avatarAlt="小萌芽说第一个任务"
          title={isProjectStory ? '挑战主题' : '第一个任务'}
        >
          {isProjectStory ? (
            <p className="max-w-xs text-xl font-semibold text-white">{stageTitle}</p>
          ) : stats.firstTaskDate ? (
            <>
              <p className="text-3xl font-bold text-white">{formatDateCN(stats.firstTaskDate)}</p>
              <p className="mt-3 max-w-xs text-base text-white/85 line-clamp-3">
                {stats.firstTaskTitle}
              </p>
            </>
          ) : (
            <p className="text-xl font-semibold text-white/90">还没有完成任务</p>
          )}
        </ReviewCardLayout>
      ),
    });

    list.push({
      key: 'stats',
      node: (
        <ReviewCardLayout
          line={
            yearbook?.stats ||
            (isProjectStory && parsedAbility.kind === 'project'
              ? parsedAbility.summary.passed
                ? '挑战通过啦，我要给你鼓掌！'
                : '继续努力，下次一定更棒！'
              : `完成了 ${stats.taskCount} 个任务，攒下 ${stats.totalPoints} 积分，真棒！`)
          }
          animationName="proud"
          avatarAlt="小萌芽展示成绩"
          title={isProjectStory ? '挑战成绩' : '完成了多少任务'}
        >
          {isProjectStory && parsedAbility.kind === 'project' ? (
            <div className="w-full max-w-sm">
              <div className="rounded-2xl bg-black/10 px-4 py-5 backdrop-blur">
                <p className="text-3xl font-bold text-amber-200">
                  +{parsedAbility.summary.points_awarded}
                </p>
                <p className="mt-2 text-sm text-white/75">稀有积分</p>
              </div>
            </div>
          ) : (
            <div className="flex w-full max-w-sm items-stretch justify-center gap-3">
              <div className="flex-1 rounded-2xl bg-black/10 px-4 py-5 backdrop-blur">
                <p className="text-4xl font-bold text-white">{stats.taskCount}</p>
                <p className="mt-2 text-sm text-white/75">个任务</p>
              </div>
              <div className="flex-1 rounded-2xl bg-black/10 px-4 py-5 backdrop-blur">
                <p className="text-4xl font-bold text-amber-200">{stats.totalPoints}</p>
                <p className="mt-2 text-sm text-white/75">积分</p>
              </div>
            </div>
          )}
        </ReviewCardLayout>
      ),
    });

    list.push({
      key: 'ability',
      node: (
        <ReviewCardLayout
          line={encourage}
          animationName="encourage"
          avatarAlt="小萌芽说能力变化"
          title={isProjectStory ? '验收评分' : '能力变化'}
          avatarSize={100}
        >
          {parsedAbility.kind === 'cycle' && parsedAbility.deltas.length > 0 ? (
            <div className="flex max-w-sm flex-wrap justify-center gap-2">
              {parsedAbility.deltas.map((a, i) => (
                <span
                  key={i}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    a.delta > 0
                      ? 'bg-emerald-400/30 text-emerald-50'
                      : a.delta < 0
                        ? 'bg-rose-400/25 text-rose-50'
                        : 'bg-white/15 text-white/80'
                  }`}
                >
                  {a.dimension_name}{' '}
                  {a.delta > 0 ? `+${a.delta}` : a.delta === 0 ? '持平' : a.delta}
                </span>
              ))}
            </div>
          ) : parsedAbility.kind === 'project' ? (
            <div className="w-full max-w-sm rounded-2xl bg-black/10 p-4 text-left backdrop-blur">
              <ProjectAbilityCard summary={parsedAbility.summary} light />
            </div>
          ) : (
            <p className="text-sm text-white/65">本阶段能力数据暂未汇总</p>
          )}
          <p className="mt-6 text-xs text-white/60">再滑一下，看看精彩瞬间 →</p>
        </ReviewCardLayout>
      ),
    });

    // 每张照片单独一页 + AI 短配文；动作在开心/惊讶/骄傲/加油间轮换
    const photoAnims: IPAnimationName[] = ['happy', 'surprise', 'proud', 'encourage'];
    if (albumPhotos.length > 0) {
      albumPhotos.forEach((url, i) => {
        const caption =
          yearbook?.photo_captions?.[i] ||
          yearbook?.photos ||
          '定格这一刻的小小闪光';
        list.push({
          key: `photo-${i}`,
          node: (
            <ReviewCardLayout
              line={caption}
              animationName={photoAnims[i % photoAnims.length]}
              avatarAlt={`小萌芽解说第 ${i + 1} 张照片`}
              title={`精彩瞬间 ${i + 1}/${albumPhotos.length}`}
              avatarSize={72}
            >
              <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-black/15 shadow-lg aspect-[4/3]">
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </div>
            </ReviewCardLayout>
          ),
        });
      });
    } else {
      list.push({
        key: 'photo-empty',
        node: (
          <ReviewCardLayout
            line={yearbook?.photos || '下次完成任务时拍一张，故事会更生动～'}
            animationName="comfort"
            avatarAlt="小萌芽期待照片"
            title="精彩瞬间"
            avatarSize={88}
          >
            <Camera className="mb-2 h-12 w-12 text-white/45" />
            <p className="text-lg font-medium text-white/85">还没有上传照片</p>
          </ReviewCardLayout>
        ),
      });
    }

    // 末页：仅 AI Markdown 成长故事总结
    list.push({
      key: 'summary',
      node: null,
    });

    return list;
  }, [
    story,
    childName,
    stageTitle,
    stats,
    stageDays,
    parsedAbility,
    encourage,
    yearbook,
    isProjectStory,
    bgmPlaying,
    albumPhotos,
  ]);

  const goToCard = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, cards.length - 1));
      if (clamped === cardIndex || fadeLockRef.current || cards.length === 0) return;

      fadeLockRef.current = true;
      if (fadeTimerRef.current != null) {
        window.clearTimeout(fadeTimerRef.current);
      }

      setLeavingIndex(cardIndex);
      setLeaveFading(false);
      setEnterVisible(false);
      setCardIndex(clamped);

      // 下一帧再交叉溶解：旧页从 1→0，新页从 0→1
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setLeaveFading(true);
          setEnterVisible(true);
        });
      });

      fadeTimerRef.current = window.setTimeout(() => {
        setLeavingIndex(null);
        setLeaveFading(false);
        fadeLockRef.current = false;
        fadeTimerRef.current = null;
      }, FADE_MS);
    },
    [cardIndex, cards.length],
  );

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current != null) {
        window.clearTimeout(fadeTimerRef.current);
      }
      if (autoplayTimerRef.current != null) {
        window.clearTimeout(autoplayTimerRef.current);
      }
    };
  }, []);

  // 故事重载时回到封面并清掉过渡态
  useEffect(() => {
    setCardIndex(0);
    setLeavingIndex(null);
    setLeaveFading(false);
    setEnterVisible(true);
    fadeLockRef.current = false;
    if (autoplayTimerRef.current != null) {
      window.clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  }, [story?.id]);

  // 自动播放：逐页淡入淡出，停在最后一页（AI 总结）
  useEffect(() => {
    if (loading || !story || cards.length < 2) return;
    if (cardIndex >= cards.length - 1) return;

    if (autoplayTimerRef.current != null) {
      window.clearTimeout(autoplayTimerRef.current);
    }
    autoplayTimerRef.current = window.setTimeout(() => {
      autoplayTimerRef.current = null;
      goToCard(cardIndex + 1);
    }, AUTO_DWELL_MS);

    return () => {
      if (autoplayTimerRef.current != null) {
        window.clearTimeout(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
    };
  }, [loading, story?.id, cardIndex, cards.length, goToCard]);

  const renderMemoryCard = useCallback(
    (index: number) => {
      const card = cards[index];
      if (!card || !story) return null;
      const pad = card.key === 'summary' ? 'pb-12' : 'pb-14';
      return (
        <div className={`flex h-full w-full flex-col pt-14 ${pad}`}>
          {card.key === 'summary' ? (
            <FinaleStorySummary
              markdown={storyMarkdown}
              title={story.title || stageTitle}
              emptyHint={yearbook?.close}
              taskCount={stats.taskCount}
              totalPoints={stats.totalPoints}
              photoCount={albumPhotos.length}
              onBackHome={() => navigate('/growth')}
            />
          ) : (
            card.node
          )}
        </div>
      );
    },
    [
      cards,
      story,
      storyMarkdown,
      stageTitle,
      yearbook?.close,
      stats.taskCount,
      stats.totalPoints,
      albumPhotos.length,
      navigate,
    ],
  );

  async function handleShare() {
    if (!story) return;
    setSharing(true);
    try {
      const range = formatDateRangeCN(stats.startDate, stats.endDate);
      const shareContent = isProjectStory
        ? [
            `【${childName}的挑战回顾】${stageTitle}`,
            encourage,
          ].join('\n')
        : [
            `【${childName}的阶段回顾】${stageTitle}`,
            `时间：${range}`,
            `完成 ${stats.taskCount} 个任务，获得 ${stats.totalPoints} 积分`,
            encourage,
          ].join('\n');

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

  if (loading) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex flex-col items-center justify-center px-6">
        <IPPAvatar animationName="loading" size={88} />
        <h2 className="text-lg font-semibold text-text-primary mt-6">正在整理阶段回顾</h2>
        <p className="text-sm text-text-tertiary mt-2">{LOADING_TIPS[tipIndex]}</p>
        <div className="w-48 h-1 bg-gray-100 rounded-full mt-6 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-green-600 rounded-full animate-pulse"
            style={{ width: '60%' }}
          />
        </div>
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

  if (error || !story) {
    const userFacingMsg =
      error && error.includes('暂未配置')
        ? '系统 AI 服务暂未配置，暂时无法整理阶段回顾。'
        : error || '阶段回顾加载失败';
    const isAIMissing = error?.includes('暂未配置') || false;
    return (
      <div className="min-h-screen bg-bg pb-24 flex flex-col items-center justify-center px-6">
        <IPPAvatar animationName="comfort" size={72} />
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm max-w-sm w-full mt-6">
          <div className="text-base font-semibold text-text-primary">这一阶段的回顾还没准备好</div>
          <div className="text-sm text-text-tertiary mt-2 whitespace-pre-line leading-relaxed">
            {userFacingMsg}
            {isAIMissing ? (
              <>
                {'\n\n'}
                请先让管理员在 .env 中配置 AI_API_KEY，之后再回到这里查看。
                你依然可以在「成长」里查看能力指数、阶段目标和完成的任务哦。
              </>
            ) : null}
          </div>
          {error && !isAIMissing && (
            <div className="mt-3 text-xs text-text-tertiary bg-gray-50 rounded-lg px-3 py-2 text-left">
              详情：{error}
            </div>
          )}
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

  return (
    // 预留底部 Tab（约 5rem）+ 安全区，避免末页按钮被导航栏挡住
    <div className="relative flex h-[calc(100dvh-5rem-env(safe-area-inset-bottom))] flex-col overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600">
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/15 text-white backdrop-blur"
          aria-label="返回"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleBgm}
            className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur transition-colors ${
              bgmPlaying ? 'bg-white/25 text-white' : 'bg-black/15 text-white'
            }`}
            aria-label={bgmPlaying ? '暂停背景音乐' : '播放背景音乐'}
            title={bgmPlaying ? '暂停音乐' : '播放音乐'}
          >
            {bgmPlaying ? <Pause className="h-5 w-5" /> : <Music2 className="h-5 w-5" />}
          </button>
          {isParent && (
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="flex items-center gap-1.5 rounded-full bg-black/15 px-3.5 py-2 text-sm text-white backdrop-blur disabled:opacity-50"
            >
              <Share2 className="h-4 w-4" />
              {sharing ? '分享中…' : '分享'}
            </button>
          )}
        </div>
      </div>

      <div className="relative h-full w-full overflow-hidden">
        {/* 上一页淡出（略放大消散） */}
        {leavingIndex != null && (
          <div
            className="pointer-events-none absolute inset-0 z-[1] will-change-[opacity,transform]"
            style={{
              opacity: leaveFading ? 0 : 1,
              transform: leaveFading ? 'scale(1.045)' : 'scale(1)',
              transition: `opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
            aria-hidden
          >
            {renderMemoryCard(leavingIndex)}
          </div>
        )}
        {/* 当前页淡入（略放大到位） */}
        <div
          key={cards[cardIndex]?.key ?? cardIndex}
          className="absolute inset-0 z-[2] will-change-[opacity,transform]"
          style={{
            opacity: enterVisible ? 1 : 0,
            transform: enterVisible ? 'scale(1)' : 'scale(0.965)',
            transition: `opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          }}
        >
          {renderMemoryCard(cardIndex)}
        </div>
      </div>

      {/* 进度点：仅指示，不可点击 */}
      <div className="pointer-events-none absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-2">
        {cards.map((card, i) => (
          <span
            key={card.key}
            className={`h-2 rounded-full transition-all duration-500 ${
              i === cardIndex ? 'w-6 bg-white' : 'w-2 bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/** 去掉本地降级提示等噪音，保留 AI 故事正文 */
function cleanStoryMarkdown(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\n---\n>[\s\S]*$/g, '')
    .replace(/^>\s*提示：.*$/gm, '')
    .trim();
}

type StorySection = {
  key: string;
  heading: string;
  body: string;
  tone: 'emerald' | 'amber' | 'sky' | 'rose' | 'violet';
};

const SECTION_TONES: Array<{ match: RegExp; tone: StorySection['tone'] }> = [
  { match: /日常|小成就|任务/, tone: 'emerald' },
  { match: /习惯/, tone: 'amber' },
  { match: /主题|探索|挑战/, tone: 'sky' },
  { match: /能力|成长/, tone: 'violet' },
];

function toneForHeading(heading: string): StorySection['tone'] {
  for (const item of SECTION_TONES) {
    if (item.match.test(heading)) return item.tone;
  }
  return 'rose';
}

const TONE_STYLES: Record<
  StorySection['tone'],
  { wrap: string; badge: string; title: string }
> = {
  emerald: {
    wrap: 'bg-emerald-50/90 border-emerald-100',
    badge: 'bg-emerald-500',
    title: 'text-emerald-800',
  },
  amber: {
    wrap: 'bg-amber-50/90 border-amber-100',
    badge: 'bg-amber-500',
    title: 'text-amber-900',
  },
  sky: {
    wrap: 'bg-sky-50/90 border-sky-100',
    badge: 'bg-sky-500',
    title: 'text-sky-900',
  },
  rose: {
    wrap: 'bg-rose-50/80 border-rose-100',
    badge: 'bg-rose-400',
    title: 'text-rose-900',
  },
  violet: {
    wrap: 'bg-violet-50/90 border-violet-100',
    badge: 'bg-violet-500',
    title: 'text-violet-900',
  },
};

/** 把 AI 总结拆成开场 + 分块，兼容 ### 标题 与 【】标题 */
function parseStorySections(raw: string): { lead: string; closing: string; sections: StorySection[] } {
  const text = cleanStoryMarkdown(raw);
  if (!text) return { lead: '', closing: '', sections: [] };

  // 抽出结尾引用寄语
  let closing = '';
  let body = text.replace(/(?:^|\n)>\s?(.+(?:\n>\s?.+)*)\s*$/m, (_, q: string) => {
    closing = q
      .split('\n')
      .map((l) => l.replace(/^>\s?/, '').trim())
      .filter(Boolean)
      .join(' ');
    return '';
  }).trim();

  const headingRe = /(?:^|\n)(?:#{2,3}\s+(.+)|【([^】]+)】)\s*\n?/g;
  const marks: Array<{ index: number; end: number; heading: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(body)) !== null) {
    marks.push({
      index: m.index + (m[0].startsWith('\n') ? 1 : 0),
      end: m.index + m[0].length,
      heading: (m[1] || m[2] || '').trim(),
    });
  }

  if (marks.length === 0) {
    // 无标题：首段开场，其余按空行切成卡片
    const paras = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    if (paras.length <= 1) {
      return { lead: body, closing, sections: [] };
    }
    return {
      lead: paras[0],
      closing,
      sections: paras.slice(1).map((p, i) => ({
        key: `p-${i}`,
        heading: i === 0 ? '小闪光' : `精彩点滴 ${i + 1}`,
        body: p,
        tone: (['emerald', 'amber', 'sky', 'violet'] as const)[i % 4],
      })),
    };
  }

  const lead = body.slice(0, marks[0].index).trim();
  const sections: StorySection[] = marks.map((mark, i) => {
    const start = mark.end;
    const end = i + 1 < marks.length ? marks[i + 1].index : body.length;
    return {
      key: `s-${i}`,
      heading: mark.heading,
      body: body.slice(start, end).trim(),
      tone: toneForHeading(mark.heading),
    };
  });
  return { lead, closing, sections };
}

function InlineRichText({
  text,
  size = 'body',
}: {
  text: string;
  size?: 'lead' | 'body';
}) {
  const pClass =
    size === 'lead'
      ? 'text-center text-[15px] font-semibold leading-[1.85] text-white'
      : 'text-left text-[13px] leading-[1.9] text-stone-800';
  const strongClass =
    size === 'lead' ? 'font-bold text-amber-100' : 'font-bold text-teal-700';
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className={pClass}>{children}</p>,
        strong: ({ children }) => <strong className={strongClass}>{children}</strong>,
        em: ({ children }) => <em className="font-semibold not-italic text-amber-800">{children}</em>,
        ul: ({ children }) => (
          <ul className="mt-1 list-disc space-y-1 pl-4 text-left text-[13px] leading-[1.9] text-stone-800">
            {children}
          </ul>
        ),
        li: ({ children }) => <li className="text-stone-800">{children}</li>,
        a: ({ children }) => <span>{children}</span>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

/** 末页：分块、有层次的 AI 成长故事总结 */
function FinaleStorySummary({
  markdown,
  title,
  emptyHint,
  taskCount = 0,
  totalPoints = 0,
  photoCount = 0,
  onBackHome,
}: {
  markdown: string;
  title: string;
  emptyHint?: string;
  taskCount?: number;
  totalPoints?: number;
  photoCount?: number;
  onBackHome: () => void;
}) {
  const { lead, closing, sections } = useMemo(() => parseStorySections(markdown), [markdown]);
  const hasBody = !!(lead || sections.length || closing);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-col px-3 pb-1 pt-1">
      <div className="mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl bg-white/95 shadow-md">
        <div className="shrink-0 bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 pb-2.5 pt-3 text-center">
          <div className="flex flex-col items-center gap-1.5">
            <IPPAvatar
              animationName="encourage"
              playlist={STORY_PLAYLISTS.encourage}
              playlistIntervalMs={3200}
              float
              size={40}
              alt="小萌芽"
            />
            <div className="min-w-0 px-1">
              <p className="text-[11px] font-semibold tracking-wide text-emerald-600">小萌芽的成长故事</p>
              <p className="truncate text-sm font-bold leading-snug text-emerald-950">{title}</p>
            </div>
          </div>
          {(taskCount > 0 || totalPoints > 0 || photoCount > 0) && (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {taskCount > 0 && (
                <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  完成 <span className="font-bold text-emerald-700">{taskCount}</span> 任务
                </span>
              )}
              {totalPoints > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  收获 <span className="font-bold text-amber-700">{totalPoints}</span> 积分
                </span>
              )}
              {photoCount > 0 && (
                <span className="rounded-full bg-sky-500/12 px-2 py-0.5 text-[11px] font-semibold text-sky-900">
                  <span className="font-bold text-sky-700">{photoCount}</span> 张精彩瞬间
                </span>
              )}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-4 py-2.5">
          {!hasBody ? (
            <p className="text-center text-sm text-emerald-800/70">
              {emptyHint || '这一阶段的故事还在酝酿中，下次回顾会更完整哦。'}
            </p>
          ) : (
            <>
              {lead && (
                <div className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-3 py-2.5 shadow-sm">
                  <InlineRichText text={lead} size="lead" />
                </div>
              )}

              {sections.map((sec) => {
                const style = TONE_STYLES[sec.tone];
                return (
                  <section
                    key={sec.key}
                    className={`rounded-xl border px-3 py-2.5 ${style.wrap}`}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${style.badge}`} />
                      <h3 className={`text-[12px] font-bold tracking-wide ${style.title}`}>
                        {sec.heading}
                      </h3>
                    </div>
                    <InlineRichText text={sec.body} />
                  </section>
                );
              })}

              {closing && (
                <blockquote className="rounded-xl border border-dashed border-emerald-200 bg-white px-3 py-2.5 text-center text-[13px] font-medium leading-[1.9] text-emerald-800">
                  {closing}
                </blockquote>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-emerald-50 bg-white/95 px-4 pb-3 pt-2.5">
          <button
            type="button"
            onClick={onBackHome}
            className="w-full rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            回到成长页
          </button>
        </div>
      </div>
    </div>
  );
}

/** 小萌芽对话气泡（尾巴朝下指向中间的形象） */
function SproutSpeech({ line }: { line: string }) {
  if (!line) return null;
  return (
    <div className="relative w-full max-w-sm px-1">
      <div className="rounded-2xl bg-white px-4 py-3 text-left shadow-md">
        <p className="mb-1 text-[11px] font-semibold tracking-wide text-emerald-600">小萌芽</p>
        <p className="text-sm leading-relaxed text-emerald-950">{line}</p>
      </div>
      <div
        className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white"
        aria-hidden
      />
    </div>
  );
}

/**
 * 回顾卡统一布局（垂直居中）：上=文案气泡 → 中=小萌芽+标题 → 下=数据/内容
 * 小萌芽按主情绪轮播相关 APNG，并带轻微浮动，切换交叉淡入更流畅。
 */
function ReviewCardLayout({
  line,
  animationName,
  avatarAlt,
  avatarSize = 96,
  title,
  children,
  lively = true,
}: {
  line: string;
  animationName: IPAnimationName;
  avatarAlt: string;
  avatarSize?: number;
  title: string;
  children?: ReactNode;
  /** 是否启用表情轮播 + 浮动（照片小头像也建议开启） */
  lively?: boolean;
}) {
  const playlist = lively ? STORY_PLAYLISTS[animationName] : undefined;
  // 封面/成绩等大头像稍慢切换，照片卡稍快，避免抢戏
  const interval = avatarSize >= 100 ? 3400 : avatarSize >= 88 ? 3000 : 2600;

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-2 text-center">
      <div className="flex w-full max-w-sm flex-col items-center">
        <div className="mb-4 w-full flex justify-center">
          <SproutSpeech line={line} />
        </div>
        <div className="flex flex-col items-center">
          <div className="drop-shadow-md">
            <IPPAvatar
              animationName={animationName}
              playlist={playlist}
              playlistIntervalMs={interval}
              float={lively}
              size={avatarSize}
              alt={avatarAlt}
            />
          </div>
          <p className="mt-2 text-sm text-white/80">{title}</p>
        </div>
        <div className="mt-5 flex w-full flex-col items-center">{children}</div>
      </div>
    </div>
  );
}

function ProjectAbilityCard({
  summary,
  light = false,
}: {
  summary: ProjectAbilitySummary;
  light?: boolean;
}) {
  const dims: {
    key: keyof Pick<
      ProjectAbilitySummary,
      'participation_score' | 'application_score' | 'quality_score'
    >;
    label: string;
  }[] = [
    { key: 'participation_score', label: '参与度' },
    { key: 'application_score', label: '能力应用' },
    { key: 'quality_score', label: '成果质量' },
  ];

  const labelCls = light ? 'text-white' : 'text-text-primary';
  const mutedCls = light ? 'text-white/70' : 'text-text-secondary';

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {dims.map((d) => {
          const score = summary[d.key] || 0;
          return (
            <div key={d.key} className="flex items-center justify-between gap-3">
              <div className={`text-sm ${labelCls}`}>{d.label}</div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    size={14}
                    className={
                      i <= score
                        ? 'text-amber-300 fill-amber-300'
                        : light
                          ? 'text-white/30 fill-white/10'
                          : 'text-gray-200 fill-gray-100'
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-1">
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            summary.passed
              ? light
                ? 'bg-emerald-400/30 text-emerald-50'
                : 'bg-emerald-50 text-emerald-700'
              : light
                ? 'bg-amber-400/30 text-amber-50'
                : 'bg-amber-50 text-amber-700'
          }`}
        >
          <CheckCircle2 size={12} />
          {summary.passed ? '挑战通过' : '继续努力'}
        </div>
        {summary.points_awarded > 0 && (
          <div className={`text-xs ${mutedCls}`}>
            稀有积分 <span className="font-semibold text-amber-200">+{summary.points_awarded}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default GrowthStoryPage;
