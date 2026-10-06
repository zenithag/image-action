import { IMAGE_TYPES, MAX_UPLOAD_BYTES } from "./studio-v1"

const uploadMaxDimension = 2000
const uploadWebpQuality = 0.88

function loadBrowserImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Nao foi possivel preparar a imagem selecionada."))
    image.src = url
  })
}

function canvasToWebpDataUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Nao foi possivel converter a imagem para WebP."))
        return
      }

      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("Nao foi possivel carregar a imagem convertida."))
      reader.readAsDataURL(blob)
    }, "image/webp", uploadWebpQuality)
  })
}

export async function fileToOptimizedWebpDataUrl(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error("Use imagens JPG, PNG ou WebP.")
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Cada imagem deve ter no máximo 15 MB.")
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadBrowserImage(objectUrl)
    const scale = Math.min(
      1,
      uploadMaxDimension / image.naturalWidth,
      uploadMaxDimension / image.naturalHeight
    )
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")

    if (!context) {
      throw new Error("Nao foi possivel otimizar a imagem selecionada.")
    }

    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    return canvasToWebpDataUrl(canvas)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
