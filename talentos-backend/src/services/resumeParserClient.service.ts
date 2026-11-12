export class ResumeParserClientService {
  private parserBaseUrl: string;

  constructor() {
    this.parserBaseUrl = process.env.RESUME_PARSER_SERVICE_URL || 'http://localhost:8000';
  }

  async parseResume(formData: FormData) {
    const response = await fetch(`${this.parserBaseUrl}/api/v1/parse-resume`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      throw new Error(`Resume parser failed with status ${response.status}`);
    }
    return response.json();
  }

  async parseEmail(rawEmailText: string) {
    const response = await fetch(`${this.parserBaseUrl}/api/v1/parse-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawEmailText })
    });
    if (!response.ok) {
      throw new Error(`Email parser failed with status ${response.status}`);
    }
    return response.json();
  }

  async matchSkills(requirementId: string, skillsRequired: string, candidates: any[]) {
    const response = await fetch(`${this.parserBaseUrl}/api/v1/match-skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requirementId, skillsRequired, candidates })
    });
    if (!response.ok) {
      throw new Error(`Skill matching failed with status ${response.status}`);
    }
    return response.json();
  }

  async generatePitch(payload: {
    candidateName: string;
    candidateTitle: string;
    candidateSkills: string;
    companyName: string;
    jobTitle: string;
    tone: string;
  }) {
    const response = await fetch(`${this.parserBaseUrl}/api/v1/generate-pitch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`Pitch generation failed with status ${response.status}`);
    }
    return response.json();
  }
}

export const resumeParserClientService = new ResumeParserClientService();

