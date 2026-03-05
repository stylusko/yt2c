import Redis from 'ioredis';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let _redis = null;
function getRedis() {
  if (!_redis) _redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  return _redis;
}

/**
 * Send a message via Telegram Bot API
 */
export async function sendMessage(text, chatId = CHAT_ID) {
  if (!BOT_TOKEN || !chatId) {
    console.warn('[telegram] BOT_TOKEN or CHAT_ID not set, skipping');
    return null;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error('[telegram] API error:', data.description);
    return data;
  } catch (err) {
    console.error('[telegram] Send failed:', err.message);
    return null;
  }
}

/**
 * Get today's date string in KST (YYYY-MM-DD)
 */
function getKSTDateStr(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/**
 * Redis key for daily stats
 */
function dailyKey(dateStr) {
  return `yt2c:stats:daily:${dateStr}`;
}

/**
 * Track a completed/failed job in Redis stats
 */
export async function trackJob(jobId, cardCount, status, durationSec = 0) {
  const redis = getRedis();
  const key = dailyKey(getKSTDateStr());
  const pipe = redis.pipeline();
  pipe.hincrby(key, 'jobs', 1);
  if (status === 'completed') {
    pipe.hincrby(key, 'cards', cardCount);
    pipe.hincrby(key, 'totalDuration', Math.round(durationSec));
  } else {
    pipe.hincrby(key, 'failed', 1);
  }
  pipe.expire(key, 90 * 24 * 60 * 60); // 90 days TTL
  await pipe.exec();
}

/**
 * Get stats for a period
 */
export async function getStats(period = 'today') {
  const redis = getRedis();
  const now = new Date();
  let days = 1;
  if (period === 'week') days = 7;
  else if (period === 'month') days = 30;

  let totalJobs = 0, totalCards = 0, totalFailed = 0, totalDuration = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = dailyKey(getKSTDateStr(d));
    const data = await redis.hgetall(key);
    if (data) {
      totalJobs += parseInt(data.jobs || '0');
      totalCards += parseInt(data.cards || '0');
      totalFailed += parseInt(data.failed || '0');
      totalDuration += parseInt(data.totalDuration || '0');
    }
  }

  const avgPerCard = totalCards > 0 ? Math.round(totalDuration / totalCards) : 0;

  return { totalJobs, totalCards, totalFailed, totalDuration, avgPerCard, period, days };
}

/**
 * Notify job group completion
 */
export async function notifyGroupComplete(jobId, completedCount, failedCount, durationSec) {
  const formatName = completedCount > 0 ? '영상' : '-';
  const lines = [
    `✅ 카드 생성 완료`,
    `- Job: ${jobId.slice(0, 8)}`,
    `- 카드: ${completedCount}장 (${formatName})`,
    ...(failedCount > 0 ? [`- 실패: ${failedCount}장`] : []),
    `- 소요: ${Math.round(durationSec)}초`,
  ];
  await sendMessage(lines.join('\n'));
}

/**
 * Notify job failure
 */
export async function notifyJobFailed(jobId, cardIdx, error) {
  const lines = [
    `❌ 카드 생성 실패`,
    `- Job: ${jobId.slice(0, 8)}, Card #${cardIdx}`,
    `- 오류: ${String(error).slice(0, 200)}`,
  ];
  await sendMessage(lines.join('\n'));
}

/**
 * Notify low resolution detection (cookie expiry warning)
 */
export async function notifyLowResolution(jobId, width, height) {
  const lines = [
    `⚠️ 저해상도 감지 (${width}x${height})`,
    `쿠키 만료 가능성!`,
    `갱신 방법:`,
    `1. 브라우저에서 YouTube 로그인`,
    `2. cookies.txt 익스텐션으로 쿠키 추출`,
    `3. base64 인코딩: base64 -i cookies.txt`,
    `4. Railway 환경변수 YT_COOKIES_B64 업데이트`,
  ];
  await sendMessage(lines.join('\n'));
}

/**
 * Notify worker start
 */
export async function notifyWorkerStart() {
  const now = new Date();
  const kstStr = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  await sendMessage(`🚀 워커 시작됨\n시간: ${kstStr} KST`);
}

/**
 * Send daily report
 */
export async function sendDailyReport() {
  const dateStr = getKSTDateStr(new Date(Date.now() - 1000)); // slightly before midnight = yesterday if called at midnight
  const redis = getRedis();
  const key = dailyKey(dateStr);
  const data = await redis.hgetall(key);

  const jobs = parseInt(data?.jobs || '0');
  const cards = parseInt(data?.cards || '0');
  const failed = parseInt(data?.failed || '0');
  const totalDuration = parseInt(data?.totalDuration || '0');
  const avg = cards > 0 ? Math.round(totalDuration / cards) : 0;

  const lines = [
    `📊 일일 리포트 (${dateStr})`,
    `━━━━━━━━━━━━━━━━━━`,
    `총 작업: ${jobs}건`,
    `생성 카드: ${cards}장`,
    `실패: ${failed}건`,
    `평균 소요: ${avg}초/카드`,
    `━━━━━━━━━━━━━━━━━━`,
  ];
  await sendMessage(lines.join('\n'));
}

/**
 * Format stats into a message
 */
export function formatStats(stats) {
  const periodLabel = stats.period === 'today' ? '오늘' : stats.period === 'week' ? '이번 주' : '이번 달';
  const lines = [
    `📊 ${periodLabel} 통계 (${stats.days}일)`,
    `━━━━━━━━━━━━━━━━━━`,
    `총 작업: ${stats.totalJobs}건`,
    `생성 카드: ${stats.totalCards}장`,
    `실패: ${stats.totalFailed}건`,
    `평균 소요: ${stats.avgPerCard}초/카드`,
    `━━━━━━━━━━━━━━━━━━`,
  ];
  return lines.join('\n');
}
