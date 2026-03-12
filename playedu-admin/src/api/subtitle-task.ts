import client from "./internal/httpClient";

export function taskList(page: number, size: number, status: string) {
  return client.get("/backend/v1/subtitle-tasks/index", {
    page,
    size,
    status,
  });
}

export function cancelTask(id: number) {
  return client.post(`/backend/v1/subtitle-tasks/${id}/cancel`, {});
}

export function moveTask(id: number, direction: string) {
  return client.put(`/backend/v1/subtitle-tasks/${id}/move`, {
    direction,
  });
}
