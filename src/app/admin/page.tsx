import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currentUser, isAdmin } from "@/lib/auth/server";
import { adminOverview } from "@/lib/db";
import { levelOf } from "@/lib/levels";

export const metadata: Metadata = { title: "Admin · OAuth Runway", robots: { index: false } };

export default function AdminPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Admin />
    </Suspense>
  );
}

const when = (v: unknown) =>
  v ? new Date(v as string).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "—";

async function Admin() {
  // Not an admin (or signed out): look exactly like a missing page.
  if (!isAdmin(await currentUser())) notFound();
  const { counts, events, guides, users } = await adminOverview();
  const stats = [
    ["Users", counts.users],
    ["Guides generated", counts.guides],
    ["Generations, 24 h", counts.generations_24h],
    ["Failures, 24 h", counts.failures_24h],
    ["Agent questions", counts.questions],
  ] as const;

  return (
    <div className="enter flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">Who is using OAuth Runway and what they generate. Times in UTC.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([label, n]) => (
          <Card key={label} className="gap-1 p-4">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="tnum font-mono text-2xl font-semibold">{n}</span>
          </Card>
        ))}
      </div>

      <Section title="Recent activity" description="Generations, agent questions and key checks, newest first.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>User</TableHead>
              <TableHead>What</TableHead>
              <TableHead>App</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e, i) => {
              const detail = (e.detail ?? {}) as { error?: string; model?: string };
              return (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">{when(e.created_at)}</TableCell>
                  <TableCell>{(e.email as string) ?? "—"}</TableCell>
                  <TableCell>{e.kind as string}</TableCell>
                  <TableCell>{(e.app as string) ?? "—"}</TableCell>
                  <TableCell className="max-w-72 whitespace-normal">
                    {e.ok ? <Badge variant="secondary">ok</Badge> : <span className="text-destructive">{detail.error ?? "failed"}</span>}
                  </TableCell>
                  <TableCell className="tnum text-right font-mono text-muted-foreground">{e.ms ? `${((e.ms as number) / 1000).toFixed(1)}s` : "—"}</TableCell>
                </TableRow>
              );
            })}
            {!events.length && <Empty cols={6} />}
          </TableBody>
        </Table>
      </Section>

      <Section title="Generated guides" description="Every guide saved to the library.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>App</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {guides.map((g) => (
              <TableRow key={g.id as string}>
                <TableCell>
                  <Link href={`/g/${g.id}`} className="underline underline-offset-2">
                    {g.app as string}
                  </Link>
                </TableCell>
                <TableCell>L{levelOf(g.difficulty as string).n}</TableCell>
                <TableCell>{(g.email as string) ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{g.model as string}</TableCell>
                <TableCell className="text-muted-foreground">{when(g.created_at)}</TableCell>
              </TableRow>
            ))}
            {!guides.length && <Empty cols={5} />}
          </TableBody>
        </Table>
      </Section>

      <Section title="Users">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Guides</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.email as string}>
                <TableCell>{u.email as string}</TableCell>
                <TableCell>{(u.name as string) || "—"}</TableCell>
                <TableCell className="tnum text-right font-mono">{u.guides as number}</TableCell>
                <TableCell className="text-muted-foreground">{when(u.created_at)}</TableCell>
                <TableCell className="text-muted-foreground">{when(u.last_seen)}</TableCell>
              </TableRow>
            ))}
            {!users.length && <Empty cols={5} />}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="px-0">{children}</CardContent>
    </Card>
  );
}

function Empty({ cols }: { cols: number }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-8 text-center text-muted-foreground">
        Nothing yet.
      </TableCell>
    </TableRow>
  );
}
