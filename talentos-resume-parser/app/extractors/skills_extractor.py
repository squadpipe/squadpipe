import re
from typing import List

TECH_SKILLS_TAXONOMY = [
    # Cloud & DevOps
    "AWS", "Amazon Web Services", "Azure", "GCP", "Google Cloud", "Kubernetes", "Docker", "Terraform",
    "Helm", "Ansible", "CI/CD", "GitLab", "GitHub Actions", "Jenkins", "FedRAMP", "IAM", "VPC", "EKS",
    # Data & Analytics
    "Snowflake", "Databricks", "PySpark", "Apache Spark", "Airflow", "dbt", "Kafka", "Hadoop", "Flink",
    "SQL", "PostgreSQL", "MySQL", "MongoDB", "Cassandra", "DynamoDB", "BigQuery", "Redshift",
    # Programming & Frameworks
    "Python", "Java", "Java 17", "Spring Boot", "Spring Cloud", "Node.js", "TypeScript", "JavaScript",
    "React", "Vue", "Angular", "Go", "Golang", "C++", "C#", ".NET", "Rust", "Scala", "PHP",
    # Architecture & Enterprise
    "Microservices", "REST API", "GraphQL", "SAP", "SAP FICO", "S/4HANA", "Salesforce",
    "Cyber Security", "SIEM", "Splunk", "EDR", "MITRE ATT&CK", "Threat Hunting", "DevSecOps"
]

def extract_skills(text: str) -> List[str]:
    """Finds matching technical competencies from text."""
    found = []
    text_lower = text.lower()
    for skill in TECH_SKILLS_TAXONOMY:
        # Match as full word
        pattern = r'(?<![a-zA-Z0-9])' + re.escape(skill.lower()) + r'(?![a-zA-Z0-9])'
        if re.search(pattern, text_lower):
            # Normalize synonyms
            normalized = skill
            if skill in ["Amazon Web Services", "Google Cloud"]:
                normalized = "AWS" if skill == "Amazon Web Services" else "GCP"
            if normalized not in found:
                found.append(normalized)
    return found[:25] # Return top matched competencies

def extract_current_title(text: str, default_skills: List[str]) -> str:
    """Heuristic to determine current candidate job title."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines[:10]:
        line_clean = line.lower()
        if any(keyword in line_clean for keyword in ["architect", "engineer", "lead", "developer", "specialist", "consultant", "director", "manager"]):
            if len(line.split()) <= 7 and not line_clean.startswith("summary") and not line_clean.startswith("experience"):
                return line.strip(" |•-")
                
    # Fallback based on top skills
    if "Snowflake" in default_skills or "Databricks" in default_skills:
        return "Senior Data Platform Engineer"
    if "Kubernetes" in default_skills or "Terraform" in default_skills or "AWS" in default_skills:
        return "Lead Cloud DevOps Architect"
    if "Java" in default_skills or "Spring Boot" in default_skills:
        return "Senior Full-Stack Java Engineer"
        
    return "Senior Technical Consultant"

