function hashString32(value) {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function imageSourceFingerprint(src) {
  if (!src) return '';
  const text = String(src);
  const semi = text.indexOf(';');
  const query = text.indexOf('?');
  const kind = text.startsWith('data:')
    ? text.slice(0, Math.min(semi >= 0 ? semi : text.length, 48))
    : text.slice(0, Math.min(query >= 0 ? query : text.length, 48));
  return `${kind}:${text.length}:${hashString32(text)}`;
}

export function logoSafeOverlayFingerprint(overlays = []) {
  return JSON.stringify((overlays || [])
    .filter(ov =>
      ov?.type === 'logo' &&
      ov.image &&
      ov.aboveLayout !== false &&
      (ov.opacity ?? 1) > 0
    )
    .map(ov => ({
      img: imageSourceFingerprint(ov.image || ''),
      x: ov.x ?? 50,
      y: ov.y ?? 50,
      sc: ov.scale ?? 100,
      op: ov.opacity ?? 1,
      al: ov.aboveLayout !== false,
    })));
}

export function isArticleCardLike(card) {
  return card?.sourceType === 'article' || card?.articleType === 'cover' || card?.articleType === 'content' || !!card?.articleMeta;
}

export function usesArticlePhotoAreaLike(card) {
  const layout = card?.layout || 'photo_top';
  return isArticleCardLike(card) && (card?.fillSource || 'video') === 'image' && (card?.videoFill || 'full') === 'split' && (layout === 'photo_top' || layout === 'photo_bottom');
}

export function cardBackgroundFingerprint(card, globalConfig = {}) {
  const fillSource = card?.fillSource || 'video';
  const cardUrl = card?.url || globalConfig.globalUrl || '';
  const imageSrc = card?.uploadedImage
    || ((fillSource === 'image' || (!cardUrl && globalConfig.globalBgImage)) ? globalConfig.globalBgImage : '')
    || '';
  const meta = card?.articleMeta || {};
  return [
    imageSourceFingerprint(imageSrc),
    meta.aiImageSource || '',
    meta.sourceImageIndex ?? '',
    meta.aiImageSeed ?? '',
    meta.aiImagePrompt ? hashString32(meta.aiImagePrompt) : '',
    meta.stylePresetId || '',
  ].join('|');
}

export function getCardCacheData(card, globalConfig = {}, articleImageRenderVersion = 0) {
  const isArticle = isArticleCardLike(card) || globalConfig?.sourceType === 'article';
  const hashCard = isArticle ? { ...card, sourceType: 'article' } : card;
  return {
    rv: articleImageRenderVersion,
    ar: globalConfig.aspectRatio, os: globalConfig.outputSize, of: globalConfig.outputFormat,
    url: card.url || globalConfig.globalUrl || '',
    start: card.appliedStart || card.start || '', end: card.appliedEnd || card.end || '',
    vx: card.videoX ?? 0, vy: card.videoY ?? 0, vs: card.videoScale ?? 100, vb: card.videoBrightness ?? 0,
    layout: card.layout || 'photo_top', ug: card.useGradient || false, pr: card.photoRatio ?? 50,
    bid: card.brandGuideId || '', blid: card.brandLayoutId || '',
    vf: card.videoFill || 'full', fs: card.fillSource || 'video',
    title: card.title || '', ut: card.useTitle !== false,
    sub: card.subtitle || '', us: card.useSubtitle !== false,
    body: card.body || '', ub: card.useBody !== false,
    box: card.boxText || '', ubox: card.useBoxText !== false,
    ts: card.titleSize || 64, tc: card.titleColor || '#fff', tf: card.titleFont || '',
    tls: card.titleLetterSpacing ?? 0, tlsu: card.titleLetterSpacingUnit || 'px', tlh: card.titleLineHeight ?? 1.4, tx: card.titleX ?? 0, ty: card.titleY ?? 0,
    ss: card.subtitleSize || 48, sc: card.subtitleColor || '#aaa', sf: card.subtitleFont || '',
    sls: card.subtitleLetterSpacing ?? 0, slsu: card.subtitleLetterSpacingUnit || 'px', slh: card.subtitleLineHeight ?? 1.4, sx: card.subtitleX ?? 0, sy: card.subtitleY ?? 0,
    bs: card.bodySize || 40, bc: card.bodyColor || '#d2d2d2', bf: card.bodyFont || '',
    bls: card.bodyLetterSpacing ?? 0, blsu: card.bodyLetterSpacingUnit || 'px', blh: card.bodyLineHeight ?? 1.4, bx: card.bodyX ?? 0, by: card.bodyY ?? 0,
    bxs: card.boxTextSize || 32, bxc: card.boxTextColor || '#111111', bxf: card.boxTextFont || '',
    bxls: card.boxTextLetterSpacing ?? 0, bxlsu: card.boxTextLetterSpacingUnit || 'px',
    bgc: card.bgColor || '#121212', bgo: card.bgOpacity ?? 0.75, useBg: card.useBg !== false,
    ovl: (card.overlays || []).map(o => ({
      img: imageSourceFingerprint(o.image || o.src || ''),
      x: o.x ?? 50,
      y: o.y ?? 50,
      sc: o.scale ?? 100,
      op: o.opacity ?? 1,
      al: !!o.aboveLayout,
      all: !!o.applyToAll,
      t: o.type || '',
      lcm: o.logoColorMode || 'original',
      lc: o.logoColor || '',
    })),
    ui: card.uploadedImage ? 'y' : 'n',
    bg: cardBackgroundFingerprint(card, globalConfig),
    ...(isArticle ? { st: 'article', ifit: 'cover', ia: usesArticlePhotoAreaLike(hashCard) ? 'photo' : 'full', airv: articleImageRenderVersion } : {}),
    btTop: card.baeminTextTop ?? '', btTopR: card.baeminTextTopRatio ?? '', btBot: card.baeminTextBottom ?? '',
    tbx: card.textBoxX ?? 50, tby: card.textBoxY ?? 70, tbw: card.textBoxWidth ?? 80,
    tbh: card.textBoxHeight ?? 0, tbp: card.textBoxPadding ?? 20,
    tbpx: card.textBoxPaddingX ?? '', tbpy: card.textBoxPaddingY ?? '',
    tbr: card.textBoxRadius ?? 12,
    tbbc: card.textBoxBgColor || '#000', tbbo: card.textBoxBgOpacity ?? 0.6,
    tbbrc: card.textBoxBorderColor || '#ffffff', tbbrw: card.textBoxBorderWidth ?? 0,
    ta: card.titleAlign || 'left', sa: card.subtitleAlign || 'left', ba: card.bodyAlign || 'left',
    bxa: card.boxTextAlign || 'left',
    bxls: card.boxTextLetterSpacing ?? 0, bxlh: card.boxTextLineHeight ?? 1.45,
    bxx: card.boxTextX ?? 0, bxy: card.boxTextY ?? 0,
  };
}

export function computeCardCacheHash(card, globalConfig = {}, articleImageRenderVersion = 0) {
  return hashString32(JSON.stringify(getCardCacheData(card, globalConfig, articleImageRenderVersion)));
}
