/* 가지치기 적용 — node tools/prune-apply.js <삭제목록.json> [--dry]
 *
 * 삭제목록.json 형식: { "hk01": ["해시", …], "hk02": [ … ] }
 *
 * 각 quizdata 파일 끝(등록부 앞)에 "문항 가지치기" 즉시실행 블록을 넣는다.
 * 블록은 !DATA[k].src 조건을 걸어 **기출 문항은 구조적으로 삭제될 수 없다**.
 * 삭제 뒤에는 같은 파트 안에서만 자리를 바꿔 "같은 정답 4연속"을 해소한다.
 */
var fs = require("fs");
var path = require("path");
var dir = path.join(__dirname, "..");
var dry = process.argv.indexOf("--dry") >= 0;
var drops = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

function hs(s) { var x = 0; for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return (x >>> 0).toString(36); }

function load(id, file) {
  var g = { QUIZ_CHAPTERS: {} };
  var prev = global.window;
  global.window = g;
  delete require.cache[require.resolve(path.join(dir, file))];
  require(path.join(dir, file));
  global.window = prev;
  return g.QUIZ_CHAPTERS[id];
}

/* 삽입할 블록과 **동일한 로직**을 메모리에서 재현한다 (dry-run 미리보기용).
 * 블록 코드를 고치면 이 함수도 같이 고쳐야 한다. */
function simulate(data, hashes) {
  var drop = {}; hashes.forEach(function (h) { drop[h] = 1; });
  var d = data.filter(function (q) { return !(!q.src && drop[hs(q.text)]); });
  for (var pass = 0; pass < 30; pass++) {
    var fixed = false;
    for (var a = 0; a + 3 < d.length; a++) {
      var p = d[a].part, v = d[a].answer;
      if (d[a + 1].part !== p || d[a + 2].part !== p || d[a + 3].part !== p) continue;
      if (d[a + 1].answer !== v || d[a + 2].answer !== v || d[a + 3].answer !== v) continue;
      for (var b = a + 4; b < d.length && d[b].part === p; b++) {
        if (d[b].answer !== v) { var t = d[a + 3]; d[a + 3] = d[b]; d[b] = t; fixed = true; break; }
      }
    }
    if (!fixed) break;
  }
  return d;
}

function block(hashes) {
  return [
    '  // ==== 문항 가지치기 (중복·지엽·저변별 자체생성 문항 정리) ====',
    '  // src(기출) 문항은 조건상 절대 삭제되지 않는다. 삭제 후 같은 정답 4연속만 파트 내 교환으로 해소.',
    '  (function () {',
    '    var DROP = "' + hashes.join(" ") + '".split(" ");',
    '    var drop = {}; for (var i = 0; i < DROP.length; i++) drop[DROP[i]] = 1;',
    '    function hs(s) { var x = 0; for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return (x >>> 0).toString(36); }',
    '    for (var k = DATA.length - 1; k >= 0; k--) if (!DATA[k].src && drop[hs(DATA[k].text)]) DATA.splice(k, 1);',
    '    for (var pass = 0; pass < 30; pass++) {',
    '      var fixed = false;',
    '      for (var a = 0; a + 3 < DATA.length; a++) {',
    '        var p = DATA[a].part, v = DATA[a].answer;',
    '        if (DATA[a + 1].part !== p || DATA[a + 2].part !== p || DATA[a + 3].part !== p) continue;',
    '        if (DATA[a + 1].answer !== v || DATA[a + 2].answer !== v || DATA[a + 3].answer !== v) continue;',
    '        for (var b = a + 4; b < DATA.length && DATA[b].part === p; b++) {',
    '          if (DATA[b].answer !== v) { var t = DATA[a + 3]; DATA[a + 3] = DATA[b]; DATA[b] = t; fixed = true; break; }',
    '        }',
    '      }',
    '      if (!fixed) break;',
    '    }',
    '  })();',
    ''
  ].join("\n");
}

global.window = { QUIZ_CHAPTERS: {} };
require(path.join(dir, "chapters.js"));
var LIST = global.window.CHAPTER_LIST;

var report = [];
LIST.forEach(function (c) {
  var hashes = drops[c.id] || [];
  if (!hashes.length) { report.push({ id: c.id, skipped: true }); return; }

  var before = load(c.id, c.file);
  var byHash = {};
  before.data.forEach(function (q) { byHash[hs(q.text)] = q; });

  // 안전 점검: 존재하지 않는 해시 / 기출 문항 지정 여부
  var missing = hashes.filter(function (h) { return !byHash[h]; });
  var exam = hashes.filter(function (h) { return byHash[h] && byHash[h].src; });
  if (missing.length) throw new Error(c.id + ": 존재하지 않는 해시 " + missing.join(","));
  if (exam.length) throw new Error(c.id + ": 기출 문항을 삭제 대상으로 지정함 " + exam.join(","));

  var file = path.join(dir, c.file);
  var src = fs.readFileSync(file, "utf8");
  var marker = '  window.QUIZ_CHAPTERS["' + c.id + '"]';
  var at = src.indexOf(marker);
  if (at < 0) throw new Error(c.id + ": 등록부를 찾지 못함");
  if (src.indexOf("문항 가지치기") >= 0) throw new Error(c.id + ": 이미 가지치기 블록이 있음");

  var after;
  if (dry) {
    after = { data: simulate(before.data, hashes) };   // 파일을 건드리지 않고 결과만 계산
  } else {
    fs.writeFileSync(file, src.slice(0, at) + block(hashes) + src.slice(at));
    after = load(c.id, c.file);                        // 실제 파일을 다시 읽어 검증
  }
  var parts = {};
  after.data.forEach(function (q) {
    parts[q.part] = parts[q.part] || { n: 0, o: 0 };
    parts[q.part].n++; if (q.answer === "O") parts[q.part].o++;
  });
  // 4연속 검사
  var run = 1, worst = 1;
  for (var i = 1; i < after.data.length; i++) {
    if (after.data[i].part === after.data[i - 1].part && after.data[i].answer === after.data[i - 1].answer) run++;
    else run = 1;
    if (run > worst) worst = run;
  }
  var ratios = Object.keys(parts).map(function (p) { return (parts[p].o / parts[p].n); });
  report.push({
    id: c.id, before: before.data.length, after: after.data.length,
    removed: before.data.length - after.data.length, requested: hashes.length,
    exam: after.data.filter(function (q) { return q.src; }).length,
    maxRun: worst,
    minPart: Math.min.apply(null, Object.keys(parts).map(function (p) { return parts[p].n; })),
    ratioMin: Math.min.apply(null, ratios).toFixed(2),
    ratioMax: Math.max.apply(null, ratios).toFixed(2)
  });
});

console.log(dry ? "=== DRY RUN ===" : "=== 적용 완료 ===");
console.log("편 | 이전 → 이후 (삭제/요청) | 기출 | 최대연속 | 최소파트 | O비율 범위");
var tb = 0, ta = 0;
report.forEach(function (r) {
  if (r.skipped) { console.log(r.id + " | 건너뜀"); return; }
  tb += r.before; ta += r.after;
  console.log(`${r.id} | ${r.before} → ${r.after} (${r.removed}/${r.requested}) | ${r.exam} | ${r.maxRun} | ${r.minPart} | ${r.ratioMin}~${r.ratioMax}` +
    (r.removed !== r.requested ? "  ⚠ 삭제수≠요청수" : "") + (r.maxRun > 3 ? "  ⚠ 4연속" : ""));
});
console.log(`합계 | ${tb} → ${ta} (${tb - ta} 삭제)`);
