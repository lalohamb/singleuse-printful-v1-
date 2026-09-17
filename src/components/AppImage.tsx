"use client";

import Image, { type ImageProps } from "next/image";

type AppImageProps = Omit<ImageProps, "src" | "alt" | "width" | "height" | "fill"> & {
  src?: string | null;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  fallbackSrc?: string;
};

export default function AppImage({
  src,
  alt,
  width = 800,
  height = 800,
  fill = false,
  fallbackSrc = "/product-placeholder.svg",
  sizes = "100vw",
  unoptimized = true,
  ...props
}: AppImageProps) {
  const imageSrc = typeof src === "string" && src.trim() ? src : fallbackSrc;

  if (fill) {
    return (
      <Image
        {...props}
        src={imageSrc}
        alt={alt}
        fill
        sizes={sizes}
        unoptimized={unoptimized}
      />
    );
  }

  return (
    <Image
      {...props}
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      unoptimized={unoptimized}
    />
  );
}
