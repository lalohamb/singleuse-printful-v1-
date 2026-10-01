"use client";
import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";
import type { CartItem, Product, StoreVariant } from "@/types";

// v2: variant_id is now a store UUID (product_variants.id).
// Legacy carts (v1) stored Printful numeric IDs — they are cleared on first load.
const STORAGE_KEY = "pod_storefront_cart_v2";
const LEGACY_KEY = "pod_storefront_cart";

interface CartState { items: CartItem[]; isOpen: boolean; }
type CartAction =
  | { type: "ADD"; item: CartItem }
  | { type: "REMOVE"; product_id: string; variant_id: string }
  | { type: "UPDATE_QTY"; product_id: string; variant_id: string; quantity: number }
  | { type: "CLEAR" } | { type: "OPEN" } | { type: "CLOSE" } | { type: "TOGGLE" }
  | { type: "HYDRATE"; items: CartItem[] };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const existing = state.items.find(i =>
        i.product_id === action.item.product_id &&
        i.variant_id === action.item.variant_id &&
        i.personalization_text === action.item.personalization_text
      );
      if (existing) return {
        ...state,
        items: state.items.map(i =>
          i.product_id === action.item.product_id &&
          i.variant_id === action.item.variant_id &&
          i.personalization_text === action.item.personalization_text
            ? { ...i, quantity: i.quantity + action.item.quantity }
            : i
        ),
        isOpen: true,
      };
      return { ...state, items: [...state.items, action.item], isOpen: true };
    }
    case "REMOVE":
      return { ...state, items: state.items.filter(i => !(i.product_id === action.product_id && i.variant_id === action.variant_id)) };
    case "UPDATE_QTY":
      if (action.quantity <= 0) return { ...state, items: state.items.filter(i => !(i.product_id === action.product_id && i.variant_id === action.variant_id)) };
      return { ...state, items: state.items.map(i => i.product_id === action.product_id && i.variant_id === action.variant_id ? { ...i, quantity: action.quantity } : i) };
    case "CLEAR": return { ...state, items: [] };
    case "OPEN": return { ...state, isOpen: true };
    case "CLOSE": return { ...state, isOpen: false };
    case "TOGGLE": return { ...state, isOpen: !state.isOpen };
    case "HYDRATE": return { ...state, items: action.items };
    default: return state;
  }
}

interface CartContextValue extends CartState {
  addToCart: (product: Product, variant: StoreVariant, quantity: number, personalization_text?: string) => void;
  removeFromCart: (product_id: string, variant_id: string) => void;
  updateQuantity: (product_id: string, variant_id: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  itemCount: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], isOpen: false });

  useEffect(() => {
    // Clear legacy v1 cart (contained Printful numeric IDs as variant_id)
    try { localStorage.removeItem(LEGACY_KEY); } catch {}

    // Load v2 cart
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const items = JSON.parse(saved);
        if (Array.isArray(items)) dispatch({ type: "HYDRATE", items });
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items)); } catch {}
  }, [state.items]);

  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = state.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const value: CartContextValue = {
    ...state,
    addToCart: (product, variant, quantity, personalization_text) => dispatch({
      type: "ADD",
      item: {
        product_id: product.id,
        variant_id: variant.id,           // store UUID
        title: product.title,
        variant_label: variant.label,
        color: variant.color ?? null,
        size: variant.size ?? null,
        price: variant.retail_price,
        image_url: variant.image_url || product.image_url || "",
        quantity,
        printful_id: product.printful_id, // product-level, for tracing only
        personalization_text: personalization_text || undefined,
      },
    }),
    removeFromCart: (product_id, variant_id) => dispatch({ type: "REMOVE", product_id, variant_id }),
    updateQuantity: (product_id, variant_id, quantity) => dispatch({ type: "UPDATE_QTY", product_id, variant_id, quantity }),
    clearCart: () => dispatch({ type: "CLEAR" }),
    openCart: () => dispatch({ type: "OPEN" }),
    closeCart: () => dispatch({ type: "CLOSE" }),
    toggleCart: () => dispatch({ type: "TOGGLE" }),
    itemCount,
    subtotal,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
