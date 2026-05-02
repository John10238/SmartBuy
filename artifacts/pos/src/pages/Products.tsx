import { useState } from "react";
import {
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { formatKES } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Package,
  Search,
  AlertTriangle,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Skeleton } from "@/components/ui/skeleton";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional().nullable(),
  priceCents: z.coerce.number().min(0, "Price must be positive"),
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
  category: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
});

type ProductFormValues = z.infer<typeof productSchema>;

function resolveProductImageSrc(imageUrl?: string | null): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("/objects/")) {
    return `/api/storage${imageUrl}`;
  }
  return imageUrl;
}

interface ImageFieldProps {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
}

function ImageField({ value, onChange }: ImageFieldProps) {
  const { toast } = useToast();
  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (response) => {
      onChange(response.objectPath);
      toast({ title: "Image uploaded" });
    },
    onError: (err) => {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const previewSrc = resolveProductImageSrc(value);

  const onPick = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Unsupported file",
        description: "Pick an image file (JPEG, PNG, WebP).",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Image too large",
        description: "Keep images under 5 MB.",
        variant: "destructive",
      });
      return;
    }
    void uploadFile(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt="Product preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="w-8 h-8 text-muted-foreground opacity-40" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              disabled={isUploading}
            >
              <span>
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Uploading{progress ? ` ${progress}%` : ""}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {value ? "Replace image" : "Upload image"}
                  </>
                )}
              </span>
            </Button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploading}
              onChange={(e) => {
                onPick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {value && !isUploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onChange(null)}
            >
              <X className="w-4 h-4 mr-2" />
              Remove
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, or WebP. Max 5 MB.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  const [search, setSearch] = useState("");
  const { data: products, isLoading } = useListProducts({
    search: search || undefined,
  });

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      priceCents: 0,
      stock: 0,
      category: "",
      imageUrl: null,
    },
  });

  const onOpenAdd = () => {
    form.reset({
      name: "",
      sku: "",
      priceCents: 0,
      stock: 0,
      category: "",
      imageUrl: null,
    });
    setIsAddOpen(true);
  };

  const onOpenEdit = (product: any) => {
    form.reset({
      name: product.name,
      sku: product.sku || "",
      priceCents: product.priceCents,
      stock: product.stock,
      category: product.category || "",
      imageUrl: product.imageUrl ?? null,
    });
    setEditingProduct(product);
  };

  const onSubmit = async (data: ProductFormValues) => {
    try {
      const payload = {
        ...data,
        imageUrl: data.imageUrl ?? null,
      };
      if (editingProduct) {
        await updateProduct.mutateAsync({
          id: editingProduct.id,
          data: payload,
        });
        toast({ title: "Product updated" });
      } else {
        await createProduct.mutateAsync({
          data: payload,
        });
        toast({ title: "Product created" });
      }
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      setIsAddOpen(false);
      setEditingProduct(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save product",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteProduct.mutateAsync({ id: deletingId });
      toast({ title: "Product deleted" });
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage your inventory and pricing
          </p>
        </div>
        <Button onClick={onOpenAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Product
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search products..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[300px]">Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-5 w-[200px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-[100px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-[80px] ml-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-[60px] ml-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8 ml-auto rounded-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : products?.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-48 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center">
                    <Package className="w-10 h-10 mb-3 opacity-20" />
                    <p>No products found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              products?.map((product) => {
                const src = resolveProductImageSrc(product.imageUrl);
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {src ? (
                            <img
                              src={src}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-muted-foreground opacity-50" />
                          )}
                        </div>
                        <div>
                          {product.name}
                          {product.category && (
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              {product.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {product.sku || "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatKES(product.priceCents)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {product.stock <= 5 && (
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        )}
                        <span
                          className={
                            product.stock <= 5
                              ? "text-destructive font-bold"
                              : ""
                          }
                        >
                          {product.stock}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onOpenEdit(product)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeletingId(product.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={isAddOpen || !!editingProduct}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingProduct(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Add Product"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Update product details."
                : "Add a new product to your inventory."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Image</FormLabel>
                    <FormControl>
                      <ImageField
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Maize Flour 2kg" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="priceCents"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (Cents)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        100 cents = KSh 1.00
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Stock</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Barcode / ID"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Groceries"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddOpen(false);
                    setEditingProduct(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createProduct.isPending || updateProduct.isPending
                  }
                >
                  {editingProduct ? "Save Changes" : "Create Product"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this product? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteProduct.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
