const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
        Checkout isn't live yet. Complete payments go-live to accept real payments.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-center text-sm text-accent-foreground">
        Test mode — payments in the preview are not real. Use card 4242 4242 4242 4242.
      </div>
    );
  }
  return null;
}
