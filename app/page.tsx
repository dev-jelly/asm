import { Badge } from "@astryxdesign/core/Badge";
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
        <Badge label="RV32I 학습 모드" variant="teal" />
      </header>

      <main id="main-content">
        <div id="top" className="top-anchor">
          <div className="anchor-section lab-anchor">
            <LearningLab />
          </div>
        </div>

        <section className="content-section reference-section" id="reference" aria-labelledby="reference-title">
          <div className="section-lead">
            <h2 id="reference-title">폭과 부호가 다른 열 가지 명령어.</h2>
            <p>
              산술과 분기, 1, 2, 4바이트 메모리 접근을 한 실행 모델에서
              비교합니다. 모든 load와 store는 범위와 정렬을 검사합니다.
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
                    <code>lb / lbu</code>
                  </th>
                  <td>
                    <code>lb rd, offset(rs1)</code>
                  </td>
                  <td>rs1, 메모리 1바이트</td>
                  <td>rd, 부호 확장 또는 0 확장</td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>lh / lhu</code>
                  </th>
                  <td>
                    <code>lh rd, offset(rs1)</code>
                  </td>
                  <td>rs1, 메모리 2바이트</td>
                  <td>rd, 부호 확장 또는 0 확장</td>
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
                    <code>sb</code>
                  </th>
                  <td>
                    <code>sb rs2, offset(rs1)</code>
                  </td>
                  <td>rs1, rs2의 하위 1바이트</td>
                  <td>메모리 1바이트</td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>sh</code>
                  </th>
                  <td>
                    <code>sh rs2, offset(rs1)</code>
                  </td>
                  <td>rs1, rs2의 하위 2바이트</td>
                  <td>메모리 2바이트</td>
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
            <code>0x00001000</code>부터 4 KiB입니다. halfword는 2바이트,
            word는 4바이트 정렬을 요구합니다. 여러 바이트 값은 낮은 주소부터
            하위 바이트를 읽고 쓰며, 초기화되지 않은 byte도 별도로 표시합니다.
          </p>
        </section>

        <section className="content-section progress-section" id="progress" aria-labelledby="progress-title">
          <ProgressPanel />
        </section>
      </main>

      <footer className="site-footer">
        <p>
          ASM LAB은 RV32I의 PC, 레지스터, 메모리, 분기 상태 변화를
          가르치는 브라우저 학습 실험실입니다.
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
