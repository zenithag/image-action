import logging

import httpx

from worker.config import settings

logger = logging.getLogger(__name__)


async def notify_job_completed(job_id: str) -> bool:
    url = f"{settings.api_server_url}/v1/internal/job-completed/{job_id}"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url)
            resp.raise_for_status()
            logger.info("Notified api-server of job %s completion", job_id)
            return True
    except Exception as e:
        logger.error("Failed to notify api-server of job %s: %s", job_id, e)
        return False
