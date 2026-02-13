import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

// authOptions는 절대 여기서 export하지 않음!
// 다른 파일들은 @/lib/auth 에서 직접 import해야 함
export { handler as GET, handler as POST };
