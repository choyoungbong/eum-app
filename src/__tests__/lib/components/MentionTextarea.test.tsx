import { render as rtlRender, screen as rtlScreen, fireEvent as rtlFireEvent, waitFor } from "@testing-library/react";
import MentionTextarea from "@/components/MentionTextarea";

describe("MentionTextarea", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ users: [
        { id: "u1", name: "홍길동", isOnline: true },
        { id: "u2", name: "홍철수", isOnline: false },
      ]}),
    });
  });

  it("기본 텍스트 입력이 동작해야 한다", () => {
    const onChange = jest.fn();
    rtlRender(<MentionTextarea value="" onChange={onChange} />);
    const ta = rtlScreen.getByPlaceholderText("댓글을 입력하세요...");
    rtlFireEvent.change(ta, { target: { value: "안녕하세요" } });
    expect(onChange).toHaveBeenCalledWith("안녕하세요", []);
  });

  it("@를 입력하면 사용자 목록이 표시되어야 한다", async () => {
    const onChange = jest.fn();
    rtlRender(<MentionTextarea value="" onChange={onChange} />);
    const ta = rtlScreen.getByPlaceholderText("댓글을 입력하세요...");
    rtlFireEvent.change(ta, { target: { value: "@홍", selectionStart: 2 } });
    await waitFor(() => {
      expect(rtlScreen.getByText("홍길동")).toBeInTheDocument();
    });
  });
});
