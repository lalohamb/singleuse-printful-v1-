"use client";

import { useState } from "react";

export interface ArtworkUploadResult {
  url: string;
  width?: number;
  height?: number;
}

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);

export function useArtworkUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File): Promise<ArtworkUploadResult | null> {
    setError(null);

    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Only PNG and JPEG files are supported.");
      return null;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("File must be under 50 MB.");
      return null;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/printful/artwork-upload", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Upload failed");
      }
      const data = await res.json();
      if (!data.url) throw new Error("No URL returned from upload");

      // Read image dimensions from the file locally
      const dims = await getImageDimensions(file);
      return { url: data.url, ...dims };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, error };
}

function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}
