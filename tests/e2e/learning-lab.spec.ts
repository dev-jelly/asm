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

async function completePcMission(page: Page) {
  const lab = learningLab(page);
  const gate = predictionGate(page);

  await gate.getByLabel("0x00000004", { exact: true }).check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await gate
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await expect(lab.getByText("상태: 실행 완료")).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
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

test("완료 뒤에도 핵심 checkpoint 피드백을 보존하고 Back은 직전 delta로 복원한다", async ({
  page,
}) => {
  const lab = learningLab(page);
  const gate = predictionGate(page);

  await completePcMission(page);
  await expect(
    gate.getByText("1행을 실행한 직후 PC는 어디를 가리킬까요?"),
  ).toBeVisible();
  await expect(gate.getByLabel("0x00000004", { exact: true })).toBeChecked();
  await expect(lab.getByText("예측 일치", { exact: true })).toBeVisible();
  await expect(lab.locator(".prediction-comparison")).toContainText(
    "RV32I 명령어는 4바이트입니다.",
  );

  await lab.getByRole("button", { name: "Back", exact: true }).click();
  await expect(lab.getByText("상태: 예측 대기")).toBeVisible();
  await expect(lab.locator(".delta-view")).toContainText(
    "addi x5, x0, 7 실행",
  );
  await expect(lab.locator(".delta-view")).toContainText(
    "레지스터 쓰기: x5 0x00000000 → 0x00000007",
  );
  await expect(
    lab
      .locator(".execution-timeline")
      .getByText("Step 1", { exact: true }),
  ).toBeVisible();
  await expect(
    lab
      .locator(".execution-timeline")
      .getByText("Step 2", { exact: true }),
  ).toHaveCount(0);
  await expect(lab.locator(".pc-visualizer")).toContainText("0x00000000");
  await expect(lab.locator(".pc-visualizer")).toContainText("0x00000004");
});

test("예측 라디오의 Alt+S와 Run 체크박스의 Alt+R이 동작하고 결과를 알린다", async ({
  page,
}) => {
  const lab = learningLab(page);
  const gate = predictionGate(page);
  const checkpointAnswer = gate.getByLabel("0x00000004", {
    exact: true,
  });

  await checkpointAnswer.check();
  await expect(checkpointAnswer).toBeFocused();
  await page.keyboard.press("Alt+s");
  await expect(
    lab
      .locator(".execution-timeline")
      .getByText("Step 1", { exact: true }),
  ).toBeVisible();
  await expect(lab.locator(".lab-announcement")).toContainText(
    "예측이 실제 결과와 일치했습니다.",
  );
  await expect(
    gate.getByLabel("목적지 레지스터에 결과를 씁니다."),
  ).toBeFocused();

  await page.keyboard.press("Alt+b");
  await expect(checkpointAnswer).toBeFocused();
  await expect(lab.locator(".lab-announcement")).toContainText(
    "한 단계를 되돌렸습니다.",
  );
  await expect(lab.locator(".lab-announcement")).not.toContainText(
    "예측이 실제 결과와 일치했습니다.",
  );

  await page.keyboard.press("Alt+s");
  await expect(
    gate.getByLabel("목적지 레지스터에 결과를 씁니다."),
  ).toBeFocused();
  const announcementBeforeNextChoice = await lab
    .locator(".lab-announcement")
    .textContent();
  await gate
    .getByLabel("계산한 메모리 주소에 값을 씁니다.")
    .check();
  await expect(lab.locator(".lab-announcement")).toHaveText(
    announcementBeforeNextChoice ?? "",
  );
  const runConfirmation = lab.getByLabel(
    "Run은 현재 예측 이후 단계의 확인 과정을 건너뜁니다.",
  );
  await runConfirmation.check();
  await expect(runConfirmation).toBeFocused();
  await lab.locator(".lab-announcement").evaluate((element) => {
    const testWindow = window as Window & {
      __asmLiveMessages?: string[];
    };
    testWindow.__asmLiveMessages = [];
    new MutationObserver(() => {
      testWindow.__asmLiveMessages?.push(
        element.textContent?.trim() ?? "",
      );
    }).observe(element, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  await page.keyboard.press("Alt+r");
  await expect(lab.getByText("상태: 실행 완료")).toBeVisible();
  await expect(lab.locator(".lab-announcement")).toContainText(
    "연속 실행을 완료했습니다.",
  );
  await expect(lab.locator(".lab-announcement")).toContainText(
    "예측과 실제 결과가 다릅니다.",
  );
  await expect(lab.getByText("예측 일치", { exact: true })).toBeVisible();
  await expect(
    lab
      .locator(".mission-transfer")
      .getByLabel("0x00000004", { exact: true }),
  ).toBeFocused();
  const liveMessages = await page.evaluate(
    () =>
      (
        window as Window & {
          __asmLiveMessages?: string[];
        }
      ).__asmLiveMessages ?? [],
  );
  expect(
    liveMessages.some(
      (message) =>
        message.includes("연속 실행을 시작했습니다.") &&
        message.includes("예측이 실제 결과와 일치했습니다."),
    ),
  ).toBe(false);

  await page.keyboard.press("Alt+0");
  await expect(lab.getByText("상태: 예측 대기")).toBeVisible();
  await expect(
    gate.getByLabel("0x00000000", { exact: true }),
  ).toBeFocused();
});

test("핵심 예측 건너뛰기는 정답 시도와 구분해 저장하고 안내한다", async ({
  page,
}) => {
  const lab = learningLab(page);
  await predictionGate(page)
    .getByRole("button", { name: "잘 모르겠어요. 결과 보기" })
    .click();
  await lab.getByRole("button", { name: "Step", exact: true }).click();

  await expect(lab.locator(".lab-announcement")).toContainText(
    "예측 없이 실제 결과를 확인했습니다.",
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("asm-lab-progress");
        return raw ? JSON.parse(raw).missions["pc-next"] : null;
      }),
    )
    .toMatchObject({
      status: "not-started",
      predictionAttempts: 0,
      predictionCorrect: false,
      predictionSkipped: true,
    });

  await predictionGate(page)
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await expect(lab.getByText("상태: 실행 완료")).toBeVisible();
  await expect(lab.locator(".mission-context")).toContainText("연습 완료");
});

test("x0 쓰기 무시는 상태 표와 실행 기록에서 같은 의미로 보인다", async ({
  page,
}) => {
  await openLesson(page, "x-zero-wrap");
  const lab = learningLab(page);

  await predictionGate(page)
    .getByLabel("0x00000000", { exact: true })
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();

  await expect(lab.locator(".delta-view")).toContainText(
    "레지스터 쓰기 무시: x0",
  );
  const timeline = lab.locator(".execution-timeline");
  await expect(timeline).toContainText(
    "x0 쓰기 무시, 값 0x00000000 유지",
  );
  await expect(
    timeline.locator(".timeline-inspector").getByText("쓰기 없음", {
      exact: true,
    }),
  ).toHaveCount(0);
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
  await expect(lab.locator(".mission-context")).toContainText("학습 중");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("asm-lab-progress");
        return raw
          ? JSON.parse(raw).missions["memory-address-value"].lastAttemptAt
          : null;
      }),
    )
    .not.toBeNull();
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
  await expect(
    predictionGate(page).getByLabel("0x00000000", { exact: true }),
  ).toBeFocused();
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

test("학습 증거 없이 마지막 미션만 저장돼도 기기 진도를 지울 수 있다", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "asm-lab-progress",
      JSON.stringify({
        version: 3,
        missions: {},
        lastMissionId: "memory-signed-loads",
      }),
    );
  });
  await page.reload();
  await expect(
    learningLab(page).locator(".mission-context").getByRole("heading", {
      name: /부호 확장/,
    }),
  ).toBeVisible();

  const progressPanel = page.locator(".progress-panel");
  const reset = progressPanel.getByRole("button", {
    name: "이 기기의 진도 지우기",
  });
  await expect(reset).toBeEnabled();
  await reset.click();
  await progressPanel
    .getByRole("button", { name: "정말 진도 지우기" })
    .click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("asm-lab-progress")))
    .toBeNull();
  await expect(
    progressPanel.getByRole("button", { name: "이 기기의 진도 지우기" }),
  ).toBeDisabled();
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

test("전이 문제는 완료된 머신 상태가 아닌 새 코드와 초기값을 제시한다", async ({
  page,
}) => {
  await openLesson(page, "memory-signed-loads");
  const lab = learningLab(page);
  const mainSource = lab.getByLabel("실행할 RV32I 프로그램");
  const transfer = lab.locator(".mission-transfer");

  await expect(mainSource).toContainText("lb x5, 0(x10)");
  await expect(mainSource).not.toContainText("lb x7, 3(x10)");
  await expect(transfer.getByLabel("새 문제 RV32I 코드")).toContainText(
    "lb x7, 3(x10)",
  );
  await expect(transfer.getByLabel("새 문제 초기 상태")).toContainText(
    "0x00001003의 바이트 = 0xfe",
  );
  await expect(
    transfer.getByRole("group", {
      name: "새 코드의 lb와 lbu 뒤에 x7과 x8은 무엇일까요?",
    }),
  ).toHaveAttribute("disabled", "");
  await expect(
    transfer.getByLabel(
      "x7 = 0xfffffffe, x8 = 0x000000fe",
      { exact: true },
    ),
  ).toBeDisabled();
});

test("오답은 정답을 노출하지 않고 재시도 성공을 복습 후 해결로 기록한다", async ({
  page,
}) => {
  const lab = learningLab(page);
  await completePcMission(page);

  const transfer = lab.locator(".mission-transfer");
  await expect(
    transfer.getByRole("heading", { name: "새 문제 조건" }),
  ).toBeVisible();
  await expect(transfer.getByLabel("새 문제 RV32I 코드")).toContainText(
    "addi x7, x0, 1",
  );
  await expect(transfer.getByLabel("새 문제 초기 상태")).toContainText(
    "각 RV32I 명령어의 길이 = 4바이트",
  );

  await transfer.getByLabel("0x00000004", { exact: true }).check();
  await transfer.getByRole("button", { name: "답 확인" }).click();
  await expect(transfer.getByText("한 번 더 생각해 보세요.")).toBeVisible();
  await expect(transfer).toContainText(
    "실행한 명령어 수와 명령어 한 개의 바이트 길이를 따로 세어 보세요.",
  );
  await expect(transfer).not.toContainText(
    "PC는 명령어마다 4씩 이동하므로",
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("asm-lab-progress");
        return raw
          ? JSON.parse(raw).missions["pc-next"].transferAttempts
          : null;
      }),
    )
    .toBe(1);

  await transfer.getByLabel("0x0000000c", { exact: true }).check();
  await expect(transfer).toContainText(
    "실행한 명령어 수와 명령어 한 개의 바이트 길이를 따로 세어 보세요.",
  );
  await transfer.getByRole("button", { name: "답 확인" }).click();
  await expect(transfer.getByText("복습 후 해결했습니다.")).toBeVisible();
  await expect(lab.locator(".mission-context")).toContainText("복습 후 해결");

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
      version: 3,
      mission: {
        status: "guided",
        predictionAttempts: 1,
        predictionCorrect: true,
        predictionSkipped: false,
        transferAttempts: 2,
        transferCompleted: true,
        transferPassed: false,
      },
      untouched: {
        status: "not-started",
        predictionAttempts: 0,
        transferAttempts: 0,
        transferCompleted: false,
        transferPassed: false,
      },
      lastMissionId: "pc-next",
    });

  await expect(page.locator(".progress-summary")).toContainText(
    "시작한 미션 1개, 그중 혼자 해결 0개, 복습 후 해결 1개",
  );
});

test("첫 시도 전이 성공만 혼자 해결 증거가 된다", async ({ page }) => {
  const lab = learningLab(page);
  await completePcMission(page);

  const transfer = lab.locator(".mission-transfer");
  await transfer.getByLabel("0x0000000c", { exact: true }).check();
  await transfer.getByRole("button", { name: "답 확인" }).click();
  await expect(
    transfer.getByText("첫 시도에 혼자 해결했습니다."),
  ).toBeVisible();
  await expect(lab.locator(".mission-context")).toContainText("혼자 해결");

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("asm-lab-progress");
        return raw ? JSON.parse(raw).missions["pc-next"] : null;
      }),
    )
    .toMatchObject({
      status: "independent",
      transferAttempts: 1,
      transferCompleted: true,
      transferPassed: true,
    });

  await lab.getByRole("button", { name: "Reset", exact: true }).click();
  await completePcMission(page);
  await transfer.getByLabel("0x0000000c", { exact: true }).check();
  await transfer.getByRole("button", { name: "답 확인" }).click();
  await expect(transfer.getByText("다시 정답입니다.")).toBeVisible();
  await expect(transfer).toContainText("혼자 해결 상태를 유지합니다.");
  await expect(lab.locator(".mission-context")).toContainText("혼자 해결");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("asm-lab-progress");
        return raw ? JSON.parse(raw).missions["pc-next"] : null;
      }),
    )
    .toMatchObject({
      status: "independent",
      transferAttempts: 1,
      transferCompleted: true,
      transferPassed: true,
    });
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

test("분기 checkpoint는 첫 Step에만 나오고 반복마다 실제 레지스터로 다음 PC를 묻는다", async ({
  page,
}) => {
  await openLesson(page, "branch-memory-loop");
  const lab = learningLab(page);
  const gate = predictionGate(page);

  await gate
    .getByLabel("분기하지 않고 다음 PC = 0x00000004", {
      exact: true,
    })
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await expect(
    gate.getByText("첫 beq의 분기 결과와 다음 PC는 무엇일까요?"),
  ).toHaveCount(0);
  await gate
    .getByLabel("계산한 메모리 주소에 값을 씁니다.")
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();
  await gate
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();

  await expect(
    gate.getByText("분기 조건이 성립할까요? 다음 PC도 함께 예측하세요."),
  ).toBeVisible();
  const unconditionalBranch = gate.getByLabel(
    /x0 0x00000000와 x0 0x00000000가 같아서 0x00000000로 분기합니다\./,
  );
  await unconditionalBranch.check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();

  await expect(
    gate.getByText("첫 beq의 분기 결과와 다음 PC는 무엇일까요?"),
  ).toHaveCount(0);
  await expect(
    gate.getByLabel(
      /x5 0x00001001와 x6 0x00001004가 달라서 0x00000004로 이동합니다\./,
    ),
  ).toBeVisible();
  await expect(gate.locator('input[type="radio"]')).toHaveCount(2);
  await gate
    .getByLabel(
      /x5 0x00001001와 x6 0x00001004가 달라서 0x00000004로 이동합니다\./,
    )
    .check();
  await lab.getByRole("button", { name: "Step", exact: true }).click();

  await gate
    .getByLabel("계산한 메모리 주소에 값을 씁니다.")
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
    .getByLabel(
      /x0 0x00000000와 x0 0x00000000가 같아서 0x00000000로 분기합니다\./,
    )
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
  await expect(
    predictionGate(page).getByLabel("0x00000000", { exact: true }),
  ).toBeFocused();
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

test("320px 휴대폰과 768px 태블릿에서 실험실과 전이 문제가 가로로 넘치지 않는다", async ({
  page,
}) => {
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    await openLesson(page, "memory-partial-store");
    await expectNoHorizontalOverflow(page);

    await predictionGate(page)
      .getByLabel("11 22 dd cc", { exact: true })
      .check();
    await learningLab(page)
      .getByRole("button", { name: "Step", exact: true })
      .click();
    await predictionGate(page)
      .getByLabel("목적지 레지스터에 결과를 씁니다.")
      .check();
    await learningLab(page)
      .getByRole("button", { name: "Step", exact: true })
      .click();
    await expect(
      learningLab(page).getByText("상태: 실행 완료"),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expect(
      learningLab(page).getByLabel("새 문제 RV32I 코드"),
    ).toBeVisible();
  }
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

test("v3 기기 진도를 JSON으로 내보낸다", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "진도 내보내기" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("asm-lab-progress.json");
});
