"""
Stockbase Realtime WebSocket Server
===================================

Назначение
----------
Лёгкий push-сервер для мгновенной синхронизации изменений между клиентами.

Архитектура
-----------
  [Client A] --(HTTP POST /api/crud)--> [Flask backend]
                                              |
                                              | HTTP POST http://websocket:8081/broadcast
                                              v
                                      [WebSocket Server]  <-- этот файл
                                              |
                                              v
                                  broadcast --> [Client B], [Client C], ...

Протокол
--------
Клиент подключается к  ws://<host>/ws
Сервер шлёт JSON-сообщения вида:
    {"type": "state_changed", "action": "upsert_item", "updatedAt": "2025-04-20T10:00:00+00:00"}

Клиент получает сигнал и сам решает что перезагружать.
Дополнительно поддерживается ping/pong для keep-alive.

Broadcast API (внутренний, для backend)
---------------------------------------
POST /broadcast
Body: {"action": "upsert_item", "updatedAt": "..."}
--> рассылает всем подключённым

GET /health     --> {"ok": true, "clients": N}
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Set

import websockets
from websockets.server import WebSocketServerProtocol
from aiohttp import web

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("ws-server")

WS_PORT = int(os.environ.get("WS_PORT", "8081"))
HTTP_PORT = int(os.environ.get("WS_HTTP_PORT", "8082"))
PING_INTERVAL = 25  # секунд — отправка ping для поддержания соединения

# Множество активных клиентов
clients: Set[WebSocketServerProtocol] = set()
clients_lock = asyncio.Lock()


# ──────────────────────────── WebSocket handler ─────────────────────────────

async def ws_handler(websocket: WebSocketServerProtocol) -> None:
    peer = getattr(websocket, "remote_address", ("?", 0))
    async with clients_lock:
        clients.add(websocket)
        total = len(clients)
    log.info("Client connected from %s (total=%d)", peer, total)

    try:
        # Приветственное сообщение
        await websocket.send(json.dumps({
            "type": "hello",
            "ts": datetime.now(timezone.utc).isoformat(),
        }))

        async for raw in websocket:
            # Клиент может слать ping/heartbeat — отвечаем pong
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            if msg.get("type") == "ping":
                await websocket.send(json.dumps({
                    "type": "pong",
                    "ts": datetime.now(timezone.utc).isoformat(),
                }))
    except websockets.ConnectionClosed:
        pass
    except Exception as e:
        log.warning("Handler error: %s", e)
    finally:
        async with clients_lock:
            clients.discard(websocket)
            total = len(clients)
        log.info("Client disconnected (total=%d)", total)


async def broadcast(message: dict) -> int:
    """Рассылает сообщение всем подключённым. Возвращает количество получателей."""
    if not clients:
        return 0
    payload = json.dumps(message, ensure_ascii=False)
    async with clients_lock:
        targets = list(clients)
    sent = 0
    dead = []
    for ws in targets:
        try:
            await ws.send(payload)
            sent += 1
        except Exception:
            dead.append(ws)
    if dead:
        async with clients_lock:
            for ws in dead:
                clients.discard(ws)
    return sent


# ──────────────────────────── HTTP broadcast API ────────────────────────────

async def http_broadcast(request: web.Request) -> web.Response:
    """Принимает сигнал от backend и рассылает всем клиентам."""
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "invalid json"}, status=400)

    action = data.get("action", "unknown")
    message = {
        "type": "state_changed",
        "action": action,
        "updatedAt": data.get("updatedAt") or datetime.now(timezone.utc).isoformat(),
        "meta": data.get("meta", {}),
    }
    sent = await broadcast(message)
    log.info("Broadcast '%s' -> %d clients", action, sent)
    return web.json_response({"ok": True, "sent": sent})


async def http_health(request: web.Request) -> web.Response:
    return web.json_response({
        "ok": True,
        "clients": len(clients),
        "ts": datetime.now(timezone.utc).isoformat(),
    })


# ──────────────────────────── Startup ───────────────────────────────────────

async def keep_alive() -> None:
    """Периодически шлём ping, чтобы соединения не рвались прокси/балансировщиками."""
    while True:
        await asyncio.sleep(PING_INTERVAL)
        if not clients:
            continue
        message = {"type": "ping", "ts": datetime.now(timezone.utc).isoformat()}
        payload = json.dumps(message)
        async with clients_lock:
            targets = list(clients)
        for ws in targets:
            try:
                await ws.send(payload)
            except Exception:
                pass


async def main() -> None:
    # HTTP-приложение для broadcast
    http_app = web.Application()
    http_app.router.add_post("/broadcast", http_broadcast)
    http_app.router.add_get("/health", http_health)
    runner = web.AppRunner(http_app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", HTTP_PORT)
    await site.start()
    log.info("HTTP broadcast API on :%d", HTTP_PORT)

    # WebSocket-сервер
    ws_server = await websockets.serve(
        ws_handler,
        "0.0.0.0",
        WS_PORT,
        ping_interval=20,
        ping_timeout=20,
        max_size=2 ** 20,  # 1 MB
    )
    log.info("WebSocket server on :%d", WS_PORT)

    # Keep-alive задача
    asyncio.create_task(keep_alive())

    # Ждём форева
    await ws_server.wait_closed()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Shutting down")
