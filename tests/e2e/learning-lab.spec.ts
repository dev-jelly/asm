import { expect, test, type Page } from "@playwright/test";

const LAB = ".learning-lab";

function learningLab(page: Page) {
  return page.locator(LAB);
}

function predictionGate(page: Page) {
  return learningLab(page).locator(".prediction-gate");
}

async function openLesson(page: Page, lessonId: string) {
  await page.goto(`./?lesson=${lessonId}#playground`);
  await expect(learningLab(page).getByText("상태: 예측 대기")).toBeVisible();
}

async function loadCustomProgram(page: Page, source: string) {
  await learningLab(page).getByText("코드 직접 편집").click();
  await learningLab(page).getByLabel(/RV32I 소스/).fill(source);
  await learningLab(page)
    .getByRole("button", { name: "프로그램 불러오기", exact: true })
    .click();
  await expect(learningLab(page).getByText("상태: 예측 대기")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(learningLab(page).getByText("상태: 예측 대기")).toBeVisible();
});

test("필수 예측 뒤 Step, Back, Reset이 상태와 checkpoint를 되돌린다", async ({
  page,
}) => {
  const lab = learningLab(page);
  const gate = predictionGate(page);

  await gate.getByLabel("0x00000004", { exact: true }).check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();

  await expect(lab.getByText("Step 1", { exact: true }).first()).toBeVisible();
  await expect(lab.getByText("예측 일치", { exact: true })).toBeVisible();
  await expect(
    lab.getByRole("button", { name: "Back", exact: true }),
  ).toBeEnabled();

  await lab.getByRole("button", { name: "Back", exact: true }).click();
  await expect(lab.getByText("아직 실행 기록이 없습니다.")).toBeVisible();
  await expect(
    lab.getByLabel("실행할 RV32I 프로그램").getByText("addi x5, x0, 7"),
  ).toBeVisible();

  await lab.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(gate.getByLabel("0x00000004", { exact: true })).not.toBeChecked();
  await expect(
    lab.getByRole("button", { name: "Run", exact: true }),
  ).toBeDisabled();
  await expect(lab.getByText("상태: 예측 대기")).toBeVisible();
});

test("빠른 이중 Step도 한 명령어만 실행하고 checkpoint를 건너뛰지 않는다", async ({
  page,
}) => {
  await openLesson(page, "memory-address-value");
  const lab = learningLab(page);
  await predictionGate(page)
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();

  await lab.evaluate((element) => {
    const step = [...element.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Step",
    );
    if (!step) throw new Error("Step button not found");
    step.click();
    step.click();
  });

  await expect(
    predictionGate(page).getByText(
      "2행까지 실행했을 때 x5와 x6에는 무엇이 있을까요?",
    ),
  ).toBeVisible();
  await expect(lab.getByText("상태: 예측 대기")).toBeVisible();
  await expect(lab.getByText("Step 1", { exact: true }).first()).toBeVisible();
  await expect(lab.getByText("Step 2", { exact: true })).toHaveCount(0);
});

test("페이지에는 RV32I Worker가 하나뿐이며 중단 뒤 현재 미션을 복구한다", async ({
  page,
}) => {
  const activeWorkers = page
    .workers()
    .filter((candidate) => candidate.url().includes("rv32i.worker"));
  expect(activeWorkers).toHaveLength(1);

  await activeWorkers[0].evaluate(() => {
    setTimeout(() => {
      throw new Error("intentional E2E worker crash");
    }, 0);
  });

  const alert = learningLab(page).getByRole("alert");
  await expect(alert).toContainText("Worker가 예기치 않게 중단");
  await expect(
    learningLab(page).getByRole("button", {
      name: "Reset",
      exact: true,
    }),
  ).toBeDisabled();

  await alert
    .getByRole("button", { name: "Worker 다시 시작", exact: true })
    .click();
  await expect(learningLab(page).getByText("상태: 예측 대기")).toBeVisible();
  expect(
    page
      .workers()
      .filter((candidate) => candidate.url().includes("rv32i.worker")),
  ).toHaveLength(1);
});

test("lesson deep-link와 브라우저 뒤로가기가 같은 단일 실험실을 전환한다", async ({
  page,
}) => {
  await openLesson(page, "memory-signed-loads");
  const lab = learningLab(page);

  await expect(
    lab.locator(".mission-context").getByRole("heading", {
      name: /부호 확장/,
    }),
  ).toBeVisible();
  await expect(
    lab
      .getByLabel("실행할 RV32I 프로그램")
      .getByText("lb x5, 0(x10)", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/lesson=memory-signed-loads#playground$/);

  await lab
    .getByRole("navigation", { name: "현재 모듈의 학습 미션" })
    .getByRole("button", { name: /부분 store는 이웃 바이트를 보존합니다/ })
    .click();
  await expect(page).toHaveURL(/lesson=memory-partial-store#playground$/);
  await expect(
    lab.locator(".mission-context").getByRole("heading", {
      name: "부분 store는 이웃 바이트를 보존합니다",
      exact: true,
    }),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/lesson=memory-signed-loads#playground$/);
  await expect(
    lab.locator(".mission-context").getByRole("heading", {
      name: /부호 확장/,
    }),
  ).toBeVisible();
  expect(
    page
      .workers()
      .filter((candidate) => candidate.url().includes("rv32i.worker")),
  ).toHaveLength(1);
});

test("저장된 마지막 미션과 잘못된 lesson URL을 canonical history로 정리한다", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "asm-lab-progress",
      JSON.stringify({
        version: 2,
        missions: {},
        lastMissionId: "memory-store-byte",
      }),
    );
  });
  await page.goto("./");
  await expect(
    learningLab(page).locator(".mission-context").getByRole("heading", {
      name: "sb는 한 바이트만 바꿉니다",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/lesson=memory-store-byte#playground$/);

  await learningLab(page)
    .getByRole("navigation", { name: "RV32I 학습 모듈" })
    .getByRole("button", { name: /현재 명령어/ })
    .click();
  await expect(page).toHaveURL(/lesson=pc-next#playground$/);
  await page.goBack();
  await expect(page).toHaveURL(/lesson=memory-store-byte#playground$/);

  await page.goto("./?lesson=unknown");
  await expect(
    learningLab(page).locator(".mission-context").getByRole("heading", {
      name: "PC는 다음 명령어를 가리킵니다",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/lesson=pc-next#playground$/);
});

test("signed load 미션은 checkpoint 예측과 실제 부호 확장을 비교한다", async ({
  page,
}) => {
  await openLesson(page, "memory-signed-loads");
  const lab = learningLab(page);
  const gate = predictionGate(page);

  await gate.getByLabel("0xffffff80", { exact: true }).check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();

  await expect(lab.getByText("예측 일치", { exact: true })).toBeVisible();
  await expect(lab.getByText("0xffffff80").first()).toBeVisible();
  await expect(lab.getByText(/읽기 0x00001000 \(1B\)/)).toBeVisible();

  await gate
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await expect(lab.getByText("상태: 실행 완료")).toBeVisible();
  await expect(lab.getByText("0x00000080").first()).toBeVisible();
});

test("guided 실행과 독립 전이 문제를 별도 진도 증거로 저장한다", async ({
  page,
}) => {
  const lab = learningLab(page);
  const gate = predictionGate(page);

  await gate.getByLabel("0x00000004", { exact: true }).check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("asm-lab-progress");
        return raw ? JSON.parse(raw).missions["pc-next"] : null;
      }),
    )
    .toMatchObject({
      status: "not-started",
      predictionAttempts: 1,
    });
  await gate
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await expect(lab.getByText("상태: 실행 완료")).toBeVisible();

  await lab.getByRole("button", { name: "Reset", exact: true }).click();
  await gate.getByLabel("0x00000004", { exact: true }).check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await gate
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await expect(lab.getByText("상태: 실행 완료")).toBeVisible();

  const transfer = lab.locator(".mission-transfer");
  await transfer.getByLabel("0x0000000c", { exact: true }).check();
  await transfer
    .getByRole("button", { name: "독립 문제 확인", exact: true })
    .click();
  await expect(transfer.getByText("새 문제를 해결했습니다.")).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("asm-lab-progress");
        if (!raw) return null;
        const progress = JSON.parse(raw);
        return {
          version: progress.version,
          mission: progress.missions["pc-next"],
          untouched: progress.missions["x-zero-wrap"],
          lastMissionId: progress.lastMissionId,
        };
      }),
    )
    .toMatchObject({
      version: 2,
      mission: {
        status: "independent",
        predictionAttempts: 2,
        transferPassed: true,
      },
      untouched: {
        status: "not-started",
        predictionAttempts: 0,
        transferPassed: false,
      },
      lastMissionId: "pc-next",
    });

  await expect(page.locator(".progress-summary")).toContainText(
    "시작한 미션 1개, 그중 혼자 해결 1개",
  );
});

test("byte store의 변경 범위와 초기화 상태를 Back과 Reset으로 복원한다", async ({
  page,
}) => {
  await openLesson(page, "memory-store-byte");
  const lab = learningLab(page);

  await predictionGate(page)
    .getByLabel("0x00001001에 0x44", { exact: true })
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await expect(lab.getByText("상태: 실행 완료")).toBeVisible();
  await expect(
    lab.getByRole("button", {
      name: /0x00001001, 1바이트 \(byte\), 값 0x44, 초기화됨, 최근 쓰기/,
    }),
  ).toBeVisible();

  await lab.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    lab.getByRole("button", {
      name: /0x00001001, 1바이트 \(byte\), 값 0xbb, 초기화됨/,
    }),
  ).toBeVisible();

  await lab.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    lab.getByRole("button", {
      name: /0x00001001, 1바이트 \(byte\), 값 0xbb, 초기화됨/,
    }),
  ).toBeVisible();
  await expect(
    predictionGate(page).getByLabel("0x00001001에 0x44", {
      exact: true,
    }),
  ).not.toBeChecked();
});

test("little-endian word 보기, 키보드 셀 이동, 주소 검증이 동작한다", async ({
  page,
}) => {
  await openLesson(page, "memory-little-endian");
  const lab = learningLab(page);

  await predictionGate(page)
    .getByLabel("78 56 34 12", { exact: true })
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await expect(lab.getByText("상태: 실행 완료")).toBeVisible();

  const firstWord = lab.getByRole("button", {
    name: /0x00001000, 4바이트 \(word\), 값 0x12345678/,
  });
  await expect(firstWord).toBeVisible();
  await firstWord.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    lab.getByRole("button", {
      name: /0x00001004, 4바이트 \(word\)/,
    }),
  ).toBeFocused();

  await lab.getByLabel("1바이트 (byte)", { exact: true }).check();
  const firstByte = lab.getByRole("button", {
    name: /0x00001000, 1바이트 \(byte\), 값 0x78/,
  });
  await firstByte.focus();
  await page.keyboard.press("ArrowDown");
  const nextByteAddress =
    (page.viewportSize()?.width ?? 1280) <= 420
      ? "0x00001002"
      : "0x00001004";
  await expect(
    lab.getByRole("button", {
      name: new RegExp(
        `${nextByteAddress}, 1바이트 \\(byte\\)`,
      ),
    }),
  ).toBeFocused();

  await lab.getByLabel("주소 이동").fill("0x9999");
  await lab.getByRole("button", { name: "이동", exact: true }).click();
  await expect(lab.getByRole("alert")).toContainText(
    "0x00001000부터 0x00001fff 사이 주소",
  );
});

test("분기 프로그램은 연속 메모리 쓰기를 끝까지 시각화한다", async ({
  page,
}) => {
  await openLesson(page, "branch-memory-loop");
  const lab = learningLab(page);
  const gate = predictionGate(page);

  await gate
    .getByLabel("조건 비교 결과로 다음 PC가 정해집니다.")
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await gate
    .getByLabel("0x00001000에 0x5a를 씀", { exact: true })
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await gate
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await lab
    .getByLabel("Run은 현재 예측 이후 단계의 확인 과정을 건너뜁니다.")
    .check();
  await lab.getByRole("button", { name: "Run", exact: true }).click();

  await expect(lab.getByText("상태: 실행 완료")).toBeVisible();
  for (const address of [
    "0x00001000",
    "0x00001001",
    "0x00001002",
    "0x00001003",
  ]) {
    await expect(
      lab.getByRole("button", {
        name: new RegExp(
          `${address}, 1바이트 \\(byte\\), 값 0x5a, 초기화됨`,
        ),
      }),
    ).toBeVisible();
  }
  await expect(
    lab.getByRole("button", {
      name: /0x00001003, 1바이트 \(byte\), 값 0x5a, 초기화됨, 최근 쓰기/,
    }),
  ).toBeVisible();
});

test("무한 분기 사용자 코드는 Run 중 실제 Pause가 가능하다", async ({
  page,
}) => {
  const lab = learningLab(page);
  await loadCustomProgram(page, "loop: beq x0, x0, loop");

  await predictionGate(page)
    .getByLabel("조건 비교 결과로 다음 PC가 정해집니다.")
    .check();
  await lab
    .getByLabel("Run은 현재 예측 이후 단계의 확인 과정을 건너뜁니다.")
    .check();

  await lab.evaluate((element) => {
    const pause = [...element.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Pause",
    );
    if (!pause) throw new Error("Pause button not found");
    const clickWhenEnabled = () => {
      if (pause.disabled) return;
      observer.disconnect();
      pause.click();
    };
    const observer = new MutationObserver(clickWhenEnabled);
    observer.observe(pause, {
      attributes: true,
      attributeFilter: ["disabled"],
    });
    clickWhenEnabled();
  });
  await lab.getByRole("button", { name: "Run", exact: true }).click();
  await expect(lab.getByText("상태: 일시정지")).toBeVisible();
});

test("잘못 정렬된 사용자 코드를 오류 뒤 현재 미션으로 복원한다", async ({
  page,
}) => {
  const lab = learningLab(page);
  await loadCustomProgram(page, "lh x5, 1(x10)");

  await predictionGate(page)
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await expect(lab.getByRole("alert")).toContainText(
    "2바이트 halfword 경계",
  );

  await lab
    .getByRole("alert")
    .getByRole("button", { name: "미션으로 복원", exact: true })
    .click();
  await expect(lab.getByText("상태: 예측 대기")).toBeVisible();
  await expect(
    lab.getByLabel("실행할 RV32I 프로그램").getByText("addi x5, x0, 7"),
  ).toBeVisible();
});

test("초기화되지 않은 load를 값이 아니라 경고와 backing byte로 설명한다", async ({
  page,
}) => {
  const lab = learningLab(page);
  await loadCustomProgram(page, "lb x5, 0(x10)");

  await predictionGate(page)
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();

  await expect(lab.getByText("주의:", { exact: true })).toBeVisible();
  await expect(lab.locator(".delta-view").getByText(/backing byte/)).toBeVisible();
});

test("사용자 코드 완료는 선택된 미션의 학습 진도를 만들지 않는다", async ({
  page,
}) => {
  const lab = learningLab(page);
  await loadCustomProgram(page, "addi x5, x0, 1");

  await predictionGate(page)
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await expect(lab.getByText("상태: 실행 완료")).toBeVisible();

  expect(
    await page.evaluate(() => {
      const raw = localStorage.getItem("asm-lab-progress");
      if (!raw) return "not-started";
      return JSON.parse(raw).missions["pc-next"].status;
    }),
  ).toBe("not-started");
});

test("모듈 탐색은 focus를 보존하고 모바일에서도 가로 overflow를 만들지 않는다", async ({
  page,
}) => {
  const modules = learningLab(page).getByRole("navigation", {
    name: "RV32I 학습 모듈",
  });
  await expect(modules.getByRole("button")).toHaveCount(4);

  const memoryModule = modules.getByRole("button", {
    name: /주소와 메모리/,
  });
  await memoryModule.click();
  await expect(memoryModule).toBeFocused();
  await expect(page).toHaveURL(/lesson=memory-address-value#playground$/);
  await expect(
    learningLab(page)
      .getByRole("navigation", { name: "현재 모듈의 학습 미션" })
      .getByRole("button"),
  ).toHaveCount(5);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("다크 모드와 모션 감소 환경을 따른다", async ({ page }) => {
  await page.emulateMedia({
    colorScheme: "dark",
    reducedMotion: "reduce",
    forcedColors: "none",
  });
  await page.reload();
  await expect(learningLab(page).getByText("상태: 예측 대기")).toBeVisible();

  const preferences = await page.evaluate(() => {
    const bodyStyle = getComputedStyle(document.body);
    const htmlStyle = getComputedStyle(document.documentElement);
    return {
      background: bodyStyle.backgroundColor,
      foreground: bodyStyle.color,
      scrollBehavior: htmlStyle.scrollBehavior,
      dark: matchMedia("(prefers-color-scheme: dark)").matches,
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  });

  expect(preferences.dark).toBe(true);
  expect(preferences.reduced).toBe(true);
  expect(preferences.background).toBe("rgb(25, 26, 24)");
  expect(preferences.foreground).toBe("rgb(240, 238, 231)");
  expect(preferences.scrollBehavior).toBe("auto");
});

test("v2 기기 진도를 JSON으로 내보낸다", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "진도 내보내기" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("asm-lab-progress.json");
});
