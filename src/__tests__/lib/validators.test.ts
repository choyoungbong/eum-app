import { registerSchema, createPostSchema, createCommentSchema } from "@/lib/validators";

describe("registerSchema", () => {
  const valid = { name: "홍길동", email: "test@eum.app", password: "Secure1!" };

  it("유효한 데이터를 통과시켜야 한다", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("이름이 1자이면 실패해야 한다", () => {
    const r = registerSchema.safeParse({ ...valid, name: "홍" });
    expect(r.success).toBe(false);
  });

  it("이메일 형식이 잘못되면 실패해야 한다", () => {
    const r = registerSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(r.success).toBe(false);
  });

  it("비밀번호에 특수문자가 없으면 실패해야 한다", () => {
    const r = registerSchema.safeParse({ ...valid, password: "Secure123" });
    expect(r.success).toBe(false);
  });

  it("비밀번호에 대문자가 없으면 실패해야 한다", () => {
    const r = registerSchema.safeParse({ ...valid, password: "secure1!" });
    expect(r.success).toBe(false);
  });
});

describe("createPostSchema", () => {
  it("제목이 비어있으면 실패해야 한다", () => {
    const r = createPostSchema.safeParse({ title: "", content: "내용" });
    expect(r.success).toBe(false);
  });

  it("visibility 기본값은 PUBLIC이어야 한다", () => {
    const r = createPostSchema.safeParse({ title: "제목", content: "내용" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.visibility).toBe("PUBLIC");
  });

  it("허용되지 않은 visibility 값은 실패해야 한다", () => {
    const r = createPostSchema.safeParse({ title: "제목", content: "내용", visibility: "INVALID" });
    expect(r.success).toBe(false);
  });
});

describe("createCommentSchema", () => {
  it("빈 댓글은 실패해야 한다", () => {
    const r = createCommentSchema.safeParse({ content: "" });
    expect(r.success).toBe(false);
  });

  it("2000자 초과 댓글은 실패해야 한다", () => {
    const r = createCommentSchema.safeParse({ content: "a".repeat(2001) });
    expect(r.success).toBe(false);
  });

  it("mentionIds 없이도 유효해야 한다", () => {
    const r = createCommentSchema.safeParse({ content: "좋은 글이네요!" });
    expect(r.success).toBe(true);
  });
});
