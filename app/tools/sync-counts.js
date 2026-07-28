/* 문항 수 동기화 — node tools/sync-counts.js [--dry]
 * 실제 데이터를 기준으로 chapters.js 의 count, app/README.md 표·총계,
 * 루트 README.md 의 편별 문항 수·총계를 갱신한다. */
var fs = require("fs");
var path = require("path");
var dir = path.join(__dirname, "..");
var dry = process.argv.indexOf("--dry") >= 0;

global.window = { QUIZ_CHAPTERS: {} };
require(path.join(dir, "chapters.js"));
var LIST = global.window.CHAPTER_LIST;

var stats = LIST.map(function (c) {
  require(path.join(dir, c.file));
  var ch = global.window.QUIZ_CHAPTERS[c.id];
  var parts = [];
  ch.data.forEach(function (q) { if (parts.indexOf(q.part) < 0) parts.push(q.part); });
  return {
    id: c.id, num: c.num, title: c.title, file: c.file, declared: c.count,
    n: ch.data.length, parts: parts.length,
    checklist: (ch.checklist && ch.checklist.groups || []).reduce(function (a, g) { return a + g.items.length; }, 0)
  };
});
var total = stats.reduce(function (a, s) { return a + s.n; }, 0);
var edits = [];

function patch(file, fn) {
  var p = path.join(dir, file);
  var before = fs.readFileSync(p, "utf8");
  var after = fn(before);
  if (before !== after) { edits.push(file); if (!dry) fs.writeFileSync(p, after); }
}

// 1) chapters.js — count 갱신
patch("chapters.js", function (s) {
  stats.forEach(function (st) {
    s = s.replace(new RegExp('(id: "' + st.id + '"[^}]*count: )\\d+'), "$1" + st.n);
  });
  return s;
});

// 2) app/README.md — 챕터 표 각 행 + 총계
patch("README.md", function (s) {
  stats.forEach(function (st) {
    s = s.replace(
      new RegExp("(\\| `" + st.file.replace(".", "\\.") + "` \\|[^|]*?)\\d+문항 \\+ 이론 \\d+파트 \\+ 체크리스트 \\d+항목"),
      "$1" + st.n + "문항 + 이론 " + st.parts + "파트 + 체크리스트 " + st.checklist + "항목"
    );
  });
  return s.replace(/### 챕터 데이터 \(총 [\d,]+문항\)/, "### 챕터 데이터 (총 " + total.toLocaleString() + "문항)")
          .replace(/총 [\d,]+문항 O\/X 풀이/, "총 " + total.toLocaleString() + "문항 O/X 풀이");
});

// 3) 루트 README.md — 편별 줄 + 총계
patch("../README.md", function (s) {
  stats.forEach(function (st) {
    s = s.replace(new RegExp("(- 제" + st.num + "편 [^\\n]*? )\\d+문항"), "$1" + st.n + "문항");
  });
  return s.replace(/한국사 [\d,]+문항/, "한국사 " + total.toLocaleString() + "문항");
});

console.log(dry ? "=== DRY RUN ===" : "=== 갱신 완료 ===");
console.log("편 | chapters.js count | 실제 | 파트 | 체크리스트");
stats.forEach(function (s) {
  console.log(`${s.id} | ${s.declared}${s.declared !== s.n ? " → " + s.n : " (변화없음)"} | ${s.n} | ${s.parts} | ${s.checklist}`);
});
console.log("총 문항: " + total.toLocaleString());
console.log("수정된 파일: " + (edits.length ? edits.join(", ") : "없음"));
