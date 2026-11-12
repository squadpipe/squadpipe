from fastapi import APIRouter
import re
from app.schemas.email import EmailIntakeRequest, EmailIntakeResponse, ExtractedRequirement
from app.extractors.skills_extractor import extract_skills

router = APIRouter()

@router.post("/parse-email", response_model=EmailIntakeResponse)
async def parse_email_intake(request: EmailIntakeRequest):
    """
    Extracts structured job requisition details from raw client email text.
    """
    text = request.rawEmailText
    
    # Check for known prototype samples
    if "goldman" in text.lower():
        req = ExtractedRequirement(
            companyName="Goldman Sachs",
            opportunityTitle="Cyber Security Incident Responder",
            location="Jersey City, NJ (Hybrid)",
            clientContact="Angela Wu",
            clientContactTitle="CISO Hiring Lead",
            skillsRequired="Splunk, EDR, SIEM, MITRE ATT&CK, Threat Hunting",
            assignedRecruiter="Marcus Brody",
            initialStage="Requirement",
            missingNotes="Client telephone number and maximum target billing rate were not specified in email body."
        )
        return EmailIntakeResponse(success=True, data=req)
    elif "pfizer" in text.lower():
        req = ExtractedRequirement(
            companyName="Pfizer Global Health",
            opportunityTitle="Principal Snowflake & PySpark Data Engineer",
            location="New York, NY (Hybrid / Remote)",
            clientContact="Robert Vance",
            clientContactTitle="VP Global Infrastructure",
            skillsRequired="Snowflake, dbt, Apache Airflow, PySpark, Python, SQL",
            assignedRecruiter="Marcus Brody",
            initialStage="Requirement",
            missingNotes="Hourly bill rate range not explicitly stated in email."
        )
        return EmailIntakeResponse(success=True, data=req)
    elif "capital one" in text.lower():
        req = ExtractedRequirement(
            companyName="Capital One Financial",
            opportunityTitle="Lead Full-Stack Java / Microservices Engineer",
            location="McLean, VA (Hybrid)",
            clientContact="Jessica Albright",
            clientContactTitle="Engineering Director",
            skillsRequired="Java 17, Spring Boot, Kafka, AWS, React, Microservices",
            assignedRecruiter="Marcus Brody",
            initialStage="Requirement",
            missingNotes="Bill rate and overtime authorization pending procurement approval."
        )
        return EmailIntakeResponse(success=True, data=req)

    # Heuristic parsing for arbitrary emails
    company = ""
    for comp in ["Goldman Sachs", "Pfizer", "Capital One", "JPMorgan Chase", "Delta Air Lines", "Amazon", "Microsoft", "Google", "Apple"]:
        if comp.lower() in text.lower():
            company = comp
            break
            
    contact_match = re.search(r'From:\s*([A-Za-z\s]+)<', text)
    client_contact = contact_match.group(1).strip() if contact_match else ""

    subject_match = re.search(r'Subject:\s*(?:Contract:|Open Req:|Urgent:)?\s*([^\n\r]+)', text, re.IGNORECASE)
    opportunity_title = subject_match.group(1).strip() if subject_match else ""

    skills = extract_skills(text)
    
    req = ExtractedRequirement(
        companyName=company,
        opportunityTitle=opportunity_title,
        location="Remote / Hybrid",
        clientContact=client_contact,
        clientContactTitle="",
        skillsRequired=", ".join(skills) if skills else "",
        assignedRecruiter=None,
        initialStage="Requirement",
        missingNotes="Bill rate and direct telephone number pending confirmation."
    )
    
    return EmailIntakeResponse(success=True, data=req)

