import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight">No reviewed guide for this app</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Describe the app on the home page and the agent writes a live draft.</p>
      <Button asChild size="lg" className="px-4">
        <Link href="/">Back to the library</Link>
      </Button>
    </div>
  );
}
