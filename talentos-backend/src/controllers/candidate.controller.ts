import { Request, Response } from 'express';
import { candidateService } from '../services/candidate.service';

export const getCandidates = async (req: Request, res: Response) => {
  const { search, stage } = req.query;
  const candidates = await candidateService.getCandidates({
    search: search ? String(search) : undefined,
    stage: stage ? String(stage) : undefined,
  });
  res.json({ success: true, data: candidates });
};

export const createCandidate = async (req: Request, res: Response) => {
  const candidate = await candidateService.createCandidate(req.body);
  res.status(201).json({ success: true, data: candidate });
};

export const getCandidateById = async (req: Request, res: Response) => {
  const candidate = await candidateService.getCandidateById(req.params.id);
  if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
  res.json({ success: true, data: candidate });
};
