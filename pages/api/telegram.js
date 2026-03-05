import { getStats, formatStats, sendMessage } from '../../lib/telegram.js';
import { getVideoQueue } from '../../lib/queue.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body || {};
    if (!message?.text) return res.status(200).json({ ok: true });

    const chatId = String(message.chat?.id);
    const text = message.text.trim();

    // Only respond to known commands
    if (text === '/today') {
      const stats = await getStats('today');
      await sendMessage(formatStats(stats), chatId);
    } else if (text === '/week') {
      const stats = await getStats('week');
      await sendMessage(formatStats(stats), chatId);
    } else if (text === '/month') {
      const stats = await getStats('month');
      await sendMessage(formatStats(stats), chatId);
    } else if (text === '/status') {
      const queue = getVideoQueue();
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
      ]);
      const lines = [
        `🔧 워커 상태`,
        `━━━━━━━━━━━━━━━━━━`,
        `대기: ${waiting}건`,
        `처리 중: ${active}건`,
        `완료: ${completed}건`,
        `실패: ${failed}건`,
        `━━━━━━━━━━━━━━━━━━`,
      ];
      await sendMessage(lines.join('\n'), chatId);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[telegram webhook] error:', err.message);
    return res.status(200).json({ ok: true }); // Always 200 to avoid Telegram retries
  }
}
