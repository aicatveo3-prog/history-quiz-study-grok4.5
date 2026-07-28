/* 로그인 동기화 설정 (선택 기능)
 * ─────────────────────────────────────────────────────────────
 * 이 값이 null 이면 앱은 "로그인 없이 로컬 저장"으로만 동작한다.
 * 아래 window.FIREBASE_CONFIG 에 실제 설정이 들어 있으면
 * 구글·이메일 로그인 + 기기 간 동기화(진도·체크리스트·오답노트·저장함)가 켜진다.
 *
 * ┌─ Firestore 보안 규칙 (복붙용) ────────────────────────────────────────────┐
 * │ Firebase 콘솔 → Firestore Database → 규칙(Rules) 탭에 아래를 붙여넣고 게시  │
 * │ 기록은 users/{uid}/apps/{APP_ID} 에 저장되므로 uid 아래 전체를 본인만        │
 * │ 접근하게 제한한다. 아래 규칙은 하위 문서까지 허용하므로 수정할 필요가 없다.  │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /users/{userId} {
 *         allow read, write: if request.auth != null && request.auth.uid == userId;
 *         match /{document=**} {
 *           allow read, write: if request.auth != null && request.auth.uid == userId;
 *         }
 *       }
 *     }
 *   }
 *
 * 승인된 도메인: Authentication > 설정 > 승인된 도메인에
 *   aicatveo3-prog.github.io  및  localhost  가 있어야 한다.
 *
 * ※ 여러 퀴즈 앱이 이 설정을 그대로 공유한다(프로젝트 1개).
 *   uid 는 Firebase 프로젝트 단위로 발급되므로, 프로젝트를 공유해야
 *   구글 계정 하나로 모든 앱에서 같은 사용자로 로그인된다.
 *   기록 분리는 app-id.js 의 APP_ID(문서 경로 users/{uid}/apps/{APP_ID})가 담당한다.
 *   새 앱을 추가할 때 이 파일은 그대로 복사하고 app-id.js 만 바꾸면 된다.
 *
 * ※ 아래 설정값(apiKey 등)은 비밀번호가 아니라 공개용 식별자다.
 *   실제 보안은 위 Firestore 규칙 + 승인된 도메인이 담당하므로 커밋해도 안전하다.
 */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyATW1oRlc4ghsxftvYsNUPfhqOE-uZ4gFY",
  authDomain: "jibangse-quiz.firebaseapp.com",
  projectId: "jibangse-quiz",
  storageBucket: "jibangse-quiz.firebasestorage.app",
  messagingSenderId: "279996309805",
  appId: "1:279996309805:web:50c29a68ce14475620b3a4",
  measurementId: "G-QF3374ET5F"
};
