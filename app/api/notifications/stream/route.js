import emitter from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const encoder = new TextEncoder();
  let intervalId;
  let onEvent;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
      };
      onEvent = send;
      emitter.on('questionReleased', onEvent);
      emitter.on('questionUnreleased', onEvent);

      // Heartbeat every 25s to keep connection alive
      intervalId = setInterval(() => {
        try { controller.enqueue(encoder.encode(': heartbeat\n\n')); } catch {}
      }, 25000);

      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        emitter.off('questionReleased', onEvent);
        emitter.off('questionUnreleased', onEvent);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
