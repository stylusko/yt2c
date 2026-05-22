import assert from 'node:assert/strict';
import { cardBackgroundFingerprint, computeCardCacheHash } from '../lib/card-cache-hash.js';

const cfg = {
  aspectRatio: '1:1',
  outputSize: 1080,
  outputFormat: 'image',
  globalUrl: '',
  globalBgImage: '',
  sourceType: 'article',
};

const baseCard = {
  sourceType: 'article',
  articleType: 'content',
  fillSource: 'image',
  layout: 'photo_top',
  photoRatio: 55,
  videoFill: 'full',
  videoX: 0,
  videoY: 120,
  videoScale: 88,
  title: 'title',
  subtitle: '',
  body: 'body',
  useTitle: true,
  useSubtitle: false,
  useBody: true,
  articleMeta: {
    aiImageSource: 'article',
    sourceImageIndex: 1,
    aiImagePrompt: 'street food shop',
    stylePresetId: 'stock_photo',
  },
};

const articleImage = 'data:image/png;base64,' + 'a'.repeat(128);
const aiImage = 'data:image/png;base64,' + 'b'.repeat(128);

const articleCard = { ...baseCard, uploadedImage: articleImage };
const aiCard = {
  ...baseCard,
  uploadedImage: aiImage,
  articleMeta: {
    ...baseCard.articleMeta,
    aiImageSource: 'ai',
    sourceImageIndex: null,
  },
};

assert.notEqual(
  cardBackgroundFingerprint(articleCard, cfg),
  cardBackgroundFingerprint(aiCard, cfg),
  'background fingerprint must change when article image is replaced with AI image',
);

assert.notEqual(
  computeCardCacheHash(articleCard, cfg, 5),
  computeCardCacheHash(aiCard, cfg, 5),
  'card cache hash must change when uploaded image changes',
);

assert.notEqual(
  computeCardCacheHash({ ...baseCard, uploadedImage: null }, { ...cfg, globalBgImage: articleImage }, 5),
  computeCardCacheHash({ ...baseCard, uploadedImage: null }, { ...cfg, globalBgImage: aiImage }, 5),
  'global image background must be part of the cache hash',
);

assert.equal(
  computeCardCacheHash(aiCard, cfg, 5),
  computeCardCacheHash({ ...aiCard }, cfg, 5),
  'unchanged card state should keep the same cache hash',
);

console.log('card cache hash tests passed');
