import type { Metadata } from "next";
import { LoginCard } from "@/components/auth/login-card";

export const metadata: Metadata = {
  title: "Sign in · Portfolio Panel",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { expired } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-4 py-12">
      <LoginCard expired={expired === "1"} />
    </main>
  );
}
