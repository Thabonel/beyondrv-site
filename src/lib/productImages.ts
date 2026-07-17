export interface ProductHeroReplacement {
  heroImage: string;
  gallery: string[];
}

function uniqueImages(images: string[]) {
  return [...new Set(images.map(image => image.trim()).filter(Boolean))];
}

export function replaceProductHero(
  previousHero: string | undefined,
  nextHero: string,
  gallery: string[],
): ProductHeroReplacement {
  const oldHero = previousHero?.trim() ?? '';
  const newHero = nextHero.trim();
  const cleanGallery = uniqueImages(gallery);

  if (!newHero || newHero === oldHero) {
    return { heroImage: newHero, gallery: cleanGallery };
  }

  const selectedIndex = cleanGallery.indexOf(newHero);
  const insertionIndex = selectedIndex >= 0
    ? cleanGallery.slice(0, selectedIndex).filter(image => image !== oldHero && image !== newHero).length
    : 0;
  const nextGallery = cleanGallery.filter(image => image !== oldHero && image !== newHero);

  if (oldHero) nextGallery.splice(insertionIndex, 0, oldHero);

  return { heroImage: newHero, gallery: nextGallery };
}
