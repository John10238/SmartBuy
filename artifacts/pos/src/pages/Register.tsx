import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { useCart } from "@/contexts/CartContext";
import { formatKES } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Search, Plus, Minus, Trash2, CreditCard, ShoppingCart, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Register() {
  const [search, setSearch] = useState("");
  const { data: products, isLoading, error } = useListProducts({ search: search || undefined });
  const { items, addItem, removeItem, updateQuantity, totalCents } = useCart();

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Products Grid */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="p-6 border-b border-border bg-card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Search products by name or SKU..."
              className="pl-10 py-6 text-lg rounded-xl bg-muted/50 border-transparent focus-visible:bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(12)].map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <p>Failed to load products</p>
            </div>
          ) : products?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Package className="w-12 h-12 mb-4 text-muted" />
              <p className="text-lg">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products?.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addItem(product)}
                  className="flex flex-col text-left bg-card border border-border rounded-xl overflow-hidden hover:border-primary hover:shadow-md transition-all active:scale-95 group relative"
                  disabled={product.stock <= 0}
                >
                  <div className="aspect-square bg-muted w-full relative">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-secondary">
                        <Package className="w-10 h-10 opacity-20" />
                      </div>
                    )}
                    {product.stock <= 0 && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <span className="bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1 w-full">
                    <h3 className="font-bold text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    <div className="mt-auto flex items-end justify-between">
                      <span className="font-extrabold text-foreground">
                        {formatKES(product.priceCents)}
                      </span>
                      {product.stock > 0 && product.stock <= 5 && (
                        <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-sm">
                          {product.stock} left
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-full md:w-96 lg:w-[400px] border-l border-border bg-card flex flex-col flex-shrink-0 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10 h-[50vh] md:h-auto">
        <div className="p-4 border-b border-border bg-muted/20">
          <h2 className="font-bold text-xl flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Current Order
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
              <ShoppingCart className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium">Cart is empty</p>
              <p className="text-sm">Tap a product to add it</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.product.id} className="flex gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-sm truncate">{item.product.name}</h4>
                    <p className="text-muted-foreground text-sm font-medium">
                      {formatKES(item.product.priceCents)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="font-bold w-6 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.stock}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <span className="font-extrabold">
                    {formatKES(item.product.priceCents * item.quantity)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeItem(item.product.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t border-border bg-card">
          <div className="flex justify-between items-end mb-6">
            <span className="text-muted-foreground font-medium">Total</span>
            <span className="text-4xl font-black text-primary tracking-tight">
              {formatKES(totalCents)}
            </span>
          </div>
          
          <Link href="/checkout" className="w-full block">
            <Button 
              className="w-full py-8 text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
              disabled={items.length === 0}
              size="lg"
            >
              <CreditCard className="w-6 h-6 mr-2" />
              Charge {formatKES(totalCents)}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

