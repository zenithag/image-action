import asyncio
import logging

import psycopg
from psycopg.rows import dict_row

from worker.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("composition-worker")


async def poll_and_process() -> None:
    conninfo = settings.database_url
    async with await psycopg.AsyncConnection.connect(conninfo, row_factory=dict_row) as conn:
        while True:
            async with conn.transaction():
                cur = await conn.execute(
                    """
                    select id, tenant_id, conversation_id, mode, catalog_item_id,
                           base_asset_id, overlay_asset_id, mask_asset_id, input_payload
                    from composition_jobs
                    where status = 'queued'
                    order by created_at
                    limit 1
                    for update skip locked
                    """
                )
                job = await cur.fetchone()

                if job is None:
                    await asyncio.sleep(settings.poll_interval_seconds)
                    continue

                job_id = str(job["id"])
                logger.info("Processing job %s (mode=%s)", job_id, job["mode"])

                await conn.execute(
                    "update composition_jobs set status = 'processing' where id = %s",
                    (job["id"],),
                )

            # TODO: Fase 6 implementa processor.py com chamada ao Nano Banana Pro
            logger.info("Job %s: processor not yet implemented, marking as done (stub)", job_id)

            async with conn.transaction():
                await conn.execute(
                    "update composition_jobs set status = 'done' where id = %s",
                    (job["id"],),
                )

            logger.info("Job %s completed", job_id)


async def main() -> None:
    logger.info("Composition worker starting (poll_interval=%ds)", settings.poll_interval_seconds)
    await poll_and_process()


if __name__ == "__main__":
    asyncio.run(main())
