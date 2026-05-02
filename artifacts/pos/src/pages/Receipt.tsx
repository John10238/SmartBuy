import { useParams, Link } from "wouter";
import {
  useGetOrder,
  getGetOrderQueryKey,
  useGetSettings,
  getGetSettingsQueryKey,
} from "@workspace/api-client-react";
import { formatKES } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Printer, ArrowLeft, CheckCircle2, Store } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Receipt() {
  const params = useParams();
  const orderId = parseInt(params.orderId || "0");

  const { data: order, isLoading, error } = useGetOrder(orderId, {
    query: {
      enabled: !!orderId,
      queryKey: getGetOrderQueryKey(orderId)
    }
  });

  const { data: settings } = useGetSettings({
    query: {
      queryKey: getGetSettingsQueryKey(),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  });
  const businessName = settings?.businessName ?? "SmartBuy";
  const logoUrl = settings?.logoUrl ?? null;

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30 p-4">
        <Skeleton className="w-[400px] h-[600px] rounded-xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-muted/30 p-4">
        <p className="text-muted-foreground mb-4">Order not found</p>
        <Link href="/">
          <Button>Back to Register</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-muted/30 py-8 px-4 flex flex-col items-center">
      <div className="w-full max-w-md flex justify-between items-center mb-6 print:hidden">
        <Link href="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            New Sale
          </Button>
        </Link>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" />
          Print Receipt
        </Button>
      </div>

      <Card id="receipt-print-area" className="w-full max-w-[400px] bg-white text-black p-8 shadow-sm print:shadow-none print:p-0 font-mono text-sm">
        {/* Header */}
        <div className="text-center mb-6 border-b-2 border-dashed border-gray-300 pb-6">
          <div className="flex justify-center mb-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={businessName}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="bg-black text-white p-2 rounded-lg">
                <Store className="w-8 h-8" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-black uppercase tracking-widest mb-1">
            {businessName}
          </h1>
          <p className="text-gray-500 text-xs uppercase tracking-wider">Nairobi, Kenya</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-green-600 bg-green-50 py-1.5 px-3 rounded-full w-max mx-auto">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-bold text-xs uppercase tracking-wider">Paid</span>
          </div>
        </div>

        {/* Meta Info */}
        <div className="mb-6 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Order #</span>
            <span className="font-bold">{order.reference}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date</span>
            <span>{format(new Date(order.createdAt), "dd MMM yyyy, HH:mm")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Cashier</span>
            <span>{order.cashierName || "—"}</span>
          </div>
          {order.customerName && (
            <div className="flex justify-between">
              <span className="text-gray-500">Customer</span>
              <span>{order.customerName}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="mb-6 border-t-2 border-b-2 border-dashed border-gray-300 py-4">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-200">
                <th className="pb-2 font-normal">Item</th>
                <th className="pb-2 font-normal text-right">Qty</th>
                <th className="pb-2 font-normal text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 pr-2">
                    <div className="font-medium line-clamp-2">{item.productName}</div>
                    <div className="text-xs text-gray-500">{formatKES(item.unitPriceCents)}</div>
                  </td>
                  <td className="py-2 text-right align-top">{item.quantity}</td>
                  <td className="py-2 text-right font-bold align-top">
                    {formatKES(item.lineTotalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mb-8 space-y-2">
          <div className="flex justify-between text-xl font-black">
            <span>TOTAL</span>
            <span>{formatKES(order.totalCents)}</span>
          </div>
        </div>

        {/* Payment Info */}
        <div className="text-xs space-y-1 mb-8 bg-gray-50 p-4 rounded">
          <div className="flex justify-between">
            <span className="text-gray-500">Payment Method</span>
            <span className="font-bold uppercase">{order.paymentMethod}</span>
          </div>
          {order.paymentMethod === "mpesa" && order.customerPhone && (
            <div className="flex justify-between mt-2">
              <span className="text-gray-500">M-Pesa Number</span>
              <span>{order.customerPhone}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-xs space-y-1 mt-auto">
          <p>Thank you for shopping with us!</p>
          <p>Karibu Tena</p>
        </div>
      </Card>
    </div>
  );
}