/* 이론 커버리지 보강 — node tools/apply-theory.js <보강데이터.json> [--dry]
 *
 * 보강데이터.json = { "hk04": [ { part, blocks:[…], compare:[[["키","값"],…]] }, … ], … }
 *
 * 퀴즈(문항·해설)는 묻는데 THEORY 에 근거가 없는 "떠 있는 문항"을 없애기 위한 보강이다
 * (CLAUDE.md 표준 2 [커버리지]). 각 파일 등록부 바로 앞에 즉시실행 블록을 넣어
 * 원본 THEORY 배열을 건드리지 않고 얹는다.
 *
 *   · blocks  : 🎯 함정 체크(note warn) **앞**에 끼워 넣는다 (함정 체크는 항상 파트 끝)
 *   · compare : 그 파트 🎯 함정 체크의 compare 배열에 대비 그룹을 덧붙인다
 *               (함정 체크는 list → compare 로 전환을 마쳤으므로 compare 로만 넣는다)
 *
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

var OK = { sec: 1, sub: 1, lead: 1, p: 1, tree: 1, table: 1, note: 1 };
var OKV = { ex: 1, box: 1, warn: 1, tip: 1 };

var pending = [], report = [];

LIST.forEach(function (c) {
  var specs = PLAN[c.id];
  if (!specs || !specs.length) return;
  var before = load(c.id, c.file);
  var seq = [];
  before.data.forEach(function (q) { if (seq.indexOf(q.part) < 0) seq.push(q.part); });

  specs.forEach(function (s, i) {
    var lbl = c.id + " #" + (i + 1);
    var ti = seq.indexOf(s.part);
    if (ti < 0) throw new Error(lbl + ": 존재하지 않는 파트 — " + s.part);
    var th = before.theory[ti];
    if (!th || !th.blocks) throw new Error(lbl + ": THEORY[" + ti + "] 없음");
    (s.blocks || []).forEach(function (b, j) {
      if (!OK[b.k]) throw new Error(lbl + " blocks[" + j + "]: 알 수 없는 k — " + b.k);
      if (b.k === "note" && !OKV[b.v]) throw new Error(lbl + " blocks[" + j + "]: note.v 오류 — " + b.v);
      if (b.k === "table") {
        if (!b.head || !b.rows) throw new Error(lbl + " blocks[" + j + "]: table head/rows 없음");
        b.rows.forEach(function (r, k) {
          if (r.length !== b.head.length) throw new Error(lbl + " blocks[" + j + "] rows[" + k + "]: 열 수 " + r.length + " ≠ head " + b.head.length);
        });
      }
    });
    if (s.compare && s.compare.length) {
      var warn = null;
      th.blocks.forEach(function (b) { if (b.k === "note" && b.v === "warn") warn = b; });
      if (!warn) throw new Error(lbl + ": 이 파트에 🎯 함정 체크(note warn)가 없어 compare 를 붙일 수 없음");
      if (!warn.compare) throw new Error(lbl + ": 함정 체크가 compare 형식이 아님(list 형식) — 먼저 전환 필요");
      s.compare.forEach(function (g, j) {
        if (!Array.isArray(g) || !g.length) throw new Error(lbl + " compare[" + j + "]: 그룹이 비어 있음");
        g.forEach(function (row, k) {
          if (!Array.isArray(row) || row.length !== 2) throw new Error(lbl + " compare[" + j + "][" + k + "]: [키, 값] 2요소여야 함");
        });
      });
    }
    if (!(s.blocks && s.blocks.length) && !(s.compare && s.compare.length)) throw new Error(lbl + ": blocks/compare 둘 다 비어 있음");
  });

  var file = path.join(dir, c.file);
  var s = fs.readFileSync(file, "utf8");
  var marker = '  window.QUIZ_CHAPTERS["' + c.id + '"]';
  var at = s.indexOf(marker);
  if (at < 0) throw new Error(c.id + ": 등록부를 찾지 못함");

  var blk = '  // ==== 📚 이론 커버리지 보강 ====\n' +
    '  // 퀴즈가 묻는데 이론에 근거가 없던 개념을 채운다(표준 2 [커버리지]).\n' +
    '  // 본문 블록은 🎯 함정 체크 앞에, 대비 항목은 함정 체크 compare 뒤에 붙는다.\n' +
    '  (function () {\n' +
    '    var SPECS = ' + JSON.stringify(specs) + ';\n' +
    '    var seq = [];\n' +
    '    for (var i = 0; i < DATA.length; i++) if (seq.indexOf(DATA[i].part) < 0) seq.push(DATA[i].part);\n' +
    '    for (var s = 0; s < SPECS.length; s++) {\n' +
    '      var sp = SPECS[s], ti = seq.indexOf(sp.part);\n' +
    '      if (ti < 0 || !THEORY[ti] || !THEORY[ti].blocks) continue;\n' +
    '      var bl = THEORY[ti].blocks, wi = -1, warn = null;\n' +
    '      for (var i = 0; i < bl.length; i++) if (bl[i].k === "note" && bl[i].v === "warn") { wi = i; warn = bl[i]; }\n' +
    '      if (sp.blocks && sp.blocks.length) bl.splice.apply(bl, [(wi < 0 ? bl.length : wi), 0].concat(sp.blocks));\n' +
    '      if (sp.compare && sp.compare.length && warn && warn.compare) Array.prototype.push.apply(warn.compare, sp.compare);\n' +
    '    }\n' +
    '  })();\n\n';

  pending.push({ c: c, file: file, out: s.slice(0, at) + blk + s.slice(at), before: before, specs: specs });
});

pending.forEach(function (p) {
  if (!dry) fs.writeFileSync(p.file, p.out);
  if (dry) { report.push({ id: p.c.id, dry: true, n: p.specs.length }); return; }
  var after = load(p.c.id, p.c.file);
  var nb = 0, nc = 0;
  after.theory.forEach(function (t, i) {
    nb += t.blocks.length - p.before.theory[i].blocks.length;
    t.blocks.forEach(function (b, j) {
      if (b.k === "note" && b.v === "warn" && b.compare) {
        var was = p.before.theory[i].blocks.filter(function (x) { return x.k === "note" && x.v === "warn" && x.compare; })[0];
        if (was) nc += b.compare.length - was.compare.length;
      }
    });
  });
  report.push({ id: p.c.id, n: p.specs.length, blocks: nb, groups: nc, parts: after.theory.length, q: after.data.length });
});

console.log(dry ? "=== DRY RUN (검증만) ===" : "=== 적용 완료 ===");
if (dry) { report.forEach(function (r) { console.log(r.id + ": 보강 " + r.n + "건 — 검증 통과"); }); return; }
console.log("편 | 보강 | 새 블록 | 새 대비그룹 | 이론파트 | 문항");
report.forEach(function (r) {
  console.log(`${r.id} | ${r.n} | +${r.blocks} | +${r.groups} | ${r.parts} | ${r.q}`);
});
