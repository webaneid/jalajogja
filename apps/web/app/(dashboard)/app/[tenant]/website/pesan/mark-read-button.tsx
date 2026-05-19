"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markSubmissionReadAction } from "./actions";
import { useRouter } from "next/navigation";

export function MarkReadButton({ slug, id }: { slug: string; id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0 text-xs h-7"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await markSubmissionReadAction(slug, id);
          router.refresh();
        });
      }}
    >
      {pending ? "..." : "Tandai Dibaca"}
    </Button>
  );
}
