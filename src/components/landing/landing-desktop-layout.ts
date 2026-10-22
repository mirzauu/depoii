/** Shared desktop tour geometry — mock + caption split the viewport without overlap. */

export type LandingDesktopLayout = {
  pad: number;
  gap: number;
  mockW: number;
  captionW: number;
};

export function computeLandingDesktopLayout(vw: number): LandingDesktopLayout {
  const pad = vw >= 1440 ? 48 : vw >= 1280 ? 36 : 24;
  const gap = vw >= 1440 ? 32 : vw >= 1280 ? 24 : 16;
  const available = Math.max(320, vw - pad * 2);

  // Caption needs readable line length; mock takes the rest (capped).
  const captionMin = vw >= 1400 ? 340 : vw >= 1200 ? 300 : 260;
  const captionMax = Math.min(420, Math.floor(available * 0.38));
  const mockMax = Math.min(800, Math.floor(available * 0.64));
  const mockMin = Math.min(440, Math.floor(available * 0.5));

  let captionW = Math.min(captionMax, Math.max(captionMin, available - mockMax - gap));
  let mockW = available - captionW - gap;

  if (mockW > mockMax) {
    mockW = mockMax;
    captionW = available - mockW - gap;
  }
  if (mockW < mockMin) {
    mockW = mockMin;
    captionW = Math.max(captionMin, available - mockW - gap);
  }

  // Final clamp if the viewport is tight
  if (mockW + captionW + gap > available) {
    const overflow = mockW + captionW + gap - available;
    const fromCaption = Math.min(overflow, Math.max(0, captionW - captionMin));
    captionW -= fromCaption;
    mockW -= overflow - fromCaption;
  }

  return {
    pad,
    gap,
    mockW: Math.max(280, Math.round(mockW)),
    captionW: Math.max(220, Math.round(captionW)),
  };
}

export function applyLandingDesktopLayout(layout: LandingDesktopLayout) {
  const root = document.documentElement;
  root.style.setProperty("--landing-pad", `${layout.pad}px`);
  root.style.setProperty("--landing-gap", `${layout.gap}px`);
  root.style.setProperty("--landing-mock-w", `${layout.mockW}px`);
  root.style.setProperty("--landing-caption-w", `${layout.captionW}px`);
}

export function clearLandingDesktopLayout() {
  const root = document.documentElement;
  root.style.removeProperty("--landing-pad");
  root.style.removeProperty("--landing-gap");
  root.style.removeProperty("--landing-mock-w");
  root.style.removeProperty("--landing-caption-w");
}
