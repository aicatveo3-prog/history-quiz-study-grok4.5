/* 🎯 함정 체크 원본 덤프 — node tools/dump-traps.js <챕터id>
 * 파트별로 (a) 현재 함정 체크 항목 (b) 그 파트 이론의 섹션 제목을 함께 보여 준다.
 * 이미 대비표(compare)로 전환된 파트는 그렇게 표시한다. */
var path = require("path");
var dir = path.join(__dirname, "..");
global.window = { QUIZ_CHAPTERS: {} };
require(path.join(dir, "chapters.js"));

var id = process.argv[2];
var meta = window.CHAPTER_LIST.filter(function (c) { return c.id === id; })[0];
if (!meta) { console.error("알 수 없는 챕터: " + id); process.exit(1); }
require(path.join(dir, meta.file));
var ch = window.QUIZ_CHAPTERS[id];

console.log("# " + meta.title + " — 이론 " + ch.theory.length + "파트");
ch.theory.forEach(function (p, pi) {
  var w = p.blocks.filter(function (b) { return b.k === "note" && b.v === "warn"; })[0];
  var secs = p.blocks.filter(function (b) { return b.k === "sec"; }).map(function (b) { return b.t; });
  console.log("\n## 파트 인덱스 " + pi);
  console.log("섹션: " + (secs.join(" / ") || "(없음)"));
  if (!w) { console.log("(함정 체크 없음)"); return; }
  if (w.compare) { console.log("(이미 대비표로 전환됨 — 건드리지 말 것)"); return; }
  console.log("함정 체크 " + (w.list || []).length + "항목:");
  (w.list || []).forEach(function (t, i) { console.log("  " + (i + 1) + ". " + t); });
});
