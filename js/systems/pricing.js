// Used condition belongs to the instance; catalog prices remain unchanged.
export function itemPrice(definition, item, usedPriceRate = 1) {
  return Math.floor(definition.price * (item?.used ? usedPriceRate : 1));
}
