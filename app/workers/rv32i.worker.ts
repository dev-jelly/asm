/// <reference lib="webworker" />

import { isWorkerCommand } from "../../lib/rv32i/protocol";
import { Rv32iWorkerController } from "../../lib/rv32i/worker-controller";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
const controller = new Rv32iWorkerController((response) => {
  workerScope.postMessage(response);
});

workerScope.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (isWorkerCommand(event.data)) {
    controller.handle(event.data);
  } else {
    controller.reject(event.data);
  }
});

workerScope.addEventListener("close", () => {
  controller.dispose();
});
