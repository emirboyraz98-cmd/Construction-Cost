// Formların boş satırları; hem sunucu sayfalarında (ilk değer) hem istemci formlarında kullanılır.
const newKey = () => Math.random().toString(36).slice(2);

export const emptyConnectionItem = (vatRate: string) => ({
  key: newKey(),
  description: "",
  costItemCode: null as string | null,
  unit: "",
  quantity: "",
  unitPrice: "",
  vatRate,
});

export const emptyConnectionPayment = () => ({
  key: newKey(),
  dueDate: "",
  amount: "",
  description: "",
  paymentMethod: null as null,
  instrumentNo: "",
});

export const emptyContractItem = () => ({
  key: newKey(),
  costItemId: null as string | null,
  description: "",
  unit: "",
  quantity: "",
  unitPrice: "",
});
