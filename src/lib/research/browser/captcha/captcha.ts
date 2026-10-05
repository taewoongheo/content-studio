import type { Locator, Page } from "playwright";
import sharp from "sharp";
import { browserBlock } from "../blocks";
import { recognizeCaptcha } from "./engine";

export type CaptchaOptions = { type: "slider" | "rotate"; backgroundSelector: string;
  pieceSelector: string; sliderSelector: string; trackSelector: string };
const responseLimit = 4 * 1024 * 1024;
export function solutionDistance(data: unknown, type: CaptchaOptions["type"], geometry: { backgroundX: number; pieceX: number; trackWidth: number; handleWidth: number; imageScale?: number }) {
  if (!data || typeof data !== "object") throw new Error("The local solver returned no solution.");
  const solution = data as { x?: number; cw?: number };
  const value = type === "slider" ? solution.x : solution.cw;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("The local solver returned an invalid solution.");
  const available = geometry.trackWidth - geometry.handleWidth;
  const distance = type === "slider" ? value * (geometry.imageScale ?? 1) - (geometry.pieceX - geometry.backgroundX) : value / 360 * available;
  if (distance < 0 || distance > available) throw new Error("The solution is outside the visible slider track.");
  return distance;
}
async function challengeImage(locator: Locator) {
  // Screenshotting a background also captures an overlaid puzzle piece, which
  // creates a false match at its starting position. Extract original pixels.
  const encoded = await locator.evaluate(element => {
    if (element instanceof HTMLCanvasElement) return element.toDataURL("image/png");
    if (!(element instanceof HTMLImageElement) || !element.complete || !element.naturalWidth)
      throw new Error("Challenge pixels are unavailable.");
    const canvas = document.createElement("canvas");
    canvas.width = element.naturalWidth; canvas.height = element.naturalHeight;
    if (canvas.width * canvas.height > 4_000_000) throw new Error("Challenge image dimensions are too large.");
    canvas.getContext("2d")!.drawImage(element, 0, 0);
    return canvas.toDataURL("image/png");
  });
  if (encoded.length > responseLimit * 2) throw new Error("Challenge pixels exceed the size limit.");
  const bytes = Buffer.from(encoded.split(",")[1], "base64");
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width) throw new Error("Challenge pixel dimensions are unavailable.");
  return { bytes, width: metadata.width };
}
export async function solveCaptcha(page: Page, options: CaptchaOptions) {
  const current = await browserBlock(page);
  if (current?.reason !== "captcha_required") throw new Error("No visible CAPTCHA is currently confirmed in this session.");
  const background = page.locator(options.backgroundSelector).first();
  const piece = page.locator(options.pieceSelector).first();
  const handle = page.locator(options.sliderSelector).first();
  const track = page.locator(options.trackSelector).first();
  if (!(await background.isVisible()) || !(await piece.isVisible()) || !(await handle.isVisible()) || !(await track.isVisible()))
    return { status: "unsupported_challenge", message: "The expected challenge controls were not found. Inspect this browser and provide matching selectors, or use computer use." };
  const [bgBox, pieceBox, handleBox, trackBox] = await Promise.all([background.boundingBox(), piece.boundingBox(), handle.boundingBox(), track.boundingBox()]);
  if (!bgBox || !pieceBox || !handleBox || !trackBox) throw new Error("Challenge geometry is not available.");
  let bg, thumb;
  try { [bg, thumb] = await Promise.all([challengeImage(background), challengeImage(piece)]); }
  catch { return { status: "unsupported_challenge", message: "Original challenge pixels cannot be extracted from these controls. Use computer use in this session." }; }
  if (bg.bytes.length + thumb.bytes.length > responseLimit) throw new Error("Challenge images exceed the solver size limit.");
  const solution = await recognizeCaptcha(options.type, bg.bytes, thumb.bytes);
  if (!solution) return { status: "solver_unavailable", message: "Run pnpm setup:captcha to install the pinned local recognition engine, or use computer use in this session." };
  const distance = solutionDistance(solution, options.type, { backgroundX: bgBox.x, pieceX: pieceBox.x, trackWidth: trackBox.width, handleWidth: handleBox.width, imageScale: bgBox.width / bg.width });
  const startX = handleBox.x + handleBox.width / 2, startY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(startX, startY); await page.mouse.down();
  try { await page.mouse.move(startX + distance, startY, { steps: 20 }); } finally { await page.mouse.up(); }
  // Recognition is not proof of acceptance. Verify the visible challenge state;
  // the subsequent collection must also succeed to establish source access.
  await page.waitForTimeout(1500);
  const block = await browserBlock(page);
  return { status: block?.reason === "captcha_required" ? "challenge_remaining" : block ? "blocked" : "challenge_cleared",
    ...(block ? { block: { reason: block.reason, message: block.message } } : {}),
    message: "Call resume_collection to confirm whether source data is now accessible." };
}
