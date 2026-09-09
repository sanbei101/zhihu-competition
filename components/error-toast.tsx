"use client";

import { useEffect, useRef } from "react";

import { toast } from "@/components/ui/toast";

/** 服务端把错误信息传进来，挂载即弹 toast，只弹一次。 */
export function ErrorToast({ title, description }: { title: string; description?: string }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    toast.add({ title, description, type: "error" });
  }, [title, description]);

  return null;
}
