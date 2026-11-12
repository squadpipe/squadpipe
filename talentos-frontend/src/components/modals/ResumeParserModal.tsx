import React, { useState } from 'react';
import axios from 'axios';
import { Candidate } from '../../types';

interface ResumeParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (candidate: Candidate) => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const ResumeParserModal: React.FC<ResumeParserModalProps> = ({
  isOpen,
  onClose,
  onApprove,
  showToast
}) => {
  const [activeSample, setActiveSample] = useState<'anand' | 'meera' | 'tarun'>('anand');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseProgress, setParseProgress] = useState<number>(100);
  const [profile, setProfile] = useState<any>({
    fullName: 'Anand Verma',
    phone: '+1 (512) 555-0144',
    email: 'anand.verma@cloudmail.com',
    workAuth: 'US Citizen',
    currentTitle: 'Lead AWS Infrastructure Architect',
    skillset: 'AWS, Terraform, Kubernetes, Helm, Python, Docker',
    education: "Master of Science in Computer Science",
    hourlyRate: '$92/hr (W2)',
    relocation: 'Yes',
    recruiter: 'Marcus Brody',
    fileName: 'Anand_Verma_AWS_Lead_Resume.pdf',
    rawSnippet: `Anand Verma | +1 (512) 555-0144 | anand.verma@cloudmail.com\nAustin, TX • Work Auth: US Citizen (No sponsorship needed)\n\nPROFESSIONAL SUMMARY:\nLead Cloud Architect with 9+ years experience architecting enterprise AWS environments, Terraform infrastructure-as-code, and production Kubernetes clusters.`
  });

  if (!isOpen) return null;

  const handleSelectSample = (sample: 'anand' | 'meera' | 'tarun') => {
    setActiveSample(sample);
    setIsParsing(true);
    setParseProgress(25);
    setTimeout(() => setParseProgress(65), 300);
    setTimeout(() => {
      setParseProgress(100);
      setIsParsing(false);
      if (sample === 'anand') {
        setProfile({
          fullName: 'Anand Verma',
          phone: '+1 (512) 555-0144',
          email: 'anand.verma@cloudmail.com',
          workAuth: 'US Citizen',
          currentTitle: 'Lead AWS Infrastructure Architect',
          skillset: 'AWS, Terraform, Kubernetes, Helm, Python, Docker',
          education: "Master of Science in Computer Science",
          hourlyRate: '$92/hr (W2)',
          relocation: 'Yes',
          recruiter: 'Marcus Brody',
          fileName: 'Anand_Verma_AWS_Lead_Resume.pdf',
          rawSnippet: `Anand Verma | +1 (512) 555-0144 | anand.verma@cloudmail.com\nAustin, TX • Work Auth: US Citizen`
        });
      } else if (sample === 'meera') {
        setProfile({
          fullName: 'Meera Krishnan',
          phone: '+1 (408) 555-8910',
          email: 'meera.krishnan@dataeng.io',
          workAuth: 'Green Card',
          currentTitle: 'Principal Snowflake & PySpark Data Engineer',
          skillset: 'Snowflake, PySpark, Databricks, dbt, Airflow, SQL',
          education: "Master of Science in Data Analytics",
          hourlyRate: '$98/hr (W2)',
          relocation: 'Yes',
          recruiter: 'Sarah Jenkins',
          fileName: 'Meera_Krishnan_Snowflake_Lead.pdf',
          rawSnippet: `Meera Krishnan | +1 (408) 555-8910 | meera.krishnan@dataeng.io\nSan Jose, CA • Work Auth: Green Card`
        });
      } else {
        setProfile({
          fullName: 'Tarun Sengupta',
          phone: '+1 (732) 555-2201',
          email: 'tarun.sengupta.dev@gmail.com',
          workAuth: 'H-1B',
          currentTitle: 'Lead Java Microservices Engineer',
          skillset: 'Java 17, Spring Boot, Kafka, Microservices, AWS, React',
          education: "Bachelor of Technology in Computer Science",
          hourlyRate: '$85/hr (C2C)',
          relocation: 'Yes',
          recruiter: 'Elena Rostova',
          fileName: 'Tarun_Sengupta_Java_Microservices.docx',
          rawSnippet: `Tarun Sengupta | +1 (732) 555-2201 | tarun.sengupta.dev@gmail.com\nEdison, NJ • Work Auth: H-1B`
        });
      }
      showToast('Sample Loaded & Parsed', `Extracted structured candidate profile for ${sample}.`);
    }, 600);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setIsParsing(true);
    setParseProgress(30);

    const formData = new FormData();
    formData.append('file', file);

    axios.post('http://localhost:8000/api/v1/parse-resume', formData)
      .then(res => {
        setParseProgress(100);
        setIsParsing(false);
        if (res.data?.data) {
          setProfile(res.data.data);
          showToast('Resume Parsed', `Extracted profile from ${file.name}!`, 'fa-solid fa-circle-check text-emerald-500');
        }
      })
      .catch(() => {
        setParseProgress(100);
        setIsParsing(false);
        const inferredName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setProfile({
          fullName: inferredName,
          phone: '',
          email: '',
          workAuth: 'US Citizen',
          education: '',
          currentTitle: '',
          skillset: '',
          hourlyRate: '',
          relocation: 'Yes',
          recruiter: '',
          fileName: file.name,
          rawSnippet: `Uploaded document: ${file.name}`
        });
        showToast('Parser Notice', `Uploaded ${file.name}. Please verify candidate fields.`, 'fa-solid fa-triangle-exclamation text-amber-500');
      });
  };

  const handleApprove = () => {
    const newCandidate: Candidate = {
      id: 'con_' + Date.now(),
      fullName: profile.fullName,
      phone: profile.phone,
      email: profile.email,
      workAuth: profile.workAuth,
      education: profile.education,
      currentTitle: profile.currentTitle,
      skillset: profile.skillset,
      hourlyRate: profile.hourlyRate,
      relocation: profile.relocation,
      resumeName: profile.fileName || '',
      resumeFormat: 'PDF (Direct Verified)',
      assignedRecruiter: profile.recruiter || '',
      pipelineStage: 'Available / Bench',
      rawSnippet: profile.rawSnippet
    };
    onApprove(newCandidate);
    onClose();
    showToast('Consultant Approved', `${newCandidate.fullName} registered to consultant roster!`, 'fa-solid fa-circle-check text-emerald-400');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 card-shadow overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
              <i className="fa-solid fa-file-invoice text-sm"></i>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Resume NLP & Pattern Extraction Engine</h3>
              <p className="text-[11px] text-slate-400">High-speed structured profile extraction from PDF / DOCX resumes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Sample Switcher & Dropzone */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-brand-400 transition-colors bg-slate-50/30 flex flex-col items-center justify-center relative">
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mb-2">
                <i className="fa-solid fa-cloud-arrow-up text-base"></i>
              </div>
              <div className="text-xs font-semibold text-slate-700">Drop resume here or click to browse</div>
              <div className="text-[10px] text-slate-400 mt-1">Supports PDF, DOCX and TXT files up to 15MB</div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div className="text-xs font-bold text-slate-700 mb-2">Instant Prototype Samples:</div>
              <div className="space-y-2">
                <button
                  onClick={() => handleSelectSample('anand')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-between transition-all ${
                    activeSample === 'anand'
                      ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>Anand Verma (AWS Lead)</span>
                  <span className="text-[10px] text-slate-400 font-mono">PDF</span>
                </button>
                <button
                  onClick={() => handleSelectSample('meera')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-between transition-all ${
                    activeSample === 'meera'
                      ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>Meera Krishnan (Snowflake)</span>
                  <span className="text-[10px] text-slate-400 font-mono">PDF</span>
                </button>
                <button
                  onClick={() => handleSelectSample('tarun')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-between transition-all ${
                    activeSample === 'tarun'
                      ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>Tarun Sengupta (Java Lead)</span>
                  <span className="text-[10px] text-slate-400 font-mono">DOCX</span>
                </button>
              </div>
            </div>
          </div>

          {/* Progress Bar when parsing */}
          {isParsing && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                <span>Extracting entities and normalizing competencies...</span>
                <span>{parseProgress}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-600 transition-all duration-300 rounded-full"
                  style={{ width: `${parseProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Extracted Profile Form */}
          <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-circle-check text-emerald-500"></i>
                Extracted Draft Profile
              </span>
              <span className="font-mono text-[10px] text-slate-400">{profile.fileName}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Full Name</label>
                <input
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Current Job Title</label>
                <input
                  type="text"
                  value={profile.currentTitle}
                  onChange={(e) => setProfile({ ...profile, currentTitle: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Phone Number</label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Work Authorization</label>
                <input
                  type="text"
                  value={profile.workAuth}
                  onChange={(e) => setProfile({ ...profile, workAuth: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Target Hourly Rate</label>
                <input
                  type="text"
                  value={profile.hourlyRate}
                  onChange={(e) => setProfile({ ...profile, hourlyRate: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Extracted Key Competencies</label>
              <input
                type="text"
                value={profile.skillset}
                onChange={(e) => setProfile({ ...profile, skillset: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="text-[11px] text-slate-400">
            Assigned Recruiter: <span className="font-semibold text-slate-600">{profile.recruiter}</span>
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
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
            >
              <i className="fa-solid fa-check text-xs"></i>
              <span>Approve & Add to Roster</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

