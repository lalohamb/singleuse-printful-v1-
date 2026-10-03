"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import CatalogBuilderInner from "./CatalogBuilder";

function CatalogBuilderPage() {
  const searchParams = useSearchParams();
  const editProductId = searchParams.get("edit") ?? undefined;
  return <CatalogBuilderInner editProductId={editProductId} />;
}

export default function Page() {
  return (
    <Suspense>
      <CatalogBuilderPage />
    </Suspense>
  );
}
