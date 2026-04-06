import asyncio
import json
import logging

import psycopg
from psycopg.rows import dict_row

from worker.config import settings
from worker.processor import generate_composition
from worker.storage import download_bytes, upload_bytes
from worker.notifier import notify_job_completed

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("composition-worker")


async def process_job(conn, job: dict) -> None:
    job_id = str(job["id"])
    tenant_id = str(job["tenant_id"])
    mode = job["mode"]
    base_asset_id = str(job["base_asset_id"])
    catalog_item_id = job.get("catalog_item_id")
    input_payload = job.get("input_payload", {})
    if isinstance(input_payload, str):
        input_payload = json.loads(input_payload)

    attempt = 0
    max_retries = settings.max_retries

    while attempt <= max_retries:
        try:
            # 1. Download base image from MinIO
            async with conn.transaction():
                cur = await conn.execute(
                    "SELECT storage_key FROM assets WHERE id = %s", (base_asset_id,),
                )
                base_asset = await cur.fetchone()
            if not base_asset:
                raise ValueError(f"Base asset {base_asset_id} not found")

            base_image = download_bytes(base_asset["storage_key"])

            # 2. Download reference image if catalog item exists
            reference_image = None
            if catalog_item_id:
                async with conn.transaction():
                    cur = await conn.execute(
                        """SELECT a.storage_key FROM catalog_item_images ci
                           JOIN assets a ON a.id = ci.asset_id
                           WHERE ci.catalog_item_id = %s AND ci.role = 'primary'
                           ORDER BY ci.sort_order LIMIT 1""",
                        (str(catalog_item_id),),
                    )
                    ref_row = await cur.fetchone()
                if ref_row:
                    reference_image = download_bytes(ref_row["storage_key"])

            # 3. Call OpenRouter
            logger.info("Job %s: calling OpenRouter (attempt %d)", job_id, attempt + 1)
            result_image = await generate_composition(
                base_image, reference_image, mode, input_payload,
            )

            # 4. Upload render to MinIO
            render_key = f"tenants/{tenant_id}/renders/{job_id}.jpg"
            upload_bytes(render_key, result_image, "image/jpeg")

            # 5. Create asset and render in DB
            async with conn.transaction():
                cur = await conn.execute(
                    """INSERT INTO assets (tenant_id, conversation_id, role, mime_type, storage_key, metadata_json)
                       VALUES (%s, %s, 'render', 'image/jpeg', %s, '{}'::jsonb) RETURNING *""",
                    (tenant_id, str(job["conversation_id"]), render_key),
                )
                render_asset = await cur.fetchone()

                await conn.execute(
                    """INSERT INTO renders (tenant_id, job_id, asset_id, version)
                       VALUES (%s, %s, %s, 1)""",
                    (tenant_id, job_id, str(render_asset["id"])),
                )

                await conn.execute(
                    "UPDATE composition_jobs SET status = 'done' WHERE id = %s",
                    (job["id"],),
                )

            logger.info("Job %s completed successfully", job_id)

            # 6. Notify api-server
            await notify_job_completed(job_id)
            return

        except Exception as e:
            attempt += 1
            logger.error("Job %s failed (attempt %d/%d): %s", job_id, attempt, max_retries + 1, e)

            if attempt <= max_retries:
                await asyncio.sleep(settings.retry_backoff_seconds)
            else:
                # Mark as failed
                async with conn.transaction():
                    await conn.execute(
                        "UPDATE composition_jobs SET status = 'failed', error_message = %s WHERE id = %s",
                        (str(e), job["id"]),
                    )
                logger.error("Job %s permanently failed after %d attempts", job_id, max_retries + 1)
                await notify_job_completed(job_id)


async def poll_and_process() -> None:
    conninfo = settings.database_url
    async with await psycopg.AsyncConnection.connect(conninfo, row_factory=dict_row) as conn:
        while True:
            async with conn.transaction():
                cur = await conn.execute(
                    """
                    SELECT id, tenant_id, conversation_id, mode, catalog_item_id,
                           base_asset_id, overlay_asset_id, mask_asset_id, input_payload
                    FROM composition_jobs
                    WHERE status = 'queued'
                    ORDER BY created_at
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                    """
                )
                job = await cur.fetchone()

                if job is None:
                    await asyncio.sleep(settings.poll_interval_seconds)
                    continue

                job_id = str(job["id"])
                logger.info("Processing job %s (mode=%s)", job_id, job["mode"])

                await conn.execute(
                    "UPDATE composition_jobs SET status = 'processing' WHERE id = %s",
                    (job["id"],),
                )

            await process_job(conn, job)


async def main() -> None:
    logger.info("Composition worker starting (poll_interval=%ds)", settings.poll_interval_seconds)
    await poll_and_process()


if __name__ == "__main__":
    asyncio.run(main())
