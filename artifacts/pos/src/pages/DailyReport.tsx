import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Printer, Banknote, Smartphone, ShoppingBag, TrendingUp, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useGetSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { formatKES } from "@/lib/utils";

interface ReportItem {
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

interface ReportOrder {
  id: number;
  reference: string;
  paymentMethod: string;
  cashierName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  totalCents: number;
  createdAt: string;
  items: ReportItem[];
}

interface DailyReport {
  date: string;
  summary: {
    totalCents: number;
    cashCents: number;
    mpesaCents: number;
    cashCount: number;
    mpesaCount: number;
    orderCount: number;
  };
  orders: ReportOrder[];
}

function todayDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
}

function useDailyReport(date: string) {
  return useQuery<DailyReport>({
    queryKey: ["/api/reports/daily", date],
    queryFn: async () => {
      const res = await fetch(`/api/reports/daily?date=${date}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load report");
      return res.json() as Promise<DailyReport>;
    },
  });
}

export default function DailyReport() {
  const [date, setDate] = useState(todayDate);
  const { data, isLoading } = useDailyReport(date);
  const { data: settings } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey(), staleTime: 60_000 },
  });
  const businessName = settings?.businessName ?? "SmartBuy";

  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  function toggleOrder(id: number) {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const formattedDate = date
    ? format(new Date(`${date}T12:00:00`), "EEEE, d MMMM yyyy")
    : "";

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Daily Sales Report</h1>
          <p className="text-sm text-muted-foreground">
            View and print the full sales summary for any day.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            max={todayDate()}
            onChange={(e) => setDate(e.target.value)}
            className="border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            onClick={() => window.print()}
            disabled={!data || data.summary.orderCount === 0}
            className="gap-2"
          >
            <Printer className="w-4 h-4" />
            Print
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground py-12 text-center">
          Loading report…
        </div>
      )}

      {data && (
        <div id="report-print-area">
          {/* Print-only header */}
          <div className="hidden print:block text-center mb-6 pb-4 border-b-2 border-dashed border-gray-300">
            <h1 className="text-2xl font-black uppercase tracking-widest">{businessName}</h1>
            <p className="text-sm font-semibold mt-1">DAILY SALES REPORT</p>
            <p className="text-sm text-gray-600">{formattedDate}</p>
            <p className="text-xs text-gray-400 mt-1">Printed {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-4 print:gap-2">
            <SummaryCard
              icon={<TrendingUp className="w-5 h-5 text-primary" />}
              label="Total Revenue"
              value={formatKES(data.summary.totalCents)}
              highlight
            />
            <SummaryCard
              icon={<ShoppingBag className="w-5 h-5 text-blue-500" />}
              label="Orders"
              value={String(data.summary.orderCount)}
            />
            <SummaryCard
              icon={<Banknote className="w-5 h-5 text-green-600" />}
              label="Cash"
              value={formatKES(data.summary.cashCents)}
              sub={`${data.summary.cashCount} sale${data.summary.cashCount !== 1 ? "s" : ""}`}
            />
            <SummaryCard
              icon={<Smartphone className="w-5 h-5 text-orange-500" />}
              label="M-Pesa"
              value={formatKES(data.summary.mpesaCents)}
              sub={`${data.summary.mpesaCount} sale${data.summary.mpesaCount !== 1 ? "s" : ""}`}
            />
          </div>

          {data.summary.orderCount === 0 ? (
            <div className="text-center py-16 text-muted-foreground print:py-8">
              No paid sales recorded on {formattedDate}.
            </div>
          ) : (
            <>
              <Separator className="print:hidden" />

              {/* Transaction table — screen */}
              <div className="print:hidden space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {data.summary.orderCount} Transaction{data.summary.orderCount !== 1 ? "s" : ""}
                </h2>
                {data.orders.map((order) => {
                  const expanded = expandedOrders.has(order.id);
                  return (
                    <Card key={order.id} className="overflow-hidden">
                      <button
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                        onClick={() => toggleOrder(order.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-muted-foreground">
                              {order.reference}
                            </span>
                            <Badge
                              variant={order.paymentMethod === "mpesa" ? "default" : "secondary"}
                              className="text-xs uppercase"
                            >
                              {order.paymentMethod === "mpesa" ? (
                                <><Smartphone className="w-3 h-3 mr-1" />M-Pesa</>
                              ) : (
                                <><Banknote className="w-3 h-3 mr-1" />Cash</>
                              )}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span>{format(new Date(order.createdAt), "HH:mm")}</span>
                            {order.cashierName && <span>· {order.cashierName}</span>}
                            {order.customerName && <span>· {order.customerName}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-bold text-sm">{formatKES(order.totalCents)}</span>
                          {expanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>
                      {expanded && (
                        <div className="px-4 pb-3 border-t">
                          <table className="w-full text-xs mt-2">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="text-left pb-1 font-normal">Item</th>
                                <th className="text-right pb-1 font-normal">Qty</th>
                                <th className="text-right pb-1 font-normal">Price</th>
                                <th className="text-right pb-1 font-normal">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items.map((it, i) => (
                                <tr key={i} className="border-t border-muted/50">
                                  <td className="py-1 pr-2">{it.productName}</td>
                                  <td className="py-1 text-right">{it.quantity}</td>
                                  <td className="py-1 text-right">{formatKES(it.unitPriceCents)}</td>
                                  <td className="py-1 text-right font-medium">{formatKES(it.lineTotalCents)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>

              {/* Print-only transaction table */}
              <div className="hidden print:block mt-4">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-300 text-left">
                      <th className="pb-2 pr-2 font-semibold">Time</th>
                      <th className="pb-2 pr-2 font-semibold">Reference</th>
                      <th className="pb-2 pr-2 font-semibold">Cashier</th>
                      <th className="pb-2 pr-2 font-semibold">Items</th>
                      <th className="pb-2 pr-2 font-semibold">Method</th>
                      <th className="pb-2 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((order) => (
                      <tr key={order.id} className="border-b border-gray-200">
                        <td className="py-1.5 pr-2 whitespace-nowrap">
                          {format(new Date(order.createdAt), "HH:mm")}
                        </td>
                        <td className="py-1.5 pr-2 font-mono">{order.reference}</td>
                        <td className="py-1.5 pr-2">{order.cashierName ?? "—"}</td>
                        <td className="py-1.5 pr-2">
                          {order.items.map((it) => `${it.productName} ×${it.quantity}`).join(", ")}
                        </td>
                        <td className="py-1.5 pr-2 uppercase text-xs">{order.paymentMethod}</td>
                        <td className="py-1.5 text-right font-bold">{formatKES(order.totalCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-400 font-bold">
                      <td colSpan={5} className="pt-2">TOTAL</td>
                      <td className="pt-2 text-right">{formatKES(data.summary.totalCents)}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Print footer */}
                <div className="mt-6 pt-4 border-t border-dashed border-gray-300 text-xs text-gray-500 flex justify-between">
                  <span>Cash: {formatKES(data.summary.cashCents)} ({data.summary.cashCount} sales)</span>
                  <span>M-Pesa: {formatKES(data.summary.mpesaCents)} ({data.summary.mpesaCount} sales)</span>
                  <span>Total orders: {data.summary.orderCount}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/30 bg-primary/5" : ""}>
      <CardHeader className="pb-1 pt-4 px-4">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className={`text-xl font-black ${highlight ? "text-primary" : ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
