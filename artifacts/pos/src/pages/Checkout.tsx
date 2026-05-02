import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useCart } from "@/contexts/CartContext";
import { formatKES } from "@/lib/utils";
import { useCreateOrder, useMpesaStkPush, useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Smartphone, Banknote, CheckCircle2, XCircle, RefreshCw, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const CASHIER_NAME_KEY = "smartbuy.cashierName";
const STK_TIMEOUT_SECONDS = 60;

const checkoutSchema = z.object({
  paymentMethod: z.enum(["cash", "mpesa"]),
  cashierName: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === "mpesa") {
    if (!data.customerPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phone number is required for M-Pesa",
        path: ["customerPhone"]
      });
    } else {
      const phoneRegex = /^(?:254|\+254|0)?([17]\d{8})$/;
      if (!phoneRegex.test(data.customerPhone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid phone format (e.g. 0712345678 or 254712345678)",
          path: ["customerPhone"]
        });
      }
    }
  }
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

type PollingStep = "sending" | "waiting" | "confirmed" | "failed";

function MpesaWaitingScreen({
  totalCents,
  phone,
  onCancel,
  onResend,
  orderStatus,
  isResending,
}: {
  totalCents: number;
  phone: string;
  onCancel: () => void;
  onResend: () => void;
  orderStatus: "pending" | "paid" | "failed" | "cancelled" | undefined;
  isResending: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setElapsed(0);
    intervalRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (orderStatus === "paid" || orderStatus === "failed") {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [orderStatus]);

  const step: PollingStep =
    orderStatus === "paid" ? "confirmed" :
    orderStatus === "failed" ? "failed" :
    elapsed < 5 ? "sending" : "waiting";

  const canResend = elapsed >= 30 && step === "waiting";
  const displayPhone = phone.startsWith("254") ? `0${phone.slice(3)}` : phone;

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const steps = [
    {
      id: "sending",
      label: "STK Push Sent",
      desc: `Prompt sent to ${displayPhone}`,
      done: step !== "sending",
      active: step === "sending",
    },
    {
      id: "waiting",
      label: "Awaiting Customer PIN",
      desc: "Customer enters M-Pesa PIN",
      done: step === "confirmed" || step === "failed",
      active: step === "waiting",
      failed: step === "failed",
    },
    {
      id: "confirmed",
      label: step === "failed" ? "Payment Failed" : "Payment Confirmed",
      desc: step === "confirmed" ? "Transaction complete" : step === "failed" ? "Cancelled or insufficient funds" : "Waiting for confirmation",
      done: step === "confirmed",
      active: false,
      failed: step === "failed",
    },
  ];

  return (
    <div className="h-full flex items-center justify-center bg-background p-4">
      <Card className={`w-full max-w-md shadow-xl transition-all duration-300 ${
        step === "confirmed" ? "border-green-500/40" :
        step === "failed" ? "border-destructive/40" :
        "border-primary/20"
      }`}>
        <CardHeader className="text-center pb-4">
          <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${
            step === "confirmed" ? "bg-green-500/10" :
            step === "failed" ? "bg-destructive/10" :
            "bg-primary/10"
          }`}>
            {step === "confirmed" ? (
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            ) : step === "failed" ? (
              <XCircle className="w-10 h-10 text-destructive" />
            ) : (
              <Smartphone className="w-10 h-10 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {step === "confirmed" ? "Payment Confirmed!" :
             step === "failed" ? "Payment Failed" :
             "Awaiting M-Pesa Payment"}
          </CardTitle>
          <CardDescription className="text-base mt-1">
            {step === "confirmed" ? "The transaction was successful." :
             step === "failed" ? "The customer cancelled or the transaction failed." :
             `Check ${displayPhone} for the M-Pesa PIN prompt`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Amount</p>
            <p className="text-5xl font-black tracking-tight text-primary">
              {formatKES(totalCents)}
            </p>
          </div>

          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-start gap-3">
                <div className={`mt-0.5 w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  s.failed ? "bg-destructive text-white" :
                  s.done ? "bg-green-500 text-white" :
                  s.active ? "bg-primary text-white ring-4 ring-primary/20" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {s.failed ? "✕" : s.done ? "✓" : s.active ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    s.failed ? "text-destructive" :
                    s.done ? "text-green-600" :
                    s.active ? "text-foreground" :
                    "text-muted-foreground"
                  }`}>{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {step !== "confirmed" && step !== "failed" && (
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 rounded-lg px-4 py-2">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Elapsed: {formatElapsed(elapsed)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span>Checking every 2s</span>
              </div>
            </div>
          )}

          {canResend && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Customer hasn't responded yet. You can resend the prompt.
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {step !== "confirmed" && step !== "failed" && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={onResend}
              disabled={!canResend || isResending}
            >
              {isResending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {canResend ? "Resend STK Push" : `Resend available in ${Math.max(0, 30 - elapsed)}s`}
            </Button>
          )}
          <Button
            variant={step === "confirmed" || step === "failed" ? "default" : "ghost"}
            className="w-full text-destructive hover:text-destructive"
            onClick={onCancel}
          >
            {step === "failed" ? "Back to Checkout" : step === "confirmed" ? "Done" : "Cancel Payment"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { items, totalCents, clearCart } = useCart();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [activePhone, setActivePhone] = useState<string>("");
  const [isPolling, setIsPolling] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const createOrder = useCreateOrder();
  const stkPush = useMpesaStkPush();

  const { data: orderStatus } = useGetOrder(activeOrderId || 0, {
    query: {
      enabled: isPolling && activeOrderId !== null,
      refetchInterval: (query) => {
        const state = query.state.data;
        if (state?.status === "paid" || state?.status === "failed") {
          return false;
        }
        return 2000;
      },
      queryKey: getGetOrderQueryKey(activeOrderId || 0),
    }
  });

  const savedCashier =
    typeof window !== "undefined"
      ? window.localStorage.getItem(CASHIER_NAME_KEY) ?? ""
      : "";

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      paymentMethod: "mpesa",
      cashierName: savedCashier,
      customerName: "",
      customerPhone: "",
    }
  });

  const paymentMethod = form.watch("paymentMethod");

  useEffect(() => {
    if (items.length === 0 && !activeOrderId) {
      setLocation("/");
    }
  }, [items, setLocation, activeOrderId]);

  useEffect(() => {
    if (isPolling && orderStatus) {
      if (orderStatus.status === "paid") {
        setIsPolling(false);
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        setTimeout(() => {
          clearCart();
          setLocation(`/receipt/${activeOrderId}`);
        }, 1200);
      } else if (orderStatus.status === "failed") {
        setIsPolling(false);
      }
    }
  }, [isPolling, orderStatus, activeOrderId, clearCart, setLocation, queryClient]);

  const normalizePhone = (phone: string) => {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = "254" + cleaned.substring(1);
    } else if (cleaned.startsWith("+254")) {
      cleaned = "254" + cleaned.substring(4);
    } else if (cleaned.length === 9) {
      cleaned = "254" + cleaned;
    }
    return cleaned;
  };

  const onSubmit = async (data: CheckoutFormValues) => {
    if (items.length === 0) return;

    try {
      const orderItems = items.map(item => ({
        productId: item.product.id,
        quantity: item.quantity
      }));

      const cashierName = data.cashierName?.trim() || undefined;
      if (cashierName) {
        window.localStorage.setItem(CASHIER_NAME_KEY, cashierName);
      } else {
        window.localStorage.removeItem(CASHIER_NAME_KEY);
      }

      const newOrder = await createOrder.mutateAsync({
        data: {
          items: orderItems,
          paymentMethod: data.paymentMethod,
          cashierName,
          customerName: data.customerName || undefined,
          customerPhone: data.customerPhone || undefined,
        }
      });

      if (data.paymentMethod === "cash") {
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        clearCart();
        setLocation(`/receipt/${newOrder.id}`);
      } else if (data.paymentMethod === "mpesa") {
        const normalizedPhone = normalizePhone(data.customerPhone!);
        setActiveOrderId(newOrder.id);
        setActivePhone(normalizedPhone);
        await stkPush.mutateAsync({
          data: { orderId: newOrder.id, phoneNumber: normalizedPhone }
        });
        setIsPolling(true);
      }
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      toast({
        title: "Checkout Failed",
        description: err.data?.error || "An error occurred during checkout.",
        variant: "destructive",
      });
      setActiveOrderId(null);
      setActivePhone("");
      setIsPolling(false);
    }
  };

  const handleResend = useCallback(async () => {
    if (!activeOrderId || !activePhone) return;
    setIsResending(true);
    try {
      await stkPush.mutateAsync({
        data: { orderId: activeOrderId, phoneNumber: activePhone }
      });
      toast({ title: "STK Push Resent", description: "A new M-Pesa prompt has been sent." });
      setIsPolling(true);
    } catch {
      toast({ title: "Resend Failed", description: "Could not resend the M-Pesa prompt.", variant: "destructive" });
    } finally {
      setIsResending(false);
    }
  }, [activeOrderId, activePhone, stkPush, toast]);

  const handleCancel = useCallback(() => {
    setIsPolling(false);
    setActiveOrderId(null);
    setActivePhone("");
  }, []);

  const isProcessing = createOrder.isPending || stkPush.isPending;

  if (isPolling && activeOrderId) {
    return (
      <MpesaWaitingScreen
        totalCents={totalCents}
        phone={activePhone}
        onCancel={handleCancel}
        onResend={handleResend}
        orderStatus={orderStatus?.status as "pending" | "paid" | "failed" | "cancelled" | undefined}
        isResending={isResending}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Checkout</h1>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Details</CardTitle>
                <CardDescription>Select payment method and enter customer info</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form id="checkout-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Payment Method</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="grid grid-cols-2 gap-4"
                            >
                              <FormItem>
                                <FormControl>
                                  <div className="relative">
                                    <RadioGroupItem value="mpesa" id="mpesa" className="peer sr-only" />
                                    <Label
                                      htmlFor="mpesa"
                                      className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                                    >
                                      <Smartphone className="mb-3 h-8 w-8" />
                                      <span className="font-bold">M-Pesa</span>
                                    </Label>
                                  </div>
                                </FormControl>
                              </FormItem>
                              <FormItem>
                                <FormControl>
                                  <div className="relative">
                                    <RadioGroupItem value="cash" id="cash" className="peer sr-only" />
                                    <Label
                                      htmlFor="cash"
                                      className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                                    >
                                      <Banknote className="mb-3 h-8 w-8" />
                                      <span className="font-bold">Cash</span>
                                    </Label>
                                  </div>
                                </FormControl>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4 pt-4 border-t border-border">
                      <FormField
                        control={form.control}
                        name="cashierName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cashier Name (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Jane" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {paymentMethod === "mpesa" && (
                        <FormField
                          control={form.control}
                          name="customerPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Customer Phone Number *</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. 0712345678" {...field} className="text-lg py-6" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="customerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Customer Name (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="bg-muted/30 border-b border-border">
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border max-h-[40vh] overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.product.id} className="p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-sm bg-muted text-foreground w-8 h-8 rounded-full flex items-center justify-center">
                          {item.quantity}x
                        </div>
                        <div>
                          <p className="font-medium text-sm">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">{formatKES(item.product.priceCents)} each</p>
                        </div>
                      </div>
                      <div className="font-bold">
                        {formatKES(item.product.priceCents * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="flex-col items-stretch p-6 bg-muted/10 border-t border-border gap-6">
                <div className="flex justify-between items-end">
                  <span className="text-lg font-medium text-muted-foreground">Total</span>
                  <span className="text-4xl font-black text-primary">{formatKES(totalCents)}</span>
                </div>

                <Button
                  type="submit"
                  form="checkout-form"
                  className="w-full py-8 text-xl font-bold shadow-lg"
                  size="lg"
                  disabled={isProcessing || items.length === 0}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                      Processing...
                    </>
                  ) : paymentMethod === "mpesa" ? (
                    "Send STK Push"
                  ) : (
                    "Complete Cash Sale"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
