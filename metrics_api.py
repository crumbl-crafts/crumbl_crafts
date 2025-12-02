"""Lightweight HTTP API that exposes builder metrics.

Can operate in two modes:
  1. MySQL mode: Fetches data from database (requires MySQL access)
  2. In-memory mode: Uses bot's in-memory data (when MySQL unavailable)

Run alongside the Discord bot so GitHub Pages can fetch live JSON data:
    $ python metrics_api.py

Environment variables (all optional, see .env.example):
    MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD
    MYSQL_POOL_MIN, MYSQL_POOL_MAX
    API_HOST, API_PORT
    CORS_ALLOW_ORIGIN
    METRICS_MODE: "mysql" or "memory" (default: "memory")
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence

from aiohttp import web
from dotenv import load_dotenv

load_dotenv()

LOGGER = logging.getLogger("MetricsAPI")
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s | %(message)s")

# Optional MySQL import - only needed if using MySQL mode
try:
    import aiomysql
    HAS_AIOMYSQL = True
except ImportError:
    aiomysql = None  # type: ignore
    HAS_AIOMYSQL = False

# Callback to get metrics from bot's in-memory data
# This gets set by the bot when integrating the API
_metrics_payload_callback: Optional[Callable[[], Dict[str, Any]]] = None


def set_metrics_payload_callback(callback: Callable[[], Dict[str, Any]]) -> None:
    """Set the callback function that returns the metrics payload from bot memory."""
    global _metrics_payload_callback
    _metrics_payload_callback = callback
    LOGGER.info("Metrics payload callback registered")


def _parse_csv_env(key: str, default: Sequence[str]) -> List[str]:
    raw = os.getenv(key)
    if not raw:
        return list(default)
    return [token.strip() for token in raw.split(",") if token.strip()]


class MetricsService:
    def __init__(self) -> None:
        self.pool: Optional[Any] = None  # aiomysql.Pool when using MySQL
        self.mode = os.getenv("METRICS_MODE", "memory").lower()
        self.queue_statuses = _parse_csv_env("REQ_STATUS_QUEUED", ["queued", "pending", "waiting"])
        self.active_statuses = _parse_csv_env("REQ_STATUS_ACTIVE", ["active", "building", "in_progress"])
        self.accepting_statuses = _parse_csv_env("SHOP_ACCEPTING_STATUSES", ["Open", "Limited"])
        self.top_builder_limit = int(os.getenv("TOP_BUILDERS_LIMIT", "4"))

    async def startup(self, app: web.Application) -> None:
        if self.mode == "mysql" and HAS_AIOMYSQL:
            if self.pool:
                return
            try:
                self.pool = await aiomysql.create_pool(
                    host=os.getenv("MYSQL_HOST", "127.0.0.1"),
                    port=int(os.getenv("MYSQL_PORT", "3306")),
                    db=os.getenv("MYSQL_DATABASE", "builders"),
                    user=os.getenv("MYSQL_USER", "root"),
                    password=os.getenv("MYSQL_PASSWORD", ""),
                    minsize=int(os.getenv("MYSQL_POOL_MIN", "1")),
                    maxsize=int(os.getenv("MYSQL_POOL_MAX", "5")),
                    autocommit=True,
                    charset="utf8mb4",
                    cursorclass=aiomysql.DictCursor,
                )
                LOGGER.info("MySQL pool ready (max=%s)", self.pool.maxsize)
            except Exception as exc:
                LOGGER.warning("MySQL connection failed, falling back to memory mode: %s", exc)
                self.mode = "memory"
        else:
            self.mode = "memory"
            LOGGER.info("Using in-memory metrics mode")

    async def cleanup(self, app: web.Application) -> None:
        if not self.pool:
            return
        self.pool.close()
        await self.pool.wait_closed()
        LOGGER.info("MySQL pool closed")

    async def handle_metrics(self, request: web.Request) -> web.Response:
        try:
            if self.mode == "memory":
                payload = self._get_memory_payload()
            else:
                if not self.pool:
                    raise web.HTTPServiceUnavailable(text="database pool unavailable")
                async with self.pool.acquire() as conn:
                    payload = await self._collect_snapshot(conn)
        except web.HTTPException:
            raise
        except Exception as exc:
            LOGGER.exception("Failed to build metrics payload: %s", exc)
            raise web.HTTPInternalServerError(text="failed to collect metrics") from exc
        return web.json_response(payload)

    def _get_memory_payload(self) -> Dict[str, Any]:
        """Get metrics from the bot's in-memory data via callback."""
        if _metrics_payload_callback is None:
            LOGGER.warning("No metrics callback registered, returning empty payload")
            return {
                "summary": {
                    "builder_count": 0,
                    "total_completed": 0,
                    "total_requests": 0,
                    "total_ratings": 0,
                    "request_completion_ratio": 0,
                },
                "server": {
                    "total_members": 0,
                    "joined_today": 0,
                    "active_shops": 0,
                    "avg_response_time": 0,
                },
                "topBuilders": [],
                "activityLog": [],
                "pipeline": [],
                "insights": [],
                "meta": {"generated_at": time.time(), "mode": "memory"},
            }
        
        try:
            payload = _metrics_payload_callback()
            payload["meta"] = {"generated_at": time.time(), "mode": "memory"}
            return payload
        except Exception as exc:
            LOGGER.error("Error calling metrics callback: %s", exc)
            raise

    async def _collect_snapshot(self, conn: Any) -> Dict[str, Any]:
        builder_count = await self._fetch_scalar(conn, "SELECT COUNT(*) AS total FROM builders", fallback=0)
        total_completed = await self._fetch_scalar(
            conn,
            "SELECT COALESCE(SUM(completed_projects), 0) AS total FROM builder_stats",
            fallback=0,
        )
        total_requests = await self._fetch_scalar(conn, "SELECT COUNT(*) AS total FROM shop_requests", fallback=0)
        total_ratings = await self._fetch_scalar(conn, "SELECT COUNT(*) AS total FROM builder_ratings", fallback=0)

        top_builders = await self._fetch_top_builders(conn)
        queued_requests = await self._count_requests_by_status(conn, self.queue_statuses)
        active_builds = await self._count_requests_by_status(conn, self.active_statuses)
        delivered_last_week = await self._fetch_scalar(
            conn,
            "SELECT COUNT(*) AS total FROM shop_requests WHERE completed_at >= NOW() - INTERVAL 7 DAY",
            fallback=0,
        )
        requests_24h = await self._fetch_scalar(
            conn,
            "SELECT COUNT(*) AS total FROM shop_requests WHERE created_at >= NOW() - INTERVAL 1 DAY",
            fallback=0,
        )

        shop_activity = await self._fetch_shop_activity(conn)
        acceptance_count = shop_activity.get("accepting", 0)

        summary = {
            "builder_count": builder_count,
            "total_completed": total_completed,
            "total_requests": total_requests,
            "total_ratings": total_ratings,
            "request_completion_ratio": (total_completed / total_requests) if total_requests else 0,
        }

        pipeline = [
            {
                "label": "Queued Requests",
                "value": queued_requests,
                "trend": f"{requests_24h} new today",
            },
            {
                "label": "Active Builds",
                "value": active_builds,
                "trend": f"{acceptance_count} shops accepting",
            },
            {
                "label": "Delivered Last 7d",
                "value": delivered_last_week,
                "trend": "+ realtime",
            },
        ]

        completion_pct = round(summary["request_completion_ratio"] * 100, 2)
        insights = [
            {
                "title": "Completion Rate",
                "detail": f"{completion_pct:.2f}% of requests fulfilled",
                "score": "On track" if completion_pct >= 65 else "Monitor",
            },
            {
                "title": "Request Velocity",
                "detail": f"{requests_24h} new requests in 24h",
                "score": "Stable" if requests_24h <= 50 else "High load",
            },
            {
                "title": "Active Shops",
                "detail": f"{acceptance_count} shops currently taking work",
                "score": "✅ Healthy" if acceptance_count else "⚠️ All paused",
            },
        ]

        return {
            "summary": summary,
            "server": {
                "total_members": 0,
                "joined_today": 0,
                "active_shops": acceptance_count,
                "avg_response_time": 0,
            },
            "topBuilders": top_builders,
            "activityLog": [],
            "pipeline": pipeline,
            "insights": insights,
            "meta": {"generated_at": asyncio.get_event_loop().time()},
        }

    async def _fetch_top_builders(self, conn: Any) -> List[Dict[str, Any]]:
        query = (
            "SELECT b.shop_name, "
            "       COALESCE(b.completed_projects, 0) AS completed_projects, "
            "       COALESCE(AVG(r.rating), 0) AS average_rating "
            "FROM builder_stats b "
            "LEFT JOIN builder_ratings r ON r.shop_name = b.shop_name "
            "GROUP BY b.shop_name, b.completed_projects "
            "ORDER BY completed_projects DESC, average_rating DESC "
            "LIMIT %s"
        )
        rows = await self._fetch_all(conn, query, (self.top_builder_limit,))
        results: List[Dict[str, Any]] = []
        for row in rows:
            results.append(
                {
                    "shop_name": row.get("shop_name"),
                    "completed_projects": int(row.get("completed_projects", 0) or 0),
                    "average_rating": float(row.get("average_rating", 0) or 0),
                }
            )
        return results

    async def _count_requests_by_status(self, conn: Any, statuses: Sequence[str]) -> int:
        if not statuses:
            return 0
        placeholders = ", ".join(["%s"] * len(statuses))
        query = f"SELECT COUNT(*) AS total FROM shop_requests WHERE status IN ({placeholders})"
        return await self._fetch_scalar(conn, query, tuple(statuses), fallback=0)

    async def _fetch_shop_activity(self, conn: Any) -> Dict[str, int]:
        if not self.accepting_statuses:
            return {"open": 0, "limited": 0, "accepting": 0}
        placeholders = ", ".join(["%s"] * len(self.accepting_statuses))
        query = (
            "SELECT SUM(status = 'Open') AS open_shops, "
            "       SUM(status = 'Limited') AS limited_shops, "
            f"       SUM(status IN ({placeholders})) AS accepting "
            "FROM shop_settings"
        )
        row = await self._fetch_row(conn, query, tuple(self.accepting_statuses))
        if not row:
            return {"open": 0, "limited": 0, "accepting": 0}
        return {
            "open": int(row.get("open_shops", 0) or 0),
            "limited": int(row.get("limited_shops", 0) or 0),
            "accepting": int(row.get("accepting", 0) or 0),
        }

    async def _fetch_scalar(
        self,
        conn: Any,
        query: str,
        params: Optional[Sequence[Any]] = None,
        fallback: int | float = 0,
    ) -> int | float:
        row = await self._fetch_row(conn, query, params)
        if not row:
            return fallback
        value = next(iter(row.values()))
        if value is None:
            return fallback
        return value

    async def _fetch_row(
        self,
        conn: Any,
        query: str,
        params: Optional[Sequence[Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        try:
            async with conn.cursor() as cursor:
                await cursor.execute(query, params or ())
                return await cursor.fetchone()
        except Exception as exc:  # pylint: disable=broad-except
            LOGGER.warning("Query failed: %s", exc)
            return None

    async def _fetch_all(
        self,
        conn: Any,
        query: str,
        params: Optional[Sequence[Any]] = None,
    ) -> List[Dict[str, Any]]:
        try:
            async with conn.cursor() as cursor:
                await cursor.execute(query, params or ())
                rows = await cursor.fetchall()
                return list(rows)
        except Exception as exc:  # pylint: disable=broad-except
            LOGGER.warning("Query failed: %s", exc)
            return []


@web.middleware
async def cors_middleware(request: web.Request, handler):  # type: ignore[override]
    allow_origin = os.getenv("CORS_ALLOW_ORIGIN", "*")
    allow_headers = os.getenv("CORS_ALLOW_HEADERS", "Content-Type")
    allow_methods = os.getenv("CORS_ALLOW_METHODS", "GET,OPTIONS")

    if request.method == "OPTIONS":
        response = web.Response(status=204)
    else:
        response = await handler(request)

    response.headers["Access-Control-Allow-Origin"] = allow_origin
    response.headers["Access-Control-Allow-Headers"] = allow_headers
    response.headers["Access-Control-Allow-Methods"] = allow_methods
    response.headers["Access-Control-Max-Age"] = "86400"
    return response


def create_app() -> web.Application:
    service = MetricsService()
    app = web.Application(middlewares=[cors_middleware])
    app.on_startup.append(service.startup)
    app.on_cleanup.append(service.cleanup)
    app.router.add_get("/api/metrics", service.handle_metrics)
    app.router.add_options("/api/metrics", lambda request: web.Response(status=204))
    return app


async def start_metrics_server(host: Optional[str] = None, port: Optional[int] = None) -> web.AppRunner:
    """Start the metrics API inside an existing asyncio application."""
    host = host or os.getenv("API_HOST", "0.0.0.0")
    port = port or int(os.getenv("API_PORT", "8080"))
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    LOGGER.info("Metrics server started on %s:%s", host, port)
    return runner


async def stop_metrics_server(runner: Optional[web.AppRunner]) -> None:
    if not runner:
        return
    await runner.cleanup()
    LOGGER.info("Metrics server stopped")


def main() -> None:
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8080"))
    app = create_app()
    LOGGER.info("Starting metrics API on %s:%s", host, port)
    web.run_app(app, host=host, port=port, shutdown_timeout=15)


if __name__ == "__main__":
    main()
