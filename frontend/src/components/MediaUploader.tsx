import { useState, useRef, useEffect } from 'react';
import { Upload, Camera, Images, X, Loader2, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToastStore } from '../stores/toastStore';
import { uploadMedia, isVideoMediaUrl } from '../services/tasks';
import { compressImageForUpload } from '../utils/compressImage';

const MAX_VIDEO_SECONDS = 60;
// 缩略图默认上限：超过了仍可上传，但视觉区默认显示前 MAX_THUMB 张 + +N，点击可进入预览查看全部
const DEFAULT_MAX_MEDIA = 9;

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const d = video.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取视频信息'));
    };
    video.src = url;
  });
}

type Props = {
  /** 新：多图数组。优先级高于 mediaUrl */
  mediaUrls?: string[];
  /** 旧：单图字符串（向下兼容，不设置 mediaUrls 时使用） */
  mediaUrl?: string;
  /** 新：多图回调 */
  onChange?: (urls: string[]) => void;
  /** 旧：单图回调（不设置 onChange 时使用） */
  onUpload?: (url: string) => void;
  /** 新：移除单个；不提供时回退为 onClear / 从数组移除 */
  onRemove?: (index: number, urls: string[]) => void;
  /** 旧：单图清除 */
  onClear?: () => void;
  disabled?: boolean;
  /** 最大允许上传数，默认 9 */
  maxCount?: number;
  /** 缩略图区大小模式：normal 为旧大预览，compact 为小正方形网格（任务详情页推荐） */
  size?: 'normal' | 'compact';
  label?: string;
  emptyHint?: string;
  /** 上传中状态变化回调：供父组件禁用提交按钮等 */
  onUploadingChange?: (uploading: boolean) => void;
};

/**
 * 通用媒体上传组件（支持多图）
 * - 支持相册选择 / 立即拍摄
 * - 图片 / 60 秒内视频
 * - 多图：小缩略图网格（compact 模式），点击弹出大图预览（支持左右切换）
 * - 单图 props 完全兼容旧接口
 */
export function MediaUploader(props: Props) {
  const toast = useToastStore();
  const albumRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const max = props.maxCount ?? DEFAULT_MAX_MEDIA;

  // 归一化：内部统一用 urls 数组
  const urls: string[] = props.mediaUrls
    ? props.mediaUrls.slice()
    : props.mediaUrl
      ? [props.mediaUrl]
      : [];
  const isMulti = !!props.mediaUrls || !!props.onChange;

  // 阻止 ESC 之外的页面滚动
  useEffect(() => {
    if (previewIndex == null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewIndex(null);
      if (e.key === 'ArrowLeft' && urls.length > 0) {
        setPreviewIndex((i) => (i == null ? i : (i - 1 + urls.length) % urls.length));
      }
      if (e.key === 'ArrowRight' && urls.length > 0) {
        setPreviewIndex((i) => (i == null ? i : (i + 1) % urls.length));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [previewIndex, urls.length]);

  const emitChange = (next: string[]) => {
    if (props.onChange) {
      props.onChange(next);
    } else if (props.onUpload && next.length > 0 && urls.length === 0) {
      // 兼容单图接口：首次上传时走 onUpload
      props.onUpload(next[0]);
    } else if (props.onClear && next.length === 0) {
      // 兼容单图接口：清空时走 onClear
      props.onClear();
    }
  };

  const processFiles = async (fileList: FileList | File[] | null | undefined) => {
    if (!fileList) return;
    const files = Array.from(fileList).filter(Boolean);
    if (files.length === 0) return;

    if (props.disabled) {
      toast.error('当前任务状态不允许修改成果');
      return;
    }
    if (uploading) {
      toast.warning('正在上传中，请稍等');
      return;
    }

    // 上限检查
    if (urls.length + files.length > max) {
      toast.error(`最多上传 ${max} 个媒体文件（当前已有 ${urls.length} 个）`);
      return;
    }

    // 立刻显示 loading，避免视频探测期间重复点击
    setUploading(true);
    props.onUploadingChange?.(true);

    // 宽松识别：file.type / 扩展名任一命中都算；
    // 未识别但大小合理的文件也放行，交给后端白名单兜底
    const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|heic|heif|avif|svg)$/i;
    const VIDEO_EXT = /\.(mp4|mov|webm|m4v|3gp|mkv|avi)$/i;
    const isKnownMedia = (f: File) => {
      if (f.type.startsWith('image/') || f.type.startsWith('video/')) return true;
      const name = (f.name || '').toLowerCase();
      return IMAGE_EXT.test(name) || VIDEO_EXT.test(name);
    };
    const isVideoFile = (f: File) => {
      if (f.type.startsWith('video/')) return true;
      return VIDEO_EXT.test((f.name || '').toLowerCase());
    };

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    const MAX_VIDEO_SIZE = 80 * 1024 * 1024;

    const validated: File[] = [];
    let skipped = 0;
    const skippedReasons: string[] = [];
    let hasUnknown = 0;
    for (const f of files) {
      const isVideo = isVideoFile(f);
      const sizeLimit = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      if (f.size > sizeLimit) {
        skipped++;
        skippedReasons.push(`「${f.name}」${(f.size / 1024 / 1024).toFixed(1)}MB>${Math.round(sizeLimit / 1024 / 1024)}MB`);
        continue;
      }
      if (isVideo) {
        try {
          const duration = await getVideoDuration(f);
          if (duration > MAX_VIDEO_SECONDS + 0.5) {
            skipped++;
            skippedReasons.push(`「${f.name}」超 ${MAX_VIDEO_SECONDS}s`);
            continue;
          }
        } catch {
          // 读不出时长不拦截
        }
      }
      // 放宽：前端不再按类型/大小下限拦截，一律放给后端扩展名白名单兜底
      // 仅统计无法识别的数量，后续用 warning 提示
      if (!isKnownMedia(f)) {
        hasUnknown++;
      }
      validated.push(f);
    }

    if (validated.length === 0) {
      setUploading(false);
      props.onUploadingChange?.(false);
      if (skipped > 0) {
        toast.error(`全部跳过：${skippedReasons.slice(0, 2).join('；')}${skippedReasons.length > 2 ? ' 等' : ''}`);
      }
      return;
    }
    if (hasUnknown > 0) {
      toast.warning(`有 ${hasUnknown} 个文件类型未识别，已提交后端校验（若不支持会提示）`);
    }

    // eslint-disable-next-line no-console
    console.debug('[MediaUploader] 开始上传', validated.length, '/ 已跳过', skipped, 'files:', validated.map(f => ({ name: f.name, type: f.type, size: f.size })));
    if (skipped > 0) {
      toast.warning(`跳过 ${skipped} 个文件，继续上传 ${validated.length} 个`);
    }

    try {
      const results: string[] = [];
      for (const f of validated) {
        // 手机原图常超 Nginx 默认 1MB 限制，上传前压缩图片
        const toUpload = isVideoFile(f) ? f : await compressImageForUpload(f);
        const res = await uploadMedia(toUpload);
        results.push(res.url);
      }
      const next = [...urls, ...results];
      emitChange(next);
      toast.success(`已上传 ${results.length} 个文件`);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[MediaUploader] 上传失败', e);
      toast.error(e?.message || '上传失败（请检查网络或文件格式）');
    } finally {
      setUploading(false);
      props.onUploadingChange?.(false);
    }
  };

  const handleRemove = (index: number) => {
    if (props.disabled || uploading) return;
    const next = urls.filter((_, i) => i !== index);
    if (props.onRemove) {
      props.onRemove(index, next);
    } else {
      emitChange(next);
    }
  };

  const canAddMore = !props.disabled && !uploading && urls.length < max;

  // ================== 预览弹窗 ==================
  const preview = previewIndex != null ? urls[previewIndex] : null;
  const previewIsVideo = preview ? isVideoMediaUrl(preview) : false;

  const compact = props.size === 'compact';
  // 空态框：normal 是 4:3 大卡；compact 空态也要占满整行，高度稍低（h-[104px]）避免太大
  const emptySize = compact
    ? 'min-h-[104px]'
    : 'aspect-[4/3]';

  return (
    <div>
      <input
        ref={albumRef}
        type="file"
        accept="image/*,video/*"
        multiple={isMulti}
        className="hidden"
        onChange={(e) => {
          // 必须先快照（FileList 是 live 引用，e.target.value='' 会清空它）
          const snapshotted: File[] = [];
          const fl = e.target.files;
          for (let i = 0; fl && i < fl.length; i++) snapshotted.push(fl[i]);
          e.target.value = '';
          void processFiles(snapshotted);
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const snapshotted: File[] = [];
          const fl = e.target.files;
          for (let i = 0; fl && i < fl.length; i++) snapshotted.push(fl[i]);
          e.target.value = '';
          void processFiles(snapshotted);
        }}
      />

      {urls.length > 0 ? (
        <div>
          {/* 缩略图网格：compact 下为 4 列小正方形，normal 下为大图（第一张大 + 其余小） */}
          {compact ? (
            <div className="grid grid-cols-4 gap-2">
              {urls.slice(0, max).map((url, idx) => {
                const v = isVideoMediaUrl(url);
                return (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-zoom-in group ring-1 ring-gray-100"
                    onClick={() => setPreviewIndex(idx)}
                  >
                    {v ? (
                      <video src={url} className="w-full h-full object-cover" playsInline muted />
                    ) : (
                      <img src={url} alt={`媒体-${idx + 1}`} className="w-full h-full object-cover" />
                    )}
                    {v && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25 text-white pointer-events-none">
                        <Play size={18} className="fill-white" />
                      </div>
                    )}
                      {!props.disabled && (
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(idx);
                          }}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-80 hover:opacity-100 disabled:opacity-30"
                          aria-label="移除"
                        >
                          <X size={12} />
                        </button>
                      )}
                  </div>
                );
              })}
              {/* 添加入口（未达上限时显示为小方块） */}
              {canAddMore && (
                <button
                  type="button"
                  disabled={props.disabled || uploading}
                  onClick={() => albumRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-200 text-text-tertiary flex flex-col items-center justify-center hover:border-primary hover:text-primary transition-colors bg-bg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload size={18} />
                  <span className="text-[10px] mt-0.5">加图</span>
                </button>
              )}
            </div>
          ) : (
            // normal 模式：第一张 4:3 大预览，其余横向排小图
            <div className="space-y-2">
              <div className="rounded-2xl overflow-hidden relative bg-black/5">
                {(() => {
                  const first = urls[0];
                  const v = isVideoMediaUrl(first);
                  return (
                    <>
                      {v ? (
                        <video src={first} controls className="w-full aspect-[4/3] object-contain bg-black" />
                      ) : (
                        <img
                          src={first}
                          alt="媒体"
                          className="w-full aspect-[4/3] object-cover cursor-zoom-in"
                          onClick={() => setPreviewIndex(0)}
                        />
                      )}
                      {!props.disabled && (
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => handleRemove(0)}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center disabled:opacity-30"
                          aria-label="移除"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
              {urls.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {urls.slice(1, max).map((url, idx) => {
                    const real = idx + 1;
                    const v = isVideoMediaUrl(url);
                    return (
                      <div
                        key={real}
                        className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-100 cursor-zoom-in"
                        onClick={() => setPreviewIndex(real)}
                      >
                        {v ? (
                          <video src={url} className="w-full h-full object-cover" playsInline muted />
                        ) : (
                          <img src={url} alt={`媒体-${real + 1}`} className="w-full h-full object-cover" />
                        )}
                        {v && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/25 text-white pointer-events-none">
                            <Play size={14} className="fill-white" />
                          </div>
                        )}
                        {!props.disabled && (
                          <button
                            type="button"
                            disabled={uploading}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove(real);
                            }}
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center disabled:opacity-30"
                            aria-label="移除"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {canAddMore && (
                    <button
                      type="button"
                      disabled={props.disabled || uploading}
                      onClick={() => albumRef.current?.click()}
                      className="shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 text-text-tertiary flex flex-col items-center justify-center hover:border-primary hover:text-primary transition-colors bg-bg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload size={16} />
                      <span className="text-[10px] mt-0.5">加图</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 底部按钮：只在单图 normal 场景保留「重拍 / 换一张」；多图靠网格里的「加图」和右上角 × */}
          {!isMulti && !props.disabled && !uploading && !compact && (
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                disabled={props.disabled || uploading}
                onClick={() => cameraRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 text-sm text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Camera size={14} />
                重新拍摄
              </button>
              <button
                type="button"
                disabled={props.disabled || uploading}
                onClick={() => albumRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 text-sm text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Images size={14} />
                换一张
              </button>
            </div>
          )}
        </div>
      ) : (
        // 空态：未上传
        <div
          className={`w-full ${emptySize} bg-bg border-2 border-dashed border-gray-200 rounded-2xl flex items-center gap-3 px-4 ${compact ? 'py-3 flex-row' : 'flex-col justify-center gap-2 py-6'}`}
        >
          {uploading ? (
            <>
              <Loader2 size={compact ? 20 : 32} className="text-primary animate-spin shrink-0" />
              <span className={`${compact ? 'text-[12px]' : 'text-sm'} text-text-secondary`}>上传中...</span>
            </>
          ) : (
            <>
              <div className={`${compact ? 'shrink-0' : ''} flex items-center justify-center`}>
                <Upload size={compact ? 20 : 28} className="text-text-tertiary" />
              </div>
              <div className={`flex-1 ${compact ? '' : 'text-center'}`}>
                <div className={`${compact ? 'text-[12px]' : 'text-sm'} text-text-secondary`}>
                  {props.label ?? '上传照片或视频（可选）'}
                </div>
                {(props.emptyHint ?? true) && !compact && (
                  <div className="text-xs text-text-tertiary mt-0.5">{props.emptyHint ?? '视频不超过 60 秒'}</div>
                )}
              </div>
              {!props.disabled && (
                <div className={`flex gap-2 ${compact ? 'shrink-0' : 'w-full max-w-xs'} mt-0.5`}>
                  <button
                    type="button"
                    disabled={props.disabled || uploading}
                    onClick={() => cameraRef.current?.click()}
                    className={`flex items-center justify-center gap-1.5 px-3 rounded-lg text-white font-medium ${compact ? 'py-1.5 text-[11px]' : 'flex-1 py-2.5 text-sm rounded-xl'} bg-primary disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Camera size={compact ? 12 : 16} />
                    拍摄
                  </button>
                  <button
                    type="button"
                    disabled={props.disabled || uploading}
                    onClick={() => albumRef.current?.click()}
                    className={`flex items-center justify-center gap-1.5 px-3 rounded-lg text-text-primary font-medium ${compact ? 'py-1.5 text-[11px]' : 'flex-1 py-2.5 text-sm rounded-xl'} bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Images size={compact ? 12 : 16} />
                    相册
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 预览弹窗 */}
      {preview != null && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center"
          onClick={() => setPreviewIndex(null)}
        >
          {/* 关闭 */}
          <button
            type="button"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            onClick={() => setPreviewIndex(null)}
            aria-label="关闭预览"
          >
            <X size={20} />
          </button>
          {/* 页码 */}
          {urls.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-sm tabular-nums">
              {(previewIndex ?? 0) + 1} / {urls.length}
            </div>
          )}
          {/* 左右切换 */}
          {urls.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewIndex((i) => (i == null ? i : (i - 1 + urls.length) % urls.length));
                }}
                aria-label="上一张"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewIndex((i) => (i == null ? i : (i + 1) % urls.length));
                }}
                aria-label="下一张"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          <div
            className="max-w-[92vw] max-h-[88vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {previewIsVideo ? (
              <video
                src={preview}
                controls
                autoPlay
                className="max-w-[92vw] max-h-[88vh] bg-black rounded"
              />
            ) : (
              <img
                src={preview}
                alt="预览"
                className="max-w-[92vw] max-h-[88vh] object-contain rounded shadow-2xl"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaUploader;
