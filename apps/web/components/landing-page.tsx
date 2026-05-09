"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"

/* ── WhatsApp SVG icon ── */
const WaIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.7-.9-2.9-1.6-4-3.5-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4 0 1.4 1 2.8 1.2 3 .1.2 2 3 4.8 4.2 1.8.8 2.5.8 3.4.7.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.1-.6-.2zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3c1.5.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3C3.9 14.9 3.5 13.5 3.5 12 3.5 7.3 7.3 3.5 12 3.5S20.5 7.3 20.5 12 16.7 20 12 20z" />
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }}>
    <path d="M3 9l4 4 8-8" />
  </svg>
)

/* ── Reveal on scroll hook ── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.unobserve(el)
        }
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" }
    )
    io.observe(el)
    const t = setTimeout(() => setVisible(true), 2000)
    return () => { io.disconnect(); clearTimeout(t) }
  }, [])

  return { ref, className: visible ? "cf-reveal cf-in" : "cf-reveal" }
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const r = useReveal()
  return <div ref={r.ref} className={`${r.className} ${className}`}>{children}</div>
}

/* ── Compare slider ── */
function CompareSlider() {
  const cardRef = useRef<HTMLDivElement>(null)
  const [pct, setPct] = useState(50)
  const dragging = useRef(false)

  const setX = useCallback((clientX: number) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    let p = ((clientX - rect.left) / rect.width) * 100
    p = Math.max(2, Math.min(98, p))
    setPct(p)
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) setX(e.clientX) }
    const onUp = () => { dragging.current = false }
    const onTouchMove = (e: TouchEvent) => { if (dragging.current) setX(e.touches[0].clientX) }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onUp)
    }
  }, [setX])

  return (
    <div
      ref={cardRef}
      className="cf-compare-card"
      onMouseDown={(e) => { dragging.current = true; setX(e.clientX) }}
      onTouchStart={(e) => { dragging.current = true; setX(e.touches[0].clientX) }}
    >
      <div className="cf-layer cf-before" />
      <div className="cf-layer cf-after" style={{ clipPath: `inset(0 0 0 ${pct}%)` }} />
      <span className="cf-ph-tag cf-l">Antes</span>
      <span className="cf-ph-tag cf-r">Depois</span>
      <div className="cf-handle" style={{ left: `${pct}%` }}>
        <div className="cf-knob">{"\u21C6"}</div>
      </div>
    </div>
  )
}

/* ── Typing indicator ── */
function TypingDots() {
  return (
    <div className="cf-bubble cf-in cf-typing-bubble">
      <div className="cf-typing">
        <span /><span /><span />
      </div>
    </div>
  )
}

/* ── Message types ── */
type ChatMessage = {
  side: "in" | "out"
  text?: string
  time: string
  photo?: "before" | "after"
  photoStyle?: React.CSSProperties
  caption?: string
  link?: { title: string; url: string; desc: string }
  delay: number // ms before this message appears (after previous)
}

/* ── Animated chat ── */
function AnimatedChat({
  messages,
  header,
  loop = true,
}: {
  messages: ChatMessage[]
  header: React.ReactNode
  loop?: boolean
}) {
  const [visibleCount, setVisibleCount] = useState(0)
  const [showTyping, setShowTyping] = useState(false)
  const [typingSide, setTypingSide] = useState<"in" | "out">("in")
  const chatRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  const runSequence = useCallback(() => {
    clearAllTimeouts()
    setVisibleCount(0)
    setShowTyping(false)

    let cumulative = 800 // initial delay

    messages.forEach((msg, i) => {
      const typingStart = cumulative
      const typingDuration = Math.min(msg.delay, 1500)
      const messageAppear = typingStart + typingDuration

      // show typing indicator
      const t1 = setTimeout(() => {
        setTypingSide(msg.side)
        setShowTyping(true)
        // auto-scroll
        if (chatRef.current) {
          chatRef.current.scrollTop = chatRef.current.scrollHeight
        }
      }, typingStart)

      // show message, hide typing
      const t2 = setTimeout(() => {
        setShowTyping(false)
        setVisibleCount(i + 1)
        // auto-scroll after render
        requestAnimationFrame(() => {
          if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight
          }
        })
      }, messageAppear)

      timeoutsRef.current.push(t1, t2)
      cumulative = messageAppear + 400 // gap between messages
    })

    // loop: restart after a pause
    if (loop) {
      const t3 = setTimeout(() => {
        runSequence()
      }, cumulative + 3000)
      timeoutsRef.current.push(t3)
    }
  }, [messages, loop, clearAllTimeouts])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true
          runSequence()
        }
      },
      { threshold: 0.2 }
    )
    io.observe(el)
    return () => { io.disconnect(); clearAllTimeouts() }
  }, [runSequence, clearAllTimeouts])

  return (
    <div className="cf-phone" ref={containerRef}>
      <div className="cf-phone-screen">
        {header}
        <div className="cf-wa-chat cf-animated-chat" ref={chatRef}>
          {messages.slice(0, visibleCount).map((msg, i) => {
            if (msg.photo) {
              return (
                <div key={i} className={`cf-bubble ${msg.side === "in" ? "cf-in" : "cf-out"} cf-photo${msg.photo === "after" ? " cf-after" : ""} cf-msg-enter`}>
                  <div className={`cf-img${msg.photo === "before" ? " cf-img-before" : ""}`} style={msg.photoStyle} />
                  {msg.caption && <div className="cf-cap">{msg.caption}</div>}
                  <span className="cf-time" style={{ padding: "0 4px 4px" }}>
                    {msg.time}
                    {msg.side === "out" && <span className="cf-check"> {"\u2713\u2713"}</span>}
                  </span>
                </div>
              )
            }
            if (msg.link) {
              return (
                <div key={i} className={`cf-bubble ${msg.side === "in" ? "cf-in" : "cf-out"} cf-link cf-msg-enter`}>
                  <div className="cf-lp">
                    <div className="cf-ttl">{msg.link.title}</div>
                    <div className="cf-url">{msg.link.url}</div>
                    <div className="cf-desc">{msg.link.desc}</div>
                  </div>
                  <span className="cf-time" style={{ padding: "0 4px 4px" }}>
                    {msg.time}
                    {msg.side === "out" && <span className="cf-check"> {"\u2713\u2713"}</span>}
                  </span>
                </div>
              )
            }
            return (
              <div key={i} className={`cf-bubble ${msg.side === "in" ? "cf-in" : "cf-out"} cf-msg-enter`}>
                {msg.text}
                <span className="cf-time">
                  {msg.time}
                  {msg.side === "out" && <span className="cf-check"> {"\u2713\u2713"}</span>}
                </span>
              </div>
            )
          })}
          {showTyping && (
            <div style={{ alignSelf: typingSide === "in" ? "flex-start" : "flex-end" }}>
              <TypingDots />
            </div>
          )}
        </div>
        <div className="cf-wa-input">
          <span style={{ color: "#8696a0", padding: "0 6px" }}>{"\uFF0B"}</span>
          <div className="cf-field">Mensagem</div>
          <div className="cf-send">{"\u25B6"}</div>
        </div>
      </div>
    </div>
  )
}

/* ── Apps Carousel ── */
const appsData = [
  { title: "Pisos e Porcelanatos", desc: "Substitua o piso atual do cliente por qualquer item do seu mostruário.", img: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=600&h=450&fit=crop&q=80" },
  { title: "Revestimentos e Azulejos", desc: "Aplique paginação real em parede de banheiro, cozinha ou área externa.", img: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=600&h=450&fit=crop&q=80" },
  { title: "Tintas e Papéis de Parede", desc: "Pinte virtualmente qualquer parede em qualquer cor da sua linha.", img: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=450&fit=crop&q=80" },
  { title: "Móveis Planejados", desc: "Mostre cozinhas, dormitórios e closets renderizados no ambiente real do cliente.", img: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=600&h=450&fit=crop&q=80" },
  { title: "Móveis e Decoração", desc: "Sofás, mesas, estantes e poltronas aplicados com escala correta.", img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=450&fit=crop&q=80" },
  { title: "Iluminação", desc: "Lustres, pendentes e arandelas posicionados na altura e contexto certos.", img: "https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=600&h=450&fit=crop&q=80" },
  { title: "Áreas Externas", desc: "Decks, jardins, churrasqueiras e mobiliário de varanda.", img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=450&fit=crop&q=80" },
]

function AppsCarousel() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)

  const checkScroll = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    el.addEventListener("scroll", checkScroll, { passive: true })
    checkScroll()
    return () => el.removeEventListener("scroll", checkScroll)
  }, [checkScroll])

  function scroll(dir: -1 | 1) {
    const el = trackRef.current
    if (!el) return
    const cardW = el.querySelector<HTMLElement>(".cf-app-card")?.offsetWidth ?? 300
    el.scrollBy({ left: dir * (cardW + 20), behavior: "smooth" })
  }

  return (
    <div className="cf-carousel">
      <div className="cf-carousel-track" ref={trackRef}>
        {appsData.map((app) => (
          <div key={app.title} className="cf-app-card">
            <div className="cf-app-img" style={{ backgroundImage: `url(${app.img})` }} />
            <div className="cf-app-body">
              <h4>{app.title}</h4>
              <p>{app.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="cf-carousel-nav">
        <button className={`cf-carousel-btn${canPrev ? "" : " disabled"}`} onClick={() => scroll(-1)} aria-label="Anterior">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4l-5 5 5 5"/></svg>
        </button>
        <button className={`cf-carousel-btn${canNext ? "" : " disabled"}`} onClick={() => scroll(1)} aria-label="Próximo">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4l5 5-5 5"/></svg>
        </button>
      </div>
    </div>
  )
}

/* ── Hero Compare Slider ── */
const heroScenes = [
  {
    label: "Porcelanato",
    before: { src: "/images/compare/porcelanato/antes.jpg" },
    after: { src: "/images/compare/porcelanato/depois.png" },
  },
  {
    label: "Móveis planejados",
    before: { src: "/images/compare/planejados/antes.jpg" },
    after: { src: "/images/compare/planejados/depois.png" },
  },
  {
    label: "Pintura",
    before: { src: "/images/compare/tinta/antes.jpg" },
    after: { src: "/images/compare/tinta/depois.png" },
  },
]

function HeroCompareSlider() {
  const [idx, setIdx] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const [pct, setPct] = useState(50)
  const dragging = useRef(false)

  const setX = useCallback((clientX: number) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    let p = ((clientX - rect.left) / rect.width) * 100
    p = Math.max(2, Math.min(98, p))
    setPct(p)
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) setX(e.clientX) }
    const onUp = () => { dragging.current = false }
    const onTouchMove = (e: TouchEvent) => { if (dragging.current) setX(e.touches[0].clientX) }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onUp)
    }
  }, [setX])

  const scene = heroScenes[idx]

  return (
    <div className="cf-hero-compare">
      <div
        ref={cardRef}
        className="cf-hero-compare-card"
        onMouseDown={(e) => { dragging.current = true; setX(e.clientX) }}
        onTouchStart={(e) => { dragging.current = true; setX(e.touches[0].clientX) }}
      >
        <img src={scene.before.src} alt="Antes" className="cf-hero-compare-layer cf-hero-compare-before" draggable={false} />
        <img src={scene.after.src} alt="Depois" className="cf-hero-compare-layer cf-hero-compare-after" style={{ clipPath: `inset(0 0 0 ${pct}%)` }} draggable={false} />
        <span className="cf-ph-tag cf-l">Antes</span>
        <span className="cf-ph-tag cf-r">Depois</span>
        <div className="cf-handle" style={{ left: `${pct}%` }}>
          <div className="cf-knob">{"\u21C6"}</div>
        </div>
      </div>
      <div className="cf-hero-compare-nav">
        {heroScenes.map((s, i) => (
          <button
            key={s.label}
            onClick={() => { setIdx(i); setPct(50) }}
            className={`cf-hero-compare-tab${i === idx ? " active" : ""}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Chat data ── */
const heroMessages: ChatMessage[] = [
  { side: "in", text: "Oi! Vi essa poltrona no Instagram de vocês. Será que combina com a minha sala?", time: "14:02", delay: 1200 },
  { side: "in", photo: "before", caption: "Foto da minha sala", time: "14:02", delay: 1800 },
  { side: "out", text: "Claro! Qual produto você quer testar? Posso aplicar na sua foto agora.", time: "14:03", delay: 1400 },
  { side: "in", text: "A poltrona Linhares cor caramelo", time: "14:03", delay: 1000 },
  { side: "out", photo: "after", caption: "Aqui está! Linhares · caramelo", time: "14:03", delay: 2200 },
  { side: "out", link: { title: "Comparar antes & depois", url: "comofica.app/r/3a91", desc: "Toque para deslizar e ver o ambiente" }, time: "14:03", delay: 800 },
]

const demoMessages: ChatMessage[] = [
  { side: "in", text: "Quero pintar a parede da TV de verde", time: "10:14", delay: 1000 },
  { side: "in", photo: "before", caption: "Parede atual", time: "10:14", delay: 1600 },
  { side: "out", text: "Tenho 3 verdes que ficariam ótimos. Te mando como cada um fica:", time: "10:14", delay: 1400 },
  { side: "out", photo: "after", caption: "Verde Floresta · cod. AU-204", time: "10:14", photoStyle: { background: "linear-gradient(135deg, #5a7f5e, #3d5e42)" }, delay: 2000 },
  { side: "out", photo: "after", caption: "Salvia · cod. AU-208", time: "10:15", photoStyle: { background: "linear-gradient(135deg, #8aa37a, #6a8463)" }, delay: 1800 },
  { side: "in", text: "A Salvia ficou perfeita! Quanto sai pra essa parede?", time: "10:16", delay: 1200 },
]

/* ── Main Landing Page ── */
export function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 8)
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <>
      <style>{landingCSS}</style>
      <div className="cf-landing">
        {/* ══════ NAV ══════ */}
        <nav className={`cf-nav${navScrolled ? " scrolled" : ""}`}>
          <div className="cf-wrap cf-nav-inner">
            <button onClick={() => scrollTo("cf-hero")} className="cf-brand">
              <img src="/logo-horizontal-azul.svg" alt="Como Fica" className="cf-logo-img" />
            </button>
            <ul className="cf-nav-links">
              <li><button onClick={() => scrollTo("como")}>Como funciona</button></li>
              <li><button onClick={() => scrollTo("demo")}>Demonstração</button></li>
              <li><button onClick={() => scrollTo("para-quem")}>Para quem é</button></li>
              <li><button onClick={() => scrollTo("perguntas")}>Perguntas</button></li>
            </ul>
            <div className="cf-nav-cta">
              <Link href="/login" className="cf-btn cf-btn-ghost cf-btn-sm">Entrar</Link>
              <button onClick={() => scrollTo("cta")} className="cf-btn cf-btn-wa cf-btn-sm">
                <WaIcon className="cf-wa-ico" />
                Começar pelo WhatsApp
              </button>
            </div>
          </div>
        </nav>

        {/* ══════ HERO ══════ */}
        <section className="cf-hero" id="cf-hero">
          <div className="cf-wrap">
            <div className="cf-hero-copy">
              <Reveal>
                <h1>
                  Mostre <span className="accent">como fica</span> antes de vender.
                </h1>
              </Reveal>
              <Reveal>
                <p className="cf-hero-sub">A pergunta que todo cliente faz antes de comprar acabamento, móvel ou revestimento agora tem resposta visual em segundos. A <strong>COMO FICA</strong> aplica o seu produto na foto do ambiente real do cliente e ajuda sua loja a transformar dúvida em decisão.</p>
              </Reveal>
              <Reveal>
                <div className="cf-hero-ctas" style={{ marginTop: '2rem' }}>
                  <a href="https://wa.me/5547992662170?text=Estou%20no%20site%20da%20COMO%20FICA%20e%20gostaria%20de%20agendar%20uma%20demonstra%C3%A7%C3%A3o%20da%20ferramenta" target="_blank" rel="noopener noreferrer" className="cf-btn cf-btn-primary">
                    Agendar demonstração
                  </a>
                  {/* <button onClick={() => setVideoOpen(true)} className="cf-btn cf-btn-ghost cf-btn-play">
                    <span className="cf-play-circle">
                      <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M5.5 3.5l7 4.5-7 4.5V3.5z"/></svg>
                    </span>
                    Ver como funciona em 60s
                  </button> */}
                </div>
              </Reveal>
            </div>

            {/* Before/After compare slider */}
            <Reveal>
              <HeroCompareSlider />
            </Reveal>

            {/* Credibility strip */}
            <Reveal>
              <div className="cf-hero-credibility">
                Ferramenta de visualização para lojas de <strong>acabamentos</strong>, <strong>móveis planejados</strong> e <strong>móveis</strong>. Funciona no WhatsApp da sua loja, no atendimento presencial e nos seus canais digitais.
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══════ PROBLEM ══════ */}
        <section className="cf-problem" id="problema">
          <div className="cf-wrap">
            <Reveal className="cf-problem-head">
              <h2>Toda venda de ambiente trava na mesma pergunta.</h2>
            </Reveal>
            <div className="cf-problem-grid">
              <div className="cf-problem-quotes">
                {[
                  "Será que esse piso combina com a minha sala?",
                  "Como fica esse armário na minha cozinha?",
                  "Esse tom de tinta vai escurecer o ambiente?",
                  "Esse sofá cabe ali?",
                ].map((q) => (
                  <Reveal key={q}>
                    <blockquote className="cf-problem-q">{q}</blockquote>
                  </Reveal>
                ))}
              </div>
              <Reveal className="cf-problem-body">
                <p>Por décadas, a única resposta possível foi <strong>&ldquo;imagina aí&rdquo;</strong>. O cliente saía da loja para pensar, pedia opinião da família, comparava com o concorrente e muitas vezes não voltava.</p>
                <p>A <strong>COMO FICA</strong> existe para responder essa pergunta visualmente, na hora, dentro do canal que sua loja já usa para vender.</p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ══════ HOW ══════ */}
        <section className="cf-how" id="como">
          <div className="cf-wrap">
            <Reveal className="cf-section-head">
              <div>
                <p className="cf-tag">Como funciona</p>
                <h2>Quatro passos entre a <span className="accent">dúvida</span> e o fechamento.</h2>
              </div>
              <p className="cf-lede">Funciona no WhatsApp da loja, no atendimento presencial com tablet, ou integrado ao seu canal digital. O fluxo é o mesmo.</p>
            </Reveal>
            <div className="cf-steps">
              {[
                { n: "PASSO 01", title: "A foto do ambiente", desc: "O cliente envia (ou o vendedor captura) uma foto do ambiente, seja uma sala, parede, bancada ou fachada. Qualquer celular serve.", accent: true, icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                )},
                { n: "PASSO 02", title: "O produto da sua loja", desc: "Vendedor ou cliente envia uma foto do produto ou seleciona o item no catálogo conectado: piso, porcelanato, tinta, sofá, revestimento...", accent: false, icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 01-8 0" />
                  </svg>
                )},
                { n: "PASSO 03", title: "A IA aplica com fidelidade", desc: "Em segundos, o produto é inserido ao ambiente real, respeitando perspectiva, iluminação e escala. Sem aquele recorte falso de marketplace.", accent: false, icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                )},
                { n: "PASSO 04", title: "A decisão acontece", desc: "O resultado volta com um link de comparação antes/depois. O cliente compartilha com a família, decide com mais segurança e rapidez, e o vendedor fecha com argumento visual na mão.", accent: false, icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                )},
              ].map((step) => (
                <Reveal key={step.n} className="cf-step">
                  <div className="cf-step-n">{step.n}</div>
                  <div className={`cf-step-ico${step.accent ? " accent" : ""}`}>
                    {step.icon}
                  </div>
                  <h4>{step.title}</h4>
                  <p>{step.desc}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══════ DEMO ══════ */}
        <section className="cf-demo" id="demo">
          <div className="cf-wrap">
            <Reveal className="cf-section-head">
              <div>
                <p className="cf-tag">Por dentro da experiência</p>
                <h2>Imagem na <span className="accent">cabeça</span> do cliente, decisão na sua mão.</h2>
              </div>
              <p className="cf-lede">O cliente nunca sai do WhatsApp. Você não muda fluxo, sistema, nem treinamento. A Como Fica trabalha em segundo plano, vinculado ao seu catálogo.</p>
            </Reveal>
            <div className="cf-demo-grid">
              <div className="cf-demo-points">
                {[
                  { title: "Aplicação fiel ao ambiente", desc: "Sombras, perspectivas e proporção da foto do cliente são respeitadas. Sem aquele recorte falso de marketplace." },
                  { title: "Catálogo ligado direto à venda", desc: "Cada produto enviado já vem com SKU, preço, condições e botão de \"comprar agora\". Pronto para conversão." },
                  { title: "Atendente vê tudo", desc: "Sua equipe acompanha o histórico no painel: foto enviada, produto testado, resultado e onde o cliente parou." },
                  { title: "Link de comparação compartilhável", desc: "O cliente recebe um link com slider antes/depois. Manda no grupo da família e toma a decisão de compra mais rápido." },
                ].map((pt, i) => (
                  <Reveal key={pt.title} className="cf-demo-point">
                    <div className="cf-num">{i + 1}</div>
                    <div>
                      <h5>{pt.title}</h5>
                      <p>{pt.desc}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
              <Reveal className="cf-demo-phone">
                <AnimatedChat
                  messages={demoMessages}
                  header={
                    <div className="cf-wa-header">
                      <span className="cf-wa-back">{"\u2039"}</span>
                      <div className="cf-wa-avatar">CF</div>
                      <div className="cf-wa-meta">
                        <div className="cf-nm">Tintas Aurora</div>
                        <div className="cf-st">online</div>
                      </div>
                    </div>
                  }
                />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ══════ COMPARE ══════ */}
        <section className="cf-compare">
          <div className="cf-wrap">
            <Reveal className="cf-section-head">
              <div>
                <p className="cf-tag">Link de comparação</p>
                <h2>O cliente desliza, decide, e <span className="accent">manda no grupo</span> da família.</h2>
              </div>
              <p className="cf-lede">Cada resposta gera um link único com slider antes/depois. Aberto no celular, no notebook do filho, no tablet do marido. Sem app, sem login.</p>
            </Reveal>
            <Reveal><CompareSlider /></Reveal>
          </div>
        </section>

        {/* ══════ FOR WHO ══════ */}
        <section className="cf-benefits" id="para-quem">
          <div className="cf-wrap">
            <Reveal className="cf-section-head">
              <div>
                <p className="cf-tag">Para quem é</p>
                <h2>Feita para quem vende <span className="accent">ambiente</span>, não só produto.</h2>
              </div>
              <p className="cf-lede">A COMO FICA foi desenhada para três tipos de loja onde a dúvida visual mais trava a venda, e funciona em qualquer categoria onde o cliente precisa imaginar o resultado antes de comprar.</p>
            </Reveal>
            <div className="cf-niche-grid">
              {[
                {
                  icon: (
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="10" height="10" rx="2" />
                      <rect x="15" y="3" width="10" height="10" rx="2" />
                      <rect x="3" y="15" width="10" height="10" rx="2" />
                      <rect x="15" y="15" width="10" height="10" rx="2" />
                    </svg>
                  ),
                  title: "Lojas de Acabamentos",
                  desc: "Pisos, porcelanatos, revestimentos, tintas, papéis de parede. O cliente compara amostras, leva pra casa, volta na semana seguinte ainda em dúvida. Com a COMO FICA, ele vê o produto aplicado na sala dele em segundos e o vendedor fecha com a foto na tela.",
                },
                {
                  icon: (
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 24V10l10-6 10 6v14" />
                      <path d="M4 24h20" />
                      <rect x="10" y="16" width="8" height="8" rx="1" />
                      <line x1="14" y1="16" x2="14" y2="24" />
                    </svg>
                  ),
                  title: "Móveis Planejados",
                  desc: "Cozinhas, dormitórios, closets, home office. O projeto técnico não vende sozinho: o cliente precisa enxergar como o ambiente vai ficar. Mostre cores, texturas e composições no espaço real do cliente, antes de bater o martelo no contrato.",
                },
                {
                  icon: (
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 18c0-2 1-3 3-3h14c2 0 3 1 3 3v2H4v-2z" />
                      <path d="M6 15V12a2 2 0 012-2h12a2 2 0 012 2v3" />
                      <path d="M4 20v2" /><path d="M24 20v2" />
                      <path d="M2 18h2" /><path d="M24 18h2" />
                    </svg>
                  ),
                  title: "Móveis e Decoração",
                  desc: "Sofás, mesas, estantes, poltronas, iluminação. Acabou o \u201Cserá que cabe?\u201D e o \u201Cserá que combina?\u201D. Aplique o item na sala do cliente respeitando proporção e estilo, e ajude ele a decidir com confiança.",
                },
              ].map((niche) => (
                <Reveal key={niche.title} className="cf-niche-card">
                  <span className="cf-niche-icon">{niche.icon}</span>
                  <h3>{niche.title}</h3>
                  <p>{niche.desc}</p>
                </Reveal>
              ))}
            </div>
            <Reveal className="cf-niche-also">
              A COMO FICA também é usada em <strong>marmorarias</strong>, <strong>esquadrias</strong>, <strong>iluminação</strong>, <strong>paisagismo</strong> e outros segmentos onde a venda depende de o cliente visualizar o produto no ambiente.
            </Reveal>
          </div>
        </section>

        {/* ══════ QUOTE (oculto por enquanto) ══════ */}

        {/* ══════ APPLICATIONS ══════ */}
        <section className="cf-apps" id="aplicacoes">
          <div className="cf-wrap">
            <Reveal className="cf-section-head">
              <div>
                <p className="cf-tag">Aplicações</p>
                <h2>Onde a <span className="accent">COMO FICA</span> é aplicada.</h2>
              </div>
              <p className="cf-lede">Qualquer categoria onde a pergunta do cliente é &ldquo;será que fica bom aqui?&rdquo;.</p>
            </Reveal>
            <AppsCarousel />
          </div>
        </section>

        {/* ══════ FAQ ══════ */}
        <section className="cf-faq" id="perguntas">
          <div className="cf-wrap">
            <Reveal className="cf-section-head">
              <div>
                <p className="cf-tag">Perguntas</p>
                <h2>Perguntas que todo <span className="accent">lojista</span> faz.</h2>
              </div>
              <p className="cf-lede">Se a sua não está aqui, escreva no nosso WhatsApp.</p>
            </Reveal>
            <div className="cf-faq-list">
              {[
                { q: "Funciona só no WhatsApp ou também no atendimento presencial?", a: "Funciona nos três principais canais de venda da sua loja: WhatsApp, atendimento presencial (no tablet ou desktop do vendedor) e nos seus canais digitais. Você escolhe onde ativar." },
                { q: "Minha loja é pequena. Faz sentido pra mim?", a: "Sim. A COMO FICA foi desenhada para reduzir a dependência de ter renderização paga, arquiteto interno ou equipe de design. Lojas pequenas e médias são justamente onde a ferramenta gera mais diferenciação." },
                { q: "Meus vendedores vão saber usar?", a: "Sim. A operação do vendedor é \u201Ctirar foto, escolher produto, enviar\u201D. Quem usa WhatsApp consegue usar a COMO FICA. O treinamento inicial leva 30 minutos." },
                { q: "A simulação fica realmente parecida com o resultado real?", a: "A IA respeita perspectiva, iluminação e escala da foto enviada. Em produtos como pisos, revestimentos e tintas, a fidelidade é alta o suficiente para servir como referência de decisão de compra. Para móveis e iluminação, mostramos posicionamento, proporção e composição do ambiente." },
                { q: "E se o cliente comparar com o produto físico depois e achar diferente?", a: "A COMO FICA é uma ferramenta de decisão de compra, não substitui amostra física. A simulação reduz drasticamente o \u201Cerro de imaginação\u201D, que é onde a maior parte das frustrações acontece." },
                { q: "O cliente precisa baixar algum app?", a: "Não. Tudo acontece dentro do WhatsApp que ele já usa. A foto vai e volta como qualquer outra mensagem, só que agora com o produto da sua loja aplicado." },
                { q: "Como vocês integram com o WhatsApp da minha loja?", a: "Conectamos ao seu número oficial do WhatsApp. Toda conversa continua sendo da sua loja, com o seu nome, o seu logo, o seu atendente. Como Fica entra como um assistente de imagem no fundo." },
                { q: "Como vocês carregam meu catálogo?", a: "Aceitamos planilha, integração com Bling, Tray, Shopify, Nuvemshop, ou XML do seu ERP. Cada produto vira uma opção que o cliente pode aplicar na foto." },
                { q: "Quanto tempo leva para colocar no ar?", a: "Lojas com catálogo organizado entram em até 24 horas. A configuração é feita por nossa equipe. Você não precisa instalar nada." },
                { q: "E se a foto do cliente estiver ruim?", a: "O sistema avisa automaticamente: \u201CEssa foto está escura/desfocada/em ângulo difícil. Pode mandar outra?\u201D. Você não envia resultado de baixa qualidade para o cliente." },
                { q: "Quanto custa?", a: "Trabalhamos com planos personalizados para cada necessidade e tamanho de negócio. A cobrança é por foto processada, não por mensagem, e escala conforme o volume da sua loja. Fale conosco para receber uma proposta sob medida." },
                { q: "É seguro? E a foto do cliente?", a: "Sim. Fotos são processadas em servidores no Brasil, criptografadas em trânsito e em repouso, e excluídas automaticamente após 90 dias. Em conformidade total com a LGPD." },
              ].map((item, i) => (
                <Reveal key={i}>
                  <details className="cf-faq-item" open={i === 0}>
                    <summary>{item.q} <span className="cf-faq-icon" /></summary>
                    <p className="cf-faq-a">{item.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══════ CTA ══════ */}
        <section className="cf-cta-big" id="cta">
          <div className="cf-wrap">
            <Reveal>
              <div className="cf-cta-card">
                <h2>Mostre como fica. <span className="accent">Venda com mais confiança.</span></h2>
                <p className="cf-cta-sub">Veja a COMO FICA aplicada à realidade da sua loja em uma demonstração de 20 minutos. Sem compromisso, sem cartão, sem instalação.</p>
                <div className="cf-cta-actions">
                  <a href="https://wa.me/5547992662170?text=Estou%20no%20site%20da%20COMO%20FICA%20e%20gostaria%20de%20agendar%20uma%20demonstra%C3%A7%C3%A3o%20da%20ferramenta" target="_blank" rel="noopener noreferrer" className="cf-btn cf-btn-primary">Agendar demonstração</a>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══════ FOOTER ══════ */}
        <footer className="cf-footer">
          <div className="cf-wrap">
            <div className="cf-foot-grid">
              <div>
                <div className="cf-brand" style={{ fontSize: 22 }}>
                  <img src="/logo-horizontal-azul.svg" alt="Como Fica" className="cf-logo-img" />
                </div>
                <p className="cf-foot-tag">Visualização de produto direto no WhatsApp da loja. O cliente envia foto, vê como fica e decide na hora.</p>
              </div>
              <div>
                <h5>Produto</h5>
                <ul>
                  <li><button onClick={() => scrollTo("como")}>Como funciona</button></li>
                  <li><button onClick={() => scrollTo("demo")}>Demonstração</button></li>
                  <li><button onClick={() => scrollTo("para-quem")}>Para quem é</button></li>
                </ul>
              </div>
            </div>
            <div className="cf-foot-mark"><img src="/logo-horizontal-azul.svg" alt="Como Fica" className="cf-foot-mark-img" /></div>
            <div className="cf-foot-bottom">
              <span>&copy; 2026 Como Fica</span>
              <span>Brasil</span>
            </div>
          </div>
        </footer>
      </div>

      {/* ══════ VIDEO MODAL ══════ */}
      {videoOpen && (
        <div className="cf-video-overlay" onClick={() => setVideoOpen(false)}>
          <div className="cf-video-modal" onClick={(e) => e.stopPropagation()}>
            <button className="cf-video-close" onClick={() => setVideoOpen(false)}>&times;</button>
            <div className="cf-video-container">
              {/* Substituir src pelo embed do vídeo real */}
              <iframe
                src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                title="Como funciona o Como Fica"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ================================================================== */
/*  CSS — pixel-perfect match of ComoFica.html design                  */
/* ================================================================== */
const landingCSS = `
:root {
  --cf-bg: #F9FAFB;
  --cf-bg-2: #F3F4F6;
  --cf-ink: #111827;
  --cf-ink-soft: #374151;
  --cf-muted: #6B7280;
  --cf-line: #E5E7EB;
  --cf-accent: #00AF67;
  --cf-accent-soft: #34D399;
  --cf-wa: #25d366;
  --cf-wa-dark: #128c7e;
  --cf-sans: var(--font-sans, 'DM Sans', 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif);
  --cf-mono: 'JetBrains Mono', ui-monospace, monospace;
}

.cf-landing {
  background: var(--cf-bg);
  color: var(--cf-ink);
  font-family: var(--cf-sans);
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.cf-landing *, .cf-landing *::before, .cf-landing *::after { box-sizing: border-box; }
.cf-landing a { color: inherit; text-decoration: none; }
.cf-landing button { font-family: inherit; cursor: pointer; border: 0; background: none; color: inherit; }
.cf-landing h1, .cf-landing h2, .cf-landing h3, .cf-landing h4, .cf-landing h5 { margin: 0; font-family: var(--font-display, 'Poppins', var(--cf-sans)); }
.cf-landing p { margin: 0; }
.cf-landing ul { list-style: none; margin: 0; padding: 0; }
.cf-landing .accent { color: var(--cf-accent); }

.cf-wrap { max-width: 1200px; margin: 0 auto; padding: 0 40px; }

/* ── Reveal ── */
.cf-reveal { opacity: 0; transform: translateY(18px); transition: opacity .8s ease, transform .8s ease; }
.cf-reveal.cf-in { opacity: 1; transform: none; }

/* ── Nav ── */
.cf-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50;
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  background: color-mix(in oklab, var(--cf-bg) 80%, transparent);
  border-bottom: 1px solid transparent;
  transition: border-color .3s, background .3s;
}
.cf-nav.scrolled { border-bottom-color: var(--cf-line); }
.cf-nav-inner { display: flex; align-items: center; justify-content: space-between; height: 72px; }
.cf-brand {
  display: flex; align-items: center; gap: 10px;
  font-size: 18px; font-weight: 600; letter-spacing: -0.02em;
  white-space: nowrap; flex-shrink: 0;
}
.cf-logo-img {
  height: 32px; width: auto;
}
.cf-nav-links { display: flex; gap: 36px; font-size: 14px; color: var(--cf-ink-soft); }
.cf-nav-links button { position: relative; padding: 4px 0; font-weight: 500; }
.cf-nav-links button::after {
  content: ''; position: absolute; left: 0; right: 100%; bottom: 0;
  height: 1px; background: var(--cf-ink); transition: right .25s ease;
}
.cf-nav-links button:hover::after { right: 0; }
.cf-nav-cta { display: flex; gap: 12px; align-items: center; }

/* ── Buttons ── */
.cf-btn {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 14px 22px; font-size: 14px; font-weight: 500;
  border: none; cursor: pointer;
  border-radius: 999px; white-space: nowrap; letter-spacing: -0.005em;
  transition: transform .2s ease, background .2s ease, color .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.cf-btn.cf-btn-primary {
  background-color: #00AF67 !important; color: #fff !important; font-weight: 600;
  box-shadow: none;
}
.cf-btn.cf-btn-primary:hover { background-color: #009b5a !important; transform: translateY(-1px); }
.cf-btn-wa { background: var(--cf-wa); color: #052e1c; font-weight: 600; }
.cf-btn-wa:hover { background: #1ebe5a; transform: translateY(-1px); }
.cf-btn-ghost { color: var(--cf-ink); border: 1px solid var(--cf-line); background: transparent; }
.cf-btn-ghost:hover { border-color: var(--cf-ink); }
.cf-btn-sm { padding: 10px 16px; font-size: 13px; }
.cf-wa-ico { width: 16px; height: 16px; flex-shrink: 0; }
.cf-arrow { width: 14px; height: 14px; transition: transform .2s ease; }
.cf-btn:hover .cf-arrow { transform: translate(2px, -2px); }

/* ── Hero ── */
.cf-hero { padding: 120px 0 56px; position: relative; }
.cf-hero-copy { max-width: 720px; margin-bottom: 56px; }
.cf-hero h1 {
  font-weight: 700;
  font-size: clamp(36px, 5vw, 64px); line-height: 1.08;
  letter-spacing: -0.03em; text-wrap: balance;
  margin-bottom: 28px;
}
.cf-hero-sub {
  font-size: 17px; color: var(--cf-ink-soft); line-height: 1.6;
  max-width: 60ch; text-wrap: pretty; margin-bottom: 36px;
}
.cf-hero-sub strong { color: var(--cf-ink); font-weight: 600; }
.cf-hero-ctas { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
.cf-btn-play {
  display: inline-flex; align-items: center; gap: 10px;
}
.cf-play-circle {
  width: 36px; height: 36px; border-radius: 50%;
  border: 1.5px solid var(--cf-line); background: var(--cf-bg-2);
  display: grid; place-items: center; transition: all .2s;
}
.cf-btn-play:hover .cf-play-circle {
  border-color: var(--cf-accent); background: rgba(0,175,103,.06); color: var(--cf-accent);
}

/* ── Hero Compare Slider ── */
.cf-hero-compare { margin-bottom: 48px; }
.cf-hero-compare-card {
  border: 1px solid var(--cf-line); border-radius: 20px; overflow: hidden;
  aspect-ratio: 21/9; position: relative; user-select: none; cursor: ew-resize;
  box-shadow: 0 24px 48px -12px rgba(0,0,0,.08), 0 4px 12px -4px rgba(0,0,0,.04);
}
.cf-hero-compare-layer { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.cf-hero-compare-nav {
  display: flex; justify-content: center; gap: 8px; margin-top: 16px;
}
.cf-hero-compare-tab {
  padding: 8px 20px; border-radius: 999px; border: 1px solid var(--cf-line);
  background: var(--cf-bg); font-size: 13px; font-weight: 500; color: var(--cf-muted);
  cursor: pointer; transition: all .2s;
}
.cf-hero-compare-tab:hover { border-color: var(--cf-accent); color: var(--cf-ink); }
.cf-hero-compare-tab.active {
  background: var(--cf-accent); border-color: var(--cf-accent); color: #fff; font-weight: 600;
}

/* ── Hero Credibility Strip ── */
.cf-hero-credibility {
  text-align: center; font-size: 15px; color: var(--cf-ink-soft); line-height: 1.6;
  padding: 24px 0; border-top: 1px solid var(--cf-line);
  max-width: 680px; margin: 0 auto;
}
.cf-hero-credibility strong { color: var(--cf-ink); font-weight: 600; }
.cf-phone-stage { position: relative; display: flex; justify-content: center; padding: 16px 0; }
.cf-phone {
  width: 320px; border-radius: 38px; background: #111827; padding: 12px;
  box-shadow: 0 1px 0 rgba(255,255,255,.05) inset, 0 30px 60px -20px rgba(0,0,0,.25), 0 8px 24px -8px rgba(0,0,0,.15);
  position: relative;
}
.cf-phone::before {
  content: ''; position: absolute; top: 24px; left: 50%; transform: translateX(-50%);
  width: 90px; height: 24px; background: #111827; border-radius: 999px; z-index: 3;
}
.cf-phone-screen {
  background: #ece5dd;
  background-image:
    radial-gradient(circle at 20% 20%, rgba(12,40,32,.04) 0 2px, transparent 3px),
    radial-gradient(circle at 80% 60%, rgba(12,40,32,.04) 0 2px, transparent 3px);
  border-radius: 28px; height: 580px; overflow: hidden;
  display: flex; flex-direction: column; position: relative;
}
.cf-wa-header {
  background: var(--cf-wa-dark); color: #fff;
  padding: 38px 14px 10px; display: flex; align-items: center; gap: 10px; flex-shrink: 0;
}
.cf-wa-back { font-size: 18px; opacity: .9; }
.cf-wa-avatar {
  width: 32px; height: 32px; border-radius: 50%; background: var(--cf-accent);
  display: grid; place-items: center; font-size: 13px; font-weight: 600; color: #fff; flex-shrink: 0;
}
.cf-wa-meta { font-size: 13px; line-height: 1.2; flex: 1; }
.cf-nm { font-weight: 600; font-size: 14px; }
.cf-st { font-size: 11px; opacity: .85; }
.cf-wa-chat { flex: 1; padding: 12px 10px; display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
.cf-animated-chat { overflow-y: auto; scrollbar-width: none; }
.cf-animated-chat::-webkit-scrollbar { display: none; }

/* Message enter animation */
.cf-msg-enter {
  animation: cfMsgPop .35s cubic-bezier(.18,.89,.32,1.28) both;
}
@keyframes cfMsgPop {
  from { opacity: 0; transform: translateY(12px) scale(.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* Typing indicator */
.cf-typing-bubble {
  padding: 10px 14px !important;
  width: auto !important;
  max-width: 70px !important;
}
.cf-typing {
  display: flex; align-items: center; gap: 4px; height: 14px;
}
.cf-typing span {
  width: 7px; height: 7px; border-radius: 50%;
  background: #8696a0; display: block;
  animation: cfTypingBounce 1.2s ease-in-out infinite;
}
.cf-typing span:nth-child(2) { animation-delay: .15s; }
.cf-typing span:nth-child(3) { animation-delay: .3s; }
@keyframes cfTypingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: .4; }
  30% { transform: translateY(-5px); opacity: 1; }
}
.cf-bubble {
  max-width: 78%; padding: 7px 10px 6px; border-radius: 8px;
  font-size: 13px; line-height: 1.35; box-shadow: 0 1px 0 rgba(0,0,0,.05);
  position: relative; color: #111b21;
}
.cf-bubble.cf-in { background: #fff; align-self: flex-start; border-top-left-radius: 2px; }
.cf-bubble.cf-out { background: #d9fdd3; align-self: flex-end; border-top-right-radius: 2px; }
.cf-time { font-size: 9px; color: #667781; float: right; margin: 4px 0 -2px 8px; }
.cf-check { color: #53bdeb; margin-left: 2px; }
.cf-bubble.cf-photo { padding: 4px; width: 200px; }
.cf-img {
  height: 130px; border-radius: 6px;
  background-image: repeating-linear-gradient(135deg, #c8baa4 0 8px, #b8aa94 8px 9px);
  position: relative; overflow: hidden;
}
.cf-img.cf-img-before::after {
  content: 'sala antes'; position: absolute; bottom: 6px; left: 8px;
  font-family: var(--cf-mono); font-size: 9px; color: rgba(0,0,0,.5);
  letter-spacing: 0.05em; text-transform: uppercase;
}
.cf-bubble.cf-after .cf-img {
  background-image: radial-gradient(circle at 30% 30%, rgba(255,255,255,.5), transparent 50%),
    linear-gradient(135deg, #e6dccc, #d9c3a8 60%, #c2916a);
}
.cf-bubble.cf-after .cf-img::after {
  content: 'com produto aplicado'; position: absolute; bottom: 6px; left: 8px;
  font-family: var(--cf-mono); font-size: 9px; color: rgba(0,0,0,.55);
  letter-spacing: 0.05em; text-transform: uppercase;
}
.cf-cap { padding: 4px 4px 2px; font-size: 11px; color: #111b21; }
.cf-bubble.cf-link { width: 200px; padding: 4px; }
.cf-lp {
  background: rgba(0,0,0,.04); border-left: 3px solid var(--cf-accent);
  padding: 6px 8px; border-radius: 4px; font-size: 11px;
}
.cf-ttl { font-weight: 600; color: var(--cf-ink); }
.cf-url { color: #667781; font-size: 10px; margin-top: 2px; font-family: var(--cf-mono); }
.cf-desc { margin-top: 2px; color: #3b4a54; }
.cf-wa-input {
  background: #f0f2f5; padding: 8px;
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
}
.cf-field {
  flex: 1; background: #fff; border-radius: 999px; height: 32px;
  display: flex; align-items: center; padding: 0 12px; font-size: 12px; color: #8696a0;
}
.cf-send {
  width: 32px; height: 32px; border-radius: 50%; background: var(--cf-wa);
  color: #fff; display: grid; place-items: center; font-size: 14px;
}

/* ── Floating cards — modern glass ── */
.cf-float-card {
  position: absolute;
  background: rgba(255,255,255,.85);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,.6);
  border-radius: 18px; padding: 18px 20px;
  box-shadow: 0 8px 32px -8px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.04);
  z-index: 3;
}
.cf-card-head {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
.cf-lbl {
  font-family: var(--cf-mono); font-size: 10px; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--cf-muted);
}
.cf-big-n {
  font-weight: 700; font-size: 28px; letter-spacing: -0.03em; line-height: 1;
  display: flex; align-items: baseline; gap: 6px;
}
.cf-delta {
  font-size: 11px; font-weight: 600; color: #065F46;
  background: #D1FAE5; padding: 3px 8px; border-radius: 999px; letter-spacing: 0;
}
.cf-sub { font-size: 11px; color: var(--cf-muted); margin-top: 6px; font-family: var(--cf-mono); }

/* Card positions + float */
.cf-float-card.cf-tl { top: 6%; left: 3%; width: 240px; }
.cf-float-card.cf-bl { bottom: 8%; left: 4%; width: 220px; }
.cf-float-card.cf-tr { top: 10%; right: 4%; width: 200px; }
.cf-float-card.cf-br { bottom: 6%; right: 3%; width: 230px; }

/* Staggered entry animation */
.cf-card-enter {
  opacity: 0;
  animation: cfCardSlideIn .7s cubic-bezier(.22,1,.36,1) forwards,
             cfCardFloat 6s ease-in-out infinite;
  animation-delay: var(--enter-d, 0s), var(--float-d, 1s);
}
.cf-enter-1 { --enter-d: .3s; --float-d: 1s; }
.cf-enter-2 { --enter-d: .5s; --float-d: 1.3s; }
.cf-enter-3 { --enter-d: .7s; --float-d: 1.6s; }
.cf-enter-4 { --enter-d: .9s; --float-d: 1.9s; }
.cf-enter-5 { --enter-d: 1.1s; --float-d: 2.2s; }

@keyframes cfCardSlideIn {
  from { opacity: 0; transform: translateY(24px) scale(.92); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes cfCardFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

/* Badge */
.cf-float-badge {
  position: absolute; background: var(--cf-ink); color: #fff;
  padding: 10px 18px; border-radius: 999px; font-size: 13px; font-weight: 500;
  display: inline-flex; align-items: center; gap: 8px; z-index: 3;
  box-shadow: 0 8px 24px -6px rgba(0,0,0,.25);
}
.cf-float-badge.cf-top-badge { top: 16%; left: 50%; transform: translateX(-50%); }

/* Live dot */
.cf-live-dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--cf-accent);
  box-shadow: 0 0 0 0 rgba(0,175,103,.5);
  animation: cfLivePulse 1.8s ease-in-out infinite;
}
@keyframes cfLivePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0,175,103,.5); }
  50% { box-shadow: 0 0 0 8px rgba(0,175,103,0); }
}
.cf-live-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--cf-mono); font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--cf-accent); font-weight: 600;
}

/* ── Sparkline chart (top-left) ── */
.cf-sparkline { margin-top: 8px; }
.cf-sparkline svg { width: 100%; height: 48px; display: block; }
.cf-spark-area {
  fill: url(#sparkGrad); opacity: 0;
  animation: cfFadeIn .6s ease-out forwards; animation-delay: 1.8s;
}
.cf-spark-line {
  fill: none; stroke: var(--cf-accent); stroke-width: 2.5;
  stroke-linecap: round; stroke-linejoin: round;
  stroke-dasharray: 400; stroke-dashoffset: 400;
  animation: cfStrokeDraw 2s cubic-bezier(.4,0,.2,1) forwards; animation-delay: .6s;
}
.cf-spark-dot {
  fill: #fff; stroke: var(--cf-accent); stroke-width: 2.5;
  opacity: 0; animation: cfFadeIn .3s ease-out forwards; animation-delay: 2.4s;
}
.cf-spark-pulse {
  fill: var(--cf-accent); opacity: 0;
  animation: cfSparkPulse 2s ease-in-out infinite; animation-delay: 2.6s;
}
@keyframes cfStrokeDraw { to { stroke-dashoffset: 0; } }
@keyframes cfFadeIn { to { opacity: 1; } }
@keyframes cfSparkPulse {
  0%, 100% { opacity: .4; r: 4; }
  50% { opacity: 0; r: 10; }
}

/* ── Radial progress (top-right) ── */
.cf-radial-wrap {
  position: relative; width: 80px; height: 80px; margin: 8px auto 6px;
}
.cf-radial { width: 80px; height: 80px; display: block; }
.cf-radial-bg {
  fill: none; stroke: var(--cf-line); stroke-width: 7;
}
.cf-radial-fg {
  fill: none; stroke: var(--cf-accent); stroke-width: 7;
  stroke-linecap: round;
  stroke-dasharray: 213.6; /* 2*pi*34 */
  stroke-dashoffset: 213.6;
  transform: rotate(-90deg); transform-origin: center;
  animation: cfRadialFill 2s cubic-bezier(.4,0,.2,1) forwards; animation-delay: .8s;
}
@keyframes cfRadialFill { to { stroke-dashoffset: 27.8; } } /* 213.6 * (1 - 0.87) */
.cf-radial-val {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 22px; letter-spacing: -0.03em; color: var(--cf-ink);
}
.cf-radial-val span { font-size: 13px; color: var(--cf-muted); font-weight: 500; margin-left: 1px; }

/* ── Horizontal bars (bottom-left) ── */
.cf-hbars { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
.cf-hbar-row { display: flex; align-items: center; gap: 8px; }
.cf-hbar-label { font-family: var(--cf-mono); font-size: 10px; color: var(--cf-muted); width: 36px; letter-spacing: .03em; }
.cf-hbar-track {
  flex: 1; height: 8px; background: var(--cf-line); border-radius: 99px; overflow: hidden;
}
.cf-hbar-fill {
  height: 100%; border-radius: 99px;
  width: 0;
  animation: cfHbarGrow 1.6s cubic-bezier(.4,0,.2,1) forwards; animation-delay: 1s;
}
.cf-hbar-muted { background: var(--cf-muted); opacity: .35; }
.cf-hbar-accent { background: var(--cf-accent); }
@keyframes cfHbarGrow { to { width: var(--bar-w); } }
.cf-hbar-val { font-family: var(--cf-mono); font-size: 11px; font-weight: 600; color: var(--cf-ink); width: 32px; text-align: right; }

/* ── Activity wave (bottom-right) ── */
.cf-wave { margin: 6px 0 2px; }
.cf-wave svg { width: 100%; height: 32px; display: block; }
.cf-wave-path {
  fill: none; stroke-width: 2; stroke-linecap: round;
  stroke-dasharray: 400; stroke-dashoffset: 400;
}
.cf-wave-1 {
  stroke: var(--cf-accent); opacity: .7;
  animation: cfWaveDraw 1.8s ease-out forwards, cfWaveShift 3s linear infinite;
  animation-delay: .8s, 2.6s;
}
.cf-wave-2 {
  stroke: var(--cf-accent); opacity: .3;
  animation: cfWaveDraw 1.8s ease-out forwards, cfWaveShift 4s linear infinite;
  animation-delay: 1.2s, 3s;
}
@keyframes cfWaveDraw { to { stroke-dashoffset: 0; } }
@keyframes cfWaveShift {
  from { d: path("M0,20 Q25,5 50,20 T100,20 T150,20 T200,20"); }
  50% { d: path("M0,20 Q25,32 50,20 T100,20 T150,20 T200,20"); }
  to { d: path("M0,20 Q25,5 50,20 T100,20 T150,20 T200,20"); }
}

/* (hero-meta removed — replaced by credibility strip) */

/* ── Problem ── */
.cf-problem {
  padding: 100px 0; border-top: 1px solid var(--cf-line);
}
.cf-problem-head {
  margin-bottom: 56px;
}
.cf-problem-head h2 {
  font-weight: 700; font-size: clamp(28px, 3.5vw, 44px);
  line-height: 1.15; letter-spacing: -0.025em;
  max-width: 18ch;
}
.cf-problem-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: start;
}
.cf-problem-quotes {
  display: flex; flex-direction: column; gap: 16px;
}
.cf-problem-q {
  position: relative;
  padding: 20px 24px; border-radius: 14px;
  background: var(--cf-bg-2); border: 1px solid var(--cf-line);
  font-size: 17px; font-style: italic; color: var(--cf-ink-soft);
  line-height: 1.5; letter-spacing: -0.01em;
  transition: border-color .2s, background .2s;
}
.cf-problem-q::before {
  content: '"'; position: absolute; top: 10px; left: 12px;
  font-size: 32px; line-height: 1; color: var(--cf-accent); opacity: .35;
  font-style: normal; font-weight: 700;
}
.cf-problem-q:hover {
  border-color: var(--cf-accent); background: rgba(0,175,103,.03);
}
.cf-problem-body {
  padding-top: 8px;
}
.cf-problem-body p {
  font-size: 17px; line-height: 1.7; color: var(--cf-ink-soft);
  margin-bottom: 20px; max-width: 48ch; text-wrap: pretty;
}
.cf-problem-body p:last-child { margin-bottom: 0; }
.cf-problem-body strong {
  color: var(--cf-ink); font-weight: 600;
}

/* ── Section head ── */
.cf-section-head { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: end; margin-bottom: 48px; }
.cf-tag {
  font-family: var(--cf-mono); font-size: 11px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--cf-muted); margin-bottom: 16px;
}
.cf-section-head h2 { font-weight: 700; font-size: clamp(28px, 3.5vw, 42px); line-height: 1.15; letter-spacing: -0.025em; }
.cf-lede { font-size: 15px; color: var(--cf-ink-soft); max-width: 48ch; text-wrap: pretty; line-height: 1.6; }

/* ── How ── */
.cf-how { padding: 100px 0; border-top: 1px solid var(--cf-line); }
.cf-steps {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
  background: var(--cf-line); border: 1px solid var(--cf-line); border-radius: 18px; overflow: hidden;
}
.cf-step {
  background: var(--cf-bg); padding: 28px 24px 32px; min-height: 260px;
  display: flex; flex-direction: column; transition: background .25s;
}
.cf-step:hover { background: var(--cf-bg-2); }
.cf-step-n { font-family: var(--cf-mono); font-size: 11px; color: var(--cf-muted); letter-spacing: 0.06em; margin-bottom: 24px; }
.cf-step-ico {
  width: 44px; height: 44px; border-radius: 12px;
  background: var(--cf-bg-2); border: 1px solid var(--cf-line); color: var(--cf-accent);
  display: grid; place-items: center; margin-bottom: 22px;
  transition: background .2s, border-color .2s;
}
.cf-step:hover .cf-step-ico { background: rgba(0,175,103,.06); border-color: var(--cf-accent); }
.cf-step-ico.accent { background: var(--cf-accent); border-color: var(--cf-accent); color: #fff; }
.cf-step:hover .cf-step-ico.accent { background: #009b5a; }
.cf-step h4 { font-weight: 600; font-size: 17px; line-height: 1.3; letter-spacing: -0.015em; margin-bottom: 8px; }
.cf-step p { font-size: 14px; color: var(--cf-ink-soft); line-height: 1.55; margin-top: auto; padding-top: 12px; }

/* ── Demo ── */
.cf-demo { padding: 100px 0; background: var(--cf-ink); color: var(--cf-bg); }
.cf-demo .cf-section-head h2 { color: var(--cf-bg); }
.cf-demo .cf-section-head h2 .accent { color: var(--cf-accent-soft); }
.cf-demo .cf-lede { color: color-mix(in oklab, var(--cf-bg) 70%, transparent); }
.cf-demo .cf-tag { color: var(--cf-accent-soft); }
.cf-demo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
.cf-demo-points { display: flex; flex-direction: column; gap: 24px; }
.cf-demo-point {
  padding: 24px; border: 1px solid color-mix(in oklab, var(--cf-bg) 18%, transparent);
  border-radius: 14px; display: grid; grid-template-columns: 36px 1fr; gap: 16px; align-items: start;
}
.cf-num {
  width: 36px; height: 36px; border-radius: 50%; background: var(--cf-accent); color: #fff;
  display: grid; place-items: center; font-weight: 600; font-size: 14px; flex-shrink: 0;
}
.cf-demo-point h5 { font-weight: 600; font-size: 16px; margin-bottom: 6px; letter-spacing: -0.01em; }
.cf-demo-point p { font-size: 14px; color: color-mix(in oklab, var(--cf-bg) 70%, transparent); line-height: 1.55; }
.cf-demo-phone { display: flex; justify-content: center; }
.cf-demo-phone .cf-phone { width: 340px; }

/* ── Compare ── */
.cf-compare { padding: 100px 0; border-top: 1px solid var(--cf-line); }
.cf-compare-card {
  border: 1px solid var(--cf-line); border-radius: 18px; overflow: hidden;
  aspect-ratio: 21/9; max-height: 480px; position: relative; background: var(--cf-bg-2);
  user-select: none; cursor: ew-resize;
}
.cf-layer { position: absolute; inset: 0; }
.cf-before {
  background-image: url("/images/composicao-antes.png");
  background-size: cover; background-position: center;
}
.cf-after {
  background-image: url("https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&h=675&fit=crop&q=85");
  background-size: cover; background-position: center;
}
.cf-handle {
  position: absolute; top: 0; bottom: 0; width: 2px;
  background: var(--cf-bg); box-shadow: 0 0 0 1px rgba(0,0,0,.1);
}
.cf-knob {
  position: absolute; top: 50%; left: 50%; width: 44px; height: 44px;
  transform: translate(-50%, -50%); background: var(--cf-bg); border-radius: 50%;
  display: grid; place-items: center; box-shadow: 0 4px 12px rgba(0,0,0,.15);
  font-size: 14px; color: var(--cf-ink);
}
.cf-ph-tag {
  position: absolute; top: 18px; background: var(--cf-bg); border: 1px solid var(--cf-line);
  padding: 6px 10px; border-radius: 999px; font-family: var(--cf-mono); font-size: 10px;
  color: var(--cf-muted); letter-spacing: 0.06em; text-transform: uppercase; z-index: 2;
}
.cf-ph-tag.cf-l { left: 18px; }
.cf-ph-tag.cf-r { right: 18px; }

/* ── For Who (Niches) ── */
.cf-benefits { padding: 100px 0; border-top: 1px solid var(--cf-line); }
.cf-niche-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-bottom: 48px; }
.cf-niche-card {
  border: 1px solid var(--cf-line); border-radius: 18px; padding: 36px 32px;
  background: #fff; display: flex; flex-direction: column;
  transition: transform .3s ease, border-color .2s, box-shadow .3s ease;
}
.cf-niche-card:hover {
  transform: translateY(-4px); border-color: var(--cf-accent);
  box-shadow: 0 12px 32px -8px rgba(0,175,103,.1);
}
.cf-niche-icon {
  display: flex; align-items: center; justify-content: center;
  width: 52px; height: 52px; border-radius: 14px;
  background: var(--cf-bg-2); border: 1px solid var(--cf-line);
  color: var(--cf-accent); margin-bottom: 20px;
  transition: background .2s, border-color .2s;
}
.cf-niche-card:hover .cf-niche-icon {
  background: rgba(0,175,103,.06); border-color: var(--cf-accent);
}
.cf-niche-card h3 {
  font-weight: 700; font-size: 22px; letter-spacing: -0.02em;
  line-height: 1.2; margin-bottom: 14px;
}
.cf-niche-card p {
  font-size: 15px; color: var(--cf-ink-soft); line-height: 1.65; text-wrap: pretty;
}
.cf-niche-also {
  text-align: center; font-size: 15px; color: var(--cf-ink-soft); line-height: 1.6;
  padding: 24px 0; border-top: 1px solid var(--cf-line);
  max-width: 720px; margin: 0 auto;
}
.cf-niche-also strong { color: var(--cf-ink); font-weight: 600; }

/* ── Quote ── */
.cf-quote-section { padding: 100px 0; border-top: 1px solid var(--cf-line); }
.cf-quote-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 48px; align-items: start; }
.cf-label-tag { font-family: var(--cf-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--cf-muted); }
.cf-big-quote {
  font-weight: 500; font-size: clamp(22px, 2.8vw, 32px); line-height: 1.35;
  letter-spacing: -0.02em; text-wrap: pretty; margin: 0;
}
.cf-quote-by { margin-top: 36px; display: flex; align-items: center; gap: 16px; }
.cf-av {
  width: 44px; height: 44px; border-radius: 50%; background: var(--cf-accent);
  display: grid; place-items: center; color: #fff; font-weight: 600; font-size: 16px;
}
.cf-who-n { font-weight: 600; font-size: 14px; }
.cf-who-r { font-size: 13px; color: var(--cf-muted); margin-top: 2px; }

/* ── Applications ── */
.cf-apps { padding: 100px 0; border-top: 1px solid var(--cf-line); }

/* Carousel */
.cf-carousel { position: relative; }
.cf-carousel-track {
  display: flex; gap: 20px; overflow-x: auto; scroll-snap-type: x mandatory;
  scrollbar-width: none; -ms-overflow-style: none;
  padding-bottom: 4px;
  /* fade edges */
  mask-image: linear-gradient(90deg, transparent, #000 2%, #000 98%, transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 2%, #000 98%, transparent);
}
.cf-carousel-track::-webkit-scrollbar { display: none; }
.cf-app-card {
  flex: 0 0 280px; scroll-snap-align: start;
  border: 1px solid var(--cf-line); border-radius: 16px; overflow: hidden;
  background: #fff; transition: transform .3s ease, border-color .2s, box-shadow .3s ease;
}
.cf-app-card:hover {
  transform: translateY(-4px); border-color: var(--cf-ink);
  box-shadow: 0 12px 32px -8px rgba(0,0,0,.1);
}
.cf-app-img {
  aspect-ratio: 4/3; background-size: cover; background-position: center;
  border-bottom: 1px solid var(--cf-line);
  transition: transform .4s ease; overflow: hidden;
}
.cf-app-card:hover .cf-app-img { transform: scale(1.04); }
.cf-app-body { padding: 18px 20px 22px; }
.cf-app-card h4 {
  font-weight: 600; font-size: 15px; letter-spacing: -0.01em;
  line-height: 1.3; margin-bottom: 6px;
}
.cf-app-card p { font-size: 13px; color: var(--cf-ink-soft); line-height: 1.5; }

/* Carousel navigation */
.cf-carousel-nav {
  display: flex; gap: 8px; justify-content: flex-end; margin-top: 24px;
}
.cf-carousel-btn {
  width: 44px; height: 44px; border-radius: 50%;
  border: 1px solid var(--cf-line); background: var(--cf-bg);
  display: grid; place-items: center; cursor: pointer;
  color: var(--cf-ink); transition: all .2s;
}
.cf-carousel-btn:hover {
  border-color: var(--cf-ink); background: var(--cf-ink); color: var(--cf-bg);
}
.cf-carousel-btn.disabled {
  opacity: .3; pointer-events: none;
}

/* ── FAQ ── */
.cf-faq { padding: 100px 0; border-top: 1px solid var(--cf-line); }
.cf-faq-list { border-top: 1px solid var(--cf-line); display: grid; grid-template-columns: 1fr 1fr; gap: 0 40px; }
.cf-faq-item { border-bottom: 1px solid var(--cf-line); padding: 24px 0; cursor: pointer; }
.cf-faq-item summary {
  list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 32px;
  font-weight: 600; font-size: 16px; line-height: 1.4; letter-spacing: -0.01em;
}
.cf-faq-item summary::-webkit-details-marker { display: none; }
.cf-faq-icon {
  width: 28px; height: 28px; border: 1px solid var(--cf-line); border-radius: 50%;
  flex-shrink: 0; position: relative; transition: transform .25s, background .25s;
}
.cf-faq-icon::before, .cf-faq-icon::after {
  content: ''; position: absolute; background: var(--cf-muted);
  left: 50%; top: 50%; transform: translate(-50%, -50%);
}
.cf-faq-icon::before { width: 12px; height: 1.5px; }
.cf-faq-icon::after { width: 1.5px; height: 12px; transition: transform .25s; }
.cf-faq-item[open] .cf-faq-icon::after { transform: translate(-50%, -50%) scaleY(0); }
.cf-faq-a { margin-top: 14px; font-size: 15px; color: var(--cf-ink-soft); max-width: 70ch; line-height: 1.6; }

/* ── CTA ── */
.cf-cta-big { padding: 80px 0 100px; }
.cf-cta-card {
  background: var(--cf-ink); color: #fff; border-radius: 24px;
  padding: 64px 56px; position: relative; overflow: hidden;
}
.cf-cta-card::after {
  content: ''; position: absolute; width: 520px; height: 520px; border-radius: 50%;
  background: radial-gradient(circle, var(--cf-accent) 0%, transparent 60%);
  right: -200px; top: -200px; opacity: .35;
}
.cf-cta-pill {
  position: relative; display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px; background: color-mix(in oklab, var(--cf-bg) 14%, transparent);
  border-radius: 999px; font-family: var(--cf-mono); font-size: 11px;
  text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 24px;
}
.cf-cta-card h2 {
  position: relative; font-weight: 700; font-size: clamp(28px, 4vw, 52px);
  line-height: 1.1; letter-spacing: -0.03em; max-width: 18ch;
}
.cf-cta-card h2 .accent { color: var(--cf-accent-soft); }
.cf-cta-sub {
  position: relative; margin-top: 20px; font-size: 17px;
  color: color-mix(in oklab, var(--cf-bg) 78%, transparent);
  line-height: 1.6; max-width: 48ch;
}
.cf-cta-actions { position: relative; margin-top: 40px; display: flex; gap: 14px; flex-wrap: wrap; }
.cf-cta-ghost { color: var(--cf-bg) !important; border-color: color-mix(in oklab, var(--cf-bg) 30%, transparent) !important; }
.cf-cta-ghost:hover { border-color: var(--cf-bg) !important; }

/* ── Footer ── */
.cf-footer { border-top: 1px solid var(--cf-line); padding: 64px 0 40px; }
.cf-foot-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; margin-bottom: 56px; }
.cf-foot-grid h5 {
  font-family: var(--cf-mono); font-size: 11px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--cf-muted); margin-bottom: 18px; font-weight: 500;
}
.cf-foot-grid ul { display: grid; gap: 10px; }
.cf-foot-grid ul button { font-size: 14px; color: var(--cf-ink-soft); text-align: left; }
.cf-foot-grid ul button:hover { color: var(--cf-ink); }
.cf-foot-tag { max-width: 36ch; color: var(--cf-ink-soft); font-size: 14px; line-height: 1.55; margin-top: 12px; }
.cf-foot-mark {
  margin: 24px 0 32px; text-align: center;
}
.cf-foot-mark-img {
  width: 60%; max-width: 600px; height: auto; margin: 0 auto;
}
.cf-foot-bottom {
  border-top: 1px solid var(--cf-line); padding-top: 24px;
  display: flex; justify-content: center; align-items: center;
  font-family: var(--cf-mono); font-size: 11px; color: var(--cf-muted);
  letter-spacing: 0.04em; text-transform: uppercase; flex-wrap: wrap; gap: 16px;
}

/* ── Video Modal ── */
.cf-video-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,.75); backdrop-filter: blur(4px);
  display: grid; place-items: center;
  animation: cfFadeIn .2s ease;
}
@keyframes cfFadeIn { from { opacity: 0; } to { opacity: 1; } }
.cf-video-modal {
  position: relative; width: 90vw; max-width: 960px;
  animation: cfScaleIn .25s cubic-bezier(.18,.89,.32,1.15);
}
@keyframes cfScaleIn { from { opacity: 0; transform: scale(.95); } to { opacity: 1; transform: scale(1); } }
.cf-video-close {
  position: absolute; top: -44px; right: 0;
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(255,255,255,.15); border: none; cursor: pointer;
  color: #fff; font-size: 22px; line-height: 1;
  display: grid; place-items: center;
  transition: background .2s;
}
.cf-video-close:hover { background: rgba(255,255,255,.3); }
.cf-video-container {
  position: relative; width: 100%; aspect-ratio: 16/9;
  border-radius: 16px; overflow: hidden;
  background: #000; box-shadow: 0 32px 64px rgba(0,0,0,.4);
}
.cf-video-container iframe {
  position: absolute; inset: 0; width: 100%; height: 100%; border: none;
}

/* ── Responsive ── */
@media (max-width: 920px) {
  .cf-nav-links { display: none; }
  .cf-hero { padding: 120px 0 48px; }
  .cf-hero-copy { margin-bottom: 40px; }
  .cf-hero-compare-card { aspect-ratio: 16/9; }
  .cf-steps { grid-template-columns: 1fr 1fr; }
  .cf-demo-grid { grid-template-columns: 1fr; gap: 32px; }
  .cf-niche-grid { grid-template-columns: 1fr; }
  .cf-faq-list { grid-template-columns: 1fr; }
  .cf-quote-grid { grid-template-columns: 1fr; gap: 24px; }
  .cf-problem-grid { grid-template-columns: 1fr; gap: 32px; }
  .cf-app-card { flex: 0 0 260px; }
  .cf-section-head { grid-template-columns: 1fr; gap: 16px; }
  .cf-foot-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
  .cf-cta-card { padding: 56px 32px; }
  .cf-niche-card { padding: 28px 24px; }
}
@media (max-width: 560px) {
  .cf-steps { grid-template-columns: 1fr; }
  .cf-app-card { flex: 0 0 240px; }
}
`
