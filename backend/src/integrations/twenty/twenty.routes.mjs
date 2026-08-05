import express from 'express';
import { getTwentyConfigurationStatus } from './twentySyncService.mjs';
import { parseTwentyWebhookBody, verifyTwentyWebhook } from './twentyWebhook.mjs';

const router = express.Router();

router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: getTwentyConfigurationStatus(),
  });
});

router.post('/webhook', async (req, res) => {
  const rawBody = req.body;
  const signature = req.get('x-twenty-webhook-signature');
  const timestamp = req.get('x-twenty-webhook-timestamp');

  const verification = verifyTwentyWebhook({
    rawBody,
    signature,
    timestamp,
    secret: process.env.TWENTY_WEBHOOK_SECRET,
  });

  if (!verification.valid) {
    return res.status(401).json({
      success: false,
      error: {
        code: verification.code,
        message: 'Twenty webhook signature validation failed.',
      },
    });
  }

  let event;
  try {
    event = parseTwentyWebhookBody(rawBody);
  } catch {
    return res.status(400).json({
      success: false,
      error: {
        code: 'TWENTY_WEBHOOK_INVALID_JSON',
        message: 'Twenty webhook body is invalid JSON.',
      },
    });
  }

  // Phase one only acknowledges validated events. Record-specific handlers are
  // enabled after the Twenty custom objects and field names are created.
  console.info('TWENTY_WEBHOOK_RECEIVED', {
    event: event?.event || 'unknown',
    recordId: event?.data?.id || null,
    timestamp: event?.timestamp || null,
  });

  return res.status(202).json({
    success: true,
    received: true,
    event: event?.event || null,
  });
});

export { router as twentyRouter };
export default router;
