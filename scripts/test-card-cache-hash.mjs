import assert from 'node:assert/strict';
import { cardBackgroundFingerprint, computeCardCacheHash, logoSafeOverlayFingerprint } from '../lib/card-cache-hash.js';

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

assert.notEqual(
  computeCardCacheHash({ ...aiCard, sourceType: 'youtube', articleType: null, articleMeta: null }, { ...cfg, sourceType: 'youtube' }, 5),
  computeCardCacheHash({ ...aiCard, sourceType: 'youtube', articleType: null, articleMeta: null }, { ...cfg, sourceType: 'youtube' }, 6),
  'render version must invalidate cached output for every card type',
);

const logoOverlay = {
  type: 'logo',
  image: 'data:image/png;base64,' + 'logo'.repeat(32),
  x: 50,
  y: 94,
  scale: 16,
  opacity: 1,
  aboveLayout: true,
};

assert.equal(
  logoSafeOverlayFingerprint([]),
  logoSafeOverlayFingerprint([{ ...logoOverlay, image: null }]),
  'blank logo overlays must not reserve logo safe area',
);

assert.equal(
  logoSafeOverlayFingerprint([logoOverlay]),
  logoSafeOverlayFingerprint([{ ...logoOverlay }]),
  'unchanged visible logo should keep the same logo safe key',
);

assert.notEqual(
  logoSafeOverlayFingerprint([logoOverlay]),
  logoSafeOverlayFingerprint([{ ...logoOverlay, y: 86 }]),
  'visible logo position must affect the logo safe key',
);

assert.equal(
  logoSafeOverlayFingerprint([logoOverlay, { ...logoOverlay, aboveLayout: false }]),
  logoSafeOverlayFingerprint([logoOverlay]),
  'below-layout logo overlays must not reserve logo safe area',
);

assert.equal(
  logoSafeOverlayFingerprint([logoOverlay, { ...logoOverlay, opacity: 0 }]),
  logoSafeOverlayFingerprint([logoOverlay]),
  'invisible logo overlays must not reserve logo safe area',
);

assert.notEqual(
  computeCardCacheHash({ ...articleCard, overlays: [logoOverlay] }, cfg, 5),
  computeCardCacheHash({ ...articleCard, overlays: [{ ...logoOverlay, aboveLayout: false }] }, cfg, 5),
  'overlay layer position must be part of the cache hash',
);

assert.notEqual(
  computeCardCacheHash({ ...articleCard, overlays: [logoOverlay] }, cfg, 5),
  computeCardCacheHash({ ...articleCard, overlays: [{ ...logoOverlay, scale: 24 }] }, cfg, 5),
  'overlay scale must be part of the cache hash',
);

assert.notEqual(
  computeCardCacheHash({ ...articleCard, overlays: [logoOverlay] }, cfg, 5),
  computeCardCacheHash({ ...articleCard, overlays: [{ ...logoOverlay, image: 'data:image/png;base64,' + 'brand'.repeat(32) }] }, cfg, 5),
  'overlay image must be part of the cache hash',
);

assert.notEqual(
  computeCardCacheHash({ ...articleCard, overlays: [{ ...logoOverlay, logoColorMode: 'original', logoColor: '#ffffff' }] }, cfg, 5),
  computeCardCacheHash({ ...articleCard, overlays: [{ ...logoOverlay, logoColorMode: 'solid', logoColor: '#ffffff' }] }, cfg, 5),
  'logo color mode must be part of the cache hash',
);

assert.notEqual(
  computeCardCacheHash({ ...articleCard, overlays: [{ ...logoOverlay, logoColorMode: 'solid', logoColor: '#ffffff' }] }, cfg, 5),
  computeCardCacheHash({ ...articleCard, overlays: [{ ...logoOverlay, logoColorMode: 'solid', logoColor: '#000000' }] }, cfg, 5),
  'logo color value must be part of the cache hash',
);

const baeminCard = {
  ...articleCard,
  brandGuideId: 'baemin-only',
  brandLayoutId: 'bm-cover-square',
  baeminTextBottom: 80,
  textBoxPaddingX: 80,
  textBoxPaddingY: 56,
};

assert.notEqual(
  computeCardCacheHash(baeminCard, cfg, 5),
  computeCardCacheHash({ ...baeminCard, baeminTextBottom: 96 }, cfg, 5),
  'Baemin text anchor must be part of the cache hash',
);

assert.notEqual(
  computeCardCacheHash(baeminCard, cfg, 5),
  computeCardCacheHash({ ...baeminCard, textBoxPaddingX: 96 }, cfg, 5),
  'Baemin text box padding must be part of the cache hash',
);

assert.notEqual(
  computeCardCacheHash(baeminCard, cfg, 5),
  computeCardCacheHash({ ...baeminCard, brandLayoutId: 'bm-cover-reels' }, cfg, 5),
  'Baemin layout preset id must be part of the cache hash',
);

assert.notEqual(
  computeCardCacheHash(baeminCard, cfg, 5),
  computeCardCacheHash({ ...baeminCard, titleLetterSpacing: -5, titleLetterSpacingUnit: 'percent' }, cfg, 5),
  'text letter spacing must be part of the cache hash',
);

assert.notEqual(
  computeCardCacheHash({ ...baeminCard, titleLetterSpacing: -5, titleLetterSpacingUnit: 'px' }, cfg, 5),
  computeCardCacheHash({ ...baeminCard, titleLetterSpacing: -5, titleLetterSpacingUnit: 'percent' }, cfg, 5),
  'text letter spacing unit must be part of the cache hash',
);

assert.notEqual(
  computeCardCacheHash({ ...baeminCard, boxTextLetterSpacing: -5, boxTextLetterSpacingUnit: 'px' }, cfg, 5),
  computeCardCacheHash({ ...baeminCard, boxTextLetterSpacing: -5, boxTextLetterSpacingUnit: 'percent' }, cfg, 5),
  'box text letter spacing unit must be part of the cache hash',
);

assert.notEqual(
  computeCardCacheHash(baeminCard, cfg, 5),
  computeCardCacheHash({ ...baeminCard, titleLineHeight: 1.2 }, cfg, 5),
  'text line height must be part of the cache hash',
);

console.log('card cache hash tests passed');
