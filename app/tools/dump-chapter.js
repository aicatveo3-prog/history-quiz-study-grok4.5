/* 편별 문항 검토용 덤프 — node tools/dump-chapter.js <챕터id> [--all]
 * 기본은 자체생성(src 없는) 문항만 출력한다. 각 줄 형식:
 *   [해시] (파트번호) 정답 | 본문
 *      exp: 해설
 * 해시는 가지치기 블록이 쓰는 것과 동일한 식별자다. */
var path = require("path");
var dir = path.join(__dirname, "..");
global.window = { QUIZ_CHAPTERS: {} };
require(path.join(dir, "chapters.js"));

var id = process.argv[2];
var showAll = process.argv.indexOf("--all") >= 0;
var meta = window.CHAPTER_LIST.filter(function (c) { return c.id === id; })[0];
if (!meta) { console.error("알 수 없는 챕터: " + id); process.exit(1); }
require(path.join(dir, meta.file));
var DATA = window.QUIZ_CHAPTERS[id].data;

function h(s) { var x = 0; for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return (x >>> 0).toString(36); }

var parts = [];
DATA.forEach(function (q) { if (parts.indexOf(q.part) < 0) parts.push(q.part); });

// 해시 충돌 점검 — 충돌이 있으면 가지치기가 엉뚱한 문항을 지울 수 있다
var seen = {}, dup = [];
DATA.forEach(function (q) { var k = h(q.text); if (seen[k] && seen[k] !== q.text) dup.push(k); seen[k] = q.text; });
if (dup.length) { console.error("⚠ 해시 충돌: " + dup.join(",")); process.exit(2); }

console.log("# " + meta.title + " — 총 " + DATA.length + "문항 (기출 " +
  DATA.filter(function (q) { return q.src; }).length + " / 자체생성 " +
  DATA.filter(function (q) { return !q.src; }).length + ")");

parts.forEach(function (p, pi) {
  var inPart = DATA.filter(function (q) { return q.part === p; });
  var mine = inPart.filter(function (q) { return showAll || !q.src; });
  console.log("\n## P" + (pi + 1) + " " + p +
    "  (파트 " + inPart.length + "문항 · 기출 " + inPart.filter(function (q) { return q.src; }).length +
    " · 자체생성 " + inPart.filter(function (q) { return !q.src; }).length + ")");
  // 이 파트에서 기출이 이미 다루는 논점 — 변형 삭제 판단의 근거
  var ex = inPart.filter(function (q) { return q.src; });
  if (ex.length) {
    console.log("### 기출(보존 확정) 지문");
    ex.forEach(function (q) { console.log("  · " + q.text); });
  }
  console.log("### 자체생성" + (showAll ? "+기출" : "") + " 문항");
  mine.forEach(function (q) {
    console.log("[" + h(q.text) + "] " + q.answer + (q.src ? " *기출*" : "") + " | " + q.text);
    console.log("     exp: " + q.exp);
  });
});
