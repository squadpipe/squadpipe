import re
from functools import lru_cache
from typing import List
from spacy.matcher import PhraseMatcher
from app.extractors.nlp_engine import get_nlp, split_resume_sections

MULTI_INDUSTRY_SKILLS_TAXONOMY = [
    # Cloud, DevOps & Infrastructure
    "AWS", "Amazon Web Services", "Azure", "GCP", "Google Cloud", "Kubernetes", "Docker", "Terraform",
    "Helm", "Ansible", "CI/CD", "GitLab", "GitHub Actions", "Jenkins", "FedRAMP", "IAM", "VPC", "EKS",
    "Linux", "Nginx", "Prometheus", "Grafana", "VMware", "Active Directory", "OpenShift", "Pulumi",
    # Data, Analytics & AI/ML
    "Snowflake", "Databricks", "PySpark", "Apache Spark", "Airflow", "Apache Airflow", "dbt", "Kafka",
    "Hadoop", "Flink", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Cassandra", "DynamoDB", "BigQuery",
    "Redshift", "Power BI", "Tableau", "Looker", "Snowpark", "ETL", "Machine Learning", "Deep Learning",
    "NLP", "LLM", "PyTorch", "TensorFlow", "Scikit-learn", "LangChain", "RAG", "Pandas", "NumPy",
    # Programming, Web & Mobile
    "Python", "Java", "Java 17", "Spring Boot", "Spring Cloud", "Node.js", "Express", "TypeScript", "JavaScript",
    "React", "Redux", "Next.js", "Vue", "Angular", "Tailwind CSS", "Go", "Golang", "C++", "C#", ".NET", "Rust", "Scala", "PHP",
    "FastAPI", "Django", "Flask", "Ruby on Rails", "Swift", "Kotlin", "React Native", "Flutter",
    # QA, Testing & Security
    "Selenium", "Playwright", "Cypress", "JUnit", "PyTest", "Postman", "LoadRunner", "JMeter",
    "Cyber Security", "SIEM", "Splunk", "EDR", "MITRE ATT&CK", "Threat Hunting", "DevSecOps",
    "SOC 2", "ISO 27001", "Penetration Testing", "Zero Trust", "Okta", "CrowdStrike",
    # Architecture, Enterprise & SaaS
    "Microservices", "REST API", "REST APIs", "GraphQL", "SAP", "SAP FICO", "SAP MM", "SAP SD", "S/4HANA",
    "Salesforce", "ServiceNow", "ITSM", "Flow Designer", "Workday", "Oracle NetSuite", "NetSuite",
    "Dynamics 365", "Jira", "Confluence", "SharePoint", "Zendesk",
    # Engineering, CAD & Manufacturing
    "AutoCAD", "SolidWorks", "CATIA", "Revit", "MATLAB", "PLC", "SCADA", "ANSYS", "CNC",
    "Quality Assurance", "ISO 9001", "Six Sigma", "Lean", "Kaizen", "GMP", "FDA Compliance",
    # Finance, Banking, Insurance & Accounting
    "GAAP", "IFRS", "FP&A", "QuickBooks", "Financial Modeling", "Audit", "Taxation", "Accounts Payable",
    "Accounts Receivable", "Payroll", "Microsoft Excel", "Excel", "Bloomberg", "Risk Management",
    "Underwriting", "Claims Processing", "KYC", "AML", "SOX", "SAP Concur", "Xero", "Valuation",
    # Healthcare, Clinical & Pharma
    "HIPAA", "EHR", "EMR", "Epic", "Cerner", "MEDITECH", "BLS", "ACLS", "ICD-10", "CPT Coding",
    "Patient Care", "Clinical Trials", "Phlebotomy", "Triage", "HL7", "FHIR", "Pharmacovigilance",
    "Medical Billing", "Case Management",
    # Legal, Compliance & Policy
    "Contract Management", "Corporate Law", "Litigation", "eDiscovery", "GDPR", "CCPA", "Regulatory Compliance",
    "Legal Research", "Westlaw", "LexisNexis", "Due Diligence",
    # Marketing, Design, Product & Sales
    "Product Management", "UI/UX", "Figma", "Adobe Creative Suite", "Photoshop", "Illustrator",
    "SEO", "SEM", "Google Analytics", "HubSpot", "Marketo", "CRM", "B2B Sales", "Account Management",
    "Lead Generation", "Cold Calling", "Salesforce CRM", "Copywriting",
    # HR, Operations, Supply Chain & Logistics
    "Project Management", "PMP", "Agile", "Scrum", "Kanban", "Supply Chain", "Procurement",
    "Logistics", "WMS", "Inventory Management", "Freight", "ERP", "Recruiting", "Talent Acquisition",
    "Onboarding", "Employee Relations", "HRIS", "BambooHR", "ADP", "Compensation & Benefits",
]

SYNONYM_MAP = {
    "amazon web services": "AWS",
    "google cloud": "GCP",
    "apache airflow": "Airflow",
    "microsoft excel": "Excel",
    "salesforce crm": "Salesforce",
    "rest api": "REST APIs",
    "rest apis": "REST APIs",
}

TITLE_KEYWORDS = (
    "architect", "engineer", "developer", "lead", "director", "manager",
    "specialist", "consultant", "coordinator", "analyst", "accountant",
    "controller", "auditor", "nurse", "therapist", "pharmacist", "physician",
    "recruiter", "administrator", "executive", "officer", "supervisor",
    "technician", "designer", "scientist", "associate", "partner", "counsel",
    "attorney", "paralegal", "underwriter", "planner", "buyer", "strategist",
    "marketer", "representative", "assistant", "superintendent", "instructor",
)


@lru_cache(maxsize=1)
def _get_skill_matcher():
    nlp = get_nlp()
    matcher = PhraseMatcher(nlp.vocab, attr="LOWER")
    canonical_by_lower = {}
    patterns = []
    for skill in MULTI_INDUSTRY_SKILLS_TAXONOMY:
        canonical = SYNONYM_MAP.get(skill.lower(), skill)
        canonical_by_lower[skill.lower()] = canonical
        patterns.append(nlp.make_doc(skill))
    matcher.add("SKILLS", patterns)
    return nlp, matcher, canonical_by_lower


def _extract_skills_from_section_lines(lines: List[str]) -> List[str]:
    """Extracts explicit comma/pipe/bullet-separated skills from Skills/Certifications sections."""
    extracted: List[str] = []
    for line in lines:
        # Strip category prefix like "Cloud Platforms: AWS, GCP"
        if ":" in line:
            _, rhs = line.split(":", 1)
            candidate_text = rhs.strip()
        else:
            candidate_text = line

        tokens = re.split(r"[,•|;/]+", candidate_text)
        for raw_token in tokens:
            token = raw_token.strip(" .-•\t()")
            # Expand parenthetical sub-items like "AWS (EKS, VPC, IAM)"
            paren_match = re.match(r"^([A-Za-z0-9.+&/#\s-]+?)\s*\(([^)]+)\)$", raw_token.strip())
            if paren_match:
                base = paren_match.group(1).strip()
                inner = [p.strip() for p in paren_match.group(2).split(",") if p.strip()]
                for item in [base, *inner]:
                    if 2 <= len(item) <= 35 and len(item.split()) <= 4:
                        extracted.append(item)
                continue

            if 2 <= len(token) <= 35 and len(token.split()) <= 4 and not token.isdigit():
                extracted.append(token)
    return extracted


def extract_skills(text: str) -> List[str]:
    """Finds matching competencies via spaCy PhraseMatcher + section-aware Skills extraction."""
    found: List[str] = []
    seen_lower = set()

    def add_skill(skill_name: str):
        clean = skill_name.strip()
        key = clean.lower()
        if clean and key not in seen_lower:
            seen_lower.add(key)
            found.append(clean)

    # 1. Fast spaCy PhraseMatcher over the full document
    nlp, matcher, canonical_by_lower = _get_skill_matcher()
    doc = nlp(text)
    for _, start, end in matcher(doc):
        matched_text = doc[start:end].text.lower()
        add_skill(canonical_by_lower.get(matched_text, doc[start:end].text))

    # 2. Section-aware extraction for non-IT / niche skills listed in Skills or Certifications
    sections = split_resume_sections(text)
    section_lines = sections["skills"] + sections["certifications"]
    for item in _extract_skills_from_section_lines(section_lines):
        # Normalize known synonyms if matched
        normalized = SYNONYM_MAP.get(item.lower(), item)
        add_skill(normalized)

    return found[:45]


NON_TITLE_PROSE_STARTERS = (
    "summary", "experience", "education", "skills", "prepared by", "welcome to",
    "what is", "what you", "how to", "when a", "when an", "from the", "from adding",
    "follow one", "a guide", "the administrator", "administrators can", "recruiters can",
    "recruiters add", "once selected", "active placements", "role access", "section ",
    "contents", "good to know", "need help", "for teams",
)


def _looks_like_title(line: str) -> bool:
    raw_stripped = line.strip()
    if not raw_stripped or raw_stripped.startswith(("•", "-", "*", "1", "2", "3", "4", "5", "6", "7", "8", "9")):
        return False
    line_clean = raw_stripped.lower().strip(" |•-:")
    if "@" in line_clean or "http" in line_clean or "." in line_clean:
        return False
    words = line_clean.split()
    if not (2 <= len(words) <= 7):
        return False
    if line_clean.startswith(NON_TITLE_PROSE_STARTERS):
        return False
    # Reject conversational/prose lines containing verbs or pronouns
    if any(w in words for w in ("is", "are", "can", "will", "that", "this", "your", "our", "their", "every", "into", "across", "while", "before", "after")):
        return False
    return any(re.search(rf"\b{kw}s?\b", line_clean) for kw in TITLE_KEYWORDS)


def extract_current_title(text: str, default_skills: List[str]) -> str:
    """Determines current candidate job title from header, latest Experience role, or strong domain skills fallback."""
    sections = split_resume_sections(text)
    header_lines = sections["header"][:20] if sections["header"] else [
        line.strip() for line in text.splitlines() if line.strip()
    ][:20]

    for line in header_lines:
        if _looks_like_title(line):
            return line.strip(" |•-")

    # Check the top lines of Experience section (first/most recent role, extended for bulky CVs)
    for line in sections["experience"][:20]:
        # Strip trailing date ranges like " | 2021 - Present" or " (2022–2025)"
        candidate = re.split(r"\s*[|•]\s*(?:\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)", line, flags=re.IGNORECASE)[0]
        candidate = re.sub(r"\s*\(?\b(?:19|20)\d{2}\s*[-–—]\s*(?:Present|Current|(?:19|20)\d{2})\)?$", "", candidate, flags=re.IGNORECASE).strip()
        if _looks_like_title(candidate):
            return candidate.strip(" |•-")

    # Only use skill-based fallback when actual technical/domain specialization skills are present
    if "Snowflake" in default_skills or "Databricks" in default_skills:
        return "Senior Data Platform Engineer"
    if "Kubernetes" in default_skills or "Terraform" in default_skills or "AWS" in default_skills:
        return "Lead Cloud DevOps Architect"
    if "Java" in default_skills or "Spring Boot" in default_skills:
        return "Senior Full-Stack Java Engineer"
    if any(s in default_skills for s in ("GAAP", "FP&A", "QuickBooks", "Financial Modeling")):
        return "Senior Financial Analyst"
    if any(s in default_skills for s in ("HIPAA", "Epic", "Cerner", "Patient Care")):
        return "Healthcare Clinical Specialist"

    return ""
