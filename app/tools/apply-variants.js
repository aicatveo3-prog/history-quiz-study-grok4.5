/* 기출 균형용 ❌ 변형 추가 — node tools/apply-variants.js <변형데이터.json> [--dry]
 *
 * 변형데이터.json = { "hk02": [ {srcNeedle, text, exp}, … ], … }
 *
 * 각 항목은 "짝 없는 기출 ⭕" 하나에 대응하는 ❌ 변형이다. 적용하면
 *   · 새 ❌ 문항이 같은 파트에 추가되고, 원래 ⭕ 의 src 를 **이어받는다**
 *   · 원래 ⭕ 문항은 그대로 남고 src 만 내려놓는다 (내용 손실 0)
 * 결과: 기출 O 1 감소 · X 1 증가 · 총 문항 1 증가.
 *
 * 삽입 위치는 같은 정답이 4연속되지 않는 자리를 고른다.
 * 전 편을 먼저 검증하고 통과해야 파일에 쓴다(부분 적용 방지).
 */
var fs = require("fs");
var path = require("path");
var dir = path.join(__dirname, "..");
var dry = process.argv.indexOf("--dry") >= 0;
var PLAN = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

global.window = { QUIZ_CHAPTERS: {} };
require(path.join(dir, "chapters.js"));
var LIST = global.window.CHAPTER_LIST;

function load(id, file) {
  var g = { QUIZ_CHAPTERS: {} }, prev = global.window;
  global.window = g;
  delete require.cache[require.resolve(path.join(dir, file))];
  require(path.join(dir, file));
  global.window = prev;
  return g.QUIZ_CHAPTERS[id];
}

var pending = [], report = [];

LIST.forEach(function (c) {
  var vs = PLAN[c.id];
  if (!vs || !vs.length) return;
  var before = load(c.id, c.file);

  var used = {};
  vs.forEach(function (v, i) {
    var lbl = c.id + " #" + (i + 1);
    var hit = before.data.filter(function (q) { return q.text.indexOf(v.srcNeedle) >= 0; });
    if (hit.length !== 1) throw new Error(lbl + ": srcNeedle 매칭 " + hit.length + "건 — \"" + v.srcNeedle + "\"");
    var t = hit[0];
    if (!t.src) throw new Error(lbl + ": 대상이 기출 문항이 아님");
    if (t.answer !== "O") throw new Error(lbl + ": 대상이 ⭕ 문항이 아님");
    if (used[t.text]) throw new Error(lbl + ": 같은 ⭕ 문항이 두 번 지정됨");
    used[t.text] = 1;
    if (!v.text || !v.exp) throw new Error(lbl + ": text/exp 없음");
    var dup = before.data.filter(function (q) { return q.text === v.text; });
    if (dup.length) throw new Error(lbl + ": 새 지문이 기존 문항과 완전히 동일함");
  });

  var file = path.join(dir, c.file);
  var s = fs.readFileSync(file, "utf8");
  var marker = '  window.QUIZ_CHAPTERS["' + c.id + '"]';
  var at = s.indexOf(marker);
  if (at < 0) throw new Error(c.id + ": 등록부를 찾지 못함");

  var blk = '  // ==== 🏅 기출 정답 균형 — ❌ 변형 추가 ====\n' +
    '  // 짝 없이 혼자 있던 기출 ⭕ 마다 대응 ❌ 변형을 만들어 뱃지를 넘긴다.\n' +
    '  // 원래 ⭕ 문항은 그대로 남고 src 만 내려놓으므로 ⭕ 진술은 잃지 않는다.\n' +
    '  (function () {\n' +
    '    var V = ' + JSON.stringify(vs) + ';\n' +
    '    function insert(q) {\n' +
    '      var lo = -1, hi = -1;\n' +
    '      for (var i = 0; i < DATA.length; i++) {\n' +
    '        if (DATA[i].part !== q.part) continue;\n' +
    '        if (lo < 0) lo = i;\n' +
    '        hi = i;\n' +
    '      }\n' +
    '      if (lo < 0) { DATA.push(q); return; }\n' +
    '      function runAt(pos) {\n' +
    '        var t = DATA.slice(0, pos).concat([q], DATA.slice(pos));\n' +
    '        var run = 1, worst = 1;\n' +
    '        for (var k = 1; k < t.length; k++) {\n' +
    '          if (t[k].part === t[k - 1].part && t[k].answer === t[k - 1].answer) { run++; if (run > worst) worst = run; }\n' +
    '          else run = 1;\n' +
    '        }\n' +
    '        return worst;\n' +
    '      }\n' +
    '      var best = hi + 1, bestRun = runAt(hi + 1);\n' +
    '      for (var p = lo; p <= hi + 1; p++) {\n' +
    '        var r = runAt(p);\n' +
    '        if (r < bestRun) { bestRun = r; best = p; }\n' +
    '        if (bestRun <= 3) break;\n' +
    '      }\n' +
    '      DATA.splice(best, 0, q);\n' +
    '    }\n' +
    '    for (var i = 0; i < V.length; i++) {\n' +
    '      var v = V[i], t = null;\n' +
    '      for (var j = 0; j < DATA.length; j++) {\n' +
    '        if (DATA[j].text.indexOf(v.srcNeedle) >= 0) { if (t) { t = null; break; } t = DATA[j]; }\n' +
    '      }\n' +
    '      if (!t || !t.src) continue;\n' +
    '      insert({ part: t.part, answer: "X", text: v.text, exp: v.exp, src: t.src });\n' +
    '      delete t.src;\n' +
    '    }\n' +
    '  })();\n\n';

  pending.push({ c: c, file: file, out: s.slice(0, at) + blk + s.slice(at), before: before, n: vs.length });
});

pending.forEach(function (p) {
  if (!dry) fs.writeFileSync(p.file, p.out);
  if (dry) { report.push({ id: p.c.id, dry: true, n: p.n }); return; }
  var after = load(p.c.id, p.c.file);
  var src = after.data.filter(function (q) { return q.src; });
  var o = src.filter(function (q) { return q.answer === "O"; }).length;
  var run = 1, worst = 1, seen = {}, prev = null, split = 0;
  after.data.forEach(function (q, i) {
    if (i && q.part === after.data[i - 1].part && q.answer === after.data[i - 1].answer) { run++; if (run > worst) worst = run; }
    else if (i) run = 1;
    if (q.part !== prev) { if (seen[q.part]) split++; seen[q.part] = 1; prev = q.part; }
  });
  report.push({
    id: p.c.id, n: p.n, before: p.before.data.length, total: after.data.length,
    src: src.length, o: o, x: src.length - o, worst: worst, split: split
  });
});

console.log(dry ? "=== DRY RUN (검증만) ===" : "=== 적용 완료 ===");
if (dry) { report.forEach(function (r) { console.log(r.id + ": 변형 " + r.n + "개 — 검증 통과"); }); return; }
console.log("편 | 추가 | 문항(전→후) | 기출 O:X | O비율 | 최장연속 | 파트분리");
var to = 0, tx = 0;
report.forEach(function (r) {
  to += r.o; tx += r.x;
  console.log(`${r.id} | +${r.n} | ${r.before}→${r.total} | ${r.o}:${r.x} | ${(r.o / r.src * 100).toFixed(0)}% | ${r.worst} | ${r.split}` +
    (r.total - r.before !== r.n ? "  ⚠ 증가분 불일치" : "") + (r.worst > 3 ? "  ⚠ 4연속" : "") + (r.split ? "  ⚠ 파트분리" : ""));
});
console.log(`합계 | 기출 ${to}:${tx} (⭕ ${(to / (to + tx) * 100).toFixed(1)}%)`);
