import React, { useState, useRef, useEffect, useCallback } from 'react';
import Head from 'next/head';

const LAYOUT_OPTIONS = [
  { id: "photo_top", label: "사진 위 / 텍스트 아래" },
  { id: "photo_bottom", label: "텍스트 위 / 사진 아래" },
  { id: "text_overlay", label: "사진 위 텍스트 오버레이" },
];

const DEFAULT_CARD = () => ({
  id: Date.now() + Math.random(),
  url: "", start: "", end: "",
  layout: "photo_top", photoRatio: 0.55,
  title: "", titleSize: 56, titleFont: "Pretendard-Bold.otf",
  subtitle: "", subtitleSize: 44, subtitleFont: "Pretendard-Regular.otf",
  body: "", bodySize: 36, bodyFont: "Pretendard-Regular.otf",
  bgColor: "#121212", bgOpacity: 0.75,
  titleColor: "#ffffff", subtitleColor: "#aaaaaa", bodyColor: "#d2d2d2",
  captureTime: "", videoX: 50, videoY: 50, videoScale: 110,
});

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

// ── 오버레이 Canvas 생성 (Python card_gen.py의 create_overlay_image를 JS로 포팅) ──
async function generateOverlayPng(card, outputSize) {
  const size = outputSize;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, size, size);

  const layout = card.layout || "photo_top";
  const photoRatio = card.photoRatio || 0.55;
  const textRatio = 1 - photoRatio;
  const bgColor = hexToRgb(card.bgColor || "#121212");
  const bgOpacity = card.bgOpacity ?? 0.75;
  const padX = 60;
  const padTop = 40;
  const maxTextW = size - padX * 2;

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
        if (ctx.measureText(test).width > maxTextW && cur) {
          lines.push(cur);
          cur = ch;
        } else {
          cur = test;
        }
      }
      if (cur) lines.push(cur);
    }
    return lines;
  }

  if (layout === "text_overlay") {
    const titleLines = wrapText(card.title, card.titleSize, card.titleFont);
    const subtitleLines = wrapText(card.subtitle, card.subtitleSize, card.subtitleFont);
    const bodyLines = wrapText(card.body, card.bodySize, card.bodyFont);

    let totalTextH = padTop * 2;
    totalTextH += titleLines.length * (card.titleSize + 8);
    if (card.subtitle) totalTextH += 12 + subtitleLines.length * (card.subtitleSize + 8);
    if (card.body) totalTextH += 24 + bodyLines.length * (card.bodySize + 10);

    const gradH = Math.min(Math.round(size * 0.80), totalTextH + 200);
    const maxAlpha = Math.max(Math.round(bgOpacity * 255), 230) / 255;

    for (let y = size - gradH; y < size; y++) {
      const progress = (y - (size - gradH)) / gradH;
      let alpha;
      if (progress < 0.2) {
        const t = progress / 0.2;
        alpha = t * t * maxAlpha * 0.5;
      } else if (progress < 0.4) {
        const t = (progress - 0.2) / 0.2;
        alpha = (0.5 + 0.4 * t) * maxAlpha;
      } else {
        const t = (progress - 0.4) / 0.6;
        alpha = (0.9 + 0.1 * t) * maxAlpha;
      }
      alpha = Math.min(alpha, maxAlpha);
      ctx.fillStyle = `rgba(${bgColor[0]},${bgColor[1]},${bgColor[2]},${alpha})`;
      ctx.fillRect(0, y, size, 1);
    }

    let curY = size - padTop;
    const allItems = [];
    if (card.title) {
      for (const ln of titleLines)
        allItems.push({ type: "title", text: ln, font: getFont(card.titleFont, card.titleSize), color: card.titleColor, lh: card.titleSize + 8 });
    }
    if (card.subtitle) {
      allItems.push({ type: "gap", size: 12 });
      for (const ln of subtitleLines)
        allItems.push({ type: "subtitle", text: ln, font: getFont(card.subtitleFont, card.subtitleSize), color: card.subtitleColor, lh: card.subtitleSize + 8 });
    }
    if (card.body) {
      allItems.push({ type: "gap", size: 24 });
      for (const ln of bodyLines)
        allItems.push({ type: "body", text: ln, font: getFont(card.bodyFont, card.bodySize), color: card.bodyColor, lh: card.bodySize + 10 });
    }

    allItems.reverse();
    for (const item of allItems) {
      if (item.type === "gap") { curY -= item.size; continue; }
      if (!item.text) { curY -= 20; continue; }
      curY -= item.lh;
      ctx.font = item.font;
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, padX, curY + item.lh * 0.78);
    }

  } else {
    const textH = Math.round(size * textRatio);
    const yStart = layout === "photo_top" ? size - textH : 0;
    const bgAlpha = bgOpacity;

    ctx.fillStyle = `rgba(${bgColor[0]},${bgColor[1]},${bgColor[2]},${bgAlpha})`;
    ctx.fillRect(0, yStart, size, textH);

    let curY = yStart + padTop;

    if (card.title) {
      ctx.font = getFont(card.titleFont, card.titleSize);
      ctx.fillStyle = card.titleColor;
      for (const ln of wrapText(card.title, card.titleSize, card.titleFont)) {
        ctx.fillText(ln, padX, curY + card.titleSize * 0.85);
        curY += card.titleSize + 8;
      }
    }
    if (card.subtitle) {
      if (card.title) curY += 8;
      ctx.font = getFont(card.subtitleFont, card.subtitleSize);
      ctx.fillStyle = card.subtitleColor;
      for (const ln of wrapText(card.subtitle, card.subtitleSize, card.subtitleFont)) {
        ctx.fillText(ln, padX, curY + card.subtitleSize * 0.85);
        curY += card.subtitleSize + 8;
      }
    }
    if (card.body) {
      if (card.title || card.subtitle) curY += 16;
      ctx.font = getFont(card.bodyFont, card.bodySize);
      ctx.fillStyle = card.bodyColor;
      for (const ln of wrapText(card.body, card.bodySize, card.bodyFont)) {
        if (!ln) { curY += card.bodySize / 2; continue; }
        ctx.fillText(ln, padX, curY + card.bodySize * 0.85);
        curY += card.bodySize + 10;
      }
    }
  }

  // 2px 어두운 테두리
  ctx.fillStyle = "rgba(0,0,0,0.78)";
  ctx.fillRect(0, 0, size, 2);
  ctx.fillRect(0, size - 2, size, 2);
  ctx.fillRect(0, 0, 2, size);
  ctx.fillRect(size - 2, 0, 2, size);

  return canvas.toDataURL("image/png");
}

// ── TimeInput ──
function TimeInput({ value, onChange, placeholder }) {
  return React.createElement("input", {
    type: "text", value, placeholder,
    onChange: (e) => onChange(e.target.value),
    style: { width: 96, padding: "6px 8px", background: "#262626", border: "1px solid #404040", borderRadius: 6, fontSize: 14, color: "#fff", outline: "none" },
  });
}

// ── CardPreview ──
function CardPreview({ card, globalUrl }) {
  const size = 340;
  const textRatio = 1 - card.photoRatio;
  const textH = card.layout === "text_overlay" ? size : Math.round(size * textRatio);
  const sc = size / 1080;
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

  const TextContent = () => React.createElement("div", {
    style: { position: "relative", padding: `${padTop}px ${padX}px`, height: "100%", boxSizing: "border-box" }
  },
    card.title && React.createElement("div", { style: { fontSize: titleFs, fontWeight: 700, color: card.titleColor, marginBottom: 3, lineHeight: 1.3 } }, card.title),
    card.subtitle && React.createElement("div", { style: { fontSize: subtitleFs, color: card.subtitleColor, marginBottom: 7, lineHeight: 1.3 } }, card.subtitle),
    card.body && React.createElement("div", { style: { fontSize: bodyFs, color: card.bodyColor, lineHeight: 1.5, whiteSpace: "pre-wrap" } }, card.body),
  );

  const BgImage = () => {
    if (thumbSrc) {
      return React.createElement("img", {
        src: thumbSrc, alt: "", onError: handleThumbError,
        style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block", zIndex: 0, transform: `scale(${vScale})`, transformOrigin: `${card.videoX}% ${card.videoY}%` }
      });
    }
    return React.createElement("div", {
      style: { position: "absolute", inset: 0, background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", zIndex: 0 }
    },
      React.createElement("div", { style: { width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 } },
        React.createElement("span", { style: { color: "rgba(255,255,255,0.7)", fontSize: 18, marginLeft: 2 } }, "▶")
      )
    );
  };

  const TimestampLink = () => {
    if (!ytLink) return null;
    return React.createElement("a", {
      href: ytLink, target: "_blank", rel: "noopener noreferrer",
      onClick: (e) => e.stopPropagation(),
      style: { position: "absolute", top: 8, right: 8, zIndex: 10, padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(59,130,246,0.9)", color: "#fff", fontSize: 10, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }
    }, `▶ ${formatSec(seekTime)} 확인`);
  };

  if (card.layout === "text_overlay") {
    return React.createElement("div", {
      style: { width: size, height: size, borderRadius: 10, overflow: "hidden", flexShrink: 0, position: "relative", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }
    },
      React.createElement(BgImage),
      React.createElement(TimestampLink),
      React.createElement("div", {
        style: { position: "absolute", bottom: 0, left: 0, right: 0, height: "80%", background: `linear-gradient(to bottom, transparent 0%, rgba(${bgRgb.join(",")},0.5) 20%, rgba(${bgRgb.join(",")},0.9) 40%, rgba(${bgRgb.join(",")},0.95) 100%)`, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: `${padTop * 3}px ${padX}px ${padTop}px`, zIndex: 2 }
      },
        card.title && React.createElement("div", { style: { fontSize: titleFs, fontWeight: 700, color: card.titleColor, marginBottom: 3, lineHeight: 1.3 } }, card.title),
        card.subtitle && React.createElement("div", { style: { fontSize: subtitleFs, color: card.subtitleColor, marginBottom: 5, lineHeight: 1.3 } }, card.subtitle),
        card.body && React.createElement("div", { style: { fontSize: bodyFs, color: card.bodyColor, lineHeight: 1.5, whiteSpace: "pre-wrap" } }, card.body),
      )
    );
  }

  const isTop = card.layout === "photo_top";
  const textAreaStyle = { position: "absolute", left: 0, right: 0, height: textH, zIndex: 2, ...(isTop ? { bottom: 0 } : { top: 0 }), overflow: "hidden" };

  return React.createElement("div", {
    style: { width: size, height: size, borderRadius: 10, overflow: "hidden", flexShrink: 0, position: "relative", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }
  },
    React.createElement(BgImage),
    React.createElement(TimestampLink),
    React.createElement("div", { style: textAreaStyle },
      React.createElement("div", { style: { position: "absolute", inset: 0, background: `rgba(${bgRgb[0]},${bgRgb[1]},${bgRgb[2]},${card.bgOpacity})` } }),
      React.createElement(TextContent)
    )
  );
}

// ── CardEditor ──
function CardEditor({ card, index, onChange, onRemove, onDuplicate, total, globalUrl }) {
  const [expanded, setExpanded] = useState(true);
  const update = (key, val) => onChange({ ...card, [key]: val });
  const labelStyle = { display: "block", fontSize: 12, color: "#888", fontWeight: 500, marginBottom: 4 };
  const inputStyle = { width: "100%", padding: "8px 12px", background: "#262626", border: "1px solid #404040", borderRadius: 6, fontSize: 14, color: "#fff", outline: "none" };
  const numStyle = { width: 60, padding: "8px 4px", background: "#262626", border: "1px solid #404040", borderRadius: 6, fontSize: 12, color: "#999", outline: "none", textAlign: "center" };
  const colorStyle = { width: 32, height: 36, borderRadius: 6, border: "1px solid #404040", cursor: "pointer", background: "transparent" };
  const btnStyle = (active) => ({ padding: "6px 14px", borderRadius: 6, fontSize: 12, border: "none", cursor: "pointer", transition: "all 0.15s", background: active ? "#3b82f6" : "#262626", color: active ? "#fff" : "#999" });

  return React.createElement("div", { style: { background: "#171717", border: "1px solid #333", borderRadius: 10, overflow: "hidden" } },
    React.createElement("div", {
      onClick: () => setExpanded(!expanded),
      style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", transition: "background 0.15s" },
      onMouseEnter: (e) => e.currentTarget.style.background = "#1f1f1f",
      onMouseLeave: (e) => e.currentTarget.style.background = "transparent",
    },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
        React.createElement("span", { style: { width: 28, height: 28, borderRadius: "50%", background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" } }, index + 1),
        React.createElement("span", { style: { color: "#fff", fontWeight: 500, fontSize: 14 } }, card.title || card.subtitle || `카드 ${index + 1}`),
        card.start && React.createElement("span", { style: { color: "#666", fontSize: 12 } }, `${card.start} ~ ${card.end}`)
      ),
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
        React.createElement("button", { onClick: (e) => { e.stopPropagation(); onDuplicate(); }, style: { background: "none", border: "none", color: "#666", fontSize: 12, cursor: "pointer", padding: "4px 8px", borderRadius: 4 } }, "복제"),
        total > 1 && React.createElement("button", { onClick: (e) => { e.stopPropagation(); onRemove(); }, style: { background: "none", border: "none", color: "#ef4444", fontSize: 12, cursor: "pointer", padding: "4px 8px", borderRadius: 4 } }, "삭제"),
        React.createElement("span", { style: { color: "#666", fontSize: 16 } }, expanded ? "▾" : "▸")
      )
    ),
    expanded && React.createElement("div", { style: { padding: "0 16px 16px", display: "flex", gap: 24 } },
      React.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 } },
        React.createElement("div", null,
          React.createElement("label", { style: labelStyle }, "영상 URL (비워두면 공통 URL 사용)"),
          React.createElement("input", { type: "text", value: card.url, placeholder: "https://youtube.com/watch?v=...", onChange: (e) => update("url", e.target.value), style: inputStyle }),
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, marginTop: 8 } },
            React.createElement("div", null, React.createElement("label", { style: { ...labelStyle, fontSize: 11, color: "#666" } }, "시작"), React.createElement(TimeInput, { value: card.start, onChange: (v) => update("start", v), placeholder: "3:42" })),
            React.createElement("span", { style: { color: "#444", marginTop: 16 } }, "~"),
            React.createElement("div", null, React.createElement("label", { style: { ...labelStyle, fontSize: 11, color: "#666" } }, "종료"), React.createElement(TimeInput, { value: card.end, onChange: (v) => update("end", v), placeholder: "3:59" })),
            React.createElement("div", null, React.createElement("label", { style: { ...labelStyle, fontSize: 11, color: "#666" } }, "캡처 시점"), React.createElement(TimeInput, { value: card.captureTime, onChange: (v) => update("captureTime", v), placeholder: "1:10" })),
          )
        ),
        React.createElement("div", null,
          React.createElement("label", { style: labelStyle }, "레이아웃"),
          React.createElement("div", { style: { display: "flex", gap: 6 } },
            LAYOUT_OPTIONS.map(opt => React.createElement("button", { key: opt.id, onClick: () => update("layout", opt.id), style: btnStyle(card.layout === opt.id) }, opt.label))
          ),
          card.layout !== "text_overlay" && React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, marginTop: 8 } },
            React.createElement("label", { style: { fontSize: 12, color: "#666" } }, `텍스트 영역: ${Math.round((1 - card.photoRatio) * 100)}%`),
            React.createElement("input", { type: "range", min: 0.3, max: 0.8, step: 0.05, value: card.photoRatio, onChange: (e) => update("photoRatio", parseFloat(e.target.value)), style: { flex: 1 } })
          )
        ),
        React.createElement("div", null,
          React.createElement("label", { style: labelStyle }, "영상 위치 조절"),
          React.createElement("div", { style: { display: "flex", gap: 16 } },
            React.createElement("div", { style: { flex: 1, display: "flex", alignItems: "center", gap: 8 } },
              React.createElement("label", { style: { fontSize: 12, color: "#666", minWidth: 14 } }, "X"),
              React.createElement("input", { type: "range", min: 0, max: 100, step: 1, value: card.videoX, onChange: (e) => update("videoX", parseInt(e.target.value)), style: { flex: 1 } }),
              React.createElement("span", { style: { fontSize: 11, color: "#555", minWidth: 32, textAlign: "right" } }, `${card.videoX}%`),
            ),
            React.createElement("div", { style: { flex: 1, display: "flex", alignItems: "center", gap: 8 } },
              React.createElement("label", { style: { fontSize: 12, color: "#666", minWidth: 14 } }, "Y"),
              React.createElement("input", { type: "range", min: 0, max: 100, step: 1, value: card.videoY, onChange: (e) => update("videoY", parseInt(e.target.value)), style: { flex: 1 } }),
              React.createElement("span", { style: { fontSize: 11, color: "#555", minWidth: 32, textAlign: "right" } }, `${card.videoY}%`),
            ),
          ),
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 6 } },
            React.createElement("label", { style: { fontSize: 12, color: "#666", minWidth: 40 } }, "확대"),
            React.createElement("input", { type: "range", min: 100, max: 200, step: 5, value: card.videoScale || 110, onChange: (e) => update("videoScale", parseInt(e.target.value)), style: { flex: 1 } }),
            React.createElement("span", { style: { fontSize: 11, color: "#555", minWidth: 40, textAlign: "right" } }, `${card.videoScale || 110}%`),
          ),
        ),
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
          React.createElement("label", { style: labelStyle }, "텍스트 내용"),
          React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("input", { type: "text", value: card.title, placeholder: "제목 (크고 두껍게)", onChange: (e) => update("title", e.target.value), style: { ...inputStyle, flex: 1 } }),
            React.createElement("input", { type: "number", value: card.titleSize, onChange: (e) => update("titleSize", parseInt(e.target.value) || 0), style: numStyle, title: "폰트 크기" }),
            React.createElement("input", { type: "color", value: card.titleColor, onChange: (e) => update("titleColor", e.target.value), style: colorStyle }),
          ),
          React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("input", { type: "text", value: card.subtitle, placeholder: "부제 (얇게)", onChange: (e) => update("subtitle", e.target.value), style: { ...inputStyle, flex: 1 } }),
            React.createElement("input", { type: "number", value: card.subtitleSize, onChange: (e) => update("subtitleSize", parseInt(e.target.value) || 0), style: numStyle }),
            React.createElement("input", { type: "color", value: card.subtitleColor, onChange: (e) => update("subtitleColor", e.target.value), style: colorStyle }),
          ),
          React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "start" } },
            React.createElement("textarea", { value: card.body, placeholder: "본문 내용...", rows: 3, onChange: (e) => update("body", e.target.value), style: { ...inputStyle, flex: 1, resize: "vertical", minHeight: 72 } }),
            React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
              React.createElement("input", { type: "number", value: card.bodySize, onChange: (e) => update("bodySize", parseInt(e.target.value) || 0), style: numStyle }),
              React.createElement("input", { type: "color", value: card.bodyColor, onChange: (e) => update("bodyColor", e.target.value), style: colorStyle }),
            )
          ),
          card.layout !== "text_overlay" && React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 4 } },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
              React.createElement("label", { style: { fontSize: 12, color: "#666" } }, "배경색"),
              React.createElement("input", { type: "color", value: card.bgColor, onChange: (e) => update("bgColor", e.target.value), style: { ...colorStyle, width: 28, height: 28 } }),
              React.createElement("span", { style: { fontSize: 11, color: "#555" } }, card.bgColor),
            ),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
              React.createElement("label", { style: { fontSize: 12, color: "#666" } }, `배경 투명도: ${Math.round(card.bgOpacity * 100)}%`),
              React.createElement("input", { type: "range", min: 0, max: 1, step: 0.05, value: card.bgOpacity, onChange: (e) => update("bgOpacity", parseFloat(e.target.value)), style: { flex: 1 } }),
            )
          ),
        )
      ),
      React.createElement("div", { style: { flexShrink: 0 } },
        React.createElement("label", { style: { display: "block", fontSize: 12, color: "#888", fontWeight: 500, marginBottom: 8 } }, "미리보기"),
        React.createElement(CardPreview, { card, globalUrl }),
      )
    )
  );
}

// ── JSON Modal ──
function JsonModal({ json, onClose }) {
  const textRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { textRef.current?.select(); navigator.clipboard.writeText(json).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  return React.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 32 } },
    React.createElement("div", { style: { background: "#171717", border: "1px solid #333", borderRadius: 12, maxWidth: 640, width: "100%", display: "flex", flexDirection: "column" } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #333" } },
        React.createElement("h3", { style: { fontWeight: 600 } }, "내보내기 JSON"),
        React.createElement("button", { onClick: onClose, style: { background: "none", border: "none", color: "#666", fontSize: 20, cursor: "pointer" } }, "✕")
      ),
      React.createElement("div", { style: { padding: 20 } },
        React.createElement("textarea", { ref: textRef, readOnly: true, value: json, style: { width: "100%", height: 320, background: "#0a0a0a", border: "1px solid #333", borderRadius: 8, padding: 16, fontSize: 13, color: "#4ade80", fontFamily: "monospace", outline: "none", resize: "none" } })
      ),
      React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", gap: 12, padding: "16px 20px", borderTop: "1px solid #333" } },
        React.createElement("button", { onClick: handleCopy, style: { padding: "8px 16px", background: "#3b82f6", color: "#fff", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer" } }, copied ? "복사됨!" : "클립보드 복사"),
        React.createElement("button", { onClick: onClose, style: { padding: "8px 16px", background: "#333", color: "#fff", borderRadius: 6, border: "none", fontSize: 13, cursor: "pointer" } }, "닫기")
      )
    )
  );
}

// ── App ──
export default function App() {
  const [globalUrl, setGlobalUrl] = useState("");
  const [outputFormat, setOutputFormat] = useState("video");
  const [outputSize, setOutputSize] = useState(1080);
  const [cards, setCards] = useState([]);
  const [showJson, setShowJson] = useState(false);
  const [jsonStr, setJsonStr] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [results, setResults] = useState([]);

  // Initialize with one default card on mount (client-side only)
  useEffect(() => {
    setCards([DEFAULT_CARD()]);
  }, []);

  const updateCard = (i, c) => setCards(p => p.map((x, j) => j === i ? c : x));
  const removeCard = (i) => setCards(p => p.filter((_, j) => j !== i));
  const duplicateCard = (i) => setCards(p => { const n = [...p]; n.splice(i+1, 0, { ...p[i], id: Date.now() + Math.random() }); return n; });
  const addCard = () => setCards(p => [...p, { ...DEFAULT_CARD(), url: globalUrl || p[p.length-1]?.url || "" }]);

  const buildConfig = (card) => ({
    start: card.start, end: card.end, layout: card.layout, photo_ratio: card.photoRatio,
    title: card.title, title_size: card.titleSize, title_font: card.titleFont, title_color: card.titleColor,
    subtitle: card.subtitle, subtitle_size: card.subtitleSize, subtitle_font: card.subtitleFont, subtitle_color: card.subtitleColor,
    body: card.body, body_size: card.bodySize, body_font: card.bodyFont, body_color: card.bodyColor,
    text_bg_color: hexToRgb(card.bgColor), text_bg_opacity: card.bgOpacity,
    video_position: [card.videoX, card.videoY], video_scale: card.videoScale || 110,
    output_size: outputSize,
    ...(card.url && card.url !== globalUrl ? { url: card.url } : {}),
    ...(card.captureTime ? { capture_time: card.captureTime } : {}),
  });

  const exportJson = () => {
    const url = globalUrl || cards[0]?.url || "";
    const config = { url, output_format: outputFormat, output_size: outputSize, cards: cards.map(buildConfig) };
    setJsonStr(JSON.stringify(config, null, 2));
    setShowJson(true);
  };

  // ── 생성하기 (Web API) ──
  const handleGenerate = async () => {
    const url = globalUrl || cards[0]?.url || "";
    if (!url) { alert("영상 URL을 입력하세요."); return; }
    for (let i = 0; i < cards.length; i++) {
      if (!cards[i].start || !cards[i].end) { alert(`카드 ${i + 1}의 시작/종료 시간을 입력하세요.`); return; }
    }

    setGenerating(true);
    setResults([]);
    setGenProgress("오버레이 생성 중...");

    try {
      // 1) 모든 카드의 오버레이 PNG 생성
      const overlays = [];
      for (let i = 0; i < cards.length; i++) {
        setGenProgress(`카드 ${i + 1}/${cards.length} 오버레이 생성 중...`);
        const overlayDataUrl = await generateOverlayPng(cards[i], outputSize);
        overlays.push(overlayDataUrl);
      }

      // 2) 서버에 작업 요청
      setGenProgress("서버에 작업 요청 중...");
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          outputFormat,
          outputSize,
          cards: cards.map((card, i) => ({
            cardConfig: buildConfig(card),
            overlayData: overlays[i],
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "서버 요청 실패");
      }

      const { jobId, cardCount } = await res.json();

      // 3) 폴링으로 진행 상황 확인
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/jobs/${jobId}`);
          if (!statusRes.ok) return;
          const status = await statusRes.json();

          let totalProgress = 0;
          let completedCards = 0;
          let failedCards = 0;
          const downloadUrls = [];

          for (const card of (status.cards || [])) {
            if (card.status === "completed") {
              completedCards++;
              totalProgress += 100;
              if (card.downloadUrl) downloadUrls.push(card.downloadUrl);
            } else if (card.status === "failed") {
              failedCards++;
              totalProgress += 100;
            } else {
              totalProgress += (card.progress || 0);
            }
          }

          const avgProgress = Math.round(totalProgress / cardCount);
          setGenProgress(`처리 중... ${completedCards}/${cardCount}개 완료 (${avgProgress}%)`);

          if (completedCards + failedCards >= cardCount) {
            clearInterval(pollInterval);
            setResults(downloadUrls);
            setGenProgress(`완료! ${completedCards}/${cardCount}개 카드 생성됨${failedCards > 0 ? ` (${failedCards}개 실패)` : ""}`);
            setGenerating(false);
          }
        } catch (e) {
          // polling error, continue
        }
      }, 1500);

    } catch (err) {
      alert(`오류: ${err.message}`);
      setGenProgress("");
      setGenerating(false);
    }
  };

  const inputStyle = { width: "100%", padding: "8px 12px", background: "#262626", border: "1px solid #404040", borderRadius: 6, fontSize: 14, color: "#fff", outline: "none" };
  const btnStyle = (active) => ({ padding: "8px 14px", borderRadius: 6, fontSize: 12, border: "none", cursor: "pointer", background: active ? "#3b82f6" : "#262626", color: active ? "#fff" : "#999" });

  return React.createElement("div", { style: { minHeight: "100vh" } },
    React.createElement(Head, null,
      React.createElement("title", null, "YT2C - 카드뉴스 메이커"),
    ),
    // Header
    React.createElement("div", { style: { borderBottom: "1px solid #222", position: "sticky", top: 0, background: "#0a0a0a", zIndex: 20 } },
      React.createElement("div", { style: { maxWidth: 1200, margin: "0 auto", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" } },
        React.createElement("div", null,
          React.createElement("h1", { style: { fontSize: 18, fontWeight: 700 } }, "카드뉴스 메이커"),
          React.createElement("p", { style: { fontSize: 12, color: "#666", marginTop: 2 } }, "YouTube 영상으로 카드뉴스를 만들어보세요")
        ),
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
          React.createElement("span", { style: { fontSize: 12, color: "#666" } }, `카드 ${cards.length}개`),
          React.createElement("button", { onClick: exportJson, style: { padding: "8px 16px", background: "#262626", color: "#999", borderRadius: 8, border: "1px solid #404040", fontSize: 13, cursor: "pointer" } }, "JSON"),
          React.createElement("button", {
            onClick: handleGenerate,
            disabled: generating,
            style: { padding: "10px 24px", background: generating ? "#333" : "#22c55e", color: generating ? "#666" : "#fff", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 600, cursor: generating ? "not-allowed" : "pointer", transition: "all 0.15s" }
          }, generating ? "생성 중..." : "생성하기"),
        )
      )
    ),
    // Progress bar
    (generating || genProgress) && React.createElement("div", { style: { background: "#171717", borderBottom: "1px solid #333", padding: "10px 24px" } },
      React.createElement("div", { style: { maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 } },
        generating && React.createElement("div", { style: { width: 16, height: 16, border: "2px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" } }),
        React.createElement("span", { style: { fontSize: 13, color: generating ? "#3b82f6" : "#22c55e" } }, genProgress),
        results.length > 0 && !generating && React.createElement("div", { style: { marginLeft: "auto", display: "flex", gap: 8 } },
          results.map((url, i) => React.createElement("a", {
            key: i, href: url, download: true,
            style: { padding: "4px 12px", background: "#3b82f6", color: "#fff", borderRadius: 6, border: "none", fontSize: 12, cursor: "pointer", textDecoration: "none" }
          }, `카드 ${i+1} 다운로드`))
        ),
      )
    ),
    // Main content
    React.createElement("div", { style: { maxWidth: 1200, margin: "0 auto", padding: "24px 24px", display: "flex", flexDirection: "column", gap: 20 } },
      // Global settings
      React.createElement("div", { style: { background: "#171717", border: "1px solid #333", borderRadius: 10, padding: 16, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" } },
        React.createElement("div", { style: { flex: 1, minWidth: 260 } },
          React.createElement("label", { style: { display: "block", fontSize: 12, color: "#888", fontWeight: 500, marginBottom: 4 } }, "공통 영상 URL"),
          React.createElement("input", { type: "text", value: globalUrl, placeholder: "https://youtube.com/watch?v=...", onChange: (e) => setGlobalUrl(e.target.value), style: inputStyle })
        ),
        React.createElement("div", null,
          React.createElement("label", { style: { display: "block", fontSize: 12, color: "#888", fontWeight: 500, marginBottom: 4 } }, "출력 형식"),
          React.createElement("div", { style: { display: "flex", gap: 4 } },
            ["video", "image"].map(f => React.createElement("button", { key: f, onClick: () => setOutputFormat(f), style: btnStyle(outputFormat === f) }, f === "video" ? "영상 (mp4)" : "이미지 (jpg)"))
          )
        ),
        React.createElement("div", null,
          React.createElement("label", { style: { display: "block", fontSize: 12, color: "#888", fontWeight: 500, marginBottom: 4 } }, "해상도"),
          React.createElement("div", { style: { display: "flex", gap: 4 } },
            [720, 1080].map(s => React.createElement("button", { key: s, onClick: () => setOutputSize(s), style: btnStyle(outputSize === s) }, `${s}p`))
          )
        ),
      ),
      // Cards
      cards.map((card, i) =>
        React.createElement(CardEditor, { key: card.id, card, index: i, onChange: (c) => updateCard(i, c), onRemove: () => removeCard(i), onDuplicate: () => duplicateCard(i), total: cards.length, globalUrl })
      ),
      React.createElement("button", {
        onClick: addCard,
        style: { width: "100%", padding: 14, border: "2px dashed #333", borderRadius: 10, background: "transparent", color: "#666", fontSize: 14, cursor: "pointer" }
      }, "+ 카드 추가")
    ),
    showJson && React.createElement(JsonModal, { json: jsonStr, onClose: () => setShowJson(false) }),
    // Spin animation
    React.createElement("style", null, `@keyframes spin { to { transform: rotate(360deg); } }`)
  );
}
