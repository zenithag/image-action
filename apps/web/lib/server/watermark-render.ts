import sharp from "sharp"
import { getWatermarkBox, type WatermarkSettings } from "@/lib/watermark-layout"

/** Uses the same contain box and alpha as the settings preview. */
export async function renderLogoWatermark(logoBytes: Buffer, width: number, height: number, settings: WatermarkSettings) {
  const box = getWatermarkBox(width, height, settings)
  const resizedLogo = await sharp(logoBytes)
    .resize({ width: box.width, height: box.height, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()
  const opacityMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}"><rect width="100%" height="100%" fill="white" opacity="${box.opacity}" /></svg>`)
  const transparentLogo = await sharp(resizedLogo).ensureAlpha()
    .composite([{ input: opacityMask, blend: "dest-in" }]).png().toBuffer()
  return { input: transparentLogo, left: box.left, top: box.top }
}
