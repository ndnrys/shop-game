// Artwork is presentation data; calculations never read it.
export function itemArt(artwork) {
  if (artwork.imageUrl) {
    const image = document.createElement("img");
    image.className = "item-art";
    image.src = artwork.imageUrl;
    image.alt = "";
    image.draggable = false;
    return image.outerHTML;
  }
  const span = document.createElement("span");
  span.textContent = artwork.glyph;
  return span.outerHTML;
}
