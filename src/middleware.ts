import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const secret = process.env.NEXTAUTH_SECRET

// Public routes that don't require authentication
const publicPaths = [
  "/login",
  "/signup",
  "/api/auth",
  "/api/register",
  "/api/health",
  "/_next/static",
  "/_next/image",
  "/favicon.ico",
]

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Check if path is public
  const isPublic = publicPaths.some((p) => path === p || path.startsWith(p + "/"))
  if (isPublic) {
    return NextResponse.next()
  }

  // Allow static files and API route base
  if (path.includes(".") && !path.startsWith("/api/")) {
    return NextResponse.next()
  }

  // Get the session token
  const token = await getToken({ req: request, secret })

  // Redirect unauthenticated users to login
  if (!token) {
    const url = new URL("/login", request.url)
    url.searchParams.set("callbackUrl", path)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all routes except static files and public assets
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
