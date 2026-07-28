/* 기출 회차 반영 — node tools/apply-exam.js <반영데이터.json> <회차라벨> [--dry]
 *
 * 반영데이터.json = { "hk01": { adds:[{part,answer,text,exp,src?}], tags:[needle,…] }, … }
 *
 * 각 파일 등록부 **바로 앞**에 즉시실행 블록을 넣는다(가장 마지막에 실행되어야
 * 앞선 가지치기·순서 섞기·균형 전환 블록의 결과 위에 얹힌다).
 *   · insQ  : 문항을 해당 파트 안에 끼워 넣되, 같은 정답이 4연속되지 않게 자리를 고른다
 *   · tagSrc: 기존 문항 src 에 회차를 **누적**한다(덮어쓰지 않는다)
 *
 * 전 편을 먼저 검증하고 통과해야 파일에 쓴다(부분 적용 방지).
 */
var fs = require("fs");
var path = require("path");
var dir = path.join(__dirname, "..");
var dry = process.argv.indexOf("--dry") >= 0;
var DATA = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
var LABEL = process.argv[3];
if (!LABEL) throw new Error("회차 라벨을 지정하세요 (예: \"한능검 제62회\")");

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
  var spec = DATA[c.id];
  if (!spec || (!spec.adds.length && !spec.tags.length)) return;
  var before = load(c.id, c.file);
  var parts = {};
  before.data.forEach(function (q) { parts[q.part] = 1; });

  spec.adds.forEach(function (a, i) {
    var lbl = c.id + " adds#" + (i + 1);
    if (!parts[a.part]) throw new Error(lbl + ": 존재하지 않는 파트 — " + a.part);
    if (a.answer !== "O" && a.answer !== "X") throw new Error(lbl + ": answer 오류");
    if (!a.text || !a.exp) throw new Error(lbl + ": text/exp 없음");
    var dup = before.data.filter(function (q) { return q.text === a.text; });
    if (dup.length) throw new Error(lbl + ": 기존 문항과 지문이 완전히 동일함");
  });
  spec.tags.forEach(function (n, i) {
    var hit = before.data.filter(function (q) { return q.text.indexOf(n) >= 0; });
    if (hit.length !== 1) throw new Error(c.id + " tags#" + (i + 1) + ": 매칭 " + hit.length + "건 (1건이어야 함) — \"" + n + "\"");
    var s = hit[0].src;
    var arr = !s ? [] : (Array.isArray(s) ? s : [s]);
    if (arr.indexOf(LABEL) >= 0) throw new Error(c.id + " tags#" + (i + 1) + ": 이미 " + LABEL + " 가 붙어 있음");
  });

  var file = path.join(dir, c.file);
  var s = fs.readFileSync(file, "utf8");
  var marker = '  window.QUIZ_CHAPTERS["' + c.id + '"]';
  var at = s.indexOf(marker);
  if (at < 0) throw new Error(c.id + ": 등록부를 찾지 못함");

  var blk = '  // ==== 🏅 ' + LABEL + ' 기출 반영 ====\n' +
    '  // 정답 선지는 ⭕ 문항, 오답 선지는 원 문제 주어를 유지한 ❌ 문항에 회차를 단다.\n' +
    '  // 뱃지는 "이 논점이 그 회차에 출제됨"을 뜻한다(5지선다를 OX로 변형한 자료).\n' +
    '  // 등록부 바로 앞에 두어 앞선 블록들의 결과 위에 얹힌다.\n' +
    '  (function () {\n' +
    '    var ADDS = ' + JSON.stringify(spec.adds) + ';\n' +
    '    var TAGS = ' + JSON.stringify(spec.tags) + ';\n' +
    '    var L = ' + JSON.stringify(LABEL) + ';\n' +
    '    // 기존 문항 src 에 회차를 누적한다 (덮어쓰지 않는다)\n' +
    '    for (var t = 0; t < TAGS.length; t++) {\n' +
    '      for (var i = 0; i < DATA.length; i++) {\n' +
    '        var it = DATA[i];\n' +
    '        if (!it.text || it.text.indexOf(TAGS[t]) < 0) continue;\n' +
    '        var s = it.src;\n' +
    '        if (!s) it.src = L;\n' +
    '        else if (Array.isArray(s)) { if (s.indexOf(L) < 0) s.push(L); }\n' +
    '        else if (s !== L) it.src = [s, L];\n' +
    '      }\n' +
    '    }\n' +
    '    // 같은 정답이 4연속되지 않는 자리를 골라 파트 안에 끼워 넣는다\n' +
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
    '    for (var a = 0; a < ADDS.length; a++) insert(ADDS[a]);\n' +
    '  })();\n\n';

  pending.push({ c: c, file: file, out: s.slice(0, at) + blk + s.slice(at), before: before, spec: spec });
});

pending.forEach(function (p) {
  if (!dry) fs.writeFileSync(p.file, p.out);
  if (dry) { report.push({ id: p.c.id, dry: true, adds: p.spec.adds.length, tags: p.spec.tags.length }); return; }
  var after = load(p.c.id, p.c.file);
  var src = after.data.filter(function (q) { return q.src; });
  var o = src.filter(function (q) { return q.answer === "O"; }).length;
  var run = 1, worst = 1, seen = {}, prev = null, split = 0;
  after.data.forEach(function (q, i) {
    if (i && q.part === after.data[i - 1].part && q.answer === after.data[i - 1].answer) { run++; if (run > worst) worst = run; }
    else if (i) run = 1;
    if (q.part !== prev) { if (seen[q.part]) split++; seen[q.part] = 1; prev = q.part; }
  });
  var tagged = after.data.filter(function (q) {
    var s = q.src; if (!s) return false;
    return (Array.isArray(s) ? s : [s]).indexOf(LABEL) >= 0;
  }).length;
  report.push({
    id: p.c.id, before: p.before.data.length, total: after.data.length,
    adds: p.spec.adds.length, tags: p.spec.tags.length, tagged: tagged,
    src: src.length, o: o, x: src.length - o, worst: worst, split: split
  });
});

console.log(dry ? "=== DRY RUN (검증만) ===" : "=== 적용 완료 ===");
if (dry) { report.forEach(function (r) { console.log(r.id + ": 신규 " + r.adds + " · 태깅 " + r.tags + " — 검증 통과"); }); return; }
console.log("편 | 문항(전→후) | 신규 | " + LABEL + " 부착 | 기출 O:X | 최장연속 | 파트분리");
var to = 0, tx = 0, tt = 0;
report.forEach(function (r) {
  to += r.o; tx += r.x; tt += r.tagged;
  console.log(`${r.id} | ${r.before}→${r.total} | +${r.adds} | ${r.tagged} | ${r.o}:${r.x} | ${r.worst} | ${r.split}` +
    (r.total - r.before !== r.adds ? "  ⚠ 증가분 불일치" : "") + (r.worst > 3 ? "  ⚠ 4연속" : "") + (r.split ? "  ⚠ 파트분리" : ""));
});
console.log(`합계 | | | ${tt}문항에 ${LABEL} | 기출 ${to}:${tx} (⭕ ${(to / (to + tx) * 100).toFixed(1)}%)`);
