import type { WebGLRenderer } from "three";

type RendererCtor = new (params?: {
  alpha?: boolean;
  antialias?: boolean;
  powerPreference?: WebGLPowerPreference;
  stencil?: boolean;
  depth?: boolean;
}) => WebGLRenderer;

/** Shared WebGLRenderer setup for dynamically-imported three.js scenes. */
export function createAlphaRenderer(
  WebGLRenderer: RendererCtor,
  host: HTMLElement,
  { pixelRatio, antialias }: { pixelRatio: number; antialias: boolean },
): WebGLRenderer {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias,
    powerPreference: "high-performance",
    stencil: false,
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);
  return renderer;
}
