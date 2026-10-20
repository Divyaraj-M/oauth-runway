"use client";

import { LayoutDashboardIcon, LogOutIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth/client";

import { useMe } from "./me";

export function AccountMenu() {
  const { user, admin, loading, refresh, requireSignIn } = useMe();
  const path = usePathname();
  const router = useRouter();

  // Sign-in and sign-up finish with a server redirect (no reload), so re-check the session on every navigation.
  useEffect(() => {
    refresh();
  }, [path, refresh]);

  if (loading) return <Skeleton className="size-8 rounded-full" />;
  if (!user)
    return (
      <Button variant="outline" size="sm" onClick={() => requireSignIn()}>
        Sign in
      </Button>
    );
  const initials = (user.name || user.email).slice(0, 2).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account">
          <Avatar className="size-8">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{user.name || "Signed in"}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {admin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <LayoutDashboardIcon />
              Admin
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut();
            refresh();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
