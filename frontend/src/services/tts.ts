/**
 * 云端 TTS：调用后端 /api/tts，返回 MP3 Blob（晓晓·助手女声）
 */
export async function synthesizeSpeech(text: string): Promise<Blob> {
  const token = localStorage.getItem('token');
  const base = import.meta.env.VITE_API_BASE_URL || '/api';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(`${base}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || contentType.includes('application/json')) {
      let message = '语音合成失败';
      try {
        const data = await res.json();
        if (data?.message) message = data.message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }

    const blob = await res.blob();
    if (!blob || blob.size < 100) {
      throw new Error('语音数据为空');
    }
    return blob;
  } finally {
    clearTimeout(timer);
  }
}
