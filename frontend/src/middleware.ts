import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookies) {
          try {
            cookies.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options)
            );
          } catch {
            // ignore setAll errors in middleware
          }
        },
      },
    }
  );

  // 基本的な認証チェック
  if (
    req.nextUrl.pathname.startsWith("/owner") ||
    req.nextUrl.pathname.startsWith("/tenant") ||
    req.nextUrl.pathname.startsWith("/user-type-selection")
  ) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // シンプルなリダイレクト
  if (req.nextUrl.pathname === "/owner" || req.nextUrl.pathname === "/tenant") {
    const url = req.nextUrl.clone();
    url.pathname = "/user-type-selection";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    "/owner",
    "/owner/:path*",
    "/tenant",
    "/tenant/:path*",
    "/user-type-selection",
  ],
};
