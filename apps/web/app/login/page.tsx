import { LoginForm } from "@/components/login-form"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Login | VisualFlow",
  description: "Entre na sua conta para gerenciar seu atendimento visual.",
}

export default function LoginPage() {
  return <LoginForm />
}
