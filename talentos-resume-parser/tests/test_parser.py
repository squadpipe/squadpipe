import sys
import os

# Add parent directory to python path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.extractors.contact_extractor import extract_contacts
from app.extractors.work_auth_extractor import extract_work_authorization
from app.extractors.skills_extractor import extract_skills, extract_current_title
from app.extractors.education_extractor import extract_education

def test_contact_extractor():
    text = "Anand Verma | Austin, TX\nPhone: (512) 555-0144 | anand.verma@cloudmail.com\nLead Cloud Architect"
    name, email, phone = extract_contacts(text)
    assert name == "Anand Verma", f"Expected Anand Verma, got {name}"
    assert email == "anand.verma@cloudmail.com", f"Expected anand.verma@cloudmail.com, got {email}"
    assert phone == "+1 (512) 555-0144", f"Expected +1 (512) 555-0144, got {phone}"
    print("✅ Contact Extractor: PASSED")

def test_work_authorization_detector():
    cases = [
        ("Candidate is a US Citizen and does not require sponsorship", "US Citizen"),
        ("Permanent Resident (Green Card holder) authorized to work", "Green Card"),
        ("Currently on H-1B visa, transfer ready", "H-1B"),
        ("Available on C2C basis with corp-to-corp subcontracting", "C2C Subcontractor"),
        ("Open to W-2 hourly contract engagement", "W2 Hourly"),
        ("Canadian national working under TN Visa status", "TN Visa")
    ]
    for text, expected in cases:
        result = extract_work_authorization(text)
        assert result == expected, f"For '{text}', expected {expected}, got {result}"
    print("✅ Work Authorization Detector: PASSED")

def test_skills_extractor():
    text = """
    TECHNICAL EXPERTISE:
    Cloud Platforms: AWS (EKS, VPC, IAM), GCP
    Infrastructure as Code: Terraform, Helm, Docker, Kubernetes
    Data Processing: Snowflake, PySpark, Databricks, Apache Airflow
    Languages: Python, Go, Java 17, Spring Boot, TypeScript
    """
    skills = extract_skills(text)
    expected_subset = ["AWS", "GCP", "Kubernetes", "Docker", "Terraform", "Helm", "Snowflake", "Databricks", "Python"]
    for s in expected_subset:
        assert s in skills, f"Expected skill {s} was not extracted"
    print("✅ Tech Skill Taxonomy Extractor: PASSED")

def test_education_extractor():
    text = "University of Texas at Austin\nMaster of Science in Computer Science, GPA: 3.9"
    degree = extract_education(text)
    assert "Master" in degree, f"Expected Master degree, got {degree}"
    print("✅ Education Extractor: PASSED")

def test_title_heuristic():
    text = "Alex Rivera\nSenior Cloud Security Architect\nAustin, TX"
    title = extract_current_title(text, ["AWS", "Terraform"])
    assert "Architect" in title or "Senior" in title, f"Expected architect title, got {title}"
    print("✅ Job Title Heuristic: PASSED")

def test_spacy_and_international_contact():
    text = "CONFIDENTIAL RESUME\nPriya Nair | Bengaluru, India\n+91 98765 43210 | priya.nair@finserv.in"
    name, email, phone = extract_contacts(text)
    assert name == "Priya Nair", f"Expected Priya Nair, got {name}"
    assert email == "priya.nair@finserv.in", f"Expected priya.nair@finserv.in, got {email}"
    assert phone and "+91" in phone, f"Expected +91 phone, got {phone}"
    print("✅ spaCy Header & International Phone: PASSED")

def test_non_it_healthcare_and_finance():
    nurse_text = """
    Sarah Jenkins
    Boston, MA | sarah.j@careclinic.org | (617) 555-0192

    Skills
    Epic EHR, HIPAA Compliance, Patient Triage, BLS, ACLS, IV Therapy

    Experience
    Registered Nurse | 2021 - Present
    Boston Medical Center

    Education
    Bachelor of Science in Nursing (BSN)
    """
    skills = extract_skills(nurse_text)
    assert "Epic" in skills or "Epic EHR" in skills, f"Expected Epic skill, got {skills}"
    assert "HIPAA" in skills or "HIPAA Compliance" in skills, f"Expected HIPAA skill, got {skills}"
    assert "IV Therapy" in skills, f"Expected section-extracted IV Therapy, got {skills}"

    title = extract_current_title(nurse_text, skills)
    assert "Registered Nurse" in title, f"Expected Registered Nurse from Experience, got {title}"

    edu = extract_education(nurse_text)
    assert "BSN" in edu or "Nursing" in edu, f"Expected Nursing degree, got {edu}"
    print("✅ Non-IT Section-Aware Extraction: PASSED")

if __name__ == "__main__":
    print("========================================================")
    print("SquadPipe Python NLP Resume Parser Test Suite")
    print("========================================================\n")
    test_contact_extractor()
    test_work_authorization_detector()
    test_skills_extractor()
    test_education_extractor()
    test_title_heuristic()
    test_spacy_and_international_contact()
    test_non_it_healthcare_and_finance()
    print("\n========================================================")
    print("🎉 ALL PYTHON NLP EXTRACTOR TESTS PASSED (100% Success)")
    print("========================================================")

