import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../utils/asyncHandler';

export const listClients = asyncHandler(async (_req: Request, res: Response) => {
  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } });
  res.json({ success: true, data: clients });
});

export const createClient = asyncHandler(async (req: Request, res: Response) => {
  const { name, email } = req.body;
  const client = await prisma.client.create({ data: { name, email } });
  res.status(201).json({ success: true, data: client });
});
