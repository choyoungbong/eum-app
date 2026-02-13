import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// 1. Next.js 규칙을 지키기 위해 handler를 만듭니다.
const handler = NextAuth(authOptions);

// 2. [중요!] 다른 파일들이 여기서 authOptions를 가져갈 수 있게 "다시 내보내기"를 합니다.
// 이렇게 하면 다른 파일들을 일일이 수정하지 않아도 됩니다.
export { authOptions }; 

// 3. GET, POST 메서드를 내보냅니다.
export { handler as GET, handler as POST };
