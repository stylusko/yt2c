// 디버그용: bucket 연결 상태 확인
import { fileExists } from '../../lib/bucket.js';

export default async function handler(req, res) {
  const endpoint = process.env.BUCKET_ENDPOINT || process.env.AWS_ENDPOINT_URL;
  const accessKey = process.env.BUCKET_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.BUCKET_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const bucketName = process.env.BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || '(not set)';
  const env = {
    endpoint: endpoint ? '✓ set' : '✗ missing',
    accessKey: accessKey ? '✓ set' : '✗ missing',
    secretKey: secretKey ? '✓ set' : '✗ missing',
    bucketName,
  };

  let testResult = 'skipped';
  if (endpoint && accessKey) {
    try {
      const exists = await fileExists('__test__');
      testResult = 'connected (test key not found = normal)';
    } catch (err) {
      testResult = 'FAILED: ' + err.message;
    }
  }

  // 모든 BUCKET/RAILWAY/S3/AWS 관련 환경변수 찾기
  const allBucketVars = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/bucket|s3|aws|storage|object/i.test(k)) {
      allBucketVars[k] = v ? (v.length > 20 ? v.slice(0, 10) + '...' : v) : '(empty)';
    }
  }
  res.json({ env, testResult, allBucketVars });
}
