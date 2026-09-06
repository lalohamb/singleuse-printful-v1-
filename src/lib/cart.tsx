"use client";
import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";
import type { CartItem, Product, ProductVariant } from "@/types";

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
      const existing = state.items.find(i => i.product_id === action.item.product_id && i.variant_id === action.item.variant_id);
      if (existing) return { ...state, items: state.items.map(i => i.product_id === action.item.product_id && i.variant_id === action.item.variant_id ? { ...i, quantity: i.quantity + action.item.quantity } : i), isOpen: true };
      return { ...state, items: [...state.items, action.item], isOpen: true };
    }
    case "REMOVE": return { ...state, items: state.items.filter(i => !(i.product_id === action.product_id && i.variant_id === action.variant_id)) };
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
  addToCart: (product: Product, variant: ProductVariant, quantity: number) => void;
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
const STORAGE_KEY = "bodyandsleeves_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], isOpen: false });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) { const items = JSON.parse(saved); if (Array.isArray(items)) dispatch({ type: "HYDRATE", items }); }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items)); } catch {}
  }, [state.items]);

  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = state.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const value: CartContextValue = {
    ...state,
    addToCart: (product, variant, quantity) => dispatch({ type: "ADD", item: { product_id: product.id, title: product.title, price: product.price, image_url: product.image_url || "", quantity, variant_id: variant.id, variant_label: variant.label, printify_id: product.printify_id, blueprint_id: product.blueprint_id, print_provider_id: product.print_provider_id } }),
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
