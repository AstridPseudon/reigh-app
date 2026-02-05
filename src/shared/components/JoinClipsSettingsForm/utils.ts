/**
 * Quantize total generation frames to 4N+1 format (required by Wan models)
 * Valid values: 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45, 49, 53, 57, 61, 65, 69, 73, 77, 81...
 *
 * For VACE models (used in join clips), minimum is 17 frames.
 */
export function quantizeTotalFrames(total: number, minTotal: number = 17): number {
    // Round to NEAREST 4N+1 format
    const quantizationFactor = Math.round((total - 1) / 4);
    const quantized = quantizationFactor * 4 + 1;
    return Math.max(minTotal, quantized);
}

/**
 * Get quantized gap frames for a given context, ensuring total = 2*context + gap is 4N+1
 * Makes MINIMAL adjustment to gap - only ±2 or ±0 to hit nearest valid total
 */
export function getQuantizedGap(desiredGap: number, context: number, minTotal: number = 17): number {
    const total = context * 2 + desiredGap;
    const quantizedTotal = quantizeTotalFrames(total, minTotal);
    const gap = quantizedTotal - context * 2;

    // Ensure gap is at least 1
    if (gap < 1) {
        // Find the next valid total that gives gap >= 1
        const minTotalForPositiveGap = context * 2 + 1;
        const validTotal = quantizeTotalFrames(minTotalForPositiveGap, minTotal);
        return validTotal - context * 2;
    }
    return gap;
}
