/* 전체 정합성 점검 — node tools/verify-all.js
 *
 * 배포 전 공통 검증(CLAUDE.md "공통 검증·배포 절차" 1항)을 한 번에 돌린다.
 *   · 문항 수 · chapters.js count 일치 · 필수 필드
 *   · 파트별 ⭕:❌ 비율 · 같은 정답 연속(최대 3) · 파트 연속성(분리 금지)
 *   · 기출(src) ⭕:❌ 균형 · 회차 목록
 *   · THEORY 구조(lead 1개·sec 2개 이상·함정 체크 1개 이상·표 열 수·note.v)
 *   · CHECKLIST 항목 3요소
 * 위반이 있으면 종료 코드 1.
 */
var path = require("path");
var dir = path.join(__dirname, "..");

global.window = { QUIZ_CHAPTERS: {} };
require(path.join(dir, "chapters.js"));
var LIST = global.window.CHAPTER_LIST;

var OKV = { ex: 1, box: 1, warn: 1, tip: 1 };
var bad = [], total = 0, sO = 0, sX = 0, rounds = {};

LIST.forEach(function (c) {
  require(path.join(dir, c.file));
  var ch = global.window.QUIZ_CHAPTERS[c.id];
  if (!ch) { bad.push(c.id + ": 등록 안 됨"); return; }
  var D = ch.data, T = ch.theory, K = ch.checklist;
  total += D.length;
  if (c.count !== D.length) bad.push(c.id + ": chapters.js count " + c.count + " ≠ 실제 " + D.length);

  // 문항 필드
  D.forEach(function (q, i) {
    if (!q.part || !q.text || !q.exp) bad.push(c.id + " #" + i + ": 필수 필드 누락");
    if (q.answer !== "O" && q.answer !== "X") bad.push(c.id + " #" + i + ": answer 오류");
  });

  // 파트 연속성 · 연속 정답 · 파트별 비율
  var seq = [], seen = {}, run = 1, worst = 1, worstAt = "";
  D.forEach(function (q, i) {
    if (i && q.part === D[i - 1].part && q.answer === D[i - 1].answer) {
      run++; if (run > worst) { worst = run; worstAt = q.part; }
    } else if (i) run = 1;
    if (!seq.length || seq[seq.length - 1] !== q.part) {
      if (seen[q.part]) bad.push(c.id + ": 파트 분리 — " + q.part);
      seen[q.part] = 1; seq.push(q.part);
    }
  });
  if (worst > 3) bad.push(c.id + ": 같은 정답 " + worst + "연속 (" + worstAt + ")");

  var pstat = seq.map(function (p) {
    var a = D.filter(function (q) { return q.part === p; });
    var o = a.filter(function (q) { return q.answer === "O"; }).length;
    var dev = Math.abs(o / a.length - 0.5) * 100;
    if (dev > 15) bad.push(c.id + ": " + p + " ⭕비율 " + (o / a.length * 100).toFixed(0) + "% (5:5에서 " + dev.toFixed(0) + "%p 이탈)");
    return { p: p, n: a.length, o: o };
  });

  // 기출
  var src = D.filter(function (q) { return q.src; });
  var so = src.filter(function (q) { return q.answer === "O"; }).length;
  sO += so; sX += src.length - so;
  src.forEach(function (q) {
    (Array.isArray(q.src) ? q.src : [q.src]).forEach(function (r) { rounds[r] = (rounds[r] || 0) + 1; });
  });

  // THEORY
  if (T.length !== seq.length) bad.push(c.id + ": 이론 파트 수 " + T.length + " ≠ 퀴즈 파트 수 " + seq.length);
  T.forEach(function (t, i) {
    var b = t.blocks || [], leads = 0, secs = 0, warns = 0;
    b.forEach(function (x, j) {
      if (x.k === "lead") leads++;
      if (x.k === "sec") secs++;
      if (x.k === "note") {
        if (!OKV[x.v]) bad.push(c.id + " 이론[" + i + "][" + j + "]: note.v 오류 — " + x.v);
        if (x.v === "warn") warns++;
      }
      if (x.k === "table") {
        if (!x.head || !x.rows) bad.push(c.id + " 이론[" + i + "][" + j + "]: table head/rows 없음");
        else x.rows.forEach(function (r, k) {
          if (r.length !== x.head.length) bad.push(c.id + " 이론[" + i + "][" + j + "] rows[" + k + "]: 열 수 " + r.length + " ≠ head " + x.head.length);
        });
      }
    });
    if (leads !== 1) bad.push(c.id + " 이론[" + i + "] (" + seq[i] + "): lead " + leads + "개 (1개여야 함)");
    if (secs < 2) bad.push(c.id + " 이론[" + i + "] (" + seq[i] + "): sec " + secs + "개 (2개 이상)");
    if (warns < 1) bad.push(c.id + " 이론[" + i + "] (" + seq[i] + "): 🎯 함정 체크 없음");
  });

  // CHECKLIST
  var ki = 0;
  (K && K.groups || []).forEach(function (g) {
    (g.items || []).forEach(function (it) {
      ki++;
      if (!it.key || !it.o || !it.x) bad.push(c.id + " 체크리스트 \"" + (it.key || "?") + "\": key/o/x 3요소 필요");
    });
  });

  console.log(c.id + " | " + D.length + "문항 · " + seq.length + "파트 · 기출 " + so + ":" + (src.length - so) +
    " · 최장연속 " + worst + " · 체크리스트 " + ki +
    "\n   " + pstat.map(function (s) { return s.o + "/" + s.n; }).join("  "));
});

console.log("\n총 " + total.toLocaleString() + "문항 | 기출 " + sO + ":" + sX +
  " (⭕ " + (sO / (sO + sX) * 100).toFixed(1) + "%) | 뱃지 " + (sO + sX) + "문항");
console.log("회차: " + Object.keys(rounds).sort().map(function (r) { return r.replace("한능검 제", "") + "(" + rounds[r] + ")"; }).join(" "));

if (bad.length) {
  console.log("\n⚠ 위반 " + bad.length + "건:");
  bad.forEach(function (x) { console.log("  · " + x); });
  process.exit(1);
}
console.log("\n✅ 위반 없음");
