import Redis from 'ioredis';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let _redis = null;
function getRedis() {
  if (!_redis) _redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  return _redis;
}

function escMd(text) {
  return String(text).replace(/([_*`\[])/g, '\\$1');
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
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
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
  let totalVisitors = 0, totalSessions = 0, totalSessionDuration = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = getKSTDateStr(d);
    const key = dailyKey(dateStr);
    const data = await redis.hgetall(key);
    if (data) {
      totalJobs += parseInt(data.jobs || '0');
      totalCards += parseInt(data.cards || '0');
      totalFailed += parseInt(data.failed || '0');
      totalDuration += parseInt(data.totalDuration || '0');
    }
    // Visitor stats
    const visitorCount = await redis.scard(`yt2c:visitors:daily:${dateStr}`);
    totalVisitors += visitorCount;
    const durData = await redis.hgetall(`yt2c:duration:daily:${dateStr}`);
    if (durData) {
      totalSessions += parseInt(durData.sessions || '0');
      totalSessionDuration += parseInt(durData.totalSeconds || '0');
    }
  }

  const avgPerCard = totalCards > 0 ? Math.round(totalDuration / totalCards) : 0;
  const avgSessionDuration = totalSessions > 0 ? Math.round(totalSessionDuration / totalSessions) : 0;

  return { totalJobs, totalCards, totalFailed, totalDuration, avgPerCard, totalVisitors, avgSessionDuration, period, days };
}

/**
 * Notify job group completion
 */
export async function notifyGroupComplete(jobId, completedCount, failedCount, durationSec, details = {}) {
  const formatName = completedCount > 0 ? '영상' : '-';
  const completedCards = Array.isArray(details.completedCards) ? details.completedCards : [];
  const failedCards = Array.isArray(details.failedCards) ? details.failedCards : [];
  // 인증 경로 표시
  const auth = details.authSummary;
  let authLabel = '-';
  if (auth) {
    if (auth.imageBg && !auth.poToken && !auth.cookies && !auth.proxy) {
      authLabel = '이미지 배경 (다운로드 없음)';
    } else {
      const direct = [auth.poToken && 'PO Token', auth.cookies && 'Cookies'].filter(Boolean).join(' + ');
      if (auth.proxy) {
        const failReason = auth.directFailReason ? ` (${auth.directFailReason})` : '';
        authLabel = `${direct || '직접'} ❌${failReason} → Proxy ✅`;
      } else {
        authLabel = `${direct || '직접'} ✅`;
      }
    }
  }

  const lines = [
    `✅ 카드 생성 완료`,
    `- Job: ${jobId.slice(0, 8)}`,
    ...(details.projectUrl ? [`- [프로젝트 열기](${details.projectUrl})`] : []),
    `- 카드: ${completedCount}장 (${formatName})`,
    ...(failedCount > 0 ? [`- 실패: ${failedCount}장`] : []),
    `- 소요: ${Math.round(durationSec)}초`,
    `- 인증: ${authLabel}`,
    ...(completedCards.length > 0 ? ['- 카드 다운로드'] : []),
    ...completedCards.map((card) => `  ${card.cardIdx + 1}) [카드 ${card.cardIdx + 1}](${card.url})`),
    ...(failedCards.length > 0 ? ['- 실패 요약'] : []),
    ...failedCards.map((card) => `  ${card.cardIdx + 1}) ${escMd(card.reason)}`),
  ];
  await sendMessage(lines.join('\n'));
}

/**
 * Notify job failure
 */
export async function notifyJobFailed(jobId, cardIdx, error, details = {}) {
  // Extract meaningful error: show both the error type AND stderr details
  const fullMsg = String(error);
  // Split at first newline to separate error.message from appended stderr
  const nlIdx = fullMsg.indexOf('\n');
  let headline = nlIdx > 0 ? fullMsg.slice(0, nlIdx) : fullMsg;
  const stderr = nlIdx > 0 ? fullMsg.slice(nlIdx + 1).trim() : '';

  // Shorten the headline (remove long command path)
  const errMatch = headline.match(/ERROR:.*$/);
  if (errMatch) headline = errMatch[0];
  else headline = headline.slice(0, 150);

  // Get last few meaningful lines from stderr
  const stderrTail = stderr
    ? stderr.split('\n').filter(l => l.trim()).slice(-5).join('\n')
    : '';

  const lines = [
    `❌ 카드 생성 실패`,
    `- Job: ${jobId.slice(0, 8)}, Card #${cardIdx}`,
    ...(details.projectUrl ? [`- [프로젝트 열기](${details.projectUrl})`] : []),
    `- 오류: ${escMd(headline)}`,
    ...(stderrTail ? [`- stderr:\n${escMd(stderrTail.slice(0, 500))}`] : []),
  ];
  await sendMessage(lines.join('\n'));
}

/**
 * Notify low resolution detection (cookie expiry warning)
 */
export async function notifyLowResolution(jobId, width, height) {
  const lines = [
    `⚠️ 저해상도 감지 (${width}x${height})`,
    `원인: YouTube 측 레이트리밋, IP 평판, 인증 상태 등의 영향일 수 있습니다.`,
    `점검 가이드:`,
    `1. 워커 동시성(WORKER_CONCURRENCY)을 낮춰 재시도`,
    `2. 프록시/네트워크 상태 및 최근 403 증가 여부 확인`,
    `3. 최근 yt-dlp 변경 시 버전 롤백 검토`,
  ];
  await sendMessage(lines.join('\n'));
}

/**
 * Notify suspected cookie/session expiry
 */
export async function notifyCookieExpirySuspected(jobId, cardIdx, reason = '') {
  const lines = [
    `⚠️ 쿠키/세션 만료 의심`,
    `- Job: ${jobId.slice(0, 8)}${Number.isInteger(cardIdx) ? `, Card #${cardIdx}` : ''}`,
    ...(reason ? [`- 근거: ${String(reason).slice(0, 180)}`] : []),
    `- 점검: 인증 상태, 403 증가 추세, 네트워크/IP 상태를 함께 확인해 주세요.`,
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

  // Visitor stats
  const visitors = await redis.scard(`yt2c:visitors:daily:${dateStr}`);
  const durData = await redis.hgetall(`yt2c:duration:daily:${dateStr}`);
  const sessions = parseInt(durData?.sessions || '0');
  const totalSec = parseInt(durData?.totalSeconds || '0');
  const avgDuration = sessions > 0 ? Math.round(totalSec / sessions) : 0;

  const lines = [
    `📊 일일 리포트 (${dateStr})`,
    `━━━━━━━━━━━━━━━━━━`,
    `방문자: ${visitors}명`,
    `평균 체류: ${formatDuration(avgDuration)}`,
    `총 작업: ${jobs}건`,
    `생성 카드: ${cards}장`,
    `실패: ${failed}건`,
    `평균 소요: ${avg}초/카드`,
    `━━━━━━━━━━━━━━━━━━`,
  ];
  await sendMessage(lines.join('\n'));
}

/**
 * Format seconds into human-readable duration
 */
function formatDuration(sec) {
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s > 0 ? `${m}분 ${s}초` : `${m}분`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}시간 ${rm}분` : `${h}시간`;
}

/**
 * Format stats into a message
 */
export function formatStats(stats) {
  const periodLabel = stats.period === 'today' ? '오늘' : stats.period === 'week' ? '이번 주' : '이번 달';
  const lines = [
    `📊 ${periodLabel} 통계 (${stats.days}일)`,
    `━━━━━━━━━━━━━━━━━━`,
    `방문자: ${stats.totalVisitors}명`,
    `평균 체류: ${formatDuration(stats.avgSessionDuration)}`,
    `총 작업: ${stats.totalJobs}건`,
    `생성 카드: ${stats.totalCards}장`,
    `실패: ${stats.totalFailed}건`,
    `평균 소요: ${stats.avgPerCard}초/카드`,
    `━━━━━━━━━━━━━━━━━━`,
  ];
  return lines.join('\n');
}
