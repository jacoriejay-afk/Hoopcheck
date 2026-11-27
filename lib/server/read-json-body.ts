export class RequestBodyError extends Error {
  constructor(readonly status: 400 | 413) {
    super(status === 413 ? "Request body is too large." : "Invalid request body.");
  }
}

export async function readJsonBody(request: Request, limit: number): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > limit) throw new RequestBodyError(413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError(400);

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let body = "";
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new RequestBodyError(413);
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch (error) {
    // Stop consuming an invalid stream without waiting for upstream cancellation.
    void reader.cancel().catch(() => undefined);
    throw error instanceof RequestBodyError ? error : new RequestBodyError(400);
  } finally {
    reader.releaseLock();
  }
}
