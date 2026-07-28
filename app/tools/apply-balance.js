/* 기출 정답 균형 전환 적용 — node tools/apply-balance.js <전환안.json> [--dry]
 *
 * 전환안.json = { "hk01": [ {kind, needle, toNeedle?, newText?, newExp?, newPart?}, … ], … }
 *   moveBadge : needle 문항의 src 를 toNeedle 문항으로 옮긴다 (내용 변화 없음)
 *   rewrite   : needle 문항의 text/exp/answer(→X)/part 를 바꾼다 (src 유지)
 *
 * 문항 수는 절대 바뀌지 않는다 — 추가·삭제 없이 제자리에서 고치기만 한다.
 * 모든 편을 먼저 검증하고, 전부 통과해야 파일에 쓴다(부분 적용 방지).
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
function findOne(data, needle, label) {
  var hit = data.filter(function (q) { return q.text.indexOf(needle) >= 0; });
  if (hit.length !== 1) throw new Error(label + ': needle 매칭 ' + hit.length + '건 (1건이어야 함) — "' + needle + '"');
  return hit[0];
}

var MARK = "기출 정답 균형 전환";
var pending = [], report = [];

LIST.forEach(function (c) {
  var edits = PLAN[c.id];
  if (!edits || !edits.length) return;
  var before = load(c.id, c.file);
  var parts = {};
  before.data.forEach(function (q) { parts[q.part] = 1; });

  edits.forEach(function (e, i) {
    var lbl = c.id + " #" + (i + 1);
    var target = findOne(before.data, e.needle, lbl + " needle");
    if (!target.src) throw new Error(lbl + ": 대상이 기출 문항이 아님 — " + e.needle);
    if (e.kind === "moveBadge") {
      if (!e.toNeedle) throw new Error(lbl + ": toNeedle 없음");
      var dst = findOne(before.data, e.toNeedle, lbl + " toNeedle");
      if (dst.src) throw new Error(lbl + ": 뱃지를 받을 문항이 이미 기출임");
      if (dst.answer !== "X") throw new Error(lbl + ": 뱃지를 받을 문항이 X 가 아님");
      if (dst.part !== target.part) throw new Error(lbl + ": 뱃지 이동 대상이 다른 파트임");
    } else if (e.kind === "rewrite") {
      if (!e.newText || !e.newExp) throw new Error(lbl + ": newText/newExp 없음");
      if (e.newPart && !parts[e.newPart]) throw new Error(lbl + ": 존재하지 않는 파트 — " + e.newPart);
      var dup = before.data.filter(function (q) { return q !== target && q.text === e.newText; });
      if (dup.length) throw new Error(lbl + ": 새 지문이 기존 문항과 완전히 동일함");
    } else throw new Error(lbl + ": 알 수 없는 kind — " + e.kind);
  });

  var file = path.join(dir, c.file);
  var s = fs.readFileSync(file, "utf8");
  var marker = '  window.QUIZ_CHAPTERS["' + c.id + '"]';
  var at = s.indexOf(marker);
  if (at < 0) throw new Error(c.id + ": 등록부를 찾지 못함");

  var blk = '  // ==== 🏅 ' + MARK + ' ====\n' +
    '  // 기출 뱃지가 ⭕ 문항에만 붙어 "기출만 보기" 모드에서 전부 ⭕ 이던 문제를 바로잡는다.\n' +
    '  // moveBadge: 짝 ❌ 변형으로 뱃지 이동 / rewrite: 오답 선지의 원 맥락 ❌ 지문으로 복원.\n' +
    '  // 문항을 추가·삭제하지 않으므로 총 문항 수와 사용자 진도는 그대로다.\n' +
    '  (function () {\n' +
    '    var E = ' + JSON.stringify(edits) + ';\n' +
    '    function one(n) { var h = DATA.filter(function (q) { return q.text.indexOf(n) >= 0; }); return h.length === 1 ? h[0] : null; }\n' +
    '    for (var i = 0; i < E.length; i++) {\n' +
    '      var e = E[i], t = one(e.needle);\n' +
    '      if (!t) continue;\n' +
    '      if (e.kind === "moveBadge") {\n' +
    '        var d = one(e.toNeedle);\n' +
    '        if (!d) continue;\n' +
    '        d.src = t.src; delete t.src;\n' +
    '      } else {\n' +
    '        t.text = e.newText; t.exp = e.newExp; t.answer = "X";\n' +
    '        if (e.newPart) t.part = e.newPart;\n' +
    '      }\n' +
    '    }\n' +
    '  })();\n\n';

  pending.push({ c: c, file: file, out: s.slice(0, at) + blk + s.slice(at), before: before, edits: edits, n: edits.length });
});

/* 삽입할 블록과 동일한 로직을 메모리에서 재현한다 (dry-run 미리보기용).
   블록 코드를 고치면 이 함수도 같이 고쳐야 한다. */
function simulate(data, edits) {
  var d = data.map(function (q) { return Object.assign({}, q); });
  function one(n) { var h = d.filter(function (q) { return q.text.indexOf(n) >= 0; }); return h.length === 1 ? h[0] : null; }
  edits.forEach(function (e) {
    var t = one(e.needle);
    if (!t) return;
    if (e.kind === "moveBadge") {
      var x = one(e.toNeedle);
      if (!x) return;
      x.src = t.src; delete t.src;
    } else {
      t.text = e.newText; t.exp = e.newExp; t.answer = "X";
      if (e.newPart) t.part = e.newPart;
    }
  });
  return d;
}

pending.forEach(function (p) {
  if (!dry) fs.writeFileSync(p.file, p.out);
  var after = dry ? { data: simulate(p.before.data, p.edits) } : load(p.c.id, p.c.file);
  var src = after.data.filter(function (q) { return q.src; });
  var o = src.filter(function (q) { return q.answer === "O"; }).length;
  // 파트 연속성(같은 파트가 두 군데로 쪼개지지 않았는지)
  var seen = {}, prev = null, split = 0;
  after.data.forEach(function (q) {
    if (q.part !== prev) { if (seen[q.part]) split++; seen[q.part] = 1; prev = q.part; }
  });
  report.push({
    id: p.c.id, edits: p.n, total: after.data.length, before: p.before.data.length,
    src: src.length, o: o, x: src.length - o, split: split
  });
});

console.log(dry ? "=== DRY RUN ===" : "=== 적용 완료 ===");
console.log("편 | 전환 | 총문항(전→후) | 기출 | O : X | O비율 | 파트분리");
var to = 0, tx = 0;
report.forEach(function (r) {
  to += r.o; tx += r.x;
  console.log(`${r.id} | ${r.edits} | ${r.before}→${r.total} | ${r.src} | ${r.o} : ${r.x} | ${(r.o / r.src * 100).toFixed(0)}% | ${r.split}` +
    (r.before !== r.total ? "  ⚠ 문항 수 변동" : "") + (r.split ? "  ⚠ 파트 분리" : ""));
});
console.log(`합계 | 기출 O ${to} : X ${tx} | O비율 ${(to / (to + tx) * 100).toFixed(1)}%`);
