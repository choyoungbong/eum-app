// jest.setup.ts
import "@testing-library/jest-dom";

// fetch 모킹
global.fetch = jest.fn();

// next/navigation 모킹
jest.mock("next/navigation", () => ({
  useRouter:  () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// next-auth/react 모킹
jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "test-user", name: "테스터", role: "USER" } }, status: "authenticated" }),
  signIn:  jest.fn(),
  signOut: jest.fn(),
}));
