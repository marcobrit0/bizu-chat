const http = require('http');
const https = require('https');

/**
 * Reads the target health URL from the environment or falls back to the local server.
 * This keeps the script simple for both local verification and deployed environments.
 */
function getHealthUrl() {
  return process.env.SMOKE_CHECK_URL || 'http://127.0.0.1:3080/health';
}

/**
 * Performs one HTTP(S) request and resolves with the parsed response body.
 * The deploy smoke check uses this instead of external dependencies so it can
 * run in minimal environments.
 */
function requestJson(url) {
  const client = url.startsWith('https://') ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(
      url,
      {
        headers: {
          Accept: 'application/json',
        },
      },
      (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            resolve({
              statusCode: res.statusCode ?? 0,
              body: parsed,
            });
          } catch (error) {
            reject(
              new Error(
                `Health endpoint returned non-JSON content: ${error.message}. Response body: ${body}`,
              ),
            );
          }
        });
      },
    );

    req.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Polls the health endpoint until it reports ready or the timeout expires.
 * This lets operators use the same command right after startup.
 */
async function waitForHealthy(url, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs;
  let lastResult = null;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      lastResult = await requestJson(url);
      lastError = null;

      if (lastResult.statusCode === 200 && lastResult.body?.status !== 'error') {
        return lastResult;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  if (lastError) {
    throw new Error(`Smoke check timed out waiting for ${url}: ${lastError.message}`);
  }

  throw new Error(
    `Smoke check timed out waiting for ${url}. Last response: ${JSON.stringify(lastResult, null, 2)}`,
  );
}

/**
 * Prints a small dependency summary so operators can quickly see which
 * subsystems are healthy and which ones are only degraded.
 */
function printSummary(result) {
  console.log(`Smoke check passed: ${result.statusCode} ${result.body.status}`);
  const dependencies = result.body?.dependencies ?? {};

  Object.entries(dependencies).forEach(([name, details]) => {
    const status = details?.status ?? 'unknown';
    const message = details?.details ?? 'No details provided.';
    console.log(`- ${name}: ${status} - ${message}`);
  });
}

(async () => {
  const url = getHealthUrl();
  const timeoutMs = Number(process.env.SMOKE_CHECK_TIMEOUT_MS || 30000);
  const intervalMs = Number(process.env.SMOKE_CHECK_INTERVAL_MS || 2000);

  try {
    const result = await waitForHealthy(url, timeoutMs, intervalMs);
    printSummary(result);
  } catch (error) {
    console.error(`Smoke check failed: ${error.message}`);
    process.exit(1);
  }
})();
