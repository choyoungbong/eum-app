// src/types/next-auth.d.ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id:       string;
      role:     string;
      isBanned: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id:       string;
    email:    string;
    name:     string;
    role:     string;
    isBanned: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id:       string;
    role:     string;
    isBanned: boolean;
  }
}
