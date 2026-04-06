import "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    user: {
      id: string
      tenantId: string | null
      roles: string[]
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}
