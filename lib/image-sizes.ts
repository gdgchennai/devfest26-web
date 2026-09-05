/**
 * Srcset widths next/image is allowed to request. Shared with `next.config.ts`
 * and the intro preloader — if these drift, the preloader warms URLs the
 * <Image> tags never ask for.
 *
 * 2048 and 3840 are omitted on purpose: nothing on this site paints that wide,
 * and those candidates are what hitch-decode when `sizes` is overstated.
 */
export const IMAGE_DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920];

/** Smaller than a viewport — tickets cards, speaker thumbs. */
export const IMAGE_IMAGE_SIZES = [256, 384];
