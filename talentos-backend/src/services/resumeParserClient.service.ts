export class ResumeParserClientService {
  private parserBaseUrl: string;
  private internalApiKey: string;

  constructor() {
    this.parserBaseUrl = process.env.RESUME_PARSER_SERVICE_URL || 'http://localhost:8000';
    this.internalApiKey = (process.env.RESUME_PARSER_API_KEY || '').trim();
  }

  private buildHeaders(includeJsonContentType = false): Record<string, string> {
    const headers: Record<string, string> = {};
    if (includeJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.internalApiKey) {
      headers['X-Internal-API-Key'] = this.internalApiKey;
    }
    return headers;
  }

  async parseResume(formData: FormData) {
    const response = await fetch(`${this.parserBaseUrl}/api/v1/parse-resume`, {
      method: 'POST',
      headers: this.buildHeaders(false),
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
      headers: this.buildHeaders(true),
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
      headers: this.buildHeaders(true),
      body: JSON.stringify({ requirementId, skillsRequired, candidates })
    });
    if (!response.ok) {
      throw new Error(`Skill matching failed with status ${response.status}`);
    }
    return response.json();
  }
}

export const resumeParserClientService = new ResumeParserClientService();

