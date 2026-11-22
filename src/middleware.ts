import { NextRequest, NextResponse } from "next/server";
import { ORG_COOKIE, STU_COOKIE, verifyToken } from "@/lib/auth";

// يمنع فتح /organizer/* و /student-dashboard مباشرة دون جلسة موقعة صالحة
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/organizer")) {
    const s = await verifyToken(req.cookies.get(ORG_COOKIE)?.value);
    if (s?.role !== "org") return NextResponse.redirect(new URL("/login", req.url));
  } else if (pathname.startsWith("/student-dashboard")) {
    const s = await verifyToken(req.cookies.get(STU_COOKIE)?.value);
    if (s?.role !== "stu") return NextResponse.redirect(new URL("/student-login", req.url));
  }
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = { matcher: ["/organizer/:path*", "/student-dashboard/:path*"] };
