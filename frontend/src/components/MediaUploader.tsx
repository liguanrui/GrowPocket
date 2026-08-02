import { useState, useRef } from 'react';
import { Upload, Camera, Images, X, Loader2 } from 'lucide-react';
import { useToastStore } from '../stores/toastStore';
import { uploadMedia, isVideoMediaUrl } from '../services/tasks';

const MAX_VIDEO_SECONDS = 60;

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

/**
 * 通用媒体上传组件
 * - 支持相册选择 / 立即拍摄
 * - 支持图片或 60 秒以内的视频
 * - 媒体可选
 */
export function MediaUploader({
  mediaUrl,
  onUpload,
  onClear,
  disabled,
  label = '上传照片或视频（可选）',
  emptyHint = '视频不超过 60 秒',
}: {
  mediaUrl?: string;
  onUpload: (url: string) => void;
  onClear: () => void;
  disabled?: boolean;
  label?: string;
  emptyHint?: string;
}) {
  const toast = useToastStore();
  const albumRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const processFile = async (file: File | undefined) => {
    if (!file || disabled || uploading) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      toast.error('请选择图片或视频');
      return;
    }
    if (isVideo) {
      try {
        const duration = await getVideoDuration(file);
        if (duration > MAX_VIDEO_SECONDS + 0.5) {
          toast.error(`视频不能超过 ${MAX_VIDEO_SECONDS} 秒`);
          return;
        }
      } catch {
        toast.error('无法读取视频，请换一个文件重试');
        return;
      }
    }
    setUploading(true);
    try {
      const res = await uploadMedia(file);
      onUpload(res.url);
      toast.success(isVideo ? '视频已上传' : '照片已上传');
    } catch (e: any) {
      toast.error(e?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const isVideo = isVideoMediaUrl(mediaUrl);

  return (
    <div>
      <input
        ref={albumRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void processFile(f);
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void processFile(f);
        }}
      />

      {mediaUrl ? (
        <div className="rounded-2xl overflow-hidden relative bg-black/5">
          {isVideo ? (
            <video src={mediaUrl} controls className="w-full aspect-[4/3] object-contain bg-black" />
          ) : (
            <img src={mediaUrl} alt="媒体" className="w-full aspect-[4/3] object-cover" />
          )}
          {!disabled && (
            <button
              type="button"
              onClick={onClear}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
              aria-label="移除"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <div className="w-full aspect-[4/3] bg-bg border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-3 px-4">
          {uploading ? (
            <>
              <Loader2 size={32} className="text-primary animate-spin" />
              <span className="text-sm text-text-secondary">上传中...</span>
            </>
          ) : (
            <>
              <Upload size={28} className="text-text-tertiary" />
              <span className="text-sm text-text-secondary text-center">
                {label}
              </span>
              {emptyHint && (
                <span className="text-xs text-text-tertiary">{emptyHint}</span>
              )}
              {!disabled && (
                <div className="flex gap-2 w-full max-w-xs mt-1">
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium"
                  >
                    <Camera size={16} />
                    拍摄
                  </button>
                  <button
                    type="button"
                    onClick={() => albumRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-100 text-text-primary text-sm font-medium"
                  >
                    <Images size={16} />
                    相册
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {mediaUrl && !disabled && !uploading && (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 text-sm text-text-primary"
          >
            <Camera size={14} />
            重新拍摄
          </button>
          <button
            type="button"
            onClick={() => albumRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 text-sm text-text-primary"
          >
            <Images size={14} />
            换一张
          </button>
        </div>
      )}
    </div>
  );
}

export default MediaUploader;
