import { useState, useCallback } from "react";
import type { TasteItem } from "../lib/types";

const MAX_DIMENSION = 2000;
const MAX_BYTES = 4 * 1024 * 1024; // 4MB — Vercel body limit is 4.5MB

function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return resolve(file);
    if (file.size <= MAX_BYTES) return resolve(file);

    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
        },
        "image/webp",
        0.85,
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

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

      try {
        const compressed = await compressImage(file);
        const form = new FormData();
        form.append("image", compressed);
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
