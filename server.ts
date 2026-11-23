import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { requireAuth, type AuthenticatedRequest } from './server/authMiddleware.ts';
import {
  BRAZILIAN_UFS,
  classifyFiscalLinkByUf,
  formatNcmCode,
  normalizeNcmDigits,
} from './server/fiscalRules.ts';
import {
  extractProductsFromPdf,
  suggestNcmForProducts,
  UpstreamAiError,
} from './server/geminiService.ts';
import {
  ensureNcmLoaded,
  getNcmStatus,
  lookupNcmByCode,
  searchNcm,
  updateNcmFromReceitaFederal,
} from './server/ncmService.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
  },
});

async function startServer(): Promise<void> {
  // Carrega automaticamente a Tabela NCM na primeira execução
  const initialNcmState = ensureNcmLoaded();
  console.log(
    `Tabela NCM carregada automaticamente: ${initialNcmState.totalEntries} códigos (${initialNcmState.actReference})`
  );

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Endpoint de status público mínimo (sem dados sensíveis)
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Listar UFs disponíveis
  app.get('/api/ufs', (_req, res) => {
    res.json({ ufs: BRAZILIAN_UFS });
  });

  // Status da tabela NCM oficial carregada
  app.get('/api/ncm/status', requireAuth, (_req, res) => {
    res.json(getNcmStatus());
  });

  // Busca na tabela NCM oficial
  app.get('/api/ncm/search', requireAuth, (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limitParam = Number(req.query.limit || 60);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 60;
    const entries = searchNcm(q, limit);
    res.json({ entries, totalLoaded: getNcmStatus().totalEntries });
  });

  // Lookup exato de NCM
  app.get('/api/ncm/lookup/:code', requireAuth, (req, res) => {
    const code = typeof req.params.code === 'string' ? req.params.code : '';
    const entry = lookupNcmByCode(code);
    if (!entry) {
      res.status(404).json({ error: 'Código NCM não encontrado na tabela carregada.' });
      return;
    }
    res.json({ entry });
  });

  // Botão "Atualizar Tabela NCM" — baixa versão mais recente da Receita Federal / Siscomex
  app.post('/api/ncm/update', requireAuth, async (_req: AuthenticatedRequest, res) => {
    try {
      const result = await updateNcmFromReceitaFederal();
      if (!result.ok) {
        res.status(502).json({
          ok: false,
          error: result.error,
          state: result.state,
        });
        return;
      }
      res.json({ ok: true, state: result.state });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao atualizar tabela NCM da Receita Federal.';
      res.status(500).json({ ok: false, error: message, state: getNcmStatus() });
    }
  });

  // Menu adicional: Importação via PDF (cardápio ou lista de produtos)
  app.post(
    '/api/pdf/extract',
    requireAuth,
    upload.single('file'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const file = req.file;
        if (!file) {
          res.status(400).json({ error: 'Nenhum arquivo PDF enviado.' });
          return;
        }
        const isPdf =
          file.mimetype === 'application/pdf' ||
          file.originalname.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
          res.status(400).json({ error: 'Formato inválido. Anexe um arquivo PDF.' });
          return;
        }

        const products = await extractProductsFromPdf(file.buffer, file.originalname);
        res.json({
          fileName: file.originalname,
          count: products.length,
          products,
        });
      } catch (err) {
        console.error('Erro na extração de PDF:', err);
        const statusCode = err instanceof UpstreamAiError ? err.statusCode : 500;
        const message =
          err instanceof Error
            ? err.message
            : 'Erro ao processar o documento PDF com inteligência fiscal.';
        res.status(statusCode).json({ error: message });
      }
    }
  );

  // Sugestão automática de NCM para produtos com NCM em branco
  app.post('/api/classify/suggest-ncm', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body as {
        items?: Array<{ id?: string; description?: string; category?: string }>;
      };
      if (!Array.isArray(body?.items) || body.items.length === 0) {
        res.status(400).json({ error: 'Envie ao menos um produto para sugestão de NCM.' });
        return;
      }

      const sanitized = body.items
        .slice(0, 500)
        .map((item, idx) => ({
          id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : String(idx),
          description: typeof item.description === 'string' ? item.description.trim().slice(0, 300) : '',
          category: typeof item.category === 'string' ? item.category.trim().slice(0, 100) : '',
        }))
        .filter((item) => item.description.length > 0);

      if (sanitized.length === 0) {
        res.status(400).json({ error: 'Nenhuma descrição de produto válida informada.' });
        return;
      }

      const suggestions = await suggestNcmForProducts(sanitized);
      res.json({ suggestions });
    } catch (err) {
      console.error('Erro ao sugerir NCMs:', err);
      const statusCode = err instanceof UpstreamAiError ? err.statusCode : 500;
      const message =
        err instanceof Error
          ? err.message
          : 'Erro ao cruzar produtos com a tabela NCM oficial.';
      res.status(statusCode).json({ error: message });
    }
  });

  // Classificação automática de Vínculo Fiscal por UF (Tributado ou Substituição Tributária)
  app.post('/api/classify/fiscal-link', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body as {
        uf?: string;
        items?: Array<{ id?: string; ncm?: string; category?: string }>;
      };

      const uf = typeof body?.uf === 'string' ? body.uf.trim().toUpperCase() : '';
      if (!/^[A-Z]{2}$/.test(uf) || !BRAZILIAN_UFS.some((u) => u.code === uf)) {
        res.status(400).json({ error: 'UF inválida. Selecione um estado brasileiro válido.' });
        return;
      }

      if (!Array.isArray(body?.items) || body.items.length === 0) {
        res.status(400).json({ error: 'Envie ao menos um item com NCM para classificar.' });
        return;
      }

      const results = body.items.slice(0, 5000).map((item, idx) => {
        const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : String(idx);
        const rawNcm = typeof item.ncm === 'string' ? item.ncm : '';
        const category = typeof item.category === 'string' ? item.category.trim().slice(0, 100) : '';
        const digits = normalizeNcmDigits(rawNcm);
        const formattedNcm = digits.length === 8 ? formatNcmCode(digits) : digits || rawNcm.trim();
        const officialEntry = digits.length === 8 ? lookupNcmByCode(digits) : null;
        const classification = classifyFiscalLinkByUf(digits, uf, category);

        return {
          id,
          ncm: formattedNcm,
          ncmDescription: officialEntry ? officialEntry.description : '',
          fiscalLink: classification.fiscalLink,
          segment: classification.segment,
          reason: classification.reason,
        };
      });

      res.json({ uf, results });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao classificar vínculo fiscal por UF.';
      res.status(500).json({ error: message });
    }
  });

  // Tratamento de erros do Multer
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err instanceof multer.MulterError) {
        res.status(400).json({ error: `Erro no envio do arquivo: ${err.message}` });
        return;
      }
      next(err);
    }
  );

  if (isProduction) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor NCM Fiscal rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
