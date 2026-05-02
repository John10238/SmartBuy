import { useState } from "react";
import {
  useListOrders,
  useCancelOrder,
  useDeleteOrder,
  getListOrdersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatKES } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  ReceiptText,
  ExternalLink,
  MoreHorizontal,
  Ban,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type OrderRow = {
  id: number;
  reference: string;
  status: string;
  paymentMethod: string;
  totalCents: number;
  createdAt: string;
  customerName?: string | null;
  customerPhone?: string | null;
};

type ConfirmAction =
  | { kind: "cancel"; order: OrderRow }
  | { kind: "delete"; order: OrderRow }
  | null;

export default function Orders() {
  const { data: orders, isLoading } = useListOrders();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const cancelOrder = useCancelOrder();
  const deleteOrder = useDeleteOrder();
  const [confirm, setConfirm] = useState<ConfirmAction>(null);

  const isBusy = cancelOrder.isPending || deleteOrder.isPending;

  async function refreshOrders() {
    await queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
  }

  async function onConfirm() {
    if (!confirm) return;
    try {
      if (confirm.kind === "cancel") {
        await cancelOrder.mutateAsync({ id: confirm.order.id });
        toast({
          title: "Order cancelled",
          description: `${confirm.order.reference} marked as cancelled.`,
        });
      } else {
        await deleteOrder.mutateAsync({ id: confirm.order.id });
        toast({
          title: "Order deleted",
          description: `${confirm.order.reference} removed permanently.`,
        });
      }
      await refreshOrders();
      setConfirm(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Action failed";
      toast({
        title:
          confirm.kind === "cancel"
            ? "Couldn't cancel order"
            : "Couldn't delete order",
        description: message,
        variant: "destructive",
      });
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge
            variant="default"
            className="bg-green-500/10 text-green-700 border-green-200"
          >
            Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-500/10 text-yellow-700 border-yellow-200"
          >
            Pending
          </Badge>
        );
      case "cancelled":
        return (
          <Badge
            variant="outline"
            className="bg-muted text-muted-foreground border-muted-foreground/20"
          >
            Cancelled
          </Badge>
        );
      case "failed":
        return (
          <Badge
            variant="destructive"
            className="bg-red-500/10 text-red-700 border-red-200"
          >
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentMethodBadge = (method: string) => (
    <Badge variant="outline" className="uppercase font-mono text-[10px]">
      {method}
    </Badge>
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-1">
          View past transactions and receipts
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-5 w-[100px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-[120px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-[150px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-[80px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-[80px] rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-[80px] ml-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8 ml-auto rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : orders?.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-48 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center">
                    <ReceiptText className="w-10 h-10 mb-3 opacity-20" />
                    <p>No orders found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders?.map((order) => {
                const canCancel =
                  order.status !== "cancelled" && order.status !== "failed";
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {order.reference}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(order.createdAt), "dd MMM, HH:mm")}
                    </TableCell>
                    <TableCell>
                      {order.customerName || order.customerPhone ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {order.customerName || "Walk-in"}
                          </span>
                          {order.customerPhone && (
                            <span className="text-xs text-muted-foreground">
                              {order.customerPhone}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Walk-in
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getPaymentMethodBadge(order.paymentMethod)}
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right font-bold">
                      {formatKES(order.totalCents)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/receipt/${order.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            title="View receipt"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isBusy}
                              title="Order actions"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              disabled={!canCancel}
                              onSelect={() =>
                                setConfirm({ kind: "cancel", order })
                              }
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              Cancel order
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() =>
                                setConfirm({ kind: "delete", order })
                              }
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete order
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "cancel"
                ? "Cancel this order?"
                : "Delete this order?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm
                ? confirmDescription(confirm)
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>Keep order</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onConfirm();
              }}
              disabled={isBusy}
              className={
                confirm?.kind === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {isBusy
                ? "Working..."
                : confirm?.kind === "cancel"
                  ? "Cancel order"
                  : "Delete order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function confirmDescription(action: NonNullable<ConfirmAction>): string {
  const ref = action.order.reference;
  const wasPaid = action.order.status === "paid";
  if (action.kind === "cancel") {
    return wasPaid
      ? `Order ${ref} will be marked as cancelled and the items will be returned to stock.`
      : `Order ${ref} will be marked as cancelled. No stock changes are needed.`;
  }
  return wasPaid
    ? `Order ${ref} and its line items will be permanently deleted, and the items will be returned to stock. This cannot be undone.`
    : `Order ${ref} and its line items will be permanently deleted. This cannot be undone.`;
}
