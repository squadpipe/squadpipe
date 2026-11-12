import React, { useState } from 'react';
import { Requirement } from '../../types';

interface EmailParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (req: Requirement) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const EmailParserModal: React.FC<EmailParserModalProps> = ({
  isOpen,
  onClose,
  onApprove,
  showToast,
}) => {
  const [activeSample, setActiveSample] = useState<'goldman' | 'pfizer' | 'capitalone'>('goldman');
  const [rawEmailText, setRawEmailText] = useState<string>(
    `From: Angela Wu <angela.wu@gs.com>\nSubject: Urgent: Cyber Security Incident Responder for Jersey City\n\nHi Team,\nWe have an immediate need for an experienced Incident Responder at Goldman Sachs (Jersey City, hybrid 3 days). Looking for someone with Splunk, EDR, SIEM, and MITRE ATT&CK hands-on background. Start date next month.`
  );

  const [extractedReq, setExtractedReq] = useState({
    companyName: 'Goldman Sachs',
    opportunityTitle: 'Cyber Security Incident Responder',
    location: 'Jersey City, NJ (Hybrid)',
    clientContact: 'Angela Wu',
    clientContactTitle: 'CISO Hiring Lead',
    skillsRequired: 'Splunk, EDR, SIEM, MITRE ATT&CK, Threat Hunting',
    assignedRecruiter: '',
    targetBillRate: 115,
    targetPayRate: 85,
    missingNotes: 'Client telephone number and maximum target billing rate were not specified in email body.'
  });

  if (!isOpen) return null;

  const handleSelectSample = (sample: 'goldman' | 'pfizer' | 'capitalone') => {
    setActiveSample(sample);
    if (sample === 'goldman') {
      setRawEmailText(
        `From: Angela Wu <angela.wu@gs.com>\nSubject: Urgent: Cyber Security Incident Responder for Jersey City\n\nHi Team,\nWe have an immediate need for an experienced Incident Responder at Goldman Sachs (Jersey City, hybrid 3 days). Looking for someone with Splunk, EDR, SIEM, and MITRE ATT&CK hands-on background. Start date next month.`
      );
      setExtractedReq({
        companyName: 'Goldman Sachs',
        opportunityTitle: 'Cyber Security Incident Responder',
        location: 'Jersey City, NJ (Hybrid)',
        clientContact: 'Angela Wu',
        clientContactTitle: 'CISO Hiring Lead',
        skillsRequired: 'Splunk, EDR, SIEM, MITRE ATT&CK, Threat Hunting',
        assignedRecruiter: '',
        targetBillRate: 115,
        targetPayRate: 85,
        missingNotes: 'Client telephone number and maximum target billing rate were not specified in email body.'
      });
    } else if (sample === 'pfizer') {
      setRawEmailText(
        `From: Robert Vance <robert.vance@pfizer.com>\nSubject: Contract: Principal Snowflake & PySpark Data Engineer\n\nHello Team,\nPfizer Global Health needs a senior Data Engineer for our clinical trials pipeline in New York / Remote. Must have 7+ years with Snowflake, dbt, Apache Airflow, and PySpark. Contract length 12 months with extension.`
      );
      setExtractedReq({
        companyName: 'Pfizer Global Health',
        opportunityTitle: 'Principal Snowflake & PySpark Data Engineer',
        location: 'New York, NY (Hybrid / Remote)',
        clientContact: 'Robert Vance',
        clientContactTitle: 'VP Global Infrastructure',
        skillsRequired: 'Snowflake, dbt, Apache Airflow, PySpark, Python, SQL',
        assignedRecruiter: '',
        targetBillRate: 125,
        targetPayRate: 95,
        missingNotes: 'Hourly bill rate range not explicitly stated in email.'
      });
    } else {
      setRawEmailText(
        `From: Jessica Albright <jessica.albright@capitalone.com>\nSubject: Open Req: Lead Full-Stack Java / Microservices Engineer\n\nHi Team,\nCapital One is looking for a Lead Java Backend Engineer for our McLean, VA campus. Heavy Kafka event-driven architectures, Spring Boot 3, and AWS EKS. Target start in 3 weeks.`
      );
      setExtractedReq({
        companyName: 'Capital One Financial',
        opportunityTitle: 'Lead Full-Stack Java / Microservices Engineer',
        location: 'McLean, VA (Hybrid)',
        clientContact: 'Jessica Albright',
        clientContactTitle: 'Engineering Director',
        skillsRequired: 'Java 17, Spring Boot, Kafka, AWS, React, Microservices',
        assignedRecruiter: '',
        targetBillRate: 120,
        targetPayRate: 92,
        missingNotes: 'Bill rate and overtime authorization pending procurement approval.'
      });
    }
    showToast('Email Parsed', `Extracted requisition requirements for ${sample}!`, 'fa-solid fa-bolt text-amber-500');
  };

  const handleApprove = () => {
    const newReq: Requirement = {
      id: 'req_' + Date.now(),
      code: 'REQ-' + Math.floor(1004 + Math.random() * 50),
      companyName: extractedReq.companyName,
      opportunityTitle: extractedReq.opportunityTitle,
      location: extractedReq.location,
      clientContact: extractedReq.clientContact,
      clientContactTitle: extractedReq.clientContactTitle,
      skillsRequired: extractedReq.skillsRequired,
      status: 'Requirement',
      assignedRecruiter: extractedReq.assignedRecruiter,
      targetBillRate: extractedReq.targetBillRate,
      targetPayRate: extractedReq.targetPayRate,
    };
    onApprove(newReq);
    onClose();
    showToast('Requirement Created', `${newReq.code} (${newReq.opportunityTitle}) added to pipeline!`, 'fa-solid fa-circle-check text-emerald-400');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 card-shadow overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <i className="fa-solid fa-envelope-open-text text-sm"></i>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Client Email Job Order Intake Parser</h3>
              <p className="text-[11px] text-slate-400">Extracts company, hiring lead, skills, and work model from raw emails</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Sample Selectors */}
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">Load Client Email Samples:</span>
            <div className="flex gap-2">
              {(['goldman', 'pfizer', 'capitalone'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleSelectSample(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    activeSample === s
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {s === 'goldman' ? 'Goldman Sachs' : s === 'pfizer' ? 'Pfizer' : 'Capital One'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Raw Email Snippet */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Raw Email Body</label>
              <textarea
                rows={9}
                value={rawEmailText}
                onChange={(e) => setRawEmailText(e.target.value)}
                className="mt-1 w-full p-3 text-xs bg-slate-50 font-mono border border-slate-200 rounded-xl text-slate-700 leading-relaxed focus:bg-white"
              ></textarea>
            </div>

            {/* Extracted Requirement Form */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <i className="fa-solid fa-circle-check text-emerald-500"></i>
                <span>Extracted Requisition Fields</span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Target Company</label>
                <input
                  type="text"
                  value={extractedReq.companyName}
                  onChange={(e) => setExtractedReq({ ...extractedReq, companyName: e.target.value })}
                  className="mt-0.5 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Job / Opportunity Title</label>
                <input
                  type="text"
                  value={extractedReq.opportunityTitle}
                  onChange={(e) => setExtractedReq({ ...extractedReq, opportunityTitle: e.target.value })}
                  className="mt-0.5 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Client Contact</label>
                  <input
                    type="text"
                    value={extractedReq.clientContact}
                    onChange={(e) => setExtractedReq({ ...extractedReq, clientContact: e.target.value })}
                    className="mt-0.5 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Location & Model</label>
                  <input
                    type="text"
                    value={extractedReq.location}
                    onChange={(e) => setExtractedReq({ ...extractedReq, location: e.target.value })}
                    className="mt-0.5 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Required Skillset</label>
                <input
                  type="text"
                  value={extractedReq.skillsRequired}
                  onChange={(e) => setExtractedReq({ ...extractedReq, skillsRequired: e.target.value })}
                  className="mt-0.5 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="text-[11px] text-slate-400">
            Initial Stage: <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Requirement</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm shadow-blue-600/20 flex items-center gap-1.5 transition-all"
            >
              <i className="fa-solid fa-plus text-xs"></i>
              <span>Approve & Create Requisition</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
