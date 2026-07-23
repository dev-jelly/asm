import { formatHex } from "../../lib/rv32i/memory";
import type { Snapshot, StepDelta } from "../../lib/rv32i/types";

const RELEVANT_REGISTERS = [0, 5, 6, 7, 10] as const;
const ABI_NAMES: Record<number, string> = {
  0: "zero",
  5: "t0",
  6: "t1",
  7: "t2",
  10: "a0",
};

type MachineStateViewProps = {
  snapshot: Snapshot;
  lastDelta: StepDelta | null;
};

export function MachineStateView({
  snapshot,
  lastDelta,
}: MachineStateViewProps) {
  const registerWrites = new Map(
    lastDelta?.registerWrites.map((write) => [write.register, write]) ?? [],
  );
  const memoryAccess = lastDelta?.memoryAccesses.at(-1);
  const displayedMemory = snapshot.memory.slice(0, 8);
  const encoding =
    snapshot.currentInstruction?.encoding ?? lastDelta?.instruction.encoding;

  return (
    <div className="machine-state">
      <section className="state-overview" aria-labelledby="machine-overview-title">
        <div>
          <h2 className="machine-overview-title" id="machine-overview-title">
            현재 상태
          </h2>
          <p className="pc-value">
            <span>PC</span>
            <code>{formatHex(snapshot.pc)}</code>
          </p>
        </div>
        <div>
          <span className="state-label">현재 코드</span>
          <code className="current-source">
            {snapshot.currentInstruction?.sourceText ?? "실행 완료"}
          </code>
        </div>
        <div>
          <span className="state-label">
            {snapshot.currentInstruction ? "현재 인코딩" : "마지막 인코딩"}
          </span>
          <code>{encoding === undefined ? "없음" : formatHex(encoding)}</code>
        </div>
      </section>

      <div className="state-columns">
        <section aria-labelledby="register-title">
          <div className="section-heading-row">
            <h3 id="register-title">레지스터</h3>
            <span>32비트 · 부호 없음</span>
          </div>
          <div
            className="table-scroll"
            role="region"
            tabIndex={0}
            aria-labelledby="register-title"
          >
            <table>
              <caption className="sr-only">
                관련 RV32I 레지스터의 현재 값과 최근 변화
              </caption>
              <thead>
                <tr>
                  <th scope="col">이름</th>
                  <th scope="col">현재 값</th>
                  <th scope="col">최근 상태</th>
                </tr>
              </thead>
              <tbody>
                {RELEVANT_REGISTERS.map((register) => {
                  const write = registerWrites.get(register);
                  return (
                    <tr key={register} data-change={write ? "write" : undefined}>
                      <th scope="row">
                        <code>x{register}</code>{" "}
                        <span className="muted">{ABI_NAMES[register]}</span>
                      </th>
                      <td>
                        <code>{formatHex(snapshot.registers[register])}</code>
                      </td>
                      <td>
                        {write ? (
                          <span className="change-text">
                            {write.committed ? "쓰기" : "쓰기 무시"}{" "}
                            <code>{formatHex(write.before)}</code>
                            <span aria-hidden="true"> → </span>
                            <span className="sr-only">에서 </span>
                            <code>{formatHex(write.after)}</code>
                          </span>
                        ) : register === 0 ? (
                          "고정값"
                        ) : (
                          "변화 없음"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="memory-title">
          <div className="section-heading-row">
            <h3 id="memory-title">메모리</h3>
            <span>바이트 주소 · 하위 바이트 우선</span>
          </div>
          <div
            className="table-scroll"
            role="region"
            tabIndex={0}
            aria-labelledby="memory-title"
          >
            <table>
              <caption className="sr-only">
                주소 0x1000부터의 메모리 byte와 최근 접근
              </caption>
              <thead>
                <tr>
                  <th scope="col">주소</th>
                  <th scope="col">바이트</th>
                  <th scope="col">최근 상태</th>
                </tr>
              </thead>
              <tbody>
                {displayedMemory.map((byte, offset) => {
                  const address = snapshot.memoryBase + offset;
                  const accessed =
                    memoryAccess &&
                    address >= memoryAccess.address &&
                    address < memoryAccess.address + memoryAccess.size;
                  return (
                    <tr
                      key={address}
                      data-change={accessed ? memoryAccess.kind : undefined}
                    >
                      <th scope="row">
                        <code>{formatHex(address)}</code>
                      </th>
                      <td>
                        <code>{byte.toString(16).padStart(2, "0")}</code>
                      </td>
                      <td>
                        {accessed
                          ? memoryAccess.kind === "read"
                            ? "읽기"
                            : "쓰기"
                          : "변화 없음"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="delta-view" aria-labelledby="delta-title">
        <div className="section-heading-row">
          <h3 id="delta-title">상태 변화</h3>
          <span>실행 전후</span>
        </div>
        {!lastDelta ? (
          <p className="empty-state">
            아직 실행 결과가 없습니다. 예측을 남기고 Step을 실행하세요.
          </p>
        ) : (
          <div className="delta-content">
            <p>
              <strong>
                {formatHex(lastDelta.pcBefore)}에서{" "}
                <code>{lastDelta.instruction.sourceText}</code> 실행
              </strong>
            </p>
            <ul>
              {lastDelta.registerWrites.map((write) => (
                <li key={`register-${write.register}`}>
                  {write.committed ? "레지스터 쓰기" : "레지스터 쓰기 무시"}:{" "}
                  <code>x{write.register}</code> {formatHex(write.before)} →{" "}
                  {formatHex(write.after)}
                </li>
              ))}
              {lastDelta.memoryPatches.map((patch) => (
                <li key={`memory-${patch.address}`}>
                  메모리 쓰기: {formatHex(patch.address)} 바이트{" "}
                  {patch.before.map(byteHex).join(" ")} →{" "}
                  {patch.after.map(byteHex).join(" ")}
                </li>
              ))}
              {lastDelta.memoryAccesses
                .filter((access) => access.kind === "read")
                .map((access) => (
                  <li key={`read-${access.address}`}>
                    메모리 읽기: {formatHex(access.address)}에서{" "}
                    {access.bytes.map(byteHex).join(" ")}를 읽어{" "}
                    {formatHex(access.value)}로 조립
                  </li>
                ))}
              {lastDelta.controlFlow.kind === "branch" ? (
                <li>
                  분기: {formatHex(lastDelta.controlFlow.lhs ?? 0)}와{" "}
                  {formatHex(lastDelta.controlFlow.rhs ?? 0)}가{" "}
                  {lastDelta.controlFlow.taken
                    ? "같아서 분기합니다"
                    : "달라서 다음 명령어로 이동합니다"}
                  .
                  다음 PC {formatHex(lastDelta.pcAfter)}
                </li>
              ) : null}
            </ul>
            {lastDelta.addressCalculation ? (
              <p className="address-calculation">
                유효 주소: x{lastDelta.addressCalculation.baseRegister}{" "}
                {formatHex(lastDelta.addressCalculation.baseValue)} +{" "}
                {lastDelta.addressCalculation.offset} ={" "}
                <strong>
                  {formatHex(lastDelta.addressCalculation.effectiveAddress)}
                </strong>
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function byteHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}
