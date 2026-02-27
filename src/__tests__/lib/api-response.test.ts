import { ok, created, paginated, ApiError, ErrorCode } from "@/lib/api-response";

describe("API 응답 빌더", () => {
  it("ok()는 success: true와 data를 반환해야 한다", async () => {
    const res  = ok({ id: "1", name: "파일" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ id: "1", name: "파일" });
  });

  it("created()는 201 상태 코드를 반환해야 한다", async () => {
    const res = created({ id: "new" });
    expect(res.status).toBe(201);
  });

  it("paginated()는 meta를 포함해야 한다", async () => {
    const res  = paginated(["a", "b"], { page: 1, limit: 10, total: 2, hasMore: false });
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.meta.total).toBe(2);
    expect(body.meta.hasMore).toBe(false);
  });

  it("ApiError.unauthorized()는 401과 올바른 코드를 반환해야 한다", async () => {
    const res  = ApiError.unauthorized();
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it("ApiError.notFound()는 리소스명을 포함해야 한다", async () => {
    const res  = ApiError.notFound("파일");
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error).toContain("파일");
  });

  it("ApiError.validation()은 details를 포함해야 한다", async () => {
    const res  = ApiError.validation("이메일 형식 오류", [{ field: "email", message: "invalid" }]);
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.details).toBeDefined();
  });
});
