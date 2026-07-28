# Agent / 작업 규칙

## 소스 오브 트루스 = GitHub only

- **유일한 원본:** `https://github.com/aicatveo3-prog/history-quiz-study-grok4.5`
- **로컬 폴더(Downloads, 데스크탑 zip 등)는 무시한다.** 사용자에게 로컬 경로·clone·git status를 묻거나 의존하지 않는다.
- 읽기: GitHub API / MCP (`get_file_contents`, tree, search 등)
- 쓰기: GitHub에 직접 커밋 (`push_files`, `create_or_update_file`, `delete_file` 등)
- 배포: `main` 푸시 → GitHub Pages 자동 배포

## 기본 브랜치 정책

- 소규모·문서·확실한 수정: `main`에 바로 커밋해도 된다.
- 큰 기능·다편 작업·기출 대량 반영: 작업 브랜치 생성 → 커밋 → PR → **사용자 승인 후 병합** (기존 `CLAUDE.md` 공통 검증·배포 절차 준수).

## 이 저장소 작업 시 체크리스트

1. 코드·자료는 항상 GitHub에서 읽는다.
2. 변경 결과는 항상 GitHub 커밋/PR로 남긴다.
3. 로컬 임시 clone이 필요해도 사용자에게 로컬 관리를 요구하지 않는다 (작업 후 remote에 반영되면 충분).
4. 완료 보고 시 **커밋 SHA 또는 PR 링크, 변경 파일, Pages 반영 여부**만 알려준다.

상세 퀴즈/이론/기출 작성 표준은 `CLAUDE.md`를 따른다.
