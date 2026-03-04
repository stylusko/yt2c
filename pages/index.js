import React, { useState, useRef, useEffect, useCallback } from 'react';
import Head from 'next/head';
import JSZip from 'jszip';

/* ── Constants ── */
const BUILD_DATE = '2026.0304';
const BUILD_NUM = 1; // same-day deploy count
const VERSION = `v${BUILD_DATE}.${BUILD_NUM}`;
const CREATOR = 'JH KO';
const CONTACT_EMAIL = 'moonsengwon.me@gmail.com';
const RECENT_FEATURES = [
  '카드 비율 선택 (1:1 / 3:4)',
  '분리형 영상 모드',
  '이미지 업로드 소스',
  'ZIP 일괄 다운로드',
  '프로젝트 탭',
  '텍스트 필드 체크박스',
  '카드 이름 수정',
  '카드 순서 드래그 조정',
  '배경 이미지 업로드',
];

const LAYOUT_OPTIONS = [
  { id: "photo_top", label: "사진\u2191 텍스트\u2193" },
  { id: "photo_bottom", label: "텍스트\u2191 사진\u2193" },
  { id: "text_overlay", label: "오버레이" },
];

const ASPECT_OPTIONS = [
  { id: "1:1", label: "1:1", w: 1, h: 1 },
  { id: "3:4", label: "3:4", w: 3, h: 4 },
];

const VIDEO_FILL_OPTIONS = [
  { id: "full", label: "전체 채우기" },
  { id: "split", label: "분리형" },
];

const IMAGE_SOURCE_OPTIONS = [
  { id: "thumbnail", label: "영상 썸네일" },
  { id: "upload", label: "이미지 업로드" },
];

const DEFAULT_CARD = () => ({
  id: Date.now() + Math.random(),
  name: '',
  url: "", start: "", end: "",
  layout: "photo_top", photoRatio: 0.55, videoFill: "full",
  imageSource: "thumbnail", uploadedImage: null,
  useTitle: true, useSubtitle: true, useBody: true,
  title: "", titleSize: 56, titleFont: "Pretendard-Bold.otf",
  subtitle: "", subtitleSize: 44, subtitleFont: "Pretendard-Regular.otf",
  body: "", bodySize: 36, bodyFont: "Pretendard-Regular.otf",
  useBg: true, bgColor: "#121212", bgOpacity: 0.75,
  bgImage: null, // base64 background image
  titleColor: "#ffffff", subtitleColor: "#aaaaaa", bodyColor: "#d2d2d2",
  captureTime: "", videoX: 50, videoY: 50, videoScale: 110,
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

/* ── Overlay Canvas ── */
async function generateOverlayPng(card, outputSize, aspectRatio = '1:1') {
  const w = outputSize;
  const h = aspectRatio === '3:4' ? Math.round(outputSize * 4 / 3) : outputSize;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  const layout = card.layout || "photo_top";
  const photoRatio = card.photoRatio || 0.55;
  const videoFill = card.videoFill || "full";
  const useBg = card.useBg !== false;
  const bgColor = hexToRgb(card.bgColor || "#121212");
  const bgOpacity = card.bgOpacity ?? 0.75;
  const padX = 60, padTop = 40;
  const maxTextW = w - padX * 2;

  const fontMap = {
    "Pretendard-Bold.otf": "700 {s}px Pretendard, sans-serif",
    "Pretendard-SemiBold.otf": "600 {s}px Pretendard, sans-serif",
    "Pretendard-Regular.otf": "400 {s}px Pretendard, sans-serif",
  };
  const getFont = (name, sz) => (fontMap[name] || "400 {s}px Pretendard, sans-serif").replace("{s}", sz);

  function wrapText(text, fontSize, fontName) {
    if (!text) return [];
    ctx.font = getFont(fontName, fontSize);
    const lines = [];
    for (const para of text.split("\n")) {
      if (!para.trim()) { lines.push(""); continue; }
      let cur = "";
      for (const ch of para) {
        const test = cur + ch;
        if (ctx.measureText(test).width > maxTextW && cur) { lines.push(cur); cur = ch; }
        else cur = test;
      }
      if (cur) lines.push(cur);
    }
    return lines;
  }

  if (layout === "text_overlay") {
    if (!useBg) return canvas.toDataURL("image/png");
    const titleLines = wrapText(card.title, card.titleSize, card.titleFont);
    const subtitleLines = wrapText(card.subtitle, card.subtitleSize, card.subtitleFont);
    const bodyLines = wrapText(card.body, card.bodySize, card.bodyFont);
    let totalTextH = padTop * 2 + titleLines.length * (card.titleSize + 8);
    if (card.subtitle) totalTextH += 12 + subtitleLines.length * (card.subtitleSize + 8);
    if (card.body) totalTextH += 24 + bodyLines.length * (card.bodySize + 10);
    const gradH = Math.min(Math.round(h * 0.80), totalTextH + 200);
    const maxAlpha = Math.max(Math.round(bgOpacity * 255), 230) / 255;
    for (let y = h - gradH; y < h; y++) {
      const progress = (y - (h - gradH)) / gradH;
      let alpha;
      if (progress < 0.2) alpha = (progress / 0.2) ** 2 * maxAlpha * 0.5;
      else if (progress < 0.4) alpha = (0.5 + 0.4 * ((progress - 0.2) / 0.2)) * maxAlpha;
      else alpha = (0.9 + 0.1 * ((progress - 0.4) / 0.6)) * maxAlpha;
      ctx.fillStyle = `rgba(${bgColor[0]},${bgColor[1]},${bgColor[2]},${Math.min(alpha, maxAlpha)})`;
      ctx.fillRect(0, y, w, 1);
    }
    let curY = h - padTop;
    const allItems = [];
    if (card.title) for (const ln of titleLines) allItems.push({ text: ln, font: getFont(card.titleFont, card.titleSize), color: card.titleColor, lh: card.titleSize + 8 });
    if (card.subtitle) { allItems.push({ type: "gap", size: 12 }); for (const ln of subtitleLines) allItems.push({ text: ln, font: getFont(card.subtitleFont, card.subtitleSize), color: card.subtitleColor, lh: card.subtitleSize + 8 }); }
    if (card.body) { allItems.push({ type: "gap", size: 24 }); for (const ln of bodyLines) allItems.push({ text: ln, font: getFont(card.bodyFont, card.bodySize), color: card.bodyColor, lh: card.bodySize + 10 }); }
    allItems.reverse();
    for (const item of allItems) {
      if (item.type === "gap") { curY -= item.size; continue; }
      if (!item.text) { curY -= 20; continue; }
      curY -= item.lh;
      ctx.font = item.font; ctx.fillStyle = item.color;
      ctx.fillText(item.text, padX, curY + item.lh * 0.78);
    }
  } else {
    const textH = Math.round(h * (1 - photoRatio));
    const yStart = layout === "photo_top" ? h - textH : 0;
    if (useBg) {
      const effectiveOpacity = videoFill === "split" ? 1 : bgOpacity;
      ctx.fillStyle = `rgba(${bgColor[0]},${bgColor[1]},${bgColor[2]},${effectiveOpacity})`;
      ctx.fillRect(0, yStart, w, textH);
    }
    let curY = yStart + padTop;
    if (card.title) { ctx.font = getFont(card.titleFont, card.titleSize); ctx.fillStyle = card.titleColor; for (const ln of wrapText(card.title, card.titleSize, card.titleFont)) { ctx.fillText(ln, padX, curY + card.titleSize * 0.85); curY += card.titleSize + 8; } }
    if (card.subtitle) { if (card.title) curY += 8; ctx.font = getFont(card.subtitleFont, card.subtitleSize); ctx.fillStyle = card.subtitleColor; for (const ln of wrapText(card.subtitle, card.subtitleSize, card.subtitleFont)) { ctx.fillText(ln, padX, curY + card.subtitleSize * 0.85); curY += card.subtitleSize + 8; } }
    if (card.body) { if (card.title || card.subtitle) curY += 16; ctx.font = getFont(card.bodyFont, card.bodySize); ctx.fillStyle = card.bodyColor; for (const ln of wrapText(card.body, card.bodySize, card.bodyFont)) { if (!ln) { curY += card.bodySize / 2; continue; } ctx.fillText(ln, padX, curY + card.bodySize * 0.85); curY += card.bodySize + 10; } }
  }
  ctx.fillStyle = "rgba(0,0,0,0.78)";
  ctx.fillRect(0, 0, w, 2); ctx.fillRect(0, h - 2, w, 2);
  ctx.fillRect(0, 0, 2, h); ctx.fillRect(w - 2, 0, 2, h);
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

/* ── Slider Row ── */
function SliderRow({ label, value, min, max, step, onChange, suffix = '%' }) {
  return React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10 } },
    React.createElement("span", { style: { fontSize: 12, color: T.textMuted, minWidth: 32 } }, label),
    React.createElement("input", { type: "range", min, max, step, value, onChange: (e) => onChange(parseFloat(e.target.value)), style: { flex: 1, accentColor: T.accent } }),
    React.createElement("span", { style: { fontSize: 11, color: T.textMuted, minWidth: 36, textAlign: 'right' } }, `${typeof value === 'number' && value < 1 ? Math.round(value * 100) : value}${suffix}`)
  );
}

/* ── Text Field Row (checkbox + input + size + color) ── */
function TextFieldRow({ value, onTextChange, placeholder, size, onSizeChange, color, onColorChange, rows, enabled, onToggle }) {
  const disabled = enabled === false;
  const input = rows
    ? React.createElement("textarea", { value, placeholder, rows, disabled, onChange: (e) => onTextChange(e.target.value), style: { ...inputBase, flex: 1, resize: 'vertical', minHeight: 64, opacity: disabled ? 0.35 : 1 } })
    : React.createElement("input", { type: "text", value, placeholder, disabled, onChange: (e) => onTextChange(e.target.value), style: { ...inputBase, flex: 1, opacity: disabled ? 0.35 : 1 } });

  return React.createElement("div", { style: { display: 'flex', gap: 8, alignItems: rows ? 'start' : 'center' } },
    React.createElement("div", {
      onClick: onToggle,
      style: { width: 20, height: 20, borderRadius: 4, border: `2px solid ${enabled !== false ? T.accent : T.textMuted}`, background: enabled !== false ? T.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s', marginTop: rows ? 8 : 0 },
    }, enabled !== false && React.createElement("span", { style: { color: '#fff', fontSize: 12, lineHeight: 1 } }, "\u2713")),
    input,
    React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', opacity: disabled ? 0.35 : 1 } },
      React.createElement("input", { type: "number", value: size, disabled, onChange: (e) => onSizeChange(parseInt(e.target.value) || 0), style: { width: 52, padding: '7px 4px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 12, color: T.textMuted, textAlign: 'center', outline: 'none' } }),
      React.createElement("input", { type: "color", value: color, disabled, onChange: (e) => onColorChange(e.target.value), style: { width: 36, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, cursor: disabled ? 'default' : 'pointer', background: 'transparent' } }),
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

/* ── CardPreview ── */
function CardPreview({ card, globalUrl, aspectRatio = '1:1', globalBgImage, previewWidth }) {
  const previewW = previewWidth || 320;
  const previewH = aspectRatio === '3:4' ? Math.round(previewW * 4 / 3) : previewW;
  const textRatio = 1 - card.photoRatio;
  const textH = card.layout === "text_overlay" ? previewH : Math.round(previewH * textRatio);
  const videoFill = card.videoFill || "full";
  const useBg = card.useBg !== false;
  const sc = previewW / 1080;
  const titleFs = Math.round(card.titleSize * sc);
  const subtitleFs = Math.round(card.subtitleSize * sc);
  const bodyFs = Math.round(card.bodySize * sc);
  const padX = Math.round(60 * sc);
  const padTop = Math.round(40 * sc);
  const videoUrl = card.url || globalUrl || "";
  const thumbnailId = videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
  const seekTime = parseTime(card.captureTime) ?? parseTime(card.start) ?? 0;
  const [thumbSrc, setThumbSrc] = useState(null);
  const [tried, setTried] = useState(0);

  // Determine background image: card-level > global-level > thumbnail
  const bgImageSrc = card.bgImage || globalBgImage || null;

  useEffect(() => {
    if (thumbnailId) { setThumbSrc(`https://img.youtube.com/vi/${thumbnailId}/maxresdefault.jpg`); setTried(0); }
    else setThumbSrc(null);
  }, [thumbnailId]);

  const handleThumbError = () => {
    if (tried === 0) { setThumbSrc(`https://img.youtube.com/vi/${thumbnailId}/hqdefault.jpg`); setTried(1); }
    else setThumbSrc(null);
  };

  // Use uploaded image or thumbnail
  const displayImage = bgImageSrc || thumbSrc;

  const bgRgb = card.bgColor.replace("#", "").match(/.{2}/g)?.map(h => parseInt(h, 16)) || [18,18,18];
  const vScale = (card.videoScale || 110) / 100;
  const ytLink = thumbnailId && seekTime > 0
    ? `https://www.youtube.com/watch?v=${thumbnailId}&t=${Math.floor(seekTime)}s`
    : thumbnailId ? `https://www.youtube.com/watch?v=${thumbnailId}` : null;

  const TextContent = () => React.createElement("div", { style: { position: "relative", padding: `${padTop}px ${padX}px`, height: "100%", boxSizing: "border-box" } },
    card.title && React.createElement("div", { style: { fontSize: titleFs, fontWeight: 700, color: card.titleColor, marginBottom: 3, lineHeight: 1.3 } }, card.title),
    card.subtitle && React.createElement("div", { style: { fontSize: subtitleFs, color: card.subtitleColor, marginBottom: 7, lineHeight: 1.3 } }, card.subtitle),
    card.body && React.createElement("div", { style: { fontSize: bodyFs, color: card.bodyColor, lineHeight: 1.5, whiteSpace: "pre-wrap" } }, card.body),
  );

  const BgImage = () => displayImage
    ? React.createElement("img", { src: displayImage, alt: "", onError: bgImageSrc ? undefined : handleThumbError, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, transform: bgImageSrc ? 'none' : `scale(${vScale})`, transformOrigin: bgImageSrc ? 'center' : `${card.videoX}% ${card.videoY}%` } })
    : React.createElement("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 0 } },
        React.createElement("div", { style: { width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" } },
          React.createElement("span", { style: { color: "rgba(255,255,255,0.5)", fontSize: 18, marginLeft: 2 } }, "\u25B6")
        ));

  const TimestampLink = () => ytLink ? React.createElement("a", {
    href: ytLink, target: "_blank", rel: "noopener noreferrer",
    onClick: (e) => e.stopPropagation(),
    style: { position: "absolute", top: 8, right: 8, zIndex: 10, padding: "4px 10px", borderRadius: T.radiusPill, background: "rgba(99,102,241,0.9)", color: "#fff", fontSize: 10, fontWeight: 600, textDecoration: "none", boxShadow: T.shadow }
  }, `\u25B6 ${formatSec(seekTime)}`) : null;

  const wrapper = { width: previewW, height: previewH, borderRadius: T.radius, overflow: "hidden", flexShrink: 0, position: "relative", boxShadow: T.shadowLg };

  if (card.layout === "text_overlay") {
    return React.createElement("div", { style: wrapper },
      React.createElement(BgImage), React.createElement(TimestampLink),
      useBg && React.createElement("div", { style: { position: "absolute", bottom: 0, left: 0, right: 0, height: "80%", background: `linear-gradient(to bottom, transparent 0%, rgba(${bgRgb.join(",")},0.5) 20%, rgba(${bgRgb.join(",")},0.9) 40%, rgba(${bgRgb.join(",")},0.95) 100%)`, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: `${padTop*3}px ${padX}px ${padTop}px`, zIndex: 2 } },
        card.title && React.createElement("div", { style: { fontSize: titleFs, fontWeight: 700, color: card.titleColor, marginBottom: 3, lineHeight: 1.3 } }, card.title),
        card.subtitle && React.createElement("div", { style: { fontSize: subtitleFs, color: card.subtitleColor, marginBottom: 5, lineHeight: 1.3 } }, card.subtitle),
        card.body && React.createElement("div", { style: { fontSize: bodyFs, color: card.bodyColor, lineHeight: 1.5, whiteSpace: "pre-wrap" } }, card.body),
      ),
      !useBg && React.createElement("div", { style: { position: "absolute", bottom: 0, left: 0, right: 0, padding: `${padTop}px ${padX}px`, zIndex: 2 } },
        card.title && React.createElement("div", { style: { fontSize: titleFs, fontWeight: 700, color: card.titleColor, marginBottom: 3, lineHeight: 1.3 } }, card.title),
        card.subtitle && React.createElement("div", { style: { fontSize: subtitleFs, color: card.subtitleColor, marginBottom: 5, lineHeight: 1.3 } }, card.subtitle),
        card.body && React.createElement("div", { style: { fontSize: bodyFs, color: card.bodyColor, lineHeight: 1.5, whiteSpace: "pre-wrap" } }, card.body),
      ),
    );
  }

  const isTop = card.layout === "photo_top";
  const videoAreaH = previewH - textH;

  if (videoFill === "split") {
    return React.createElement("div", { style: wrapper },
      React.createElement("div", { style: { position: "absolute", left: 0, right: 0, height: videoAreaH, ...(isTop ? { top: 0 } : { bottom: 0 }), overflow: "hidden" } },
        React.createElement(BgImage),
      ),
      React.createElement(TimestampLink),
      React.createElement("div", { style: { position: "absolute", left: 0, right: 0, height: textH, zIndex: 2, ...(isTop ? { bottom: 0 } : { top: 0 }), overflow: "hidden" } },
        useBg && React.createElement("div", { style: { position: "absolute", inset: 0, background: `rgb(${bgRgb.join(",")})` } }),
        React.createElement(TextContent)
      ));
  }

  return React.createElement("div", { style: wrapper },
    React.createElement(BgImage), React.createElement(TimestampLink),
    React.createElement("div", { style: { position: "absolute", left: 0, right: 0, height: textH, zIndex: 2, ...(isTop ? { bottom: 0 } : { top: 0 }), overflow: "hidden" } },
      useBg && React.createElement("div", { style: { position: "absolute", inset: 0, background: `rgba(${bgRgb.join(",")},${card.bgOpacity})` } }),
      React.createElement(TextContent)
    ));
}

/* ── Section Box ── */
function Section({ title, children }) {
  return React.createElement("div", { style: { marginBottom: 20 } },
    React.createElement("div", { style: sectionTitle }, title),
    React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 } }, children)
  );
}

/* ── Image Upload Field ── */
function ImageUploadField({ value, onChange, label = "이미지 업로드", maxMb = 3 }) {
  return React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
    React.createElement("input", {
      type: "file", accept: "image/*",
      onChange: (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > maxMb * 1024 * 1024) { alert(`${maxMb}MB 이하 이미지만 업로드 가능합니다.`); e.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = () => onChange(reader.result);
        reader.readAsDataURL(file);
      },
      style: { fontSize: 12, color: T.textSecondary },
    }),
    value && React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
      React.createElement("img", { src: value, style: { width: 48, height: 48, borderRadius: 6, objectFit: 'cover' } }),
      React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, "업로드 완료"),
      React.createElement("button", { onClick: () => onChange(null), style: { background: 'none', border: 'none', color: T.danger, fontSize: 11, cursor: 'pointer' } }, "삭제"),
    ),
    !value && React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, `${maxMb}MB 이하 \u00B7 JPG, PNG 권장`),
  );
}

/* ── CardEditor ── */
function CardEditor({ card, index, onChange, onRemove, onDuplicate, total, globalUrl, aspectRatio, outputFormat, globalBgImage, onReorder, mob }) {
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameRef = useRef(null);
  const update = (key, val) => onChange({ ...card, [key]: val });

  useEffect(() => { if (editingName && nameRef.current) nameRef.current.focus(); }, [editingName]);

  const displayName = card.name || card.title || card.subtitle || `카드 ${index + 1}`;
  const startEditName = () => { setEditingName(true); setNameValue(card.name || ''); };
  const commitName = () => { update('name', nameValue.trim()); setEditingName(false); };

  return React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, overflow: 'hidden', boxShadow: T.shadow, display: 'flex' } },
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

          // 영상 설정
          React.createElement(Section, { title: "영상 설정" },
            React.createElement("input", { type: "text", value: card.url, placeholder: "개별 URL (비워두면 공통 URL)", onChange: (e) => update("url", e.target.value), style: inputBase }),
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: mob ? '1fr 1fr' : '1fr 1fr 1fr', gap: 8 } },
              React.createElement("div", null, React.createElement("label", { style: { ...labelBase, fontSize: 11 } }, "시작"), React.createElement("input", { type: "text", value: card.start, placeholder: "0:00", onChange: (e) => update("start", e.target.value), style: { ...inputBase, padding: '8px 10px', fontSize: 13 } })),
              React.createElement("div", null, React.createElement("label", { style: { ...labelBase, fontSize: 11 } }, "종료"), React.createElement("input", { type: "text", value: card.end, placeholder: "0:10", onChange: (e) => update("end", e.target.value), style: { ...inputBase, padding: '8px 10px', fontSize: 13 } })),
              React.createElement("div", null, React.createElement("label", { style: { ...labelBase, fontSize: 11 } }, "캡처 시점"), React.createElement("input", { type: "text", value: card.captureTime, placeholder: "선택", onChange: (e) => update("captureTime", e.target.value), style: { ...inputBase, padding: '8px 10px', fontSize: 13 } })),
            ),
            React.createElement("div", null,
              React.createElement("label", { style: labelBase }, "레이아웃"),
              React.createElement("div", { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
                LAYOUT_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: card.layout === opt.id, onClick: () => update("layout", opt.id) }, opt.label))
              )
            ),
            card.layout !== "text_overlay" && React.createElement("div", null,
              React.createElement("label", { style: labelBase }, "영상 채우기"),
              React.createElement("div", { style: { display: 'flex', gap: 6 } },
                VIDEO_FILL_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: (card.videoFill || "full") === opt.id, onClick: () => update("videoFill", opt.id) }, opt.label))
              )
            ),
            card.layout !== "text_overlay" && React.createElement(SliderRow, { label: "텍스트", value: card.photoRatio, min: 0.3, max: 0.8, step: 0.05, onChange: (v) => update("photoRatio", v), suffix: '%' }),
            React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
              React.createElement(SliderRow, { label: "X", value: card.videoX, min: 0, max: 100, step: 1, onChange: (v) => update("videoX", v) }),
              React.createElement(SliderRow, { label: "Y", value: card.videoY, min: 0, max: 100, step: 1, onChange: (v) => update("videoY", v) }),
              React.createElement(SliderRow, { label: "확대", value: card.videoScale || 110, min: 100, max: 200, step: 5, onChange: (v) => update("videoScale", v) }),
            ),
          ),

          // 이미지 소스 (이미지 형식일 때)
          outputFormat === 'image' && React.createElement(Section, { title: "이미지 소스" },
            React.createElement("div", { style: { display: 'flex', gap: 6 } },
              IMAGE_SOURCE_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: (card.imageSource || "thumbnail") === opt.id, onClick: () => update("imageSource", opt.id) }, opt.label))
            ),
            (card.imageSource === "upload") && React.createElement(ImageUploadField, {
              value: card.uploadedImage,
              onChange: (v) => update("uploadedImage", v),
            }),
          ),

          // 텍스트 내용
          React.createElement(Section, { title: "텍스트 내용" },
            React.createElement(TextFieldRow, { value: card.title, onTextChange: (v) => update("title", v), placeholder: "제목 (크고 두껍게)", size: card.titleSize, onSizeChange: (v) => update("titleSize", v), color: card.titleColor, onColorChange: (v) => update("titleColor", v), enabled: card.useTitle !== false, onToggle: () => update("useTitle", card.useTitle === false ? true : false) }),
            React.createElement(TextFieldRow, { value: card.subtitle, onTextChange: (v) => update("subtitle", v), placeholder: "부제", size: card.subtitleSize, onSizeChange: (v) => update("subtitleSize", v), color: card.subtitleColor, onColorChange: (v) => update("subtitleColor", v), enabled: card.useSubtitle !== false, onToggle: () => update("useSubtitle", card.useSubtitle === false ? true : false) }),
            React.createElement(TextFieldRow, { value: card.body, onTextChange: (v) => update("body", v), placeholder: "본문 내용...", rows: 3, size: card.bodySize, onSizeChange: (v) => update("bodySize", v), color: card.bodyColor, onColorChange: (v) => update("bodyColor", v), enabled: card.useBody !== false, onToggle: () => update("useBody", card.useBody === false ? true : false) }),
          ),

          // 배경 설정
          React.createElement(Section, { title: "배경 설정" },
            React.createElement(CheckboxRow, { label: "배경 사용", checked: card.useBg !== false, onChange: (v) => update("useBg", v) }),
            card.useBg !== false && React.createElement(React.Fragment, null,
              card.layout !== "text_overlay" && React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                React.createElement("label", { style: { fontSize: 12, color: T.textMuted } }, "색상"),
                React.createElement("input", { type: "color", value: card.bgColor, onChange: (e) => update("bgColor", e.target.value), style: { width: 32, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, cursor: 'pointer' } }),
                React.createElement("span", { style: { fontSize: 12, color: T.textMuted } }, card.bgColor),
              ),
              card.layout !== "text_overlay" && React.createElement(SliderRow, { label: "투명도", value: card.bgOpacity, min: 0, max: 1, step: 0.05, onChange: (v) => update("bgOpacity", v) }),
              React.createElement("div", null,
                React.createElement("label", { style: { ...labelBase, marginTop: 8 } }, "배경 이미지 (개별)"),
                React.createElement(ImageUploadField, { value: card.bgImage, onChange: (v) => update("bgImage", v), maxMb: 5 }),
              ),
            ),
          ),
        ),

        // Right: Preview (sticky on desktop, top on mobile)
        React.createElement("div", { style: { flexShrink: 0, ...(mob ? { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' } : { position: 'sticky', top: 80, alignSelf: 'flex-start' }) } },
          React.createElement("div", { style: { ...sectionTitle, textAlign: 'center' } }, "미리보기"),
          React.createElement(CardPreview, { card: { ...card, title: card.useTitle !== false ? card.title : '', subtitle: card.useSubtitle !== false ? card.subtitle : '', body: card.useBody !== false ? card.body : '' }, globalUrl, aspectRatio, globalBgImage, previewWidth: mob ? Math.min(320, 280) : 320 }),
        )
      )
    )
  );
}

/* ── JSON Modal ── */
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
  a.download = `yt2c_cards_${Date.now()}.zip`;
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

/* ── Reorder Modal ── */
function ReorderModal({ cards, onReorder, onClose }) {
  const [order, setOrder] = useState(cards.map((_, i) => i));
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

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

  const confirm = () => {
    const reordered = order.map(i => cards[i]);
    onReorder(reordered);
    onClose();
  };

  return React.createElement("div", { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 } },
    React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, maxWidth: 480, width: '100%', boxShadow: T.shadowLg, maxHeight: '85vh', display: 'flex', flexDirection: 'column' } },
      React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${T.border}` } },
        React.createElement("h3", { style: { fontWeight: 600, fontSize: 15, color: T.text } }, "카드 순서 변경"),
        React.createElement("button", { onClick: onClose, style: { background: 'none', border: 'none', color: T.textMuted, fontSize: 20, cursor: 'pointer' } }, "\u2715"),
      ),
      React.createElement("div", { style: { padding: '12px 20px', overflowY: 'auto', flex: 1 } },
        React.createElement("p", { style: { fontSize: 12, color: T.textMuted, marginBottom: 12 } }, "드래그하여 순서를 변경하세요"),
        // Column headers
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px 8px', borderBottom: `1px solid ${T.border}`, marginBottom: 8 } },
          React.createElement("span", { style: { width: 16 } }), // drag handle spacer
          React.createElement("span", { style: { fontSize: 10, color: T.textMuted, fontWeight: 600, width: 28, textAlign: 'center', flexShrink: 0 } }, "순서"),
          React.createElement("span", { style: { fontSize: 10, color: T.textMuted, fontWeight: 600, width: 40, textAlign: 'center', flexShrink: 0 } }, "원래"),
          React.createElement("span", { style: { fontSize: 10, color: T.textMuted, fontWeight: 600, flex: 1 } }, "이름"),
        ),
        order.map((cardIdx, visualIdx) => {
          const card = cards[cardIdx];
          const isDragging = dragging === visualIdx;
          const isDragOver = dragOver === visualIdx;
          const moved = cardIdx !== visualIdx; // card moved from original position
          return React.createElement("div", {
            key: card.id,
            draggable: true,
            onDragStart: () => handleDragStart(visualIdx),
            onDragOver: (e) => handleDragOver(e, visualIdx),
            onDrop: () => handleDrop(visualIdx),
            onDragEnd: handleDragEnd,
            style: {
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
              background: isDragging ? 'rgba(99,102,241,0.15)' : isDragOver ? 'rgba(99,102,241,0.08)' : moved ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.02)',
              borderRadius: T.radiusSm, marginBottom: 4, cursor: 'grab',
              border: `1px solid ${isDragOver ? T.accent : moved ? 'rgba(34,197,94,0.2)' : T.border}`,
              opacity: isDragging ? 0.6 : 1,
              transition: 'all 0.15s',
            },
          },
            React.createElement("span", { style: { color: T.textMuted, fontSize: 14 } }, "\u2630"),
            // New order number
            React.createElement("span", { style: { width: 28, height: 28, borderRadius: T.radiusPill, background: moved ? T.success : T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0, transition: 'background 0.2s' } }, visualIdx + 1),
            // Original card number (dimmed)
            React.createElement("span", { style: { width: 40, textAlign: 'center', flexShrink: 0 } },
              React.createElement("span", { style: { fontSize: 11, color: moved ? T.textSecondary : T.textMuted, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: T.radiusPill } }, `#${cardIdx + 1}`)
            ),
            // Card name
            React.createElement("span", { style: { color: T.text, fontSize: 13, fontWeight: 500, flex: 1 } }, card.name || card.title || card.subtitle || `카드 ${cardIdx + 1}`),
            // Move indicator
            moved && React.createElement("span", { style: { fontSize: 10, color: T.success, fontWeight: 600 } }, `${cardIdx + 1}\u2192${visualIdx + 1}`),
          );
        })
      ),
      React.createElement("div", { style: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: `1px solid ${T.border}` } },
        React.createElement("button", { onClick: onClose, style: { padding: '8px 20px', background: 'rgba(255,255,255,0.06)', color: T.textSecondary, borderRadius: T.radiusPill, border: 'none', fontSize: 13, cursor: 'pointer' } }, "취소"),
        React.createElement("button", { onClick: confirm, style: { padding: '8px 20px', background: T.accent, color: '#fff', borderRadius: T.radiusPill, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' } }, "적용"),
      )
    )
  );
}

/* ── Info Panel (header dropdown) ── */
function InfoPanel({ onClose }) {
  return React.createElement("div", {
    style: { position: 'absolute', top: '100%', left: 0, marginTop: 8, background: T.surface, borderRadius: T.radius, boxShadow: T.shadowLg, border: `1px solid ${T.border}`, padding: '20px 24px', width: 320, zIndex: 30 },
  },
    // Logo + title
    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 } },
      React.createElement("img", { src: "/icon-round.png", style: { width: 40, height: 40, borderRadius: 10 } }),
      React.createElement("div", null,
        React.createElement("div", { style: { fontFamily: "'Bitcount Prop Single', monospace", fontSize: 20, color: T.text, letterSpacing: '0.05em' } }, "YOUMECA"),
        React.createElement("div", { style: { fontSize: 11, color: T.textMuted } }, VERSION),
      ),
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

/* ── App ── */
export default function App() {
  const mob = useIsMobile();
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [showJson, setShowJson] = useState(false);
  const [jsonStr, setJsonStr] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [results, setResults] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [confirmClose, setConfirmClose] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const infoRef = useRef(null);

  // Close info panel on outside click
  useEffect(() => {
    const handler = (e) => { if (showInfo && infoRef.current && !infoRef.current.contains(e.target)) setShowInfo(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showInfo]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadProjects();
    if (saved) {
      setProjects(saved.projects);
      setActiveProjectId(saved.activeId || saved.projects[0]?.id);
    } else {
      const first = DEFAULT_PROJECT('프로젝트 1');
      setProjects([first]);
      setActiveProjectId(first.id);
    }
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
  const addCard = () => setCards(p => [...p, { ...DEFAULT_CARD(), url: globalUrl || p[p.length-1]?.url || "" }]);

  // Project tab actions
  const addProject = () => {
    const name = prompt('새 프로젝트 이름을 입력하세요:', `프로젝트 ${projects.length + 1}`);
    if (!name?.trim()) return;
    const proj = DEFAULT_PROJECT(name.trim());
    setProjects(prev => [...prev, proj]);
    setActiveProjectId(proj.id);
    setGenProgress(''); setResults([]);
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
      video_position: [c.videoX, c.videoY], video_scale: c.videoScale || 110,
      output_size: outputSize,
      aspect_ratio: aspectRatio,
      image_source: c.imageSource || 'thumbnail',
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
    setGenerating(true); setResults([]); setGenProgress("오버레이 생성 중...");
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
            clearInterval(pollInterval); setResults(downloadUrls);
            setGenProgress(`완료! ${completedCards}/${cardCount}개 생성됨${failedCards > 0 ? ` \u00B7 ${failedCards}개 실패` : ""}`);
            setGenerating(false);
          }
        } catch (e) {}
      }, 1500);
    } catch (err) { alert(`오류: ${err.message}`); setGenProgress(""); setGenerating(false); }
  };

  const handleDownloadAll = async () => {
    if (results.length === 0) return;
    setDownloading(true);
    try { await downloadAllAsZip(results, outputFormat); }
    catch (e) { alert('ZIP 다운로드 실패: ' + e.message); }
    finally { setDownloading(false); }
  };

  return React.createElement("div", { style: { minHeight: "100vh", background: T.bg } },
    React.createElement(Head, null,
      React.createElement("title", null, "YOUMECA \u2014 유메카"),
      React.createElement("link", { rel: "icon", href: "/favicon.ico" }),
      React.createElement("link", { rel: "apple-touch-icon", href: "/icon-192.png" }),
      React.createElement("meta", { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" }),
      React.createElement("meta", { name: "theme-color", content: "#09090b" }),
      React.createElement("link", { rel: "preconnect", href: "https://fonts.googleapis.com" }),
      React.createElement("link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" }),
      React.createElement("link", { href: "https://fonts.googleapis.com/css2?family=Bitcount+Prop+Single&display=swap", rel: "stylesheet" }),
    ),

    // ── Header ──
    React.createElement("header", { style: { position: 'sticky', top: 0, zIndex: 20, background: 'rgba(9,9,11,0.8)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${T.border}` } },
      React.createElement("div", { style: { maxWidth: 1200, margin: '0 auto', padding: mob ? '8px 12px' : '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: mob ? 8 : 16, flexWrap: mob ? 'wrap' : 'nowrap' } },

        // Logo area
        React.createElement("div", { ref: infoRef, style: { position: 'relative', display: 'flex', alignItems: 'center', gap: mob ? 6 : 10, flexShrink: 0 } },
          React.createElement("div", {
            onClick: () => setShowInfo(!showInfo),
            style: { display: 'flex', alignItems: 'center', gap: mob ? 6 : 8, cursor: 'pointer', padding: '4px 8px', borderRadius: T.radiusSm, transition: 'background 0.15s' },
            onMouseEnter: (e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)',
            onMouseLeave: (e) => e.currentTarget.style.background = 'transparent',
          },
            React.createElement("img", { src: "/icon-round.png", style: { width: mob ? 24 : 28, height: mob ? 24 : 28, borderRadius: 7 } }),
            React.createElement("span", { style: { fontFamily: "'Bitcount Prop Single', monospace", fontSize: mob ? 18 : 22, fontWeight: 400, letterSpacing: '0.05em', color: T.text, lineHeight: 1 } }, "YOUMECA"),
            !mob && React.createElement("span", { style: { fontSize: 10, color: T.textMuted, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: T.radiusPill } }, VERSION),
          ),
          !mob && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 1 } },
            React.createElement("span", { style: { fontSize: 12, color: T.text, fontWeight: 600, whiteSpace: 'nowrap' } }, "유메카, 내가 꿈꾸던 카드뉴스 생성기"),
            React.createElement("span", { style: { fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap' } }, "유튜브 영상을 쉽게 카드뉴스로 만들어보세요"),
          ),
          showInfo && React.createElement(InfoPanel, { onClose: () => setShowInfo(false) }),
        ),

        // Project Tabs
        !mob && projects.length > 0 && React.createElement(ProjectTabs, {
          projects, activeId: activeProjectId,
          onSwitch: switchProject, onAdd: addProject,
          onClose: closeProject, onRename: renameProject,
        }),

        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: mob ? 6 : 8, flexShrink: 0 } },
          !mob && React.createElement("span", { style: { fontSize: 12, color: T.textMuted } }, `카드 ${cards.length}개`),
          React.createElement("button", { onClick: exportJson, style: { padding: mob ? '6px 12px' : '8px 16px', background: 'rgba(255,255,255,0.05)', color: T.textSecondary, borderRadius: T.radiusPill, border: 'none', fontSize: mob ? 12 : 13, cursor: 'pointer', transition: 'all 0.15s' } }, "JSON"),
          React.createElement("button", {
            onClick: handleGenerate, disabled: generating,
            style: { padding: '9px 24px', background: generating ? T.surfaceHover : T.success, color: generating ? T.textMuted : '#fff', borderRadius: T.radiusPill, border: 'none', fontSize: 14, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: generating ? 'none' : '0 2px 8px rgba(34,197,94,0.3)' }
          }, generating ? "생성 중..." : "생성하기"),
        )
      )
    ),

    // ── Progress ──
    (generating || genProgress) && React.createElement("div", { style: { background: T.surface, borderBottom: `1px solid ${T.border}`, padding: mob ? '8px 12px' : '10px 24px' } },
      React.createElement("div", { style: { maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: mob ? 8 : 12, flexWrap: 'wrap' } },
        generating && React.createElement("div", { style: { width: 14, height: 14, border: `2px solid ${T.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' } }),
        React.createElement("span", { style: { fontSize: mob ? 12 : 13, color: generating ? T.accent : T.success, fontWeight: 500 } }, genProgress),
        results.length > 0 && !generating && React.createElement("div", { style: { marginLeft: mob ? 0 : 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', width: mob ? '100%' : 'auto' } },
          results.map((url, i) => React.createElement("a", { key: i, href: url, download: true, style: { padding: '5px 14px', background: T.accent, color: '#fff', borderRadius: T.radiusPill, fontSize: 12, textDecoration: 'none', fontWeight: 500 } }, `카드 ${i+1}`)),
          results.length > 1 && React.createElement("button", {
            onClick: handleDownloadAll, disabled: downloading,
            style: { padding: '6px 16px', background: T.success, color: '#fff', borderRadius: T.radiusPill, border: 'none', fontSize: 12, fontWeight: 600, cursor: downloading ? 'not-allowed' : 'pointer', transition: 'all 0.15s', marginLeft: 4 }
          }, downloading ? "압축 중..." : "한 번에 다운로드"),
        ),
      )
    ),

    // ── Main ──
    React.createElement("main", { style: { maxWidth: 1200, margin: '0 auto', padding: mob ? '12px 10px 32px' : '24px 24px 48px', display: 'flex', flexDirection: 'column', gap: mob ? 12 : 16 } },

      // Mobile Project Tabs
      mob && projects.length > 0 && React.createElement("div", { style: { overflowX: 'auto', paddingBottom: 4 } },
        React.createElement(ProjectTabs, {
          projects, activeId: activeProjectId,
          onSwitch: switchProject, onAdd: addProject,
          onClose: closeProject, onRename: renameProject,
        }),
      ),

      // Global Settings
      React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, padding: mob ? '12px' : '16px 20px', boxShadow: T.shadow, display: 'flex', gap: mob ? 10 : 16, alignItems: 'flex-end', flexWrap: 'wrap' } },
        React.createElement("div", { style: { flex: 1, minWidth: mob ? '100%' : 240 } },
          React.createElement("label", { style: labelBase }, "공통 영상 URL"),
          React.createElement("input", { type: "text", value: globalUrl, placeholder: "https://youtube.com/watch?v=...", onChange: (e) => setGlobalUrl(e.target.value), style: inputBase })
        ),
        React.createElement("div", { style: { display: 'flex', gap: mob ? 10 : 16, flexWrap: 'wrap' } },
          React.createElement("div", null,
            React.createElement("label", { style: labelBase }, "비율"),
            React.createElement("div", { style: { display: 'flex', gap: 4 } },
              ASPECT_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: aspectRatio === opt.id, onClick: () => setAspectRatio(opt.id) }, opt.label))
            )
          ),
          React.createElement("div", null,
            React.createElement("label", { style: labelBase }, "형식"),
            React.createElement("div", { style: { display: 'flex', gap: 4 } },
              React.createElement(PillBtn, { active: outputFormat === "video", onClick: () => setOutputFormat("video") }, "영상"),
              React.createElement(PillBtn, { active: outputFormat === "image", onClick: () => setOutputFormat("image") }, "이미지"),
            )
          ),
          outputFormat === 'image' && React.createElement("div", null,
            React.createElement("label", { style: labelBase }, "이미지 소스"),
            React.createElement("div", { style: { display: 'flex', gap: 4 } },
              IMAGE_SOURCE_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: globalImageSource === opt.id, onClick: () => setGlobalImageSource(opt.id) }, opt.label))
            )
          ),
          React.createElement("div", null,
            React.createElement("label", { style: labelBase }, "해상도"),
            React.createElement("div", { style: { display: 'flex', gap: 4 } },
              React.createElement(PillBtn, { active: outputSize === 720, onClick: () => setOutputSize(720) }, "720p"),
              React.createElement(PillBtn, { active: outputSize === 1080, onClick: () => setOutputSize(1080) }, "1080p"),
            )
          ),
        )
      ),

      // Global background image upload (when image format)
      outputFormat === 'image' && React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, padding: mob ? '12px' : '16px 20px', boxShadow: T.shadow } },
        React.createElement("label", { style: labelBase }, "공통 배경 이미지"),
        React.createElement(ImageUploadField, { value: globalBgImage, onChange: setGlobalBgImage, maxMb: 5 }),
      ),

      // Cards
      cards.map((card, i) =>
        React.createElement(CardEditor, {
          key: card.id, card, index: i,
          onChange: (c) => updateCard(i, c),
          onRemove: () => removeCard(i),
          onDuplicate: () => duplicateCard(i),
          total: cards.length, globalUrl, aspectRatio, outputFormat,
          globalBgImage, mob,
          onReorder: () => setShowReorder(true),
        })
      ),

      // Add card
      React.createElement("button", {
        onClick: addCard,
        style: { width: '100%', padding: 16, border: `2px dashed ${T.border}`, borderRadius: T.radius, background: 'transparent', color: T.textMuted, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s' },
        onMouseEnter: (e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; },
        onMouseLeave: (e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; },
      }, "+ 카드 추가"),
    ),

    showJson && React.createElement(JsonModal, { json: jsonStr, onClose: () => setShowJson(false) }),
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
    React.createElement("style", null, `@keyframes spin { to { transform: rotate(360deg); } }`)
  );
}
