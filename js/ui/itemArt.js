// Artwork is presentation data; calculations never read it.
export function itemArt(artwork, rotation = 0) {
  if (artwork.imageUrl && artwork.imageRegion) {
    // The SVG is only a viewport over a shared PNG atlas, not vector artwork.
    const { x, y, width, height, atlasWidth, atlasHeight } = artwork.imageRegion;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('item-art');
    const turns = ((Number(rotation) % 4) + 4) % 4;
    const rotatedWidth = turns % 2 ? height : width;
    const rotatedHeight = turns % 2 ? width : height;
    svg.setAttribute('viewBox', `0 0 ${rotatedWidth} ${rotatedHeight}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('href', artwork.imageUrl);
    image.setAttribute('width', atlasWidth);
    image.setAttribute('height', atlasHeight);
    const viewport = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    viewport.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
    viewport.setAttribute('width', width);
    viewport.setAttribute('height', height);
    viewport.setAttribute('overflow', 'hidden');
    viewport.append(image);
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('transform', `translate(${rotatedWidth / 2} ${rotatedHeight / 2}) rotate(${turns * 90}) translate(${-width / 2} ${-height / 2})`);
    group.append(viewport);
    svg.append(group);
    return svg.outerHTML;
  }
  if (artwork.imageUrl) {
    const image = document.createElement('img');
    image.className = 'item-art';
    image.src = artwork.imageUrl;
    image.alt = '';
    image.draggable = false;
    return image.outerHTML;
  }
  const span = document.createElement('span');
  span.textContent = artwork.glyph;
  return span.outerHTML;
}
