import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary, SectionErrorBoundary } from "@/components/ErrorBoundary";

// 에러를 던지는 테스트용 컴포넌트
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("테스트 에러입니다");
  return <div>정상 렌더링</div>;
}

// console.error 억제 (에러 바운더리 테스트 시 노이즈 방지)
beforeEach(() => { jest.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

describe("ErrorBoundary", () => {
  it("에러 없으면 children을 렌더링해야 한다", () => {
    render(
      <ErrorBoundary level="section">
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("정상 렌더링")).toBeInTheDocument();
  });

  it("에러 발생 시 fallback UI를 보여줘야 한다", () => {
    render(
      <ErrorBoundary level="section">
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText(/오류가 발생했습니다/)).toBeInTheDocument();
  });

  it("'다시 시도' 클릭 시 리셋되어야 한다", () => {
    const { rerender } = render(
      <ErrorBoundary level="section">
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText("다시 시도"));
    rerender(
      <ErrorBoundary level="section">
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("정상 렌더링")).toBeInTheDocument();
  });

  it("커스텀 fallback을 사용할 수 있어야 한다", () => {
    render(
      <ErrorBoundary level="section" fallback={<div>커스텀 에러 UI</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("커스텀 에러 UI")).toBeInTheDocument();
  });

  it("inline 레벨에서 재시도 버튼이 있어야 한다", () => {
    render(
      <ErrorBoundary level="inline">
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("재시도")).toBeInTheDocument();
  });
});
