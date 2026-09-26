// Turn one Flipkart "self-serve/orders" API response into plain order records.

const IST = 5.5 * 3600e3;

export function istTime(ms) {
  return new Date(ms + IST).toISOString().slice(0, 16).replace("T", " ");
}

/** Orders in one response, newest first. */
export function parseOrders(body) {
  const v = body?.RESPONSE?.multipleOrderDetailsView;
  if (!v) throw new Error("unexpected response: no multipleOrderDetailsView");
  const products = (o) => o.productDataBag ?? {};
  return (v.orders ?? []).map((o) => {
    const m = o.orderMetaData;
    const money = o.orderMoneyDataBag ?? {};
    const units = Object.values(o.units ?? {}).map((u) => {
      const md = u.metaData ?? {};
      const p = products(o)[md.listingId]?.productBasicData ?? products(o)[md.fsn]?.productBasicData ?? {};
      const pay = (u.moneyDataBag?.paymentMethods ?? []).map((x) => ({
        mode: (x.paymentMode ?? [])[0] ?? "",
        amount: x.amounts?.[0]?.inrValue ?? null,
      }));
      return {
        title: md.title ?? p.title ?? "",
        size: p.subTitle ?? "",
        qty: md.quantity ?? 1,
        price: u.moneyDataBag?.amount ?? null,
        status: md.status?.key ?? "",
        pay,
      };
    });
    return {
      id: m.orderId,
      time: istTime(m.orderDate),
      ms: m.orderDate,
      kind: m.orderMarketPlaceMeta === "HYPERLOCAL" ? "minutes" : (m.orderMarketPlaceMeta ?? "").toLowerCase(),
      amount: money.amount ?? null,
      pay: money.paymentMethods ?? [],
      items: groupUnits(units),
    };
  });
}

/** The query params for the next page, or null when there is none. */
export function nextParams(body) {
  const v = body?.RESPONSE?.multipleOrderDetailsView;
  if (!v?.moreOrder || !v.nextCallParams) return null;
  return Object.fromEntries(v.nextCallParams.filter((p) => p.type === "QUERY_PARAM").map((p) => [p.key, p.value]));
}

/** One line per product: Flipkart lists each unit of a product separately. */
export function groupUnits(units) {
  const by = new Map();
  for (const u of units) {
    const k = `${u.title}|${u.size}|${u.status}`;
    const g = by.get(k);
    if (!g) by.set(k, { ...u, pay: [...u.pay] });
    else {
      g.qty += u.qty;
      g.price = Math.round(((g.price ?? 0) + (u.price ?? 0)) * 100) / 100;
      g.pay.push(...u.pay);
    }
  }
  return [...by.values()];
}
