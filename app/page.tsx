import { AddressValueLesson } from "./components/AddressValueLesson";
import { LearningLab } from "./components/LearningLab";
import { ProgressPanel } from "./components/ProgressPanel";

// 정적 export(GitHub Pages)에서 이 라우트가 항상 빌드타임에 프리렌더되도록 보장.
// vinext는 segment config이 없으면 라우트를 "unknown"으로 분류해 프리렌더에서
// 건너뛸 수 있으므로, 단일 페이지를 명시적으로 static으로 고정한다.
export const dynamic = "force-static";

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        본문으로 바로가기
      </a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="ASM LAB 홈">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <span>ASM LAB</span>
        </a>
        <nav className="site-nav" aria-label="주요 탐색">
          <ul>
            <li>
              <a href="#learn">배우기</a>
            </li>
            <li>
              <a href="#practice">연습</a>
            </li>
            <li>
              <a href="#playground">플레이그라운드</a>
            </li>
            <li>
              <a href="#reference">사전</a>
            </li>
            <li>
              <a href="#progress">진도</a>
            </li>
          </ul>
        </nav>
        <span className="profile-label">RV32I 학습 모드</span>
      </header>

      <main id="main-content">
        <div id="top" className="top-anchor">
          <div id="playground" className="anchor-section lab-anchor">
            <LearningLab />
          </div>
        </div>

        <section className="content-section curriculum" id="learn" aria-labelledby="learn-title">
          <div className="section-lead">
            <h2 id="learn-title">작은 상태 변화에서 실제 프로그램까지.</h2>
            <p>
              명령어를 먼저 외우지 않습니다. 한 번에 하나의 개념을 익히고,
              도움을 줄인 새 문제에서 다시 확인합니다.
            </p>
          </div>
          <ol className="curriculum-path">
            <li>
              <span className="path-marker" aria-hidden="true">
                PC
              </span>
              <div>
                <h3>CPU가 보는 현재 상태</h3>
                <p>PC, 레지스터, 32비트 인코딩을 한 줄의 코드와 연결합니다.</p>
              </div>
              <strong>현재 실험</strong>
            </li>
            <li>
              <span className="path-marker" aria-hidden="true">
                x
              </span>
              <div>
                <h3>레지스터와 32비트 산술</h3>
                <p>x0의 고정값과 32비트 범위를 넘는 계산 결과를 확인합니다.</p>
              </div>
              <strong>다음 경로</strong>
            </li>
            <li>
              <span className="path-marker" aria-hidden="true">
                M
              </span>
              <div>
                <h3>주소와 메모리</h3>
                <p>유효 주소, 바이트 순서, load와 store의 차이를 구분합니다.</p>
              </div>
              <strong>현재 경로</strong>
            </li>
            <li>
              <span className="path-marker" aria-hidden="true">
                B
              </span>
              <div>
                <h3>분기와 반복</h3>
                <p>비교 결과와 다음 PC를 예측해 실행 흐름을 추적합니다.</p>
              </div>
              <strong>현재 경로</strong>
            </li>
          </ol>
        </section>

        <section className="content-section practice-section" id="practice" aria-labelledby="practice-title">
          <AddressValueLesson />
        </section>

        <section className="content-section reference-section" id="reference" aria-labelledby="reference-title">
          <div className="section-lead">
            <h2 id="reference-title">이 실험실이 지원하는 네 가지 명령어.</h2>
            <p>
              첫 실습은 RV32I 전체가 아닌 교육용 명령어 네 개를 사용합니다.
              명령어의 표준 의미와 이 실험실의 실행 정책을 구분해 표시합니다.
            </p>
          </div>
          <div
            className="table-scroll reference-table"
            role="region"
            tabIndex={0}
            aria-labelledby="reference-title"
          >
            <table>
              <caption className="sr-only">
                지원 명령어의 문법과 상태 변화
              </caption>
              <thead>
                <tr>
                  <th scope="col">명령어</th>
                  <th scope="col">표준 문법</th>
                  <th scope="col">읽기</th>
                  <th scope="col">쓰기</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    <code>addi</code>
                  </th>
                  <td>
                    <code>addi rd, rs1, imm</code>
                  </td>
                  <td>rs1, 부호 있는 12비트 즉시값</td>
                  <td>rd</td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>lw</code>
                  </th>
                  <td>
                    <code>lw rd, offset(rs1)</code>
                  </td>
                  <td>rs1, 메모리 4바이트</td>
                  <td>rd</td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>sw</code>
                  </th>
                  <td>
                    <code>sw rs2, offset(rs1)</code>
                  </td>
                  <td>rs1, rs2</td>
                  <td>메모리 4바이트</td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>beq</code>
                  </th>
                  <td>
                    <code>beq rs1, rs2, label</code>
                  </td>
                  <td>rs1, rs2</td>
                  <td>조건이 참이면 PC</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="scope-note">
            <strong>실험실 실행 정책:</strong> 데이터 메모리는{" "}
            <code>0x00001000</code>부터 4 KiB이며, <code>lw</code>와{" "}
            <code>sw</code>는 4바이트 정렬을 요구합니다. 32비트 워드는 낮은
            주소부터 하위 바이트를 읽고 씁니다.
          </p>
        </section>

        <section className="content-section progress-section" id="progress" aria-labelledby="progress-title">
          <ProgressPanel />
        </section>
      </main>

      <footer className="site-footer">
        <p>
          ASM LAB은 RV32I 명령어 네 개로 상태 변화를 가르치는 학습
          실험실입니다.
        </p>
        <div>
          <a href="#learn">학습 경로</a>
          <a href="#reference">지원 범위</a>
          <a href="#top">맨 위로</a>
        </div>
      </footer>
    </>
  );
}
