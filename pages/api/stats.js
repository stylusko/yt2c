import { getStats } from '../../lib/telegram';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const stats = await getStats('month');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.json({ visitors: stats.totalVisitors, cards: stats.totalCards });
  } catch (e) {
    res.json({ visitors: 0, cards: 0 });
  }
}
