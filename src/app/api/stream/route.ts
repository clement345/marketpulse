import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events: pushes to the browser the changes written to the database by the worker
 * (quotes, new news items, notifications). The client then reloads the relevant data.
 */
export async function GET(req: Request) {
  const enc = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      let lastQuote = (await prisma.quote.aggregate({ _max: { updatedAt: true } }))._max.updatedAt?.getTime() ?? 0;
      let lastNews = (await prisma.newsItem.aggregate({ _max: { fetchedAt: true } }))._max.fetchedAt?.getTime() ?? 0;
      let lastNotif = (await prisma.notification.aggregate({ _max: { createdAt: true } }))._max.createdAt?.getTime() ?? 0;
      send("hello", { at: new Date().toISOString() });

      const tick = async () => {
        if (closed) return;
        try {
          const [q, n, notifs] = await Promise.all([
            prisma.quote.aggregate({ _max: { updatedAt: true } }),
            prisma.newsItem.findMany({ where: { fetchedAt: { gt: new Date(lastNews) } }, select: { id: true, title: true, importance: true, source: true, fetchedAt: true }, orderBy: { fetchedAt: "desc" }, take: 20 }),
            prisma.notification.findMany({ where: { createdAt: { gt: new Date(lastNotif) } }, orderBy: { createdAt: "asc" }, take: 20 }),
          ]);
          const qt = q._max.updatedAt?.getTime() ?? 0;
          if (qt > lastQuote) { lastQuote = qt; send("quotes", { at: qt }); }
          if (n.length) { lastNews = n[0].fetchedAt.getTime(); send("news", { count: n.length, breaking: n.filter((x) => x.importance >= 4) }); }
          if (notifs.length) { lastNotif = notifs[notifs.length - 1].createdAt.getTime(); send("notification", notifs); }
          send("ping", { at: Date.now() });
        } catch {
          /* database unavailable: retry on the next tick */
        }
      };
      const iv = setInterval(tick, 5000);
      req.signal.addEventListener("abort", () => { closed = true; clearInterval(iv); try { controller.close(); } catch {} });
    },
    cancel() { closed = true; },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
