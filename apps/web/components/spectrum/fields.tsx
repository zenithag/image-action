"use client"

/**
 * Drop-in replacements for native form controls, rendered as Adobe Spectrum elements.
 *
 * Each wrapper keeps the props and the `onChange(event)` contract of the element it replaces
 * (`event.target.value` / `.checked`), so screens only change their import. Visual classes passed
 * by callers (borders, background, padding, height, type size) are dropped on purpose: the
 * Spectrum element owns its look. Layout classes (width, flex, margin, grid placement) are kept.
 */
import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useImperativeHandle,
  useRef,
  type ChangeEvent,
  type ComponentProps,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react"

import { useSpectrum } from "./use-spectrum"

// ---------------------------------------------------------------------------------------------
// helpers

import { layoutClasses } from "./layout-classes"

type Synthetic<T> = ChangeEvent<T>

function changeEvent<T extends Element>(source: Element, native: Event, fields: { value?: string; checked?: boolean }): Synthetic<T> {
  const target = {
    value: fields.value ?? "",
    checked: fields.checked ?? false,
    name: source.getAttribute("name") ?? "",
    id: source.id,
    type: source.getAttribute("type") ?? "",
    dataset: (source as HTMLElement).dataset,
  }

  return {
    target,
    currentTarget: target,
    nativeEvent: native,
    type: native.type,
    bubbles: native.bubbles,
    preventDefault: () => native.preventDefault(),
    stopPropagation: () => native.stopPropagation(),
    isDefaultPrevented: () => native.defaultPrevented,
    isPropagationStopped: () => false,
    persist: () => undefined,
  } as unknown as Synthetic<T>
}

function useListener(ref: { current: HTMLElement | null }, type: string, handler: (event: Event) => void) {
  const latest = useRef(handler)
  latest.current = handler

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const listener = (event: Event) => latest.current(event)
    element.addEventListener(type, listener)

    return () => element.removeEventListener(type, listener)
  }, [ref, type])
}

function setProperty(element: HTMLElement | null, key: string, value: unknown) {
  if (!element) return
  const target = element as unknown as Record<string, unknown>
  if (target[key] !== value) target[key] = value
}

type CommonProps = {
  className?: string
  style?: CSSProperties
  id?: string
  name?: string
  title?: string
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
  "aria-label"?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean | "true" | "false"
}

// ---------------------------------------------------------------------------------------------
// Input (text-like) -> sp-textfield, number -> sp-number-field, checkbox -> sp-checkbox

const TEXT_TYPES = new Set(["text", "email", "password", "search", "url", "tel"])

type InputProps = Omit<ComponentProps<"input">, "onChange" | "ref" | "size"> & {
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  const type = typeof props.type === "string" ? props.type : "text"

  if (type === "checkbox") return <Checkbox {...(props as CheckboxProps)} ref={ref} />
  if (type === "number") return <NumberInput {...(props as NumberInputProps)} ref={ref} />
  if (!TEXT_TYPES.has(type)) {
    // file, range, color, date, hidden, submit...: Spectrum has no equivalent, keep the native element.
    const { onChange, ...rest } = props
    return <input {...rest} onChange={onChange} ref={ref} />
  }

  return <TextField {...props} ref={ref} multiline={false} />
})

type TextFieldProps = InputProps & { multiline?: boolean; rows?: number }

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { className, style, value, defaultValue, onChange, type, multiline, rows, placeholder, disabled, readOnly, required, autoFocus, autoComplete, maxLength, minLength, pattern, id, name, title, ...rest },
  forwardedRef,
) {
  const ref = useRef<HTMLElement>(null)
  useImperativeHandle(forwardedRef, () => ref.current as unknown as HTMLInputElement)
  const ready = useSpectrum("textfield")

  useEffect(() => {
    if (value !== undefined) setProperty(ref.current, "value", value == null ? "" : String(value))
  }, [value, ready])

  useListener(ref, "input", (event) => {
    const element = event.target as HTMLElement & { value?: string }
    onChange?.(changeEvent<HTMLInputElement>(element, event, { value: element.value ?? "" }))
  })

  const minHeight = multiline && rows ? `${rows * 22 + 12}px` : undefined

  return (
    <sp-textfield
      ref={ref}
      className={layoutClasses(className)}
      style={{ ...(minHeight ? { minHeight } : null), ...style }}
      id={id}
      title={title}
      {...({
        name,
        type: type === "search" ? "text" : type,
        multiline: multiline || undefined,
        grows: multiline || undefined,
        placeholder,
        disabled: disabled || undefined,
        readonly: readOnly || undefined,
        required: required || undefined,
        autofocus: autoFocus || undefined,
        autocomplete: autoComplete,
        maxlength: maxLength,
        minlength: minLength,
        pattern,
        value: value !== undefined ? (value == null ? "" : String(value)) : defaultValue != null ? String(defaultValue) : undefined,
      } as object)}
      {...(rest as object)}
    />
  )
})

type TextareaProps = Omit<ComponentProps<"textarea">, "onChange" | "ref"> & {
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(props, ref) {
  return <TextField {...(props as unknown as TextFieldProps)} multiline ref={ref as unknown as React.Ref<HTMLInputElement>} />
})

type NumberInputProps = Omit<InputProps, "value" | "defaultValue"> & {
  value?: string | number | readonly string[]
  defaultValue?: string | number | readonly string[]
}

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { className, style, value, defaultValue, onChange, min, max, step, disabled, required, placeholder, id, name, title, ...rest },
  forwardedRef,
) {
  const ref = useRef<HTMLElement>(null)
  useImperativeHandle(forwardedRef, () => ref.current as unknown as HTMLInputElement)
  const ready = useSpectrum("numberField")
  const toNumber = (input: unknown) => {
    if (input === "" || input == null) return Number.NaN
    const parsed = Number(input)

    return Number.isFinite(parsed) ? parsed : Number.NaN
  }

  useEffect(() => {
    if (value !== undefined) setProperty(ref.current, "value", toNumber(value))
  }, [value, ready])

  useListener(ref, "change", (event) => {
    const element = event.target as HTMLElement & { value?: number }
    const next = element.value
    onChange?.(changeEvent<HTMLInputElement>(element, event, { value: typeof next === "number" && !Number.isNaN(next) ? String(next) : "" }))
  })

  return (
    <sp-number-field
      ref={ref}
      className={layoutClasses(className)}
      style={style}
      id={id}
      title={title}
      {...({
        name,
        placeholder,
        min: min != null ? Number(min) : undefined,
        max: max != null ? Number(max) : undefined,
        step: step != null ? Number(step) : undefined,
        disabled: disabled || undefined,
        required: required || undefined,
        value: toNumber(value !== undefined ? value : defaultValue),
        "hide-stepper": true,
      } as object)}
      {...(rest as object)}
    />
  )
})

type CheckboxProps = Omit<ComponentProps<"input">, "onChange" | "ref" | "size" | "type"> & {
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  children?: ReactNode
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, style, checked, defaultChecked, onChange, disabled, required, id, name, title, children, "aria-label": ariaLabel },
  forwardedRef,
) {
  const ref = useRef<HTMLElement>(null)
  useImperativeHandle(forwardedRef, () => ref.current as unknown as HTMLInputElement)
  const ready = useSpectrum("checkbox")

  useEffect(() => {
    if (checked !== undefined) setProperty(ref.current, "checked", Boolean(checked))
  }, [checked, ready])

  useListener(ref, "change", (event) => {
    const element = event.target as HTMLElement & { checked?: boolean }
    onChange?.(changeEvent<HTMLInputElement>(element, event, { checked: Boolean(element.checked) }))
  })

  return (
    <sp-checkbox
      ref={ref}
      className={layoutClasses(className)}
      style={style}
      id={id}
      title={title}
      aria-label={ariaLabel}
      {...({
        name,
        emphasized: true,
        disabled: disabled || undefined,
        required: required || undefined,
        checked: checked !== undefined ? Boolean(checked) : defaultChecked || undefined,
      } as object)}
    >
      {children}
    </sp-checkbox>
  )
})

// ---------------------------------------------------------------------------------------------
// select -> sp-picker

type OptionItem = { value: string; label: ReactNode; disabled?: boolean }

const EMPTY = "__empty__"

function collectOptions(children: ReactNode, into: OptionItem[] = []): OptionItem[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    const element = child as ReactElement<{ value?: unknown; disabled?: boolean; children?: ReactNode }>

    if (element.type === "option") {
      const text = Children.toArray(element.props.children).join("")
      into.push({ value: element.props.value != null ? String(element.props.value) : text, label: text, disabled: element.props.disabled })
    } else if (element.props?.children) {
      collectOptions(element.props.children, into)
    }
  })

  return into
}

type SelectProps = Omit<ComponentProps<"select">, "onChange" | "ref" | "size"> & {
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void
}

export const NativeSelect = forwardRef<HTMLSelectElement, SelectProps>(function NativeSelect(
  { className, style, value, defaultValue, onChange, children, disabled, required, id, name, title, "aria-label": ariaLabel },
  forwardedRef,
) {
  const ref = useRef<HTMLElement>(null)
  useImperativeHandle(forwardedRef, () => ref.current as unknown as HTMLSelectElement)
  const ready = useSpectrum("picker", "menu")
  const options = collectOptions(children)
  const encode = (input: unknown) => (input == null || input === "" ? EMPTY : String(input))
  const current = value !== undefined ? encode(value) : defaultValue !== undefined ? encode(defaultValue) : undefined
  const signature = options.map((option) => option.value).join("\u0000")

  useEffect(() => {
    if (current !== undefined) setProperty(ref.current, "value", current)
  }, [current, ready, signature])

  useListener(ref, "change", (event) => {
    const element = event.target as HTMLElement & { value?: string }
    const next = element.value === EMPTY ? "" : (element.value ?? "")
    onChange?.(changeEvent<HTMLSelectElement>(element, event, { value: next }))
  })

  return (
    <sp-picker
      ref={ref}
      className={layoutClasses(className)}
      style={style}
      id={id}
      title={title}
      label={ariaLabel ?? "Selecionar"}
      {...({ name, disabled: disabled || undefined, required: required || undefined, value: current } as object)}
    >
      {options.map((option) => (
        <sp-menu-item key={option.value} value={encode(option.value)} {...(option.disabled ? { disabled: true } : null)}>
          {option.label}
        </sp-menu-item>
      ))}
    </sp-picker>
  )
})
