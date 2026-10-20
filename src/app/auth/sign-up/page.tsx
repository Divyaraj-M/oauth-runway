import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";

export default function Page() {
  return (
    <div className="py-10">
      <Suspense>
        <AuthForm mode="sign-up" />
      </Suspense>
    </div>
  );
}
