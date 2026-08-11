import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 把 AI 返回的 Markdown/富文本清洗为适合朗读的「自然中文」。
 * 避免 TTS 把符号读错：* → 乘以、# → 井号、[]()链接 → 读括号里的URL等
 * 保留「标点、数字、汉字、基础标点」，其余全部去掉或替换成自然停顿。
 */
export function preprocessForSpeech(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // 1) 代码块 ```...``` 整体不要读（儿童场景很少涉及）
  text = text.replace(/```[\s\S]*?```/g, '');

  // 2) 行内代码 `foo` → 去掉反引号保留内容
  text = text.replace(/`([^`]+)`/g, '$1');

  // 3) Markdown 链接 [显示文字](http://url) → 只保留"显示文字"
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '$1');

  // 4) 纯 URL 不要读（http / https / www 开头）
  text = text.replace(/https?:\/\/[^\s，。！？、)]+/g, '');
  text = text.replace(/www\.[^\s，。！？、)]+/g, '');

  // 5) Markdown 标题 # ## ### → 去掉 #，保留内容 + 轻微停顿
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 6) 强调符号 *italic* **bold** ~~strike~~ → 只保留内容
  //    注意先处理 ** 再处理 *，避免嵌套残留
  text = text.replace(/\*\*([^*]+?)\*\*/g, '$1');
  text = text.replace(/\*([^*]+?)\*/g, '$1');
  text = text.replace(/__([^_]+?)__/g, '$1');
  text = text.replace(/_([^_]+?)_/g, '$1');
  text = text.replace(/~~([^~]+?)~~/g, '$1');

  // 7) 无序列表 - / * / + 开头、有序列表 1. 2. → 去掉标记 + 停顿
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');

  // 8) 块引用 > 开头 → 去掉 >
  text = text.replace(/^\s*>\s?/gm, '');

  // 9) 水平分割线 --- *** ___ → 删掉（避免 TTS 读成"横杠横杠横杠"）
  text = text.replace(/^\s*([-*_])\s*\1\s*\1[\s\S]*?$/gm, '');

  // 10) Emoji：大多数字符在 SpeechSynthesis 下不会读，但有些会读成
  //     "微笑脸"之类；统一剥离 emoji，保留文字与中文标点。
  //     正则覆盖 Unicode Emoji 范围 + ZWJ 序列。
  text = text.replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{FE0F}]|[\u{200D}\u{20E3}\u{FE0F}]/gu,
    '',
  );

  // 11) 把多余的换行/空格/制表符整理成自然的停顿
  //     连续多个换行 → 句号 + 一个空格（作为段间停顿）
  text = text.replace(/\n{2,}/g, '。 ');
  //     单个换行 → 空格
  text = text.replace(/\n/g, ' ');
  //     连续空白（空格/Tab）→ 一个空格
  text = text.replace(/\s+/g, ' ');

  // 12) 常见"AI 装饰符"：比如 【...】→ 保留内容（去掉括号感）；
  //     但中文标点本来能读，不必动。只把连续重复的标点压成一个，避免 TTS 卡顿。
  text = text.replace(/([，。！？、；：,.!?;:])\1+/g, '$1');

  // 13) 开头和结尾的空白、无意义标点
  text = text.trim();
  text = text.replace(/^[\s，。！？、；：,.!?;:]+/, '');
  text = text.replace(/[\s，。！？、；：,.!?;:]+$/, '');

  return text;
}

/**
 * 比较两段中文是否「疑似同一内容回声」。
 * 用于：TTS 正在外放 AI 回复时，麦克风不小心录到扬声器 → STT 得到一段和
 * AI 回复高度相似的话 → 要丢弃而不是当成用户新输入，避免死循环。
 *
 * 注意：不要把「用户故意引用回复里的任务 ID / 名称」当成回声。
 */
export function isEchoOfLastReply(userText: string, lastReply: string | undefined, threshold = 0.65): boolean {
  if (!lastReply || !userText) return false;
  // 清洗两侧，只看汉字/字母/数字（忽略标点、空格）
  const a = userText.replace(/[\s，。！？、；：,.!?;:\-_"'()（）【】《》\[\]]/g, '');
  const b = lastReply.replace(/[\s，。！？、；：,.!?;:\-_"'()（）【】《》\[\]]/g, '');
  if (!a || !b) return false;

  // 纯数字（任务 ID）/ 过短确认词：一律不当回声
  if (/^\d+$/.test(a) || a.length < 6) return false;

  // 短句：只有「几乎就是回复开头」才算回声（TTS 拾音通常从开头录到）
  // 禁止用「回复全文任意位置包含用户文本」——会误伤用户从清单里点名的任务
  if (a.length <= 20) {
    const head = b.slice(0, Math.max(48, a.length + 8));
    return head.startsWith(a) || (a.length >= 10 && head.includes(a) && head.indexOf(a) < 8);
  }

  // 长句：字符交集比例很高，且长度接近（真回声通常接近整段）
  if (a.length < b.length * 0.35) return false; // 用户话明显更短：更像在回答，不是回声
  const setB = new Set(b.split(''));
  let hit = 0;
  for (const ch of a) if (setB.has(ch)) hit++;
  return hit / a.length >= threshold;
}
