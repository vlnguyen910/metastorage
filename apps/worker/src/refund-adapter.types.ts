export interface RefundAdapter {
  refund(input: {
    refundId: string;
    amount: string;
    currency: string;
  }): Promise<{ reference: string }>;
}
