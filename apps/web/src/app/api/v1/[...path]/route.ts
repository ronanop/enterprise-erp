import { type NextRequest, NextResponse } from "next/server";

const API_ORIGIN = (process.env.API_INTERNAL_URL ?? "http://api:8000").replace(
  /\/$/,
  "",
);

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  const path = pathSegments.map((segment) => encodeURIComponent(segment)).join("/");
  const target = `${API_ORIGIN}/api/v1/${path}${request.nextUrl.search}`;

  const headers = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", request.headers.get("accept") ?? "application/json");

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "API server unreachable. Start the backend on port 8000.",
        errors: [],
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) responseHeaders.set("content-type", upstreamType);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function withPath(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { path } = await context.params;
  return proxyRequest(request, path ?? []);
}

export function GET(request: NextRequest, context: RouteContext) {
  return withPath(request, context);
}

export function POST(request: NextRequest, context: RouteContext) {
  return withPath(request, context);
}

export function PUT(request: NextRequest, context: RouteContext) {
  return withPath(request, context);
}

export function PATCH(request: NextRequest, context: RouteContext) {
  return withPath(request, context);
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return withPath(request, context);
}
