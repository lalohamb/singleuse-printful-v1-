import { printfulGet, printfulPost } from "./client";
import type {
  PrintfulMockupTask,
  PrintfulMockupTaskRequest,
} from "./types";

export async function createMockupTask(
  productId: number,
  request: PrintfulMockupTaskRequest
): Promise<PrintfulMockupTask> {
  return printfulPost<PrintfulMockupTask>(
    `/mockup-generator/create-task/${productId}`,
    request
  );
}

export async function getMockupTask(taskKey: string): Promise<PrintfulMockupTask> {
  return printfulGet<PrintfulMockupTask>(
    `/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`
  );
}
