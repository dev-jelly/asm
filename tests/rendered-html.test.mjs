import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

// 정적 export(output: 'export')에서는 빌드 결과물인 dist/client/index.html이
// 곧 렌더링 결과다. SSR 서버 번들의 worker.fetch 시그니처에 의존하지 않고
// 빌드 타임에 프리렌더된 정적 HTML을 직접 읽어 동일한 계약을 검증한다.
async function render() {
  const html = await readFile(
    new URL("../dist/client/index.html", import.meta.url),
    "utf8",
  );

  return {
    status: 200,
    headers: { get: () => "text/html" },
    text: async () => html,
  };
}

test("server-renders the Korean product home and real learning interaction", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="ko"/i);
  assert.match(html, /<title>ASM LAB \| 상태 변화로 배우는 RV32I<\/title>/i);
  assert.match(html, /메모리는 바이트 단위로 움직입니다/);
  assert.equal(html.match(/<h1\b/gi)?.length, 1);
  assert.match(html, /addi x5, x0, 7/);
  assert.match(html, /PC는 다음 명령어를 가리킵니다/);
  assert.match(html, /현재 명령어/);
  assert.match(html, /레지스터/);
  assert.match(html, /주소와 메모리/);
  assert.match(html, /분기와 반복/);
  assert.match(html, /코드 직접 편집/);
  assert.match(html, /다음 Step에서 가장 중요한 변화/);
  assert.match(html, /잘 모르겠어요\. 결과 보기/);
  assert.match(html, /시각화를 줄인 새 문제로 확인합니다/);
  assert.match(html, /핵심 단계의 결과를 확인하고 프로그램을 완료/);
  assert.match(html, /로그인 없이 시작/);
  assert.match(html, /<button[^>]*disabled[^>]*>Step<\/button>/i);
  assert.match(html, /명령어를 실행할 초기 상태를 준비/);
  assert.match(html, /로그인 없이 이 브라우저에 저장합니다/);
  assert.doesNotMatch(
    html,
    /class="hero"|첫 예측 시작하기|Scroll to explore|Scroll to walk|스크롤하세요/i,
  );
  assert.doesNotMatch(html, /class="eyebrow"/i);
  assert.doesNotMatch(html, /RV32I EDU v1|교육용 프로필 v1/i);
});

test("primary navigation resolves to real in-page destinations", async () => {
  const html = await (await render()).text();
  const destinations = [
    ["#learn", "learn"],
    ["#practice", "practice"],
    ["#playground", "playground"],
    ["#reference", "reference"],
    ["#progress", "progress"],
  ];

  for (const [href, id] of destinations) {
    assert.match(html, new RegExp(`href="${href}"`));
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test("state, accessibility, and lifecycle contracts are present in product source", async () => {
  const [
    lab,
    stateView,
    memoryVisualizer,
    timeline,
    hook,
    controls,
    predictionGate,
    predictionComparison,
    missionNavigator,
    missionTransfer,
    missionCatalog,
    progressPanel,
    css,
    layout,
    page,
    packageJson,
  ] =
    await Promise.all([
      readFile(new URL("../app/components/LearningLab.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/components/MachineStateView.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/components/MemoryVisualizer.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/components/ExecutionTimeline.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/hooks/useRv32iWorker.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../app/components/LabControls.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/components/PredictionGate.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../app/components/PredictionComparison.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../app/components/MissionNavigator.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/components/MissionTransfer.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/content/memoryMissions.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/components/ProgressPanel.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
    ]);

  assert.match(stateView, /현재 코드/);
  assert.match(stateView, />PC</);
  assert.match(stateView, /현재 인코딩/);
  assert.match(stateView, />레지스터</);
  assert.match(stateView, /<MemoryVisualizer/);
  assert.match(stateView, /상태 변화/);
  assert.equal(stateView.match(/role="region"/g)?.length, 1);
  assert.equal(stateView.match(/tabIndex=\{0\}/g)?.length, 1);
  assert.match(stateView, /aria-labelledby="register-title"/);
  assert.match(memoryVisualizer, /메모리 지도/);
  assert.match(memoryVisualizer, /memoryInitialized/);
  assert.match(memoryVisualizer, /data-unit-size/);
  assert.match(memoryVisualizer, /role="group"/);
  assert.match(memoryVisualizer, /aria-invalid/);
  assert.match(memoryVisualizer, /ArrowRight/);
  assert.match(memoryVisualizer, /Home/);
  assert.match(memoryVisualizer, /littleEndianExplanation/);
  assert.match(timeline, /aria-pressed/);
  assert.match(timeline, /실행 기록/);

  assert.equal(lab.match(/aria-live="polite"/g)?.length, 1);
  assert.match(lab, /stepIndex: currentStepIndex/);
  assert.match(lab, /expectedPrediction\(instruction,\s*checkpoint\)/);
  assert.match(lab, /lab\.trace\.find/);
  assert.match(lab, /delta\.stepIndexBefore === submittedPrediction\.stepIndex/);
  assert.ok(
    lab.indexOf("<LabControls") <
      lab.indexOf('<div className="lab-state-panel">'),
  );
  assert.ok(
    lab.indexOf("lab.error ?") <
      lab.indexOf('visibleStatus === "loading" || !visibleSnapshot'),
  );
  assert.match(lab, /lab\.programReady/);
  assert.match(lab, /setProgramRequestId/);
  assert.match(lab, /source === selectedMission\.source/);
  assert.match(lab, /getMemoryMission/);
  assert.match(lab, /searchParams\.get\("lesson"\)/);
  assert.match(lab, /window\.addEventListener\("popstate"/);
  assert.match(lab, /window\.history\.pushState/);
  assert.match(lab, /checkpointAttempted/);
  assert.match(lab, /markLocalMissionProgress/);
  assert.match(lab, /status:\s*"independent"/);
  assert.equal(lab.match(/useRv32iWorker\(/g)?.length, 1);

  assert.match(hook, /new Worker/);
  assert.match(hook, /worker\.terminate\(\)/);
  assert.match(hook, /messageerror/);
  assert.match(hook, /isWorkerResponse/);
  assert.match(hook, /setLoadedRequestId\(requestId\)/);
  assert.match(hook, /workerRef\.current !== worker/);
  assert.match(hook, /retry/);
  assert.match(hook, /pendingCommandIdRef/);
  assert.match(hook, /commandPending/);
  assert.match(hook, /appendTrace\(current, committedDeltas\)/);
  assert.match(hook, /if \(response\.reason === "run-chunk"\) return/);
  assert.match(hook, /summarizeDeltaBatch/);
  assert.ok(
    hook.indexOf("setTrace((current) => appendTrace(current, committedDeltas))") <
      hook.indexOf('setStatus("error")'),
  );

  assert.match(controls, /<fieldset className="lab-controls">/);
  assert.match(controls, /canRun/);
  assert.match(controls, /runLockedReason/);
  assert.doesNotMatch(controls, /aria-label=/);
  assert.ok(
    controls.indexOf('className="run-confirmation"') <
      controls.indexOf("onClick={onRun}"),
  );
  for (const visibleName of ["Back", "Pause", "Reset"]) {
    assert.match(controls, new RegExp(`>\\s*${visibleName}\\s*<`));
  }

  assert.match(predictionGate, /aria-describedby="prediction-help"/);
  assert.doesNotMatch(predictionGate, /aria-pressed/);
  assert.match(predictionGate, /checkpoint\?\.choices/);
  assert.match(predictionGate, /checkpoint\?\.prompt/);
  assert.match(predictionGate, /메모리 주소에 값을 씁니다/);
  assert.match(predictionGate, /PC만 다음 명령어로 이동합니다/);
  assert.match(predictionGate, /잘 모르겠어요\. 결과 보기/);

  assert.match(predictionComparison, /예측과 실제 변화/);
  assert.match(predictionComparison, /data-result=/);
  assert.match(predictionComparison, /describeDelta/);
  assert.match(missionNavigator, /aria-label="RV32I 학습 모듈"/);
  assert.match(missionNavigator, /aria-label="현재 모듈의 학습 미션"/);
  assert.match(missionNavigator, /aria-current=\{selected \? "step"/);
  assert.match(missionTransfer, /id="practice"/);
  assert.match(missionTransfer, /독립 문제 확인/);
  assert.match(missionTransfer, /aria-live="polite"/);
  assert.match(missionTransfer, /nextMissionId/);

  const missionIds = [
    "pc-next",
    "x-zero-wrap",
    "memory-address-value",
    "memory-store-byte",
    "memory-little-endian",
    "memory-partial-store",
    "memory-signed-loads",
    "branch-memory-loop",
  ];
  assert.equal(missionCatalog.match(/^    id: "/gm)?.length, missionIds.length);
  for (const missionId of missionIds) {
    assert.match(missionCatalog, new RegExp(`"${missionId}"`));
  }

  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /color-scheme:\s*light dark/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /button:active:not\(:disabled\)/);
  assert.match(css, /--border-strong:\s*#858178/);
  assert.match(css, /\.mission-navigation/);
  assert.match(css, /\.module-switcher/);
  assert.match(css, /\.mission-switcher/);
  assert.match(css, /\.mission-transfer/);
  assert.match(css, /\.site-footer a[\s\S]*min-height:\s*44px/);
  assert.match(css, /grid-template-areas:[\s\S]*"source state"[\s\S]*"controls state"/);
  assert.match(
    css,
    /@media \(max-width:\s*760px\)[\s\S]*\.lab-controls \{[\s\S]*position:\s*static/,
  );
  assert.doesNotMatch(css, /#fff(?:fff)?\b/i);

  assert.match(layout, /<html lang="ko">/);
  assert.equal(
    [page, lab].reduce(
      (count, source) => count + (source.match(/<h1\b/g)?.length ?? 0),
      0,
    ),
    1,
  );
  assert.doesNotMatch(page, /className="hero"|className="eyebrow"/);
  assert.equal(page.match(/<LearningLab/g)?.length, 1);
  assert.doesNotMatch(page, /AddressValueLesson/);
  assert.match(page, /role="region"[\s\S]*tabIndex=\{0\}[\s\S]*aria-labelledby="reference-title"/);
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview|_sites-preview/);
  const visibleCopySources = [
    page,
    lab,
    stateView,
    memoryVisualizer,
    timeline,
    controls,
    predictionGate,
    predictionComparison,
    missionNavigator,
    missionTransfer,
    progressPanel,
  ].join("\n");
  assert.doesNotMatch(visibleCopySources, /[—–]/);
  assert.doesNotMatch(
    visibleCopySources,
    /before to after|결정적인 machine state|tracer bullet|local progress|접근 가능한/,
  );
  assert.doesNotMatch(visibleCopySources, /className="eyebrow"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|site-creator-vinext-starter/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  await assert.rejects(
    access(
      new URL("../app/components/AddressValueLesson.tsx", import.meta.url),
    ),
  );
  await access(new URL("../app/workers/rv32i.worker.ts", import.meta.url));
  await access(root);
});
