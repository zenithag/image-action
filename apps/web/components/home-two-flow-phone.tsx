"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import styles from "./home-two-flow-phone.module.css"

type FlowMessage = {
  side: "in" | "out"
  text: string
  time: string
  delay: number
  sample?: boolean
}

const messages: FlowMessage[] = [
  { side: "in", text: "Quero pintar a parede da TV de verde", time: "10:14", delay: 900 },
  { side: "out", text: "Tenho 3 verdes que ficariam ótimos. Te mando como cada um fica:", time: "10:14", delay: 1300 },
  { side: "out", text: "Salvia · cod. AU-208", time: "10:15", delay: 1600, sample: true },
  { side: "in", text: "A Salvia ficou perfeita!", time: "10:16", delay: 1100 },
]

export function FlowPhone() {
  const [visibleCount, setVisibleCount] = useState(0)
  const [typingSide, setTypingSide] = useState<"in" | "out" | null>(null)
  const phoneRef = useRef<HTMLDivElement>(null)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearSequence = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  const runSequence = useCallback(() => {
    clearSequence()
    setVisibleCount(0)
    setTypingSide(null)
    let elapsed = 500

    messages.forEach((message, index) => {
      timeoutsRef.current.push(setTimeout(() => setTypingSide(message.side), elapsed))
      elapsed += message.delay
      timeoutsRef.current.push(setTimeout(() => {
        setTypingSide(null)
        setVisibleCount(index + 1)
      }, elapsed))
      elapsed += 350
    })

    timeoutsRef.current.push(setTimeout(runSequence, elapsed + 2500))
  }, [clearSequence])

  useEffect(() => {
    const phone = phoneRef.current
    if (!phone) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && timeoutsRef.current.length === 0) runSequence()
    }, { threshold: 0.3 })
    observer.observe(phone)
    return () => {
      observer.disconnect()
      clearSequence()
    }
  }, [clearSequence, runSequence])

  return (
    <div className={styles.stage} aria-label="Demonstração animada de conversa no WhatsApp">
      <div className={styles.phone} ref={phoneRef}>
        <div className={styles.notch} />
        <div className={styles.header}>
          <span aria-hidden="true">‹</span><span className={styles.avatar}>CF</span><span><strong>Tintas Aurora</strong><small>online</small></span>
        </div>
        <div className={styles.chat}>
          {messages.slice(0, visibleCount).map((message, index) => (
            <div className={`${styles.message} ${message.side === "in" ? styles.incoming : styles.outgoing}`} key={index}>
              {message.sample && <div className={styles.sample} />}
              {message.text}<small>{message.time}{message.side === "out" ? " ✓✓" : ""}</small>
            </div>
          ))}
          {typingSide && <div className={`${styles.typing} ${typingSide === "in" ? styles.incoming : styles.outgoing}`}><i /><i /><i /></div>}
        </div>
        <div className={styles.input}><span>＋</span><span>Mensagem</span><b>▶</b></div>
      </div>
    </div>
  )
}
