// Decimal preview using integer hundredths, matching backend Decimal half-even rounding.

export function hundredths(value: string): bigint {

  if (!/^\d+(\.\d{0,2})?$/.test(value)) throw new Error("Saisissez un montant positif avec deux décimales maximum.");

  const [whole, fraction = ""] = value.split(".");

  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));

}

export function invoicePreview(lines: Array<{ quantity?: string; unit_price?: string; discount_amount?: string }>, discount: string) {

  let subtotal = BigInt(0);

  for (const line of lines) {

    const product = hundredths(line.quantity ?? "1") * hundredths(line.unit_price ?? "0");

    function round(value: bigint) {
      const quotient = value / BigInt(100), remainder = value % BigInt(100);
      return quotient + (remainder > BigInt(50) || (remainder === BigInt(50) && quotient % BigInt(2) === BigInt(1)) ? BigInt(1) : BigInt(0));
    }
    const lineDiscount = hundredths(line.discount_amount ?? "0");
    if (lineDiscount > round(product)) throw new Error("La remise dépasse le montant de la prestation.");
    const net = round(product - lineDiscount * BigInt(100));
    subtotal += net;

  }

  const total = subtotal - hundredths(discount);

  if (total < BigInt(0)) throw new Error("La remise facture dépasse le sous-total.");

  return `${total / BigInt(100)}.${String(total % BigInt(100)).padStart(2, "0")}`;

}

