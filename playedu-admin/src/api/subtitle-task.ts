import client from "./internal/httpClient";

export function taskList(page: number, size: number, status: string) {
  return client.get("/backend/v1/subtitle-tasks/index", {
    page,
    size,
    status,
  });
}
