"use client"

/**
 * Adobe Spectrum Workflow icons (@spectrum-web-components/icons-workflow), exposed under the
 * names the app already imported from lucide-react so screens switch by import path alone.
 *
 * Each icon is the official `sp-icon-*` element. Its module is loaded on first use in the
 * browser; on the server it renders as an empty inline element of the same box.
 */
import { useEffect, type CSSProperties, type ReactElement } from "react"

import { ensureSpectrumTheme } from "./theme-ready"

const loaders: Record<string, () => Promise<unknown>> = {
  "add": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-add.js"),
  "add-circle": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-add-circle.js"),
  "alert-circle": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-alert-circle.js"),
  "alert-triangle": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-alert-triangle.js"),
  "asset": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-asset.js"),
  "badge-verified": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-badge-verified.js"),
  "brush": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-brush.js"),
  "building": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-building.js"),
  "calendar": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-calendar.js"),
  "cancel": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-cancel.js"),
  "chart-bar-vert": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-chart-bar-vert.js"),
  "chart-trend": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-chart-trend.js"),
  "chat": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-chat.js"),
  "check-box": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-check-box.js"),
  "checkmark": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-checkmark.js"),
  "checkmark-circle": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-checkmark-circle.js"),
  "chevron-down": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-chevron-down.js"),
  "chevron-left": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-chevron-left.js"),
  "chevron-right": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-chevron-right.js"),
  "chevron-up": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-chevron-up.js"),
  "circle": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-circle.js"),
  "clock": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-clock.js"),
  "close": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-close.js"),
  "close-circle": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-close-circle.js"),
  "comment": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-comment.js"),
  "comment-text": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-comment-text.js"),
  "compare": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-compare.js"),
  "contrast": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-contrast.js"),
  "copy": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-copy.js"),
  "cursor-click": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-cursor-click.js"),
  "data": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-data.js"),
  "data-settings": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-data-settings.js"),
  "delete": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-delete.js"),
  "device-phone": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-device-phone.js"),
  "document": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-document.js"),
  "download": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-download.js"),
  "edit": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-edit.js"),
  "email": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-email.js"),
  "erase": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-erase.js"),
  "filter": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-filter.js"),
  "folder-open": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-folder-open.js"),
  "gift": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-gift.js"),
  "globe-grid": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-globe-grid.js"),
  "grids-and-rulers": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-grids-and-rulers.js"),
  "home": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-home.js"),
  "image": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-image.js"),
  "image-add": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-image-add.js"),
  "info-circle": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-info-circle.js"),
  "layers": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-layers.js"),
  "layout": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-layout.js"),
  "leave": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-leave.js"),
  "light": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-light.js"),
  "lightbulb": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-lightbulb.js"),
  "link": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-link.js"),
  "link-out": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-link-out.js"),
  "list-bulleted": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-list-bulleted.js"),
  "magic-wand": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-magic-wand.js"),
  "maximize": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-maximize.js"),
  "microphone": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-microphone.js"),
  "minimize": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-minimize.js"),
  "more": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-more.js"),
  "pause": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-pause.js"),
  "play": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-play.js"),
  "plugin": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-plugin.js"),
  "prototyping": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-prototyping.js"),
  "rectangle": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-rectangle.js"),
  "refresh": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-refresh.js"),
  "remove-circle": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-remove-circle.js"),
  "save-floppy": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-save-floppy.js"),
  "search": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-search.js"),
  "send": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-send.js"),
  "settings": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-settings.js"),
  "shopping-cart": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-shopping-cart.js"),
  "shuffle": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-shuffle.js"),
  "speed-fast": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-speed-fast.js"),
  "tag": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-tag.js"),
  "undo": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-undo.js"),
  "unlink": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-unlink.js"),
  "upload": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-upload.js"),
  "user": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-user.js"),
  "user-group": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-user-group.js"),
  "video": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-video.js"),
  "view-grid": () => import("@spectrum-web-components/icons-workflow/icons/sp-icon-view-grid.js"),
}

export type IconProps = {
  className?: string
  style?: CSSProperties
  size?: number | string
  title?: string
  "aria-hidden"?: boolean | "true" | "false"
  /** Accepted for lucide compatibility; Spectrum icons have a fixed stroke. */
  strokeWidth?: number | string
  absoluteStrokeWidth?: boolean
}

export type LucideIcon = (props: IconProps) => ReactElement
export type LucideProps = IconProps

function useIconModule(name: string) {
  useEffect(() => {
    void ensureSpectrumTheme().then(() => loaders[name]?.())
  }, [name])
}

function spectrumSize(size: IconProps["size"]): CSSProperties | undefined {
  if (size == null) return undefined
  const px = typeof size === "number" ? `${size}px` : size

  return { inlineSize: px, blockSize: px }
}

/** Generic entry point: `<Icon name="add" />` with any Workflow icon that is registered above. */
export function Icon({ name, className, style, size, title, ...rest }: IconProps & { name: string }) {
  useIconModule(name)
  const Tag = `sp-icon-${name}` as unknown as "span"

  return (
    <Tag
      data-icon=""
      className={className}
      style={{ ...spectrumSize(size), ...style }}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      role={title ? "img" : undefined}
      {...(rest as object)}
    />
  )
}

/** Spinner: Spectrum has no spinner glyph, it uses an indeterminate progress circle. */
export const Loader2: LucideIcon = ({ className, size, style, ...rest }) => {
  useEffect(() => {
    void ensureSpectrumTheme().then(() => import("@spectrum-web-components/progress-circle/sp-progress-circle.js"))
  }, [])
  const Tag = "sp-progress-circle" as unknown as "span"

  return <Tag data-icon="" className={className} style={{ ...spectrumSize(size), ...style }} {...(rest as object)} {...({ indeterminate: true, size: "s", label: "Carregando" } as object)} />
}

function icon(name: string): LucideIcon {
  return function NamedIcon(props) {
    return <Icon name={name} {...props} />
  }
}
export const Activity = icon("chart-trend")
export const AlertCircle = icon("alert-circle")
export const AlertTriangle = icon("alert-triangle")
export const ArrowDown = icon("chevron-down")
export const ArrowLeft = icon("chevron-left")
export const ArrowLeftRight = icon("compare")
export const ArrowRight = icon("chevron-right")
export const ArrowUp = icon("chevron-up")
export const ArrowUpRight = icon("link-out")
export const BarChart3 = icon("chart-bar-vert")
export const Bot = icon("magic-wand")
export const Brain = icon("lightbulb")
export const BrickWall = icon("view-grid")
export const Building2 = icon("building")
export const Calendar = icon("calendar")
export const CalendarDays = icon("calendar")
export const Check = icon("checkmark")
export const CheckCheck = icon("checkmark")
export const CheckCircle = icon("checkmark-circle")
export const CheckCircle2 = icon("checkmark-circle")
export const CheckSquare = icon("check-box")
export const ChevronDown = icon("chevron-down")
export const ChevronLeft = icon("chevron-left")
export const ChevronRight = icon("chevron-right")
export const Circle = icon("circle")
export const Clock = icon("clock")
export const Clock3 = icon("clock")
export const Coins = icon("data")
export const Columns2 = icon("layout")
export const Copy = icon("copy")
export const Cpu = icon("data-settings")
export const CreditCard = icon("shopping-cart")
export const Database = icon("data")
export const DatabaseZap = icon("data")
export const Download = icon("download")
export const Edit = icon("edit")
export const Edit2 = icon("edit")
export const Eraser = icon("erase")
export const ExternalLink = icon("link-out")
export const FileText = icon("document")
export const Filter = icon("filter")
export const FolderOpen = icon("folder-open")
export const Gift = icon("gift")
export const GitBranch = icon("prototyping")
export const Globe = icon("globe-grid")
export const Globe2 = icon("globe-grid")
export const Grid2X2 = icon("view-grid")
export const Hash = icon("tag")
export const House = icon("home")
export const Image = icon("image")
export const ImagePlus = icon("image-add")
export const Inbox = icon("email")
export const Info = icon("info-circle")
export const Layers = icon("layers")
export const Layers3 = icon("layers")
export const LayoutGrid = icon("view-grid")
export const List = icon("list-bulleted")
export const LogOut = icon("leave")
export const Mail = icon("email")
export const Maximize = icon("maximize")
export const MessageCircle = icon("comment")
export const MessageSquare = icon("chat")
export const MessageSquareText = icon("comment-text")
export const Mic = icon("microphone")
export const Minimize = icon("minimize")
export const Minus = icon("remove-circle")
export const Moon = icon("contrast")
export const MoreVertical = icon("more")
export const MousePointer2 = icon("cursor-click")
export const PackagePlus = icon("add-circle")
export const Paintbrush = icon("brush")
export const PanelRightClose = icon("maximize")
export const PanelRightOpen = icon("maximize")
export const PanelsTopLeft = icon("view-grid")
export const Paperclip = icon("link")
export const Pause = icon("pause")
export const Phone = icon("device-phone")
export const Play = icon("play")
export const Plus = icon("add")
export const Power = icon("cancel")
export const QrCode = icon("grids-and-rulers")
export const RefreshCcw = icon("refresh")
export const RefreshCw = icon("refresh")
export const RotateCcw = icon("undo")
export const Save = icon("save-floppy")
export const Search = icon("search")
export const Send = icon("send")
export const Server = icon("plugin")
export const Settings = icon("settings")
export const Shield = icon("badge-verified")
export const ShieldCheck = icon("badge-verified")
export const ShoppingBag = icon("shopping-cart")
export const Shuffle = icon("shuffle")
export const Smartphone = icon("device-phone")
export const Sofa = icon("asset")
export const Sparkles = icon("magic-wand")
export const Split = icon("prototyping")
export const Square = icon("rectangle")
export const Sun = icon("light")
export const Tag = icon("tag")
export const Ticket = icon("tag")
export const Trash2 = icon("delete")
export const Unlink = icon("unlink")
export const Upload = icon("upload")
export const User = icon("user")
export const UserCheck = icon("user")
export const UserRound = icon("user")
export const Users = icon("user-group")
export const Video = icon("video")
export const Workflow = icon("prototyping")
export const Wrench = icon("settings")
export const X = icon("close")
export const XCircle = icon("close-circle")
export const XIcon = icon("close")
export const Zap = icon("speed-fast")
