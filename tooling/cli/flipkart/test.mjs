import assert from "node:assert/strict";
import test from "node:test";
import { groupUnits, istTime, nextParams, parseOrders } from "./parse.mjs";

const unit = (id, title, price, status = "Delivered") => ({
  metaData: { title, quantity: 1, listingId: "L" + title, status: { key: status } },
  moneyDataBag: { amount: price, paymentMethods: [{ paymentMode: ["UPI"], amounts: [{ inrValue: price }] }] },
});
const body = {
  RESPONSE: { multipleOrderDetailsView: {
    moreOrder: true,
    nextCallParams: [{ key: "st", type: "QUERY_PARAM", value: "1" }, { key: "ot", type: "QUERY_PARAM", value: "2" }],
    orders: [{
      orderMetaData: { orderId: "OD1", orderDate: Date.UTC(2026, 8, 26, 15, 36), orderMarketPlaceMeta: "HYPERLOCAL" },
      orderMoneyDataBag: { amount: 120, paymentMethods: ["UPI"] },
      productDataBag: { LBread: { productBasicData: { title: "Bread", subTitle: "400 g" } } },
      units: { a: unit("a", "Bread", 50), b: unit("b", "Bread", 50), c: unit("c", "Milk", 20, "Cancelled") },
    }],
  } },
};

test("parses an order in IST with grouped items", () => {
  const [o] = parseOrders(body);
  assert.equal(o.id, "OD1");
  assert.equal(o.time, "2026-09-26 21:06");
  assert.equal(o.kind, "minutes");
  assert.equal(o.amount, 120);
  assert.deepEqual(o.items.map((i) => [i.title, i.size, i.qty, i.price, i.status]),
    [["Bread", "400 g", 2, 100, "Delivered"], ["Milk", "", 1, 20, "Cancelled"]]);
});

test("next page params, and none at the end", () => {
  assert.deepEqual(nextParams(body), { st: "1", ot: "2" });
  const last = structuredClone(body);
  last.RESPONSE.multipleOrderDetailsView.moreOrder = false;
  assert.equal(nextParams(last), null);
});

test("an unexpected response fails loudly", () => {
  assert.throws(() => parseOrders({ RESPONSE: {} }), /unexpected response/);
});

test("groupUnits keeps different statuses apart", () => {
  const g = groupUnits([{ title: "A", size: "", status: "Delivered", qty: 1, price: 5, pay: [] },
    { title: "A", size: "", status: "Cancelled", qty: 1, price: 5, pay: [] }]);
  assert.equal(g.length, 2);
  assert.equal(istTime(0), "1970-01-01 05:30");
});
