import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText("상태: 예측 대기")).toBeVisible();
});

test("Step, Back, Reset과 Worker 실행 흐름이 동작한다", async ({ page }) => {
  await page
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await page.getByRole("button", { name: "Step", exact: true }).click();

  await expect(page.getByText("Step 1", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("예측이 맞았습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeEnabled();

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("아직 실행 기록이 없습니다.")).toBeVisible();

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByText("상태: 예측 대기")).toBeVisible();
});

test("Worker 중단 뒤 다시 시작해 현재 프로그램을 복구한다", async ({ page }) => {
  const workers = page
    .workers()
    .filter((candidate) => candidate.url().includes("rv32i.worker"));
  expect(workers.length).toBeGreaterThan(0);
  await Promise.all(
    workers.map((worker) =>
      worker.evaluate(() => {
        setTimeout(() => {
          throw new Error("intentional E2E worker crash");
        }, 0);
      }),
    ),
  );

  const alert = page.locator(".learning-lab").getByRole("alert");
  await expect(alert).toContainText("Worker가 예기치 않게 중단");
  await expect(
    page
      .locator(".learning-lab")
      .getByRole("button", { name: "Reset", exact: true }),
  ).toBeDisabled();

  await alert
    .getByRole("button", { name: "Worker 다시 시작", exact: true })
    .click();
  await expect(page.getByText("상태: 예측 대기")).toBeVisible();
});

test("무한 분기 Run을 Pause로 실제 일시정지한다", async ({ page }) => {
  const learningLab = page.locator(".learning-lab");
  await page.getByText("코드 직접 편집").click();
  await page.getByLabel(/RV32I 소스/).fill("loop: beq x0, x0, loop");
  await page
    .getByRole("button", { name: "프로그램 불러오기", exact: true })
    .click();
  await expect(page.getByText("상태: 예측 대기")).toBeVisible();

  await page
    .getByLabel("조건 비교 결과로 다음 PC가 정해집니다.")
    .check();
  await page
    .getByLabel("Run은 현재 예측 이후 단계의 확인 과정을 건너뜁니다.")
    .check();

  await learningLab.evaluate((element) => {
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
  await learningLab.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("상태: 일시정지")).toBeVisible();
});

test("signed byte 실험에서 부호 확장 결과를 표시한다", async ({ page }) => {
  await page.getByRole("button", { name: /부호 확장/ }).click();
  await expect(
    page
      .getByLabel("실행할 RV32I 프로그램")
      .getByText("lb   x5, 0(x10)"),
  ).toBeVisible();
  await expect(page.getByText("상태: 예측 대기")).toBeVisible();

  await page
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await page.getByRole("button", { name: "Step", exact: true }).click();

  await expect(page.getByText("0xffffff80").first()).toBeVisible();
  await expect(page.getByText(/읽기 0x00001000 \(1B\)/)).toBeVisible();
});

test("메모리 word 보기와 주소 검증이 동작한다", async ({ page }) => {
  await page
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await page
    .getByLabel("Run은 현재 예측 이후 단계의 확인 과정을 건너뜁니다.")
    .check();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("상태: 실행 완료")).toBeVisible();

  await page.getByLabel("word", { exact: true }).check();
  const firstWord = page.getByRole("button", {
    name: /0x00001000, word, 값 0x00000007/,
  });
  await expect(firstWord).toBeVisible();
  await firstWord.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: /0x00001004, word/ }),
  ).toBeFocused();

  await page.getByLabel("byte", { exact: true }).check();
  const firstByte = page.getByRole("button", {
    name: /0x00001000, byte, 값 0x07/,
  });
  await firstByte.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("button", { name: /0x00001004, byte/ }),
  ).toBeFocused();

  await page.getByLabel("주소 이동").fill("0x9999");
  await page.getByRole("button", { name: "이동", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "0x00001000부터 0x00001fff 사이 주소",
  );
});

test("메모리 초기화 상태를 Back과 Reset으로 되돌린다", async ({ page }) => {
  await page.getByRole("button", { name: /바이트 조립/ }).click();
  await expect(page.getByText("상태: 예측 대기")).toBeVisible();

  await page
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await page
    .getByLabel("계산한 메모리 주소에 값을 씁니다.")
    .check();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: /0x00001000, byte, 값 0x7f, 초기화됨, 최근 쓰기/,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: /0x00001000, byte, 값 미정, 초기화되지 않음/,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Step", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: /0x00001000, byte, 값 미정, 초기화되지 않음/,
    }),
  ).toBeVisible();
});

test("잘못 정렬된 직접 코드를 오류 뒤 예제로 복원한다", async ({ page }) => {
  await page.getByText("코드 직접 편집").click();
  await page.getByLabel(/RV32I 소스/).fill("lh x5, 1(x10)");
  await page
    .getByRole("button", { name: "프로그램 불러오기", exact: true })
    .click();
  await expect(page.getByText("상태: 예측 대기")).toBeVisible();

  await page
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("2바이트 halfword 경계");

  await page
    .getByRole("alert")
    .getByRole("button", { name: "예제로 복원", exact: true })
    .click();
  await expect(page.getByText("상태: 예측 대기")).toBeVisible();
  await expect(
    page.getByLabel("실행할 RV32I 프로그램").getByText("addi x5, x0, 7"),
  ).toBeVisible();
});

test("초기화되지 않은 load를 값이 아닌 경고로 설명한다", async ({ page }) => {
  await page.getByText("코드 직접 편집").click();
  await page.getByLabel(/RV32I 소스/).fill("lb x5, 0(x10)");
  await page
    .getByRole("button", { name: "프로그램 불러오기", exact: true })
    .click();
  await expect(page.getByText("상태: 예측 대기")).toBeVisible();

  await page
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await page.getByRole("button", { name: "Step", exact: true }).click();

  await expect(page.getByText("주의:", { exact: true })).toBeVisible();
  await expect(page.locator(".delta-view").getByText(/backing byte/)).toBeVisible();
});

test("완료 진도는 실제로 실행한 프리셋에만 기록한다", async ({ page }) => {
  await page
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await page
    .getByLabel("Run은 현재 예측 이후 단계의 확인 과정을 건너뜁니다.")
    .check();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("상태: 실행 완료")).toBeVisible();

  await page.getByRole("button", { name: /부호 확장/ }).click();
  await expect(page.getByText("상태: 예측 대기")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("asm-lab-progress");
        return raw ? JSON.parse(raw).completedActivities : [];
      }),
    )
    .toEqual(["tracer-bullet"]);

  await page.getByText("코드 직접 편집").click();
  await page.getByLabel(/RV32I 소스/).fill("addi x5, x0, 1");
  await page
    .getByRole("button", { name: "프로그램 불러오기", exact: true })
    .click();
  await expect(page.getByText("상태: 예측 대기")).toBeVisible();
  await expect(page.getByText(/사용자 코드/)).toBeVisible();

  await page
    .getByLabel("목적지 레지스터에 결과를 씁니다.")
    .check();
  await page
    .getByLabel("Run은 현재 예측 이후 단계의 확인 과정을 건너뜁니다.")
    .check();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("상태: 실행 완료")).toBeVisible();
  expect(
    await page.evaluate(() => {
      const raw = localStorage.getItem("asm-lab-progress");
      return raw ? JSON.parse(raw).completedActivities : [];
    }),
  ).toEqual(["tracer-bullet"]);
});

test("다크 모드와 모션 감소 환경을 따른다", async ({ page }) => {
  await page.emulateMedia({
    colorScheme: "dark",
    reducedMotion: "reduce",
    forcedColors: "none",
  });
  await page.reload();
  await expect(page.getByText("상태: 예측 대기")).toBeVisible();

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

test("기기 진도를 JSON으로 내보낸다", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "진도 내보내기" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("asm-lab-progress.json");
});

test("모바일에서도 문서 자체의 가로 오버플로가 없다", async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
