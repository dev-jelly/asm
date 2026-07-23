import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Korean product home and real learning interaction", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="ko"/i);
  assert.match(html, /<title>ASM LAB \| 상태 변화로 배우는 RV32I<\/title>/i);
  assert.match(html, /실행 전에 다음 상태를 예측하세요/);
  assert.equal(html.match(/<h1\b/gi)?.length, 1);
  assert.match(html, /addi x5, x0, 7/);
  assert.match(html, /다음 Step에서 가장 중요한 변화/);
  assert.match(html, /잘 모르겠어요\. 결과 보기/);
  assert.match(html, /로그인 없이 시작/);
  assert.match(html, /<button[^>]*disabled[^>]*>Step<\/button>/i);
  assert.match(html, /명령어를 실행할 초기 상태를 준비/);
  assert.match(html, /같은 x10을 읽어도 결과는 다릅니다/);
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
    hook,
    controls,
    predictionGate,
    addressLesson,
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
        new URL("../app/components/AddressValueLesson.tsx", import.meta.url),
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
  assert.match(stateView, />메모리</);
  assert.match(stateView, /상태 변화/);
  assert.equal(stateView.match(/role="region"/g)?.length, 2);
  assert.equal(stateView.match(/tabIndex=\{0\}/g)?.length, 2);
  assert.match(stateView, /aria-labelledby="register-title"/);
  assert.match(stateView, /aria-labelledby="memory-title"/);

  assert.equal(lab.match(/aria-live="polite"/g)?.length, 1);
  assert.match(lab, /stepIndex: currentStepIndex/);
  assert.match(lab, /expected: expectedPrediction\(instruction\)/);
  assert.match(lab, /lab\.trace\.find/);
  assert.match(lab, /delta\.stepIndexBefore === submittedPrediction\.stepIndex/);
  assert.ok(
    lab.indexOf("<LabControls") <
      lab.indexOf('<div className="lab-state-panel">'),
  );
  assert.ok(
    lab.indexOf("lab.error ?") <
      lab.indexOf('lab.status === "loading" || !lab.snapshot'),
  );

  assert.match(hook, /new Worker/);
  assert.match(hook, /worker\.terminate\(\)/);
  assert.match(hook, /appendTrace\(current, committedDeltas\)/);
  assert.match(hook, /if \(response\.reason === "run-chunk"\) return/);
  assert.match(hook, /summarizeDeltaBatch/);
  assert.ok(
    hook.indexOf("setTrace((current) => appendTrace(current, committedDeltas))") <
      hook.indexOf('setStatus("error")'),
  );

  assert.match(controls, /<fieldset className="lab-controls">/);
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
  assert.match(predictionGate, /메모리 주소에 4바이트를 씁니다/);
  assert.match(predictionGate, /PC만 다음 명령어로 이동합니다/);
  assert.match(predictionGate, /잘 모르겠어요\. 결과 보기/);

  assert.match(addressLesson, /value="unsure"/);
  assert.match(addressLesson, /submittedPrediction !== null/);
  assert.match(addressLesson, /aria-live="polite"/);
  assert.match(addressLesson, /정답은 x5가 주소, x6가 값입니다/);
  assert.doesNotMatch(addressLesson, /className=\{\s*prediction/);

  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /color-scheme:\s*light dark/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /button:active:not\(:disabled\)/);
  assert.match(css, /--border-strong:\s*#858178/);
  assert.match(css, /\.site-footer a[\s\S]*min-height:\s*44px/);
  assert.match(css, /grid-template-areas:[\s\S]*"source state"[\s\S]*"controls state"/);
  assert.match(css, /\.lab-controls \{[\s\S]*position:\s*sticky/);
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
  assert.match(page, /role="region"[\s\S]*tabIndex=\{0\}[\s\S]*aria-labelledby="reference-title"/);
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview|_sites-preview/);
  const visibleCopySources = [
    page,
    lab,
    stateView,
    controls,
    predictionGate,
    addressLesson,
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
  await access(new URL("../app/workers/rv32i.worker.ts", import.meta.url));
  await access(root);
});
