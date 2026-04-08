// 디버그용: bucket 연결 상태 확인
import { fileExists } from '../../lib/bucket.js';

export default async function handler(req, res) {
  const env = {
    BUCKET_ENDPOINT: process.env.BUCKET_ENDPOINT ? '✓ set' : '✗ missing',
    BUCKET_ACCESS_KEY_ID: process.env.BUCKET_ACCESS_KEY_ID ? '✓ set' : '✗ missing',
    BUCKET_SECRET_ACCESS_KEY: process.env.BUCKET_SECRET_ACCESS_KEY ? '✓ set' : '✗ missing',
    BUCKET_NAME: process.env.BUCKET_NAME || '(not set)',
  };

  let testResult = 'skipped';
  if (process.env.BUCKET_ENDPOINT && process.env.BUCKET_ACCESS_KEY_ID) {
    try {
      const exists = await fileExists('__test__');
      testResult = 'connected (test key not found = normal)';
    } catch (err) {
      testResult = 'FAILED: ' + err.message;
    }
  }

  res.json({ env, testResult });
}
