"use client"

import { useEffect, type CSSProperties, type ReactElement } from "react"
import {
  Activity as ActivityGlyph,
  AlertCircle as AlertCircleGlyph,
  AlertTriangle as AlertTriangleGlyph,
  ArrowDown as ArrowDownGlyph,
  ArrowLeft as ArrowLeftGlyph,
  ArrowLeftRight as ArrowLeftRightGlyph,
  ArrowRight as ArrowRightGlyph,
  ArrowUp as ArrowUpGlyph,
  ArrowUpRight as ArrowUpRightGlyph,
  BarChart3 as BarChart3Glyph,
  Bot as BotGlyph,
  Brain as BrainGlyph,
  BrickWall as BrickWallGlyph,
  Building2 as Building2Glyph,
  Calendar as CalendarGlyph,
  CalendarDays as CalendarDaysGlyph,
  Check as CheckGlyph,
  CheckCheck as CheckCheckGlyph,
  CheckCircle as CheckCircleGlyph,
  CheckCircle2 as CheckCircle2Glyph,
  CheckSquare as CheckSquareGlyph,
  ChevronDown as ChevronDownGlyph,
  ChevronLeft as ChevronLeftGlyph,
  ChevronRight as ChevronRightGlyph,
  Circle as CircleGlyph,
  Clock as ClockGlyph,
  Clock3 as Clock3Glyph,
  Coins as CoinsGlyph,
  Columns2 as Columns2Glyph,
  Copy as CopyGlyph,
  Cpu as CpuGlyph,
  CreditCard as CreditCardGlyph,
  Database as DatabaseGlyph,
  DatabaseZap as DatabaseZapGlyph,
  Download as DownloadGlyph,
  Edit as EditGlyph,
  Edit2 as Edit2Glyph,
  Eraser as EraserGlyph,
  ExternalLink as ExternalLinkGlyph,
  FileText as FileTextGlyph,
  Filter as FilterGlyph,
  FolderOpen as FolderOpenGlyph,
  Gift as GiftGlyph,
  GitBranch as GitBranchGlyph,
  Globe as GlobeGlyph,
  Globe2 as Globe2Glyph,
  Grid2X2 as Grid2X2Glyph,
  Hash as HashGlyph,
  House as HouseGlyph,
  Image as ImageGlyph,
  ImagePlus as ImagePlusGlyph,
  Inbox as InboxGlyph,
  Info as InfoGlyph,
  Layers as LayersGlyph,
  Layers3 as Layers3Glyph,
  LayoutGrid as LayoutGridGlyph,
  List as ListGlyph,
  LogOut as LogOutGlyph,
  Mail as MailGlyph,
  Maximize as MaximizeGlyph,
  MessageCircle as MessageCircleGlyph,
  MessageSquare as MessageSquareGlyph,
  MessageSquareText as MessageSquareTextGlyph,
  Mic as MicGlyph,
  Minimize as MinimizeGlyph,
  Minus as MinusGlyph,
  Moon as MoonGlyph,
  MoreVertical as MoreVerticalGlyph,
  MousePointer2 as MousePointer2Glyph,
  PackagePlus as PackagePlusGlyph,
  Paintbrush as PaintbrushGlyph,
  PanelRightClose as PanelRightCloseGlyph,
  PanelRightOpen as PanelRightOpenGlyph,
  PanelsTopLeft as PanelsTopLeftGlyph,
  Paperclip as PaperclipGlyph,
  Pause as PauseGlyph,
  Phone as PhoneGlyph,
  Play as PlayGlyph,
  Plus as PlusGlyph,
  Power as PowerGlyph,
  QrCode as QrCodeGlyph,
  RefreshCcw as RefreshCcwGlyph,
  RefreshCw as RefreshCwGlyph,
  RotateCcw as RotateCcwGlyph,
  Save as SaveGlyph,
  Search as SearchGlyph,
  Send as SendGlyph,
  Server as ServerGlyph,
  Settings as SettingsGlyph,
  Shield as ShieldGlyph,
  ShieldCheck as ShieldCheckGlyph,
  ShoppingBag as ShoppingBagGlyph,
  Shuffle as ShuffleGlyph,
  Smartphone as SmartphoneGlyph,
  Sofa as SofaGlyph,
  Sparkles as SparklesGlyph,
  Split as SplitGlyph,
  Square as SquareGlyph,
  Sun as SunGlyph,
  Tag as TagGlyph,
  Ticket as TicketGlyph,
  Trash2 as Trash2Glyph,
  Unlink as UnlinkGlyph,
  Upload as UploadGlyph,
  User as UserGlyph,
  UserCheck as UserCheckGlyph,
  UserRound as UserRoundGlyph,
  Users as UsersGlyph,
  Video as VideoGlyph,
  Workflow as WorkflowGlyph,
  Wrench as WrenchGlyph,
  X as XGlyph,
  XCircle as XCircleGlyph,
  XIcon as XIconGlyph,
  Zap as ZapGlyph,
  type LucideIcon as OutlineIcon,
} from "lucide-react"

import { ensureSpectrumTheme } from "./theme-ready"

export type IconProps = {
  className?: string
  style?: CSSProperties
  size?: number | string
  title?: string
  "aria-hidden"?: boolean | "true" | "false"
  /** Optional override for the default thin outline. */
  strokeWidth?: number | string
  absoluteStrokeWidth?: boolean
}

export type LucideIcon = (props: IconProps) => ReactElement
export type LucideProps = IconProps

function spectrumSize(size: IconProps["size"]): CSSProperties | undefined {
  if (size == null) return undefined
  const px = typeof size === "number" ? `${size}px` : size

  return { inlineSize: px, blockSize: px }
}

const glyphs: Record<string, OutlineIcon> = {
  "chart-trend": ActivityGlyph,
  "alert-circle": AlertCircleGlyph,
  "alert-triangle": AlertTriangleGlyph,
  "chevron-down": ArrowDownGlyph,
  "chevron-left": ArrowLeftGlyph,
  "compare": ArrowLeftRightGlyph,
  "chevron-right": ArrowRightGlyph,
  "chevron-up": ArrowUpGlyph,
  "link-out": ArrowUpRightGlyph,
  "chart-bar-vert": BarChart3Glyph,
  "magic-wand": BotGlyph,
  "lightbulb": BrainGlyph,
  "view-grid": BrickWallGlyph,
  "building": Building2Glyph,
  "calendar": CalendarGlyph,
  "checkmark": CheckGlyph,
  "checkmark-circle": CheckCircleGlyph,
  "check-box": CheckSquareGlyph,
  "circle": CircleGlyph,
  "clock": ClockGlyph,
  "data": CoinsGlyph,
  "layout": Columns2Glyph,
  "copy": CopyGlyph,
  "data-settings": CpuGlyph,
  "shopping-cart": CreditCardGlyph,
  "download": DownloadGlyph,
  "edit": EditGlyph,
  "erase": EraserGlyph,
  "document": FileTextGlyph,
  "filter": FilterGlyph,
  "folder-open": FolderOpenGlyph,
  "gift": GiftGlyph,
  "prototyping": GitBranchGlyph,
  "globe-grid": GlobeGlyph,
  "tag": HashGlyph,
  "home": HouseGlyph,
  "image": ImageGlyph,
  "image-add": ImagePlusGlyph,
  "email": InboxGlyph,
  "info-circle": InfoGlyph,
  "layers": LayersGlyph,
  "list-bulleted": ListGlyph,
  "leave": LogOutGlyph,
  "maximize": MaximizeGlyph,
  "comment": MessageCircleGlyph,
  "chat": MessageSquareGlyph,
  "comment-text": MessageSquareTextGlyph,
  "microphone": MicGlyph,
  "minimize": MinimizeGlyph,
  "remove-circle": MinusGlyph,
  "contrast": MoonGlyph,
  "more": MoreVerticalGlyph,
  "cursor-click": MousePointer2Glyph,
  "add-circle": PackagePlusGlyph,
  "brush": PaintbrushGlyph,
  "link": PaperclipGlyph,
  "pause": PauseGlyph,
  "device-phone": PhoneGlyph,
  "play": PlayGlyph,
  "add": PlusGlyph,
  "cancel": PowerGlyph,
  "grids-and-rulers": QrCodeGlyph,
  "refresh": RefreshCcwGlyph,
  "undo": RotateCcwGlyph,
  "save-floppy": SaveGlyph,
  "search": SearchGlyph,
  "send": SendGlyph,
  "plugin": ServerGlyph,
  "settings": SettingsGlyph,
  "badge-verified": ShieldGlyph,
  "shuffle": ShuffleGlyph,
  "asset": SofaGlyph,
  "rectangle": SquareGlyph,
  "light": SunGlyph,
  "delete": Trash2Glyph,
  "unlink": UnlinkGlyph,
  "upload": UploadGlyph,
  "user": UserGlyph,
  "user-group": UsersGlyph,
  "video": VideoGlyph,
  "close": XGlyph,
  "close-circle": XCircleGlyph,
  "speed-fast": ZapGlyph,
}

/** Shared thin outline icons for console navigation and controls. */
export function Icon({ name, className, style, size = 24, title, strokeWidth = 1.5, ...rest }: IconProps & { name: string }) {
  const Glyph = glyphs[name]
  if (!Glyph) return null
  return <Glyph data-icon="" className={className} style={style} size={size} strokeWidth={strokeWidth} aria-hidden={title ? undefined : true} aria-label={title} role={title ? "img" : undefined} {...rest} />
}

/** Spinner: Spectrum has no spinner glyph, it uses an indeterminate progress circle. */
export const Loader2: LucideIcon = ({ className, size, style, ...rest }) => {
  useEffect(() => {
    void ensureSpectrumTheme().then(() => import("@spectrum-web-components/progress-circle/sp-progress-circle.js"))
  }, [])
  const Tag = "sp-progress-circle" as unknown as "span"

  return <Tag data-icon="" className={className} style={{ ...spectrumSize(size), ...style }} {...(rest as object)} {...({ indeterminate: true, size: "s", label: "Carregando" } as object)} />
}

function icon(Glyph: OutlineIcon): LucideIcon {
  return function NamedIcon({ title, strokeWidth = 1.5, ...props }) {
    return <Glyph data-icon="" strokeWidth={strokeWidth} aria-hidden={title ? undefined : true} aria-label={title} role={title ? "img" : undefined} {...props} />
  }
}
export const Activity = icon(ActivityGlyph)
export const AlertCircle = icon(AlertCircleGlyph)
export const AlertTriangle = icon(AlertTriangleGlyph)
export const ArrowDown = icon(ArrowDownGlyph)
export const ArrowLeft = icon(ArrowLeftGlyph)
export const ArrowLeftRight = icon(ArrowLeftRightGlyph)
export const ArrowRight = icon(ArrowRightGlyph)
export const ArrowUp = icon(ArrowUpGlyph)
export const ArrowUpRight = icon(ArrowUpRightGlyph)
export const BarChart3 = icon(BarChart3Glyph)
export const Bot = icon(BotGlyph)
export const Brain = icon(BrainGlyph)
export const BrickWall = icon(BrickWallGlyph)
export const Building2 = icon(Building2Glyph)
export const Calendar = icon(CalendarGlyph)
export const CalendarDays = icon(CalendarDaysGlyph)
export const Check = icon(CheckGlyph)
export const CheckCheck = icon(CheckCheckGlyph)
export const CheckCircle = icon(CheckCircleGlyph)
export const CheckCircle2 = icon(CheckCircle2Glyph)
export const CheckSquare = icon(CheckSquareGlyph)
export const ChevronDown = icon(ChevronDownGlyph)
export const ChevronLeft = icon(ChevronLeftGlyph)
export const ChevronRight = icon(ChevronRightGlyph)
export const Circle = icon(CircleGlyph)
export const Clock = icon(ClockGlyph)
export const Clock3 = icon(Clock3Glyph)
export const Coins = icon(CoinsGlyph)
export const Columns2 = icon(Columns2Glyph)
export const Copy = icon(CopyGlyph)
export const Cpu = icon(CpuGlyph)
export const CreditCard = icon(CreditCardGlyph)
export const Database = icon(DatabaseGlyph)
export const DatabaseZap = icon(DatabaseZapGlyph)
export const Download = icon(DownloadGlyph)
export const Edit = icon(EditGlyph)
export const Edit2 = icon(Edit2Glyph)
export const Eraser = icon(EraserGlyph)
export const ExternalLink = icon(ExternalLinkGlyph)
export const FileText = icon(FileTextGlyph)
export const Filter = icon(FilterGlyph)
export const FolderOpen = icon(FolderOpenGlyph)
export const Gift = icon(GiftGlyph)
export const GitBranch = icon(GitBranchGlyph)
export const Globe = icon(GlobeGlyph)
export const Globe2 = icon(Globe2Glyph)
export const Grid2X2 = icon(Grid2X2Glyph)
export const Hash = icon(HashGlyph)
export const House = icon(HouseGlyph)
export const Image = icon(ImageGlyph)
export const ImagePlus = icon(ImagePlusGlyph)
export const Inbox = icon(InboxGlyph)
export const Info = icon(InfoGlyph)
export const Layers = icon(LayersGlyph)
export const Layers3 = icon(Layers3Glyph)
export const LayoutGrid = icon(LayoutGridGlyph)
export const List = icon(ListGlyph)
export const LogOut = icon(LogOutGlyph)
export const Mail = icon(MailGlyph)
export const Maximize = icon(MaximizeGlyph)
export const MessageCircle = icon(MessageCircleGlyph)
export const MessageSquare = icon(MessageSquareGlyph)
export const MessageSquareText = icon(MessageSquareTextGlyph)
export const Mic = icon(MicGlyph)
export const Minimize = icon(MinimizeGlyph)
export const Minus = icon(MinusGlyph)
export const Moon = icon(MoonGlyph)
export const MoreVertical = icon(MoreVerticalGlyph)
export const MousePointer2 = icon(MousePointer2Glyph)
export const PackagePlus = icon(PackagePlusGlyph)
export const Paintbrush = icon(PaintbrushGlyph)
export const PanelRightClose = icon(PanelRightCloseGlyph)
export const PanelRightOpen = icon(PanelRightOpenGlyph)
export const PanelsTopLeft = icon(PanelsTopLeftGlyph)
export const Paperclip = icon(PaperclipGlyph)
export const Pause = icon(PauseGlyph)
export const Phone = icon(PhoneGlyph)
export const Play = icon(PlayGlyph)
export const Plus = icon(PlusGlyph)
export const Power = icon(PowerGlyph)
export const QrCode = icon(QrCodeGlyph)
export const RefreshCcw = icon(RefreshCcwGlyph)
export const RefreshCw = icon(RefreshCwGlyph)
export const RotateCcw = icon(RotateCcwGlyph)
export const Save = icon(SaveGlyph)
export const Search = icon(SearchGlyph)
export const Send = icon(SendGlyph)
export const Server = icon(ServerGlyph)
export const Settings = icon(SettingsGlyph)
export const Shield = icon(ShieldGlyph)
export const ShieldCheck = icon(ShieldCheckGlyph)
export const ShoppingBag = icon(ShoppingBagGlyph)
export const Shuffle = icon(ShuffleGlyph)
export const Smartphone = icon(SmartphoneGlyph)
export const Sofa = icon(SofaGlyph)
export const Sparkles = icon(SparklesGlyph)
export const Split = icon(SplitGlyph)
export const Square = icon(SquareGlyph)
export const Sun = icon(SunGlyph)
export const Tag = icon(TagGlyph)
export const Ticket = icon(TicketGlyph)
export const Trash2 = icon(Trash2Glyph)
export const Unlink = icon(UnlinkGlyph)
export const Upload = icon(UploadGlyph)
export const User = icon(UserGlyph)
export const UserCheck = icon(UserCheckGlyph)
export const UserRound = icon(UserRoundGlyph)
export const Users = icon(UsersGlyph)
export const Video = icon(VideoGlyph)
export const Workflow = icon(WorkflowGlyph)
export const Wrench = icon(WrenchGlyph)
export const X = icon(XGlyph)
export const XCircle = icon(XCircleGlyph)
export const XIcon = icon(XIconGlyph)
export const Zap = icon(ZapGlyph)
