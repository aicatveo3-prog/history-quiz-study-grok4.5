/* 출제 순서 섞기 — node tools/shuffle-order.js [--dry]
 *
 * 문제: 표준 1이 "선지 하나당 원문(⭕)+변형(❌)"을 짝으로 만들다 보니 두 문항이
 * 붙어 배치돼 정답이 OXOXOX… 로 규칙적이 됐다(인접 교대율 82%, 무작위는 50%).
 * 정답이 예측 가능하면 지문을 읽지 않고도 맞힐 수 있어 변별력이 떨어진다.
 *
 * 해결: 파트 안에서만 순서를 다시 짠다.
 *   · 파트 경계·파트 순서·문항 구성은 그대로 (⭕/❌ 개수 불변)
 *   · 정답 배열을 시드 고정 난수로 섞어 인접 교대율을 50% 근처로
 *   · 같은 정답 4연속 금지(표준 1)
 *   · ⭕ 문항끼리·❌ 문항끼리도 섞어 원문·변형 짝이 붙어 나오지 않게
 *
 * 결과는 각 데이터 파일에 "출제 순서 섞기" 블록으로 박아 넣는다. 순서를 코드가
 * 매번 새로 계산하면 새로고침마다 순서가 바뀌어 저장된 진도가 엉뚱한 문항을
 * 가리키므로, **확정된 순열을 데이터로 고정**한다.
 */
var fs = require("fs");
var path = require("path");
var dir = path.join(__dirname, "..");
var dry = process.argv.indexOf("--dry") >= 0;

// 시드 고정 PRNG (mulberry32) — 실행할 때마다 같은 결과
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rnd) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

/* 정답 패턴 생성: O가 no개, X가 nx개인 수열을 만든다.
   "섞은 뒤 수선"은 런이 여러 개일 때 서로 얽혀 실패하므로,
   처음부터 제약(4연속 금지)을 지키며 한 칸씩 뽑는다.
   남은 개수에 비례해 뽑아 자연스러운 불규칙성을 얻고,
   남은 소수 쪽을 다 쓰면 다수 쪽이 4연속에 걸리는 막다른 길은 미리 차단한다. */
function tryPattern(no, nx, rnd) {
  var p = [], rem = { O: no, X: nx }, last = null, run = 0;
  for (var i = 0; i < no + nx; i++) {
    var opts = ["O", "X"].filter(function (a) {
      if (rem[a] <= 0) return false;
      if (a === last && run >= 3) return false;              // 4연속 금지
      // 이걸 고르면 남는 배치가 가능한가: 다수 쪽은 (소수+1)개 구간에 3개씩만 들어간다
      var r = { O: rem.O, X: rem.X }; r[a]--;
      var nrun = (a === last) ? run + 1 : 1;
      var other = a === "O" ? "X" : "O";
      // a 를 이어 붙일 수 있는 여유 + 이후 구간 수용량
      return r[a] <= (3 - nrun) + 3 * r[other];
    });
    if (!opts.length) return null;
    var pick;
    if (opts.length === 1) pick = opts[0];
    else pick = rnd() < rem[opts[0]] / (rem[opts[0]] + rem[opts[1]]) ? opts[0] : opts[1];
    p.push(pick);
    run = (pick === last) ? run + 1 : 1;
    last = pick;
    rem[pick]--;
  }
  return p;
}
function pattern(no, nx, rnd) {
  for (var t = 0; t < 50; t++) { var p = tryPattern(no, nx, rnd); if (p) return p; }
  throw new Error("정답 패턴 생성 실패 (O=" + no + ", X=" + nx + ")");
}

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

function stats(data) {
  var sw = 0, pair = 0, run = 1, worst = 1;
  for (var i = 1; i < data.length; i++) {
    if (data[i].part !== data[i - 1].part) { run = 1; continue; }
    pair++;
    if (data[i].answer !== data[i - 1].answer) { sw++; run = 1; }
    else { run++; if (run > worst) worst = run; }
  }
  return { alt: sw / pair, worst: worst };
}

var report = [];
LIST.forEach(function (c, ci) {
  var ch = load(c.id, c.file);
  var DATA = ch.data;
  var before = stats(DATA);

  // 파트별로 순열을 계산한다 (파트 경계·순서는 그대로)
  var rnd = rng(20260727 + ci * 7919);
  var order = [], start = 0;
  while (start < DATA.length) {
    var end = start;
    while (end < DATA.length && DATA[end].part === DATA[start].part) end++;
    var idx = [];
    for (var i = start; i < end; i++) idx.push(i);
    var oIdx = shuffle(idx.filter(function (i) { return DATA[i].answer === "O"; }), rnd);
    var xIdx = shuffle(idx.filter(function (i) { return DATA[i].answer === "X"; }), rnd);
    var pat = pattern(oIdx.length, xIdx.length, rnd);
    var oi = 0, xi = 0;
    pat.forEach(function (a) { order.push(a === "O" ? oIdx[oi++] : xIdx[xi++]); });
    start = end;
  }

  var after = stats(order.map(function (i) { return DATA[i]; }));
  // 표준 1 위반은 절대 통과시키지 않는다
  if (after.worst > 3) throw new Error(c.id + ": 같은 정답 " + after.worst + "연속 발생 — 적용 중단");

  // 순열 무결성: 모든 인덱스가 정확히 한 번씩, 파트 경계 보존
  var seen = new Array(DATA.length).fill(0);
  order.forEach(function (i) { seen[i]++; });
  if (order.length !== DATA.length || seen.some(function (v) { return v !== 1; })) {
    throw new Error(c.id + ": 순열이 올바르지 않음");
  }
  order.forEach(function (src, dst) {
    if (DATA[src].part !== DATA[dst].part) throw new Error(c.id + ": 파트 경계가 어긋남 (" + dst + ")");
  });

  var file = path.join(dir, c.file);
  var s = fs.readFileSync(file, "utf8");
  if (s.indexOf("출제 순서 섞기") >= 0) throw new Error(c.id + ": 이미 순서 섞기 블록이 있음");
  var marker = '  window.QUIZ_CHAPTERS["' + c.id + '"]';
  var at = s.indexOf(marker);
  if (at < 0) throw new Error(c.id + ": 등록부를 찾지 못함");

  var blk = [
    '  // ==== 출제 순서 섞기 (정답이 OXOXOX 로 규칙적이던 문제 해소) ====',
    '  // 파트 안에서만 재배열한다. 파트 경계·구성·⭕❌ 개수는 그대로이고 순서만 바뀐다.',
    '  // 순열을 고정값으로 박아 두어 새로고침해도 순서가 변하지 않는다(저장된 진도 보호).',
    '  (function () {',
    '    var ORD = [' + order.join(",") + '];',
    '    if (ORD.length !== DATA.length) return;   // 문항 수가 바뀌면 적용하지 않는다',
    '    var out = new Array(ORD.length);',
    '    for (var i = 0; i < ORD.length; i++) out[i] = DATA[ORD[i]];',
    '    for (var j = 0; j < out.length; j++) DATA[j] = out[j];',
    '  })();',
    ''
  ].join("\n");

  if (!dry) fs.writeFileSync(file, s.slice(0, at) + blk + s.slice(at));
  var real = dry ? after : stats(load(c.id, c.file).data);
  report.push({ id: c.id, n: DATA.length, b: before, a: real });
});

console.log(dry ? "=== DRY RUN ===" : "=== 적용 완료 ===");
console.log("편 | 문항 | 인접교대율 (이전 → 이후) | 최장연속 (이전 → 이후)");
report.forEach(function (r) {
  console.log(`${r.id} | ${r.n} | ${(r.b.alt * 100).toFixed(0)}% → ${(r.a.alt * 100).toFixed(0)}% | ${r.b.worst} → ${r.a.worst}` +
    (r.a.worst > 3 ? "  ⚠ 4연속" : ""));
});
var avg = report.reduce(function (s, r) { return s + r.a.alt; }, 0) / report.length;
console.log("평균 인접교대율: " + (avg * 100).toFixed(1) + "%  (무작위 기대값 ≈ 50%)");
