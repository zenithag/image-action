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

/* ── Chat data ── */
const heroMessages: ChatMessage[] = [
  { side: "in", text: "Oi! Vi essa poltrona no Instagram de voces. Sera que combina com a minha sala?", time: "14:02", delay: 1200 },
  { side: "in", photo: "before", caption: "Foto da minha sala", time: "14:02", delay: 1800 },
  { side: "out", text: "Claro! Qual produto voce quer testar? Posso aplicar na sua foto agora", time: "14:03", delay: 1400 },
  { side: "in", text: "A poltrona Linhares cor caramelo", time: "14:03", delay: 1000 },
  { side: "out", photo: "after", caption: "Aqui esta! Linhares · caramelo", time: "14:03", delay: 2200 },
  { side: "out", link: { title: "Comparar antes & depois", url: "comofica.app/r/3a91", desc: "Toque para deslizar e ver o ambiente" }, time: "14:03", delay: 800 },
]

const demoMessages: ChatMessage[] = [
  { side: "in", text: "Quero pintar a parede da TV de verde", time: "10:14", delay: 1000 },
  { side: "in", photo: "before", caption: "Parede atual", time: "10:14", delay: 1600 },
  { side: "out", text: "Tenho 3 verdes que ficariam otimos. Te mando como cada um fica:", time: "10:14", delay: 1400 },
  { side: "out", photo: "after", caption: "Verde Floresta · cod. AU-204", time: "10:14", photoStyle: { background: "linear-gradient(135deg, #5a7f5e, #3d5e42)" }, delay: 2000 },
  { side: "out", photo: "after", caption: "Salvia · cod. AU-208", time: "10:15", photoStyle: { background: "linear-gradient(135deg, #8aa37a, #6a8463)" }, delay: 1800 },
  { side: "in", text: "A Salvia ficou perfeita! Quanto sai pra essa parede?", time: "10:16", delay: 1200 },
]

/* ── Main Landing Page ── */
export function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false)

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
              <span className="cf-mark" />
              <span>Como Fica</span>
            </button>
            <ul className="cf-nav-links">
              <li><button onClick={() => scrollTo("como")}>Como funciona</button></li>
              <li><button onClick={() => scrollTo("demo")}>Demonstracao</button></li>
              <li><button onClick={() => scrollTo("para-quem")}>Para quem e</button></li>
              <li><button onClick={() => scrollTo("perguntas")}>Perguntas</button></li>
            </ul>
            <div className="cf-nav-cta">
              <Link href="/login" className="cf-btn cf-btn-ghost cf-btn-sm">Entrar</Link>
              <button onClick={() => scrollTo("cta")} className="cf-btn cf-btn-wa cf-btn-sm">
                <WaIcon className="cf-wa-ico" />
                Comecar pelo WhatsApp
              </button>
            </div>
          </div>
        </nav>

        {/* ══════ HERO ══════ */}
        <section className="cf-hero" id="cf-hero">
          <div className="cf-wrap">
            <div className="cf-hero-top">
              <div>
                <Reveal>
                  <div className="cf-eyebrow">
                    <span className="cf-pulse" />
                    Direto no WhatsApp da sua loja
                  </div>
                </Reveal>
                <Reveal>
                  <h1>
                    Venda mais. <br />
                    Mostre <span className="accent">como fica</span> antes de comprar.
                  </h1>
                </Reveal>
              </div>
              <div className="cf-hero-right">
                <Reveal>
                  <p>Ferramenta de IA que aplica seu produto na foto do ambiente do cliente. Sem app, sem cadastro. O cliente decide na hora, dentro do WhatsApp.</p>
                </Reveal>
                <Reveal>
                  <button onClick={() => scrollTo("cta")} className="cf-btn cf-btn-wa">
                    <WaIcon className="cf-wa-ico" />
                    Comecar agora
                  </button>
                </Reveal>
              </div>
            </div>

            {/* Hero Stage */}
            <Reveal>
              <div className="cf-hero-stage">
                {/* ── Floating metric cards ── */}

                {/* Top-left: Sparkline area chart + sales */}
                <div className="cf-float-card cf-tl cf-card-enter cf-enter-1">
                  <div className="cf-card-head">
                    <div className="cf-lbl">Vendas / semana</div>
                    <span className="cf-delta">+38%</span>
                  </div>
                  <div className="cf-big-n">R$ 48k</div>
                  <div className="cf-sparkline">
                    <svg viewBox="0 0 200 60" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--cf-accent)" stopOpacity=".3" />
                          <stop offset="100%" stopColor="var(--cf-accent)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path className="cf-spark-area" d="M0,52 C20,48 35,50 50,42 C65,34 75,38 95,28 C115,18 130,22 150,14 C170,8 185,10 200,4 L200,60 L0,60 Z" />
                      <path className="cf-spark-line" d="M0,52 C20,48 35,50 50,42 C65,34 75,38 95,28 C115,18 130,22 150,14 C170,8 185,10 200,4" />
                      <circle className="cf-spark-dot" cx="200" cy="4" r="4" />
                      <circle className="cf-spark-pulse" cx="200" cy="4" r="4" />
                    </svg>
                  </div>
                </div>

                {/* Top badge */}
                <div className="cf-float-badge cf-top-badge cf-card-enter cf-enter-3">
                  <span className="cf-live-dot" />
                  Aplicado em minutos
                </div>

                {/* Top-right: Radial progress */}
                <div className="cf-float-card cf-tr cf-card-enter cf-enter-2">
                  <div className="cf-card-head">
                    <div className="cf-lbl">Conversao</div>
                    <span className="cf-delta">+24pp</span>
                  </div>
                  <div className="cf-radial-wrap">
                    <svg className="cf-radial" viewBox="0 0 80 80">
                      <circle className="cf-radial-bg" cx="40" cy="40" r="34" />
                      <circle className="cf-radial-fg" cx="40" cy="40" r="34" />
                    </svg>
                    <div className="cf-radial-val">87<span>%</span></div>
                  </div>
                  <div className="cf-sub">decisao na 1a conversa</div>
                </div>

                {/* Bottom-left: Horizontal progress bars */}
                <div className="cf-float-card cf-bl cf-card-enter cf-enter-4">
                  <div className="cf-card-head">
                    <div className="cf-lbl">Devolucoes</div>
                    <span className="cf-delta" style={{ background: "#FEE2E2", color: "#991B1B" }}>{"\u2212"}61%</span>
                  </div>
                  <div className="cf-hbars">
                    <div className="cf-hbar-row">
                      <span className="cf-hbar-label">Antes</span>
                      <div className="cf-hbar-track"><div className="cf-hbar-fill cf-hbar-muted" style={{ "--bar-w": "82%" } as React.CSSProperties} /></div>
                      <span className="cf-hbar-val">82%</span>
                    </div>
                    <div className="cf-hbar-row">
                      <span className="cf-hbar-label">Agora</span>
                      <div className="cf-hbar-track"><div className="cf-hbar-fill cf-hbar-accent" style={{ "--bar-w": "32%" } as React.CSSProperties} /></div>
                      <span className="cf-hbar-val">32%</span>
                    </div>
                  </div>
                </div>

                {/* Bottom-right: Live counter + activity wave */}
                <div className="cf-float-card cf-br cf-card-enter cf-enter-5">
                  <div className="cf-card-head">
                    <div className="cf-lbl">Tempo medio</div>
                    <span className="cf-live-badge"><span className="cf-live-dot" /> ao vivo</span>
                  </div>
                  <div className="cf-big-n">12<span style={{ fontSize: 16, color: "var(--cf-muted)", fontWeight: 500 }}>s</span></div>
                  <div className="cf-wave">
                    <svg viewBox="0 0 200 40" preserveAspectRatio="none">
                      <path className="cf-wave-path cf-wave-1" d="M0,20 Q25,5 50,20 T100,20 T150,20 T200,20" />
                      <path className="cf-wave-path cf-wave-2" d="M0,20 Q25,35 50,20 T100,20 T150,20 T200,20" />
                    </svg>
                  </div>
                  <div className="cf-sub">para devolver a foto editada</div>
                </div>

                {/* Phone mockup — animated */}
                <div className="cf-phone-stage">
                  <AnimatedChat
                    messages={heroMessages}
                    header={
                      <div className="cf-wa-header">
                        <span className="cf-wa-back">{"\u2039"}</span>
                        <div className="cf-wa-avatar">CF</div>
                        <div className="cf-wa-meta">
                          <div className="cf-nm">Moveis Carvalho</div>
                          <div className="cf-st">online · com ajuda do Como Fica</div>
                        </div>
                      </div>
                    }
                  />
                </div>
              </div>
            </Reveal>

            {/* Stats row */}
            <div className="cf-hero-meta">
              {[
                { n: "+38%", l: "conversao em vendas no WhatsApp" },
                { n: "\u221261%", l: "devolucoes por arrependimento" },
                { n: "~12s", l: "para devolver a foto editada" },
                { n: "0", l: "apps para o cliente baixar" },
              ].map((s) => (
                <Reveal key={s.l} className="cf-stat">
                  <div className="cf-n">{s.n}</div>
                  <div className="cf-stat-l">{s.l}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══════ HOW ══════ */}
        <section className="cf-how" id="como">
          <div className="cf-wrap">
            <Reveal className="cf-section-head">
              <div>
                <p className="cf-tag">Como funciona</p>
                <h2>Quatro mensagens entre a <span className="accent">curiosidade</span> e a venda.</h2>
              </div>
              <p className="cf-lede">Tudo acontece dentro do WhatsApp da sua loja, o numero que o cliente ja conhece. Como Fica entra como assistente, processa a foto e devolve o resultado pronto para vender.</p>
            </Reveal>
            <div className="cf-steps">
              {[
                { n: "PASSO 01 · CLIENTE", title: "Manda a foto do ambiente", desc: "O cliente fotografa a sala, a parede ou a bancada e envia para o WhatsApp da loja como faria com qualquer duvida.", wa: true },
                { n: "PASSO 02 · CLIENTE", title: "Escolhe um produto da loja", desc: "O sistema lista os itens do seu catalogo. O cliente toca, escolhe a cor/variante, e confirma. Tudo direto no chat.", wa: false },
                { n: "PASSO 03 · COMO FICA", title: "A IA aplica com perfeicao", desc: "Em segundos, o produto e renderizado no ambiente real do cliente respeitando perspectiva, iluminacao e escala.", wa: false },
                { n: "PASSO 04 · CLIENTE RECEBE", title: "Resultado + link de comparacao", desc: "A imagem volta no WhatsApp, junto de um link com slider antes/depois para o cliente decidir e compartilhar com a familia.", wa: false },
              ].map((step) => (
                <Reveal key={step.n} className={`cf-step${step.wa ? " cf-wa-step" : ""}`}>
                  <div className="cf-step-n">{step.n}</div>
                  <div className={`cf-step-ico${step.wa ? " wa" : ""}`}>
                    {step.wa ? <WaIcon className="cf-wa-ico" /> : (
                      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="7" height="7" /><rect x="12" y="3" width="7" height="7" />
                        <rect x="3" y="12" width="7" height="7" /><rect x="12" y="12" width="7" height="7" />
                      </svg>
                    )}
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
                <p className="cf-tag">Por dentro da experiencia</p>
                <h2>Video na <span className="accent">cabeca</span> do cliente, decisao na sua mao.</h2>
              </div>
              <p className="cf-lede">O cliente nunca sai do WhatsApp. Voce nao muda fluxo, sistema, nem treinamento. Como Fica trabalha em segundo plano, vinculado ao seu catalogo.</p>
            </Reveal>
            <div className="cf-demo-grid">
              <div className="cf-demo-points">
                {[
                  { title: "Aplicacao fiel ao ambiente", desc: "Sombras, perspectiva e proporcao respeitam a foto do cliente. Sem aquele recorte falso de marketplace." },
                  { title: "Catalogo ligado direto a venda", desc: "Cada produto enviado ja vem com SKU, preco, condicoes e botao de \"comprar agora\". Pronto para conversao." },
                  { title: "Atendente ve tudo", desc: "Sua equipe acompanha o historico no painel: foto enviada, produto testado, resultado, e onde o cliente parou." },
                  { title: "Link de comparacao compartilhavel", desc: "O cliente recebe um link com slider antes/depois. Manda no grupo da familia e volta para fechar." },
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
                <p className="cf-tag">Link de comparacao</p>
                <h2>O cliente desliza, decide, e <span className="accent">manda no grupo</span> da familia.</h2>
              </div>
              <p className="cf-lede">Cada resposta gera um link unico com slider antes/depois. Aberto no celular, no notebook do filho, no tablet do marido. Sem app, sem login.</p>
            </Reveal>
            <Reveal><CompareSlider /></Reveal>
          </div>
        </section>

        {/* ══════ BENEFITS ══════ */}
        <section className="cf-benefits" id="para-quem">
          <div className="cf-wrap">
            <Reveal className="cf-section-head">
              <div>
                <p className="cf-tag">Para quem e</p>
                <h2>Feito para lojas onde o cliente <span className="accent">precisa imaginar</span> antes de comprar.</h2>
              </div>
              <p className="cf-lede">Moveis, tintas, revestimentos, pisos, papeis de parede, eletros, decoracao. Onde a duvida &ldquo;sera que combina?&rdquo; trava a venda. Como Fica responde em segundos.</p>
            </Reveal>
            <div className="cf-ben-grid">
              <Reveal className="cf-ben-card dark">
                <span className="cf-pill">Para a loja</span>
                <h3>Mais conversao. Menos devolucao.</h3>
                <p className="cf-ben-desc">Voce integra ao numero de WhatsApp da loja. Em 24h, sua equipe esta vendendo com visualizacao instantanea. Sem novo sistema, sem novo treinamento.</p>
                <ul>
                  <li><CheckIcon /> Integra com seu catalogo (planilha, Bling, Tray, Shopify)</li>
                  <li><CheckIcon /> Painel para o atendente acompanhar o cliente</li>
                  <li><CheckIcon /> Cobramos por foto processada, nao por mensagem</li>
                  <li><CheckIcon /> Sob a sua marca, no seu numero oficial WhatsApp Business</li>
                </ul>
              </Reveal>
              <Reveal className="cf-ben-card">
                <span className="cf-pill">Para o cliente</span>
                <h3>Ve na sala dele. Decide na hora.</h3>
                <p className="cf-ben-desc">Sem app, sem cadastro, sem aprender nada novo. O cliente fala com a loja como sempre falou. E em segundos enxerga o produto na propria casa.</p>
                <ul>
                  <li><CheckIcon /> Tudo dentro do WhatsApp que ele ja usa</li>
                  <li><CheckIcon /> Resposta visual em segundos, nao em horas</li>
                  <li><CheckIcon /> Compara antes/depois com um deslize</li>
                  <li><CheckIcon /> Compartilha o link no grupo da familia para opiniao</li>
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ══════ USE CASES ══════ */}
        <section className="cf-cases">
          <div className="cf-wrap">
            <Reveal className="cf-section-head">
              <div>
                <p className="cf-tag">Aplicacoes</p>
                <h2>Onde Como Fica <span className="accent">trabalha</span>.</h2>
              </div>
              <p className="cf-lede">Qualquer categoria onde a duvida do cliente e &ldquo;sera que fica bom aqui?&rdquo;. Funciona em ambientes internos, externos, com moveis, acabamentos, eletros e mais.</p>
            </Reveal>
            <div className="cf-cases-grid">
              {[
                { lbl: "moveis", cat: "Moveis e decoracao", title: "Sofas, poltronas, mesas, estantes", desc: "Aplique o produto na sala do cliente respeitando o espaco real.", img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=450&fit=crop&q=80" },
                { lbl: "tintas", cat: "Tintas e papeis", title: "Pintura de parede, papel de parede", desc: "Pinte virtualmente a parede do cliente em qualquer cor da sua linha.", img: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=450&fit=crop&q=80" },
                { lbl: "pisos", cat: "Revestimentos", title: "Pisos, azulejos, porcelanatos", desc: "Substitua o piso ou revestimento existente por qualquer item do seu mostruario.", img: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=600&h=450&fit=crop&q=80" },
                { lbl: "cozinha", cat: "Cozinhas planejadas", title: "Bancadas, armarios, eletros", desc: "Mostre como o modulo, a cuba ou o forno cabem na cozinha real.", img: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=600&h=450&fit=crop&q=80" },
                { lbl: "iluminacao", cat: "Iluminacao", title: "Lustres, pendentes, arandelas", desc: "Pendure a peca no ambiente do cliente e veja a escala antes de comprar.", img: "https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=600&h=450&fit=crop&q=80" },
                { lbl: "jardim", cat: "Areas externas", title: "Jardim, varanda, churrasqueira", desc: "Mobiliario de exterior, deck, piscina e plantas em qualquer area aberta.", img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=450&fit=crop&q=80" },
              ].map((c) => (
                <Reveal key={c.lbl} className="cf-case">
                  <div className="cf-thumb" style={{ backgroundImage: `url(${c.img})`, backgroundSize: "cover", backgroundPosition: "center" }}><span className="cf-case-lbl">imagem · {c.lbl}</span></div>
                  <div className="cf-case-body">
                    <div className="cf-cat">{c.cat}</div>
                    <h4>{c.title}</h4>
                    <p>{c.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══════ QUOTE ══════ */}
        <section className="cf-quote-section">
          <div className="cf-wrap">
            <div className="cf-quote-grid">
              <Reveal><p className="cf-label-tag">Depoimento</p></Reveal>
              <div>
                <Reveal>
                  <blockquote className="cf-big-quote">
                    &ldquo;O cliente que demorava <span className="accent">tres visitas</span> para fechar agora compra na primeira conversa. Mando a foto editada, ele mostra para o marido, e em 20 minutos a venda esta fechada.&rdquo;
                  </blockquote>
                </Reveal>
                <Reveal>
                  <div className="cf-quote-by">
                    <div className="cf-av">P</div>
                    <div className="cf-who">
                      <div className="cf-who-n">Patricia Mendes</div>
                      <div className="cf-who-r">Vendedora · Moveis Carvalho, Goiania</div>
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* ══════ FAQ ══════ */}
        <section className="cf-faq" id="perguntas">
          <div className="cf-wrap">
            <Reveal className="cf-section-head">
              <div>
                <p className="cf-tag">Perguntas</p>
                <h2>Duvidas <span className="accent">frequentes</span>.</h2>
              </div>
              <p className="cf-lede">Se a sua nao esta aqui, escreve no nosso WhatsApp.</p>
            </Reveal>
            <div className="cf-faq-list">
              {[
                { q: "O cliente precisa baixar algum app?", a: "Nao. Tudo acontece dentro do WhatsApp que ele ja usa. A foto vai e volta como qualquer outra mensagem, so que agora com o produto da sua loja aplicado." },
                { q: "Como voces integram com o WhatsApp da minha loja?", a: "Conectamos ao seu numero oficial do WhatsApp. Toda conversa continua sendo da sua loja, com o seu nome, o seu logo, o seu atendente. Como Fica entra como um assistente de imagem no fundo." },
                { q: "Como voces carregam meu catalogo?", a: "Aceitamos planilha, integracao com Bling, Tray, Shopify, Nuvemshop, ou XML do seu ERP. Cada produto vira uma opcao que o cliente pode aplicar na foto." },
                { q: "Quanto tempo leva para colocar no ar?", a: "Lojas com catalogo organizado entram em ate 24 horas. A configuracao e feita por nossa equipe. Voce nao precisa instalar nada." },
                { q: "E se a foto do cliente estiver ruim?", a: "O sistema avisa automaticamente: \"essa foto esta escura/desfocada/em angulo dificil. Pode mandar outra?\". Voce nao envia resultado de baixa qualidade para o cliente." },
                { q: "Quanto custa?", a: "A cobranca e por foto processada, nao por mensagem. Plano inicial a partir de R$ 290/mes para ate 200 fotos. Acima disso, escala conforme o volume da loja. Sem custo de instalacao." },
                { q: "E seguro? E a foto do cliente?", a: "Sim. Fotos sao processadas em servidores no Brasil, criptografadas em transito e em repouso, e excluidas automaticamente apos 90 dias. Em conformidade total com a LGPD." },
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
                <span className="cf-cta-pill"><span className="cf-pulse" /> Demo gratis · sem cartao</span>
                <h2>Mande uma foto agora. <span className="accent">Veja como fica.</span></h2>
                <div className="cf-cta-actions">
                  <Link href="/login" className="cf-btn cf-btn-wa">
                    <WaIcon className="cf-wa-ico" />
                    Entrar na plataforma
                  </Link>
                  <button className="cf-btn cf-btn-ghost cf-cta-ghost">Agendar demonstracao</button>
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
                  <span className="cf-mark" />
                  <span>Como Fica</span>
                </div>
                <p className="cf-foot-tag">Visualizacao de produto direto no WhatsApp da loja. O cliente envia foto, ve como fica, e decide na hora.</p>
              </div>
              <div>
                <h5>Produto</h5>
                <ul>
                  <li><button onClick={() => scrollTo("como")}>Como funciona</button></li>
                  <li><button onClick={() => scrollTo("demo")}>Demonstracao</button></li>
                  <li><button onClick={() => scrollTo("para-quem")}>Para quem e</button></li>
                </ul>
              </div>
              <div>
                <h5>Empresa</h5>
                <ul><li><button>Sobre</button></li><li><button>Cases</button></li><li><button>Carreiras</button></li></ul>
              </div>
              <div>
                <h5>Recursos</h5>
                <ul><li><button>Documentacao API</button></li><li><button>Integracoes</button></li><li><button>LGPD</button></li><li><button>Status</button></li></ul>
              </div>
            </div>
            <div className="cf-foot-mark">como <span className="accent">fica.</span></div>
            <div className="cf-foot-bottom">
              <span>&copy; 2026 Como Fica</span>
              <span>Sao Paulo · Brasil</span>
            </div>
          </div>
        </footer>
      </div>
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
.cf-mark {
  width: 28px; height: 28px; border-radius: 8px;
  background: var(--cf-ink); position: relative; overflow: hidden;
  display: inline-block;
}
.cf-mark::after {
  content: ''; position: absolute; width: 12px; height: 12px;
  border-radius: 50%; background: var(--cf-accent); bottom: 4px; right: 4px;
}
.cf-mark::before {
  content: ''; position: absolute; width: 12px; height: 12px;
  border-radius: 50%; background: #fff; top: 4px; left: 4px;
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
  border-radius: 999px; white-space: nowrap; letter-spacing: -0.005em;
  transition: transform .2s ease, background .2s ease, color .2s ease, border-color .2s ease;
}
.cf-btn-primary { background: var(--cf-ink); color: var(--cf-bg); }
.cf-btn-primary:hover { background: var(--cf-accent); transform: translateY(-1px); }
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
.cf-hero-top { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: end; margin-bottom: 56px; }
.cf-hero-right { display: flex; flex-direction: column; align-items: flex-end; gap: 24px; padding-bottom: 12px; }
.cf-hero-right p { text-align: right; font-size: 16px; color: var(--cf-ink-soft); max-width: 36ch; line-height: 1.55; }
.cf-eyebrow {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: var(--cf-mono); font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--cf-muted); margin-bottom: 28px;
  padding: 8px 14px; background: var(--cf-bg-2); border: 1px solid var(--cf-line); border-radius: 999px;
}
.cf-pulse {
  width: 7px; height: 7px; border-radius: 50%; background: var(--cf-wa);
  box-shadow: 0 0 0 0 rgba(37,211,102,.55);
  animation: cfPulse 1.8s ease-in-out infinite;
}
@keyframes cfPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(37,211,102,.5); }
  50% { box-shadow: 0 0 0 8px rgba(37,211,102,0); }
}
.cf-hero h1 {
  font-weight: 700;
  font-size: clamp(36px, 5vw, 64px); line-height: 1.08;
  letter-spacing: -0.03em; text-wrap: balance;
}

/* ── Hero Stage ── */
.cf-hero-stage {
  position: relative;
  background: linear-gradient(180deg, var(--cf-bg-2) 0%, #E5E7EB 100%);
  border: 1px solid var(--cf-line); border-radius: 28px;
  padding: 56px 32px 64px; overflow: hidden; min-height: 520px;
  display: flex; align-items: center; justify-content: center;
}
.cf-hero-stage::before {
  content: ''; position: absolute; inset: 0;
  background:
    radial-gradient(circle at 20% 30%, rgba(0,175,103,.08), transparent 40%),
    radial-gradient(circle at 85% 70%, rgba(37,211,102,.08), transparent 40%);
  pointer-events: none;
}
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

/* ── Hero meta strip ── */
.cf-hero-meta {
  margin-top: 48px; padding-top: 28px; border-top: 1px solid var(--cf-line);
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 40px; text-align: center;
}
.cf-stat .cf-n { font-weight: 700; font-size: 36px; line-height: 1.1; letter-spacing: -0.03em; }
.cf-stat .cf-stat-l {
  margin-top: 10px; font-family: var(--cf-mono); font-size: 11px;
  letter-spacing: 0.04em; text-transform: uppercase; color: var(--cf-muted);
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
  width: 44px; height: 44px; border-radius: 12px; background: var(--cf-accent); color: #fff;
  display: grid; place-items: center; margin-bottom: 22px;
}
.cf-step-ico.wa { background: var(--cf-wa); color: #052e1c; }
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

/* ── Benefits ── */
.cf-benefits { padding: 100px 0; border-top: 1px solid var(--cf-line); }
.cf-ben-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
.cf-ben-card {
  border: 1px solid var(--cf-line); border-radius: 18px; padding: 44px;
  background: #fff; display: flex; flex-direction: column; min-height: 360px;
}
.cf-pill {
  align-self: flex-start; padding: 6px 12px; border-radius: 999px; background: var(--cf-bg-2);
  font-family: var(--cf-mono); font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--cf-ink-soft); margin-bottom: 24px;
}
.cf-ben-card h3 { font-weight: 700; font-size: 26px; letter-spacing: -0.02em; line-height: 1.15; margin-bottom: 16px; max-width: 16ch; }
.cf-ben-card.dark {
  background: var(--cf-ink); color: var(--cf-bg); border-color: var(--cf-ink);
}
.cf-ben-card.dark .cf-pill { background: color-mix(in oklab, var(--cf-bg) 14%, transparent); color: var(--cf-bg); }
.cf-ben-desc { font-size: 15px; line-height: 1.55; }
.cf-ben-card.dark .cf-ben-desc { color: color-mix(in oklab, var(--cf-bg) 78%, transparent); }
.cf-ben-card:not(.dark) .cf-ben-desc { color: var(--cf-ink-soft); }
.cf-ben-card ul { margin-top: auto; display: grid; gap: 14px; padding-top: 28px; }
.cf-ben-card li { font-size: 15px; display: grid; grid-template-columns: 18px 1fr; gap: 12px; color: var(--cf-ink-soft); line-height: 1.5; }
.cf-ben-card.dark li { color: color-mix(in oklab, var(--cf-bg) 78%, transparent); }
.cf-ben-card li svg { color: var(--cf-accent); }
.cf-ben-card.dark li svg { color: var(--cf-accent-soft); }

/* ── Cases ── */
.cf-cases { padding: 100px 0; border-top: 1px solid var(--cf-line); }
.cf-cases-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.cf-case {
  border: 1px solid var(--cf-line); border-radius: 16px; overflow: hidden;
  background: #fff; transition: transform .3s ease, border-color .2s, box-shadow .3s ease;
}
.cf-case:hover { box-shadow: 0 12px 32px -8px rgba(0,0,0,.1); }
.cf-case:hover { transform: translateY(-4px); border-color: var(--cf-ink); }
.cf-thumb {
  aspect-ratio: 4/3; background: var(--cf-bg-2); position: relative;
  border-bottom: 1px solid var(--cf-line); overflow: hidden;
  transition: transform .4s ease;
}
.cf-case:hover .cf-thumb { transform: scale(1.04); }
.cf-case-lbl {
  position: absolute; top: 14px; left: 14px; font-family: var(--cf-mono); font-size: 10px;
  color: var(--cf-muted); background: #fff; border: 1px solid var(--cf-line);
  padding: 5px 9px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.06em;
}
.cf-case-body { padding: 20px 22px 24px; }
.cf-cat { font-family: var(--cf-mono); font-size: 11px; color: var(--cf-muted); letter-spacing: 0.06em; text-transform: uppercase; }
.cf-case h4 { font-weight: 600; font-size: 16px; letter-spacing: -0.01em; line-height: 1.3; margin-top: 8px; }
.cf-case p { font-size: 14px; color: var(--cf-ink-soft); margin-top: 8px; line-height: 1.5; }

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

/* ── FAQ ── */
.cf-faq { padding: 100px 0; border-top: 1px solid var(--cf-line); }
.cf-faq-list { border-top: 1px solid var(--cf-line); }
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
  font-weight: 700; font-size: 12vw; line-height: 0.9; color: var(--cf-ink);
  letter-spacing: -0.05em; margin: 24px 0 32px; text-align: center;
}
.cf-foot-bottom {
  border-top: 1px solid var(--cf-line); padding-top: 24px;
  display: flex; justify-content: center; align-items: center;
  font-family: var(--cf-mono); font-size: 11px; color: var(--cf-muted);
  letter-spacing: 0.04em; text-transform: uppercase; flex-wrap: wrap; gap: 16px;
}

/* ── Responsive ── */
@media (max-width: 920px) {
  .cf-nav-links { display: none; }
  .cf-hero { padding: 120px 0 48px; }
  .cf-hero-top { grid-template-columns: 1fr; gap: 24px; margin-bottom: 40px; }
  .cf-hero-right { align-items: flex-start; }
  .cf-hero-right p { text-align: left; }
  .cf-hero-stage { padding: 32px 16px; min-height: auto; }
  .cf-float-card { display: none; }
  .cf-float-badge { display: none; }
  .cf-hero-meta { grid-template-columns: repeat(2, 1fr); gap: 24px; }
  .cf-steps { grid-template-columns: 1fr 1fr; }
  .cf-demo-grid { grid-template-columns: 1fr; gap: 32px; }
  .cf-ben-grid { grid-template-columns: 1fr; }
  .cf-cases-grid { grid-template-columns: 1fr; }
  .cf-quote-grid { grid-template-columns: 1fr; gap: 24px; }
  .cf-section-head { grid-template-columns: 1fr; gap: 16px; }
  .cf-foot-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
  .cf-cta-card { padding: 56px 32px; }
  .cf-ben-card { padding: 32px; }
}
@media (max-width: 560px) {
  .cf-steps { grid-template-columns: 1fr; }
}
`
