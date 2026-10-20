import { SearchXIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function NotFound() {
  return (
    <Empty className="enter py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyTitle>No reviewed guide for this app</EmptyTitle>
        <EmptyDescription>Describe the app on the home page and the agent researches a live draft.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild size="lg" className="px-4">
          <Link href="/">Back to the library</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
