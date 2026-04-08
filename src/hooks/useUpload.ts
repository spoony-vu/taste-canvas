import { useState, useCallback } from "react";
import type { TasteItem } from "../lib/types";

interface UploadParams {
  file: File;
  title: string;
  category: string;
  url: string;
  tags: string;
}

export function useUpload(onSuccess: (item: TasteItem) => void) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const upload = useCallback(
    async ({ file, title, category, url, tags }: UploadParams) => {
      if (!file || !title) return;
      setUploading(true);
      setError("");

      const form = new FormData();
      const fieldName = file.type.startsWith("video/") ? "video" : "image";
      form.append(fieldName, file);
      form.append("title", title);
      form.append("category", category);
      form.append("url", url);
      form.append(
        "tags",
        JSON.stringify(
          tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        )
      );

      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) throw new Error("Upload failed");
        const item = await res.json();
        onSuccess(item);
      } catch (err) {
        setError(String(err));
        console.error(err);
      } finally {
        setUploading(false);
      }
    },
    [onSuccess]
  );

  return { uploading, error, upload };
}
