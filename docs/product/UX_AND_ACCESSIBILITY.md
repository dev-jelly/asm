# UX·접근성 설계

- 기준일: 2026-07-24
- 목표: 초보자가 현재 학습 과제에 집중하면서도 register·memory·stack·trace의 인과관계를 탐색할 수 있는 반응형 학습 환경
- 접근성 목표: WCAG 2.2 AA

## 1. 경험 원칙

### 상태 변화가 주인공이다

장식적 CPU 그림보다 `무엇을 읽고, 어떻게 계산하고, 무엇을 썼는가`를 가장 선명하게 보여준다.

### 한 번에 한 개념

모든 panel을 항상 열어 두지 않는다. lesson이 register를 다루면 register가, memory를 다루면 memory가 기본 focus가 된다.

### 예측을 먼저 받는다

Step 버튼은 단순 실행이 아니다. 중요한 checkpoint에서는 prediction 제출 후 결과를 공개한다.

### 차분한 실험실

시각 방향은 “해커 터미널”이 아니라 정밀하고 따뜻한 학습 실험실이다.

- 본문: 읽기 좋은 sans-serif
- 코드·주소·bit: monospace
- neutral surface와 높은 가독성
- 현재 PC, read, write, warning에 제한된 semantic accent
- light/dark theme
- 과도한 glow, scanline, binary rain, 3D 효과 금지

### 색은 보조 수단이다

상태 변화는 색과 함께 text, icon, border, arrow, pattern, before→after를 사용한다.

## 2. Information architecture

### Primary navigation

- 배우기
- 연습
- 플레이그라운드
- 사전
- 진도

### Secondary

- 출처와 버전
- 접근성 도움말
- 설정
- 소개

### 사전 내부

- instruction
- pseudo-instruction
- directive
- register와 ABI
- 용어
- memory와 data representation

## 3. Page inventory

### 홈

목적:

- 제품 설명보다 먼저 첫 state change를 경험
- 추천 학습 시작점 제시

구성:

1. 짧은 headline
2. 3–5줄 RV32I code
3. “다음에는 무엇이 바뀔까요?” prediction
4. Step 후 register diff
5. 시작 CTA
6. 커리큘럼과 accessibility 약속

### Course

- module map
- prerequisite
- concept mastery
- 다음 추천 이유
- review due
- 자유롭게 건너뛰기

강제 lock보다 추천 경로를 사용한다.

### Lesson

- lesson narrative
- prediction
- editor
- state lab
- hint와 feedback
- progress

### Practice

- concept, instruction, difficulty, misconception filter
- review queue
- independent/transfer badge
- 무작위 입력 문제

### Playground

- source editor
- example selector
- machine profile 표시
- Step/Run/Back
- full state lab
- export/import
- source share는 후속 기능

### Reference

- search
- canonical syntax
- operands
- semantics
- encoding
- examples
- related misconception
- official source
- 지원 profile 표시

### Progress

- concept mastery map
- evidence detail
- delayed review
- recurring misconception
- export/reset

## 4. Lesson layout

### Desktop, 1280px 이상

```text
┌──────────────────────────────────────────────────────────────┐
│ Top bar: lesson / machine profile / controls                 │
├──────────────────────┬───────────────────────────────────────┤
│ 설명·예측 35–40%     │ source editor                         │
│                      ├───────────────────────────────────────┤
│ hint / feedback      │ focused state view                    │
│                      │ Register | Memory | Stack | Trace      │
├──────────────────────┴───────────────────────────────────────┤
│ step explanation / timeline                                 │
└──────────────────────────────────────────────────────────────┘
```

설명과 editor를 완전히 분리된 페이지로 만들지 않는다. prediction과 해당 code/state가 같은 viewport 안에 있어야 한다.

### Tablet

- 설명 40%, code/state 60% 또는 resizable split
- state view는 tabs
- control은 sticky하되 content와 focus를 가리지 않음

### Mobile

```text
Lesson summary
Prediction
[Code] [Registers] [Memory] [Trace]
Focused content
Sticky: Back | Step | Run/Pause
Feedback
```

- page 전체의 horizontal scroll 금지
- code와 memory table만 자체 horizontal scroll 허용
- tabs 간 동일한 `seq`를 유지
- Step 후 관련 tab에 badge를 표시하되 자동으로 focus를 빼앗지 않음
- 사용자가 “변경 위치 보기”를 선택하면 이동

## 5. Execution controls

필수 control:

- Step
- Back
- Run
- Pause
- Reset
- 속도
- breakpoint
- timeline seek

규칙:

- Run 중 primary control은 Pause가 된다.
- Step과 Back은 명확한 text label을 유지한다.
- Reset은 confirmation 없이 초기 lesson state로 돌아가되 source 수정이 있으면 별도 확인 또는 undo 가능성을 제공한다.
- keyboard shortcut은 도움말에 표시하고 재지정·해제를 지원한다.
- editor 입력 중 shortcut 충돌을 방지한다.
- unavailable control은 이유가 있는 tooltip과 accessible description을 제공한다.

권장 shortcut은 구현·보조기술 충돌 검토 후 결정한다. 브라우저·screen reader가 점유하는 function key에만 의존하지 않는다.

## 6. Source와 instruction 표현

세 층을 구분한다.

1. 작성한 source
2. pseudo expansion 이후 canonical instruction
3. 32-bit encoding

현재 instruction은 line 전체 배경색만 바꾸지 않고 다음을 함께 사용한다.

- current arrow
- `현재 PC` text
- border
- source↔machine mapping connector

pseudo source 한 줄이 여러 instruction으로 확장되면 `1/2`, `2/2` 배지를 표시한다.

오류는 line number만 표시하지 않는다. editor annotation, 오류 text, 관련 operand, 해결 행동을 programmatically 연결한다.

## 7. Register view

열:

- architectural name: `x5`
- ABI name: `t0`
- value
- selected representation
- before→after
- last access

기본 grouping:

- special: zero, ra, sp, gp, tp
- argument
- temporary
- saved

변경하지 않은 32개 register를 모두 같은 강조도로 보여주지 않는다. lesson focus mode에서는 관련 register를 상단에 고정하고 전체 목록은 계속 접근 가능하게 한다.

표현 전환:

- hex
- signed decimal
- unsigned decimal
- binary
- ASCII 가능 시

`x0`은 lock icon과 “write ignored” 설명을 제공한다.

## 8. Memory view

기본 열:

- address
- hex bytes
- ASCII
- label/region
- recent access

기능:

- address로 이동
- label로 이동
- byte/half/word grouping
- signed/unsigned lens
- little-endian 조립 보기
- read/write filter
- watchpoint
- last writer
- initialized/uninitialized

virtualization을 사용하더라도 screen reader와 keyboard 탐색을 위해 page 또는 address-range 단위의 대안을 제공한다.

read와 write cue:

- read: eye/arrow-in + outline + text
- write: pencil/arrow-out + strong border + before→after
- fetch: 별도의 subtle marker

색만으로 구분하지 않는다.

## 9. Effective-address 설명

load/store Step에서는 다음 식을 고정 위치에 보여준다.

```text
x10       + signExtend(4) = 0x00001004
0x00001000 + 0x00000004   = 0x00001004
```

이어 읽은 byte 범위와 조립 결과를 표시한다.

```text
주소       1004 1005 1006 1007
bytes      78   56   34   12
u32 little-endian → 0x12345678
```

이 설명은 SVG animation이 아니라 semantic DOM text와 table로도 제공한다.

## 10. Stack view

stack은 raw memory와 분리된 독립 truth가 아니다.

- raw address와 bytes를 항상 연결
- `sp`, optional `fp`, `ra` 표시
- frame boundary는 ABI pattern에서 추론한 overlay라고 표시
- stack growth direction arrow
- argument, saved register, local 영역 label
- prologue·epilogue Step에서 실제 `sp`와 memory 변화 강조

불확실한 frame inference는 확정적으로 표현하지 않는다.

## 11. Trace와 time travel

timeline item:

- step number
- PC
- mnemonic
- source line
- 주요 delta
- control-flow kind
- trap 또는 I/O

기능:

- current step
- Back
- checkpoint marker
- seek
- breakpoint/watchpoint marker
- rewind 후 branch된 history 표시

빠른 Run에서는 모든 item animation을 재생하지 않는다. event를 batch하고 pause 시 summary를 제공한다.

## 12. Prediction UI

prediction 유형:

- multiple choice
- value entry
- register 선택
- memory bytes 배열
- branch taken toggle
- state table fill

원칙:

- 정답 입력이 code editor 조작보다 어렵지 않아야 한다.
- hex prefix와 대소문자를 유연하게 normalize한다.
- “모르겠음”을 허용하되 결과를 보기 전에 짧은 이유 선택을 유도할 수 있다.
- prediction 결과가 mastery를 과도하게 벌점화하지 않는다.
- 실제 결과와 side-by-side 비교한다.

## 13. Hint와 Error

Hint는 화면을 대신 조작하지 않는다.

- Level 1: concept question
- Level 2: relevant state highlight
- Level 3: instruction category
- Level 4: operand
- Level 5: partial solution
- Level 6: full solution + self explanation

Error card:

```text
무슨 일이 일어났나요?
어떤 증거가 있나요?
어느 규칙인가요?
지금 무엇을 해볼 수 있나요?
```

오류 색만 보여주지 않고 제목, icon, code annotation, focus target을 제공한다.

## 14. Visual system

### Typography

- 한국어 본문은 높은 x-height와 명확한 숫자 형태를 가진 sans-serif
- code는 `0/O`, `1/l/I` 구분이 좋은 monospace
- address·hex tabular number 사용
- body 16px 이상, line-height 약 1.55–1.75
- 긴 instruction reference는 measure를 제한

### Color token 역할

- `surface`
- `surface-raised`
- `text`
- `text-muted`
- `border`
- `current`
- `read`
- `write`
- `warning`
- `error`
- `success`

read/write/current accent를 콘텐츠 decoration에 재사용하지 않는다.

### Spacing과 density

- 4 또는 8px 기반 spacing scale
- interactive target 최소 24×24 CSS px, 주요 control은 44×44 권장
- state table은 compact하지만 row target과 focus ring을 보존
- panel 사이 hierarchy를 border만이 아니라 spacing으로도 구분

### Motion

- 변화는 150–300ms의 짧은 transition
- layout이 크게 흔들리는 animation 금지
- flashing 금지
- `prefers-reduced-motion`에서는 nonessential transition 제거
- 사이트 내부 “motion off” 설정 제공
- Run animation은 Pause 가능

## 15. Accessibility requirements

### Semantic structure

- heading hierarchy
- landmark: header, nav, main, aside
- memory read view는 native `<table>` 우선
- 실제 cell editing이 필요할 때만 ARIA grid
- form label과 error association
- current lesson과 current tab programmatic state

### Keyboard

- 모든 control 접근
- logical focus order
- visible focus
- skip link
- modal focus trap과 restore
- tab switch keyboard pattern
- memory address jump
- drag-only interaction 금지
- Parsons에는 선택 후 위/아래 이동 button 제공

### Screen reader

Step 후 `role="status"`에 atomic summary:

> PC 0x1004. t0가 4에서 5로 변경됨. 메모리 변화 없음.

Run 중에는 매 event를 announce하지 않는다.

- Run started
- breakpoint/watchpoint
- trap
- paused
- final summarized changes

상세 trace는 사용자가 탐색한다.

### Color와 contrast

- 일반 text 4.5:1
- large text 3:1
- UI boundary와 의미 있는 graphic 3:1
- high-contrast/forced-colors에서 focus와 state 유지
- 색을 제거해도 current/read/write/error를 구분 가능

### Reflow와 zoom

- 320 CSS px에서 핵심 content reflow
- 200–400% zoom
- sticky control이 focus element를 가리지 않음
- code와 table을 제외한 page horizontal scroll 없음

### Cognitive accessibility

- 한 화면의 선택 수 제한
- instruction explanation 구조 일관성
- 명확한 undo
- 예상 실행 시간과 instruction budget
- jargon 첫 등장 설명
- user-controlled pace
- progress reason 제공

## 16. Responsive test matrix

| 환경 | 핵심 확인 |
|---|---|
| 320px mobile | tabs, sticky controls, code/table 자체 scroll |
| 768px tablet | split layout, touch targets, orientation |
| 1280px desktop | lesson+lab 동시성, panel focus |
| 1600px wide | 과도하게 긴 line과 빈 공간 방지 |
| 200–400% zoom | reflow, focus visibility |
| forced colors | state cue와 controls |
| reduced motion | 의미 손실 없음 |

## 17. Manual accessibility QA

- keyboard-only: 홈→lesson→prediction→Step→exercise→submit
- VoiceOver+Safari
- NVDA+Chrome 또는 Firefox
- touch-only
- zoom
- high contrast
- reduced motion
- screen reader에서 memory address jump와 change log 탐색

자동 검사 통과만으로 완료하지 않는다.

## 18. 사용자 테스트 task

### Task A: 첫 instruction

사용자가 다음 register 값을 예측하고 Step 후 변화 이유를 설명한다.

### Task B: 주소와 값

`addi`와 `lw` 중 목표에 맞는 것을 선택한다.

### Task C: signed load

effective address, read byte, extended value를 예측한다.

### Task D: loop bug

trace에서 최초의 잘못된 branch를 찾는다.

### Task E: keyboard·screen reader

pointer 없이 memory change를 확인하고 Back한다.

관찰:

- 무엇을 먼저 보는가?
- current state를 잃는가?
- animation이 원인을 설명하는가, 방해하는가?
- panel 간 이동이 개념 연결을 돕는가?
- 시각화 없이 다시 설명할 수 있는가?

## 19. 완료 기준

- first viewport에서 제품의 실제 학습 상호작용이 보인다.
- lesson에 필요한 state만 기본 노출된다.
- source, instruction, state, trace의 current step이 일치한다.
- mobile에서도 Step/Back과 핵심 state 확인이 가능하다.
- keyboard와 screen reader로 핵심 flow를 완료한다.
- color와 motion 없이도 의미가 보존된다.
- error와 hint가 구체적 evidence와 next action을 제공한다.
- 사용자 테스트에서 address/value와 endian explanation이 개선된다.

## 20. 공식 접근성 참고

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/)
- [ARIA Table Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/)
- [ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [Complex Images](https://www.w3.org/WAI/tutorials/images/complex/)
- [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
- [Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- [Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions)
