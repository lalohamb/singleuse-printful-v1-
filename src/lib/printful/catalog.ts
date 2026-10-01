import { printfulGet } from "./client";
import type { PrintfulProduct, PrintfulVariant } from "./types";

export async function getCatalogProducts(): Promise<PrintfulProduct[]> {
  return printfulGet<PrintfulProduct[]>("/products");
}

export async function getCatalogProduct(productId: number): Promise<PrintfulProduct> {
  return printfulGet<PrintfulProduct>(`/products/${productId}`);
}

export async function getCatalogVariants(productId: number): Promise<PrintfulVariant[]> {
  const product = await printfulGet<{ variants: PrintfulVariant[] }>(
    `/products/${productId}`
  );
  return product.variants;
}
