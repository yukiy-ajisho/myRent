import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  // Prepare a mutable response so Supabase can set cookies
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

  // Protect /owner/* routes
  if (req.nextUrl.pathname.startsWith("/owner")) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = ""; // drop query params
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ["/owner/:path*"],
};
