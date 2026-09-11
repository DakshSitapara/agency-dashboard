import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { assertProjectAccess } from '../utils/authz';

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, clientId } = req.body;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw ApiError.badRequest('Client does not exist');

  const project = await prisma.project.create({
    data: { name, description, clientId, createdById: req.user!.id },
  });
  res.status(201).json({ success: true, data: project });
});

// Admin sees every project. A PM sees only projects they personally created -
// enforced in the WHERE clause, not filtered client-side after the fact.
export const listProjects = asyncHandler(async (req: Request, res: Response) => {
  const where = req.user!.role === Role.ADMIN ? {} : { createdById: req.user!.id };
  const projects = await prisma.project.findMany({
    where,
    include: {
      client: true,
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: projects });
});

export const getProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: { client: true, tasks: { include: { assignedTo: true } } },
  });
  if (!project) throw ApiError.notFound('Project not found');

  // Even though this project came from a DB lookup by id supplied by the
  // caller, we still verify ownership before returning anything - this is
  // exactly the check that stops a PM (or a Developer with a doctored token)
  // from reading another PM's project by guessing/enumerating its UUID.
  assertProjectAccess(req.user!, project);

  res.json({ success: true, data: project });
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(req.user!, project);

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: req.body,
  });
  res.json({ success: true, data: updated });
});
