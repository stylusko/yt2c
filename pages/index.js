import React, { useState, useRef, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import JSZip from 'jszip';
import LZString from 'lz-string';

/* ── Constants ── */
const BUILD_DATE = '2026.0307';
const BUILD_NUM = 1; // same-day deploy count
const VERSION = `v${BUILD_DATE}.${BUILD_NUM}`;
const CREATOR = 'JH KO';
const CONTACT_EMAIL = 'moonsengwon.me@gmail.com';
const RECENT_FEATURES = [
  '\uD074\uB9BD \uC2DC\uD06C\uBC14 \uD130\uCE58 \uB4DC\uB798\uADF8 + \uAD6C\uAC04\uAE38\uC774 \uD1B5\uD569',
  '\uC0DD\uC131 \uC9C4\uD589 \uBAA8\uB2EC + \uC911\uB2E8 \uAE30\uB2A5',
  '\uBBF8\uB9AC\uBCF4\uAE30\uC5D0\uC11C \uBC14\uB85C \uC0DD\uC131\uD558\uAE30',
  '\uBAA8\uBC14\uC77C \uCE74\uB4DC \uC21C\uC11C \uBCC0\uACBD \uD130\uCE58 \uC9C0\uC6D0',
  '\uBAA8\uBC14\uC77C \uD648\uD654\uBA74 \uC5EC\uBC31 \uAC1C\uC120',
  '\uACF5\uC720 \uB9C1\uD06C \uBC14\uB85C \uD3B8\uC9D1\uD654\uBA74 \uC9C4\uC785',
];

const LAYOUT_OPTIONS = [
  { id: "photo_top", label: "\uD14D\uC2A4\uD2B8\n\uD558\uB2E8" },
  { id: "photo_bottom", label: "\uD14D\uC2A4\uD2B8\n\uC0C1\uB2E8" },
  { id: "gradient_fade", label: "\uADF8\uB77C\uB370\n\uC774\uC158" },
  { id: "full_bg", label: "\uC804\uCCB4\n\uBC30\uACBD" },
  { id: "text_box", label: "\uD14D\uC2A4\uD2B8\n\uBC15\uC2A4" },
  { id: "none", label: "\uD14D\uC2A4\uD2B8\uB9CC" },
];

const ASPECT_OPTIONS = [
  { id: "1:1", label: "1:1", w: 1, h: 1 },
  { id: "3:4", label: "3:4", w: 3, h: 4 },
];

const FILL_SOURCE_OPTIONS = [
  { id: "video", label: "영상" },
  { id: "image", label: "이미지" },
];

const VIDEO_FILL_OPTIONS = [
  { id: "full", label: "전체 채우기" },
  { id: "split", label: "분리형" },
];

const STYLE_PRESETS = [
  { id: 'photo_top', label: '\uD14D\uC2A4\uD2B8 \uD558\uB2E8', desc: '\uC704\uC5D0 \uC601\uC0C1, \uC544\uB798\uC5D0 \uD14D\uC2A4\uD2B8', layout: 'photo_top', bgColor: '#121212', bgOpacity: 0.8, useGradient: false, titleColor: '#ffffff', subtitleColor: '#aaaaaa', bodyColor: '#d2d2d2', titleSize: 56, subtitleSize: 44, bodySize: 36, titleAlign: 'left', subtitleAlign: 'left', bodyAlign: 'left', titleY: 0, subtitleY: 0, bodyY: 0, photoRatio: 50, textBoxBgColor: '#000000', textBoxBgOpacity: 0.6 },
  { id: 'photo_bottom', label: '\uD14D\uC2A4\uD2B8 \uC0C1\uB2E8', desc: '\uC704\uC5D0 \uD14D\uC2A4\uD2B8, \uC544\uB798\uC5D0 \uC601\uC0C1', layout: 'photo_bottom', bgColor: '#181818', bgOpacity: 0.7, useGradient: false, titleColor: '#ffffff', subtitleColor: '#a0a0a0', bodyColor: '#c8c8c8', titleSize: 52, subtitleSize: 42, bodySize: 34, titleAlign: 'left', subtitleAlign: 'left', bodyAlign: 'left', titleY: 0, subtitleY: 0, bodyY: 0, photoRatio: 50, textBoxBgColor: '#000000', textBoxBgOpacity: 0.6 },
  { id: 'gradient_fade', label: '\uADF8\uB77C\uB370\uC774\uC158', desc: '\uC601\uC0C1\uC774 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uD14D\uC2A4\uD2B8\uB85C \uC774\uC5B4\uC838\uC694', layout: 'photo_top', bgColor: '#121212', bgOpacity: 1, useGradient: true, titleColor: '#ffffff', subtitleColor: '#c0c0c0', bodyColor: '#e0e0e0', titleSize: 56, subtitleSize: 44, bodySize: 36, titleAlign: 'left', subtitleAlign: 'left', bodyAlign: 'left', titleY: 0, subtitleY: 0, bodyY: 0, photoRatio: 55, textBoxBgColor: '#000000', textBoxBgOpacity: 0.6 },
  { id: 'full_bg', label: '\uC804\uCCB4 \uBC30\uACBD', desc: '\uC601\uC0C1 \uC704\uC5D0 \uD14D\uC2A4\uD2B8\uB97C \uC62C\uB9B0 \uC2A4\uD0C0\uC77C', layout: 'full_bg', bgColor: '#0a0a0a', bgOpacity: 0.85, useGradient: false, titleColor: '#ffffff', subtitleColor: '#b0b0b0', bodyColor: '#d0d0d0', titleSize: 56, subtitleSize: 44, bodySize: 36, titleAlign: 'left', subtitleAlign: 'left', bodyAlign: 'left', titleY: 0, subtitleY: 0, bodyY: 0, textBoxBgColor: '#000000', textBoxBgOpacity: 0.6 },
  { id: 'clean_box', label: '\uD14D\uC2A4\uD2B8 \uBC15\uC2A4', desc: '\uBC18\uD22C\uBA85 \uBC15\uC2A4 \uC548\uC5D0 \uD14D\uC2A4\uD2B8', layout: 'text_box', bgColor: '#1a1a2e', bgOpacity: 0.5, useGradient: false, titleColor: '#ffffff', subtitleColor: '#c8c8d0', bodyColor: '#e0e0e8', titleSize: 52, subtitleSize: 40, bodySize: 34, titleAlign: 'center', subtitleAlign: 'center', bodyAlign: 'center', titleY: 0, subtitleY: 0, bodyY: 0, textBoxBgColor: '#000000', textBoxBgOpacity: 0.55, textBoxX: 50, textBoxY: 55, textBoxWidth: 85, textBoxPadding: 24, textBoxRadius: 16 },
  { id: 'text_only', label: '\uD14D\uC2A4\uD2B8\uB9CC', desc: '\uBC30\uACBD \uC5C6\uC774 \uD14D\uC2A4\uD2B8\uB9CC \uD45C\uC2DC', layout: 'none', bgColor: '#3a3a3a', bgOpacity: 1, useGradient: false, titleColor: '#ffffff', subtitleColor: '#b0b0b0', bodyColor: '#d0d0d0', titleSize: 56, subtitleSize: 44, bodySize: 36, titleAlign: 'center', subtitleAlign: 'center', bodyAlign: 'center', titleY: 0, subtitleY: 0, bodyY: 0, textBoxBgColor: '#000000', textBoxBgOpacity: 0.6 },
];

const DEFAULT_CARD = () => ({
  id: Date.now() + Math.random(),
  name: '',
  url: "", start: "0:00", end: "0:10",
  layout: "photo_top", photoRatio: 50, useGradient: false,
  fillSource: "video", videoFill: "full",
  uploadedImage: null,
  useTitle: true, useSubtitle: true, useBody: true,
  title: "제목을 입력하세요", titleSize: 56, titleFont: "Pretendard-Bold.otf",
  subtitle: "부제목을 입력하세요", subtitleSize: 44, subtitleFont: "Pretendard-Regular.otf",
  body: "본문 내용을 입력하세요", bodySize: 36, bodyFont: "Pretendard-Regular.otf",
  useBg: true, bgColor: "#121212", bgOpacity: 0.75,
  overlays: [],
  titleColor: "#ffffff", subtitleColor: "#aaaaaa", bodyColor: "#d2d2d2",
  titleLetterSpacing: 0, titleLineHeight: 1.4, titleX: 0, titleY: 0, titleAlign: 'left',
  subtitleLetterSpacing: 0, subtitleLineHeight: 1.4, subtitleX: 0, subtitleY: 0, subtitleAlign: 'left',
  bodyLetterSpacing: 0, bodyLineHeight: 1.4, bodyX: 0, bodyY: 0, bodyAlign: 'left',
  captureTime: "", videoX: 50, videoY: 50, videoScale: 110, videoBrightness: 0,
  textBoxX: 50, textBoxY: 70, textBoxWidth: 80, textBoxPadding: 20, textBoxRadius: 12,
  textBoxBgColor: "#000000", textBoxBgOpacity: 0.6,
  textBoxHeight: 0, textBoxBorderColor: "#ffffff", textBoxBorderWidth: 0,
});

/* ── Responsive Hook ── */
function useIsMobile(breakpoint = 768) {
  const [mob, setMob] = useState(false);
  useEffect(() => {
    const check = () => setMob(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return mob;
}

/* ── Helpers ── */
function parseTime(str) {
  if (!str) return null;
  const parts = str.trim().split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}
function formatSec(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2,'0')}` : `${sec}초`;
}
function fmtMM(s) {
  if (s == null || isNaN(s)) return '--:--';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return String(m).padStart(1,'0') + ':' + String(sec).padStart(2,'0');
}
function hexToRgb(hex) { return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]; }

/* ── Design Tokens ── */
const T = {
  bg: '#09090b',
  surface: '#111113',
  surfaceHover: '#18181b',
  border: 'rgba(255,255,255,0.06)',
  borderHover: 'rgba(255,255,255,0.12)',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#52525b',
  accent: '#6366f1',
  accentHover: '#818cf8',
  success: '#22c55e',
  successHover: '#16a34a',
  danger: '#ef4444',
  radius: 12,
  radiusSm: 8,
  radiusPill: 999,
  shadow: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
  shadowLg: '0 4px 16px rgba(0,0,0,0.5)',
};

/* ── Shared Styles ── */
const inputBase = {
  padding: '10px 14px', background: T.surface, border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm, fontSize: 14, color: T.text, outline: 'none',
  transition: 'border-color 0.15s',
  width: '100%',
};
const labelBase = { display: 'block', fontSize: 12, color: T.textSecondary, fontWeight: 500, marginBottom: 6 };
const sectionTitle = { fontSize: 13, fontWeight: 600, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 };
const resetBtnStyle = { background: 'rgba(255,255,255,0.06)', border: 'none', color: T.textMuted, fontSize: 10, cursor: 'pointer', padding: '2px 8px', borderRadius: T.radiusPill, transition: 'all 0.15s', whiteSpace: 'nowrap' };
function SectionTitleWithReset({ title, onReset }) {
  return React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 } },
    React.createElement("span", { style: { fontSize: 12, fontWeight: 500, color: T.textSecondary } }, title),
    React.createElement("button", { onClick: onReset, style: resetBtnStyle }, "\uAE30\uBCF8\uAC12"),
  );
}

/* ── Overlay Canvas ── */
async function generateOverlayPng(card, outputSize, aspectRatio = '1:1', { skipOverlays = false, skipBorder = false } = {}) {
  const w = outputSize;
  const h = aspectRatio === '3:4' ? Math.round(outputSize * 4 / 3) : outputSize;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  const layout = card.layout || "photo_top";
  const photoRatio = (card.photoRatio ?? 50) / 100;
  const videoFill = card.videoFill || "full";
  const useBg = card.useBg !== false;
  const useGradient = card.useGradient === true;
  const bgColor = hexToRgb(card.bgColor || "#121212");
  const bgOpacity = card.bgOpacity ?? 0.75;
  const s = w / 1080;
  const padX = Math.round(60 * s), padTop = Math.round(40 * s);
  const maxTextW = w - padX * 2;

  const titleLS = (card.titleLetterSpacing ?? 0) * s;
  const titleLH = card.titleLineHeight ?? 1.4;
  const subtitleLS = (card.subtitleLetterSpacing ?? 0) * s;
  const subtitleLH = card.subtitleLineHeight ?? 1.4;
  const bodyLS = (card.bodyLetterSpacing ?? 0) * s;
  const bodyLH = card.bodyLineHeight ?? 1.4;

  const fontMap = {
    "Pretendard-Bold.otf": "700 {s}px Pretendard, sans-serif",
    "Pretendard-SemiBold.otf": "600 {s}px Pretendard, sans-serif",
    "Pretendard-Regular.otf": "400 {s}px Pretendard, sans-serif",
  };
  const getFont = (name, sz) => (fontMap[name] || "400 {s}px Pretendard, sans-serif").replace("{s}", Math.round(sz));

  function wrapText(text, fontSize, fontName, fieldLS, customMaxW) {
    if (!text) return [];
    ctx.font = getFont(fontName, fontSize);
    const effectiveMaxW = customMaxW || maxTextW;
    const lines = [];
    for (const para of text.split("\n")) {
      if (!para.trim()) { lines.push(""); continue; }
      let cur = "";
      for (const ch of para) {
        const test = cur + ch;
        const extraLS = fieldLS * test.length;
        if (ctx.measureText(test).width + extraLS > effectiveMaxW && cur) { lines.push(cur); cur = ch; }
        else cur = test;
      }
      if (cur) lines.push(cur);
    }
    return lines;
  }

  // Helper to draw text with letter spacing
  function measureTextLS(text, fieldLS) {
    if (fieldLS === 0) return ctx.measureText(text).width;
    let w2 = 0;
    for (const ch of text) w2 += ctx.measureText(ch).width + fieldLS;
    return w2 - (text.length > 0 ? fieldLS : 0);
  }

  function drawTextLS(text, x, y, fieldLS) {
    if (fieldLS === 0) { ctx.fillText(text, x, y); return; }
    let cx = x;
    for (const ch of text) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + fieldLS;
    }
  }

  function alignX(text, align, fieldLS) {
    if (align === 'center') return w / 2 - measureTextLS(text, fieldLS) / 2;
    if (align === 'right') return w - padX - measureTextLS(text, fieldLS);
    return padX; // left
  }

  // Measure actual font baseline offset to match CSS line-height centering
  const _blCache = {};
  function getBaselineOffset(fontStr, fontSize, lineHeight) {
    const key = `${fontStr}:${lineHeight}`;
    if (_blCache[key] != null) return _blCache[key];
    ctx.font = fontStr;
    const m = ctx.measureText('ABCDEFGHIJKLabcgpyq가나다');
    const ascent = m.actualBoundingBoxAscent;
    const descent = m.actualBoundingBoxDescent;
    const offset = (lineHeight - (ascent + descent)) / 2 + ascent;
    _blCache[key] = offset;
    return offset;
  }

  const titleSz = Math.round(card.titleSize * s);
  const subSz = Math.round(card.subtitleSize * s);
  const bodySz = Math.round(card.bodySize * s);
  const titleLh = Math.round(titleSz * titleLH);
  const subLh = Math.round(subSz * subtitleLH);
  const bodyLh = Math.round(bodySz * bodyLH);
  const titleOX = Math.round((card.titleX ?? 0) * s), titleOY = Math.round((card.titleY ?? 0) * s);
  const subOX = Math.round((card.subtitleX ?? 0) * s), subOY = Math.round((card.subtitleY ?? 0) * s);
  const bodyOX = Math.round((card.bodyX ?? 0) * s), bodyOY = Math.round((card.bodyY ?? 0) * s);

  // Helper: draw overlay images filtered by aboveLayout flag
  async function drawOverlays(above) {
    if (skipOverlays) return;
    for (const ov of (card.overlays || [])) {
      if (!ov.image || !!ov.aboveLayout !== above) continue;
      try {
        const oImg = new Image();
        await new Promise((resolve, reject) => { oImg.onload = resolve; oImg.onerror = reject; oImg.src = ov.image; });
        const oScale = (ov.scale || 100) / 100;
        const fitRatio = w / oImg.width;
        const oW = oImg.width * fitRatio * oScale;
        const oH = oImg.height * fitRatio * oScale;
        const oX = (ov.x ?? 50) / 100 * w - oW / 2;
        const oY = (ov.y ?? 50) / 100 * h - oH / 2;
        ctx.globalAlpha = ov.opacity ?? 1;
        ctx.drawImage(oImg, oX, oY, oW, oH);
        ctx.globalAlpha = 1;
      } catch (e) { /* ignore */ }
    }
  }

  // Draw below-layout overlays
  await drawOverlays(false);

  if (layout === "none") {
    // 없음: 텍스트 오버레이 없이 영상/이미지만
  } else if (layout === "full_bg") {
    // 전체: solid bg covers entire card
    if (useBg) {
      ctx.fillStyle = `rgba(${bgColor[0]},${bgColor[1]},${bgColor[2]},${bgOpacity})`;
      ctx.fillRect(0, 0, w, h);
    }
    let curY = h - padTop;
    const allItems = [];
    if (card.title) for (const ln of wrapText(card.title, titleSz, card.titleFont, titleLS)) allItems.push({ text: ln, font: getFont(card.titleFont, titleSz), color: card.titleColor, lh: titleLh, sz: titleSz, ls: titleLS, ox: titleOX, oy: titleOY, align: card.titleAlign || 'left' });
    if (card.subtitle) { allItems.push({ type: "gap", size: Math.round(10 * s) }); for (const ln of wrapText(card.subtitle, subSz, card.subtitleFont, subtitleLS)) allItems.push({ text: ln, font: getFont(card.subtitleFont, subSz), color: card.subtitleColor, lh: subLh, sz: subSz, ls: subtitleLS, ox: subOX, oy: subOY, align: card.subtitleAlign || 'left' }); }
    if (card.body) { allItems.push({ type: "gap", size: Math.round(15 * s) }); for (const ln of wrapText(card.body, bodySz, card.bodyFont, bodyLS)) allItems.push({ text: ln, font: getFont(card.bodyFont, bodySz), color: card.bodyColor, lh: bodyLh, sz: bodySz, ls: bodyLS, ox: bodyOX, oy: bodyOY, align: card.bodyAlign || 'left' }); }
    allItems.reverse();
    for (const item of allItems) {
      if (item.type === "gap") { curY -= item.size; continue; }
      if (!item.text) { curY -= Math.round(20 * s); continue; }
      curY -= item.lh;
      ctx.font = item.font; ctx.fillStyle = item.color;
      drawTextLS(item.text, alignX(item.text, item.align, item.ls) + (item.ox || 0), curY + getBaselineOffset(item.font, item.sz, item.lh) + (item.oy || 0), item.ls);
    }
  } else if (layout === "text_box") {
    // Text box layout: rounded box with text inside
    const boxW = w * (card.textBoxWidth || 80) / 100;
    const boxX = (card.textBoxX || 50) / 100 * w - boxW / 2;
    const boxY = (card.textBoxY || 70) / 100 * h;
    const boxPad = Math.round((card.textBoxPadding || 20) * s);
    const boxRad = Math.round((card.textBoxRadius || 12) * s);
    const boxBgRgb = (card.textBoxBgColor || "#000000").replace("#","").match(/.{2}/g)?.map(h=>parseInt(h,16)) || [0,0,0];
    const boxBgOp = card.textBoxBgOpacity ?? 0.6;
    const boxBorderW = Math.round((card.textBoxBorderWidth || 0) * s);
    const textContentBoxW = boxW - boxPad * 2;

    // Pre-wrap text using box width constraint (not full canvas width)
    const titleLines = card.title ? wrapText(card.title, titleSz, card.titleFont, titleLS, textContentBoxW) : [];
    const subtitleLines = card.subtitle ? wrapText(card.subtitle, subSz, card.subtitleFont, subtitleLS, textContentBoxW) : [];
    const bodyLines = card.body ? wrapText(card.body, bodySz, card.bodyFont, bodyLS, textContentBoxW) : [];

    // Calculate actual text content height for auto-height (matching preview CSS auto-height)
    let contentH = 0;
    if (titleLines.length > 0) contentH += titleLines.length * titleLh;
    if (subtitleLines.length > 0) { if (titleLines.length > 0) contentH += Math.round(10 * s); contentH += subtitleLines.length * subLh; }
    if (bodyLines.length > 0) { if (titleLines.length > 0 || subtitleLines.length > 0) contentH += Math.round(15 * s); contentH += bodyLines.length * bodyLh; }

    const boxH = (card.textBoxHeight || 0) > 0 ? h * card.textBoxHeight / 100 : contentH + boxPad * 2;

    // Draw rounded rectangle for box background
    ctx.fillStyle = `rgba(${boxBgRgb[0]},${boxBgRgb[1]},${boxBgRgb[2]},${boxBgOp})`;
    ctx.beginPath();
    ctx.moveTo(boxX + boxRad, boxY - boxH/2);
    ctx.arcTo(boxX + boxW, boxY - boxH/2, boxX + boxW, boxY - boxH/2 + boxRad, boxRad);
    ctx.arcTo(boxX + boxW, boxY + boxH/2, boxX + boxW - boxRad, boxY + boxH/2, boxRad);
    ctx.arcTo(boxX, boxY + boxH/2, boxX, boxY + boxH/2 - boxRad, boxRad);
    ctx.arcTo(boxX, boxY - boxH/2, boxX + boxRad, boxY - boxH/2, boxRad);
    ctx.fill();
    if (boxBorderW > 0) {
      ctx.strokeStyle = card.textBoxBorderColor || '#ffffff';
      ctx.lineWidth = boxBorderW;
      ctx.stroke();
    }

    // Draw text inside box
    const alignXForBox = (text, align, fieldLS) => {
      const tw = measureTextLS(text, fieldLS);
      if (align === 'center') return boxX + boxW/2 - tw/2;
      if (align === 'right') return boxX + boxW - boxPad - tw;
      return boxX + boxPad;
    };
    let curY = boxY - boxH/2 + boxPad;
    if (titleLines.length > 0) { ctx.font = getFont(card.titleFont, titleSz); ctx.fillStyle = card.titleColor; for (const ln of titleLines) { drawTextLS(ln, alignXForBox(ln, card.titleAlign || 'left', titleLS) + titleOX, curY + getBaselineOffset(getFont(card.titleFont, titleSz), titleSz, titleLh) + titleOY, titleLS); curY += titleLh; } }
    if (subtitleLines.length > 0) { if (titleLines.length > 0) curY += Math.round(10 * s); ctx.font = getFont(card.subtitleFont, subSz); ctx.fillStyle = card.subtitleColor; for (const ln of subtitleLines) { drawTextLS(ln, alignXForBox(ln, card.subtitleAlign || 'left', subtitleLS) + subOX, curY + getBaselineOffset(getFont(card.subtitleFont, subSz), subSz, subLh) + subOY, subtitleLS); curY += subLh; } }
    if (bodyLines.length > 0) { if (titleLines.length > 0 || subtitleLines.length > 0) curY += Math.round(15 * s); ctx.font = getFont(card.bodyFont, bodySz); ctx.fillStyle = card.bodyColor; for (const ln of bodyLines) { if (!ln) { curY += bodySz / 2; continue; } drawTextLS(ln, alignXForBox(ln, card.bodyAlign || 'left', bodyLS) + bodyOX, curY + getBaselineOffset(getFont(card.bodyFont, bodySz), bodySz, bodyLh) + bodyOY, bodyLS); curY += bodyLh; } }
  } else {
    const textH = Math.round(h * (1 - photoRatio));
    const yStart = layout === "photo_top" ? h - textH : 0;
    if (useBg) {
      if (useGradient) {
        // Gradient mode for photo_top/photo_bottom
        const gradH = textH + Math.round(h * 0.15);
        const gradStart = layout === "photo_top" ? h - gradH : 0;
        const gradEnd = layout === "photo_top" ? h : gradH;
        for (let y = gradStart; y < gradEnd; y++) {
          const progress = layout === "photo_top" ? (y - gradStart) / gradH : (gradEnd - y) / gradH;
          let alpha;
          if (progress < 0.2) alpha = (progress / 0.2) ** 2 * bgOpacity * 0.5;
          else if (progress < 0.4) alpha = (0.5 + 0.4 * ((progress - 0.2) / 0.2)) * bgOpacity;
          else alpha = (0.9 + 0.1 * ((progress - 0.4) / 0.6)) * bgOpacity;
          ctx.fillStyle = `rgba(${bgColor[0]},${bgColor[1]},${bgColor[2]},${Math.min(alpha, bgOpacity)})`;
          ctx.fillRect(0, y, w, 1);
        }
      } else {
        const effectiveOpacity = videoFill === "split" ? 1 : bgOpacity;
        ctx.fillStyle = `rgba(${bgColor[0]},${bgColor[1]},${bgColor[2]},${effectiveOpacity})`;
        ctx.fillRect(0, yStart, w, textH);
      }
    }
    let curY = yStart + padTop;
    if (card.title) { ctx.font = getFont(card.titleFont, titleSz); ctx.fillStyle = card.titleColor; for (const ln of wrapText(card.title, titleSz, card.titleFont, titleLS)) { ctx.font = getFont(card.titleFont, titleSz); drawTextLS(ln, alignX(ln, card.titleAlign || 'left', titleLS) + titleOX, curY + getBaselineOffset(getFont(card.titleFont, titleSz), titleSz, titleLh) + titleOY, titleLS); curY += titleLh; } }
    if (card.subtitle) { if (card.title) curY += Math.round(10 * s); ctx.font = getFont(card.subtitleFont, subSz); ctx.fillStyle = card.subtitleColor; for (const ln of wrapText(card.subtitle, subSz, card.subtitleFont, subtitleLS)) { ctx.font = getFont(card.subtitleFont, subSz); drawTextLS(ln, alignX(ln, card.subtitleAlign || 'left', subtitleLS) + subOX, curY + getBaselineOffset(getFont(card.subtitleFont, subSz), subSz, subLh) + subOY, subtitleLS); curY += subLh; } }
    if (card.body) { if (card.title || card.subtitle) curY += Math.round(21 * s); ctx.font = getFont(card.bodyFont, bodySz); ctx.fillStyle = card.bodyColor; for (const ln of wrapText(card.body, bodySz, card.bodyFont, bodyLS)) { if (!ln) { curY += bodySz / 2; continue; } ctx.font = getFont(card.bodyFont, bodySz); drawTextLS(ln, alignX(ln, card.bodyAlign || 'left', bodyLS) + bodyOX, curY + getBaselineOffset(getFont(card.bodyFont, bodySz), bodySz, bodyLh) + bodyOY, bodyLS); curY += bodyLh; } }
  }
  // Draw above-layout overlays
  await drawOverlays(true);

  if (!skipBorder) {
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(0, 0, w, 2); ctx.fillRect(0, h - 2, w, 2);
    ctx.fillRect(0, 0, 2, h); ctx.fillRect(w - 2, 0, 2, h);
  }
  return canvas.toDataURL("image/png");
}

/* ── Pill Button ── */
function PillBtn({ active, children, onClick, style }) {
  return React.createElement("button", {
    onClick,
    style: {
      padding: '7px 16px', borderRadius: T.radiusPill, fontSize: 12, fontWeight: 500,
      border: 'none', cursor: 'pointer', transition: 'all 0.15s',
      background: active ? T.accent : T.surface,
      color: active ? '#fff' : T.textSecondary,
      ...style,
    }
  }, children);
}

/* ── Layout Thumbnail ── */
function LayoutThumb({ type, label, active, onClick }) {
  const w = 48, h = 56;
  const imgColor = 'rgba(255,255,255,0.15)';
  const textColor = 'rgba(255,255,255,0.06)';
  const lineColor = 'rgba(255,255,255,0.3)';
  const border = active ? `2px solid ${T.accent}` : '2px solid rgba(255,255,255,0.1)';

  const textLines = React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: '2px', padding: '3px 6px' } },
    React.createElement("div", { style: { height: 2, width: '80%', background: lineColor, borderRadius: 1 } }),
    React.createElement("div", { style: { height: 2, width: '60%', background: lineColor, borderRadius: 1 } }),
    React.createElement("div", { style: { height: 2, width: '40%', background: lineColor, borderRadius: 1, opacity: 0.5 } }),
  );

  let layout;
  if (type === "photo_top") {
    layout = React.createElement("div", { style: { display: 'flex', flexDirection: 'column', height: h, width: w, background: textColor, gap: 0 } },
      React.createElement("div", { style: { flex: 1, background: imgColor } }),
      React.createElement("div", { style: { flex: 0.6, background: textColor, display: 'flex', alignItems: 'center' } }, textLines),
    );
  } else if (type === "photo_bottom") {
    layout = React.createElement("div", { style: { display: 'flex', flexDirection: 'column', height: h, width: w, background: textColor, gap: 0 } },
      React.createElement("div", { style: { flex: 0.6, background: textColor, display: 'flex', alignItems: 'center' } }, textLines),
      React.createElement("div", { style: { flex: 1, background: imgColor } }),
    );
  } else if (type === "gradient_fade") {
    layout = React.createElement("div", { style: { display: 'flex', flexDirection: 'column', height: h, width: w, background: textColor, gap: 0, position: 'relative' } },
      React.createElement("div", { style: { flex: 1, background: imgColor } }),
      React.createElement("div", { style: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.7))' } }),
      React.createElement("div", { style: { position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center' } }, textLines),
    );
  } else if (type === "full_bg") {
    layout = React.createElement("div", { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: h, width: w, background: 'rgba(255,255,255,0.25)', position: 'relative' } },
      React.createElement("div", { style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' } }),
      React.createElement("div", { style: { position: 'relative', width: '100%', padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '1px' } }, textLines),
    );
  } else if (type === "text_box") {
    layout = React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: h, width: w, background: imgColor, position: 'relative' } },
      React.createElement("div", { style: { width: '70%', background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '4px 4px', display: 'flex', flexDirection: 'column', gap: '1px', alignItems: 'center' } }, textLines),
    );
  } else if (type === "none") {
    layout = React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: h, width: w, background: imgColor } });
  }

  return React.createElement("button", {
    onClick,
    style: {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 0, background: 'none', border, borderRadius: T.radiusSm,
      cursor: 'pointer', transition: 'all 0.15s', outline: 'none', padding: 4,
    }
  },
    React.createElement("div", { style: { borderRadius: 4, overflow: 'hidden', border: `1px solid rgba(255,255,255,0.2)` } }, layout),
    React.createElement("span", { style: { fontSize: 10, color: T.textSecondary, fontWeight: 500, textAlign: 'center', maxWidth: 64, lineHeight: 1.2, whiteSpace: 'pre-line' } }, label),
  );
}

/* ── Slider Row ── */
function SliderRow({ label, value, min, max, step, onChange, suffix = '%', defaultValue }) {
  const defVal = defaultValue !== undefined ? defaultValue : (min + max) / 2;
  const displayVal = suffix === '%' && typeof value === 'number' && value <= 1 && max <= 1 ? Math.round(value * 100) : (typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value);
  return React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10 } },
    React.createElement("span", {
      onDoubleClick: () => onChange(defVal),
      style: { fontSize: 12, color: T.textMuted, minWidth: 52, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', borderRadius: 3, padding: '1px 2px', transition: 'background 0.15s' },
      onMouseEnter: (e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)',
      onMouseLeave: (e) => e.currentTarget.style.background = 'transparent',
      title: '\uB354\uBE14\uD074\uB9AD: \uAE30\uBCF8\uAC12 \uBCF5\uC6D0',
    }, label),
    React.createElement("input", { type: "range", min, max, step, value, onChange: (e) => onChange(parseFloat(e.target.value)), style: { flex: 1, accentColor: T.accent } }),
    React.createElement("span", {
      onDoubleClick: () => onChange(defVal),
      style: { fontSize: 11, color: T.textMuted, minWidth: 36, textAlign: 'right', cursor: 'pointer', userSelect: 'none', borderRadius: 3, padding: '1px 2px', transition: 'background 0.15s' },
      onMouseEnter: (e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)',
      onMouseLeave: (e) => e.currentTarget.style.background = 'transparent',
      title: '\uB354\uBE14\uD074\uB9AD: \uAE30\uBCF8\uAC12 \uBCF5\uC6D0',
    }, `${displayVal}${suffix}`)
  );
}

/* ── Text Field Row (checkbox + input + size + color) ── */
function TextFieldRow({ value, onTextChange, placeholder, size, onSizeChange, color, onColorChange, rows, enabled, onToggle, inputId }) {
  const disabled = enabled === false;
  const input = rows
    ? React.createElement("textarea", { id: inputId, value, placeholder, rows, disabled, onChange: (e) => onTextChange(e.target.value), style: { ...inputBase, flex: 1, maxWidth: 360, resize: 'vertical', minHeight: 64, opacity: disabled ? 0.35 : 1 } })
    : React.createElement("input", { id: inputId, type: "text", value, placeholder, disabled, onChange: (e) => onTextChange(e.target.value), style: { ...inputBase, flex: 1, maxWidth: 360, opacity: disabled ? 0.35 : 1 } });

  return React.createElement("div", { style: { display: 'flex', gap: 8, alignItems: rows ? 'start' : 'center' } },
    React.createElement("div", {
      onClick: onToggle,
      style: { width: 20, height: 20, borderRadius: 4, border: `2px solid ${enabled !== false ? T.accent : T.textMuted}`, background: enabled !== false ? T.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s', marginTop: rows ? 8 : 0 },
    }, enabled !== false && React.createElement("span", { style: { color: '#fff', fontSize: 12, lineHeight: 1 } }, "\u2713")),
    input,
    React.createElement("div", { style: { display: 'flex', gap: 6, alignItems: 'center', opacity: disabled ? 0.35 : 1 } },
      React.createElement("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 } },
        React.createElement("span", { style: { fontSize: 9, color: T.textMuted, lineHeight: 1 } }, "크기"),
        React.createElement("input", { type: "number", value: size, disabled, onChange: (e) => onSizeChange(parseInt(e.target.value) || 0), style: { width: 44, padding: '7px 4px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 12, color: T.textMuted, textAlign: 'center', outline: 'none' } }),
      ),
      React.createElement("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 } },
        React.createElement("span", { style: { fontSize: 9, color: T.textMuted, lineHeight: 1 } }, "색상"),
        React.createElement("input", { type: "color", value: color, disabled, onChange: (e) => onColorChange(e.target.value), style: { width: 36, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, cursor: disabled ? 'default' : 'pointer', background: 'transparent' } }),
      ),
    )
  );
}

/* ── Checkbox Row ── */
function CheckboxRow({ label, checked, onChange }) {
  return React.createElement("div", {
    onClick: () => onChange(!checked),
    style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' },
  },
    React.createElement("div", {
      style: { width: 18, height: 18, borderRadius: 4, border: `2px solid ${checked ? T.accent : T.textMuted}`, background: checked ? T.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 },
    }, checked && React.createElement("span", { style: { color: '#fff', fontSize: 11, lineHeight: 1 } }, "\u2713")),
    React.createElement("span", { style: { fontSize: 12, color: checked ? T.textSecondary : T.textMuted } }, label),
  );
}


/* ── VideoPreview (YouTube IFrame loop between start/end, cover-fit with position/scale) ── */


/* ── ZoomedSeekbar: shows region around start ── */
function ZoomedSeekbar({ startSec, endSec, currentTime, duration, overLimit, onSeek, onStartChange, onEndChange, onWarn, clipLen }) {
  const zoomRef = useRef(null);
  const [zDrag, setZDrag] = useState(false);
  const [zDragTime, setZDragTime] = useState(null);
  const [zDragX, setZDragX] = useState(0);
  const [zDragType, setZDragType] = useState(null); // 'seek' | 'start' | 'end'
  const frozenRange = useRef(null); // freeze zoom range during start drag
  const accentC = '#6366f1';
  const dangerC = '#ef4444';

  // Zoom range: freeze during start-marker drag to prevent jumping
  const liveZStart = Math.max(0, startSec - 5);
  const liveZEnd = Math.min(duration, startSec + 35);
  const zStart = frozenRange.current ? frozenRange.current.zStart : liveZStart;
  const zEnd = frozenRange.current ? frozenRange.current.zEnd : liveZEnd;
  const zDur = zEnd - zStart;
  if (zDur <= 0) return null;

  const toZPct = (t) => ((t - zStart) / zDur) * 100;
  const curPct = Math.max(0, Math.min(100, toZPct(currentTime)));
  const sPct = Math.max(0, Math.min(100, toZPct(startSec)));
  const ePct = endSec != null ? Math.max(0, Math.min(100, toZPct(endSec))) : null;

  const calcZPos = (ev) => {
    const rect = zoomRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
    return { time: zStart + pct * zDur, x: ev.clientX - rect.left };
  };

  const startMarkerDrag = (type, e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    frozenRange.current = { zStart, zEnd };
    const snapEndSec = endSec;
    const snapStartSec = startSec;
    const { time, x } = calcZPos(e);
    setZDrag(true); setZDragTime(time); setZDragX(x); setZDragType(type);
    const onMove = (ev) => {
      const r = calcZPos(ev);
      const t = Math.max(0, Math.min(duration, r.time));
      setZDragTime(t); setZDragX(r.x);
      if (type === 'start') {
        if (snapEndSec != null && t >= snapEndSec) return;
        onStartChange(fmtMM(t));
      } else {
        if (t <= snapStartSec) return;
        if (t - snapStartSec > 30) { onEndChange(fmtMM(snapStartSec + 30)); setZDragTime(snapStartSec + 30); if (onWarn) onWarn(); return; }
        onEndChange(fmtMM(t));
      }
    };
    const onUp = () => {
      frozenRange.current = null;
      setZDrag(false); setZDragTime(null); setZDragType(null);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('lostpointercapture', onUp);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('lostpointercapture', onUp);
  };

  const handleZDown = (e) => {
    e.preventDefault();
    const { time, x } = calcZPos(e);
    onSeek(time);
    setZDrag(true); setZDragTime(time); setZDragX(x); setZDragType('seek');
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev) => { const r = calcZPos(ev); onSeek(r.time); setZDragTime(r.time); setZDragX(r.x); };
    const onUp = () => { setZDrag(false); setZDragTime(null); setZDragType(null); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); el.removeEventListener('lostpointercapture', onUp); };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('lostpointercapture', onUp);
  };

  const markerHit = { position: 'absolute', top: -6, width: 36, height: 40, cursor: 'ew-resize', zIndex: 3, touchAction: 'none' };

  return React.createElement("div", { style: { padding: '4px 8px 6px', background: T.surface, borderTop: '1px solid ' + T.border } },
    React.createElement("div", { style: { fontSize: 10, color: T.textMuted, marginBottom: 4, display: 'flex', justifyContent: 'space-between' } },
      React.createElement("span", null, fmtMM(zStart)),
      React.createElement("span", { style: { fontWeight: 500 } }, '\uAD6C\uAC04 \uD0D0\uC0C9', clipLen ? React.createElement("span", { style: { color: overLimit ? dangerC : T.textMuted, fontWeight: overLimit ? 700 : 400 } }, ' \u00B7 ' + Math.round(clipLen) + '\uCD08') : null),
      React.createElement("span", null, fmtMM(zEnd)),
    ),
    React.createElement("div", {
      ref: zoomRef,
      onPointerDown: handleZDown,
      style: { position: 'relative', height: 28, cursor: 'pointer', userSelect: 'none', touchAction: 'none' },
    },
      // Track
      React.createElement("div", { style: { position: 'absolute', top: 12, left: 0, right: 0, height: 4, background: T.border, borderRadius: 2 } }),
      // Range highlight (selected)
      ePct != null && React.createElement("div", { style: { position: 'absolute', top: 12, left: Math.max(0, sPct) + '%', width: Math.max(0, Math.min(100, ePct) - Math.max(0, sPct)) + '%', height: 4, background: overLimit ? dangerC : accentC, borderRadius: 2, opacity: 0.5 } }),
      // Start marker (visible line + handle + wider hit area)
      React.createElement("div", { style: { position: 'absolute', top: 4, left: 'calc(' + sPct + '% - 1.5px)', width: 3, height: 20, background: accentC, borderRadius: 1, pointerEvents: 'none' } }),
      React.createElement("div", { style: { position: 'absolute', top: 9, left: 'calc(' + sPct + '% - 5px)', width: 10, height: 10, borderRadius: '50%', background: accentC, border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', pointerEvents: 'none', zIndex: 4 } }),
      React.createElement("div", { onPointerDown: (e) => startMarkerDrag('start', e), style: { ...markerHit, left: 'calc(' + sPct + '% - 18px)' } }),
      // End marker (visible line + handle + wider hit area)
      ePct != null && React.createElement("div", { style: { position: 'absolute', top: 4, left: 'calc(' + ePct + '% - 1.5px)', width: 3, height: 20, background: overLimit ? dangerC : accentC, borderRadius: 1, pointerEvents: 'none' } }),
      ePct != null && React.createElement("div", { style: { position: 'absolute', top: 9, left: 'calc(' + ePct + '% - 5px)', width: 10, height: 10, borderRadius: '50%', background: overLimit ? dangerC : accentC, border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', pointerEvents: 'none', zIndex: 4 } }),
      ePct != null && React.createElement("div", { onPointerDown: (e) => startMarkerDrag('end', e), style: { ...markerHit, left: 'calc(' + ePct + '% - 18px)' } }),
      // Playhead + time label
      React.createElement("div", { style: { position: 'absolute', top: 8, left: 'calc(' + curPct + '% - 4px)', width: 8, height: 12, background: '#fff', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.4)', pointerEvents: 'none' } }),
      !zDrag && curPct > 0 && curPct < 100 && React.createElement("div", { style: { position: 'absolute', top: 22, left: curPct + '%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 9, fontWeight: 600, padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap', pointerEvents: 'none' } }, fmtMM(currentTime)),
      // Drag tooltip
      zDrag && zDragTime != null && React.createElement("div", { style: { position: 'absolute', top: -16, left: Math.max(16, Math.min(zDragX, (zoomRef.current ? zoomRef.current.offsetWidth - 16 : 200))), transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap', pointerEvents: 'none' } }, (zDragType === 'start' ? '\uC2DC\uC791 ' : zDragType === 'end' ? '\uC885\uB8CC ' : '') + fmtMM(zDragTime)),
    ),
  );
}

/* ── ClipSelector: visual start/end picker ── */
function ClipSelector({ videoUrl, start, end, onStartChange, onEndChange, onClipChange, clipMuted, onClipUnmute, onClipConfirmed }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const seekRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const rafRef = useRef(null);

  const [dragging, setDragging] = useState(false);
  const [dragTime, setDragTime] = useState(null);
  const [dragX, setDragX] = useState(0);
  const [muted, setMuted] = useState(clipMuted !== undefined ? clipMuted : true);
  const [warnToast, setWarnToast] = useState(false);
  const warnTimer = useRef(null);
  const manualSeekOutside = useRef(false);
  const lastStartRef = useRef(null);

  // Sync muted state with external prop
  useEffect(() => { if (clipMuted !== undefined) setMuted(clipMuted); }, [clipMuted]);

  const videoId = videoUrl ? (videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)||[])[1] : null;
  const startSec = parseTime(start);
  const endSec = parseTime(end);
  const clipLen = (startSec != null && endSec != null && endSec > startSec) ? endSec - startSec : null;

  // Keep refs for latest clip range (so tick always reads current values)
  const startSecRef = useRef(startSec);
  const endSecRef = useRef(endSec);
  startSecRef.current = startSec;
  endSecRef.current = endSec;

  // Track latest start for markEnd to reference
  useEffect(() => { if (startSec != null) lastStartRef.current = startSec; }, [startSec]);

  // Load YT API
  useEffect(() => {
    if (window.YT && window.YT.Player) return;
    if (document.getElementById('yt-iframe-api')) return;
    const tag = document.createElement('script');
    tag.id = 'yt-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }, []);

  // Create player
  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    const create = () => {
      if (cancelled) return;
      if (playerRef.current) { try { playerRef.current.destroy(); } catch(e){} playerRef.current = null; }
      const el = containerRef.current;
      if (!el) return;
      const cid = 'cs-' + videoId + '-' + Date.now();
      el.id = cid;
      playerRef.current = new window.YT.Player(cid, {
        width: '100%', height: 200,
        videoId: videoId,
        playerVars: { autoplay: 0, mute: 1, controls: 0, modestbranding: 1, rel: 0, showinfo: 0, fs: 0, playsinline: 1, disablekb: 1, iv_load_policy: 3 },
        events: {
          onReady: (e) => {
            if (cancelled) return;
            setReady(true);
            setDuration(e.target.getDuration() || 0);
            // If start is set, seek there
            const ss = parseTime(start);
            if (ss != null) e.target.seekTo(ss, true);
          },
          onStateChange: (e) => {
            setPlaying(e.data === window.YT.PlayerState.PLAYING);
          },
        },
      });
    };
    const initDelay = setTimeout(() => {
      if (cancelled) return;
      if (window.YT && window.YT.Player) { create(); }
      else {
        const poll = setInterval(() => {
          if (cancelled) { clearInterval(poll); return; }
          if (window.YT && window.YT.Player) { clearInterval(poll); create(); }
        }, 200);
      }
    }, 80);
    return () => { cancelled = true; clearTimeout(initDelay); if (playerRef.current) { try { playerRef.current.destroy(); } catch(e){} playerRef.current = null; } };
  }, [videoId]);

  // Poll current time + auto-loop within clip range (uses refs for always-current values)
  useEffect(() => {
    const tick = () => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const t = playerRef.current.getCurrentTime();
        setCurrent(t);
        const ss = startSecRef.current, es = endSecRef.current;
        if (!manualSeekOutside.current && ss != null && es != null && es > ss && t >= es - 0.15) {
          playerRef.current.seekTo(ss, true);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (playing) { playerRef.current.pauseVideo(); }
    else {
      // If clip range exists and playhead is outside range, seek to start
      if (startSec != null && endSec != null && endSec > startSec) {
        const t = playerRef.current.getCurrentTime();
        if (t < startSec || t >= endSec) {
          playerRef.current.seekTo(startSec, true);
          manualSeekOutside.current = false;
        }
      }
      playerRef.current.playVideo();
    }
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    if (muted) {
      playerRef.current.unMute(); playerRef.current.setVolume(50); setMuted(false);
      if (onClipUnmute) onClipUnmute(); // 카드리스트 미리보기 음소거 처리
    }
    else { playerRef.current.mute(); setMuted(true); }
  };

  const showWarn = () => {
    setWarnToast(true);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    warnTimer.current = setTimeout(() => setWarnToast(false), 4000);
  };

  const seekTo = (sec) => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(sec, true);
    setCurrent(sec);
    // Mark if seeking outside clip range (prevents auto-loop from pulling back)
    const ss = startSecRef.current, es = endSecRef.current;
    const inRange = ss != null && es != null && sec >= ss && sec <= es;
    manualSeekOutside.current = !inRange;
  };

  const calcSeekTime = (e) => {
    const rect = seekRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
    return { time: pct * duration, x: cx - rect.left };
  };

  const handleSeekDown = (e) => {
    e.preventDefault();
    const { time, x } = calcSeekTime(e);
    // Track if user seeks outside the clip range
    const inRange = startSec != null && endSec != null && time >= startSec && time <= endSec;
    manualSeekOutside.current = !inRange;
    seekTo(time);
    setDragging(true);
    setDragTime(time);
    setDragX(x);
    const onMove = (ev) => {
      if (ev.cancelable) ev.preventDefault();
      const { time: t, x: mx } = calcSeekTime(ev);
      const inR = startSec != null && endSec != null && t >= startSec && t <= endSec;
      manualSeekOutside.current = !inR;
      seekTo(t);
      setDragTime(t);
      setDragX(mx);
    };
    const onUp = () => {
      setDragging(false);
      setDragTime(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  const startSeekMarkerDrag = (type, e) => {
    e.preventDefault();
    e.stopPropagation();
    const snapEndSec = endSec;
    const snapStartSec = startSec;
    const { time, x } = calcSeekTime(e);
    setDragging(true); setDragTime(time); setDragX(x);
    const onMove = (ev) => {
      if (ev.cancelable) ev.preventDefault();
      const r = calcSeekTime(ev);
      const t = Math.max(0, Math.min(duration, r.time));
      setDragTime(t); setDragX(r.x);
      if (type === 'start') {
        if (snapEndSec != null && t >= snapEndSec) return;
        onStartChange(fmtMM(t));
      } else {
        if (t <= snapStartSec) return;
        if (t - snapStartSec > 30) { onEndChange(fmtMM(snapStartSec + 30)); setDragTime(snapStartSec + 30); showWarn(); return; }
        onEndChange(fmtMM(t));
      }
    };
    const onUp = () => {
      setDragging(false); setDragTime(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  const markStart = () => {
    const t = (playerRef.current && playerRef.current.getCurrentTime) ? playerRef.current.getCurrentTime() : currentTime;
    const es = parseTime(end);
    const newStart = t;
    let newEnd;
    if (es == null || es <= t) {
      newEnd = Math.min(t + 10, duration || t + 10);
    } else if (es - t > 30) {
      newEnd = t + 30;
      showWarn();
    } else {
      newEnd = es;
    }
    startSecRef.current = newStart;
    endSecRef.current = newEnd;
    lastStartRef.current = newStart;
    manualSeekOutside.current = false;
    if (playerRef.current) playerRef.current.seekTo(newStart, true);
    setCurrent(newStart);
    // Update parent state atomically to avoid React batching issue
    if (onClipChange) {
      onClipChange(fmtMM(newStart), fmtMM(newEnd));
    } else {
      onStartChange(fmtMM(newStart));
      if (newEnd !== es) onEndChange(fmtMM(newEnd));
    }
    if (onClipConfirmed) onClipConfirmed();
  };

  const markEnd = () => {
    const t = (playerRef.current && playerRef.current.getCurrentTime) ? playerRef.current.getCurrentTime() : currentTime;
    const ss = lastStartRef.current != null ? lastStartRef.current : parseTime(start);
    const prevClipLen = (startSec != null && endSec != null && endSec > startSec) ? Math.min(endSec - startSec, 30) : 10;

    let newStart = ss;
    let newEnd;
    if (ss == null || t < ss) {
      newStart = Math.max(0, t - prevClipLen);
      newEnd = t;
    } else if (t - ss > 30) {
      newEnd = ss + 30;
      showWarn();
    } else {
      newEnd = t;
    }
    startSecRef.current = newStart;
    endSecRef.current = newEnd;
    lastStartRef.current = newStart;
    manualSeekOutside.current = false;
    // Update parent state atomically
    if (onClipChange) {
      onClipChange(fmtMM(newStart), fmtMM(newEnd));
    } else {
      if (newStart !== ss) onStartChange(fmtMM(newStart));
      onEndChange(fmtMM(newEnd));
    }
    if (onClipConfirmed) onClipConfirmed();
  };

  const MAX_CLIP = 30;
  const overLimit = clipLen != null && clipLen > MAX_CLIP;

  if (!videoId) return null;

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const startPct = (startSec != null && duration > 0) ? (startSec / duration) * 100 : null;
  const endPct = (endSec != null && duration > 0) ? (endSec / duration) * 100 : null;
  const accentC = '#6366f1';
  const dangerC = '#ef4444';

  return React.createElement("div", { style: { borderRadius: 8, overflow: 'visible', border: '1px solid ' + T.border, background: '#000', minWidth: 0, position: 'relative' } },
    // Player area
    React.createElement("div", { style: { position: 'relative', width: '100%', height: 200, background: '#000' } },
      React.createElement("div", { ref: containerRef, style: { width: '100%', height: '100%' } }),
      // Play/pause overlay
      React.createElement("div", {
        onClick: togglePlay,
        style: { position: 'absolute', inset: 0, zIndex: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      },
        !playing && ready && React.createElement("div", { style: { width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
          React.createElement("span", { style: { color: '#fff', fontSize: 18, marginLeft: 3 } }, "\u25B6")
        )
      ),
      // Current time badge
      ready && React.createElement("div", { style: { position: 'absolute', bottom: 6, right: 8, zIndex: 3, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 4 } }, fmtMM(currentTime) + ' / ' + fmtMM(duration)),
    ),
    // Seekbar
    React.createElement("div", {
      ref: seekRef,
      onMouseDown: handleSeekDown,
      onTouchStart: handleSeekDown,
      style: { position: 'relative', height: 28, background: T.surface, cursor: 'pointer', userSelect: 'none', touchAction: 'none', marginTop: 14, overflow: 'visible' },
    },
      // Track bg
      React.createElement("div", { style: { position: 'absolute', top: 12, left: 0, right: 0, height: 4, background: T.border, borderRadius: 2 } }),
      // Selected range highlight
      startPct != null && endPct != null && React.createElement("div", { style: { position: 'absolute', top: 12, left: startPct + '%', width: Math.max(0, endPct - startPct) + '%', height: 4, background: overLimit ? dangerC : accentC, borderRadius: 2, opacity: 0.5 } }),
      // Start marker (visible line + label + hit area)
      startPct != null && React.createElement("div", { style: { position: 'absolute', top: 0, left: 'calc(' + startPct + '% - 1px)', pointerEvents: 'none' } },
        React.createElement("div", { style: { width: 3, height: 28, background: accentC, borderRadius: 1 } }),
        React.createElement("div", { style: { position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: accentC, color: '#fff', fontSize: 9, fontWeight: 600, padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap' } }, '\uC2DC\uC791 ' + fmtMM(startSec))
      ),
      startPct != null && React.createElement("div", { onMouseDown: (e) => startSeekMarkerDrag('start', e), onTouchStart: (e) => startSeekMarkerDrag('start', e), style: { position: 'absolute', top: 0, width: 24, height: 28, left: 'calc(' + startPct + '% - 12px)', cursor: 'ew-resize', zIndex: 3, touchAction: 'none' } }),
      // End marker (visible line + label + hit area)
      endPct != null && React.createElement("div", { style: { position: 'absolute', top: 0, left: 'calc(' + endPct + '% - 1px)', pointerEvents: 'none' } },
        React.createElement("div", { style: { width: 3, height: 28, background: overLimit ? dangerC : accentC, borderRadius: 1 } }),
        React.createElement("div", { style: { position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: overLimit ? dangerC : accentC, color: '#fff', fontSize: 9, fontWeight: 600, padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap' } }, '\uC885\uB8CC ' + fmtMM(endSec))
      ),
      endPct != null && React.createElement("div", { onMouseDown: (e) => startSeekMarkerDrag('end', e), onTouchStart: (e) => startSeekMarkerDrag('end', e), style: { position: 'absolute', top: 0, width: 24, height: 28, left: 'calc(' + endPct + '% - 12px)', cursor: 'ew-resize', zIndex: 3, touchAction: 'none' } }),
      // Playhead + time label
      React.createElement("div", { style: { position: 'absolute', top: 8, left: 'calc(' + pct + '% - 5px)', width: 10, height: 12, background: '#fff', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.4)', transition: (dragging || playing) ? 'none' : 'left 0.05s linear', pointerEvents: 'none' } }),
      !dragging && playing && React.createElement("div", { style: { position: 'absolute', top: 24, left: pct + '%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 9, fontWeight: 600, padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap', pointerEvents: 'none' } }, fmtMM(currentTime)),
      // Drag tooltip
      dragging && dragTime != null && React.createElement("div", { style: { position: 'absolute', bottom: 24, left: Math.max(16, Math.min(dragX, (seekRef.current ? seekRef.current.offsetWidth - 16 : 300))) , transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', pointerEvents: 'none' } }, fmtMM(dragTime)),
    ),
    // Controls row: play + start/end capture+input
    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 8px', background: T.surface, borderTop: '1px solid ' + T.border } },
      React.createElement("button", {
        onClick: togglePlay,
        style: { width: 28, height: 28, borderRadius: '50%', border: '1px solid ' + T.borderHover, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
      }, playing ? '\u23F8' : '\u25B6'),
      React.createElement("button", {
        onClick: toggleMute,
        style: { width: 28, height: 28, borderRadius: '50%', border: '1px solid ' + T.borderHover, background: muted ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.15)', color: muted ? T.textMuted : '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
      }, muted ? '\uD83D\uDD07' : '\uD83D\uDD0A'),
      // Start: capture btn + input
      React.createElement("div", { style: { flex: 1, display: 'flex', alignItems: 'center', gap: 3 } },
        React.createElement("button", {
          onClick: markStart, title: '\uD604\uC7AC \uC2DC\uC810\uC744 \uC2DC\uC791\uC73C\uB85C',
          style: { padding: '4px 6px', borderRadius: 4, border: '1px solid ' + accentC, background: startSec != null ? accentC : 'transparent', color: startSec != null ? '#fff' : accentC, fontSize: 10, fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' },
        }, '\u25C9 \uC2DC\uC791'),
        React.createElement("input", {
          type: 'text', value: start || '', placeholder: '0:00',
          onChange: (e) => {
            onStartChange(e.target.value);
            var es = parseTime(end);
            var ss = parseTime(e.target.value);
            if (es != null && ss != null && es <= ss) onEndChange('');
          },
          style: { width: 48, padding: '3px 5px', background: T.surface, border: '1px solid ' + T.border, borderRadius: 4, fontSize: 11, color: T.text, textAlign: 'center', outline: 'none' },
        }),
      ),
      // End: capture btn + input
      React.createElement("div", { style: { flex: 1, display: 'flex', alignItems: 'center', gap: 3 } },
        React.createElement("button", {
          onClick: markEnd, title: '\uD604\uC7AC \uC2DC\uC810\uC744 \uC885\uB8CC\uB85C',
          style: { padding: '4px 6px', borderRadius: 4, border: '1px solid ' + accentC, background: endSec != null ? accentC : 'transparent', color: endSec != null ? '#fff' : accentC, fontSize: 10, fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' },
        }, '\u25C9 \uC885\uB8CC'),
        React.createElement("input", {
          type: 'text', value: end || '', placeholder: '0:00',
          onChange: (e) => {
            var ss = parseTime(start);
            var es = parseTime(e.target.value);
            if (ss != null && es != null && es - ss > 30) { onEndChange(fmtMM(ss + 30)); }
            else { onEndChange(e.target.value); }
          },
          style: { width: 48, padding: '3px 5px', background: T.surface, border: '1px solid ' + T.border, borderRadius: 4, fontSize: 11, color: T.text, textAlign: 'center', outline: 'none' },
        }),
      ),
    ),
    // Zoomed region seekbar (shows +-30s around start point)
    startSec != null && duration > 0 && React.createElement(ZoomedSeekbar, { startSec: startSec, endSec: endSec, currentTime: currentTime, duration: duration, overLimit: overLimit, onSeek: seekTo, onStartChange: onStartChange, onEndChange: onEndChange, onWarn: showWarn, clipLen: clipLen }),
    // Warning toast (prominent for mobile)
    warnToast && React.createElement("div", { style: { padding: '10px 14px', margin: '6px 8px', background: 'rgba(239,68,68,0.15)', border: '1.5px solid rgba(239,68,68,0.4)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#ef4444', textAlign: 'center', animation: 'clipWarnShake 0.4s ease-in-out' } },
      '\u26A0\uFE0F \uD074\uB9BD\uC740 \uCD5C\uB300 30\uCD08\uAE4C\uC9C0 \uC120\uD0DD\uD560 \uC218 \uC788\uC5B4\uC694'
    ),
  );
}

/* ── MobileClipSelector: compact clip picker for mobile ── */
function MobileClipSelector({ videoUrl, start, end, onStartChange, onEndChange, onClipChange, onExpandChange }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const seekRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const rafRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [warnToast, setWarnToast] = useState(false);
  const warnTimer = useRef(null);
  const manualSeekOutside = useRef(false);
  const lastStartRef = useRef(null);
  const [collapsed, setCollapsed] = useState(true);
  const [hidden, setHidden] = useState(false);
  const setCollapsedAndNotify = (v) => { setCollapsed(v); if (onExpandChange) onExpandChange(!v); };

  const videoId = videoUrl ? (videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)||[])[1] : null;
  const startSec = parseTime(start);
  const endSec = parseTime(end);
  const clipLen = (startSec != null && endSec != null && endSec > startSec) ? endSec - startSec : null;
  const MAX_CLIP = 30;
  const overLimit = clipLen != null && clipLen > MAX_CLIP;
  const accentC = '#6366f1';
  const dangerC = '#ef4444';

  const startSecRef = useRef(startSec);
  const endSecRef = useRef(endSec);
  startSecRef.current = startSec;
  endSecRef.current = endSec;
  useEffect(() => { if (startSec != null) lastStartRef.current = startSec; }, [startSec]);

  // Load YT API
  useEffect(() => {
    if (window.YT && window.YT.Player) return;
    if (document.getElementById('yt-iframe-api')) return;
    const tag = document.createElement('script');
    tag.id = 'yt-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }, []);

  // Create player
  useEffect(() => {
    if (!videoId || collapsed) return;
    let cancelled = false;
    const create = () => {
      if (cancelled) return;
      if (playerRef.current) { try { playerRef.current.destroy(); } catch(e){} playerRef.current = null; }
      const el = containerRef.current;
      if (!el) return;
      const cid = 'mcs-' + videoId + '-' + Date.now();
      el.id = cid;
      playerRef.current = new window.YT.Player(cid, {
        width: '100%', height: 160,
        videoId: videoId,
        playerVars: { autoplay: 0, mute: 1, controls: 0, modestbranding: 1, rel: 0, showinfo: 0, fs: 0, playsinline: 1, disablekb: 1, iv_load_policy: 3 },
        events: {
          onReady: (e) => {
            if (cancelled) return;
            setReady(true);
            setDuration(e.target.getDuration() || 0);
            const ss = parseTime(start);
            if (ss != null) e.target.seekTo(ss, true);
          },
          onStateChange: (e) => { setPlaying(e.data === window.YT.PlayerState.PLAYING); },
        },
      });
    };
    const initDelay = setTimeout(() => {
      if (cancelled) return;
      if (window.YT && window.YT.Player) { create(); }
      else {
        const poll = setInterval(() => {
          if (cancelled) { clearInterval(poll); return; }
          if (window.YT && window.YT.Player) { clearInterval(poll); create(); }
        }, 200);
      }
    }, 80);
    return () => { cancelled = true; clearTimeout(initDelay); if (playerRef.current) { try { playerRef.current.destroy(); } catch(e){} playerRef.current = null; setReady(false); setPlaying(false); } };
  }, [videoId, collapsed]);

  // Poll current time + auto-loop
  useEffect(() => {
    if (collapsed) return;
    const tick = () => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const t = playerRef.current.getCurrentTime();
        setCurrent(t);
        const ss = startSecRef.current, es = endSecRef.current;
        if (!manualSeekOutside.current && ss != null && es != null && es > ss && t >= es - 0.15) {
          playerRef.current.seekTo(ss, true);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [collapsed]);

  const showWarn = () => {
    setWarnToast(true);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    warnTimer.current = setTimeout(() => setWarnToast(false), 4000);
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (playing) { playerRef.current.pauseVideo(); }
    else {
      if (startSec != null && endSec != null && endSec > startSec) {
        const t = playerRef.current.getCurrentTime();
        if (t < startSec || t >= endSec) { playerRef.current.seekTo(startSec, true); manualSeekOutside.current = false; }
      }
      playerRef.current.playVideo();
    }
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    if (muted) { playerRef.current.unMute(); playerRef.current.setVolume(50); setMuted(false); }
    else { playerRef.current.mute(); setMuted(true); }
  };

  const seekTo = (sec) => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(sec, true);
    setCurrent(sec);
    const ss = startSecRef.current, es = endSecRef.current;
    const inRange = ss != null && es != null && sec >= ss && sec <= es;
    manualSeekOutside.current = !inRange;
  };

  // Touch-friendly seekbar handlers
  const calcSeekTime = (clientX) => {
    const rect = seekRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return { time: pct * duration, x: clientX - rect.left };
  };

  const handleSeekDown = (e) => {
    e.preventDefault();
    const isTouch = e.type === 'touchstart';
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const { time } = calcSeekTime(clientX);
    const inRange = startSec != null && endSec != null && time >= startSec && time <= endSec;
    manualSeekOutside.current = !inRange;
    seekTo(time);
    const onMove = (ev) => {
      const cx = ev.type === 'touchmove' ? ev.touches[0].clientX : ev.clientX;
      const { time: t } = calcSeekTime(cx);
      const inR = startSec != null && endSec != null && t >= startSec && t <= endSec;
      manualSeekOutside.current = !inR;
      seekTo(t);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  const startSeekMarkerDrag = (type, e) => {
    e.preventDefault();
    e.stopPropagation();
    const snapEndSec = endSec;
    const snapStartSec = startSec;
    const isTouch = e.type === 'touchstart';
    const cx = isTouch ? e.touches[0].clientX : e.clientX;
    const { time } = calcSeekTime(cx);
    const onMove = (ev) => {
      if (ev.cancelable) ev.preventDefault();
      const mcx = ev.type === 'touchmove' ? ev.touches[0].clientX : ev.clientX;
      const r = calcSeekTime(mcx);
      const t = Math.max(0, Math.min(duration, r.time));
      if (type === 'start') {
        if (snapEndSec != null && t >= snapEndSec) return;
        onStartChange(fmtMM(t));
      } else {
        if (t <= snapStartSec) return;
        if (t - snapStartSec > 30) { onEndChange(fmtMM(snapStartSec + 30)); showWarn(); return; }
        onEndChange(fmtMM(t));
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  const markStart = () => {
    const t = (playerRef.current && playerRef.current.getCurrentTime) ? playerRef.current.getCurrentTime() : currentTime;
    const es = parseTime(end);
    let newStart = t, newEnd;
    if (es == null || es <= t) { newEnd = Math.min(t + 10, duration || t + 10); }
    else if (es - t > 30) { newEnd = t + 30; showWarn(); }
    else { newEnd = es; }
    startSecRef.current = newStart; endSecRef.current = newEnd; lastStartRef.current = newStart;
    manualSeekOutside.current = false;
    if (playerRef.current) playerRef.current.seekTo(newStart, true);
    setCurrent(newStart);
    if (onClipChange) onClipChange(fmtMM(newStart), fmtMM(newEnd));
    else { onStartChange(fmtMM(newStart)); if (newEnd !== es) onEndChange(fmtMM(newEnd)); }
  };

  const markEnd = () => {
    const t = (playerRef.current && playerRef.current.getCurrentTime) ? playerRef.current.getCurrentTime() : currentTime;
    const ss = lastStartRef.current != null ? lastStartRef.current : parseTime(start);
    const prevClipLen = (startSec != null && endSec != null && endSec > startSec) ? Math.min(endSec - startSec, 30) : 10;
    let newStart = ss, newEnd;
    if (ss == null || t < ss) { newStart = Math.max(0, t - prevClipLen); newEnd = t; }
    else if (t - ss > 30) { newEnd = ss + 30; showWarn(); }
    else { newEnd = t; }
    startSecRef.current = newStart; endSecRef.current = newEnd; lastStartRef.current = newStart;
    manualSeekOutside.current = false;
    if (onClipChange) onClipChange(fmtMM(newStart), fmtMM(newEnd));
    else { if (newStart !== ss) onStartChange(fmtMM(newStart)); onEndChange(fmtMM(newEnd)); }
  };

  if (!videoId) return null;

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const startPct = (startSec != null && duration > 0) ? (startSec / duration) * 100 : null;
  const endPct = (endSec != null && duration > 0) ? (endSec / duration) * 100 : null;

  // Collapsed: just a toggle button
  if (hidden) return React.createElement("div", { style: { marginBottom: 8, display: 'flex', justifyContent: 'flex-end' } },
    React.createElement("button", {
      onClick: () => setHidden(false),
      style: { padding: '6px 12px', borderRadius: 6, border: '1px solid ' + T.border, background: T.surface, color: T.textMuted, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 },
    }, '\u25B6 \uD504\uB9AC\uBDF0'),
  );

  if (collapsed) return React.createElement("div", { style: { marginBottom: 8, display: 'flex', gap: 6 } },
    React.createElement("button", {
      onClick: () => setCollapsedAndNotify(false),
      style: { flex: 1, padding: '10px 14px', borderRadius: 8, border: '1.5px solid ' + accentC, background: 'rgba(99,102,241,0.08)', color: accentC, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
    }, '\uD83C\uDFAC \uAD6C\uAC04 \uD0D0\uC0C9\uAE30 \uC5F4\uAE30'),
    React.createElement("button", {
      onClick: () => setHidden(true),
      title: '\uD504\uB9AC\uBDF0 \uC228\uAE30\uAE30',
      style: { padding: '10px 12px', borderRadius: 8, border: '1px solid ' + T.border, background: T.surface, color: T.textMuted, fontSize: 13, cursor: 'pointer', flexShrink: 0 },
    }, '\u2212'),
  );

  return React.createElement("div", { style: { borderRadius: 8, overflow: 'hidden', border: '1px solid ' + T.border, background: '#000', marginBottom: 8 } },
    // Mini player
    React.createElement("div", { style: { position: 'relative', width: '100%', height: 160, background: '#000' } },
      React.createElement("div", { ref: containerRef, style: { width: '100%', height: '100%' } }),
      // Play overlay
      React.createElement("div", { onClick: togglePlay, style: { position: 'absolute', inset: 0, zIndex: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
        !playing && ready && React.createElement("div", { style: { width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
          React.createElement("span", { style: { color: '#fff', fontSize: 20, marginLeft: 3 } }, '\u25B6')
        )
      ),
      // Time badge
      ready && React.createElement("div", { style: { position: 'absolute', bottom: 6, right: 8, zIndex: 3, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 4 } }, fmtMM(currentTime) + ' / ' + fmtMM(duration)),
      // Collapse + Hide buttons
      React.createElement("div", { style: { position: 'absolute', top: 6, right: 8, zIndex: 3, display: 'flex', gap: 4 } },
        React.createElement("button", { onClick: () => { if (playerRef.current) { try { playerRef.current.pauseVideo(); } catch(e){} } setCollapsedAndNotify(true); setHidden(true); }, style: { background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer' } }, '\u2212 \uC228\uAE30\uAE30'),
        React.createElement("button", { onClick: () => { if (playerRef.current) { try { playerRef.current.pauseVideo(); } catch(e){} } setCollapsedAndNotify(true); }, style: { background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer' } }, '\u2715 \uB2EB\uAE30'),
      ),
    ),
    // Seekbar (touch-friendly, 44px hit area)
    React.createElement("div", {
      ref: seekRef,
      onMouseDown: handleSeekDown, onTouchStart: handleSeekDown,
      style: { position: 'relative', height: 44, background: T.surface, cursor: 'pointer', userSelect: 'none', touchAction: 'none' },
    },
      // Track bg
      React.createElement("div", { style: { position: 'absolute', top: 20, left: 0, right: 0, height: 4, background: T.border, borderRadius: 2 } }),
      // Selected range
      startPct != null && endPct != null && React.createElement("div", { style: { position: 'absolute', top: 20, left: startPct + '%', width: Math.max(0, endPct - startPct) + '%', height: 4, background: overLimit ? dangerC : accentC, borderRadius: 2, opacity: 0.6 } }),
      // Start marker (visible line + hit area)
      startPct != null && React.createElement("div", { style: { position: 'absolute', top: 10, left: 'calc(' + startPct + '% - 1px)', width: 3, height: 24, background: accentC, borderRadius: 1, pointerEvents: 'none' } }),
      startPct != null && React.createElement("div", { onMouseDown: (e) => startSeekMarkerDrag('start', e), onTouchStart: (e) => startSeekMarkerDrag('start', e), style: { position: 'absolute', top: 0, width: 24, height: 44, left: 'calc(' + startPct + '% - 12px)', cursor: 'ew-resize', zIndex: 3, touchAction: 'none' } }),
      // End marker (visible line + hit area)
      endPct != null && React.createElement("div", { style: { position: 'absolute', top: 10, left: 'calc(' + endPct + '% - 1px)', width: 3, height: 24, background: overLimit ? dangerC : accentC, borderRadius: 1, pointerEvents: 'none' } }),
      endPct != null && React.createElement("div", { onMouseDown: (e) => startSeekMarkerDrag('end', e), onTouchStart: (e) => startSeekMarkerDrag('end', e), style: { position: 'absolute', top: 0, width: 24, height: 44, left: 'calc(' + endPct + '% - 12px)', cursor: 'ew-resize', zIndex: 3, touchAction: 'none' } }),
      // Playhead
      React.createElement("div", { style: { position: 'absolute', top: 14, left: 'calc(' + pct + '% - 6px)', width: 12, height: 16, background: '#fff', borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.5)', transition: playing ? 'none' : 'left 0.05s linear', pointerEvents: 'none' } }),
    ),
    // Controls row
    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 5, padding: '8px 10px', background: T.surface, borderTop: '1px solid ' + T.border } },
      // Play/Pause
      React.createElement("button", { onClick: togglePlay, style: { width: 34, height: 34, borderRadius: '50%', border: '1px solid ' + T.borderHover, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, playing ? '\u23F8' : '\u25B6'),
      // Mute
      React.createElement("button", { onClick: toggleMute, style: { width: 34, height: 34, borderRadius: '50%', border: '1px solid ' + T.borderHover, background: muted ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.15)', color: muted ? T.textMuted : '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, muted ? '\uD83D\uDD07' : '\uD83D\uDD0A'),
      // Spacer
      React.createElement("div", { style: { flex: 1 } }),
      // Start: capture btn + input
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 3 } },
        React.createElement("button", { onClick: markStart, style: { padding: '5px 8px', borderRadius: 6, border: '1.5px solid ' + accentC, background: startSec != null ? accentC : 'transparent', color: startSec != null ? '#fff' : accentC, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 } }, '\u25C9 \uC2DC\uC791'),
        React.createElement("input", { type: 'text', value: start || '', placeholder: '0:00', onChange: (e) => { onStartChange(e.target.value); var es = parseTime(end); var ss = parseTime(e.target.value); if (es != null && ss != null && es <= ss) onEndChange(''); }, style: { width: 44, padding: '4px 4px', background: T.surface, border: '1px solid ' + T.border, borderRadius: 4, fontSize: 11, color: T.text, textAlign: 'center', outline: 'none' } }),
      ),
      // End: capture btn + input
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 3 } },
        React.createElement("button", { onClick: markEnd, style: { padding: '5px 8px', borderRadius: 6, border: '1.5px solid ' + accentC, background: endSec != null ? accentC : 'transparent', color: endSec != null ? '#fff' : accentC, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 } }, '\u25C9 \uC885\uB8CC'),
        React.createElement("input", { type: 'text', value: end || '', placeholder: '0:00', onChange: (e) => { var ss = parseTime(start); var es = parseTime(e.target.value); if (ss != null && es != null && es - ss > 30) { onEndChange(fmtMM(ss + 30)); showWarn(); } else { onEndChange(e.target.value); } }, style: { width: 44, padding: '4px 4px', background: T.surface, border: '1px solid ' + T.border, borderRadius: 4, fontSize: 11, color: T.text, textAlign: 'center', outline: 'none' } }),
      ),
    ),
    // Zoomed seekbar for precision
    startSec != null && duration > 0 && React.createElement(ZoomedSeekbar, { startSec: startSec, endSec: endSec, currentTime: currentTime, duration: duration, overLimit: overLimit, onSeek: seekTo, onStartChange: onStartChange, onEndChange: onEndChange, onWarn: showWarn, clipLen: clipLen }),
    // Warning toast
    warnToast && React.createElement("div", { style: { padding: '10px 14px', margin: '6px 8px', background: 'rgba(239,68,68,0.15)', border: '1.5px solid rgba(239,68,68,0.4)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: dangerC, textAlign: 'center', animation: 'clipWarnShake 0.4s ease-in-out' } },
      '\u26A0\uFE0F \uD074\uB9BD\uC740 \uCD5C\uB300 30\uCD08\uAE4C\uC9C0 \uC120\uD0DD\uD560 \uC218 \uC788\uC5B4\uC694'
    ),
  );
}

function VideoPreview({ videoId, start, end, width, height, videoX, videoY, videoScale, videoBrightness, muted: mutedProp, volume: volumeProp = 80 }) {
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const timerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const mountId = useRef(Date.now());

  const startSec = parseTime(start) ?? 0;
  const endSec = parseTime(end);
  const hasRange = endSec != null && endSec > startSec;

  // Sync mute state with prop
  useEffect(() => {
    if (playerRef.current && playerRef.current.isMuted) {
      if (mutedProp === false) { playerRef.current.unMute(); playerRef.current.setVolume(volumeProp || 80); }
      else { playerRef.current.mute(); playerRef.current.setVolume(0); }
    }
  }, [mutedProp]);

  // Sync volume with prop
  useEffect(() => {
    if (playerRef.current && playerRef.current.setVolume && !mutedProp) {
      playerRef.current.setVolume(volumeProp || 80);
    }
  }, [volumeProp]);

  // High-res iframe (YouTube serves better quality at larger sizes)
  const iW = 1920;
  const iH = 1080;
  // Scale to cover the container
  const coverScale = Math.max(width / iW, height / iH);

  // Load YouTube IFrame API once
  useEffect(() => {
    if (window.YT && window.YT.Player) return;
    if (document.getElementById('yt-iframe-api')) return;
    const tag = document.createElement('script');
    tag.id = 'yt-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }, []);

  // Create player – use a small delay to ensure DOM is ready after mount
  useEffect(() => {
    if (!videoId || !hasRange) return;
    let cancelled = false;

    const createPlayer = () => {
      if (cancelled) return;
      if (playerRef.current) { try { playerRef.current.destroy(); } catch(e){} playerRef.current = null; }
      const containerId = 'yt-pv-' + mountId.current + '-' + videoId + '-' + startSec;
      const el = iframeRef.current;
      if (!el) return;
      el.id = containerId;

      playerRef.current = new window.YT.Player(containerId, {
        width: iW, height: iH,
        videoId: videoId,
        playerVars: {
          start: Math.floor(startSec), end: endSec ? Math.ceil(endSec) : undefined,
          autoplay: 1, mute: 1, controls: 0, loop: 0,
          modestbranding: 1, rel: 0, showinfo: 0, fs: 0,
          playsinline: 1, disablekb: 1, iv_load_policy: 3,
        },
        events: {
          onReady: (e) => { if (!cancelled) { if (mutedProp === false) { e.target.unMute(); e.target.setVolume(volumeProp || 80); } else { e.target.mute(); e.target.setVolume(0); } e.target.playVideo(); setReady(true); } },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED || e.data === window.YT.PlayerState.PAUSED) {
              e.target.seekTo(Math.floor(startSec), true);
              e.target.playVideo();
            }
          },
        },
      });
    };

    // Small delay to ensure iframeRef is attached to DOM
    const initDelay = setTimeout(() => {
      if (cancelled) return;
      if (window.YT && window.YT.Player) {
        createPlayer();
      } else {
        const poll = setInterval(() => {
          if (cancelled) { clearInterval(poll); return; }
          if (window.YT && window.YT.Player) { clearInterval(poll); createPlayer(); }
        }, 200);
        timerRef._poll = poll;
      }
    }, 50);

    timerRef.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const cur = playerRef.current.getCurrentTime();
        if (endSec && cur >= endSec - 0.3) {
          playerRef.current.seekTo(Math.floor(startSec), true);
          playerRef.current.playVideo();
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(initDelay);
      if (timerRef._poll) clearInterval(timerRef._poll);
      if (timerRef.current) clearInterval(timerRef.current);
      if (playerRef.current) { try { playerRef.current.destroy(); } catch(e){} playerRef.current = null; }
    };
  }, [videoId, startSec, endSec, hasRange]);

  if (!videoId || !hasRange) return null;

  const vsc = (videoScale || 110) / 100;

  return React.createElement("div", {
    style: { position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', background: '#000', opacity: ready ? 1 : 0, transition: 'opacity 0.5s', filter: videoBrightness ? 'brightness(' + (1 + (videoBrightness || 0) / 100) + ')' : undefined },
  },
    // Iframe: centered & scaled to cover, respecting user's position/scale
    React.createElement("div", {
      style: {
        position: 'absolute', top: '50%', left: '50%', width: iW, height: iH,
        transform: 'translate(-50%, -50%) scale(' + (coverScale * vsc) + ')',
        transformOrigin: (videoX ?? 50) + '% ' + (videoY ?? 50) + '%',
      },
    },
      React.createElement("div", { ref: iframeRef, style: { width: '100%', height: '100%' } })
    ),
    // Transparent overlay to block all YouTube UI interactions
    React.createElement("div", { style: { position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'auto', cursor: 'default' } })
  );
}

/* ── CardPreview ── */
function CardPreview({ card, globalUrl, aspectRatio = '1:1', globalBgImage, previewWidth, videoPreviewOn, previewMuted, previewVolume, onTextClick, onCardUpdate, selectedHandle, onSelectHandle }) {
  const previewW = previewWidth || 320;
  const previewH = aspectRatio === '3:4' ? Math.round(previewW * 4 / 3) : previewW;
  const pRatio = (card.photoRatio ?? 50) / 100;
  const textH = (card.layout === "full_bg" || card.layout === "none") ? previewH : Math.round(previewH * (1 - pRatio));
  const fillSource = card.fillSource || 'video';
  const videoFill = card.videoFill || "full";
  const sc = previewW / 1080;
  const vScale = (card.videoScale || 110) / 100;
  const videoUrl = card.url || globalUrl || "";
  const thumbnailId = videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
  const [thumbSrc, setThumbSrc] = useState(null);
  const [tried, setTried] = useState(0);

  // Canvas overlay state
  const [overlayUrl, setOverlayUrl] = useState(null);
  const overlayTimer = useRef(null);

  useEffect(() => {
    if (thumbnailId) { setThumbSrc(`https://img.youtube.com/vi/${thumbnailId}/maxresdefault.jpg`); setTried(0); }
    else setThumbSrc(null);
  }, [thumbnailId]);

  // Generate canvas overlay (debounced) — same engine as final render
  const { overlays: _ovSkip, uploadedImage: _uiSkip, ...cardTextProps } = card;
  const cardKey = JSON.stringify(cardTextProps);
  useEffect(() => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(async () => {
      try {
        const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;
        const canvasW = Math.max(Math.round(previewW * dpr), 720);
        const url = await generateOverlayPng(card, canvasW, aspectRatio, { skipOverlays: true, skipBorder: true });
        setOverlayUrl(url);
      } catch (e) {}
    }, 30);
    return () => { if (overlayTimer.current) clearTimeout(overlayTimer.current); };
  }, [cardKey, previewW, aspectRatio]);

  // Center guides
  const titleOX = Math.round((card.titleX ?? 0) * sc);
  const titleOY = Math.round((card.titleY ?? 0) * sc);
  const subOX = Math.round((card.subtitleX ?? 0) * sc);
  const subOY = Math.round((card.subtitleY ?? 0) * sc);
  const bodyOXv = Math.round((card.bodyX ?? 0) * sc);
  const bodyOYv = Math.round((card.bodyY ?? 0) * sc);
  const padX = Math.round(60 * sc);
  const [guidesVisible, setGuidesVisible] = useState(false);
  const guidesTimer = useRef(null);
  const prevPos = useRef({ titleOX: 0, titleOY: 0, subOX: 0, subOY: 0, bodyOXv: 0, bodyOYv: 0 });
  useEffect(() => {
    const prev = prevPos.current;
    const changed = prev.titleOX !== titleOX || prev.titleOY !== titleOY ||
                    prev.subOX !== subOX || prev.subOY !== subOY ||
                    prev.bodyOXv !== bodyOXv || prev.bodyOYv !== bodyOYv;
    prevPos.current = { titleOX, titleOY, subOX, subOY, bodyOXv, bodyOYv };
    if (changed) {
      setGuidesVisible(true);
      if (guidesTimer.current) clearTimeout(guidesTimer.current);
      guidesTimer.current = setTimeout(() => setGuidesVisible(false), 600);
    }
  }, [titleOX, titleOY, subOX, subOY, bodyOXv, bodyOYv]);

  const handleThumbError = () => {
    if (tried === 0) { setThumbSrc(`https://img.youtube.com/vi/${thumbnailId}/hqdefault.jpg`); setTried(1); }
    else setThumbSrc(null);
  };

  const baseImage = fillSource === 'image'
    ? (card.uploadedImage || globalBgImage || thumbSrc)
    : (thumbSrc || globalBgImage);
  const isBaseThumb = baseImage === thumbSrc && fillSource === 'video';
  const overlays = card.overlays || [];

  const snapPx = Math.round(8 * sc);
  const centerOffset = Math.round(previewW / 2 - padX);
  const textItems = [
    { align: card.titleAlign, x: titleOX, y: titleOY, active: !!card.title },
    { align: card.subtitleAlign, x: subOX, y: subOY, active: !!card.subtitle },
    { align: card.bodyAlign, x: bodyOXv, y: bodyOYv, active: !!card.body },
  ];
  const anyHCenter = textItems.some(t => {
    if (!t.active) return false;
    const align = t.align || 'left';
    if (align === 'center') return Math.abs(t.x) <= snapPx;
    if (align === 'left') return Math.abs(t.x - centerOffset) <= snapPx;
    if (align === 'right') return Math.abs(t.x + centerOffset) <= snapPx;
    return false;
  });
  const anyVCenter = textItems.some(t => t.active && Math.abs(t.y) <= snapPx);
  const guideStyle = { position: 'absolute', zIndex: 20, pointerEvents: 'none' };
  const CenterGuides = () => guidesVisible ? React.createElement(React.Fragment, null,
    anyHCenter && React.createElement("div", { style: { ...guideStyle, top: 0, bottom: 0, left: '50%', width: 0, borderLeft: '1px dashed rgba(124,58,237,0.7)', transform: 'translateX(-0.5px)' } }),
    anyVCenter && React.createElement("div", { style: { ...guideStyle, left: 0, right: 0, top: '50%', height: 0, borderTop: '1px dashed rgba(124,58,237,0.5)', transform: 'translateY(-0.5px)' } }),
  ) : null;

  const brightFilter = (card.videoBrightness) ? `brightness(${1 + (card.videoBrightness || 0) / 100})` : undefined;
  const BgImage = () => baseImage
    ? React.createElement("img", { src: baseImage, alt: "", onError: isBaseThumb ? handleThumbError : undefined, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: 'center', zIndex: 0, transform: isBaseThumb ? `scale(${vScale})` : 'none', transformOrigin: isBaseThumb ? `${card.videoX}% ${card.videoY}%` : 'center', filter: brightFilter } })
    : React.createElement("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 0 } },
        React.createElement("div", { style: { width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" } },
          React.createElement("span", { style: { color: "rgba(255,255,255,0.5)", fontSize: 18, marginLeft: 2 } }, "\u25B6")
        ));

  const overlayImg = (ov, i, z) => ov.image ? React.createElement("img", { key: i, src: ov.image, alt: "", style: { position: "absolute", zIndex: z, top: '50%', left: '50%', width: previewW, height: 'auto', transform: `translate(-50%, -50%) translate(${((ov.x ?? 50) - 50) * previewW / 50}px, ${((ov.y ?? 50) - 50) * previewH / 50}px) scale(${(ov.scale || 100) / 100})`, opacity: ov.opacity ?? 1, pointerEvents: 'none' } }) : null;
  const OverlayImgsBelow = () => React.createElement(React.Fragment, null, ...overlays.map((ov, i) => !ov.aboveLayout ? overlayImg(ov, i, 1) : null));
  const OverlayImgsAbove = () => React.createElement(React.Fragment, null, ...overlays.map((ov, i) => ov.aboveLayout ? overlayImg(ov, i, 5) : null));

  const wrapper = { width: previewW, height: previewH, borderRadius: T.radius, overflow: "hidden", flexShrink: 0, position: "relative", boxShadow: T.shadowLg, background: '#000' };

  // Canvas overlay replaces all HTML text + background rendering
  const canvasOverlay = overlayUrl && React.createElement("img", {
    src: overlayUrl, alt: "",
    style: { position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 3, pointerEvents: "none" }
  });

  // Click target for text field switching + deselection (transparent, on top of canvas overlay)
  const clickTarget = (onTextClick || onSelectHandle) && React.createElement("div", {
    style: { position: "absolute", inset: 0, zIndex: 4, cursor: "pointer" },
    onClick: () => {
      if (onSelectHandle) onSelectHandle(null);
      if (onTextClick) {
        const fields = ['title', 'subtitle', 'body'].filter(f => card[f]);
        if (fields.length > 0) onTextClick(fields[0]);
      }
    }
  });

  // ── Unified drag system (textbox + overlay) ──
  const [uDrag, setUDrag] = useState(null); // { target: 'textbox'|'overlay-N', type: 'move'|'resize', startX, startY, orig* }
  const [uSnap, setUSnap] = useState({ x: false, y: false });
  const uDragRef = useRef(null);
  uDragRef.current = uDrag;
  const SNAP_THRESH = 2; // ±2% snap threshold

  // Helper: estimate text box geometry (reused for click target + handles)
  const getTextBoxGeom = () => {
    const bW = previewW * (card.textBoxWidth || 80) / 100;
    const bX = (card.textBoxX || 50) / 100 * previewW - bW / 2;
    const titleLineCount = card.title ? Math.max(1, Math.ceil(card.title.length * (card.titleSize || 56) * sc * 0.55 / (bW - Math.round((card.textBoxPadding || 20) * sc) * 2))) : 0;
    const subLineCount = card.subtitle ? Math.max(1, Math.ceil(card.subtitle.length * (card.subtitleSize || 44) * sc * 0.55 / (bW - Math.round((card.textBoxPadding || 20) * sc) * 2))) : 0;
    const bodyLineCount = card.body ? Math.max(1, Math.ceil(card.body.length * (card.bodySize || 36) * sc * 0.55 / (bW - Math.round((card.textBoxPadding || 20) * sc) * 2))) : 0;
    const boxPadPx = Math.round((card.textBoxPadding || 20) * sc);
    const estH = (card.textBoxHeight || 0) > 0
      ? previewH * card.textBoxHeight / 100
      : (titleLineCount * Math.round((card.titleSize || 56) * sc * (card.titleLineHeight || 1.4))
        + subLineCount * Math.round((card.subtitleSize || 44) * sc * (card.subtitleLineHeight || 1.4))
        + bodyLineCount * Math.round((card.bodySize || 36) * sc * (card.bodyLineHeight || 1.4))
        + (titleLineCount > 0 && subLineCount > 0 ? Math.round(10 * sc) : 0)
        + ((titleLineCount > 0 || subLineCount > 0) && bodyLineCount > 0 ? Math.round(15 * sc) : 0)
        + boxPadPx * 2);
    const bH = Math.max(20, estH);
    const bY = (card.textBoxY || 70) / 100 * previewH - bH / 2;
    return { bW, bH, bX, bY };
  };

  useEffect(() => {
    if (!uDrag) return;
    const onMove = (e) => {
      const d = uDragRef.current;
      if (!d || !onCardUpdate) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - d.startX;
      const dy = clientY - d.startY;
      if (d.target === 'textbox') {
        if (d.type === 'move') {
          let newX = Math.max(0, Math.min(100, d.origX + dx / previewW * 100));
          let newY = Math.max(0, Math.min(100, d.origY + dy / previewH * 100));
          const snapX = Math.abs(newX - 50) <= SNAP_THRESH;
          const snapY = Math.abs(newY - 50) <= SNAP_THRESH;
          if (snapX) newX = 50;
          if (snapY) newY = 50;
          setUSnap({ x: snapX, y: snapY });
          onCardUpdate({ textBoxX: Math.round(newX * 10) / 10, textBoxY: Math.round(newY * 10) / 10 });
        } else {
          const newW = Math.max(20, Math.min(100, d.origW + dx / previewW * 100 * 2));
          const newH = Math.max(5, Math.min(100, d.origH + dy / previewH * 100));
          onCardUpdate({ textBoxWidth: Math.round(newW * 10) / 10, textBoxHeight: Math.round(newH * 10) / 10 });
        }
      } else {
        // overlay-N
        const oi = parseInt(d.target.split('-')[1]);
        const ovs = [...(card.overlays || [])];
        if (!ovs[oi]) return;
        if (d.type === 'move') {
          let newX = Math.max(0, Math.min(100, d.origX + dx * 50 / previewW));
          let newY = Math.max(0, Math.min(100, d.origY + dy * 50 / previewH));
          const snapX = Math.abs(newX - 50) <= SNAP_THRESH;
          const snapY = Math.abs(newY - 50) <= SNAP_THRESH;
          if (snapX) newX = 50;
          if (snapY) newY = 50;
          setUSnap({ x: snapX, y: snapY });
          ovs[oi] = { ...ovs[oi], x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 };
          onCardUpdate({ overlays: ovs });
        } else {
          const newScale = Math.max(10, Math.min(300, d.origScale + dx * 200 / previewW));
          ovs[oi] = { ...ovs[oi], scale: Math.round(newScale) };
          onCardUpdate({ overlays: ovs });
        }
      }
    };
    const onUp = () => { setUDrag(null); setUSnap({ x: false, y: false }); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [!!uDrag]);

  // Snap guide lines (shown during move drag when snapped to center)
  const uSnapGuides = (uDrag && uDrag.type === 'move') ? React.createElement(React.Fragment, null,
    uSnap.x && React.createElement("div", { style: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 0, borderLeft: '1px dashed rgba(124,58,237,0.8)', zIndex: 8, pointerEvents: 'none', transform: 'translateX(-0.5px)' } }),
    uSnap.y && React.createElement("div", { style: { position: 'absolute', left: 0, right: 0, top: '50%', height: 0, borderTop: '1px dashed rgba(124,58,237,0.8)', zIndex: 8, pointerEvents: 'none', transform: 'translateY(-0.5px)' } }),
  ) : null;

  // ── Click targets ──
  // Overlay click targets (z:6) — transparent copies for click detection
  const overlayClickTargets = onSelectHandle && overlays.map((ov, i) => {
    if (!ov.image) return null;
    return React.createElement("div", {
      key: 'ovct-' + i,
      style: {
        position: 'absolute', zIndex: 6, top: '50%', left: '50%', width: previewW, height: previewW, // square reference
        transform: `translate(-50%, -50%) translate(${((ov.x ?? 50) - 50) * previewW / 50}px, ${((ov.y ?? 50) - 50) * previewH / 50}px) scale(${(ov.scale || 100) / 100})`,
        cursor: 'pointer', pointerEvents: 'auto',
      },
      onClick: (e) => { e.stopPropagation(); onSelectHandle('overlay-' + i); },
    });
  });

  // Text box click target (z:6)
  const textBoxClickTarget = card.layout === 'text_box' && onSelectHandle && (() => {
    const { bW, bH, bX, bY } = getTextBoxGeom();
    return React.createElement("div", {
      style: { position: 'absolute', left: bX, top: bY, width: bW, height: bH, zIndex: 6, cursor: 'pointer', borderRadius: Math.round((card.textBoxRadius || 12) * sc) },
      onClick: (e) => { e.stopPropagation(); onSelectHandle('textbox'); },
    });
  })();

  // ── Selection handles (z:7) ──
  const handleSize = 18;
  const handleStyle = {
    position: 'absolute', width: handleSize, height: handleSize, borderRadius: '50%',
    background: 'rgba(124,58,237,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 10, color: '#fff', userSelect: 'none', touchAction: 'none',
  };

  const startUnifiedDrag = (target, type, e, extras) => {
    e.stopPropagation(); e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setUDrag({ target, type, startX: clientX, startY: clientY, ...extras });
  };

  const selectionHandles = (() => {
    if (!selectedHandle || !onCardUpdate) return null;
    if (selectedHandle === 'textbox') {
      if (card.layout !== 'text_box') return null;
      const { bW, bH, bX, bY } = getTextBoxGeom();
      return React.createElement("div", {
        style: { position: 'absolute', left: bX, top: bY, width: bW, height: bH, zIndex: 7, border: '1.5px dashed rgba(124,58,237,0.6)', borderRadius: Math.round((card.textBoxRadius || 12) * sc), pointerEvents: 'none', boxSizing: 'border-box' }
      },
        // Move handle (top-right) — double-click to center
        React.createElement("div", {
          style: { ...handleStyle, top: -handleSize / 2, right: -handleSize / 2, cursor: 'move', pointerEvents: 'auto' },
          onMouseDown: (e) => startUnifiedDrag('textbox', 'move', e, { origX: card.textBoxX ?? 50, origY: card.textBoxY ?? 70 }),
          onTouchStart: (e) => startUnifiedDrag('textbox', 'move', e, { origX: card.textBoxX ?? 50, origY: card.textBoxY ?? 70 }),
          onDoubleClick: (e) => { e.stopPropagation(); onCardUpdate({ textBoxX: 50, textBoxY: 50 }); },
        }, "\u2725"),
        // Resize handle (bottom-right)
        React.createElement("div", {
          style: { ...handleStyle, bottom: -handleSize / 2, right: -handleSize / 2, cursor: 'nwse-resize', pointerEvents: 'auto' },
          onMouseDown: (e) => startUnifiedDrag('textbox', 'resize', e, { origW: card.textBoxWidth ?? 80, origH: (card.textBoxHeight ?? 0) > 0 ? card.textBoxHeight : bH / previewH * 100 }),
          onTouchStart: (e) => startUnifiedDrag('textbox', 'resize', e, { origW: card.textBoxWidth ?? 80, origH: (card.textBoxHeight ?? 0) > 0 ? card.textBoxHeight : bH / previewH * 100 }),
        }, "\u2922"),
      );
    }
    // overlay-N
    const match = selectedHandle.match(/^overlay-(\d+)$/);
    if (!match) return null;
    const oi = parseInt(match[1]);
    const ov = overlays[oi];
    if (!ov || !ov.image) return null;
    const ovScale = (ov.scale || 100) / 100;
    const ovX = ((ov.x ?? 50) - 50) * previewW / 50;
    const ovY = ((ov.y ?? 50) - 50) * previewH / 50;
    const counterScale = 1 / ovScale;
    return React.createElement("div", {
      style: {
        position: 'absolute', zIndex: 7, top: '50%', left: '50%', width: previewW, height: 'auto',
        transform: `translate(-50%, -50%) translate(${ovX}px, ${ovY}px) scale(${ovScale})`,
        pointerEvents: 'none', boxSizing: 'border-box',
      }
    },
      // Invisible reference image for sizing
      React.createElement("img", { src: ov.image, alt: "", style: { width: '100%', height: 'auto', visibility: 'hidden', display: 'block' } }),
      // Dashed border overlay
      React.createElement("div", { style: { position: 'absolute', inset: 0, border: '1.5px dashed rgba(124,58,237,0.6)', borderRadius: 4, pointerEvents: 'none', boxSizing: 'border-box' } }),
      // Move handle (top-right)
      React.createElement("div", {
        style: { ...handleStyle, position: 'absolute', top: -handleSize * counterScale / 2, right: -handleSize * counterScale / 2, cursor: 'move', pointerEvents: 'auto', width: handleSize * counterScale, height: handleSize * counterScale, fontSize: 10 * counterScale },
        onMouseDown: (e) => startUnifiedDrag('overlay-' + oi, 'move', e, { origX: ov.x ?? 50, origY: ov.y ?? 50 }),
        onTouchStart: (e) => startUnifiedDrag('overlay-' + oi, 'move', e, { origX: ov.x ?? 50, origY: ov.y ?? 50 }),
        onDoubleClick: (e) => { e.stopPropagation(); const ovs = [...(card.overlays || [])]; ovs[oi] = { ...ovs[oi], x: 50, y: 50 }; onCardUpdate({ overlays: ovs }); },
      }, "\u2725"),
      // Resize handle (bottom-right)
      React.createElement("div", {
        style: { ...handleStyle, position: 'absolute', bottom: -handleSize * counterScale / 2, right: -handleSize * counterScale / 2, cursor: 'nwse-resize', pointerEvents: 'auto', width: handleSize * counterScale, height: handleSize * counterScale, fontSize: 10 * counterScale },
        onMouseDown: (e) => startUnifiedDrag('overlay-' + oi, 'resize', e, { origScale: ov.scale ?? 100 }),
        onTouchStart: (e) => startUnifiedDrag('overlay-' + oi, 'resize', e, { origScale: ov.scale ?? 100 }),
      }, "\u2922"),
    );
  })();

  const isTop = card.layout === "photo_top";
  const videoAreaH = previewH - textH;

  // Split mode: constrain video to video area
  if (videoFill === "split" && fillSource === 'video' && card.layout !== "full_bg" && card.layout !== "text_box" && card.layout !== "none") {
    return React.createElement("div", { style: wrapper },
      React.createElement("div", { style: { position: "absolute", left: 0, right: 0, height: videoAreaH, ...(isTop ? { top: 0 } : { bottom: 0 }), overflow: "hidden" } },
        React.createElement(BgImage),
        videoPreviewOn && React.createElement(VideoPreview, { videoId: thumbnailId, start: card.start, end: card.end, width: previewW, height: videoAreaH, videoX: card.videoX, videoY: card.videoY, videoScale: card.videoScale, videoBrightness: card.videoBrightness, muted: previewMuted !== false, volume: previewVolume }),
      ),
      React.createElement(OverlayImgsBelow),
      React.createElement(CenterGuides),
      canvasOverlay,
      clickTarget,
      React.createElement(OverlayImgsAbove),
      overlayClickTargets,
      textBoxClickTarget,
      selectionHandles,
      uSnapGuides,
    );
  }

  // All other layouts: full-size background + canvas overlay
  return React.createElement("div", { style: wrapper },
    React.createElement(BgImage),
    videoPreviewOn && React.createElement(VideoPreview, { videoId: thumbnailId, start: card.start, end: card.end, width: previewW, height: previewH, videoX: card.videoX, videoY: card.videoY, videoScale: card.videoScale, videoBrightness: card.videoBrightness, muted: previewMuted !== false, volume: previewVolume }),
    React.createElement(OverlayImgsBelow),
    React.createElement(CenterGuides),
    canvasOverlay,
    clickTarget,
    React.createElement(OverlayImgsAbove),
    overlayClickTargets,
    textBoxClickTarget,
    selectionHandles,
    uSnapGuides,
  );
}

/* ── Section Box ── */
function Section({ title, children }) {
  return React.createElement("div", { style: { marginBottom: 16, padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: T.radius, border: `1px solid ${T.border}` } },
    React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 12 } }, title),
    React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 } }, children)
  );
}

/* ── Image Upload Field ── */
function ImageUploadField({ value, onChange, label = "이미지 업로드", maxMb = 3 }) {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) { alert(`${maxMb}MB 이하 이미지만 업로드 가능합니다.`); return; }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  };

  if (value) {
    return React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 12, padding: 10, background: 'rgba(99,102,241,0.06)', borderRadius: T.radiusSm, border: `1px solid rgba(99,102,241,0.15)` } },
      React.createElement("img", { src: value, style: { width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: `1px solid ${T.border}` } }),
      React.createElement("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 } },
        React.createElement("span", { style: { fontSize: 12, color: T.accent, fontWeight: 500 } }, "\u2713 이미지 적용됨"),
        React.createElement("div", { style: { display: 'flex', gap: 8 } },
          React.createElement("button", { onClick: () => fileRef.current?.click(), style: { background: 'none', border: 'none', color: T.textSecondary, fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline' } }, "변경"),
          React.createElement("button", { onClick: () => onChange(null), style: { background: 'none', border: 'none', color: T.danger, fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline' } }, "삭제"),
        ),
      ),
      React.createElement("input", { ref: fileRef, type: "file", accept: "image/*", onChange: (e) => handleFile(e.target.files?.[0]), style: { display: 'none' } }),
    );
  }

  return React.createElement("div", {
    onClick: () => fileRef.current?.click(),
    onDragOver: (e) => { e.preventDefault(); setDragOver(true); },
    onDragLeave: () => setDragOver(false),
    onDrop: (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); },
    style: {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '20px 16px', borderRadius: T.radiusSm,
      border: `2px dashed ${dragOver ? T.accent : T.border}`,
      background: dragOver ? 'rgba(99,102,241,0.06)' : 'transparent',
      cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none',
    },
    onMouseEnter: (e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = 'rgba(99,102,241,0.04)'; },
    onMouseLeave: (e) => { if (!dragOver) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = 'transparent'; } },
  },
    React.createElement("div", { style: { width: 36, height: 36, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      React.createElement("span", { style: { fontSize: 18, color: T.accent } }, "\u2191"),
    ),
    React.createElement("span", { style: { fontSize: 13, color: T.textSecondary, fontWeight: 500 } }, "클릭 또는 드래그하여 업로드"),
    React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, `${maxMb}MB 이하 \u00B7 JPG, PNG 권장`),
    React.createElement("input", { ref: fileRef, type: "file", accept: "image/*", onChange: (e) => handleFile(e.target.files?.[0]), style: { display: 'none' } }),
  );
}

/* ── CardEditor ── */
function CardEditor({ card, index, onChange, onRemove, onDuplicate, total, globalUrl, aspectRatio, outputFormat, globalBgImage, onReorder, mob, onAspectRatioChange }) {
  const [expanded, setExpanded] = useState(true);
  const [showDetailTitle, setShowDetailTitle] = useState(false);
  const [showDetailSubtitle, setShowDetailSubtitle] = useState(false);
  const [showDetailBody, setShowDetailBody] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameRef = useRef(null);
  const update = (key, val) => onChange({ ...card, [key]: val });
  const updateMulti = (obj) => onChange({ ...card, ...obj });

  useEffect(() => { if (editingName && nameRef.current) nameRef.current.focus(); }, [editingName]);

  const displayName = card.name || card.title || card.subtitle || `카드 ${index + 1}`;
  const startEditName = () => { setEditingName(true); setNameValue(card.name || ''); };
  const commitName = () => { update('name', nameValue.trim()); setEditingName(false); };

  return React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, boxShadow: T.shadow, display: 'flex' } },
    // Left: Reorder button
    React.createElement("div", {
      onClick: (e) => { e.stopPropagation(); onReorder(); },
      style: { width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', borderRight: `1px solid ${T.border}`, flexShrink: 0, transition: 'background 0.15s' },
      onMouseEnter: (e) => e.currentTarget.style.background = 'rgba(99,102,241,0.1)',
      onMouseLeave: (e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)',
      title: '순서 변경',
    },
      React.createElement("span", { style: { color: T.textMuted, fontSize: 14, lineHeight: 1, writingMode: 'vertical-lr' } }, "\u2630")
    ),

    // Right: Card content
    React.createElement("div", { style: { flex: 1, minWidth: 0 } },
      // Header
      React.createElement("div", {
        onClick: () => setExpanded(!expanded),
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: mob ? '10px 12px' : '14px 20px', cursor: 'pointer', transition: 'background 0.15s', flexWrap: mob ? 'wrap' : 'nowrap', gap: mob ? 8 : 0 },
        onMouseEnter: (e) => e.currentTarget.style.background = T.surfaceHover,
        onMouseLeave: (e) => e.currentTarget.style.background = 'transparent',
      },
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: mob ? 8 : 12, minWidth: 0, flex: 1 } },
          React.createElement("span", { style: { width: 28, height: 28, borderRadius: T.radiusPill, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' } }, index + 1),
          editingName
            ? React.createElement("input", {
                ref: nameRef, value: nameValue,
                onChange: (e) => setNameValue(e.target.value),
                onBlur: commitName,
                onKeyDown: (e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); },
                onClick: (e) => e.stopPropagation(),
                style: { background: 'transparent', border: `1px solid ${T.accent}`, color: T.text, fontSize: 14, fontWeight: 500, outline: 'none', padding: '2px 8px', borderRadius: 4, width: Math.max(80, nameValue.length * 10) },
              })
            : React.createElement("span", {
                style: { color: T.text, fontWeight: 500, fontSize: mob ? 13 : 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: mob ? 120 : 'none' },
              }, displayName),
          !editingName && React.createElement("button", {
            onClick: (e) => { e.stopPropagation(); startEditName(); },
            style: { background: 'rgba(99,102,241,0.1)', border: 'none', color: T.accentHover, fontSize: 12, cursor: 'pointer', padding: '2px 6px', borderRadius: 4, opacity: 0.8, transition: 'all 0.15s' },
            onMouseEnter: (e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; },
            onMouseLeave: (e) => { e.currentTarget.style.opacity = 0.8; e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; },
            title: '카드 이름 수정',
          }, "\u270E"),
          !mob && card.start && React.createElement("span", { style: { color: T.textMuted, fontSize: 12, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: T.radiusPill } }, `${card.start} ~ ${card.end}`)
        ),
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6 } },
          React.createElement("button", { onClick: (e) => { e.stopPropagation(); onDuplicate(); }, style: { background: 'rgba(255,255,255,0.05)', border: 'none', color: T.textMuted, fontSize: 12, cursor: 'pointer', padding: '4px 10px', borderRadius: T.radiusPill, transition: 'all 0.15s' } }, "복제"),
          total > 1 && React.createElement("button", { onClick: (e) => { e.stopPropagation(); onRemove(); }, style: { background: 'rgba(239,68,68,0.1)', border: 'none', color: T.danger, fontSize: 12, cursor: 'pointer', padding: '4px 10px', borderRadius: T.radiusPill } }, "삭제"),
          React.createElement("span", { style: { color: T.textMuted, fontSize: 14, marginLeft: 4, transition: 'transform 0.2s', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' } }, "\u25BE")
        )
      ),

      // Body
      expanded && React.createElement("div", { style: { padding: mob ? '0 12px 16px' : '0 20px 20px', display: 'flex', flexDirection: mob ? 'column-reverse' : 'row', gap: mob ? 16 : 28 } },
        // Left: Form
        React.createElement("div", { style: { flex: 1, minWidth: 0 } },

          // 클립 편집
          React.createElement(Section, { title: "클립 편집" },
            React.createElement("div", { style: { display: 'flex', gap: 6, marginBottom: 8 } },
              FILL_SOURCE_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: (card.fillSource || 'video') === opt.id, onClick: () => update("fillSource", opt.id) }, opt.label))
            ),
            (card.fillSource || 'video') === 'video' && React.createElement(React.Fragment, null,
              React.createElement("input", { type: "text", value: card.url, placeholder: "개별 URL (비워두면 공통 URL)", onChange: (e) => update("url", e.target.value), style: inputBase }),
              React.createElement(ClipSelector, { videoUrl: card.url || globalUrl, start: card.start, end: card.end, onStartChange: (v) => update("start", v), onEndChange: (v) => update("end", v), onClipChange: (s, e) => updateMulti({ start: s, end: e }) }),
            ),
            (card.fillSource || 'video') === 'image' && React.createElement(React.Fragment, null,
              React.createElement(ImageUploadField, { value: card.uploadedImage, onChange: (v) => update("uploadedImage", v) }),
            ),
            React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 } },
              React.createElement(SectionTitleWithReset, { title: "\uD074\uB9BD \uC870\uC815", onReset: () => updateMulti({ videoX: 50, videoY: 50, videoScale: 110, videoBrightness: 0 }) }),
              React.createElement(SliderRow, { label: "좌우", value: card.videoX, min: 0, max: 100, step: 1, onChange: (v) => update("videoX", v), defaultValue: 50 }),
              React.createElement(SliderRow, { label: "위아래", value: card.videoY, min: 0, max: 100, step: 1, onChange: (v) => update("videoY", v), defaultValue: 50 }),
              React.createElement(SliderRow, { label: "확대", value: card.videoScale || 110, min: 100, max: 200, step: 1, onChange: (v) => update("videoScale", v), defaultValue: 110 }),
              React.createElement(SliderRow, { label: "밝기", value: card.videoBrightness || 0, min: -100, max: 100, step: 1, onChange: (v) => update("videoBrightness", v), suffix: '%', defaultValue: 0 }),
            ),
          ),

          // 레이아웃
          React.createElement(Section, { title: "레이아웃" },
            React.createElement("div", { style: { display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto' } },
              LAYOUT_OPTIONS.map(opt => React.createElement(LayoutThumb, { key: opt.id, type: opt.id, label: opt.label, active: opt.id === 'gradient_fade' ? (card.layout === 'photo_top' && card.useGradient === true) : opt.id === 'photo_top' ? (card.layout === 'photo_top' && !card.useGradient) : card.layout === opt.id, onClick: () => updateMulti({ layout: opt.id === 'gradient_fade' ? 'photo_top' : opt.id, useGradient: opt.id === 'gradient_fade' }) }))
            ),
            // 카드 비율
            onAspectRatioChange && React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 } },
              React.createElement("span", { style: { fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap' } }, "\uCE74\uB4DC \uBE44\uC728"),
              ASPECT_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: aspectRatio === opt.id, onClick: () => onAspectRatioChange(opt.id) }, opt.label))
            ),
            card.layout !== "full_bg" && card.layout !== "text_box" && card.layout !== "none" && React.createElement(SliderRow, { label: "배경 영역", value: 100 - (card.photoRatio ?? 50), min: 10, max: 80, step: 1, onChange: (v) => update("photoRatio", 100 - v), suffix: '%' }),
            // 텍스트 박스 설정
            card.layout === "text_box" && React.createElement("div", { style: { borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 8 } },
              React.createElement(SectionTitleWithReset, { title: "\uBC15\uC2A4 \uC124\uC815", onReset: () => updateMulti({ textBoxX: 50, textBoxY: 70, textBoxWidth: 80, textBoxHeight: 0, textBoxPadding: 20, textBoxRadius: 12, textBoxBgColor: '#000000', textBoxBgOpacity: 0.6, textBoxBorderColor: '#ffffff', textBoxBorderWidth: 0 }) }),
              React.createElement(SliderRow, { label: "좌우 위치", value: card.textBoxX ?? 50, min: 0, max: 100, step: 1, onChange: (v) => update("textBoxX", v), suffix: '%', defaultValue: 50 }),
              React.createElement(SliderRow, { label: "위아래 위치", value: card.textBoxY ?? 70, min: 0, max: 100, step: 1, onChange: (v) => update("textBoxY", v), suffix: '%', defaultValue: 70 }),
              React.createElement(SliderRow, { label: "박스 너비", value: card.textBoxWidth ?? 80, min: 20, max: 100, step: 1, onChange: (v) => update("textBoxWidth", v), suffix: '%', defaultValue: 80 }),
              React.createElement(SliderRow, { label: "박스 높이", value: card.textBoxHeight ?? 0, min: 0, max: 100, step: 1, onChange: (v) => update("textBoxHeight", v), suffix: (card.textBoxHeight ?? 0) === 0 ? ' 자동' : '%', defaultValue: 0 }),
              React.createElement(SliderRow, { label: "안쪽 여백", value: card.textBoxPadding ?? 20, min: 5, max: 60, step: 1, onChange: (v) => update("textBoxPadding", v), suffix: 'px', defaultValue: 20 }),
              React.createElement(SliderRow, { label: "둥글기", value: card.textBoxRadius ?? 12, min: 0, max: 40, step: 1, onChange: (v) => update("textBoxRadius", v), suffix: 'px', defaultValue: 12 }),
              React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 } },
                React.createElement("label", { style: { fontSize: 12, color: T.textMuted } }, "배경색"),
                React.createElement("input", { type: "color", value: card.textBoxBgColor ?? "#000000", onChange: (e) => update("textBoxBgColor", e.target.value), style: { width: 32, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, cursor: 'pointer' } }),
                React.createElement("span", { style: { fontSize: 12, color: T.textMuted } }, card.textBoxBgColor ?? "#000000"),
              ),
              React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 } },
                React.createElement("div", { style: { flex: 1 } }, React.createElement(SliderRow, { label: "투명도", value: card.textBoxBgOpacity ?? 0.6, min: 0, max: 1, step: 0.01, onChange: (v) => update("textBoxBgOpacity", v), defaultValue: 0.6 })),
              ),
              React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 } },
                React.createElement("label", { style: { fontSize: 12, color: T.textMuted } }, "테두리 색"),
                React.createElement("input", { type: "color", value: card.textBoxBorderColor ?? "#ffffff", onChange: (e) => update("textBoxBorderColor", e.target.value), style: { width: 32, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, cursor: 'pointer' } }),
                React.createElement("span", { style: { fontSize: 12, color: T.textMuted } }, card.textBoxBorderColor ?? "#ffffff"),
              ),
              React.createElement(SliderRow, { label: "테두리 두께", value: card.textBoxBorderWidth ?? 0, min: 0, max: 10, step: 1, onChange: (v) => update("textBoxBorderWidth", v), suffix: 'px', defaultValue: 0 }),
            ),
            // 영상 채우기
            card.layout !== "full_bg" && card.layout !== "text_box" && card.layout !== "none" && React.createElement("div", { style: { marginTop: 8 } },
              React.createElement("label", { style: labelBase }, "영상 채우기"),
              React.createElement("div", { style: { display: 'flex', gap: 6 } },
                VIDEO_FILL_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: (card.videoFill || "full") === opt.id, onClick: () => update("videoFill", opt.id) }, opt.label))
              )
            ),
            // 텍스트 배경 설정 (text_box는 박스 설정에서 관리)
            card.layout !== "text_box" && card.layout !== "none" && React.createElement("div", { style: { borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 8 } },
              React.createElement(SectionTitleWithReset, { title: "텍스트 배경 설정", onReset: () => updateMulti({ useBg: true, bgColor: '#121212', bgOpacity: 0.75 }) }),
              React.createElement(CheckboxRow, { label: "배경색 사용", checked: card.useBg !== false, onChange: (v) => update("useBg", v) }),
              card.useBg !== false && React.createElement(React.Fragment, null,
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 } },
                  React.createElement("label", { style: { fontSize: 12, color: T.textMuted } }, "색상"),
                  React.createElement("input", { type: "color", value: card.bgColor, onChange: (e) => update("bgColor", e.target.value), style: { width: 32, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, cursor: 'pointer' } }),
                  React.createElement("span", { style: { fontSize: 12, color: T.textMuted } }, card.bgColor),
                ),
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 } },
                  React.createElement("div", { style: { flex: 1 } }, React.createElement(SliderRow, { label: "투명도", value: card.bgOpacity, min: 0, max: 1, step: 0.01, onChange: (v) => update("bgOpacity", v), defaultValue: 0.75 })),
                  React.createElement(CheckboxRow, { label: "투명하게", checked: card.bgOpacity === 0, onChange: (v) => update("bgOpacity", v ? 0 : 0.75) }),
                ),
              ),
            ),
          ),

          // 텍스트 내용
          React.createElement(Section, { title: "텍스트 내용" },
            // 제목
            React.createElement(TextFieldRow, { value: card.title, onTextChange: (v) => update("title", v), placeholder: "제목", size: card.titleSize, onSizeChange: (v) => update("titleSize", v), color: card.titleColor, onColorChange: (v) => update("titleColor", v), enabled: card.useTitle !== false, onToggle: () => update("useTitle", card.useTitle === false ? true : false) }),
            React.createElement("div", {
              style: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', marginBottom: 6, paddingLeft: 28 },
            },
              React.createElement("div", { onClick: () => setShowDetailTitle(!showDetailTitle), style: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', flex: 1 } },
                React.createElement("span", { style: { fontSize: 10, color: T.textMuted, transition: 'transform 0.2s', transform: showDetailTitle ? 'rotate(90deg)' : 'rotate(0deg)' } }, "\u25B6"),
                React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, "\uC138\uBD80\uC870\uC815"),
              ),
              showDetailTitle && React.createElement("button", { onClick: () => updateMulti({ titleAlign: 'left', titleLetterSpacing: 0, titleLineHeight: 1.4, titleX: 0, titleY: 0 }), style: resetBtnStyle }, "\uAE30\uBCF8\uAC12"),
            ),
            showDetailTitle && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 28, borderLeft: `2px solid ${T.border}`, paddingLeft: 8, marginBottom: 8 } },
              React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 } },
                React.createElement("span", { style: { fontSize: 11, color: T.textMuted, minWidth: 36 } }, "\uC815\uB82C"),
                React.createElement("div", { style: { display: 'flex', gap: 3 } },
                  [['left','\u2630 \uC88C'], ['center','\u2630 \uC911'], ['right','\u2630 \uC6B0']].map(([v, lb]) => React.createElement(PillBtn, { key: v, active: (card.titleAlign || 'left') === v, onClick: () => update("titleAlign", v) }, lb))
                ),
              ),
              React.createElement(SliderRow, { label: "\uC790\uAC04", value: card.titleLetterSpacing ?? 0, min: -5, max: 20, step: 0.5, onChange: (v) => update("titleLetterSpacing", v), suffix: 'px', defaultValue: 0 }),
              React.createElement(SliderRow, { label: "\uC904\uAC04", value: card.titleLineHeight ?? 1.4, min: 1.0, max: 3.0, step: 0.1, onChange: (v) => update("titleLineHeight", v), suffix: '', defaultValue: 1.4 }),
              React.createElement(SliderRow, { label: "\uC88C\uC6B0", value: card.titleX ?? 0, min: -540, max: 540, step: 1, onChange: (v) => update("titleX", v), suffix: 'px', defaultValue: 0 }),
              React.createElement(SliderRow, { label: "\uC704\uC544\uB798", value: card.titleY ?? 0, min: -1080, max: 1080, step: 1, onChange: (v) => update("titleY", v), suffix: 'px', defaultValue: 0 }),
            ),
            // 부제목
            React.createElement(TextFieldRow, { value: card.subtitle, onTextChange: (v) => update("subtitle", v), placeholder: "부제목", size: card.subtitleSize, onSizeChange: (v) => update("subtitleSize", v), color: card.subtitleColor, onColorChange: (v) => update("subtitleColor", v), enabled: card.useSubtitle !== false, onToggle: () => update("useSubtitle", card.useSubtitle === false ? true : false) }),
            React.createElement("div", {
              style: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', marginBottom: 6, paddingLeft: 28 },
            },
              React.createElement("div", { onClick: () => setShowDetailSubtitle(!showDetailSubtitle), style: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', flex: 1 } },
                React.createElement("span", { style: { fontSize: 10, color: T.textMuted, transition: 'transform 0.2s', transform: showDetailSubtitle ? 'rotate(90deg)' : 'rotate(0deg)' } }, "\u25B6"),
                React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, "\uC138\uBD80\uC870\uC815"),
              ),
              showDetailSubtitle && React.createElement("button", { onClick: () => updateMulti({ subtitleAlign: 'left', subtitleLetterSpacing: 0, subtitleLineHeight: 1.4, subtitleX: 0, subtitleY: 0 }), style: resetBtnStyle }, "\uAE30\uBCF8\uAC12"),
            ),
            showDetailSubtitle && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 28, borderLeft: `2px solid ${T.border}`, paddingLeft: 8, marginBottom: 8 } },
              React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 } },
                React.createElement("span", { style: { fontSize: 11, color: T.textMuted, minWidth: 36 } }, "\uC815\uB82C"),
                React.createElement("div", { style: { display: 'flex', gap: 3 } },
                  [['left','\u2630 \uC88C'], ['center','\u2630 \uC911'], ['right','\u2630 \uC6B0']].map(([v, lb]) => React.createElement(PillBtn, { key: v, active: (card.subtitleAlign || 'left') === v, onClick: () => update("subtitleAlign", v) }, lb))
                ),
              ),
              React.createElement(SliderRow, { label: "\uC790\uAC04", value: card.subtitleLetterSpacing ?? 0, min: -5, max: 20, step: 0.5, onChange: (v) => update("subtitleLetterSpacing", v), suffix: 'px', defaultValue: 0 }),
              React.createElement(SliderRow, { label: "\uC904\uAC04", value: card.subtitleLineHeight ?? 1.4, min: 1.0, max: 3.0, step: 0.1, onChange: (v) => update("subtitleLineHeight", v), suffix: '', defaultValue: 1.4 }),
              React.createElement(SliderRow, { label: "\uC88C\uC6B0", value: card.subtitleX ?? 0, min: -540, max: 540, step: 1, onChange: (v) => update("subtitleX", v), suffix: 'px', defaultValue: 0 }),
              React.createElement(SliderRow, { label: "\uC704\uC544\uB798", value: card.subtitleY ?? 0, min: -1080, max: 1080, step: 1, onChange: (v) => update("subtitleY", v), suffix: 'px', defaultValue: 0 }),
            ),
            // 본문
            React.createElement(TextFieldRow, { value: card.body, onTextChange: (v) => update("body", v), placeholder: "본문 내용", rows: 3, size: card.bodySize, onSizeChange: (v) => update("bodySize", v), color: card.bodyColor, onColorChange: (v) => update("bodyColor", v), enabled: card.useBody !== false, onToggle: () => update("useBody", card.useBody === false ? true : false) }),
            React.createElement("div", {
              style: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', paddingLeft: 28 },
            },
              React.createElement("div", { onClick: () => setShowDetailBody(!showDetailBody), style: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', flex: 1 } },
                React.createElement("span", { style: { fontSize: 10, color: T.textMuted, transition: 'transform 0.2s', transform: showDetailBody ? 'rotate(90deg)' : 'rotate(0deg)' } }, "\u25B6"),
                React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, "\uC138\uBD80\uC870\uC815"),
              ),
              showDetailBody && React.createElement("button", { onClick: () => updateMulti({ bodyAlign: 'left', bodyLetterSpacing: 0, bodyLineHeight: 1.4, bodyX: 0, bodyY: 0 }), style: resetBtnStyle }, "\uAE30\uBCF8\uAC12"),
            ),
            showDetailBody && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 28, borderLeft: `2px solid ${T.border}`, paddingLeft: 8, marginBottom: 4 } },
              React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 } },
                React.createElement("span", { style: { fontSize: 11, color: T.textMuted, minWidth: 36 } }, "\uC815\uB82C"),
                React.createElement("div", { style: { display: 'flex', gap: 3 } },
                  [['left','\u2630 \uC88C'], ['center','\u2630 \uC911'], ['right','\u2630 \uC6B0']].map(([v, lb]) => React.createElement(PillBtn, { key: v, active: (card.bodyAlign || 'left') === v, onClick: () => update("bodyAlign", v) }, lb))
                ),
              ),
              React.createElement(SliderRow, { label: "\uC790\uAC04", value: card.bodyLetterSpacing ?? 0, min: -5, max: 20, step: 0.5, onChange: (v) => update("bodyLetterSpacing", v), suffix: 'px', defaultValue: 0 }),
              React.createElement(SliderRow, { label: "\uC904\uAC04", value: card.bodyLineHeight ?? 1.4, min: 1.0, max: 3.0, step: 0.1, onChange: (v) => update("bodyLineHeight", v), suffix: '', defaultValue: 1.4 }),
              React.createElement(SliderRow, { label: "\uC88C\uC6B0", value: card.bodyX ?? 0, min: -540, max: 540, step: 1, onChange: (v) => update("bodyX", v), suffix: 'px', defaultValue: 0 }),
              React.createElement(SliderRow, { label: "\uC704\uC544\uB798", value: card.bodyY ?? 0, min: -1080, max: 1080, step: 1, onChange: (v) => update("bodyY", v), suffix: 'px', defaultValue: 0 }),
            ),
          ),

          // 이미지 얹기
          React.createElement(Section, { title: "이미지 얹기" },
            React.createElement("div", { style: { maxHeight: 400, overflowY: 'auto', marginBottom: 4 } },
              (card.overlays || []).map((ov, oi) => React.createElement("div", { key: oi, style: { marginBottom: 12, padding: 10, background: 'rgba(255,255,255,0.02)', borderRadius: T.radiusSm, border: `1px solid ${T.border}` } },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 } },
                  React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                    React.createElement("span", { style: { fontSize: 12, color: T.textSecondary, fontWeight: 500 } }, `이미지 ${oi + 1}`),
                    React.createElement("div", { onClick: () => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], aboveLayout: !ov.aboveLayout}; update("overlays", ovs); }, style: { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' } },
                      React.createElement("div", { style: { width: 24, height: 12, borderRadius: 6, background: ov.aboveLayout ? T.accent : 'rgba(255,255,255,0.2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 } },
                        React.createElement("div", { style: { width: 8, height: 8, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: ov.aboveLayout ? 14 : 2, transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' } })
                      ),
                      React.createElement("span", { style: { fontSize: 10, color: ov.aboveLayout ? '#fff' : 'rgba(255,255,255,0.4)', userSelect: 'none' } }, "레이아웃 위에 표시"),
                    ),
                  ),
                  React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 4 } },
                    React.createElement("button", { disabled: oi === 0, onClick: () => { const ovs = [...(card.overlays||[])]; const t = ovs[oi]; ovs[oi] = ovs[oi-1]; ovs[oi-1] = t; update("overlays", ovs); }, style: { background: 'rgba(255,255,255,0.06)', border: 'none', color: oi === 0 ? T.textMuted : T.textSecondary, fontSize: 11, cursor: oi === 0 ? 'default' : 'pointer', padding: '2px 6px', borderRadius: T.radiusPill, opacity: oi === 0 ? 0.4 : 1 } }, "\u25B2"),
                    React.createElement("button", { disabled: oi === (card.overlays||[]).length - 1, onClick: () => { const ovs = [...(card.overlays||[])]; const t = ovs[oi]; ovs[oi] = ovs[oi+1]; ovs[oi+1] = t; update("overlays", ovs); }, style: { background: 'rgba(255,255,255,0.06)', border: 'none', color: oi === (card.overlays||[]).length - 1 ? T.textMuted : T.textSecondary, fontSize: 11, cursor: oi === (card.overlays||[]).length - 1 ? 'default' : 'pointer', padding: '2px 6px', borderRadius: T.radiusPill, opacity: oi === (card.overlays||[]).length - 1 ? 0.4 : 1 } }, "\u25BC"),
                    React.createElement("button", { onClick: () => { const ovs = [...(card.overlays||[])]; ovs.splice(oi, 1); update("overlays", ovs); }, style: { background: 'rgba(239,68,68,0.1)', border: 'none', color: T.danger, fontSize: 11, cursor: 'pointer', padding: '2px 8px', borderRadius: T.radiusPill } }, "삭제"),
                  ),
                ),
                React.createElement(ImageUploadField, { value: ov.image, onChange: (v) => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], image: v}; update("overlays", ovs); }, maxMb: 5 }),
                ov.image && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 } },
                  React.createElement(SectionTitleWithReset, { title: "\uC774\uBBF8\uC9C0 \uC870\uC815", onReset: () => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], x: 50, y: 50, scale: 100, opacity: 1}; update("overlays", ovs); } }),
                  React.createElement(SliderRow, { label: "좌우", value: ov.x ?? 50, min: 0, max: 100, step: 1, onChange: (v) => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], x: v}; update("overlays", ovs); } }),
                  React.createElement(SliderRow, { label: "위아래", value: ov.y ?? 50, min: 0, max: 100, step: 1, onChange: (v) => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], y: v}; update("overlays", ovs); } }),
                  React.createElement(SliderRow, { label: "크기", value: ov.scale ?? 100, min: 10, max: 300, step: 1, onChange: (v) => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], scale: v}; update("overlays", ovs); }, suffix: '%' }),
                  React.createElement(SliderRow, { label: "투명도", value: ov.opacity ?? 1, min: 0, max: 1, step: 0.01, onChange: (v) => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], opacity: v}; update("overlays", ovs); } }),
                ),
              )),
            ),
            React.createElement("button", {
              onClick: () => update("overlays", [...(card.overlays||[]), { image: null, x: 50, y: 50, scale: 100, opacity: 1 }]),
              style: { width: '100%', padding: '10px', border: `1.5px dashed ${T.border}`, borderRadius: T.radiusSm, background: 'transparent', color: T.textSecondary, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', marginTop: 4 },
              onMouseEnter: (e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; },
              onMouseLeave: (e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSecondary; },
            }, "+ 이미지 추가"),
          ),
        ),

        // Right: Preview (sticky on desktop, top on mobile)
        React.createElement("div", { style: { flexShrink: 0, ...(mob ? { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' } : { position: 'sticky', top: 80, alignSelf: 'flex-start' }) } },
          React.createElement("div", { style: { ...sectionTitle, textAlign: 'center' } }, "미리보기"),
          React.createElement(CardPreview, { card: { ...card, title: card.useTitle !== false ? card.title : '', subtitle: card.useSubtitle !== false ? card.subtitle : '', body: card.useBody !== false ? card.body : '' }, globalUrl, aspectRatio, globalBgImage, previewWidth: mob ? Math.min(360, window.innerWidth - 32) : 320 }),
        )
      )
    )
  );
}

/* ── JSON Modal ── */

/* ── PreviewModal ── */
function PreviewModal({ cards, globalUrl, aspectRatio, globalBgImage, onClose, onGenerate, generating, previewMuted, onMuteToggle }) {
  const pvCard = (c) => ({ ...c, title: c.useTitle !== false ? c.title : '', subtitle: c.useSubtitle !== false ? c.subtitle : '', body: c.useBody !== false ? c.body : '' });
  const scrollRef = useRef(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [videoPreviewOn, setVideoPreviewOn] = useState(true);
  const isMob = typeof window !== 'undefined' && window.innerWidth < 768;
  const previewW = isMob ? Math.min(window.innerWidth - 40, 480) : 480;
  const cardSlotW = previewW + 40;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(Math.min(currentIdx + 1, cards.length - 1));
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(Math.max(currentIdx - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, currentIdx, cards.length]);

  const goTo = (idx) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ left: idx * cardSlotW, behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollLeft / cardSlotW);
    setCurrentIdx(Math.max(0, Math.min(idx, cards.length - 1)));
  };

  return React.createElement("div", {
    onClick: (e) => { if (e.target === e.currentTarget) onClose(); },
    style: { position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }
  },
    // Top bar: title + toggle + close
    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', width: '100%', maxWidth: cardSlotW + 120, justifyContent: 'space-between' } },
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10 } },
        React.createElement("span", { style: { color: '#fff', fontSize: 15, fontWeight: 600 } }, "\uBBF8\uB9AC\uBCF4\uAE30"),
        React.createElement("span", { style: { fontSize: 12, color: 'rgba(255,255,255,0.45)' } }, (currentIdx + 1) + " / " + cards.length),
      ),
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10 } },
        // Video preview toggle
        React.createElement("div", {
          onClick: () => setVideoPreviewOn(!videoPreviewOn),
          style: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.08)' }
        },
          React.createElement("div", {
            style: { width: 28, height: 14, borderRadius: 7, background: videoPreviewOn ? T.accent : 'rgba(255,255,255,0.2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 },
          },
            React.createElement("div", { style: { width: 10, height: 10, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: videoPreviewOn ? 16 : 2, transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' } })
          ),
          React.createElement("span", { style: { fontSize: 11, color: videoPreviewOn ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: 500, userSelect: 'none' } }, "\uC601\uC0C1 \uBBF8\uB9AC\uBCF4\uAE30"),
        ),
        // Mute toggle
        videoPreviewOn && onMuteToggle && React.createElement("div", {
          onClick: onMuteToggle,
          style: { width: 32, height: 32, borderRadius: '50%', background: previewMuted ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' },
        },
          React.createElement("span", { style: { fontSize: 15, lineHeight: 1 } }, previewMuted ? "\uD83D\uDD07" : "\uD83D\uDD0A")
        ),
        // Close
        React.createElement("button", {
          onClick: onClose,
          style: { width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' },
          onMouseEnter: (e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)',
          onMouseLeave: (e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)',
        }, "\u2715"),
      ),
    ),

    // Disclaimer (only when video preview is on)
    videoPreviewOn && React.createElement("div", { style: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '0 16px 8px' } },
      "\uC601\uC0C1 \uC81C\uBAA9\xB7\uAD11\uACE0 \uD45C\uC2DC \uB4F1\uC774 \uBCF4\uC77C \uC218 \uC788\uC9C0\uB9CC, \uC2E4\uC81C \uCE74\uB4DC\uC5D0\uB294 \uD3EC\uD568\uB418\uC9C0 \uC54A\uC544\uC694"
    ),

    // Scroll area
    React.createElement("div", {
      ref: scrollRef,
      onScroll: handleScroll,
      style: { display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none', width: cardSlotW, maxWidth: '100vw' }
    },
      cards.map((card, i) =>
        React.createElement("div", {
          key: i,
          style: { flex: '0 0 ' + cardSlotW + 'px', width: cardSlotW, display: 'flex', justifyContent: 'center', alignItems: 'center', scrollSnapAlign: 'center', padding: '0 20px' }
        },
          React.createElement("div", { style: { borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' } },
            React.createElement(CardPreview, { card: pvCard(card), globalUrl, aspectRatio, globalBgImage, previewWidth: previewW, videoPreviewOn: videoPreviewOn && i === currentIdx })
          )
        )
      )
    ),

    // Bottom: dots + nav arrows
    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px' } },
      // Left arrow
      React.createElement("button", {
        onClick: () => goTo(Math.max(currentIdx - 1, 0)),
        disabled: currentIdx === 0,
        style: { width: 36, height: 36, borderRadius: '50%', background: currentIdx === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)', border: 'none', color: currentIdx === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.8)', fontSize: 16, cursor: currentIdx === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }
      }, "\u25C0"),
      // Dots
      React.createElement("div", { style: { display: 'flex', gap: 6, alignItems: 'center' } },
        cards.map((_, i) =>
          React.createElement("div", {
            key: i,
            onClick: () => goTo(i),
            style: { width: i === currentIdx ? 18 : 7, height: 7, borderRadius: 4, background: i === currentIdx ? T.accent : 'rgba(255,255,255,0.25)', cursor: 'pointer', transition: 'all 0.25s' }
          })
        )
      ),
      // Right arrow
      React.createElement("button", {
        onClick: () => goTo(Math.min(currentIdx + 1, cards.length - 1)),
        disabled: currentIdx === cards.length - 1,
        style: { width: 36, height: 36, borderRadius: '50%', background: currentIdx === cards.length - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)', border: 'none', color: currentIdx === cards.length - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.8)', fontSize: 16, cursor: currentIdx === cards.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }
      }, "\u25B6"),
      // Generate button
      onGenerate && React.createElement("button", {
        onClick: () => { onClose(); onGenerate(); },
        disabled: generating,
        style: { marginLeft: 8, padding: '8px 20px', background: generating ? T.surfaceHover : T.success, color: generating ? T.textMuted : '#fff', borderRadius: T.radiusPill, border: 'none', fontSize: 13, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: generating ? 'none' : '0 2px 8px rgba(34,197,94,0.3)' }
      }, generating ? "\uC0DD\uC131 \uC911..." : "\u2728 \uC0DD\uC131\uD558\uAE30"),
    ),
  );
}

function GeneratingModal({ mob, generating, genProgress, results, downloading, onDownloadAll, onClose }) {
  const pctMatch = genProgress && genProgress.match(/(\d+)%/);
  const pct = pctMatch ? parseInt(pctMatch[1], 10) : (generating ? 0 : (results.length > 0 ? 100 : 0));
  const done = !generating && (results.length > 0 || (genProgress && genProgress.includes('\uC644\uB8CC')));

  return React.createElement("div", {
    style: { position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
  },
    React.createElement("div", {
      style: { maxWidth: 400, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }
    },
      // Close / cancel button (always visible)
      React.createElement("button", {
        onClick: onClose,
        style: { alignSelf: 'flex-end', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' },
        onMouseEnter: (e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)',
        onMouseLeave: (e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)',
        title: generating ? '\uC911\uB2E8' : '\uB2EB\uAE30',
      }, "\u2715"),

      // Ad placeholder (app intro with real logo)
      React.createElement("div", {
        style: { width: 300, height: 250, borderRadius: 12, background: 'linear-gradient(135deg, #1e1b4b, #312e81)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, position: 'relative', overflow: 'hidden' }
      },
        // Decorative circles
        React.createElement("div", { style: { position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(99,102,241,0.15)' } }),
        React.createElement("div", { style: { position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(139,92,246,0.12)' } }),
        // App logo (icon-round.png)
        React.createElement("img", { src: "/icon-round.png", style: { width: 64, height: 64, borderRadius: 16, boxShadow: '0 4px 20px rgba(99,102,241,0.4)', position: 'relative', zIndex: 1 } }),
        // Font logo
        React.createElement("div", { style: { fontFamily: "'Bitcount Prop Single', monospace", fontSize: 28, color: '#fff', letterSpacing: '0.06em', position: 'relative', zIndex: 1 } }, "YOUMECA"),
        // Sub copy
        React.createElement("div", { style: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 400, position: 'relative', zIndex: 1, textAlign: 'center', lineHeight: 1.5 } }, "\uB0B4\uAC00 \uAFC8\uAFB8\uB358 \uCE74\uB4DC\uB274\uC2A4 \uC0DD\uC131\uAE30"),
        // Sponsored label
        React.createElement("div", { style: { position: 'absolute', bottom: 6, right: 10, fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em' } }, "Ad"),
      ),

      // Progress area
      React.createElement("div", { style: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10 } },
        // Progress bar
        React.createElement("div", { style: { width: '100%', height: 6, borderRadius: 3, background: T.border, overflow: 'hidden' } },
          React.createElement("div", {
            style: { height: '100%', borderRadius: 3, background: done ? T.success : T.accent, width: pct + '%', transition: 'width 0.4s ease, background 0.3s' }
          })
        ),
        // Status text with spinner
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' } },
          generating && React.createElement("div", { style: { width: 14, height: 14, border: '2px solid ' + T.accent, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 } }),
          React.createElement("span", { style: { fontSize: 13, color: done ? T.success : generating ? T.accent : T.textSecondary, fontWeight: 500 } }, genProgress || "\uC900\uBE44 \uC911..."),
        ),
      ),

      // Download buttons (when done)
      done && results.length > 0 && React.createElement("div", { style: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10 } },
        React.createElement("div", { style: { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' } },
          results.map((url, i) => {
            const handleShare = async (e) => {
              if (mob && navigator.share) {
                e.preventDefault();
                try {
                  const res = await fetch(url);
                  const blob = await res.blob();
                  const ext = url.split('.').pop()?.split('?')[0] || 'mp4';
                  const mime = ext === 'mp4' ? 'video/mp4' : ext === 'png' ? 'image/png' : 'image/jpeg';
                  const file = new File([blob], `card-${i + 1}.${ext}`, { type: mime });
                  await navigator.share({ files: [file] });
                } catch (err) {
                  if (err.name !== 'AbortError') window.open(url, '_blank');
                }
              }
            };
            return React.createElement("a", {
              key: i, href: url, download: true,
              onClick: handleShare,
              style: { padding: '8px 18px', background: T.accent, color: '#fff', borderRadius: T.radiusPill, fontSize: 13, textDecoration: 'none', fontWeight: 500, transition: 'opacity 0.15s', cursor: 'pointer' },
              onMouseEnter: (e) => e.currentTarget.style.opacity = '0.85',
              onMouseLeave: (e) => e.currentTarget.style.opacity = '1',
            }, "\uCE74\uB4DC " + (i + 1));
          }),
        ),
        results.length > 1 && React.createElement("button", {
          onClick: onDownloadAll, disabled: downloading,
          style: { width: '100%', padding: '10px 0', background: T.success, color: '#fff', borderRadius: T.radiusPill, border: 'none', fontSize: 14, fontWeight: 600, cursor: downloading ? 'not-allowed' : 'pointer', transition: 'all 0.15s', boxShadow: '0 2px 8px rgba(34,197,94,0.3)', opacity: downloading ? 0.7 : 1 }
        }, downloading ? "\uC555\uCD95 \uC911..." : "\uD55C \uBC88\uC5D0 \uB2E4\uC6B4\uB85C\uB4DC"),
      ),
    ),
  );
}

function JsonModal({ json, onClose }) {
  const textRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { textRef.current?.select(); navigator.clipboard.writeText(json).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  return React.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: 'blur(4px)', display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 } },
    React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, maxWidth: 640, width: "100%", boxShadow: T.shadowLg } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${T.border}` } },
        React.createElement("h3", { style: { fontWeight: 600, fontSize: 15 } }, "JSON 내보내기"),
        React.createElement("button", { onClick: onClose, style: { background: "none", border: "none", color: T.textMuted, fontSize: 20, cursor: "pointer" } }, "\u2715")
      ),
      React.createElement("div", { style: { padding: 20 } },
        React.createElement("textarea", { ref: textRef, readOnly: true, value: json, style: { width: "100%", height: 300, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: 16, fontSize: 13, color: "#4ade80", fontFamily: "monospace", outline: "none", resize: "none" } })
      ),
      React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 20px", borderTop: `1px solid ${T.border}` } },
        React.createElement("button", { onClick: handleCopy, style: { padding: "8px 20px", background: T.accent, color: "#fff", borderRadius: T.radiusPill, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer" } }, copied ? "복사됨!" : "클립보드 복사"),
        React.createElement("button", { onClick: onClose, style: { padding: "8px 20px", background: 'rgba(255,255,255,0.06)', color: T.textSecondary, borderRadius: T.radiusPill, border: "none", fontSize: 13, cursor: "pointer" } }, "닫기")
      )
    )
  );
}

/* ── Project Helpers ── */
const STORAGE_KEY = 'yt2c_projects';
const DEFAULT_PROJECT = (name = '새 프로젝트') => ({
  id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
  name,
  globalUrl: '',
  outputFormat: 'video',
  outputSize: 1080,
  aspectRatio: '1:1',
  globalImageSource: 'thumbnail',
  globalBgImage: null,
  cards: [DEFAULT_CARD()],
});

function loadProjects() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.projects?.length > 0) return data;
    }
  } catch (e) {}
  return null;
}

function saveProjects(projects, activeId) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects, activeId })); } catch (e) {}
}

/* ── Project Share Helpers ── */
const CARD_DEFAULTS = DEFAULT_CARD();
const SKIP_CARD_KEYS = new Set(['id', 'uploadedImage']);

function stripDefaults(obj, defaults) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (SKIP_CARD_KEYS.has(k)) continue;
    if (k === 'overlays') {
      if (obj.overlays?.length > 0) {
        out.overlays = obj.overlays.map(o => {
          const oc = { ...o };
          delete oc.imageData;
          return oc;
        });
      }
      continue;
    }
    if (obj[k] !== defaults[k]) out[k] = obj[k];
  }
  return out;
}

function restoreDefaults(obj) {
  return { ...DEFAULT_CARD(), ...obj };
}

const PROJ_DEFAULTS = { outputFormat: 'video', outputSize: 1080, aspectRatio: '1:1', globalImageSource: 'thumbnail' };

function encodeProject(project) {
  const s = { n: project.name, u: project.globalUrl };
  if (project.outputFormat !== PROJ_DEFAULTS.outputFormat) s.f = project.outputFormat;
  if (project.outputSize !== PROJ_DEFAULTS.outputSize) s.s = project.outputSize;
  if (project.aspectRatio !== PROJ_DEFAULTS.aspectRatio) s.a = project.aspectRatio;
  if (project.globalImageSource !== PROJ_DEFAULTS.globalImageSource) s.i = project.globalImageSource;
  s.c = (project.cards || []).map(c => stripDefaults(c, CARD_DEFAULTS));
  return LZString.compressToEncodedURIComponent(JSON.stringify(s));
}

function decodeProject(encoded) {
  const json = LZString.decompressFromEncodedURIComponent(encoded);
  if (!json) return null;
  const s = JSON.parse(json);
  return {
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name: s.n || '\uC0C8 \uD504\uB85C\uC81D\uD2B8',
    globalUrl: s.u || '',
    outputFormat: s.f || PROJ_DEFAULTS.outputFormat,
    outputSize: s.s || PROJ_DEFAULTS.outputSize,
    aspectRatio: s.a || PROJ_DEFAULTS.aspectRatio,
    globalImageSource: s.i || PROJ_DEFAULTS.globalImageSource,
    globalBgImage: null,
    cards: (s.c || []).map(c => restoreDefaults(c)),
  };
}

/* ── Download All as ZIP ── */
async function downloadAllAsZip(urls, outputFormat) {
  const zip = new JSZip();
  const ext = outputFormat === 'video' ? 'mp4' : 'jpg';
  for (let i = 0; i < urls.length; i++) {
    const res = await fetch(urls[i]);
    if (!res.ok) continue;
    const blob = await res.blob();
    zip.file(`card_${i + 1}.${ext}`, blob);
  }
  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = `youmeca_cards_${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── Confirm Dialog ── */
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return React.createElement("div", { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 } },
    React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, padding: 28, maxWidth: 380, width: '90%', boxShadow: T.shadowLg, textAlign: 'center' } },
      React.createElement("p", { style: { color: T.text, fontSize: 15, lineHeight: 1.6, marginBottom: 24, whiteSpace: 'pre-line' } }, message),
      React.createElement("div", { style: { display: 'flex', gap: 10, justifyContent: 'center' } },
        React.createElement("button", { onClick: onCancel, style: { padding: '9px 24px', background: 'rgba(255,255,255,0.06)', color: T.textSecondary, borderRadius: T.radiusPill, border: 'none', fontSize: 13, cursor: 'pointer' } }, "취소"),
        React.createElement("button", { onClick: onConfirm, style: { padding: '9px 24px', background: T.danger, color: '#fff', borderRadius: T.radiusPill, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' } }, "닫기"),
      )
    )
  );
}

/* ── Project Selector Modal (mobile) ── */
function ProjectSelectorModal({ projects, activeId, onSwitch, onAdd, onClose, onRename, onDismiss }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { if (editingId && inputRef.current) inputRef.current.focus(); }, [editingId]);
  const startRename = (proj) => { setEditingId(proj.id); setEditName(proj.name); };
  const commitRename = () => {
    if (editingId && editName.trim()) onRename(editingId, editName.trim());
    setEditingId(null);
  };
  return React.createElement("div", {
    onClick: (e) => { if (e.target === e.currentTarget) onDismiss(); },
    style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }
  },
    React.createElement("div", { style: { background: T.surface, borderRadius: '16px 16px 0 0', width: '100%', maxHeight: '60vh', display: 'flex', flexDirection: 'column', boxShadow: T.shadowLg } },
      // Header
      React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${T.border}` } },
        React.createElement("span", { style: { fontSize: 15, fontWeight: 600, color: T.text } }, "\uD504\uB85C\uC81D\uD2B8 \uC120\uD0DD"),
        React.createElement("button", { onClick: onDismiss, style: { background: 'none', border: 'none', color: T.textMuted, fontSize: 20, cursor: 'pointer' } }, "\u2715"),
      ),
      // List
      React.createElement("div", { style: { flex: 1, overflowY: 'auto', padding: '8px 12px' } },
        projects.map(proj => {
          const isActive = proj.id === activeId;
          const isEditing = proj.id === editingId;
          return React.createElement("div", {
            key: proj.id,
            onClick: () => { if (!isEditing) { onSwitch(proj.id); onDismiss(); } },
            style: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: T.radiusSm, cursor: 'pointer', background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent', marginBottom: 4, transition: 'background 0.15s' }
          },
            React.createElement("div", { style: { width: 8, height: 8, borderRadius: '50%', background: isActive ? T.accent : 'transparent', flexShrink: 0 } }),
            isEditing
              ? React.createElement("input", {
                  ref: inputRef, value: editName,
                  onChange: (e) => setEditName(e.target.value),
                  onBlur: commitRename,
                  onKeyDown: (e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); },
                  onClick: (e) => e.stopPropagation(),
                  style: { flex: 1, background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontWeight: 500, outline: 'none', padding: '4px 8px', borderRadius: T.radiusSm },
                })
              : React.createElement("span", { style: { flex: 1, fontSize: 14, fontWeight: isActive ? 600 : 400, color: isActive ? T.text : T.textSecondary } }, proj.name),
            React.createElement("button", {
              onClick: (e) => { e.stopPropagation(); startRename(proj); },
              style: { background: 'none', border: 'none', color: T.textMuted, fontSize: 14, cursor: 'pointer', padding: '4px 6px' },
            }, "\u270E"),
            projects.length > 1 && React.createElement("button", {
              onClick: (e) => { e.stopPropagation(); onClose(proj.id); },
              style: { background: 'none', border: 'none', color: T.danger, fontSize: 16, cursor: 'pointer', padding: '4px 6px', opacity: 0.7 },
            }, "\u00D7"),
          );
        }),
      ),
      // Add button
      React.createElement("div", { style: { padding: '12px 16px', borderTop: `1px solid ${T.border}` } },
        React.createElement("button", {
          onClick: () => { onAdd(); },
          style: { width: '100%', padding: '10px', background: 'rgba(99,102,241,0.1)', color: T.accent, border: `1px solid rgba(99,102,241,0.2)`, borderRadius: T.radiusSm, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
        }, "+ \uC0C8 \uD504\uB85C\uC81D\uD2B8"),
      ),
    ),
  );
}

/* ── Global Settings Modal (mobile) ── */
function GlobalSettingsModal({ globalUrl, setGlobalUrl, aspectRatio, setAspectRatio, outputFormat, setOutputFormat, outputSize, setOutputSize, globalBgImage, setGlobalBgImage, onDismiss }) {
  return React.createElement("div", {
    onClick: (e) => { if (e.target === e.currentTarget) onDismiss(); },
    style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }
  },
    React.createElement("div", { style: { background: T.surface, borderRadius: '16px 16px 0 0', width: '100%', maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: T.shadowLg } },
      // Header
      React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${T.border}` } },
        React.createElement("span", { style: { fontSize: 15, fontWeight: 600, color: T.text } }, "\uACF5\uD1B5 \uC124\uC815"),
        React.createElement("button", { onClick: onDismiss, style: { background: 'none', border: 'none', color: T.textMuted, fontSize: 20, cursor: 'pointer' } }, "\u2715"),
      ),
      // Content
      React.createElement("div", { style: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 } },
        // URL
        React.createElement("div", null,
          React.createElement("label", { style: labelBase }, "YouTube URL"),
          React.createElement("input", { type: "text", value: globalUrl, placeholder: "https://youtube.com/watch?v=...", onChange: (e) => setGlobalUrl(e.target.value), style: { ...inputBase, padding: '8px 12px', fontSize: 14 } }),
        ),
        // Aspect ratio
        React.createElement("div", null,
          React.createElement("label", { style: labelBase }, "\uBE44\uC728"),
          React.createElement("div", { style: { display: 'flex', gap: 8 } },
            ASPECT_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: aspectRatio === opt.id, onClick: () => setAspectRatio(opt.id) }, opt.label)),
          ),
        ),
        // Format
        React.createElement("div", null,
          React.createElement("label", { style: labelBase }, "\uD615\uC2DD"),
          React.createElement("div", { style: { display: 'flex', gap: 8 } },
            React.createElement(PillBtn, { active: outputFormat === "video", onClick: () => setOutputFormat("video") }, "\uC601\uC0C1"),
            React.createElement(PillBtn, { active: outputFormat === "image", onClick: () => setOutputFormat("image") }, "\uC774\uBBF8\uC9C0"),
          ),
        ),
        // Resolution
        React.createElement("div", null,
          React.createElement("label", { style: labelBase }, "\uD574\uC0C1\uB3C4"),
          React.createElement("div", { style: { display: 'flex', gap: 8 } },
            React.createElement(PillBtn, { active: outputSize === 720, onClick: () => setOutputSize(720) }, "720p"),
            React.createElement(PillBtn, { active: outputSize === 1080, onClick: () => setOutputSize(1080) }, "1080p"),
          ),
        ),
        // Global image (when outputFormat === 'image')
        outputFormat === 'image' && React.createElement("div", null,
          React.createElement("label", { style: labelBase }, "\uACF5\uD1B5 \uC774\uBBF8\uC9C0"),
          globalBgImage
            ? React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                React.createElement("img", { src: globalBgImage, style: { width: 40, height: 40, borderRadius: 6, objectFit: 'cover' } }),
                React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, "\uC801\uC6A9 \uC911"),
                React.createElement("button", { onClick: () => setGlobalBgImage(null), style: { background: 'none', border: 'none', color: T.danger, fontSize: 11, cursor: 'pointer', textDecoration: 'underline' } }, "\uC0AD\uC81C"),
              )
            : React.createElement(ImageUploadField, { value: globalBgImage, onChange: setGlobalBgImage, maxMb: 5 }),
        ),
      ),
      // Done button
      React.createElement("div", { style: { padding: '12px 20px', borderTop: `1px solid ${T.border}` } },
        React.createElement("button", {
          onClick: onDismiss,
          style: { width: '100%', padding: '10px', background: T.accent, color: '#fff', border: 'none', borderRadius: T.radiusSm, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
        }, "\uC644\uB8CC"),
      ),
    ),
  );
}

/* ── Share Modal ── */
function ShareModal({ url, onClose }) {
  const inputRef = React.useRef(null);
  const copyLink = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(url);
    else if (inputRef.current) { inputRef.current.select(); document.execCommand('copy'); }
  };
  return React.createElement("div", { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }, onClick: onClose },
    React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, padding: 28, maxWidth: 440, width: '90%', boxShadow: T.shadowLg }, onClick: e => e.stopPropagation() },
      React.createElement("h3", { style: { color: T.text, fontSize: 16, fontWeight: 600, marginBottom: 16, textAlign: 'center' } }, "\uACF5\uC720 \uB9C1\uD06C\uAC00 \uBCF5\uC0AC\uB418\uC5C8\uC5B4\uC694"),
      React.createElement("div", { style: { display: 'flex', gap: 8, marginBottom: 16 } },
        React.createElement("input", { ref: inputRef, readOnly: true, value: url, style: { flex: 1, padding: '8px 12px', background: T.surfaceHover, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, outline: 'none', minWidth: 0 } }),
        React.createElement("button", { onClick: copyLink, style: { padding: '8px 14px', background: T.accent, color: '#fff', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' } }, "\uBCF5\uC0AC"),
      ),
      React.createElement("p", { style: { color: T.textSecondary, fontSize: 12, lineHeight: 1.6, textAlign: 'center', marginBottom: 20 } },
        "\uC774 \uB9C1\uD06C\uB97C \uBC1B\uC740 \uC0AC\uB78C\uC740 \uD504\uB85C\uC81D\uD2B8\uB97C \uC790\uC2E0\uC758 \uD3B8\uC9D1 \uD654\uBA74\uC73C\uB85C \uAC00\uC838\uC62C \uC218 \uC788\uC5B4\uC694.\n\uC2E4\uC2DC\uAC04 \uACF5\uB3D9\uD3B8\uC9D1\uC740 \uC9C0\uC6D0\uB418\uC9C0 \uC54A\uC73C\uBA70, \uAC01\uC790 \uB3C5\uB9BD\uC801\uC73C\uB85C \uD3B8\uC9D1\uB429\uB2C8\uB2E4."
      ),
      React.createElement("div", { style: { textAlign: 'center' } },
        React.createElement("button", { onClick: onClose, style: { padding: '9px 24px', background: 'rgba(255,255,255,0.06)', color: T.textSecondary, borderRadius: T.radiusPill, border: 'none', fontSize: 13, cursor: 'pointer' } }, "\uB2EB\uAE30"),
      )
    )
  );
}

/* ── Import Dialog ── */
function ImportDialog({ project, onImport, onCancel }) {
  return React.createElement("div", { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 } },
    React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, padding: 28, maxWidth: 400, width: '90%', boxShadow: T.shadowLg, textAlign: 'center' } },
      React.createElement("h3", { style: { color: T.text, fontSize: 16, fontWeight: 600, marginBottom: 8 } }, "\uACF5\uC720\uB41C \uD504\uB85C\uC81D\uD2B8"),
      React.createElement("p", { style: { color: T.accent, fontSize: 14, fontWeight: 500, marginBottom: 4 } }, project.name || '\uC0C8 \uD504\uB85C\uC81D\uD2B8'),
      React.createElement("p", { style: { color: T.textMuted, fontSize: 12, marginBottom: 16 } }, `\uCE74\uB4DC ${(project.cards || []).length}\uAC1C`),
      React.createElement("p", { style: { color: T.textSecondary, fontSize: 12, lineHeight: 1.6, marginBottom: 24 } },
        "\uC774 \uD504\uB85C\uC81D\uD2B8\uB97C \uAC00\uC838\uC624\uBA74 \uB0B4 \uD3B8\uC9D1 \uD654\uBA74\uC5D0 \uC0C8 \uD0ED\uC73C\uB85C \uCD94\uAC00\uB429\uB2C8\uB2E4.\n\uC6D0\uBCF8\uACFC\uB294 \uBCC4\uAC1C\uB85C, \uC790\uC720\uB86D\uAC8C \uC218\uC815\uD560 \uC218 \uC788\uC5B4\uC694."
      ),
      React.createElement("div", { style: { display: 'flex', gap: 10, justifyContent: 'center' } },
        React.createElement("button", { onClick: onCancel, style: { padding: '9px 24px', background: 'rgba(255,255,255,0.06)', color: T.textSecondary, borderRadius: T.radiusPill, border: 'none', fontSize: 13, cursor: 'pointer' } }, "\uCDE8\uC18C"),
        React.createElement("button", { onClick: onImport, style: { padding: '9px 24px', background: T.accent, color: '#fff', borderRadius: T.radiusPill, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' } }, "\uAC00\uC838\uC624\uAE30"),
      )
    )
  );
}

/* ── Style Preset Thumbnail ── */
function StylePresetThumb({ preset }) {
  const w = 80, h = 80;
  const bg = preset.bgColor || '#121212';
  const tc = preset.titleColor || '#fff';
  const sc = preset.subtitleColor || '#aaa';
  const layouts = {
    photo_top: [
      React.createElement("rect", { key: "img", x: 4, y: 4, width: w - 8, height: (h - 8) * 0.45, rx: 3, fill: '#555' }),
      React.createElement("rect", { key: "t", x: 8, y: h * 0.52, width: w * 0.6, height: 5, rx: 2, fill: tc }),
      React.createElement("rect", { key: "s", x: 8, y: h * 0.62, width: w * 0.45, height: 4, rx: 2, fill: sc }),
      React.createElement("rect", { key: "b", x: 8, y: h * 0.72, width: w * 0.55, height: 3, rx: 1, fill: sc, opacity: 0.6 }),
    ],
    photo_bottom: [
      React.createElement("rect", { key: "t", x: 8, y: 8, width: w * 0.6, height: 5, rx: 2, fill: tc }),
      React.createElement("rect", { key: "s", x: 8, y: 18, width: w * 0.45, height: 4, rx: 2, fill: sc }),
      React.createElement("rect", { key: "img", x: 4, y: h * 0.45, width: w - 8, height: (h - 8) * 0.5, rx: 3, fill: '#555' }),
    ],
    full_bg: [
      React.createElement("rect", { key: "bg2", x: 0, y: 0, width: w, height: h, rx: 6, fill: '#555', opacity: 0.3 }),
      React.createElement("rect", { key: "t", x: 10, y: h * 0.35, width: w * 0.65, height: 6, rx: 2, fill: tc }),
      React.createElement("rect", { key: "s", x: 10, y: h * 0.5, width: w * 0.5, height: 4, rx: 2, fill: sc }),
      React.createElement("rect", { key: "b", x: 10, y: h * 0.62, width: w * 0.55, height: 3, rx: 1, fill: sc, opacity: 0.6 }),
    ],
    text_box: [
      React.createElement("rect", { key: "bg2", x: 0, y: 0, width: w, height: h, rx: 6, fill: '#555', opacity: 0.25 }),
      React.createElement("rect", { key: "box", x: 10, y: h * 0.25, width: w - 20, height: h * 0.5, rx: 6, fill: 'rgba(0,0,0,0.5)', stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }),
      React.createElement("rect", { key: "t", x: 16, y: h * 0.38, width: w * 0.5, height: 5, rx: 2, fill: tc }),
      React.createElement("rect", { key: "s", x: 16, y: h * 0.52, width: w * 0.35, height: 4, rx: 2, fill: sc }),
    ],
    none: [
      React.createElement("rect", { key: "t", x: w * 0.15, y: h * 0.3, width: w * 0.7, height: 6, rx: 2, fill: tc }),
      React.createElement("rect", { key: "s", x: w * 0.2, y: h * 0.45, width: w * 0.6, height: 4, rx: 2, fill: sc }),
      React.createElement("rect", { key: "b", x: w * 0.22, y: h * 0.58, width: w * 0.56, height: 3, rx: 1, fill: sc, opacity: 0.6 }),
    ],
  };
  const content = layouts[preset.layout] || layouts.full_bg;
  return React.createElement("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, style: { borderRadius: 8, overflow: 'hidden', display: 'block' } },
    React.createElement("rect", { width: w, height: h, fill: bg, rx: 6 }),
    preset.useGradient && React.createElement("defs", null,
      React.createElement("linearGradient", { id: `g_${preset.id}`, x1: 0, y1: 0, x2: 0, y2: 1 },
        React.createElement("stop", { offset: "0%", stopColor: "transparent" }),
        React.createElement("stop", { offset: "100%", stopColor: bg }),
      ),
    ),
    preset.useGradient && React.createElement("rect", { width: w, height: h, fill: `url(#g_${preset.id})`, rx: 6 }),
    ...content
  );
}

/* ── Mode Selection Screen ── */
function ModeSelectionScreen({ mob, onSelectEasy, onSelectFree }) {
  const [hovered, setHovered] = useState(null);
  const cardBase = {
    flex: 1, minWidth: mob ? 'auto' : 280, maxWidth: mob ? 'none' : 420,
    background: T.surface, borderRadius: mob ? 12 : 16, padding: mob ? 16 : 32,
    border: `1.5px solid ${T.border}`, cursor: 'pointer',
    transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', gap: mob ? 8 : 16,
  };
  const flowSteps = [
    { icon: "\uD83D\uDD17", label: "\uB9C1\uD06C \uC785\uB825" },
    { icon: "\u2728", label: "\uC2A4\uD0C0\uC77C \uC120\uD0DD" },
    { icon: "\uD83D\uDCF1", label: "\uCE74\uB4DC\uB274\uC2A4 \uC644\uC131" },
  ];
  return React.createElement("div", { style: { position: 'fixed', inset: 0, zIndex: 200, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: mob ? '24px 20px' : 40, overflowY: 'auto' } },
    React.createElement("style", null, `
      @keyframes modeStepIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes modeArrowPulse { 0%,100% { opacity: 0.4; transform: translateX(0); } 50% { opacity: 1; transform: translateX(3px); } }
    `),
    React.createElement("div", { style: { textAlign: 'center', marginBottom: mob ? 16 : 32 } },
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: mob ? 8 : 12 } },
        React.createElement("img", { src: "/icon-round.png", style: { width: mob ? 30 : 36, height: mob ? 30 : 36, borderRadius: 8 } }),
        React.createElement("span", { style: { fontFamily: "'Bitcount Prop Single', monospace", fontSize: mob ? 22 : 26, color: T.text, letterSpacing: '0.05em' } }, "YOUMECA"),
      ),
      React.createElement("h1", { style: { fontSize: mob ? 17 : 26, fontWeight: 700, color: T.text, margin: 0, marginBottom: 4 } }, "\uC720\uBA54\uCE74, \uB0B4\uAC00 \uAFC8\uAFB8\uB358 \uCE74\uB4DC\uB274\uC2A4 \uC0DD\uC131\uAE30"),
      React.createElement("p", { style: { fontSize: mob ? 12 : 15, color: T.textSecondary, margin: 0 } }, "\uC720\uD29C\uBE0C \uC601\uC0C1\uC744 \uC27D\uAC8C \uCE74\uB4DC\uB274\uC2A4\uB85C \uB9CC\uB4E4\uC5B4\uBCF4\uC138\uC694"),
    ),
    // 3-step flow
    React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: mob ? 6 : 16, marginBottom: mob ? 16 : 36 } },
      flowSteps.map((s, i) => React.createElement(React.Fragment, { key: i },
        React.createElement("div", {
          style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, animation: `modeStepIn 0.5s ease ${i * 0.3}s both` },
        },
          React.createElement("div", { style: { width: mob ? 36 : 52, height: mob ? 36 : 52, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', border: `1.5px solid rgba(99,102,241,0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: mob ? 16 : 24 } }, s.icon),
          React.createElement("span", { style: { fontSize: mob ? 10 : 12, color: T.textSecondary, fontWeight: 500, whiteSpace: 'nowrap' } }, s.label),
        ),
        i < 2 && React.createElement("span", {
          style: { fontSize: mob ? 12 : 18, color: T.accent, marginBottom: mob ? 14 : 20, animation: `modeStepIn 0.5s ease ${i * 0.3 + 0.15}s both, modeArrowPulse 2s ease-in-out ${1.2 + i * 0.3}s infinite` },
        }, "\u203A"),
      )),
    ),
    React.createElement("div", { style: { display: 'flex', flexDirection: mob ? 'column' : 'row', gap: mob ? 10 : 24, width: '100%', maxWidth: 860, justifyContent: 'center' } },
      // Easy mode card
      React.createElement("div", {
        onClick: onSelectEasy,
        onMouseEnter: () => setHovered('easy'), onMouseLeave: () => setHovered(null),
        style: {
          ...cardBase,
          background: hovered === 'easy'
            ? 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 40%, #7c3aed 100%)'
            : 'linear-gradient(135deg, #3b0764 0%, #5b21b6 40%, #6d28d9 100%)',
          borderColor: hovered === 'easy' ? '#a78bfa' : 'rgba(139,92,246,0.3)',
          boxShadow: hovered === 'easy' ? '0 8px 32px rgba(109,40,217,0.4)' : '0 4px 20px rgba(109,40,217,0.2)',
        },
      },
        React.createElement("div", { style: { fontSize: mob ? 24 : 32 } }, "\u2728"),
        React.createElement("div", null,
          React.createElement("h2", { style: { fontSize: mob ? 16 : 20, fontWeight: 700, color: '#fff', margin: 0, marginBottom: mob ? 4 : 8 } }, "\uC26C\uC6B4\uD3B8\uC9D1"),
          React.createElement("p", { style: { fontSize: mob ? 12 : 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, margin: 0 } }, "YouTube URL\uACFC \uC2A4\uD0C0\uC77C\uB9CC \uACE0\uB974\uBA74 \uCE74\uB4DC\uB274\uC2A4 \uCD08\uC548\uC744 \uB9CC\uB4E4\uC5B4 \uB4DC\uB824\uC694."),
        ),
        React.createElement("div", { style: { marginTop: 'auto', paddingTop: mob ? 4 : 8 } },
          React.createElement("span", { style: { fontSize: mob ? 13 : 14, fontWeight: 600, color: '#e9d5ff' } }, "\uC2DC\uC791\uD558\uAE30 \u2192"),
        ),
      ),
      // Free mode card
      React.createElement("div", {
        onClick: onSelectFree,
        onMouseEnter: () => setHovered('free'), onMouseLeave: () => setHovered(null),
        style: { ...cardBase, borderColor: hovered === 'free' ? T.accent : T.border, background: hovered === 'free' ? 'rgba(99,102,241,0.06)' : T.surface },
      },
        React.createElement("div", { style: { fontSize: mob ? 24 : 32 } }, "\uD83C\uDFA8"),
        React.createElement("div", null,
          React.createElement("h2", { style: { fontSize: mob ? 16 : 20, fontWeight: 700, color: T.text, margin: 0, marginBottom: mob ? 4 : 8 } }, "\uC790\uC720\uD3B8\uC9D1"),
          React.createElement("p", { style: { fontSize: mob ? 12 : 14, color: T.textSecondary, lineHeight: 1.5, margin: 0 } }, "\uBE48 \uCE74\uB4DC\uC5D0\uC11C \uC2DC\uC791\uD574 \uB808\uC774\uC544\uC6C3, \uD14D\uC2A4\uD2B8, \uC774\uBBF8\uC9C0 \uB4F1 \uBAA8\uB4E0 \uC124\uC815\uC744 \uC9C1\uC811 \uC870\uC815\uD574\uC694."),
        ),
        React.createElement("div", { style: { marginTop: 'auto', paddingTop: mob ? 4 : 8 } },
          React.createElement("span", { style: { fontSize: mob ? 13 : 14, fontWeight: 600, color: T.accent } }, "\uC2DC\uC791\uD558\uAE30 \u2192"),
        ),
      ),
    ),
  );
}

/* ── Wizard Screen ── */
function WizardScreen({ mob, step, data, onDataChange, onNext, onBack, onComplete, onCancel }) {
  const [presetHover, setPresetHover] = useState(null);
  const update = (k, v) => onDataChange({ ...data, [k]: v });

  const stepIndicator = React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: mob ? 24 : 32 } },
    [1, 2, 3].map(s => React.createElement("div", { key: s, style: {
      width: s === step ? 32 : 10, height: 10, borderRadius: 5,
      background: s === step ? T.accent : s < step ? T.accent : 'rgba(255,255,255,0.15)',
      opacity: s < step ? 0.4 : 1,
      transition: 'all 0.3s ease',
    } })),
  );

  const step1 = React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    // Step title
    React.createElement("div", { style: { textAlign: 'center', marginBottom: 4 } },
      React.createElement("h2", { style: { fontSize: mob ? 20 : 24, fontWeight: 700, color: T.text, margin: 0, marginBottom: 8 } }, "\uC601\uC0C1\uC744 \uC54C\uB824\uC8FC\uC138\uC694"),
      React.createElement("p", { style: { fontSize: 14, color: T.textSecondary, margin: 0 } }, "\uCE74\uB4DC\uB274\uC2A4\uB85C \uB9CC\uB4E4 YouTube \uC601\uC0C1\uC758 \uB9C1\uD06C\uB97C \uBD99\uC5EC\uB123\uC5B4 \uC8FC\uC138\uC694"),
    ),
    React.createElement("div", null,
      React.createElement("label", { style: { ...labelBase, fontSize: 14, marginBottom: 10 } }, "YouTube URL"),
      React.createElement("input", {
        type: "text", placeholder: "\uB9C1\uD06C\uB97C \uBD99\uC5EC\uB123\uC73C\uC138\uC694",
        value: data.url || '', onChange: (e) => update('url', e.target.value),
        style: { ...inputBase, fontSize: 15, padding: '14px 16px' },
        onFocus: (e) => e.target.style.borderColor = T.accent,
        onBlur: (e) => e.target.style.borderColor = T.border,
      }),
    ),
    React.createElement("div", null,
      React.createElement("label", { style: { ...labelBase, fontSize: 14, marginBottom: 10 } }, "\uC644\uC131\uB420 \uCE74\uB4DC \uBE44\uC728"),
      React.createElement("div", { style: { display: 'flex', gap: 10 } },
        ASPECT_OPTIONS.map(opt => React.createElement("button", {
          key: opt.id, onClick: () => update('aspectRatio', opt.id),
          style: {
            flex: 1, padding: '12px 0', borderRadius: T.radiusPill, border: `1.5px solid ${data.aspectRatio === opt.id ? T.accent : T.border}`,
            background: data.aspectRatio === opt.id ? 'rgba(99,102,241,0.15)' : 'transparent',
            color: data.aspectRatio === opt.id ? T.accentHover : T.textSecondary,
            fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          },
        }, opt.label)),
      ),
      React.createElement("p", { style: { fontSize: 12, color: T.textMuted, margin: 0, marginTop: 8 } }, "\uC778\uC2A4\uD0C0 \uD53C\uB4DC\uB294 1:1, \uB9B4\uC2A4\xB7\uC20F\uCE20\uB294 3:4\uAC00 \uC798 \uB9DE\uC544\uC694"),
    ),
  );

  const step2 = React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    // Step title
    React.createElement("div", { style: { textAlign: 'center', marginBottom: 4 } },
      React.createElement("h2", { style: { fontSize: mob ? 20 : 24, fontWeight: 700, color: T.text, margin: 0, marginBottom: 8 } }, "\uC2A4\uD0C0\uC77C\uC744 \uACE8\uB77C\uC8FC\uC138\uC694"),
      React.createElement("p", { style: { fontSize: 14, color: T.textSecondary, margin: 0 } }, "\uB098\uC911\uC5D0 \uD3B8\uC9D1 \uD654\uBA74\uC5D0\uC11C \uC5B8\uC81C\uB4E0 \uBC14\uAFC0 \uC218 \uC788\uC5B4\uC694"),
    ),
    // Card count stepper
    React.createElement("div", null,
      React.createElement("label", { style: { ...labelBase, fontSize: 14, marginBottom: 10 } }, "\uB9CC\uB4E4 \uCE74\uB4DC \uC7A5\uC218"),
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 16 } },
        React.createElement("button", {
          onClick: () => update('cardCount', Math.max(1, (data.cardCount || 3) - 1)),
          style: { width: 40, height: 40, borderRadius: '50%', border: `1.5px solid ${T.border}`, background: 'transparent', color: (data.cardCount || 3) <= 1 ? T.textMuted : T.text, fontSize: 20, cursor: (data.cardCount || 3) <= 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, "\u2212"),
        React.createElement("span", { style: { fontSize: 28, fontWeight: 700, color: T.text, minWidth: 40, textAlign: 'center' } }, data.cardCount || 3),
        React.createElement("button", {
          onClick: () => { if ((data.cardCount || 3) < 8) update('cardCount', (data.cardCount || 3) + 1); },
          style: { width: 40, height: 40, borderRadius: '50%', border: `1.5px solid ${T.border}`, background: 'transparent', color: (data.cardCount || 3) >= 8 ? T.textMuted : T.text, fontSize: 20, cursor: (data.cardCount || 3) >= 8 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, "+"),
      ),
      React.createElement("p", { style: { fontSize: 12, color: T.textMuted, margin: 0, marginTop: 8 } }, "\uD3B8\uC9D1 \uD654\uBA74\uC5D0\uC11C \uC790\uC720\uB86D\uAC8C \uCD94\uAC00\xB7\uC0AD\uC81C\uD560 \uC218 \uC788\uC5B4\uC694"),
    ),
    // Style presets
    React.createElement("div", null,
      React.createElement("label", { style: { ...labelBase, fontSize: 14, marginBottom: 10 } }, "\uBD84\uC704\uAE30"),
      React.createElement("div", { style: { display: 'grid', gridTemplateColumns: mob ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 12 } },
        STYLE_PRESETS.map(p => React.createElement("div", {
          key: p.id,
          onClick: () => update('presetId', p.id),
          onMouseEnter: () => setPresetHover(p.id), onMouseLeave: () => setPresetHover(null),
          style: {
            padding: 12, borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
            border: `1.5px solid ${data.presetId === p.id ? T.accent : presetHover === p.id ? T.borderHover : T.border}`,
            background: data.presetId === p.id ? 'rgba(99,102,241,0.1)' : presetHover === p.id ? 'rgba(255,255,255,0.03)' : 'transparent',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          },
        },
          React.createElement(StylePresetThumb, { preset: p }),
          React.createElement("span", { style: { fontSize: 12, fontWeight: 600, color: data.presetId === p.id ? T.accentHover : T.text } }, p.label),
          React.createElement("span", { style: { fontSize: 11, color: T.textMuted, textAlign: 'center', lineHeight: 1.3 } }, p.desc),
        )),
      ),
    ),
  );

  const cardCount = data.cardCount || 3;
  const segments = Array.from({ length: cardCount }, (_, i) => ({
    start: i * 10, end: (i + 1) * 10,
  }));
  const totalDuration = cardCount * 10;

  const step3 = React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    React.createElement("div", { style: { textAlign: 'center', marginBottom: 4 } },
      React.createElement("h2", { style: { fontSize: mob ? 20 : 24, fontWeight: 700, color: T.text, margin: 0, marginBottom: 8 } }, "\uAD6C\uAC04\uC774 \uC790\uB3D9\uC73C\uB85C \uB098\uB258\uC5C8\uC5B4\uC694"),
      React.createElement("p", { style: { fontSize: 14, color: T.textSecondary, margin: 0 } }, "\uAC01 \uCE74\uB4DC\uC5D0 10\uCD08\uC529 \uADE0\uB4F1\uD558\uAC8C \uBC30\uBD84\uD588\uC5B4\uC694"),
    ),
    // Timeline bar
    React.createElement("div", { style: { background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 16 } },
      React.createElement("div", { style: { display: 'flex', borderRadius: 6, overflow: 'hidden', height: 32, marginBottom: 16 } },
        segments.map((seg, i) => React.createElement("div", { key: i, style: {
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `hsl(${240 + i * (60 / Math.max(cardCount - 1, 1))}, 60%, ${28 + i * 3}%)`,
          borderRight: i < cardCount - 1 ? '1px solid rgba(0,0,0,0.3)' : 'none',
          fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)',
        } }, `${i + 1}`)),
      ),
      // Segment list
      React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        segments.map((seg, i) => {
          const fmtTime = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
          return React.createElement("div", { key: i, style: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' } },
            React.createElement("div", { style: { width: 28, height: 28, borderRadius: '50%', background: `hsl(${240 + i * (60 / Math.max(cardCount - 1, 1))}, 60%, 35%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 } }, i + 1),
            React.createElement("span", { style: { fontSize: 14, color: T.text } }, `${fmtTime(seg.start)} ~ ${fmtTime(seg.end)}`),
            React.createElement("span", { style: { fontSize: 12, color: T.textMuted, marginLeft: 'auto' } }, "10\uCD08"),
          );
        }),
      ),
    ),
    // Info
    React.createElement("div", { style: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', background: 'rgba(99,102,241,0.08)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.15)' } },
      React.createElement("span", { style: { fontSize: 16, flexShrink: 0, lineHeight: 1.4 } }, "\uD83D\uDCA1"),
      React.createElement("span", { style: { fontSize: 13, color: T.textSecondary, lineHeight: 1.5 } }, "\uD3B8\uC9D1 \uD654\uBA74\uC5D0\uC11C \uAD6C\uAC04\uC758 \uC704\uCE58\uC640 \uAE38\uC774\uB97C \uC790\uC720\uB86D\uAC8C \uC870\uC815\uD560 \uC218 \uC788\uC5B4\uC694"),
    ),
  );

  const canProceed = step === 1 ? (data.url && data.url.trim().length > 0) : true;

  return React.createElement("div", { style: { position: 'fixed', inset: 0, zIndex: 200, background: T.bg, display: 'flex', flexDirection: 'column', overflow: 'auto' } },
    // Top bar
    React.createElement("div", { style: { padding: mob ? '12px 16px' : '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.border}` } },
      React.createElement("span", { style: { fontSize: 15, fontWeight: 600, color: T.text } }, "\uC26C\uC6B4\uD3B8\uC9D1"),
      React.createElement("button", { onClick: onCancel, style: { padding: '6px 14px', borderRadius: T.radiusPill, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSecondary, fontSize: 13, cursor: 'pointer' } }, "\uCDE8\uC18C"),
    ),
    // Content
    React.createElement("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: mob ? 20 : 40 } },
      React.createElement("div", { style: { width: '100%', maxWidth: 480 } },
        stepIndicator,
        step === 1 ? step1 : step === 2 ? step2 : step3,
      ),
    ),
    // Bottom bar
    React.createElement("div", { style: { padding: mob ? '12px 16px' : '16px 24px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', gap: 12 } },
      step > 1
        ? React.createElement("button", { onClick: onBack, style: { padding: '12px 24px', borderRadius: T.radiusPill, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSecondary, fontSize: 14, cursor: 'pointer' } }, "\u2190 \uC774\uC804")
        : React.createElement("div"),
      step < 3
        ? React.createElement("button", { onClick: onNext, disabled: !canProceed, style: { padding: '12px 32px', borderRadius: T.radiusPill, border: 'none', background: canProceed ? T.accent : T.textMuted, color: '#fff', fontSize: 14, fontWeight: 600, cursor: canProceed ? 'pointer' : 'default', opacity: canProceed ? 1 : 0.5, transition: 'all 0.15s' } }, "\uB2E4\uC74C \u2192")
        : React.createElement("button", { onClick: onComplete, style: { padding: '12px 32px', borderRadius: T.radiusPill, border: 'none', background: T.accent, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' } }, "\uB9CC\uB4E4\uAE30 \u2728"),
    ),
  );
}

/* ── Wizard Loading Screen ── */
function WizardLoadingScreen({ mob }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 2000);
    const t3 = setTimeout(() => setPhase(3), 3200);
    const t4 = setTimeout(() => setPhase(4), 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  const steps = [
    { label: '\uCE74\uB4DC \uAD6C\uC870 \uC0DD\uC131 \uC911...', done: phase >= 1 },
    { label: '\uAD6C\uAC04 \uB098\uB204\uB294 \uC911...', done: phase >= 2 },
    { label: '\uC2A4\uD0C0\uC77C \uC801\uC6A9 \uC911...', done: phase >= 3 },
    { label: '\uCD08\uC548 \uC644\uC131!', done: phase >= 4 },
  ];

  return React.createElement("div", { style: { position: 'fixed', inset: 0, zIndex: 250, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1035 0%, #0d1b2a 50%, #1a0a2e 100%)', backgroundSize: '400% 400%', animation: 'wizardGradient 6s ease infinite', overflow: 'hidden' } },
    // Shimmer overlay
    React.createElement("div", { style: { position: 'absolute', inset: 0, background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.03) 55%, transparent 60%)', backgroundSize: '200% 100%', animation: 'shimmer 2.5s ease-in-out infinite' } }),
    // Card fan icon
    React.createElement("div", { style: { position: 'relative', width: 120, height: 100, marginBottom: 40, animation: 'wizardPulse 2s ease-in-out infinite' } },
      [-12, 0, 12].map((rot, i) => React.createElement("div", { key: i, style: {
        position: 'absolute', left: '50%', top: '50%',
        width: 56, height: 72, marginLeft: -28, marginTop: -36,
        background: `rgba(99,102,241,${0.15 + i * 0.1})`,
        border: '1.5px solid rgba(99,102,241,0.3)',
        borderRadius: 10, transform: `rotate(${rot}deg)`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      } })),
    ),
    // Steps
    React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' } },
      steps.map((s, i) => React.createElement("div", { key: i, style: {
        display: 'flex', alignItems: 'center', gap: 10,
        opacity: i <= phase ? 1 : 0.25,
        transform: i <= phase ? 'translateY(0)' : 'translateY(8px)',
        transition: 'all 0.4s ease',
      } },
        s.done
          ? React.createElement("span", { style: { fontSize: 18, color: T.success } }, "\u2713")
          : i === phase
            ? React.createElement("div", { style: { width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: T.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' } })
            : React.createElement("div", { style: { width: 16, height: 16 } }),
        React.createElement("span", { style: { fontSize: mob ? 14 : 16, color: s.done ? T.text : T.textSecondary, fontWeight: s.done ? 600 : 400 } }, s.label),
      )),
    ),
    // Keyframes
    React.createElement("style", null, `
      @keyframes wizardGradient { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
      @keyframes wizardPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
      @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    `),
  );
}

/* ── Reorder Modal ── */
function ReorderModal({ cards, onReorder, onClose }) {
  const [order, setOrder] = useState(cards.map((_, i) => i));
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const listRef = useRef(null);
  const touchStartY = useRef(0);

  const handleDragStart = (idx) => { setDragging(idx); };
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOver(idx); };
  const handleDrop = (idx) => {
    if (dragging === null || dragging === idx) { setDragging(null); setDragOver(null); return; }
    const newOrder = [...order];
    const [moved] = newOrder.splice(dragging, 1);
    newOrder.splice(idx, 0, moved);
    setOrder(newOrder);
    setDragging(null);
    setDragOver(null);
  };
  const handleDragEnd = () => { setDragging(null); setDragOver(null); };

  // Touch handlers for mobile drag
  const handleTouchStart = (idx, e) => {
    touchStartY.current = e.touches[0].clientY;
    setDragging(idx);
  };
  const handleTouchMove = (e) => {
    if (dragging === null || !listRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const items = listRef.current.querySelectorAll('[data-reorder-item]');
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        setDragOver(i);
        return;
      }
    }
  };
  const handleTouchEnd = () => {
    if (dragging !== null && dragOver !== null && dragging !== dragOver) {
      const newOrder = [...order];
      const [moved] = newOrder.splice(dragging, 1);
      newOrder.splice(dragOver, 0, moved);
      setOrder(newOrder);
    }
    setDragging(null);
    setDragOver(null);
  };

  // Move up/down buttons for easier mobile use
  const moveUp = (idx) => {
    if (idx <= 0) return;
    const newOrder = [...order];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    setOrder(newOrder);
  };
  const moveDown = (idx) => {
    if (idx >= order.length - 1) return;
    const newOrder = [...order];
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
    setOrder(newOrder);
  };

  const confirm = () => {
    const reordered = order.map(i => cards[i]);
    onReorder(reordered);
    onClose();
  };

  return React.createElement("div", { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 } },
    React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, maxWidth: 480, width: '100%', boxShadow: T.shadowLg, maxHeight: '85vh', display: 'flex', flexDirection: 'column' } },
      React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${T.border}` } },
        React.createElement("h3", { style: { fontWeight: 600, fontSize: 15, color: T.text } }, "\uCE74\uB4DC \uC21C\uC11C \uBCC0\uACBD"),
        React.createElement("button", { onClick: onClose, style: { background: 'none', border: 'none', color: T.textMuted, fontSize: 20, cursor: 'pointer' } }, "\u2715"),
      ),
      React.createElement("div", { ref: listRef, style: { padding: '12px 20px', overflowY: 'auto', flex: 1, touchAction: dragging !== null ? 'none' : 'auto' } },
        React.createElement("p", { style: { fontSize: 12, color: T.textMuted, marginBottom: 12 } }, "\uBC84\uD2BC\uC744 \uB20C\uB7EC \uC21C\uC11C\uB97C \uBCC0\uACBD\uD558\uC138\uC694"),
        order.map((cardIdx, visualIdx) => {
          const card = cards[cardIdx];
          const isDragging = dragging === visualIdx;
          const isDragOver = dragOver === visualIdx;
          const moved = cardIdx !== visualIdx;
          return React.createElement("div", {
            key: card.id,
            'data-reorder-item': true,
            draggable: true,
            onDragStart: () => handleDragStart(visualIdx),
            onDragOver: (e) => handleDragOver(e, visualIdx),
            onDrop: () => handleDrop(visualIdx),
            onDragEnd: handleDragEnd,
            onTouchStart: (e) => handleTouchStart(visualIdx, e),
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
            style: {
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              background: isDragging ? 'rgba(99,102,241,0.15)' : isDragOver ? 'rgba(99,102,241,0.08)' : moved ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.02)',
              borderRadius: T.radiusSm, marginBottom: 4, cursor: 'grab',
              border: `1px solid ${isDragOver ? T.accent : moved ? 'rgba(34,197,94,0.2)' : T.border}`,
              opacity: isDragging ? 0.6 : 1,
              transition: 'all 0.15s',
              userSelect: 'none', WebkitUserSelect: 'none',
            },
          },
            // Up/down buttons
            React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 } },
              React.createElement("button", {
                onClick: () => moveUp(visualIdx), disabled: visualIdx === 0,
                style: { width: 24, height: 20, border: 'none', borderRadius: 4, background: visualIdx === 0 ? 'transparent' : 'rgba(255,255,255,0.08)', color: visualIdx === 0 ? T.textMuted : T.textSecondary, fontSize: 10, cursor: visualIdx === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, opacity: visualIdx === 0 ? 0.3 : 1 }
              }, "\u25B2"),
              React.createElement("button", {
                onClick: () => moveDown(visualIdx), disabled: visualIdx === order.length - 1,
                style: { width: 24, height: 20, border: 'none', borderRadius: 4, background: visualIdx === order.length - 1 ? 'transparent' : 'rgba(255,255,255,0.08)', color: visualIdx === order.length - 1 ? T.textMuted : T.textSecondary, fontSize: 10, cursor: visualIdx === order.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, opacity: visualIdx === order.length - 1 ? 0.3 : 1 }
              }, "\u25BC"),
            ),
            // New order number
            React.createElement("span", { style: { width: 28, height: 28, borderRadius: T.radiusPill, background: moved ? T.success : T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0, transition: 'background 0.2s' } }, visualIdx + 1),
            // Card name
            React.createElement("span", { style: { color: T.text, fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, card.name || card.title || card.subtitle || `\uCE74\uB4DC ${cardIdx + 1}`),
            // Move indicator
            moved && React.createElement("span", { style: { fontSize: 10, color: T.success, fontWeight: 600, flexShrink: 0 } }, `${cardIdx + 1}\u2192${visualIdx + 1}`),
          );
        })
      ),
      React.createElement("div", { style: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: `1px solid ${T.border}` } },
        React.createElement("button", { onClick: onClose, style: { padding: '8px 20px', background: 'rgba(255,255,255,0.06)', color: T.textSecondary, borderRadius: T.radiusPill, border: 'none', fontSize: 13, cursor: 'pointer' } }, "\uCDE8\uC18C"),
        React.createElement("button", { onClick: confirm, style: { padding: '8px 20px', background: T.accent, color: '#fff', borderRadius: T.radiusPill, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' } }, "\uC801\uC6A9"),
      )
    )
  );
}

/* ── Info Panel (header dropdown) ── */
function InfoPanel({ onClose, mob }) {
  return React.createElement("div", {
    style: { position: mob ? 'fixed' : 'absolute', top: mob ? 'auto' : '100%', bottom: mob ? 0 : 'auto', left: mob ? 0 : 0, right: mob ? 0 : 'auto', marginTop: mob ? 0 : 8, background: T.surface, borderRadius: mob ? '16px 16px 0 0' : T.radius, boxShadow: T.shadowLg, border: `1px solid ${T.border}`, padding: '20px 24px', width: mob ? 'auto' : 320, zIndex: mob ? 9999 : 30 },
  },
    // Logo + title + copy
    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 } },
      React.createElement("img", { src: "/icon-round.png", style: { width: 40, height: 40, borderRadius: 10 } }),
      React.createElement("div", null,
        React.createElement("div", { style: { fontFamily: "'Bitcount Prop Single', monospace", fontSize: 20, color: T.text, letterSpacing: '0.05em' } }, "YOUMECA"),
        React.createElement("div", { style: { fontSize: 11, color: T.textMuted } }, VERSION),
      ),
    ),
    React.createElement("div", { style: { marginBottom: 16 } },
      React.createElement("div", { style: { fontSize: 13, color: T.text, fontWeight: 600 } }, "\uC720\uBA54\uCE74, \uB0B4\uAC00 \uAFC8\uAFB8\uB358 \uCE74\uB4DC\uB274\uC2A4 \uC0DD\uC131\uAE30"),
      React.createElement("div", { style: { fontSize: 12, color: T.textMuted, marginTop: 2 } }, "\uC720\uD29C\uBE0C \uC601\uC0C1\uC744 \uC27D\uAC8C \uCE74\uB4DC\uB274\uC2A4\uB85C \uB9CC\uB4E4\uC5B4\uBCF4\uC138\uC694"),
    ),
    // Recent features
    React.createElement("div", { style: { marginBottom: 16 } },
      React.createElement("div", { style: { fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 } }, "최근 업데이트"),
      RECENT_FEATURES.map((f, i) =>
        React.createElement("div", { key: i, style: { fontSize: 12, color: T.textSecondary, padding: '3px 0', display: 'flex', gap: 6 } },
          React.createElement("span", { style: { color: T.accent } }, "\u2022"),
          f,
        )
      )
    ),

    // Creator
    React.createElement("div", { style: { borderTop: `1px solid ${T.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 } },
      React.createElement("div", { style: { fontSize: 12, color: T.textSecondary } }, `Made by ${CREATOR}`),
      React.createElement("a", { href: `mailto:${CONTACT_EMAIL}`, style: { fontSize: 12, color: T.accent, textDecoration: 'none' } }, CONTACT_EMAIL),
    ),
  );
}

/* ── Project Tabs ── */
function ProjectTabs({ projects, activeId, onSwitch, onAdd, onClose, onRename }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (editingId && inputRef.current) inputRef.current.focus(); }, [editingId]);

  const startRename = (proj) => { setEditingId(proj.id); setEditName(proj.name); };
  const commitRename = () => {
    if (editingId && editName.trim()) onRename(editingId, editName.trim());
    setEditingId(null);
  };

  return React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 2, flex: 1, overflow: 'auto', paddingRight: 8 } },
    projects.map(proj => {
      const isActive = proj.id === activeId;
      const isEditing = proj.id === editingId;
      return React.createElement("div", {
        key: proj.id,
        style: {
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 12px', borderRadius: T.radiusPill, cursor: 'pointer',
          background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
          border: `1px solid ${isActive ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
          transition: 'all 0.15s', flexShrink: 0,
        },
        onClick: () => !isEditing && onSwitch(proj.id),
      },
        isEditing
          ? React.createElement("input", {
              ref: inputRef, value: editName,
              onChange: (e) => setEditName(e.target.value),
              onBlur: commitRename,
              onKeyDown: (e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); },
              onClick: (e) => e.stopPropagation(),
              style: { background: 'transparent', border: 'none', color: T.text, fontSize: 12, fontWeight: 500, outline: 'none', width: Math.max(40, editName.length * 8), padding: 0 },
            })
          : React.createElement("span", {
              style: { fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? T.accent : T.textSecondary, userSelect: 'none' },
            }, proj.name),
        isActive && !isEditing && React.createElement("button", {
          onClick: (e) => { e.stopPropagation(); startRename(proj); },
          style: { background: 'none', border: 'none', color: T.textMuted, fontSize: 11, cursor: 'pointer', padding: '0 2px', lineHeight: 1, opacity: 0.5 },
          onMouseEnter: (e) => e.currentTarget.style.opacity = 1,
          onMouseLeave: (e) => e.currentTarget.style.opacity = 0.5,
          title: '이름 수정',
        }, "\u270E"),
        projects.length > 1 && React.createElement("button", {
          onClick: (e) => { e.stopPropagation(); onClose(proj.id); },
          style: { background: 'none', border: 'none', color: T.textMuted, fontSize: 13, cursor: 'pointer', padding: '0 2px', lineHeight: 1, opacity: 0.6 },
          onMouseEnter: (e) => e.currentTarget.style.opacity = 1,
          onMouseLeave: (e) => e.currentTarget.style.opacity = 0.6,
        }, "\u00D7"),
      );
    }),
    React.createElement("button", {
      onClick: onAdd,
      style: { width: 26, height: 26, borderRadius: T.radiusPill, background: 'rgba(255,255,255,0.05)', border: 'none', color: T.textMuted, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' },
      onMouseEnter: (e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.color = T.accent; },
      onMouseLeave: (e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = T.textMuted; },
    }, "+"),
  );
}

/* ── Mobile Tab Pill ── */
function TabPill({ label, active, onClick }) {
  return React.createElement("button", {
    onClick,
    style: {
      padding: '8px 16px', borderRadius: T.radiusPill, fontSize: 13, fontWeight: active ? 600 : 400,
      border: active ? `1.5px solid ${T.accent}` : `1px solid ${T.border}`,
      background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
      color: active ? T.accent : T.textSecondary,
      cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
    },
  }, label);
}

/* ── Mobile Card Carousel ── */
const MOBILE_TABS = [
  { id: 'fill', label: '클립 편집' },
  { id: 'layout', label: '레이아웃' },
  { id: 'text', label: '텍스트' },
  { id: 'overlay', label: '\uC624\uBC84\uB808\uC774' },
];

function MobileCardCarousel({ cards, activeIndex, onActiveChange, onCardChange, onRemove, onDuplicate, onAdd, globalUrl, aspectRatio, outputFormat, globalBgImage, onReorder, hidePreview = false, onAspectRatioChange }) {
  const [activeTab, setActiveTab] = useState('fill');
  const [touchStart, setTouchStart] = useState(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [showDetailTitle, setShowDetailTitle] = useState(false);
  const [showDetailSubtitle, setShowDetailSubtitle] = useState(false);
  const [showDetailBody, setShowDetailBody] = useState(false);
  const [selectedHandle, setSelectedHandle] = useState(null);
  const [clipWarn, setClipWarn] = useState(false);
  const [clipSelectorOpen, setClipSelectorOpen] = useState(false);
  const clipWarnTimer = useRef(null);
  const showClipWarn = () => {
    setClipWarn(true);
    if (clipWarnTimer.current) clearTimeout(clipWarnTimer.current);
    clipWarnTimer.current = setTimeout(() => setClipWarn(false), 4000);
  };
  const handleSelectHandle = (val) => {
    setSelectedHandle(val);
    if (val === 'textbox') setActiveTab('text');
    else if (val && val.startsWith('overlay-')) setActiveTab('overlay');
  };

  const totalSlides = cards.length + 1; // +1 for add card
  const card = cards[activeIndex];
  const update = (key, val) => onCardChange(activeIndex, { ...card, [key]: val });
  const updateMulti = (obj) => onCardChange(activeIndex, { ...card, ...obj });

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameRef = useRef(null);
  useEffect(() => { if (editingName && nameRef.current) nameRef.current.focus(); }, [editingName]);
  const displayName = card ? (card.name || card.title || card.subtitle || `카드 ${activeIndex + 1}`) : '';
  const startEditName = () => { setEditingName(true); setNameValue(card.name || ''); };
  const commitName = () => { update('name', nameValue.trim()); setEditingName(false); };

  const goTo = (idx) => {
    if (idx < 0 || idx >= totalSlides || transitioning) return;
    if (idx === cards.length) { onAdd(); return; }
    setTransitioning(true);
    onActiveChange(idx);
    setActiveTab('fill');
    setSelectedHandle(null);
    setTimeout(() => setTransitioning(false), 200);
  };

  const handleTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  const handleTouchMove = (e) => { if (touchStart !== null) setTouchDelta(e.touches[0].clientX - touchStart); };
  const handleTouchEnd = () => {
    if (Math.abs(touchDelta) > 60) {
      if (touchDelta < 0 && activeIndex < totalSlides - 1) goTo(activeIndex + 1);
      else if (touchDelta > 0 && activeIndex > 0) goTo(activeIndex - 1);
    }
    setTouchStart(null);
    setTouchDelta(0);
  };

  const tabs = MOBILE_TABS;

  if (!card) return null;

  const previewCard = { ...card, title: card.useTitle !== false ? card.title : '', subtitle: card.useSubtitle !== false ? card.subtitle : '', body: card.useBody !== false ? card.body : '' };

  const handlePreviewTextClick = (field) => {
    setActiveTab('text');
    setTimeout(() => {
      const el = document.getElementById('mob-text-' + field);
      if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }, 50);
  };

  // Tab content renderers
  const renderFillTab = () => React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
    React.createElement("div", { style: { display: 'flex', gap: 6, marginBottom: 4 } },
      FILL_SOURCE_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: (card.fillSource || 'video') === opt.id, onClick: () => update("fillSource", opt.id) }, opt.label))
    ),
    (card.fillSource || 'video') === 'video' && React.createElement(React.Fragment, null,
      React.createElement("input", { type: "text", value: card.url, placeholder: "개별 URL (비워두면 공통 URL)", onChange: (e) => update("url", e.target.value), style: { ...inputBase, marginBottom: 8 } }),
      // MobileClipSelector: visual clip picker
      React.createElement(MobileClipSelector, { videoUrl: card.url || globalUrl, start: card.start, end: card.end, onStartChange: (v) => update("start", v), onEndChange: (v) => update("end", v), onClipChange: (s, e) => updateMulti({ start: s, end: e }), onExpandChange: (open) => setClipSelectorOpen(open) }),
      // Manual time inputs + duration bar (hidden when clip selector is open — info is already shown there)
      !clipSelectorOpen && React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 } },
        React.createElement("div", null, React.createElement("label", { style: { ...labelBase, fontSize: 11 } }, "\uC2DC\uC791"), React.createElement("input", { type: "text", value: card.start, placeholder: "0:00", onChange: (e) => {
          var ss = parseTime(e.target.value) ?? 0; var es = parseTime(card.end);
          if (es != null && es > ss && es - ss > 30) { updateMulti({ start: e.target.value, end: fmtMM(ss + 30) }); showClipWarn(); }
          else update("start", e.target.value);
        }, style: { ...inputBase, padding: '8px 10px', fontSize: 13 } })),
        React.createElement("div", null, React.createElement("label", { style: { ...labelBase, fontSize: 11 } }, "\uC885\uB8CC"), React.createElement("input", { type: "text", value: card.end, placeholder: "0:10", onChange: (e) => {
          var ss = parseTime(card.start) ?? 0; var es = parseTime(e.target.value);
          if (es != null && es - ss > 30) { update("end", fmtMM(ss + 30)); showClipWarn(); }
          else update("end", e.target.value);
        }, style: { ...inputBase, padding: '8px 10px', fontSize: 13 } })),
      ),
      !clipSelectorOpen && (() => { var ss = parseTime(card.start) ?? 0, es = parseTime(card.end); var cl = (es != null && es > ss) ? es - ss : null; var over = cl != null && cl > 30; return cl != null ? React.createElement("div", { style: { marginBottom: 8 } },
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 } },
          React.createElement("span", { style: { fontSize: 11, color: over ? '#ef4444' : T.textMuted, fontWeight: 600 } }, '\uAD6C\uAC04 \uAE38\uC774 ' + Math.round(cl) + '\uCD08'),
          React.createElement("span", { style: { fontSize: 10, color: over ? '#ef4444' : T.textMuted } }, Math.round(cl) + ' / 30\uCD08'),
        ),
        React.createElement("div", { style: { width: '100%', height: 4, background: T.border, borderRadius: 2, overflow: 'hidden' } },
          React.createElement("div", { style: { width: Math.min(100, (cl / 30) * 100) + '%', height: '100%', background: over ? '#ef4444' : cl / 30 > 0.8 ? '#f59e0b' : '#6366f1', borderRadius: 2, transition: 'width 0.2s, background 0.2s' } }),
        ),
      ) : null; })(),
      !clipSelectorOpen && clipWarn && React.createElement("div", { style: { padding: '10px 14px', marginBottom: 8, background: 'rgba(239,68,68,0.15)', border: '1.5px solid rgba(239,68,68,0.4)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#ef4444', textAlign: 'center', animation: 'clipWarnShake 0.4s ease-in-out' } },
        '\u26A0\uFE0F \uD074\uB9BD\uC740 \uCD5C\uB300 30\uCD08\uAE4C\uC9C0 \uC120\uD0DD\uD560 \uC218 \uC788\uC5B4\uC694'
      ),
    ),
    (card.fillSource || 'video') === 'image' && React.createElement("div", { style: { marginBottom: 8 } }, React.createElement(ImageUploadField, { value: card.uploadedImage, onChange: (v) => update("uploadedImage", v) })),
    React.createElement(SectionTitleWithReset, { title: "\uD074\uB9BD \uC870\uC815", onReset: () => updateMulti({ videoX: 50, videoY: 50, videoScale: 110, videoBrightness: 0 }) }),
    React.createElement(SliderRow, { label: "좌우", value: card.videoX, min: 0, max: 100, step: 1, onChange: (v) => update("videoX", v), defaultValue: 50 }),
    React.createElement(SliderRow, { label: "위아래", value: card.videoY, min: 0, max: 100, step: 1, onChange: (v) => update("videoY", v), defaultValue: 50 }),
    React.createElement(SliderRow, { label: "확대", value: card.videoScale || 110, min: 100, max: 200, step: 1, onChange: (v) => update("videoScale", v), defaultValue: 110 }),
    React.createElement(SliderRow, { label: "밝기", value: card.videoBrightness || 0, min: -100, max: 100, step: 1, onChange: (v) => update("videoBrightness", v), suffix: '%', defaultValue: 0 }),
  );

  const renderLayoutTab = () => React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
    React.createElement("div", null,
      React.createElement("label", { style: labelBase }, "레이아웃"),
      React.createElement("div", { style: { display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto' } },
        LAYOUT_OPTIONS.map(opt => React.createElement(LayoutThumb, { key: opt.id, type: opt.id, label: opt.label, active: opt.id === 'gradient_fade' ? (card.layout === 'photo_top' && card.useGradient === true) : opt.id === 'photo_top' ? (card.layout === 'photo_top' && !card.useGradient) : card.layout === opt.id, onClick: () => updateMulti({ layout: opt.id === 'gradient_fade' ? 'photo_top' : opt.id, useGradient: opt.id === 'gradient_fade' }) }))
      )
    ),
    // 카드 비율
    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6 } },
      React.createElement("span", { style: { fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap' } }, "\uCE74\uB4DC \uBE44\uC728"),
      ASPECT_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: aspectRatio === opt.id, onClick: () => onAspectRatioChange(opt.id) }, opt.label))
    ),
    card.layout !== "full_bg" && card.layout !== "text_box" && card.layout !== "none" && React.createElement(SliderRow, { label: "배경 영역", value: 100 - (card.photoRatio ?? 50), min: 10, max: 80, step: 1, onChange: (v) => update("photoRatio", 100 - v), suffix: '%' }),
    // 텍스트 박스 설정
    card.layout === "text_box" && React.createElement("div", { style: { borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 8 } },
      React.createElement(SectionTitleWithReset, { title: "\uBC15\uC2A4 \uC124\uC815", onReset: () => updateMulti({ textBoxX: 50, textBoxY: 70, textBoxWidth: 80, textBoxHeight: 0, textBoxPadding: 20, textBoxRadius: 12, textBoxBgColor: '#000000', textBoxBgOpacity: 0.6, textBoxBorderColor: '#ffffff', textBoxBorderWidth: 0 }) }),
      React.createElement(SliderRow, { label: "좌우 위치", value: card.textBoxX ?? 50, min: 0, max: 100, step: 1, onChange: (v) => update("textBoxX", v), suffix: '%', defaultValue: 50 }),
      React.createElement(SliderRow, { label: "위아래 위치", value: card.textBoxY ?? 70, min: 0, max: 100, step: 1, onChange: (v) => update("textBoxY", v), suffix: '%', defaultValue: 70 }),
      React.createElement(SliderRow, { label: "박스 너비", value: card.textBoxWidth ?? 80, min: 20, max: 100, step: 1, onChange: (v) => update("textBoxWidth", v), suffix: '%', defaultValue: 80 }),
      React.createElement(SliderRow, { label: "박스 높이", value: card.textBoxHeight ?? 0, min: 0, max: 100, step: 1, onChange: (v) => update("textBoxHeight", v), suffix: (card.textBoxHeight ?? 0) === 0 ? ' 자동' : '%', defaultValue: 0 }),
      React.createElement(SliderRow, { label: "안쪽 여백", value: card.textBoxPadding ?? 20, min: 5, max: 60, step: 1, onChange: (v) => update("textBoxPadding", v), suffix: 'px', defaultValue: 20 }),
      React.createElement(SliderRow, { label: "둥글기", value: card.textBoxRadius ?? 12, min: 0, max: 40, step: 1, onChange: (v) => update("textBoxRadius", v), suffix: 'px', defaultValue: 12 }),
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 } },
        React.createElement("label", { style: { fontSize: 12, color: T.textMuted } }, "배경색"),
        React.createElement("input", { type: "color", value: card.textBoxBgColor ?? "#000000", onChange: (e) => update("textBoxBgColor", e.target.value), style: { width: 32, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, cursor: 'pointer' } }),
        React.createElement("span", { style: { fontSize: 12, color: T.textMuted } }, card.textBoxBgColor ?? "#000000"),
      ),
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 } },
        React.createElement("div", { style: { flex: 1 } }, React.createElement(SliderRow, { label: "투명도", value: card.textBoxBgOpacity ?? 0.6, min: 0, max: 1, step: 0.01, onChange: (v) => update("textBoxBgOpacity", v), defaultValue: 0.6 })),
      ),
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 } },
        React.createElement("label", { style: { fontSize: 12, color: T.textMuted } }, "테두리 색"),
        React.createElement("input", { type: "color", value: card.textBoxBorderColor ?? "#ffffff", onChange: (e) => update("textBoxBorderColor", e.target.value), style: { width: 32, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, cursor: 'pointer' } }),
        React.createElement("span", { style: { fontSize: 12, color: T.textMuted } }, card.textBoxBorderColor ?? "#ffffff"),
      ),
      React.createElement(SliderRow, { label: "테두리 두께", value: card.textBoxBorderWidth ?? 0, min: 0, max: 10, step: 1, onChange: (v) => update("textBoxBorderWidth", v), suffix: 'px', defaultValue: 0 }),
    ),
    // 영상 채우기
    card.layout !== "full_bg" && card.layout !== "text_box" && card.layout !== "none" && React.createElement("div", { style: { marginTop: 4 } },
      React.createElement("label", { style: labelBase }, "영상 채우기"),
      React.createElement("div", { style: { display: 'flex', gap: 6 } },
        VIDEO_FILL_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: (card.videoFill || "full") === opt.id, onClick: () => update("videoFill", opt.id) }, opt.label))
      )
    ),
    // 텍스트 배경 설정 (text_box는 박스 설정에서 관리)
    card.layout !== "text_box" && card.layout !== "none" && React.createElement("div", { style: { borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 4 } },
      React.createElement(SectionTitleWithReset, { title: "텍스트 배경 설정", onReset: () => updateMulti({ useBg: true, bgColor: '#121212', bgOpacity: 0.75 }) }),
      React.createElement(CheckboxRow, { label: "배경색 사용", checked: card.useBg !== false, onChange: (v) => update("useBg", v) }),
      card.useBg !== false && React.createElement(React.Fragment, null,
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 } },
          React.createElement("label", { style: { fontSize: 12, color: T.textMuted } }, "색상"),
          React.createElement("input", { type: "color", value: card.bgColor, onChange: (e) => update("bgColor", e.target.value), style: { width: 32, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, cursor: 'pointer' } }),
          React.createElement("span", { style: { fontSize: 12, color: T.textMuted } }, card.bgColor),
        ),
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 } },
          React.createElement("div", { style: { flex: 1 } }, React.createElement(SliderRow, { label: "투명도", value: card.bgOpacity, min: 0, max: 1, step: 0.01, onChange: (v) => update("bgOpacity", v), defaultValue: 0.75 })),
          React.createElement(CheckboxRow, { label: "투명하게", checked: card.bgOpacity === 0, onChange: (v) => update("bgOpacity", v ? 0 : 0.75) }),
        ),
      ),
    ),
  );

  const setAllAlign = (align) => updateMulti({ titleAlign: align, subtitleAlign: align, bodyAlign: align });
  const renderTextTab = () => React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
    // 전체 정렬
    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: `1px solid ${T.border}`, marginBottom: 2 } },
      React.createElement("span", { style: { fontSize: 11, color: T.textMuted, flexShrink: 0 } }, "\uC804\uCCB4 \uC815\uB82C"),
      React.createElement("div", { style: { display: 'flex', gap: 3 } },
        [['left','\u2630 \uC88C'], ['center','\u2630 \uC911'], ['right','\u2630 \uC6B0']].map(([v, lb]) => React.createElement(PillBtn, { key: v, active: (card.titleAlign || 'left') === v && (card.subtitleAlign || 'left') === v && (card.bodyAlign || 'left') === v, onClick: () => setAllAlign(v) }, lb))
      ),
    ),
    // 제목
    React.createElement(TextFieldRow, { inputId: "mob-text-title", value: card.title, onTextChange: (v) => update("title", v), placeholder: "제목", size: card.titleSize, onSizeChange: (v) => update("titleSize", v), color: card.titleColor, onColorChange: (v) => update("titleColor", v), enabled: card.useTitle !== false, onToggle: () => update("useTitle", card.useTitle === false ? true : false) }),
    React.createElement("div", {
      style: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', marginBottom: 4 },
    },
      React.createElement("div", { onClick: () => setShowDetailTitle(!showDetailTitle), style: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', flex: 1 } },
        React.createElement("span", { style: { fontSize: 10, color: T.textMuted, transition: 'transform 0.2s', transform: showDetailTitle ? 'rotate(90deg)' : 'rotate(0deg)' } }, "\u25B6"),
        React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, "\uC138\uBD80\uC870\uC815"),
      ),
      showDetailTitle && React.createElement("button", { onClick: () => updateMulti({ titleAlign: 'left', titleLetterSpacing: 0, titleLineHeight: 1.4, titleX: 0, titleY: 0 }), style: resetBtnStyle }, "\uAE30\uBCF8\uAC12"),
    ),
    showDetailTitle && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 8, borderLeft: `2px solid ${T.border}`, marginBottom: 8 } },
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 } },
        React.createElement("span", { style: { fontSize: 11, color: T.textMuted, minWidth: 36 } }, "\uC815\uB82C"),
        React.createElement("div", { style: { display: 'flex', gap: 3 } },
          [['left','\u2630 \uC88C'], ['center','\u2630 \uC911'], ['right','\u2630 \uC6B0']].map(([v, lb]) => React.createElement(PillBtn, { key: v, active: (card.titleAlign || 'left') === v, onClick: () => update("titleAlign", v) }, lb))
        ),
      ),
      React.createElement(SliderRow, { label: "\uC790\uAC04", value: card.titleLetterSpacing ?? 0, min: -5, max: 20, step: 0.5, onChange: (v) => update("titleLetterSpacing", v), suffix: 'px', defaultValue: 0 }),
      React.createElement(SliderRow, { label: "\uC904\uAC04", value: card.titleLineHeight ?? 1.4, min: 1.0, max: 3.0, step: 0.1, onChange: (v) => update("titleLineHeight", v), suffix: '', defaultValue: 1.4 }),
      React.createElement(SliderRow, { label: "\uC88C\uC6B0", value: card.titleX ?? 0, min: -540, max: 540, step: 1, onChange: (v) => update("titleX", v), suffix: 'px', defaultValue: 0 }),
      React.createElement(SliderRow, { label: "\uC704\uC544\uB798", value: card.titleY ?? 0, min: -1080, max: 1080, step: 1, onChange: (v) => update("titleY", v), suffix: 'px', defaultValue: 0 }),
    ),
    // 부제목
    React.createElement(TextFieldRow, { inputId: "mob-text-subtitle", value: card.subtitle, onTextChange: (v) => update("subtitle", v), placeholder: "부제목", size: card.subtitleSize, onSizeChange: (v) => update("subtitleSize", v), color: card.subtitleColor, onColorChange: (v) => update("subtitleColor", v), enabled: card.useSubtitle !== false, onToggle: () => update("useSubtitle", card.useSubtitle === false ? true : false) }),
    React.createElement("div", {
      style: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', marginBottom: 4 },
    },
      React.createElement("div", { onClick: () => setShowDetailSubtitle(!showDetailSubtitle), style: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', flex: 1 } },
        React.createElement("span", { style: { fontSize: 10, color: T.textMuted, transition: 'transform 0.2s', transform: showDetailSubtitle ? 'rotate(90deg)' : 'rotate(0deg)' } }, "\u25B6"),
        React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, "\uC138\uBD80\uC870\uC815"),
      ),
      showDetailSubtitle && React.createElement("button", { onClick: () => updateMulti({ subtitleAlign: 'left', subtitleLetterSpacing: 0, subtitleLineHeight: 1.4, subtitleX: 0, subtitleY: 0 }), style: resetBtnStyle }, "\uAE30\uBCF8\uAC12"),
    ),
    showDetailSubtitle && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 8, borderLeft: `2px solid ${T.border}`, marginBottom: 8 } },
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 } },
        React.createElement("span", { style: { fontSize: 11, color: T.textMuted, minWidth: 36 } }, "\uC815\uB82C"),
        React.createElement("div", { style: { display: 'flex', gap: 3 } },
          [['left','\u2630 \uC88C'], ['center','\u2630 \uC911'], ['right','\u2630 \uC6B0']].map(([v, lb]) => React.createElement(PillBtn, { key: v, active: (card.subtitleAlign || 'left') === v, onClick: () => update("subtitleAlign", v) }, lb))
        ),
      ),
      React.createElement(SliderRow, { label: "\uC790\uAC04", value: card.subtitleLetterSpacing ?? 0, min: -5, max: 20, step: 0.5, onChange: (v) => update("subtitleLetterSpacing", v), suffix: 'px', defaultValue: 0 }),
      React.createElement(SliderRow, { label: "\uC904\uAC04", value: card.subtitleLineHeight ?? 1.4, min: 1.0, max: 3.0, step: 0.1, onChange: (v) => update("subtitleLineHeight", v), suffix: '', defaultValue: 1.4 }),
      React.createElement(SliderRow, { label: "\uC88C\uC6B0", value: card.subtitleX ?? 0, min: -540, max: 540, step: 1, onChange: (v) => update("subtitleX", v), suffix: 'px', defaultValue: 0 }),
      React.createElement(SliderRow, { label: "\uC704\uC544\uB798", value: card.subtitleY ?? 0, min: -1080, max: 1080, step: 1, onChange: (v) => update("subtitleY", v), suffix: 'px', defaultValue: 0 }),
    ),
    // 본문
    React.createElement(TextFieldRow, { inputId: "mob-text-body", value: card.body, onTextChange: (v) => update("body", v), placeholder: "본문 내용", rows: 3, size: card.bodySize, onSizeChange: (v) => update("bodySize", v), color: card.bodyColor, onColorChange: (v) => update("bodyColor", v), enabled: card.useBody !== false, onToggle: () => update("useBody", card.useBody === false ? true : false) }),
    React.createElement("div", {
      style: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' },
    },
      React.createElement("div", { onClick: () => setShowDetailBody(!showDetailBody), style: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', flex: 1 } },
        React.createElement("span", { style: { fontSize: 10, color: T.textMuted, transition: 'transform 0.2s', transform: showDetailBody ? 'rotate(90deg)' : 'rotate(0deg)' } }, "\u25B6"),
        React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, "\uC138\uBD80\uC870\uC815"),
      ),
      showDetailBody && React.createElement("button", { onClick: () => updateMulti({ bodyAlign: 'left', bodyLetterSpacing: 0, bodyLineHeight: 1.4, bodyX: 0, bodyY: 0 }), style: resetBtnStyle }, "\uAE30\uBCF8\uAC12"),
    ),
    showDetailBody && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 8, borderLeft: `2px solid ${T.border}`, marginBottom: 4 } },
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 } },
        React.createElement("span", { style: { fontSize: 11, color: T.textMuted, minWidth: 36 } }, "\uC815\uB82C"),
        React.createElement("div", { style: { display: 'flex', gap: 3 } },
          [['left','\u2630 \uC88C'], ['center','\u2630 \uC911'], ['right','\u2630 \uC6B0']].map(([v, lb]) => React.createElement(PillBtn, { key: v, active: (card.bodyAlign || 'left') === v, onClick: () => update("bodyAlign", v) }, lb))
        ),
      ),
      React.createElement(SliderRow, { label: "\uC790\uAC04", value: card.bodyLetterSpacing ?? 0, min: -5, max: 20, step: 0.5, onChange: (v) => update("bodyLetterSpacing", v), suffix: 'px', defaultValue: 0 }),
      React.createElement(SliderRow, { label: "\uC904\uAC04", value: card.bodyLineHeight ?? 1.4, min: 1.0, max: 3.0, step: 0.1, onChange: (v) => update("bodyLineHeight", v), suffix: '', defaultValue: 1.4 }),
      React.createElement(SliderRow, { label: "\uC88C\uC6B0", value: card.bodyX ?? 0, min: -540, max: 540, step: 1, onChange: (v) => update("bodyX", v), suffix: 'px', defaultValue: 0 }),
      React.createElement(SliderRow, { label: "\uC704\uC544\uB798", value: card.bodyY ?? 0, min: -1080, max: 1080, step: 1, onChange: (v) => update("bodyY", v), suffix: 'px', defaultValue: 0 }),
    ),
  );

  const renderOverlayTab = () => React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
    React.createElement("div", { style: { maxHeight: 400, overflowY: 'auto' } },
      (card.overlays || []).map((ov, oi) => React.createElement("div", { key: oi, style: { marginBottom: 8, padding: 10, background: 'rgba(255,255,255,0.02)', borderRadius: T.radiusSm, border: selectedHandle === 'overlay-' + oi ? `1.5px solid ${T.accent}` : `1px solid ${T.border}` } },
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 } },
          React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement("span", { style: { fontSize: 12, color: T.textSecondary, fontWeight: 500 } }, `이미지 ${oi + 1}`),
            React.createElement("div", { onClick: () => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], aboveLayout: !ov.aboveLayout}; update("overlays", ovs); }, style: { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' } },
              React.createElement("div", { style: { width: 24, height: 12, borderRadius: 6, background: ov.aboveLayout ? T.accent : 'rgba(255,255,255,0.2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 } },
                React.createElement("div", { style: { width: 8, height: 8, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: ov.aboveLayout ? 14 : 2, transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' } })
              ),
              React.createElement("span", { style: { fontSize: 10, color: ov.aboveLayout ? '#fff' : 'rgba(255,255,255,0.4)', userSelect: 'none' } }, "레이아웃 위에 표시"),
            ),
          ),
          React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 4 } },
            React.createElement("button", { disabled: oi === 0, onClick: () => { const ovs = [...(card.overlays||[])]; const t = ovs[oi]; ovs[oi] = ovs[oi-1]; ovs[oi-1] = t; update("overlays", ovs); }, style: { background: 'rgba(255,255,255,0.06)', border: 'none', color: oi === 0 ? T.textMuted : T.textSecondary, fontSize: 11, cursor: oi === 0 ? 'default' : 'pointer', padding: '2px 6px', borderRadius: T.radiusPill, opacity: oi === 0 ? 0.4 : 1 } }, "\u25B2"),
            React.createElement("button", { disabled: oi === (card.overlays||[]).length - 1, onClick: () => { const ovs = [...(card.overlays||[])]; const t = ovs[oi]; ovs[oi] = ovs[oi+1]; ovs[oi+1] = t; update("overlays", ovs); }, style: { background: 'rgba(255,255,255,0.06)', border: 'none', color: oi === (card.overlays||[]).length - 1 ? T.textMuted : T.textSecondary, fontSize: 11, cursor: oi === (card.overlays||[]).length - 1 ? 'default' : 'pointer', padding: '2px 6px', borderRadius: T.radiusPill, opacity: oi === (card.overlays||[]).length - 1 ? 0.4 : 1 } }, "\u25BC"),
            React.createElement("button", { onClick: () => { setSelectedHandle(null); const ovs = [...(card.overlays||[])]; ovs.splice(oi, 1); update("overlays", ovs); }, style: { background: 'rgba(239,68,68,0.1)', border: 'none', color: T.danger, fontSize: 11, cursor: 'pointer', padding: '2px 8px', borderRadius: T.radiusPill } }, "삭제"),
          ),
        ),
        React.createElement(ImageUploadField, { value: ov.image, onChange: (v) => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], image: v}; update("overlays", ovs); }, maxMb: 5 }),
        ov.image && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 } },
          React.createElement(SectionTitleWithReset, { title: "\uC774\uBBF8\uC9C0 \uC870\uC815", onReset: () => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], x: 50, y: 50, scale: 100, opacity: 1}; update("overlays", ovs); } }),
          React.createElement(SliderRow, { label: "좌우", value: ov.x ?? 50, min: 0, max: 100, step: 1, onChange: (v) => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], x: v}; update("overlays", ovs); } }),
          React.createElement(SliderRow, { label: "위아래", value: ov.y ?? 50, min: 0, max: 100, step: 1, onChange: (v) => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], y: v}; update("overlays", ovs); } }),
          React.createElement(SliderRow, { label: "크기", value: ov.scale ?? 100, min: 10, max: 300, step: 1, onChange: (v) => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], scale: v}; update("overlays", ovs); }, suffix: '%' }),
          React.createElement(SliderRow, { label: "투명도", value: ov.opacity ?? 1, min: 0, max: 1, step: 0.01, onChange: (v) => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], opacity: v}; update("overlays", ovs); } }),
        ),
      )),
    ),
    React.createElement("button", {
      onClick: () => update("overlays", [...(card.overlays||[]), { image: null, x: 50, y: 50, scale: 100, opacity: 1 }]),
      style: { width: '100%', padding: '10px', border: `1.5px dashed ${T.border}`, borderRadius: T.radiusSm, background: 'transparent', color: T.textSecondary, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' },
    }, "+ 이미지 추가"),
  );

  const tabContent = { fill: renderFillTab, layout: renderLayoutTab, text: renderTextTab, overlay: renderOverlayTab };

  return React.createElement("div", {
    style: { display: 'flex', flexDirection: 'column', gap: 0 },
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  },
    // Carousel indicator (dots + arrows) — hidden if hidePreview
    !hidePreview && React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0' } },
      React.createElement("button", {
        onClick: () => goTo(activeIndex - 1),
        disabled: activeIndex === 0,
        style: { background: 'none', border: 'none', color: activeIndex === 0 ? T.textMuted : T.accent, fontSize: 18, cursor: activeIndex === 0 ? 'default' : 'pointer', padding: '4px 8px', opacity: activeIndex === 0 ? 0.3 : 1 },
      }, "\u25C0"),
      cards.map((_, i) => React.createElement("div", {
        key: i,
        onClick: () => goTo(i),
        style: { width: i === activeIndex ? 20 : 8, height: 8, borderRadius: 4, background: i === activeIndex ? T.accent : T.border, cursor: 'pointer', transition: 'all 0.2s' },
      })),
      // + dot
      React.createElement("div", {
        onClick: () => goTo(cards.length),
        style: { width: 8, height: 8, borderRadius: 4, background: 'transparent', border: `1.5px solid ${T.accent}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: T.accent, lineHeight: 1 },
      }),
      React.createElement("button", {
        onClick: () => goTo(activeIndex + 1),
        disabled: activeIndex >= totalSlides - 1,
        style: { background: 'none', border: 'none', color: activeIndex >= totalSlides - 1 ? T.textMuted : T.accent, fontSize: 18, cursor: activeIndex >= totalSlides - 1 ? 'default' : 'pointer', padding: '4px 8px', opacity: activeIndex >= totalSlides - 1 ? 0.3 : 1 },
      }, "\u25B6"),
    ),

    // Card header (name, actions) — hidden if hidePreview
    !hidePreview && React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px', gap: 8 } },
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 } },
        React.createElement("span", { style: { width: 26, height: 26, borderRadius: T.radiusPill, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 } }, activeIndex + 1),
        editingName
          ? React.createElement("input", {
              ref: nameRef, value: nameValue,
              onChange: (e) => setNameValue(e.target.value),
              onBlur: commitName,
              onKeyDown: (e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); },
              style: { background: 'transparent', border: `1px solid ${T.accent}`, color: T.text, fontSize: 13, fontWeight: 500, outline: 'none', padding: '2px 8px', borderRadius: 4, flex: 1, minWidth: 0 },
            })
          : React.createElement("span", {
              onClick: startEditName,
              style: { color: T.text, fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' },
            }, displayName),
      ),
      React.createElement("div", { style: { display: 'flex', gap: 6, flexShrink: 0 } },
        React.createElement("button", { onClick: onReorder, style: { background: 'rgba(255,255,255,0.05)', border: 'none', color: T.textMuted, fontSize: 11, cursor: 'pointer', padding: '4px 8px', borderRadius: T.radiusPill } }, "\u2630"),
        React.createElement("button", { onClick: () => onDuplicate(activeIndex), style: { background: 'rgba(255,255,255,0.05)', border: 'none', color: T.textMuted, fontSize: 11, cursor: 'pointer', padding: '4px 8px', borderRadius: T.radiusPill } }, "복제"),
        cards.length > 1 && React.createElement("button", { onClick: () => { onRemove(activeIndex); if (activeIndex >= cards.length - 1) onActiveChange(Math.max(0, activeIndex - 1)); }, style: { background: 'rgba(239,68,68,0.1)', border: 'none', color: T.danger, fontSize: 11, cursor: 'pointer', padding: '4px 8px', borderRadius: T.radiusPill } }, "삭제"),
      ),
    ),

    // Sticky preview — hidden if hidePreview
    !hidePreview && React.createElement("div", { style: { position: 'sticky', top: 0, zIndex: 20, background: T.bg, paddingBottom: 8, display: 'flex', justifyContent: 'center' } },
      React.createElement(CardPreview, { card: previewCard, globalUrl, aspectRatio, globalBgImage, previewWidth: Math.min(360, window.innerWidth - 32), onTextClick: handlePreviewTextClick, onCardUpdate: (obj) => updateMulti(obj), selectedHandle, onSelectHandle: handleSelectHandle }),
    ),

    // Tab pills
    React.createElement("div", { style: { display: 'flex', gap: 6, padding: '8px 0', overflowX: 'auto', flexShrink: 0 } },
      tabs.map(t => React.createElement(TabPill, { key: t.id, label: t.label, active: activeTab === t.id, onClick: () => { setActiveTab(t.id); setSelectedHandle(null); } })),
    ),

    // Tab content
    React.createElement("div", { style: { padding: '8px 0 20px' }, onTouchStart: (e) => e.stopPropagation(), onTouchMove: (e) => e.stopPropagation(), onTouchEnd: (e) => e.stopPropagation() },
      tabContent[activeTab] ? tabContent[activeTab]() : null,
    ),
  );
}

/* ── Desktop Card Panel (left preview + right tabs) ── */
const DESKTOP_TABS = [
  { id: 'fill', label: '클립 편집' },
  { id: 'layout', label: '\ub808\uc774\uc544\uc6c3' },
  { id: 'text', label: '\ud14d\uc2a4\ud2b8 \ub0b4\uc6a9' },
  { id: 'overlay', label: '\uC774\uBBF8\uC9C0 \uC624\uBC84\uB808\uC774' },
];

function DesktopCardPanel({ cards, activeIndex, onActiveChange, onCardChange, onRemove, onDuplicate, onAdd, globalUrl, aspectRatio, outputFormat, globalBgImage, onReorder, videoPreviewOn, onVideoPreviewToggle, previewMuted, onPreviewMuteToggle, previewVolume, onPreviewVolumeChange, onAspectRatioChange }) {
  const [activeTab, setActiveTab] = useState('fill');
  const [showDetailTitle, setShowDetailTitle] = useState(false);
  const [showDetailSubtitle, setShowDetailSubtitle] = useState(false);
  const [showDetailBody, setShowDetailBody] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameRef = useRef(null);
  const [animDir, setAnimDir] = useState(null);
  const prevIdxRef = useRef(activeIndex);
  const [selectedHandle, setSelectedHandle] = useState(null);
  const handleSelectHandle = (val) => {
    setSelectedHandle(val);
    if (val === 'textbox') setActiveTab('text');
    else if (val && val.startsWith('overlay-')) setActiveTab('overlay');
  };

  useEffect(() => {
    if (prevIdxRef.current !== activeIndex) {
      setAnimDir(activeIndex > prevIdxRef.current ? 'down' : 'up');
      prevIdxRef.current = activeIndex;
      setSelectedHandle(null);
      const t = setTimeout(() => setAnimDir(null), 300);
      return () => clearTimeout(t);
    }
  }, [activeIndex]);

  // Auto-scroll carousel to active card
  useEffect(() => {
    const el = document.getElementById('card-carousel');
    if (el && el.children[activeIndex]) {
      el.children[activeIndex].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeIndex]);

  const card = cards[activeIndex] || cards[0];
  const nextCard = activeIndex < cards.length - 1 ? cards[activeIndex + 1] : null;
  const prevCard = activeIndex > 0 ? cards[activeIndex - 1] : null;
  const update = (key, val) => onCardChange(activeIndex, { ...card, [key]: val });
  const updateMulti = (obj) => onCardChange(activeIndex, { ...card, ...obj });

  useEffect(() => { if (editingName && nameRef.current) nameRef.current.focus(); }, [editingName]);

  const displayName = card ? (card.name || card.title || card.subtitle || `\uce74\ub4dc ${activeIndex + 1}`) : '';
  const startEditName = () => { setEditingName(true); setNameValue(card.name || ''); };
  const commitName = () => { update('name', nameValue.trim()); setEditingName(false); };
  const pvCard = (c) => ({ ...c, title: c.useTitle !== false ? c.title : '', subtitle: c.useSubtitle !== false ? c.subtitle : '', body: c.useBody !== false ? c.body : '' });
  const goTo = (idx) => { if (idx >= 0 && idx < cards.length) { setSelectedHandle(null); onActiveChange(idx); } };

  const handlePreviewTextClick = (field) => {
    setActiveTab('text');
    setTimeout(() => {
      const el = document.getElementById('desk-text-' + field);
      if (el) el.focus();
    }, 50);
  };

  if (!card) return null;

  const btnSm = { background: 'rgba(255,255,255,0.05)', border: 'none', color: T.textMuted, fontSize: 12, cursor: 'pointer', padding: '5px 12px', borderRadius: T.radiusPill, transition: 'all 0.15s' };
  const navBtn = (dis) => ({ background: 'none', border: `1px solid ${dis ? T.border : T.borderHover}`, color: dis ? T.textMuted : T.textSecondary, fontSize: 11, cursor: dis ? 'default' : 'pointer', padding: '4px 8px', borderRadius: T.radiusSm, opacity: dis ? 0.4 : 1 });

  // \u2500\u2500 Fill Tab \u2500\u2500
  const renderFill = () => React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
    React.createElement("div", { style: { display: 'flex', gap: 6, marginBottom: 4 } },
      FILL_SOURCE_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: (card.fillSource || 'video') === opt.id, onClick: () => update("fillSource", opt.id) }, opt.label))
    ),
    (card.fillSource || 'video') === 'video' && React.createElement(React.Fragment, null,
      React.createElement("input", { type: "text", value: card.url, placeholder: "\uac1c\ubcc4 URL (\ube44\uc6cc\ub450\uba74 \uacf5\ud1b5 URL)", onChange: (e) => update("url", e.target.value), style: inputBase }),
      React.createElement(ClipSelector, { videoUrl: card.url || globalUrl, start: card.start, end: card.end, onStartChange: (v) => update("start", v), onEndChange: (v) => update("end", v), onClipChange: (s, e) => updateMulti({ start: s, end: e }), clipMuted: !previewMuted ? true : undefined, onClipUnmute: () => { if (onPreviewMuteToggle && !previewMuted) onPreviewMuteToggle(); }, onClipConfirmed: () => { if (!videoPreviewOn) onVideoPreviewToggle(); } }),
    ),
    (card.fillSource || 'video') === 'image' && React.createElement(ImageUploadField, { value: card.uploadedImage, onChange: (v) => update("uploadedImage", v) }),
    React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 } },
      React.createElement(SliderRow, { label: "\uc88c\uc6b0", value: card.videoX, min: 0, max: 100, step: 1, onChange: (v) => update("videoX", v), defaultValue: 50 }),
      React.createElement(SliderRow, { label: "\uc704\uc544\ub798", value: card.videoY, min: 0, max: 100, step: 1, onChange: (v) => update("videoY", v), defaultValue: 50 }),
      React.createElement(SliderRow, { label: "\ud655\ub300", value: card.videoScale || 110, min: 100, max: 200, step: 1, onChange: (v) => update("videoScale", v), defaultValue: 110 }),
      React.createElement(SliderRow, { label: "\ubc1d\uae30", value: card.videoBrightness || 0, min: -100, max: 100, step: 1, onChange: (v) => update("videoBrightness", v), suffix: '%', defaultValue: 0 }),
    ),
  );

  // \u2500\u2500 Layout Tab \u2500\u2500
  const renderLayout = () => React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
    React.createElement("div", { style: { display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto' } },
      LAYOUT_OPTIONS.map(opt => React.createElement(LayoutThumb, { key: opt.id, type: opt.id, label: opt.label, active: opt.id === 'gradient_fade' ? (card.layout === 'photo_top' && card.useGradient === true) : opt.id === 'photo_top' ? (card.layout === 'photo_top' && !card.useGradient) : card.layout === opt.id, onClick: () => updateMulti({ layout: opt.id === 'gradient_fade' ? 'photo_top' : opt.id, useGradient: opt.id === 'gradient_fade' }) }))
    ),
    // 카드 비율
    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6 } },
      React.createElement("span", { style: { fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap' } }, "\uCE74\uB4DC \uBE44\uC728"),
      ASPECT_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: aspectRatio === opt.id, onClick: () => onAspectRatioChange(opt.id) }, opt.label))
    ),
    card.layout !== "full_bg" && card.layout !== "text_box" && card.layout !== "none" && React.createElement(SliderRow, { label: "\ubc30\uacbd \uc601\uc5ed", value: 100 - (card.photoRatio ?? 50), min: 10, max: 80, step: 1, onChange: (v) => update("photoRatio", 100 - v), suffix: '%' }),
    // 텍스트 박스 설정
    card.layout === "text_box" && React.createElement("div", { style: { borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 8 } },
      React.createElement("div", { style: { fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 8 } }, "\ubc15\uc2a4 \uc124\uc815"),
      React.createElement(SliderRow, { label: "\uc88c\uc6b0 \uc704\uce58", value: card.textBoxX ?? 50, min: 0, max: 100, step: 1, onChange: (v) => update("textBoxX", v), suffix: '%', defaultValue: 50 }),
      React.createElement(SliderRow, { label: "\uc704\uc544\ub798 \uc704\uce58", value: card.textBoxY ?? 70, min: 0, max: 100, step: 1, onChange: (v) => update("textBoxY", v), suffix: '%', defaultValue: 70 }),
      React.createElement(SliderRow, { label: "\ubc15\uc2a4 \ub108\ube44", value: card.textBoxWidth ?? 80, min: 20, max: 100, step: 1, onChange: (v) => update("textBoxWidth", v), suffix: '%', defaultValue: 80 }),
      React.createElement(SliderRow, { label: "\ubc15\uc2a4 \ub192\uc774", value: card.textBoxHeight ?? 0, min: 0, max: 100, step: 1, onChange: (v) => update("textBoxHeight", v), suffix: (card.textBoxHeight ?? 0) === 0 ? ' \uc790\ub3d9' : '%', defaultValue: 0 }),
      React.createElement(SliderRow, { label: "\uc548\ucabd \uc5ec\ubc31", value: card.textBoxPadding ?? 20, min: 5, max: 60, step: 1, onChange: (v) => update("textBoxPadding", v), suffix: 'px', defaultValue: 20 }),
      React.createElement(SliderRow, { label: "\ub465\uae00\uae30", value: card.textBoxRadius ?? 12, min: 0, max: 40, step: 1, onChange: (v) => update("textBoxRadius", v), suffix: 'px', defaultValue: 12 }),
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 } },
        React.createElement("label", { style: { fontSize: 12, color: T.textMuted } }, "\ubc30\uacbd\uc0c9"),
        React.createElement("input", { type: "color", value: card.textBoxBgColor ?? "#000000", onChange: (e) => update("textBoxBgColor", e.target.value), style: { width: 32, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, cursor: 'pointer' } }),
        React.createElement("span", { style: { fontSize: 12, color: T.textMuted } }, card.textBoxBgColor ?? "#000000"),
      ),
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 } },
        React.createElement("div", { style: { flex: 1 } }, React.createElement(SliderRow, { label: "\ud22c\uba85\ub3c4", value: card.textBoxBgOpacity ?? 0.6, min: 0, max: 1, step: 0.01, onChange: (v) => update("textBoxBgOpacity", v), defaultValue: 0.6 })),
      ),
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 } },
        React.createElement("label", { style: { fontSize: 12, color: T.textMuted } }, "\ud14c\ub450\ub9ac \uc0c9"),
        React.createElement("input", { type: "color", value: card.textBoxBorderColor ?? "#ffffff", onChange: (e) => update("textBoxBorderColor", e.target.value), style: { width: 32, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, cursor: 'pointer' } }),
        React.createElement("span", { style: { fontSize: 12, color: T.textMuted } }, card.textBoxBorderColor ?? "#ffffff"),
      ),
      React.createElement(SliderRow, { label: "\ud14c\ub450\ub9ac \ub450\uaed8", value: card.textBoxBorderWidth ?? 0, min: 0, max: 10, step: 1, onChange: (v) => update("textBoxBorderWidth", v), suffix: 'px', defaultValue: 0 }),
    ),
    // 영상 채우기
    card.layout !== "full_bg" && card.layout !== "text_box" && card.layout !== "none" && React.createElement("div", { style: { marginTop: 4 } },
      React.createElement("label", { style: labelBase }, "\uc601\uc0c1 \ucc44\uc6b0\uae30"),
      React.createElement("div", { style: { display: 'flex', gap: 6 } },
        VIDEO_FILL_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: (card.videoFill || "full") === opt.id, onClick: () => update("videoFill", opt.id) }, opt.label))
      )
    ),
    // 텍스트 배경 설정 (text_box는 박스 설정에서 관리)
    card.layout !== "text_box" && card.layout !== "none" && React.createElement("div", { style: { borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 4 } },
      React.createElement(SectionTitleWithReset, { title: "\ud14d\uc2a4\ud2b8 \ubc30\uacbd \uc124\uc815", onReset: () => updateMulti({ useBg: true, bgColor: '#121212', bgOpacity: 0.75 }) }),
      React.createElement(CheckboxRow, { label: "\ubc30\uacbd\uc0c9 \uc0ac\uc6a9", checked: card.useBg !== false, onChange: (v) => update("useBg", v) }),
      card.useBg !== false && React.createElement(React.Fragment, null,
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 } },
          React.createElement("label", { style: { fontSize: 12, color: T.textMuted } }, "\uc0c9\uc0c1"),
          React.createElement("input", { type: "color", value: card.bgColor, onChange: (e) => update("bgColor", e.target.value), style: { width: 32, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, cursor: 'pointer' } }),
          React.createElement("span", { style: { fontSize: 12, color: T.textMuted } }, card.bgColor),
        ),
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 } },
          React.createElement("div", { style: { flex: 1 } }, React.createElement(SliderRow, { label: "\ud22c\uba85\ub3c4", value: card.bgOpacity, min: 0, max: 1, step: 0.01, onChange: (v) => update("bgOpacity", v), defaultValue: 0.75 })),
          React.createElement(CheckboxRow, { label: "\ud22c\uba85\ud558\uac8c", checked: card.bgOpacity === 0, onChange: (v) => update("bgOpacity", v ? 0 : 0.75) }),
        ),
      ),
    ),
  );

  // \u2500\u2500 Text Tab \u2500\u2500
  const setAllAlignDesk = (align) => updateMulti({ titleAlign: align, subtitleAlign: align, bodyAlign: align });
  const renderText = () => React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
    // 전체 정렬
    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: `1px solid ${T.border}`, marginBottom: 2 } },
      React.createElement("span", { style: { fontSize: 11, color: T.textMuted, flexShrink: 0 } }, "\uC804\uCCB4 \uC815\uB82C"),
      React.createElement("div", { style: { display: 'flex', gap: 3 } },
        [['left','\u2630 \uC88C'], ['center','\u2630 \uC911'], ['right','\u2630 \uC6B0']].map(([v, lb]) => React.createElement(PillBtn, { key: v, active: (card.titleAlign || 'left') === v && (card.subtitleAlign || 'left') === v && (card.bodyAlign || 'left') === v, onClick: () => setAllAlignDesk(v) }, lb))
      ),
    ),
    React.createElement(TextFieldRow, { inputId: "desk-text-title", value: card.title, onTextChange: (v) => update("title", v), placeholder: "\uc81c\ubaa9", size: card.titleSize, onSizeChange: (v) => update("titleSize", v), color: card.titleColor, onColorChange: (v) => update("titleColor", v), enabled: card.useTitle !== false, onToggle: () => update("useTitle", card.useTitle === false ? true : false) }),
    React.createElement("div", { onClick: () => setShowDetailTitle(!showDetailTitle), style: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', padding: '2px 0' } },
      React.createElement("span", { style: { fontSize: 10, color: T.textMuted, transition: 'transform 0.2s', transform: showDetailTitle ? 'rotate(90deg)' : 'rotate(0deg)' } }, "\u25B6"),
      React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, "\uc138\ubd80\uc870\uc815"),
    ),
    showDetailTitle && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 8, borderLeft: `2px solid ${T.border}`, marginBottom: 6 } },
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 } },
        React.createElement("span", { style: { fontSize: 11, color: T.textMuted, minWidth: 36 } }, "\uC815\uB82C"),
        React.createElement("div", { style: { display: 'flex', gap: 3 } },
          [['left','\u2630 \uC88C'], ['center','\u2630 \uC911'], ['right','\u2630 \uC6B0']].map(([v, lb]) => React.createElement(PillBtn, { key: v, active: (card.titleAlign || 'left') === v, onClick: () => update("titleAlign", v) }, lb))
        ),
      ),
      React.createElement(SliderRow, { label: "\uc790\uac04", value: card.titleLetterSpacing ?? 0, min: -5, max: 20, step: 0.5, onChange: (v) => update("titleLetterSpacing", v), suffix: 'px', defaultValue: 0 }),
      React.createElement(SliderRow, { label: "\uc904\uac04", value: card.titleLineHeight ?? 1.4, min: 1.0, max: 3.0, step: 0.1, onChange: (v) => update("titleLineHeight", v), suffix: '', defaultValue: 1.4 }),
      React.createElement(SliderRow, { label: "\uc88c\uc6b0", value: card.titleX ?? 0, min: -540, max: 540, step: 1, onChange: (v) => update("titleX", v), suffix: 'px', defaultValue: 0 }),
      React.createElement(SliderRow, { label: "\uc704\uc544\ub798", value: card.titleY ?? 0, min: -1080, max: 1080, step: 1, onChange: (v) => update("titleY", v), suffix: 'px', defaultValue: 0 }),
    ),
    React.createElement(TextFieldRow, { inputId: "desk-text-subtitle", value: card.subtitle, onTextChange: (v) => update("subtitle", v), placeholder: "\ubd80\uc81c\ubaa9", size: card.subtitleSize, onSizeChange: (v) => update("subtitleSize", v), color: card.subtitleColor, onColorChange: (v) => update("subtitleColor", v), enabled: card.useSubtitle !== false, onToggle: () => update("useSubtitle", card.useSubtitle === false ? true : false) }),
    React.createElement("div", { onClick: () => setShowDetailSubtitle(!showDetailSubtitle), style: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', padding: '2px 0' } },
      React.createElement("span", { style: { fontSize: 10, color: T.textMuted, transition: 'transform 0.2s', transform: showDetailSubtitle ? 'rotate(90deg)' : 'rotate(0deg)' } }, "\u25B6"),
      React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, "\uc138\ubd80\uc870\uc815"),
    ),
    showDetailSubtitle && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 8, borderLeft: `2px solid ${T.border}`, marginBottom: 6 } },
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 } },
        React.createElement("span", { style: { fontSize: 11, color: T.textMuted, minWidth: 36 } }, "\uC815\uB82C"),
        React.createElement("div", { style: { display: 'flex', gap: 3 } },
          [['left','\u2630 \uC88C'], ['center','\u2630 \uC911'], ['right','\u2630 \uC6B0']].map(([v, lb]) => React.createElement(PillBtn, { key: v, active: (card.subtitleAlign || 'left') === v, onClick: () => update("subtitleAlign", v) }, lb))
        ),
      ),
      React.createElement(SliderRow, { label: "\uc790\uac04", value: card.subtitleLetterSpacing ?? 0, min: -5, max: 20, step: 0.5, onChange: (v) => update("subtitleLetterSpacing", v), suffix: 'px', defaultValue: 0 }),
      React.createElement(SliderRow, { label: "\uc904\uac04", value: card.subtitleLineHeight ?? 1.4, min: 1.0, max: 3.0, step: 0.1, onChange: (v) => update("subtitleLineHeight", v), suffix: '', defaultValue: 1.4 }),
      React.createElement(SliderRow, { label: "\uc88c\uc6b0", value: card.subtitleX ?? 0, min: -540, max: 540, step: 1, onChange: (v) => update("subtitleX", v), suffix: 'px', defaultValue: 0 }),
      React.createElement(SliderRow, { label: "\uc704\uc544\ub798", value: card.subtitleY ?? 0, min: -1080, max: 1080, step: 1, onChange: (v) => update("subtitleY", v), suffix: 'px', defaultValue: 0 }),
    ),
    React.createElement(TextFieldRow, { inputId: "desk-text-body", value: card.body, onTextChange: (v) => update("body", v), placeholder: "\ubcf8\ubb38 \ub0b4\uc6a9", rows: 3, size: card.bodySize, onSizeChange: (v) => update("bodySize", v), color: card.bodyColor, onColorChange: (v) => update("bodyColor", v), enabled: card.useBody !== false, onToggle: () => update("useBody", card.useBody === false ? true : false) }),
    React.createElement("div", { onClick: () => setShowDetailBody(!showDetailBody), style: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', padding: '2px 0' } },
      React.createElement("span", { style: { fontSize: 10, color: T.textMuted, transition: 'transform 0.2s', transform: showDetailBody ? 'rotate(90deg)' : 'rotate(0deg)' } }, "\u25B6"),
      React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, "\uc138\ubd80\uc870\uc815"),
    ),
    showDetailBody && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 8, borderLeft: `2px solid ${T.border}`, marginBottom: 4 } },
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 } },
        React.createElement("span", { style: { fontSize: 11, color: T.textMuted, minWidth: 36 } }, "\uC815\uB82C"),
        React.createElement("div", { style: { display: 'flex', gap: 3 } },
          [['left','\u2630 \uC88C'], ['center','\u2630 \uC911'], ['right','\u2630 \uC6B0']].map(([v, lb]) => React.createElement(PillBtn, { key: v, active: (card.bodyAlign || 'left') === v, onClick: () => update("bodyAlign", v) }, lb))
        ),
      ),
      React.createElement(SliderRow, { label: "\uc790\uac04", value: card.bodyLetterSpacing ?? 0, min: -5, max: 20, step: 0.5, onChange: (v) => update("bodyLetterSpacing", v), suffix: 'px', defaultValue: 0 }),
      React.createElement(SliderRow, { label: "\uc904\uac04", value: card.bodyLineHeight ?? 1.4, min: 1.0, max: 3.0, step: 0.1, onChange: (v) => update("bodyLineHeight", v), suffix: '', defaultValue: 1.4 }),
      React.createElement(SliderRow, { label: "\uc88c\uc6b0", value: card.bodyX ?? 0, min: -540, max: 540, step: 1, onChange: (v) => update("bodyX", v), suffix: 'px', defaultValue: 0 }),
      React.createElement(SliderRow, { label: "\uc704\uc544\ub798", value: card.bodyY ?? 0, min: -1080, max: 1080, step: 1, onChange: (v) => update("bodyY", v), suffix: 'px', defaultValue: 0 }),
    ),
  );

  // \u2500\u2500 Overlay Tab \u2500\u2500
  const renderOverlay = () => React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
    React.createElement("div", { style: { maxHeight: 480, overflowY: 'auto' } },
      (card.overlays || []).map((ov, oi) => React.createElement("div", { key: oi, style: { marginBottom: 8, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: T.radiusSm, border: selectedHandle === 'overlay-' + oi ? `1.5px solid ${T.accent}` : `1px solid ${T.border}` } },
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 } },
          React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement("span", { style: { fontSize: 12, color: T.textSecondary, fontWeight: 500 } }, `\uc774\ubbf8\uc9c0 ${oi + 1}`),
            React.createElement("div", { onClick: () => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], aboveLayout: !ov.aboveLayout}; update("overlays", ovs); }, style: { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' } },
              React.createElement("div", { style: { width: 24, height: 12, borderRadius: 6, background: ov.aboveLayout ? T.accent : 'rgba(255,255,255,0.2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 } },
                React.createElement("div", { style: { width: 8, height: 8, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: ov.aboveLayout ? 14 : 2, transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' } })
              ),
              React.createElement("span", { style: { fontSize: 10, color: ov.aboveLayout ? '#fff' : 'rgba(255,255,255,0.4)', userSelect: 'none' } }, "\ub808\uc774\uc544\uc6c3 \uc704\uc5d0 \ud45c\uc2dc"),
            ),
          ),
          React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 4 } },
            React.createElement("button", { disabled: oi === 0, onClick: () => { const ovs = [...(card.overlays||[])]; const t = ovs[oi]; ovs[oi] = ovs[oi-1]; ovs[oi-1] = t; update("overlays", ovs); }, style: { background: 'rgba(255,255,255,0.06)', border: 'none', color: oi === 0 ? T.textMuted : T.textSecondary, fontSize: 11, cursor: oi === 0 ? 'default' : 'pointer', padding: '2px 6px', borderRadius: T.radiusPill, opacity: oi === 0 ? 0.4 : 1 } }, "\u25B2"),
            React.createElement("button", { disabled: oi === (card.overlays||[]).length - 1, onClick: () => { const ovs = [...(card.overlays||[])]; const t = ovs[oi]; ovs[oi] = ovs[oi+1]; ovs[oi+1] = t; update("overlays", ovs); }, style: { background: 'rgba(255,255,255,0.06)', border: 'none', color: oi === (card.overlays||[]).length - 1 ? T.textMuted : T.textSecondary, fontSize: 11, cursor: oi === (card.overlays||[]).length - 1 ? 'default' : 'pointer', padding: '2px 6px', borderRadius: T.radiusPill, opacity: oi === (card.overlays||[]).length - 1 ? 0.4 : 1 } }, "\u25BC"),
            React.createElement("button", { onClick: () => { setSelectedHandle(null); const ovs = [...(card.overlays||[])]; ovs.splice(oi, 1); update("overlays", ovs); }, style: { background: 'rgba(239,68,68,0.1)', border: 'none', color: T.danger, fontSize: 11, cursor: 'pointer', padding: '2px 8px', borderRadius: T.radiusPill } }, "\uc0ad\uc81c"),
          ),
        ),
        React.createElement(ImageUploadField, { value: ov.image, onChange: (v) => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], image: v}; update("overlays", ovs); }, maxMb: 5 }),
        ov.image && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 } },
          React.createElement(SliderRow, { label: "\uc88c\uc6b0", value: ov.x ?? 50, min: 0, max: 100, step: 1, onChange: (v) => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], x: v}; update("overlays", ovs); } }),
          React.createElement(SliderRow, { label: "\uc704\uc544\ub798", value: ov.y ?? 50, min: 0, max: 100, step: 1, onChange: (v) => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], y: v}; update("overlays", ovs); } }),
          React.createElement(SliderRow, { label: "\ud06c\uae30", value: ov.scale ?? 100, min: 10, max: 300, step: 1, onChange: (v) => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], scale: v}; update("overlays", ovs); }, suffix: '%' }),
          React.createElement(SliderRow, { label: "\ud22c\uba85\ub3c4", value: ov.opacity ?? 1, min: 0, max: 1, step: 0.01, onChange: (v) => { const ovs = [...(card.overlays||[])]; ovs[oi] = {...ovs[oi], opacity: v}; update("overlays", ovs); } }),
        ),
      )),
    ),
    React.createElement("button", {
      onClick: () => update("overlays", [...(card.overlays||[]), { image: null, x: 50, y: 50, scale: 100, opacity: 1 }]),
      style: { width: '100%', padding: '10px', border: `1.5px dashed ${T.border}`, borderRadius: T.radiusSm, background: 'transparent', color: T.textSecondary, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' },
      onMouseEnter: (e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; },
      onMouseLeave: (e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSecondary; },
    }, "+ \uc774\ubbf8\uc9c0 \ucd94\uac00"),
  );

  const tabRenderers = { fill: renderFill, layout: renderLayout, text: renderText, overlay: renderOverlay };

  // \u2500\u2500 Render \u2500\u2500
  return React.createElement("div", { style: { display: 'flex', background: T.surface, borderRadius: T.radius, boxShadow: T.shadow, overflow: 'hidden', minHeight: 'calc(100vh - 230px)' } },
    React.createElement("style", null, "@keyframes slideFromBelow { from { transform: translateY(30px); opacity: 0.5; } to { transform: translateY(0); opacity: 1; } } @keyframes slideFromAbove { from { transform: translateY(-30px); opacity: 0.5; } to { transform: translateY(0); opacity: 1; } } #card-carousel::-webkit-scrollbar { display: none; }"),
    // ── LEFT: Preview (compact) ──
    React.createElement("div", { style: { width: 420, flexShrink: 0, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', background: T.bg } },
      // Top bar: nav + card name only
      React.createElement("div", { style: { padding: '4px 10px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 6, background: T.surface, flexShrink: 0 } },
        React.createElement("button", { onClick: () => goTo(activeIndex - 1), disabled: activeIndex === 0, style: navBtn(activeIndex === 0) }, "\u25C0"),
        React.createElement("span", { style: { width: 22, height: 22, borderRadius: T.radiusPill, background: T.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 } }, activeIndex + 1),
        editingName
          ? React.createElement("input", { ref: nameRef, value: nameValue, onChange: (e) => setNameValue(e.target.value), onBlur: commitName, onKeyDown: (e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }, onClick: (e) => e.stopPropagation(), style: { background: 'transparent', border: `1px solid ${T.accent}`, color: T.text, fontSize: 12, fontWeight: 500, outline: 'none', padding: '2px 6px', borderRadius: 4, flex: 1, minWidth: 0 } })
          : React.createElement("span", { onClick: startEditName, style: { color: T.text, fontWeight: 500, fontSize: 12, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 } }, displayName),
        React.createElement("button", { onClick: () => goTo(activeIndex + 1), disabled: activeIndex >= cards.length - 1, style: navBtn(activeIndex >= cards.length - 1) }, "\u25B6"),
        React.createElement("span", { style: { fontSize: 11, color: T.textMuted, flexShrink: 0 } }, `${activeIndex + 1}/${cards.length}`),
      ),
      // Card preview area (reduced padding)
      React.createElement("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px 14px', overflow: 'hidden' } },
        React.createElement("div", {
          key: 'card-' + activeIndex,
          style: {
            animation: animDir ? (animDir === 'down' ? 'slideFromBelow 0.3s cubic-bezier(0.4,0,0.2,1)' : 'slideFromAbove 0.3s cubic-bezier(0.4,0,0.2,1)') : 'none',
            borderRadius: T.radius,
            maxWidth: '100%',
          },
        },
          React.createElement(CardPreview, { card: pvCard(card), globalUrl, aspectRatio, globalBgImage, previewWidth: 360, videoPreviewOn, previewMuted, previewVolume, onTextClick: handlePreviewTextClick, onCardUpdate: (obj) => updateMulti(obj), selectedHandle, onSelectHandle: handleSelectHandle })
        ),
        videoPreviewOn && React.createElement("div", { style: { fontSize: 10, color: T.textMuted, textAlign: 'center', marginTop: 4 } }, "\uC601\uC0C1 \uC81C\uBAA9\xB7\uAD11\uACE0 \uD45C\uC2DC \uB4F1\uC774 \uBCF4\uC77C \uC218 \uC788\uC9C0\uB9CC, \uC2E4\uC81C \uCE74\uB4DC\uC5D0\uB294 \uD3EC\uD568\uB418\uC9C0 \uC54A\uC544\uC694"),
      ),
      // Bottom bar: carousel + actions + toggle
      React.createElement("div", { style: { borderTop: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 } },
        // Carousel row
        React.createElement("div", { style: { padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 3 } },
          React.createElement("button", {
            onClick: () => { const el = document.getElementById('card-carousel'); if (el) el.scrollBy({ left: -120, behavior: 'smooth' }); },
            style: { background: 'none', border: 'none', color: T.textMuted, fontSize: 12, cursor: 'pointer', padding: '1px 3px', flexShrink: 0 },
          }, "\u25C0"),
          React.createElement("div", {
            id: 'card-carousel',
            style: { display: 'flex', gap: 5, flex: 1, overflowX: 'auto', scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '3px 2px' },
          },
            cards.map((c, i) => React.createElement("div", {
              key: c.id,
              onClick: () => goTo(i),
              style: {
                width: 38, height: aspectRatio === '3:4' ? 51 : 38, flexShrink: 0, borderRadius: 3, overflow: 'hidden', cursor: 'pointer',
                boxShadow: i === activeIndex ? '0 0 0 2px ' + T.accent : '0 0 0 1px ' + T.border,
                opacity: i === activeIndex ? 1 : 0.55,
                transition: 'all 0.15s',
              },
            },
              React.createElement(CardPreview, { card: pvCard(c), globalUrl, aspectRatio, globalBgImage, previewWidth: 38 })
            ))
          ),
          React.createElement("button", {
            onClick: () => { const el = document.getElementById('card-carousel'); if (el) el.scrollBy({ left: 120, behavior: 'smooth' }); },
            style: { background: 'none', border: 'none', color: T.textMuted, fontSize: 12, cursor: 'pointer', padding: '1px 3px', flexShrink: 0 },
          }, "\u25B6"),
        ),
        // Actions row + video toggle
        React.createElement("div", { style: { padding: '3px 10px 3px', display: 'flex', alignItems: 'center', gap: 4, borderTop: `1px solid ${T.border}` } },
          React.createElement("button", { onClick: onAdd, style: { ...btnSm, padding: '3px 10px', fontSize: 10, background: 'rgba(99,102,241,0.1)', color: T.accent } }, "+ \uCD94\uAC00"),
          React.createElement("button", { onClick: () => onDuplicate(activeIndex), style: { ...btnSm, padding: '3px 8px', fontSize: 10 } }, "\uBCF5\uC81C"),
          React.createElement("button", { onClick: onReorder, style: { ...btnSm, padding: '3px 8px', fontSize: 10 } }, "\u2630 \uC21C\uC11C"),
          cards.length > 1 && React.createElement("button", { onClick: () => { onRemove(activeIndex); if (activeIndex >= cards.length - 1) onActiveChange(Math.max(0, activeIndex - 1)); }, style: { ...btnSm, padding: '3px 8px', fontSize: 10, background: 'rgba(239,68,68,0.1)', color: T.danger } }, "\uC0AD\uC81C"),
          // Video preview toggle (right-aligned)
          React.createElement("div", { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 } },
            React.createElement("div", {
              onClick: onVideoPreviewToggle,
              style: { width: 28, height: 14, borderRadius: 7, background: videoPreviewOn ? T.accent : T.border, position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 },
            },
              React.createElement("div", { style: { width: 10, height: 10, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: videoPreviewOn ? 16 : 2, transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' } })
            ),
            React.createElement("span", { onClick: onVideoPreviewToggle, style: { fontSize: 10, color: T.textMuted, cursor: 'pointer', userSelect: 'none' } }, "\uBBF8\uB9AC\uBCF4\uAE30"),
            videoPreviewOn && React.createElement("div", {
              onClick: onPreviewMuteToggle,
              style: { width: 22, height: 22, borderRadius: '50%', background: previewMuted ? 'rgba(255,255,255,0.06)' : 'rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', marginLeft: 2 },
            },
              React.createElement("span", { style: { fontSize: 12, lineHeight: 1 } }, previewMuted ? "\uD83D\uDD07" : "\uD83D\uDD0A")
            ),
            videoPreviewOn && !previewMuted && React.createElement("input", {
              type: 'range', min: 0, max: 100, step: 5, value: previewVolume,
              onChange: (e) => onPreviewVolumeChange(Number(e.target.value)),
              style: { width: 80, height: 14, accentColor: T.accent, cursor: 'pointer', marginLeft: 2 },
            }),
          ),
        ),
      ),
    ),
    // \u2500\u2500 RIGHT: Tabs \u2500\u2500
    React.createElement("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 } },
      // Card info header
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px 8px', borderBottom: '1px solid ' + T.border, flexShrink: 0, background: T.surface } },
        React.createElement("span", { style: { width: 28, height: 28, borderRadius: T.radiusPill, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 } }, activeIndex + 1),
        React.createElement("span", { style: { fontSize: 14, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 } }, displayName),
        React.createElement("span", { style: { fontSize: 12, color: T.textMuted, flexShrink: 0 } }, (activeIndex + 1) + ' / ' + cards.length + '\uc7a5'),
      ),
      // Tab bar
      React.createElement("div", { style: { display: 'flex', gap: 4, padding: '8px 20px 8px', borderBottom: `1px solid ${T.border}`, flexShrink: 0, background: T.surface } },
        DESKTOP_TABS.map(t => React.createElement(TabPill, { key: t.id, label: t.label, active: activeTab === t.id, onClick: () => { setActiveTab(t.id); setSelectedHandle(null); } }))
      ),
      React.createElement("div", { style: { flex: 1, overflowY: 'auto', padding: '16px 20px 24px' } },
        tabRenderers[activeTab] ? tabRenderers[activeTab]() : null
      ),
    ),
  );
}


/* ── App ── */
export default function App() {
  const mob = useIsMobile();
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [showJson, setShowJson] = useState(false);
  const [jsonStr, setJsonStr] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [results, setResults] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [confirmClose, setConfirmClose] = useState(null);
  const [shareUrl, setShareUrl] = useState(null);
  const [importProject, setImportProject] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [videoPreviewOn, setVideoPreviewOn] = useState(true);
  const [previewMuted, setPreviewMuted] = useState(true);
  const [previewVolume, setPreviewVolume] = useState(80);
  const [showPreview, setShowPreview] = useState(false);
  const [showGeneratingModal, setShowGeneratingModal] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [mobilePreviewExpanded, setMobilePreviewExpanded] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [editorMode, setEditorMode] = useState(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState({ url: '', aspectRatio: '1:1', cardCount: 3, presetId: 'photo_top' });
  const [wizardLoading, setWizardLoading] = useState(false);
  const [pendingProjectId, setPendingProjectId] = useState(null);
  const infoRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const activeJobIdRef = useRef(null);

  // Close info panel on outside click
  useEffect(() => {
    const handler = (e) => { if (showInfo && infoRef.current && !infoRef.current.contains(e.target)) setShowInfo(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showInfo]);

  // Load from localStorage on mount + URL-based initial mode
  useEffect(() => {
    const saved = loadProjects();
    if (saved) {
      setProjects(saved.projects);
      setActiveProjectId(saved.activeId || saved.projects[0]?.id);
    } else {
      const first = DEFAULT_PROJECT('\uD504\uB85C\uC81D\uD2B8 1');
      setProjects([first]);
      setActiveProjectId(first.id);
      setPendingProjectId(first.id);
    }
    const path = window.location.pathname;
    if (path === '/share') {
      const params = new URLSearchParams(window.location.search);
      const d = params.get('d');
      if (d) {
        try {
          const decoded = decodeProject(d);
          if (decoded) { setImportProject(decoded); }
          else { alert('\uC798\uBABB\uB41C \uACF5\uC720 \uB9C1\uD06C\uC608\uC694'); }
        } catch (e) { alert('\uC798\uBABB\uB41C \uACF5\uC720 \uB9C1\uD06C\uC608\uC694'); }
      }
      setEditorMode('editor');
    } else if (path === '/easy') {
      setEditorMode('wizard');
      setWizardStep(1);
    } else if (path === '/free') {
      setEditorMode('editor');
    } else {
      setEditorMode(null);
    }
  }, []);

  // Sync editorMode → URL (shallow)
  useEffect(() => {
    if (editorMode === null && wizardLoading) return;
    if (importProject) return; // don't change URL while import dialog is open
    const targetPath = editorMode === 'wizard' ? '/easy' : editorMode === 'editor' ? '/free' : '/';
    if (window.location.pathname !== targetPath) {
      router.push(targetPath, undefined, { shallow: true });
    }
  }, [editorMode, wizardLoading, importProject]);

  // Handle browser back/forward
  useEffect(() => {
    const onRouteChange = (url) => {
      if (wizardLoading) return;
      const p = url.split('?')[0];
      if (p === '/easy' && editorMode !== 'wizard') { setEditorMode('wizard'); setWizardStep(1); }
      else if (p === '/free' && editorMode !== 'editor') { setEditorMode('editor'); }
      else if (p === '/' && editorMode !== null) { setEditorMode(null); }
    };
    router.events.on('routeChangeComplete', onRouteChange);
    return () => router.events.off('routeChangeComplete', onRouteChange);
  }, [editorMode, wizardLoading, router]);

  // Visitor tracking
  useEffect(() => {
    const startTime = Date.now();
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'visit' }) }).catch(() => {});
    const sendDuration = () => {
      const duration = Math.round((Date.now() - startTime) / 1000);
      if (duration > 0) navigator.sendBeacon('/api/track', new Blob([JSON.stringify({ type: 'duration', duration })], { type: 'application/json' }));
    };
    const onVisChange = () => { if (document.visibilityState === 'hidden') sendDuration(); };
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('beforeunload', sendDuration);
    return () => { document.removeEventListener('visibilitychange', onVisChange); window.removeEventListener('beforeunload', sendDuration); };
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    if (projects.length > 0 && activeProjectId) saveProjects(projects, activeProjectId);
  }, [projects, activeProjectId]);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];
  const globalUrl = activeProject?.globalUrl || '';
  const outputFormat = activeProject?.outputFormat || 'video';
  const outputSize = activeProject?.outputSize || 1080;
  const aspectRatio = activeProject?.aspectRatio || '1:1';
  const globalImageSource = activeProject?.globalImageSource || 'thumbnail';
  const globalBgImage = activeProject?.globalBgImage || null;
  const cards = activeProject?.cards || [];

  const updateProject = useCallback((updates) => {
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, ...updates } : p));
  }, [activeProjectId]);

  const setGlobalUrl = (v) => updateProject({ globalUrl: v });
  const setOutputFormat = (v) => updateProject({ outputFormat: v });
  const setOutputSize = (v) => updateProject({ outputSize: v });
  const setAspectRatio = (v) => updateProject({ aspectRatio: v });
  const setGlobalImageSource = (v) => updateProject({ globalImageSource: v });
  const setGlobalBgImage = (v) => updateProject({ globalBgImage: v });
  const setCards = (updater) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const newCards = typeof updater === 'function' ? updater(p.cards) : updater;
      return { ...p, cards: newCards };
    }));
  };

  const updateCard = (i, c) => setCards(p => p.map((x, j) => j === i ? c : x));
  const removeCard = (i) => setCards(p => p.filter((_, j) => j !== i));
  const duplicateCard = (i) => setCards(p => { const n = [...p]; n.splice(i+1, 0, { ...p[i], id: Date.now() + Math.random() }); return n; });
  const addCard = () => setCards(p => [...p, { ...DEFAULT_CARD(), url: globalUrl || "" }]);

  // Project tab actions
  const addProject = () => {
    const name = prompt('\uC0C8 \uD504\uB85C\uC81D\uD2B8 \uC774\uB984\uC744 \uC785\uB825\uD558\uC138\uC694:', `\uD504\uB85C\uC81D\uD2B8 ${projects.length + 1}`);
    if (!name?.trim()) return;
    const proj = DEFAULT_PROJECT(name.trim());
    setProjects(prev => [...prev, proj]);
    setActiveProjectId(proj.id);
    setGenProgress(''); setResults([]);
    setEditorMode(null);
    setWizardStep(1);
    setWizardData({ url: '', aspectRatio: '1:1', cardCount: 3, presetId: 'photo_top' });
    setPendingProjectId(proj.id);
  };

  const closeProject = (id) => { setConfirmClose(id); };

  const confirmCloseProject = () => {
    const id = confirmClose;
    setConfirmClose(null);
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id);
      if (activeProjectId === id && next.length > 0) {
        setActiveProjectId(next[0].id);
      }
      return next;
    });
    setGenProgress(''); setResults([]);
  };

  const renameProject = (id, name) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  const switchProject = (id) => {
    setActiveProjectId(id);
    setGenProgress(''); setResults([]);
  };

  const shareProject = () => {
    if (!activeProject) return;
    const encoded = encodeProject(activeProject);
    const url = `${window.location.origin}/share?d=${encoded}`;
    if (url.length > 8000) {
      alert('\uD504\uB85C\uC81D\uD2B8\uAC00 \uB108\uBB34 \uCEE4\uC11C \uB9C1\uD06C\uB85C \uACF5\uC720\uD560 \uC218 \uC5C6\uC5B4\uC694.\n\uC5C5\uB85C\uB4DC\uB41C \uC774\uBBF8\uC9C0\uB97C \uC904\uC5EC\uBCF4\uC138\uC694.');
      return;
    }
    if (navigator.clipboard) navigator.clipboard.writeText(url);
    setShareUrl(url);
  };

  const handleImport = () => {
    if (!importProject) return;
    setProjects(prev => [...prev, importProject]);
    setActiveProjectId(importProject.id);
    setEditorMode('editor');
    setGenProgress(''); setResults([]);
    setImportProject(null);
    router.push('/free', undefined, { shallow: true });
  };

  const effectiveCard = (card) => ({
    ...card,
    title: card.useTitle !== false ? card.title : '',
    subtitle: card.useSubtitle !== false ? card.subtitle : '',
    body: card.useBody !== false ? card.body : '',
  });

  const buildConfig = (card) => {
    const c = effectiveCard(card);
    return {
      start: c.start, end: c.end, layout: c.layout, photo_ratio: c.photoRatio,
      video_fill: c.videoFill || 'full',
      title: c.title, title_size: c.titleSize, title_font: c.titleFont, title_color: c.titleColor,
      subtitle: c.subtitle, subtitle_size: c.subtitleSize, subtitle_font: c.subtitleFont, subtitle_color: c.subtitleColor,
      body: c.body, body_size: c.bodySize, body_font: c.bodyFont, body_color: c.bodyColor,
      text_bg_color: hexToRgb(c.bgColor), text_bg_opacity: c.useBg !== false ? c.bgOpacity : 0,
      video_position: [c.videoX, c.videoY], video_scale: c.videoScale || 110, video_brightness: c.videoBrightness || 0,
      output_size: outputSize,
      aspect_ratio: aspectRatio,
      fill_source: c.fillSource || 'video',
      image_source: c.fillSource === 'image' ? 'upload' : 'thumbnail',
      ...(c.url && c.url !== globalUrl ? { url: c.url } : {}),
      ...(c.captureTime ? { capture_time: c.captureTime } : {}),
    };
  };

  const exportJson = () => {
    const url = globalUrl || cards[0]?.url || "";
    const config = { url, output_format: outputFormat, output_size: outputSize, aspect_ratio: aspectRatio, cards: cards.map(buildConfig) };
    setJsonStr(JSON.stringify(config, null, 2)); setShowJson(true);
  };

  const handleGenerate = async () => {
    const url = globalUrl || cards[0]?.url || "";
    if (!url) { alert("영상 URL을 입력하세요."); return; }
    for (let i = 0; i < cards.length; i++) {
      if (!cards[i].start || !cards[i].end) { alert(`카드 ${i + 1}의 시작/종료 시간을 입력하세요.`); return; }
    }
    setGenerating(true); setResults([]); setGenProgress("오버레이 생성 중..."); setShowGeneratingModal(true);
    try {
      const overlays = [];
      for (let i = 0; i < cards.length; i++) {
        setGenProgress(`카드 ${i + 1}/${cards.length} 오버레이 생성 중...`);
        overlays.push(await generateOverlayPng(effectiveCard(cards[i]), outputSize, aspectRatio));
      }
      setGenProgress("서버에 요청 중...");
      const res = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, outputFormat, outputSize, aspectRatio, cards: cards.map((card, i) => ({ cardConfig: buildConfig(card), overlayData: overlays[i] })) }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "서버 요청 실패"); }
      const { jobId, cardCount } = await res.json();
      activeJobIdRef.current = jobId;
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/jobs/${jobId}`);
          if (!statusRes.ok) return;
          const status = await statusRes.json();
          let completedCards = 0, failedCards = 0, totalProgress = 0;
          const downloadUrls = [];
          for (const c of (status.cards || [])) {
            if (c.status === "completed") { completedCards++; totalProgress += 100; if (c.downloadUrl) downloadUrls.push(c.downloadUrl); }
            else if (c.status === "failed") { failedCards++; totalProgress += 100; }
            else totalProgress += (c.progress || 0);
          }
          setGenProgress(`${completedCards}/${cardCount}개 완료 (${Math.round(totalProgress / cardCount)}%)`);
          if (completedCards + failedCards >= cardCount) {
            clearInterval(pollInterval); pollIntervalRef.current = null; activeJobIdRef.current = null; setResults(downloadUrls);
            const failedErrors = (status.cards || []).filter(c => c.status === 'failed').map(c => `\uCE74\uB4DC ${c.cardIdx + 1}: ${c.error || '\uC54C \uC218 \uC5C6\uB294 \uC624\uB958'}`);
            setGenProgress(`완료! ${completedCards}/${cardCount}개 생성됨${failedCards > 0 ? ` \u00B7 ${failedCards}개 실패` : ""}`);
            if (failedErrors.length > 0) alert(`\uC0DD\uC131 \uC2E4\uD328:\n${failedErrors.join('\n')}`);
            setGenerating(false);
          }
        } catch (e) {}
      }, 1500);
      pollIntervalRef.current = pollInterval;
    } catch (err) { alert(`오류: ${err.message}`); setGenProgress(""); setGenerating(false); }
  };

  const handleDownloadAll = async () => {
    if (results.length === 0) return;
    setDownloading(true);
    try { await downloadAllAsZip(results, outputFormat); }
    catch (e) { alert('ZIP \uB2E4\uC6B4\uB85C\uB4DC \uC2E4\uD328: ' + e.message); }
    finally { setDownloading(false); }
  };

  const generateWizardCards = (d) => {
    const preset = STYLE_PRESETS.find(p => p.id === d.presetId) || STYLE_PRESETS[0];
    const count = d.cardCount || 3;
    const newCards = [];
    for (let i = 0; i < count; i++) {
      const card = DEFAULT_CARD();
      card.url = d.url || '';
      card.layout = preset.layout;
      card.bgColor = preset.bgColor;
      card.bgOpacity = preset.bgOpacity;
      card.useGradient = preset.useGradient || false;
      card.titleColor = preset.titleColor;
      card.subtitleColor = preset.subtitleColor;
      card.bodyColor = preset.bodyColor;
      card.titleSize = preset.titleSize;
      card.subtitleSize = preset.subtitleSize;
      card.bodySize = preset.bodySize;
      card.titleAlign = preset.titleAlign;
      card.subtitleAlign = preset.subtitleAlign;
      card.bodyAlign = preset.bodyAlign;
      if (preset.photoRatio != null) card.photoRatio = preset.photoRatio;
      if (preset.textBoxX != null) card.textBoxX = preset.textBoxX;
      if (preset.textBoxY != null) card.textBoxY = preset.textBoxY;
      if (preset.textBoxWidth != null) card.textBoxWidth = preset.textBoxWidth;
      if (preset.textBoxPadding != null) card.textBoxPadding = preset.textBoxPadding;
      if (preset.textBoxRadius != null) card.textBoxRadius = preset.textBoxRadius;
      if (preset.textBoxBgColor != null) card.textBoxBgColor = preset.textBoxBgColor;
      if (preset.textBoxBgOpacity != null) card.textBoxBgOpacity = preset.textBoxBgOpacity;
      const startSec = i * 10;
      const endSec = (i + 1) * 10;
      card.start = Math.floor(startSec / 60) + ':' + String(startSec % 60).padStart(2, '0');
      card.end = Math.floor(endSec / 60) + ':' + String(endSec % 60).padStart(2, '0');
      card.title = `\uCE74\uB4DC ${i + 1} \uC81C\uBAA9`;
      card.subtitle = `\uCE74\uB4DC ${i + 1} \uBD80\uC81C\uBAA9`;
      card.body = '\uBCF8\uBB38 \uB0B4\uC6A9\uC744 \uC785\uB825\uD558\uC138\uC694';
      newCards.push(card);
    }
    return newCards;
  };

  const handleWizardComplete = () => {
    setWizardLoading(true);
    setTimeout(() => {
      const newCards = generateWizardCards(wizardData);
      const targetId = pendingProjectId || activeProjectId;
      setProjects(prev => prev.map(p => {
        if (p.id !== targetId) return p;
        return { ...p, globalUrl: wizardData.url, aspectRatio: wizardData.aspectRatio, cards: newCards };
      }));
      setActiveProjectId(targetId);
      setTimeout(() => {
        setWizardLoading(false);
        setEditorMode('editor');
      }, 700);
    }, 4800);
  };

  return React.createElement("div", { style: { ...(mob ? { height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" } : { minHeight: "100vh" }), background: T.bg } },
    React.createElement(Head, null,
      React.createElement("title", null, "YOUMECA - \uC720\uBA54\uCE74, \uC720\uD29C\uBE0C \uC601\uC0C1\uC744 \uCE74\uB4DC\uB274\uC2A4\uB85C"),
      React.createElement("meta", { name: "description", content: "\uB0B4\uAC00 \uAFC8\uAFB8\uB358 \uCE74\uB4DC\uB274\uC2A4 \uC0DD\uC131\uAE30" }),
      React.createElement("meta", { property: "og:type", content: "website" }),
      React.createElement("meta", { property: "og:url", content: "https://youmeca.me" }),
      React.createElement("meta", { property: "og:title", content: "YOUMECA - \uC720\uBA54\uCE74, \uC720\uD29C\uBE0C \uC601\uC0C1\uC744 \uCE74\uB4DC\uB274\uC2A4\uB85C" }),
      React.createElement("meta", { property: "og:description", content: "\uB0B4\uAC00 \uAFC8\uAFB8\uB358 \uCE74\uB4DC\uB274\uC2A4 \uC0DD\uC131\uAE30" }),
      React.createElement("meta", { property: "og:image", content: "https://youmeca.me/og-image.png" }),
      React.createElement("meta", { property: "og:image:type", content: "image/png" }),
      React.createElement("meta", { property: "og:image:width", content: "1200" }),
      React.createElement("meta", { property: "og:image:height", content: "630" }),
      React.createElement("meta", { property: "og:site_name", content: "YOUMECA" }),
      React.createElement("meta", { property: "og:locale", content: "ko_KR" }),
      React.createElement("meta", { name: "twitter:card", content: "summary_large_image" }),
      React.createElement("meta", { name: "twitter:title", content: "YOUMECA - \uC720\uBA54\uCE74, \uC720\uD29C\uBE0C \uC601\uC0C1\uC744 \uCE74\uB4DC\uB274\uC2A4\uB85C" }),
      React.createElement("meta", { name: "twitter:description", content: "\uB0B4\uAC00 \uAFC8\uAFB8\uB358 \uCE74\uB4DC\uB274\uC2A4 \uC0DD\uC131\uAE30" }),
      React.createElement("meta", { name: "twitter:image", content: "https://youmeca.me/og-image.png" }),
      React.createElement("link", { rel: "icon", href: "/favicon.ico" }),
      React.createElement("link", { rel: "apple-touch-icon", href: "/icon-192.png" }),
      React.createElement("meta", { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" }),
      React.createElement("meta", { name: "theme-color", content: "#09090b" }),
      React.createElement("link", { rel: "preconnect", href: "https://fonts.googleapis.com" }),
      React.createElement("link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" }),
      React.createElement("link", { href: "https://fonts.googleapis.com/css2?family=Bitcount+Prop+Single&display=swap", rel: "stylesheet" }),
    ),

    editorMode === null && React.createElement(ModeSelectionScreen, {
      mob,
      onSelectEasy: () => { setEditorMode('wizard'); setWizardStep(1); setWizardData({ url: '', aspectRatio: '1:1', cardCount: 3, presetId: 'photo_top' }); },
      onSelectFree: () => { setEditorMode('editor'); },
    }),

    editorMode === 'wizard' && !wizardLoading && React.createElement(WizardScreen, {
      mob, step: wizardStep, data: wizardData,
      onDataChange: setWizardData,
      onNext: () => setWizardStep(s => Math.min(s + 1, 3)),
      onBack: () => setWizardStep(s => Math.max(s - 1, 1)),
      onComplete: handleWizardComplete,
      onCancel: () => { setEditorMode(null); setWizardStep(1); },
    }),

    wizardLoading && React.createElement(WizardLoadingScreen, { mob }),

    // ── Editor ──
    editorMode === 'editor' && React.createElement(React.Fragment, null,
    React.createElement("header", { style: { ...(mob ? { position: 'relative', flexShrink: 0 } : { position: 'sticky', top: 0 }), zIndex: 20, background: 'rgba(9,9,11,0.8)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${T.border}` } },
      React.createElement("div", { style: { maxWidth: 1200, margin: '0 auto', padding: mob ? '8px 12px' : '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: mob ? 6 : 16, flexWrap: 'nowrap' } },

        // Home button
        React.createElement("button", {
          onClick: () => { setEditorMode(null); setWizardStep(1); setWizardData({ url: '', aspectRatio: '1:1', cardCount: 3, presetId: 'photo_top' }); },
          title: "\uD648",
          style: { width: mob ? 32 : 36, height: mob ? 32 : 36, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSecondary, fontSize: mob ? 15 : 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' },
          onMouseEnter: (e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = T.text; },
          onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.textSecondary; },
        }, "\u2302"),

        // Logo area
        React.createElement("div", { ref: infoRef, style: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: mob ? 'center' : 'flex-start', gap: mob ? 6 : 10, flexShrink: mob ? 1 : 0, flex: mob ? 1 : 'none', minWidth: 0 } },
          React.createElement("div", {
            onClick: () => setShowInfo(!showInfo),
            style: { display: 'flex', alignItems: 'center', gap: mob ? 6 : 8, cursor: 'pointer', padding: mob ? '4px 4px' : '4px 8px', borderRadius: T.radiusSm, transition: 'background 0.15s' },
            onMouseEnter: (e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)',
            onMouseLeave: (e) => e.currentTarget.style.background = 'transparent',
          },
            mob
              ? React.createElement("span", { style: { fontFamily: "'Bitcount Prop Single', monospace", fontSize: 15, fontWeight: 400, letterSpacing: '0.04em', color: T.text, lineHeight: 1, whiteSpace: 'nowrap' } }, "YOUMECA")
              : React.createElement(React.Fragment, null,
                  React.createElement("img", { src: "/icon-round.png", style: { width: 28, height: 28, borderRadius: 7, flexShrink: 0 } }),
                  React.createElement("span", { style: { fontFamily: "'Bitcount Prop Single', monospace", fontSize: 22, fontWeight: 400, letterSpacing: '0.05em', color: T.text, lineHeight: 1 } }, "YOUMECA"),
                ),
            !mob && React.createElement("span", { style: { fontSize: 10, color: T.textMuted, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: T.radiusPill } }, VERSION),
          ),
          !mob && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 1 } },
            React.createElement("span", { style: { fontSize: 12, color: T.text, fontWeight: 600, whiteSpace: 'nowrap' } }, "유메카, 내가 꿈꾸던 카드뉴스 생성기"),
            React.createElement("span", { style: { fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap' } }, "유튜브 영상을 쉽게 카드뉴스로 만들어보세요"),
          ),
          showInfo && React.createElement(InfoPanel, { onClose: () => setShowInfo(false), mob }),
        ),

        // Project Tabs
        !mob && projects.length > 0 && React.createElement(ProjectTabs, {
          projects, activeId: activeProjectId,
          onSwitch: switchProject, onAdd: addProject,
          onClose: closeProject, onRename: renameProject,
        }),

        mob
          ? React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 } },
              projects.length > 0 && React.createElement("button", { onClick: () => setShowProjectSelector(true), style: { padding: '6px 8px', background: 'rgba(255,255,255,0.05)', color: T.textSecondary, borderRadius: T.radiusPill, border: 'none', fontSize: 14, cursor: 'pointer', transition: 'all 0.15s', lineHeight: 1 } }, "\uD83D\uDCC2"),
              React.createElement("button", { onClick: () => setShowGlobalSettings(true), style: { padding: '6px 8px', background: 'rgba(255,255,255,0.05)', color: T.textSecondary, borderRadius: T.radiusPill, border: 'none', fontSize: 14, cursor: 'pointer', transition: 'all 0.15s', lineHeight: 1 } }, "\u2699"),
              React.createElement("button", { onClick: shareProject, style: { padding: '6px 8px', background: 'rgba(255,255,255,0.05)', color: T.textSecondary, borderRadius: T.radiusPill, border: 'none', fontSize: 14, cursor: 'pointer', transition: 'all 0.15s', lineHeight: 1 } }, "\u2197"),
              React.createElement("button", { onClick: () => setShowPreview(true), style: { padding: '6px 10px', background: 'rgba(255,255,255,0.05)', color: T.textSecondary, borderRadius: T.radiusPill, border: 'none', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' } }, "\uBBF8\uB9AC\uBCF4\uAE30"),
              React.createElement("button", {
                onClick: handleGenerate, disabled: generating,
                style: { padding: '6px 12px', background: generating ? T.surfaceHover : T.success, color: generating ? T.textMuted : '#fff', borderRadius: T.radiusPill, border: 'none', fontSize: 12, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: generating ? 'none' : '0 2px 8px rgba(34,197,94,0.3)' }
              }, generating ? "생성 중..." : "\u2728 생성"),
            )
          : React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 } },
              React.createElement("span", { style: { fontSize: 12, color: T.textMuted } }, `카드 ${cards.length}개`),
              React.createElement("button", { onClick: shareProject, style: { padding: '8px 16px', background: 'rgba(255,255,255,0.05)', color: T.textSecondary, borderRadius: T.radiusPill, border: 'none', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' } }, "\uBCF4\uB0B4\uAE30"),
              React.createElement("button", { onClick: () => setShowPreview(true), style: { padding: '8px 16px', background: 'rgba(255,255,255,0.05)', color: T.textSecondary, borderRadius: T.radiusPill, border: 'none', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' } }, "\uBBF8\uB9AC\uBCF4\uAE30"),
              React.createElement("button", {
                onClick: handleGenerate, disabled: generating,
                style: { padding: '9px 24px', background: generating ? T.surfaceHover : T.success, color: generating ? T.textMuted : '#fff', borderRadius: T.radiusPill, border: 'none', fontSize: 14, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: generating ? 'none' : '0 2px 8px rgba(34,197,94,0.3)' }
              }, generating ? "생성 중..." : "생성하기"),
            )
      )
    ),

    // ── Fixed Card Preview (mobile only) ──
    mob && React.createElement("div", { style: { flexShrink: 0, background: T.bg, borderBottom: `1px solid ${T.border}`, zIndex: 15, display: 'flex', flexDirection: 'column', gap: 0, overflowX: 'hidden' } },
      // Carousel indicator (dots + arrows)
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '10px 0' } },
        React.createElement("span", { style: { fontSize: 11, color: T.textMuted, fontWeight: 500, minWidth: 28, textAlign: 'center' } }, (activeCardIdx + 1) + "/" + cards.length),
        React.createElement("button", {
          onClick: () => { if (activeCardIdx > 0) setActiveCardIdx(activeCardIdx - 1); },
          disabled: activeCardIdx === 0,
          style: { background: 'none', border: 'none', color: activeCardIdx === 0 ? T.textMuted : T.accent, fontSize: 18, cursor: activeCardIdx === 0 ? 'default' : 'pointer', padding: '6px 10px', opacity: activeCardIdx === 0 ? 0.3 : 1 },
        }, "◀"),
        cards.map((_, i) => React.createElement("div", {
          key: i,
          onClick: () => setActiveCardIdx(i),
          style: { width: i === activeCardIdx ? 24 : 12, height: 12, borderRadius: 6, background: i === activeCardIdx ? T.accent : T.border, cursor: 'pointer', transition: 'all 0.2s' },
        })),
        React.createElement("button", {
          onClick: () => { addCard(); setActiveCardIdx(cards.length); },
          style: { height: 22, padding: '0 8px', borderRadius: T.radiusPill, background: 'rgba(99,102,241,0.15)', border: `1px solid ${T.accent}`, color: T.accent, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, lineHeight: 1, transition: 'all 0.15s' },
        }, "+ \uCD94\uAC00"),
        React.createElement("button", {
          onClick: () => { if (activeCardIdx < cards.length) setActiveCardIdx(activeCardIdx + 1); },
          disabled: activeCardIdx >= cards.length - 1,
          style: { background: 'none', border: 'none', color: activeCardIdx >= cards.length - 1 ? T.textMuted : T.accent, fontSize: 18, cursor: activeCardIdx >= cards.length - 1 ? 'default' : 'pointer', padding: '6px 10px', opacity: activeCardIdx >= cards.length - 1 ? 0.3 : 1 },
        }, "▶"),
      ),
      
      // Card header (name, actions)
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px', gap: 8 } },
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 } },
          React.createElement("span", { style: { width: 26, height: 26, borderRadius: T.radiusPill, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 } }, cards.length > 0 ? (activeCardIdx + 1) : '−'),
          cards.length > 0 && React.createElement("span", {
            style: { color: T.text, fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' },
          }, cards[activeCardIdx]?.name || cards[activeCardIdx]?.title || cards[activeCardIdx]?.subtitle || `카드 ${activeCardIdx + 1}`),
        ),
        React.createElement("div", { style: { display: 'flex', gap: 6, flexShrink: 0 } },
          React.createElement("button", { onClick: () => setShowReorder(true), style: { background: 'rgba(255,255,255,0.05)', border: 'none', color: T.textMuted, fontSize: 11, cursor: 'pointer', padding: '4px 8px', borderRadius: T.radiusPill } }, "☰"),
          cards.length > 0 && React.createElement("button", { onClick: () => duplicateCard(activeCardIdx), style: { background: 'rgba(255,255,255,0.05)', border: 'none', color: T.textMuted, fontSize: 11, cursor: 'pointer', padding: '4px 8px', borderRadius: T.radiusPill } }, "복제"),
          cards.length > 1 && React.createElement("button", { onClick: () => { removeCard(activeCardIdx); setActiveCardIdx(Math.min(activeCardIdx, Math.max(0, cards.length - 2))); }, style: { background: 'rgba(239,68,68,0.1)', border: 'none', color: T.danger, fontSize: 11, cursor: 'pointer', padding: '4px 8px', borderRadius: T.radiusPill } }, "삭제"),
        ),
      ),
      
      // Card preview
      cards.length > 0 && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 4, gap: 4 } },
        React.createElement("div", { style: { display: 'flex', justifyContent: 'center' } },
          React.createElement(CardPreview, { card: cards[activeCardIdx], globalUrl, aspectRatio, globalBgImage, previewWidth: mobilePreviewExpanded ? Math.min(window.innerWidth - 32, 480) : Math.min(200, window.innerWidth - 32), videoPreviewOn, previewMuted, previewVolume }),
        ),
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' } },
          React.createElement("button", {
            onClick: () => setMobilePreviewExpanded(v => !v),
            style: { background: 'none', border: 'none', color: T.textMuted, fontSize: 11, cursor: 'pointer', padding: '4px 8px' },
          }, mobilePreviewExpanded ? "\u25B2 \uC791\uAC8C \uBCF4\uAE30" : "\u25BC \uD06C\uAC8C \uBCF4\uAE30"),
          React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 4 } },
            React.createElement("div", {
              onClick: () => setVideoPreviewOn(v => !v),
              style: { width: 28, height: 14, borderRadius: 7, background: videoPreviewOn ? T.accent : T.border, position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 },
            },
              React.createElement("div", { style: { width: 10, height: 10, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: videoPreviewOn ? 16 : 2, transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' } })
            ),
            React.createElement("span", { onClick: () => setVideoPreviewOn(v => !v), style: { fontSize: 10, color: T.textMuted, cursor: 'pointer', userSelect: 'none' } }, "\uC7AC\uC0DD"),
            videoPreviewOn && React.createElement("div", {
              onClick: () => setPreviewMuted(m => !m),
              style: { width: 22, height: 22, borderRadius: '50%', background: previewMuted ? 'rgba(255,255,255,0.06)' : 'rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' },
            },
              React.createElement("span", { style: { fontSize: 12, lineHeight: 1 } }, previewMuted ? "\uD83D\uDD07" : "\uD83D\uDD0A")
            ),
          ),
        ),
      ),
    ),

    // ── Main ──
    React.createElement("main", { style: { ...(mob ? { flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%', padding: '8px 10px 32px' } : { maxWidth: 1200, margin: '0 auto', padding: '12px 24px 48px' }), display: 'flex', flexDirection: 'column', gap: mob ? 10 : 12 } },

      // Global Settings (desktop only — mobile uses header icon)
      !mob && React.createElement(React.Fragment, null,
          React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, padding: '8px 12px', boxShadow: T.shadow, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' } },
            React.createElement("div", { style: { flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8 } },
              React.createElement("span", { style: { fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap', flexShrink: 0 } }, "URL"),
              React.createElement("input", { type: "text", value: globalUrl, placeholder: "https://youtube.com/watch?v=...", onChange: (e) => setGlobalUrl(e.target.value), style: { ...inputBase, padding: '6px 10px', fontSize: 13 } })
            ),
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6 } },
              React.createElement("span", { style: { fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap' } }, "\uBE44\uC728"),
              ASPECT_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: aspectRatio === opt.id, onClick: () => setAspectRatio(opt.id) }, opt.label))
            ),
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6 } },
              React.createElement("span", { style: { fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap' } }, "\uD615\uC2DD"),
              React.createElement(PillBtn, { active: outputFormat === "video", onClick: () => setOutputFormat("video") }, "\uC601\uC0C1"),
              React.createElement(PillBtn, { active: outputFormat === "image", onClick: () => setOutputFormat("image") }, "\uC774\uBBF8\uC9C0"),
            ),
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6 } },
              React.createElement("span", { style: { fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap' } }, "\uD574\uC0C1\uB3C4"),
              React.createElement(PillBtn, { active: outputSize === 720, onClick: () => setOutputSize(720) }, "720p"),
              React.createElement(PillBtn, { active: outputSize === 1080, onClick: () => setOutputSize(1080) }, "1080p"),
            ),
          ),

          // Global fallback image (only when output format is image, desktop only inline)
          outputFormat === 'image' && React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, padding: '16px 20px', boxShadow: T.shadow, display: 'flex', alignItems: 'center', gap: 12 } },
            React.createElement("label", { style: { ...labelBase, marginBottom: 0, whiteSpace: 'nowrap' } }, "\uACF5\uD1B5 \uC774\uBBF8\uC9C0"),
            React.createElement("div", { style: { flex: 1 } },
              globalBgImage
                ? React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                    React.createElement("img", { src: globalBgImage, style: { width: 40, height: 40, borderRadius: 6, objectFit: 'cover' } }),
                    React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, "\uC801\uC6A9 \uC911"),
                    React.createElement("button", { onClick: () => setGlobalBgImage(null), style: { background: 'none', border: 'none', color: T.danger, fontSize: 11, cursor: 'pointer', textDecoration: 'underline' } }, "\uC0AD\uC81C"),
                  )
                : React.createElement(ImageUploadField, { value: globalBgImage, onChange: setGlobalBgImage, maxMb: 5 }),
            ),
          ),
        ),

      // Cards — mobile carousel vs desktop list
      mob ? React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, padding: '8px 12px', boxShadow: T.shadow } },
        React.createElement(MobileCardCarousel, {
          cards, activeIndex: Math.min(activeCardIdx, cards.length - 1),
          onActiveChange: setActiveCardIdx,
          onCardChange: updateCard,
          onRemove: (i) => { removeCard(i); setActiveCardIdx(Math.min(activeCardIdx, Math.max(0, cards.length - 2))); },
          onDuplicate: duplicateCard,
          onAdd: addCard,
          globalUrl, aspectRatio, outputFormat, globalBgImage,
          onReorder: () => setShowReorder(true),
          hidePreview: true,
          onAspectRatioChange: (v) => { if (window.confirm('\uBAA8\uB4E0 \uCE74\uB4DC\uC758 \uBE44\uC728\uC774 \uBC14\uB01D\uB2C8\uB2E4. \uBC14\uAFB8\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) setAspectRatio(v); },
        }),
      ) : React.createElement(DesktopCardPanel, {
        cards,
        activeIndex: Math.min(activeCardIdx, cards.length - 1),
        onActiveChange: setActiveCardIdx,
        onCardChange: updateCard,
        onRemove: (i) => removeCard(i),
        onDuplicate: (i) => duplicateCard(i),
        onAdd: addCard,
        globalUrl, aspectRatio, outputFormat, globalBgImage,
        onReorder: () => setShowReorder(true),
        videoPreviewOn, onVideoPreviewToggle: () => setVideoPreviewOn(v => !v),
        previewMuted, onPreviewMuteToggle: () => { setPreviewMuted(m => !m); },
        previewVolume, onPreviewVolumeChange: setPreviewVolume,
        onAspectRatioChange: (v) => { if (window.confirm('\uBAA8\uB4E0 \uCE74\uB4DC\uC758 \uBE44\uC728\uC774 \uBC14\uB01D\uB2C8\uB2E4. \uBC14\uAFB8\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) setAspectRatio(v); },
      }),
    ),

    showJson && React.createElement(JsonModal, { json: jsonStr, onClose: () => setShowJson(false) }),
    showPreview && React.createElement(PreviewModal, { cards, globalUrl, aspectRatio, globalBgImage, onClose: () => setShowPreview(false), onGenerate: handleGenerate, generating, previewMuted, onMuteToggle: () => setPreviewMuted(m => !m) }),
    showGeneratingModal && React.createElement(GeneratingModal, {
      mob, generating, genProgress, results, downloading,
      onDownloadAll: handleDownloadAll,
      onClose: () => {
        if (generating) {
          if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
          if (activeJobIdRef.current) { fetch(`/api/jobs/${activeJobIdRef.current}`, { method: 'DELETE' }).catch(() => {}); activeJobIdRef.current = null; }
        }
        setGenerating(false); setShowGeneratingModal(false); setGenProgress("");
      }
    }),
    confirmClose && React.createElement(ConfirmDialog, {
      message: "지금 저장된 내용이 날아갑니다.\n정말로 닫으시겠습니까?",
      onConfirm: confirmCloseProject,
      onCancel: () => setConfirmClose(null),
    }),
    showReorder && cards.length > 1 && React.createElement(ReorderModal, {
      cards,
      onReorder: (newCards) => setCards(newCards),
      onClose: () => setShowReorder(false),
    }),
    showProjectSelector && React.createElement(ProjectSelectorModal, {
      projects, activeId: activeProjectId,
      onSwitch: switchProject, onAdd: addProject,
      onClose: closeProject, onRename: renameProject,
      onDismiss: () => setShowProjectSelector(false),
    }),
    showGlobalSettings && React.createElement(GlobalSettingsModal, {
      globalUrl, setGlobalUrl, aspectRatio, setAspectRatio,
      outputFormat, setOutputFormat, outputSize, setOutputSize,
      globalBgImage, setGlobalBgImage,
      onDismiss: () => setShowGlobalSettings(false),
    }),
    ), // end editor Fragment

    shareUrl && React.createElement(ShareModal, { url: shareUrl, onClose: () => setShareUrl(null) }),
    importProject && React.createElement(ImportDialog, {
      project: importProject,
      onImport: handleImport,
      onCancel: () => { setImportProject(null); router.push('/', undefined, { shallow: true }); },
    }),

    React.createElement("style", null, `@keyframes spin { to { transform: rotate(360deg); } }`)
  );
}
