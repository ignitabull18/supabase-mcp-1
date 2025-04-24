#!/usr/bin/env node

import express, { type RequestHandler } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { parseArgs } from 'node:util';
import packageJson from '../package.json' with { type: 'json' };
import { createSupabaseMcpServer } from './server.js';

async function main() {
  const {
    values: {
      ['access-token']: cliAccessToken,
      ['api-url']: apiUrl,
      ['read-only']: readOnly,
      ['port']: cliPort,
      ['version']: showVersion,
    },
  } = parseArgs({
    options: {
      'access-token': { type: 'string' },
      'api-url': { type: 'string' },
      'read-only': { type: 'boolean', default: false },
      'port': { type: 'string' },
      'version': { type: 'boolean' },
    },
  });

  if (showVersion) {
    console.log(packageJson.version);
    process.exit(0);
  }

  const accessToken = cliAccessToken ?? process.env.SUPABASE_ACCESS_TOKEN;
  if (!accessToken) {
    console.error(
      'Please provide a personal access token via --access-token or set SUPABASE_ACCESS_TOKEN'
    );
    process.exit(1);
  }

  const server = createSupabaseMcpServer({
    platform: { accessToken, apiUrl },
    readOnly,
  });

  const app = express();
  app.use(express.json());
  const router = express.Router();
  app.use(router);

  const transports: Record<string, SSEServerTransport> = {};

  const sseHandler: RequestHandler = async (req, res) => {
    try {
      const transport = new SSEServerTransport('/mcp/messages', res);
      transports[transport.sessionId] = transport;
      res.on('close', () => {
        delete transports[transport.sessionId];
      });
      console.log(`SSE connection established: sessionId=${transport.sessionId}`);
      await server.connect(transport);
    } catch (err) {
      console.error('Error during SSE handshake:', err);
      res.status(500).end();
      return;
    }
  };

  const msgHandler: RequestHandler = async (req, res) => {
    const sessionId = String(req.query.sessionId);
    const transport = transports[sessionId];
    if (!transport) {
      console.error(`No transport for sessionId=${sessionId}`);
      res.status(400).send('No transport for sessionId');
      return;
    }
    try {
      await transport.handlePostMessage(req, res);
    } catch (err) {
      console.error(`Error handling message for sessionId=${sessionId}:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
  };

  router.get('/mcp/sse', sseHandler);
  router.post('/mcp/messages', msgHandler);

  const port = Number(cliPort) || Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`Supabase MCP HTTP SSE server listening on port ${port}`);
  });
}

main().catch((err) => {
  console.error('Fatal error in HTTP server:', err);
  process.exit(1);
});