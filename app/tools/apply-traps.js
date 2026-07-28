/* 🎯 함정 체크 대비표 전환 적용 — node tools/apply-traps.js <전환데이터.json> [--dry]
 *
 * 전환데이터.json = { "hk01": { "0": [ [["키","값"],…], … ], "1": [...] }, … }
 *   바깥 키 = 챕터 id, 안쪽 키 = 파트 인덱스, 값 = compare 배열(묶음들의 배열)
 *
 * 각 데이터 파일 등록부 앞에 "함정 체크 대비표 전환" 블록을 넣어 해당 파트의
 * warn 노트를 통째로 교체한다. 기출 보강 블록이 런타임에 warn.list 로 덧붙인
 * 항목까지 함께 대체되도록 반드시 등록부 바로 앞(=가장 마지막)에 둔다.
 */
var fs = require("fs");
var path = require("path");
var dir = path.join(__dirname, "..");
var dry = process.argv.indexOf("--dry") >= 0;
var DATA = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

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

var MARK = "함정 체크 대비표 전환";
var report = [];
// 한 편에서 실패했는데 앞 편은 이미 써 버리는 부분 적용을 막는다.
// 1단계에서 전 편을 검증하고 쓸 내용을 모아 둔 뒤, 2단계에서 한꺼번에 쓴다.
var pending = [];

LIST.forEach(function (c) {
  var conv = DATA[c.id];
  if (!conv) return;

  var before = load(c.id, c.file);
  // 대상 파트에 warn 노트가 실제로 있는지 확인
  Object.keys(conv).forEach(function (pi) {
    var p = before.theory[+pi];
    if (!p) throw new Error(c.id + ": 파트 " + pi + " 없음");
    var w = p.blocks.filter(function (b) { return b.k === "note" && b.v === "warn"; })[0];
    if (!w) throw new Error(c.id + " P" + pi + ": warn 노트 없음");
    // 이미 대비표인 파트를 다시 덮어쓰면 앞선 작업이 지워진다 (파일 단위가 아니라 파트 단위로 검사)
    if (w.compare) throw new Error(c.id + " P" + pi + ": 이미 대비표로 전환된 파트");
    (conv[pi] || []).forEach(function (grp, gi) {
      if (!Array.isArray(grp) || !grp.length) throw new Error(c.id + " P" + pi + " 묶음 " + gi + ": 비어 있음");
      grp.forEach(function (row) {
        if (!Array.isArray(row) || row.length !== 2 || !row[0] || !row[1])
          throw new Error(c.id + " P" + pi + " 묶음 " + gi + ": [키,값] 형식이 아님 — " + JSON.stringify(row));
      });
    });
  });

  var file = path.join(dir, c.file);
  var s = fs.readFileSync(file, "utf8");
  var marker = '  window.QUIZ_CHAPTERS["' + c.id + '"]';
  var at = s.indexOf(marker);
  if (at < 0) throw new Error(c.id + ": 등록부를 찾지 못함");

  var blk = '  // ==== 🎯 ' + MARK + ' ====\n' +
    '  // 부정형("~이면 ❌") 대신 헷갈리는 개념의 "맞는 내용"만 나란히 놓는다.\n' +
    '  // 기출 보강이 런타임에 덧붙인 항목까지 대체하도록 등록부 바로 앞에 둔다.\n' +
    '  (function () {\n' +
    '    var T = ' + JSON.stringify(conv) + ';\n' +
    '    for (var pi in T) {\n' +
    '      var bl = THEORY[pi] && THEORY[pi].blocks;\n' +
    '      if (!bl) continue;\n' +
    '      for (var j = 0; j < bl.length; j++) {\n' +
    '        if (bl[j].k === "note" && bl[j].v === "warn") {\n' +
    '          bl[j] = { k: "note", v: "warn", title: "\\uD83C\\uDFAF 함정 체크", compare: T[pi] };\n' +
    '          break;\n' +
    '        }\n' +
    '      }\n' +
    '    }\n' +
    '  })();\n\n';

  // 여기서는 쓰지 않고 모아 두기만 한다 — 전 편 검증을 통과해야 쓴다
  pending.push({ c: c, file: file, out: s.slice(0, at) + blk + s.slice(at), before: before, asked: Object.keys(conv).length });
});

// 2단계: 전 편 검증을 통과했으므로 이제 한꺼번에 쓴다
pending.forEach(function (p) {
  if (!dry) fs.writeFileSync(p.file, p.out);
  var after = dry ? p.before : load(p.c.id, p.c.file);
  var done = 0, rows = 0;
  after.theory.forEach(function (t) {
    var w = t.blocks.filter(function (b) { return b.k === "note" && b.v === "warn"; })[0];
    if (w && w.compare) { done++; w.compare.forEach(function (g) { rows += g.length; }); }
  });
  report.push({ id: p.c.id, parts: p.before.theory.length, converted: done, rows: rows, asked: p.asked });
});

console.log(dry ? "=== DRY RUN ===" : "=== 적용 완료 ===");
console.log("편 | 파트 | 전환 요청 | compare 파트 | 대비 행 수");
report.forEach(function (r) {
  console.log(`${r.id} | ${r.parts} | ${r.asked} | ${r.converted} | ${r.rows}` +
    (!dry && r.converted < r.asked ? "  ⚠ 일부 미전환" : ""));
});
