import { getDataSource } from "./db/data-source";

export async function syncRevenueForPayment(contract: any, payment: any, ds?: any) {
  const dataSource = ds || (await getDataSource());
  const revenueRepo = dataSource.getRepository("Revenue");
  const paymentId = String((payment as any).id);
  const description = "دفعة إيجار";

  const existing = await revenueRepo.findOne({
    where: [
      { payment_id: paymentId } as any,
      { description: `دفعة إيجار #${paymentId}` } as any,
      { description: `${paymentId}# دفعة إيجار` } as any,
    ],
  });

  const isPaid = String((payment as any).status) === "paid";
  if (!isPaid) {
    if (existing) await revenueRepo.delete(existing.id);
    return;
  }

  const amount = Number((payment as any).amount_sar) || 0;
  const receivedAt = (payment as any).paid_at ? new Date((payment as any).paid_at) : new Date();
  const paymentMethod = (payment as any).payment_method || "تحويل بنكي";

  if (existing) {
    await revenueRepo.update(existing.id, {
      amount_sar: amount,
      received_at: receivedAt,
      payment_method: paymentMethod,
      description,
    } as any);
    return;
  }

  const revenue = revenueRepo.create({
    owner_id: String((contract as any).owner_id),
    property_id: (contract as any).property_id ? String((contract as any).property_id) : null,
    unit_id: (contract as any).unit_id ? String((contract as any).unit_id) : null,
    contract_id: String(contract.id),
    contact_id: (contract as any).contact_id ? String((contract as any).contact_id) : null,
    payment_id: paymentId,
    type: "إيجار",
    amount_sar: amount,
    payment_method: paymentMethod,
    received_at: receivedAt,
    description,
  } as any);
  await revenueRepo.save(revenue);
}

export async function deleteRevenueForPayment(paymentId: string, ds?: any) {
  const dataSource = ds || (await getDataSource());
  const revenueRepo = dataSource.getRepository("Revenue");
  const existing = await revenueRepo.findOne({
    where: [
      { payment_id: paymentId } as any,
      { description: `دفعة إيجار #${paymentId}` } as any,
      { description: `${paymentId}# دفعة إيجار` } as any,
    ],
  });
  if (existing) await revenueRepo.delete(existing.id);
}
