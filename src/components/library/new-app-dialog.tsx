"use client";

import { ArrowRightIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function NewAppDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (query: string) => void;
}) {
  const [app, setApp] = useState("");
  const [what, setWhat] = useState("");
  const [who, setWho] = useState("for my customers");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a guide for an app not listed</DialogTitle>
          <DialogDescription>The agent researches the app and writes a live draft. Every line is marked Unverified until a person reviews it.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!app.trim()) return;
            onOpenChange(false);
            onSubmit(`${app.trim()}: ${what.trim() || "typical read and write access"}, ${who}`);
          }}
        >
          <div className="grid gap-2">
            <label htmlFor="dlg-app" className="text-sm leading-none font-medium">
              App name or website
            </label>
            <Input id="dlg-app" required autoFocus autoComplete="off" value={app} onChange={(e) => setApp(e.target.value)} placeholder="Pipedrive, intercom.com…" className="h-9" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="dlg-do" className="text-sm leading-none font-medium">
              What your agent should do in it
            </label>
            <Textarea id="dlg-do" rows={2} value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Read deals and update their stage" className="min-h-[60px]" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="dlg-who" className="text-sm leading-none font-medium">
              Who connects it
            </label>
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger id="dlg-who" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="for my customers">My customers (public app)</SelectItem>
                <SelectItem value="for my own company only">Only my company (internal)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="lg" className="px-4">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" className="px-4">
              Start guide
              <ArrowRightIcon />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
