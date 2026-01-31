"use client";

import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function AuthBar() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
      <SignedOut>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/sign-in">Sign in</a>
          <a href="/sign-up">Sign up</a>
        </div>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </div>
  );
}