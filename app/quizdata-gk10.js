// Grok 생성 제10편 (현대) — 틀만 준비. 한능검 자료 업로드 후 문항·이론·체크리스트 채움.
// window.QUIZ_CHAPTERS["gk10"]
(function () {
  var DATA = [
    {
      part: "PART 1. 준비 중",
      answer: "O",
      text: "이 편은 Grok 4.5가 한능검 자료를 바탕으로 생성할 예정입니다. (현재는 틀만 준비되어 있습니다.)",
      exp: "materials/한능검-업로드/ 에 정답표·원문을 올린 뒤 생성을 요청하면 됩니다."
    }
  ];

  var THEORY = [
    {
      blocks: [
        { k: "lead", t: "Grok 생성 제10편 (현대) — 자료 업로드 후 이론정리를 채울 예정입니다." },
        { k: "sec", t: "1-1 준비 상태" },
        { k: "p", t: "한능검 심화 기출·학습 자료를 GitHub materials/한능검-업로드/ 경로에 올리면, 규칙(CLAUDE.md)에 따라 OX 퀴즈·이론·체크리스트를 생성합니다." },
        { k: "note", v: "tip", title: "다음 단계", t: "정답표 + 문제 원문 파일을 업로드한 뒤 채팅에서 「Grok 제10편 생성」을 요청하세요." }
      ]
    }
  ];

  var CHECKLIST = {
    lead: "틀만 준비됨 · 자료 반영 후 항목이 채워집니다. (탭하면 체크)",
    groups: [
      {
        title: "준비 (PART 1)",
        items: [
          { key: "자료 업로드", o: "materials/한능검-업로드/ 에 회차별 정답표·원문 저장", x: "로컬에만 두면 생성 불가" }
        ]
      }
    ]
  };

  window.QUIZ_CHAPTERS["gk10"] = { data: DATA, theory: THEORY, checklist: CHECKLIST };
})();