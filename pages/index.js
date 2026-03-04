import React, { useState, useRef, useEffect, useCallback } from 'react';
import Head from 'next/head';
import JSZip from 'jszip';

/* ── Constants ── */
const LAYOUT_OPTIONS = [
  { id: "photo_top", label: "사진↑ 텍스트↓" },
  { id: "photo_bottom", label: "텍스트↑ 사진↓" },
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
  url: "", start: "", end: "",
  layout: "photo_top", photoRatio: 0.55, videoFill: "full",
  imageSource: "thumbnail", uploadedImage: null,
  useTitle: true, useSubtitle: true, useBody: true,
  title: "", titleSize: 56, titleFont: "Pretendard-Bold.otf",
  subtitle: "", subtitleSize: 44, subtitleFont: "Pretendard-Regular.otf",
  body: "", bodySize: 36, bodyFont: "Pretendard-Regular.otf",
  bgColor: "#121212", bgOpacity: 0.75,
  titleColor: "#ffffff", subtitleColor: "#aaaaaa", bodyColor: "#d2d2d2",
  captureTime: "", videoX: 50, videoY: 50, videoScale: 110,
});

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
    // 분리형: 불투명 배경 (opacity=1), 전체 채우기: 반투명 배경
    const effectiveOpacity = videoFill === "split" ? 1 : bgOpacity;
    ctx.fillStyle = `rgba(${bgColor[0]},${bgColor[1]},${bgColor[2]},${effectiveOpacity})`;
    ctx.fillRect(0, yStart, w, textH);
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
    }, enabled !== false && React.createElement("span", { style: { color: '#fff', fontSize: 12, lineHeight: 1 } }, "✓")),
    input,
    React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', opacity: disabled ? 0.35 : 1 } },
      React.createElement("input", { type: "number", value: size, disabled, onChange: (e) => onSizeChange(parseInt(e.target.value) || 0), style: { width: 52, padding: '7px 4px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 12, color: T.textMuted, textAlign: 'center', outline: 'none' } }),
      React.createElement("input", { type: "color", value: color, disabled, onChange: (e) => onColorChange(e.target.value), style: { width: 36, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, cursor: disabled ? 'default' : 'pointer', background: 'transparent' } }),
    )
  );
}

/* ── CardPreview ── */
function CardPreview({ card, globalUrl, aspectRatio = '1:1' }) {
  const previewW = 320;
  const previewH = aspectRatio === '3:4' ? Math.round(320 * 4 / 3) : 320;
  const textRatio = 1 - card.photoRatio;
  const textH = card.layout === "text_overlay" ? previewH : Math.round(previewH * textRatio);
  const videoFill = card.videoFill || "full";
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

  useEffect(() => {
    if (thumbnailId) { setThumbSrc(`https://img.youtube.com/vi/${thumbnailId}/maxresdefault.jpg`); setTried(0); }
    else setThumbSrc(null);
  }, [thumbnailId]);

  const handleThumbError = () => {
    if (tried === 0) { setThumbSrc(`https://img.youtube.com/vi/${thumbnailId}/hqdefault.jpg`); setTried(1); }
    else setThumbSrc(null);
  };

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

  const BgImage = () => thumbSrc
    ? React.createElement("img", { src: thumbSrc, alt: "", onError: handleThumbError, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, transform: `scale(${vScale})`, transformOrigin: `${card.videoX}% ${card.videoY}%` } })
    : React.createElement("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 0 } },
        React.createElement("div", { style: { width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" } },
          React.createElement("span", { style: { color: "rgba(255,255,255,0.5)", fontSize: 18, marginLeft: 2 } }, "▶")
        ));

  const TimestampLink = () => ytLink ? React.createElement("a", {
    href: ytLink, target: "_blank", rel: "noopener noreferrer",
    onClick: (e) => e.stopPropagation(),
    style: { position: "absolute", top: 8, right: 8, zIndex: 10, padding: "4px 10px", borderRadius: T.radiusPill, background: "rgba(99,102,241,0.9)", color: "#fff", fontSize: 10, fontWeight: 600, textDecoration: "none", boxShadow: T.shadow }
  }, `▶ ${formatSec(seekTime)}`) : null;

  const wrapper = { width: previewW, height: previewH, borderRadius: T.radius, overflow: "hidden", flexShrink: 0, position: "relative", boxShadow: T.shadowLg };

  if (card.layout === "text_overlay") {
    return React.createElement("div", { style: wrapper },
      React.createElement(BgImage), React.createElement(TimestampLink),
      React.createElement("div", { style: { position: "absolute", bottom: 0, left: 0, right: 0, height: "80%", background: `linear-gradient(to bottom, transparent 0%, rgba(${bgRgb.join(",")},0.5) 20%, rgba(${bgRgb.join(",")},0.9) 40%, rgba(${bgRgb.join(",")},0.95) 100%)`, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: `${padTop*3}px ${padX}px ${padTop}px`, zIndex: 2 } },
        card.title && React.createElement("div", { style: { fontSize: titleFs, fontWeight: 700, color: card.titleColor, marginBottom: 3, lineHeight: 1.3 } }, card.title),
        card.subtitle && React.createElement("div", { style: { fontSize: subtitleFs, color: card.subtitleColor, marginBottom: 5, lineHeight: 1.3 } }, card.subtitle),
        card.body && React.createElement("div", { style: { fontSize: bodyFs, color: card.bodyColor, lineHeight: 1.5, whiteSpace: "pre-wrap" } }, card.body),
      ));
  }

  const isTop = card.layout === "photo_top";
  const videoAreaH = previewH - textH;

  // 분리형: 영상은 영상 영역에만, 텍스트 영역은 순수 배경색 (불투명)
  if (videoFill === "split") {
    return React.createElement("div", { style: wrapper },
      // 영상 영역
      React.createElement("div", { style: { position: "absolute", left: 0, right: 0, height: videoAreaH, ...(isTop ? { top: 0 } : { bottom: 0 }), overflow: "hidden" } },
        React.createElement(BgImage),
      ),
      React.createElement(TimestampLink),
      // 텍스트 영역 (불투명 배경, 영상 없음)
      React.createElement("div", { style: { position: "absolute", left: 0, right: 0, height: textH, zIndex: 2, ...(isTop ? { bottom: 0 } : { top: 0 }), overflow: "hidden" } },
        React.createElement("div", { style: { position: "absolute", inset: 0, background: `rgb(${bgRgb.join(",")})` } }),
        React.createElement(TextContent)
      ));
  }

  // 전체 채우기: 기존 로직 (반투명 배경)
  return React.createElement("div", { style: wrapper },
    React.createElement(BgImage), React.createElement(TimestampLink),
    React.createElement("div", { style: { position: "absolute", left: 0, right: 0, height: textH, zIndex: 2, ...(isTop ? { bottom: 0 } : { top: 0 }), overflow: "hidden" } },
      React.createElement("div", { style: { position: "absolute", inset: 0, background: `rgba(${bgRgb.join(",")},${card.bgOpacity})` } }),
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

/* ── CardEditor ── */
function CardEditor({ card, index, onChange, onRemove, onDuplicate, total, globalUrl, aspectRatio, outputFormat }) {
  const [expanded, setExpanded] = useState(true);
  const update = (key, val) => onChange({ ...card, [key]: val });

  return React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, overflow: 'hidden', boxShadow: T.shadow } },
    // Header
    React.createElement("div", {
      onClick: () => setExpanded(!expanded),
      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', transition: 'background 0.15s' },
      onMouseEnter: (e) => e.currentTarget.style.background = T.surfaceHover,
      onMouseLeave: (e) => e.currentTarget.style.background = 'transparent',
    },
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        React.createElement("span", { style: { width: 28, height: 28, borderRadius: T.radiusPill, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' } }, index + 1),
        React.createElement("span", { style: { color: T.text, fontWeight: 500, fontSize: 14 } }, card.title || card.subtitle || `카드 ${index + 1}`),
        card.start && React.createElement("span", { style: { color: T.textMuted, fontSize: 12, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: T.radiusPill } }, `${card.start} ~ ${card.end}`)
      ),
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6 } },
        React.createElement("button", { onClick: (e) => { e.stopPropagation(); onDuplicate(); }, style: { background: 'rgba(255,255,255,0.05)', border: 'none', color: T.textMuted, fontSize: 12, cursor: 'pointer', padding: '4px 10px', borderRadius: T.radiusPill, transition: 'all 0.15s' } }, "복제"),
        total > 1 && React.createElement("button", { onClick: (e) => { e.stopPropagation(); onRemove(); }, style: { background: 'rgba(239,68,68,0.1)', border: 'none', color: T.danger, fontSize: 12, cursor: 'pointer', padding: '4px 10px', borderRadius: T.radiusPill } }, "삭제"),
        React.createElement("span", { style: { color: T.textMuted, fontSize: 14, marginLeft: 4, transition: 'transform 0.2s', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' } }, "▾")
      )
    ),

    // Body
    expanded && React.createElement("div", { style: { padding: '0 20px 20px', display: 'flex', gap: 28 } },
      // Left: Form
      React.createElement("div", { style: { flex: 1, minWidth: 0 } },

        // ── 영상 설정 ──
        React.createElement(Section, { title: "영상 설정" },
          React.createElement("input", { type: "text", value: card.url, placeholder: "개별 URL (비워두면 공통 URL)", onChange: (e) => update("url", e.target.value), style: inputBase }),
          React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 } },
            React.createElement("div", null, React.createElement("label", { style: { ...labelBase, fontSize: 11 } }, "시작"), React.createElement("input", { type: "text", value: card.start, placeholder: "0:00", onChange: (e) => update("start", e.target.value), style: { ...inputBase, padding: '8px 10px', fontSize: 13 } })),
            React.createElement("div", null, React.createElement("label", { style: { ...labelBase, fontSize: 11 } }, "종료"), React.createElement("input", { type: "text", value: card.end, placeholder: "0:10", onChange: (e) => update("end", e.target.value), style: { ...inputBase, padding: '8px 10px', fontSize: 13 } })),
            React.createElement("div", null, React.createElement("label", { style: { ...labelBase, fontSize: 11 } }, "캡처 시점"), React.createElement("input", { type: "text", value: card.captureTime, placeholder: "선택", onChange: (e) => update("captureTime", e.target.value), style: { ...inputBase, padding: '8px 10px', fontSize: 13 } })),
          ),
          React.createElement("div", null,
            React.createElement("label", { style: labelBase }, "레이아웃"),
            React.createElement("div", { style: { display: 'flex', gap: 6 } },
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

        // ── 이미지 소스 (이미지 형식일 때) ──
        outputFormat === 'image' && React.createElement(Section, { title: "이미지 소스" },
          React.createElement("div", { style: { display: 'flex', gap: 6 } },
            IMAGE_SOURCE_OPTIONS.map(opt => React.createElement(PillBtn, { key: opt.id, active: (card.imageSource || "thumbnail") === opt.id, onClick: () => update("imageSource", opt.id) }, opt.label))
          ),
          (card.imageSource === "upload") && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            React.createElement("input", {
              type: "file", accept: "image/*",
              onChange: (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 3 * 1024 * 1024) { alert("3MB 이하 이미지만 업로드 가능합니다."); e.target.value = ''; return; }
                const reader = new FileReader();
                reader.onload = () => update("uploadedImage", reader.result);
                reader.readAsDataURL(file);
              },
              style: { fontSize: 12, color: T.textSecondary },
            }),
            card.uploadedImage && React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              React.createElement("img", { src: card.uploadedImage, style: { width: 48, height: 48, borderRadius: 6, objectFit: 'cover' } }),
              React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, "업로드 완료"),
              React.createElement("button", { onClick: () => update("uploadedImage", null), style: { background: 'none', border: 'none', color: T.danger, fontSize: 11, cursor: 'pointer' } }, "삭제"),
            ),
            !card.uploadedImage && React.createElement("span", { style: { fontSize: 11, color: T.textMuted } }, "3MB 이하 · JPG, PNG 권장"),
          ),
        ),

        // ── 텍스트 내용 ──
        React.createElement(Section, { title: "텍스트 내용" },
          React.createElement(TextFieldRow, { value: card.title, onTextChange: (v) => update("title", v), placeholder: "제목 (크고 두껍게)", size: card.titleSize, onSizeChange: (v) => update("titleSize", v), color: card.titleColor, onColorChange: (v) => update("titleColor", v), enabled: card.useTitle !== false, onToggle: () => update("useTitle", card.useTitle === false ? true : false) }),
          React.createElement(TextFieldRow, { value: card.subtitle, onTextChange: (v) => update("subtitle", v), placeholder: "부제", size: card.subtitleSize, onSizeChange: (v) => update("subtitleSize", v), color: card.subtitleColor, onColorChange: (v) => update("subtitleColor", v), enabled: card.useSubtitle !== false, onToggle: () => update("useSubtitle", card.useSubtitle === false ? true : false) }),
          React.createElement(TextFieldRow, { value: card.body, onTextChange: (v) => update("body", v), placeholder: "본문 내용...", rows: 3, size: card.bodySize, onSizeChange: (v) => update("bodySize", v), color: card.bodyColor, onColorChange: (v) => update("bodyColor", v), enabled: card.useBody !== false, onToggle: () => update("useBody", card.useBody === false ? true : false) }),
        ),

        // ── 배경 설정 ──
        card.layout !== "text_overlay" && React.createElement(Section, { title: "배경 설정" },
          React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            React.createElement("label", { style: { fontSize: 12, color: T.textMuted } }, "색상"),
            React.createElement("input", { type: "color", value: card.bgColor, onChange: (e) => update("bgColor", e.target.value), style: { width: 32, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, cursor: 'pointer' } }),
            React.createElement("span", { style: { fontSize: 12, color: T.textMuted } }, card.bgColor),
          ),
          React.createElement(SliderRow, { label: "투명도", value: card.bgOpacity, min: 0, max: 1, step: 0.05, onChange: (v) => update("bgOpacity", v) }),
        ),
      ),

      // Right: Preview (sticky)
      React.createElement("div", { style: { flexShrink: 0, position: 'sticky', top: 80, alignSelf: 'flex-start' } },
        React.createElement("div", { style: { ...sectionTitle, textAlign: 'center' } }, "미리보기"),
        React.createElement(CardPreview, { card: { ...card, title: card.useTitle !== false ? card.title : '', subtitle: card.useSubtitle !== false ? card.subtitle : '', body: card.useBody !== false ? card.body : '' }, globalUrl, aspectRatio }),
      )
    )
  );
}

/* ── JSON Modal ── */
function JsonModal({ json, onClose }) {
  const textRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { textRef.current?.select(); navigator.clipboard.writeText(json).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  return React.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: 'blur(4px)', display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 32 } },
    React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, maxWidth: 640, width: "100%", boxShadow: T.shadowLg } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${T.border}` } },
        React.createElement("h3", { style: { fontWeight: 600, fontSize: 15 } }, "JSON 내보내기"),
        React.createElement("button", { onClick: onClose, style: { background: "none", border: "none", color: T.textMuted, fontSize: 20, cursor: "pointer" } }, "✕")
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
      React.createElement("p", { style: { color: T.text, fontSize: 15, lineHeight: 1.6, marginBottom: 24 } }, message),
      React.createElement("div", { style: { display: 'flex', gap: 10, justifyContent: 'center' } },
        React.createElement("button", { onClick: onCancel, style: { padding: '9px 24px', background: 'rgba(255,255,255,0.06)', color: T.textSecondary, borderRadius: T.radiusPill, border: 'none', fontSize: 13, cursor: 'pointer' } }, "취소"),
        React.createElement("button", { onClick: onConfirm, style: { padding: '9px 24px', background: T.danger, color: '#fff', borderRadius: T.radiusPill, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' } }, "닫기"),
      )
    )
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
        }, "✎"),
        projects.length > 1 && React.createElement("button", {
          onClick: (e) => { e.stopPropagation(); onClose(proj.id); },
          style: { background: 'none', border: 'none', color: T.textMuted, fontSize: 13, cursor: 'pointer', padding: '0 2px', lineHeight: 1, opacity: 0.6 },
          onMouseEnter: (e) => e.currentTarget.style.opacity = 1,
          onMouseLeave: (e) => e.currentTarget.style.opacity = 0.6,
        }, "×"),
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
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [showJson, setShowJson] = useState(false);
  const [jsonStr, setJsonStr] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [results, setResults] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [confirmClose, setConfirmClose] = useState(null);

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
  const cards = activeProject?.cards || [];

  const updateProject = useCallback((updates) => {
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, ...updates } : p));
  }, [activeProjectId]);

  const setGlobalUrl = (v) => updateProject({ globalUrl: v });
  const setOutputFormat = (v) => updateProject({ outputFormat: v });
  const setOutputSize = (v) => updateProject({ outputSize: v });
  const setAspectRatio = (v) => updateProject({ aspectRatio: v });
  const setGlobalImageSource = (v) => updateProject({ globalImageSource: v });
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

  // 체크 해제된 텍스트 필드는 빈 문자열로 처리
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
    text_bg_color: hexToRgb(c.bgColor), text_bg_opacity: c.bgOpacity,
    video_position: [c.videoX, c.videoY], video_scale: c.videoScale || 110,
    output_size: outputSize,
    aspect_ratio: aspectRatio,
    image_source: c.imageSource || 'thumbnail',
    ...(c.url && c.url !== globalUrl ? { url: c.url } : {}),
    ...(c.captureTime ? { capture_time: c.captureTime } : {}),
  }; };

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
            setGenProgress(`완료! ${completedCards}/${cardCount}개 생성됨${failedCards > 0 ? ` · ${failedCards}개 실패` : ""}`);
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
    React.createElement(Head, null, React.createElement("title", null, "YT2C — 카드뉴스 메이커")),

    // ── Header ──
    React.createElement("header", { style: { position: 'sticky', top: 0, zIndex: 20, background: 'rgba(9,9,11,0.8)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${T.border}` } },
      React.createElement("div", { style: { maxWidth: 1200, margin: '0 auto', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 } },
        React.createElement("h1", { style: { fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', flexShrink: 0 } }, "YT2C"),

        // Project Tabs
        projects.length > 0 && React.createElement(ProjectTabs, {
          projects, activeId: activeProjectId,
          onSwitch: switchProject, onAdd: addProject,
          onClose: closeProject, onRename: renameProject,
        }),

        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 } },
          React.createElement("span", { style: { fontSize: 12, color: T.textMuted } }, `카드 ${cards.length}개`),
          React.createElement("button", { onClick: exportJson, style: { padding: '8px 16px', background: 'rgba(255,255,255,0.05)', color: T.textSecondary, borderRadius: T.radiusPill, border: 'none', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' } }, "JSON"),
          React.createElement("button", {
            onClick: handleGenerate, disabled: generating,
            style: { padding: '9px 24px', background: generating ? T.surfaceHover : T.success, color: generating ? T.textMuted : '#fff', borderRadius: T.radiusPill, border: 'none', fontSize: 14, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: generating ? 'none' : '0 2px 8px rgba(34,197,94,0.3)' }
          }, generating ? "생성 중..." : "생성하기"),
        )
      )
    ),

    // ── Progress ──
    (generating || genProgress) && React.createElement("div", { style: { background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '10px 24px' } },
      React.createElement("div", { style: { maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 } },
        generating && React.createElement("div", { style: { width: 14, height: 14, border: `2px solid ${T.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' } }),
        React.createElement("span", { style: { fontSize: 13, color: generating ? T.accent : T.success, fontWeight: 500 } }, genProgress),
        results.length > 0 && !generating && React.createElement("div", { style: { marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' } },
          results.map((url, i) => React.createElement("a", { key: i, href: url, download: true, style: { padding: '5px 14px', background: T.accent, color: '#fff', borderRadius: T.radiusPill, fontSize: 12, textDecoration: 'none', fontWeight: 500 } }, `카드 ${i+1}`)),
          results.length > 1 && React.createElement("button", {
            onClick: handleDownloadAll, disabled: downloading,
            style: { padding: '6px 16px', background: T.success, color: '#fff', borderRadius: T.radiusPill, border: 'none', fontSize: 12, fontWeight: 600, cursor: downloading ? 'not-allowed' : 'pointer', transition: 'all 0.15s', marginLeft: 4 }
          }, downloading ? "압축 중..." : "한 번에 다운로드"),
        ),
      )
    ),

    // ── Main ──
    React.createElement("main", { style: { maxWidth: 1200, margin: '0 auto', padding: '24px 24px 48px', display: 'flex', flexDirection: 'column', gap: 16 } },

      // Global Settings
      React.createElement("div", { style: { background: T.surface, borderRadius: T.radius, padding: '16px 20px', boxShadow: T.shadow, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' } },
        React.createElement("div", { style: { flex: 1, minWidth: 240 } },
          React.createElement("label", { style: labelBase }, "공통 영상 URL"),
          React.createElement("input", { type: "text", value: globalUrl, placeholder: "https://youtube.com/watch?v=...", onChange: (e) => setGlobalUrl(e.target.value), style: inputBase })
        ),
        React.createElement("div", { style: { display: 'flex', gap: 16 } },
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

      // Cards
      cards.map((card, i) =>
        React.createElement(CardEditor, { key: card.id, card, index: i, onChange: (c) => updateCard(i, c), onRemove: () => removeCard(i), onDuplicate: () => duplicateCard(i), total: cards.length, globalUrl, aspectRatio, outputFormat })
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
    React.createElement("style", null, `@keyframes spin { to { transform: rotate(360deg); } }`)
  );
}
