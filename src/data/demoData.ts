import { DocumentItem, ChunkItem, EntityItem, RelationshipItem } from '../types/rag';

export const DEMO_DOC_1_TEXT = `# ApexBio Dynamics — Corporate & Technology Profile (2025)

ApexBio Dynamics is an advanced biotechnology and neuro-engineering company headquartered in Boston, Massachusetts. Founded in 2018 by bioengineer Dr. Arthur Pendelton, the company specializes in next-generation neural prosthetics and closed-loop neuromodulation interfaces.

In November 2021, ApexBio recruited Dr. Elena Vance as Chief AI Neuroscientist to lead the Autonomous Neural Systems Division. Dr. Vance, formerly a senior researcher at the MIT Computational Neuroscience Lab, brought pioneering expertise in predictive spike-train decoding and adaptive neural feedback.

ApexBio's hardware flagship is the "NeuroPlex Bridge", a high-density micro-electrode array implant designed for bio-compatible deep brain interface. While the NeuroPlex Bridge provides the physical signal recording and stimulation pathway, it relies on advanced algorithmic models to interpret synaptic firing patterns in real-time.

In June 2024, ApexBio Dynamics established a formal clinical research partnership with St. Jude Neurological Institute to evaluate invasive AI-driven neural modulation protocols in human subjects. Under this agreement, ApexBio provides the hardware implants and AI models, while St. Jude conducts IRB-approved clinical investigations.`;

export const DEMO_DOC_2_TEXT = `# Research Whitepaper: Adaptive Spike-Train Modulation via CerebroSync AI
Author: Dr. Elena Vance (ApexBio Dynamics)
Date: March 14, 2025

Abstract:
Conventional deep brain stimulation (DBS) delivers continuous, non-adaptive electrical frequencies, which often results in habituation and collateral motor side effects. To address this, we developed "CerebroSync AI", an edge-computed deep reinforcement learning framework that interfaces directly with the NeuroPlex Bridge.

Architecture and Mechanism:
CerebroSync AI processes multi-channel local field potentials (LFPs) sampled at 30 kHz from the subthalamic nucleus (STN) and globus pallidus internus (GPi). Rather than delivering fixed pulses, CerebroSync AI predicts pathological oscillatory synchronization 120 milliseconds before tremor onset, triggering localized micro-bursts that suppress dyskinesia without disrupting normal motor intention.

Target Clinical Conditions:
The primary therapeutic target of CerebroSync AI is Refractory Parkinson's Disease (rPD) in patients who no longer respond effectively to levodopa therapy. Secondary computational models are also being trained for early-stage Alzheimer's cognitive tremor. In pre-clinical trials, CerebroSync AI demonstrated a 78% reduction in battery consumption and an 84% reduction in off-target involuntary movements compared to static stimulation.`;

export const DEMO_DOC_3_TEXT = `# Clinical Trial Protocol NCT-09428: Closed-Loop AI DBS Evaluation
Sponsor: ApexBio Dynamics
Principal Investigator: Dr. Marcus Thorne, Chief of Clinical Neurology, St. Jude Neurological Institute
Location: St. Jude Neurological Institute, Chicago, Illinois
Trial ID: NCT-09428
Status: Active — Phase II Multi-Center Trial

Objective:
The primary objective of NCT-09428 is to assess the safety, efficacy, and battery longevity of the CerebroSync AI neuromodulation system embedded within the NeuroPlex Bridge in patients diagnosed with Refractory Parkinson's Disease.

Trial Operations and Governance:
Dr. Marcus Thorne serves as Principal Investigator, supervising surgical implantation and patient telemetry at St. Jude Neurological Institute. All patient neural telemetry is anonymized and processed in partnership with Dr. Elena Vance's team at ApexBio Dynamics for continuous model weight recalibration.

Regulatory Designation:
In October 2025, the U.S. Food and Drug Administration (FDA) granted Breakthrough Device Designation to the CerebroSync AI and NeuroPlex Bridge integrated system for treatment of drug-resistant Parkinsonian tremors. Early Phase II data demonstrates marked improvement in the Unified Parkinson's Disease Rating Scale (UPDRS-III) motor score with zero severe adverse neurological events.`;

export function getDemoDataset(): {
  documents: DocumentItem[];
  chunks: ChunkItem[];
  entities: EntityItem[];
  relationships: RelationshipItem[];
} {
  const documents: DocumentItem[] = [
    {
      id: 'demo-doc-1',
      name: 'ApexBio_Corporate_Overview.md',
      type: 'md',
      size: 1420,
      status: 'indexed',
      createdAt: '2025-06-12T10:00:00Z',
      chunkCount: 2,
      entityCount: 6,
      isDemo: true,
    },
    {
      id: 'demo-doc-2',
      name: 'Vance_CerebroSync_AI_Whitepaper.txt',
      type: 'txt',
      size: 1890,
      status: 'indexed',
      createdAt: '2025-07-01T14:30:00Z',
      chunkCount: 2,
      entityCount: 5,
      isDemo: true,
    },
    {
      id: 'demo-doc-3',
      name: 'StJude_Clinical_Trial_Protocol_NCT09428.md',
      type: 'md',
      size: 1750,
      status: 'indexed',
      createdAt: '2025-10-18T09:15:00Z',
      chunkCount: 2,
      entityCount: 7,
      isDemo: true,
    },
  ];

  const chunks: ChunkItem[] = [
    {
      id: 'demo-c1',
      documentId: 'demo-doc-1',
      documentName: 'ApexBio_Corporate_Overview.md',
      pageOrSection: 'Section 1: Corporate Origins & Leadership',
      chunkIndex: 0,
      text: 'ApexBio Dynamics is an advanced biotechnology and neuro-engineering company headquartered in Boston, Massachusetts. Founded in 2018 by bioengineer Dr. Arthur Pendelton, the company recruited Dr. Elena Vance in November 2021 as Chief AI Neuroscientist to lead the Autonomous Neural Systems Division.',
      entityIds: ['e-apexbio', 'e-vance', 'e-boston', 'e-pendelton'],
      isDemo: true,
    },
    {
      id: 'demo-c2',
      documentId: 'demo-doc-1',
      documentName: 'ApexBio_Corporate_Overview.md',
      pageOrSection: 'Section 2: NeuroPlex Bridge & Clinical Partnerships',
      chunkIndex: 1,
      text: "ApexBio's hardware flagship is the NeuroPlex Bridge, a high-density micro-electrode array implant designed for bio-compatible deep brain interface. In June 2024, ApexBio Dynamics established a formal clinical research partnership with St. Jude Neurological Institute to evaluate invasive AI-driven neural modulation protocols in human subjects.",
      entityIds: ['e-apexbio', 'e-neuroplex', 'e-stjude'],
      isDemo: true,
    },
    {
      id: 'demo-c3',
      documentId: 'demo-doc-2',
      documentName: 'Vance_CerebroSync_AI_Whitepaper.txt',
      pageOrSection: 'Section 1: CerebroSync AI Architecture',
      chunkIndex: 0,
      text: 'Dr. Elena Vance developed CerebroSync AI, an edge-computed deep reinforcement learning framework that interfaces directly with the NeuroPlex Bridge. CerebroSync AI processes multi-channel local field potentials from the subthalamic nucleus and predicts pathological oscillatory tremor synchronization 120ms before onset.',
      entityIds: ['e-vance', 'e-cerebrosync', 'e-neuroplex'],
      isDemo: true,
    },
    {
      id: 'demo-c4',
      documentId: 'demo-doc-2',
      documentName: 'Vance_CerebroSync_AI_Whitepaper.txt',
      pageOrSection: 'Section 2: Therapeutic Targets',
      chunkIndex: 1,
      text: "The primary therapeutic target of CerebroSync AI is Refractory Parkinson's Disease in patients who no longer respond effectively to levodopa therapy. In pre-clinical trials, CerebroSync AI demonstrated an 84% reduction in off-target involuntary movements.",
      entityIds: ['e-cerebrosync', 'e-parkinsons'],
      isDemo: true,
    },
    {
      id: 'demo-c5',
      documentId: 'demo-doc-3',
      documentName: 'StJude_Clinical_Trial_Protocol_NCT09428.md',
      pageOrSection: 'Section 1: Protocol & Leadership',
      chunkIndex: 0,
      text: 'Clinical Trial NCT-09428 is sponsored by ApexBio Dynamics and conducted at St. Jude Neurological Institute in Chicago. Dr. Marcus Thorne, Chief of Clinical Neurology at St. Jude, serves as Principal Investigator, supervising surgical implantation and patient telemetry.',
      entityIds: ['e-nct09428', 'e-apexbio', 'e-stjude', 'e-thorne'],
      isDemo: true,
    },
    {
      id: 'demo-c6',
      documentId: 'demo-doc-3',
      documentName: 'StJude_Clinical_Trial_Protocol_NCT09428.md',
      pageOrSection: 'Section 2: Clinical Scope & FDA Designation',
      chunkIndex: 1,
      text: "Trial NCT-09428 evaluates the CerebroSync AI neuromodulation system embedded within the NeuroPlex Bridge for treating Refractory Parkinson's Disease. In October 2025, the U.S. FDA granted Breakthrough Device Designation to the integrated CerebroSync AI and NeuroPlex system.",
      entityIds: ['e-nct09428', 'e-cerebrosync', 'e-neuroplex', 'e-parkinsons', 'e-fda'],
      isDemo: true,
    },
  ];

  const entities: EntityItem[] = [
    {
      id: 'e-apexbio',
      name: 'ApexBio Dynamics',
      type: 'Organization',
      description: 'Biotechnology and neuro-engineering company headquartered in Boston, MA.',
      mentionCount: 4,
      chunkIds: ['demo-c1', 'demo-c2', 'demo-c5'],
      isDemo: true,
    },
    {
      id: 'e-vance',
      name: 'Dr. Elena Vance',
      type: 'Person',
      description: 'Chief AI Neuroscientist at ApexBio Dynamics and creator of CerebroSync AI.',
      mentionCount: 3,
      chunkIds: ['demo-c1', 'demo-c3'],
      isDemo: true,
    },
    {
      id: 'e-boston',
      name: 'Boston, Massachusetts',
      type: 'Location',
      description: 'Headquarters city of ApexBio Dynamics.',
      mentionCount: 1,
      chunkIds: ['demo-c1'],
      isDemo: true,
    },
    {
      id: 'e-pendelton',
      name: 'Dr. Arthur Pendelton',
      type: 'Person',
      description: 'Bioengineer and founder of ApexBio Dynamics (2018).',
      mentionCount: 1,
      chunkIds: ['demo-c1'],
      isDemo: true,
    },
    {
      id: 'e-neuroplex',
      name: 'NeuroPlex Bridge',
      type: 'Technology',
      description: 'High-density micro-electrode array hardware implant for deep brain interface.',
      mentionCount: 4,
      chunkIds: ['demo-c2', 'demo-c3', 'demo-c6'],
      isDemo: true,
    },
    {
      id: 'e-stjude',
      name: 'St. Jude Neurological Institute',
      type: 'Organization',
      description: 'Clinical hospital and research institute in Chicago partnering with ApexBio.',
      mentionCount: 3,
      chunkIds: ['demo-c2', 'demo-c5'],
      isDemo: true,
    },
    {
      id: 'e-cerebrosync',
      name: 'CerebroSync AI',
      type: 'Product',
      description: 'Closed-loop deep reinforcement learning algorithm for adaptive tremor modulation.',
      mentionCount: 4,
      chunkIds: ['demo-c3', 'demo-c4', 'demo-c6'],
      isDemo: true,
    },
    {
      id: 'e-parkinsons',
      name: "Refractory Parkinson's Disease",
      type: 'Condition',
      description: 'Drug-resistant neurodegenerative condition targeted by CerebroSync AI.',
      mentionCount: 2,
      chunkIds: ['demo-c4', 'demo-c6'],
      isDemo: true,
    },
    {
      id: 'e-thorne',
      name: 'Dr. Marcus Thorne',
      type: 'Person',
      description: 'Chief of Clinical Neurology at St. Jude Neurological Institute and PI of NCT-09428.',
      mentionCount: 2,
      chunkIds: ['demo-c5'],
      isDemo: true,
    },
    {
      id: 'e-nct09428',
      name: 'Trial NCT-09428',
      type: 'ClinicalTrial',
      description: 'Phase II clinical trial evaluating CerebroSync AI on the NeuroPlex Bridge.',
      mentionCount: 3,
      chunkIds: ['demo-c5', 'demo-c6'],
      isDemo: true,
    },
    {
      id: 'e-fda',
      name: 'U.S. FDA',
      type: 'Organization',
      description: 'Regulatory agency granting Breakthrough Device Designation to CerebroSync AI.',
      mentionCount: 1,
      chunkIds: ['demo-c6'],
      isDemo: true,
    },
  ];

  const relationships: RelationshipItem[] = [
    {
      id: 'rel-1',
      sourceEntityId: 'e-apexbio',
      targetEntityId: 'e-boston',
      sourceEntityName: 'ApexBio Dynamics',
      targetEntityName: 'Boston, Massachusetts',
      type: 'LOCATED_IN',
      description: 'ApexBio Dynamics is headquartered in Boston, Massachusetts.',
      sourceChunkId: 'demo-c1',
      documentId: 'demo-doc-1',
      documentName: 'ApexBio_Corporate_Overview.md',
      snippet: 'ApexBio Dynamics is an advanced biotechnology and neuro-engineering company headquartered in Boston, Massachusetts.',
      isDemo: true,
    },
    {
      id: 'rel-2',
      sourceEntityId: 'e-pendelton',
      targetEntityId: 'e-apexbio',
      sourceEntityName: 'Dr. Arthur Pendelton',
      targetEntityName: 'ApexBio Dynamics',
      type: 'FOUNDED',
      description: 'Dr. Arthur Pendelton founded ApexBio Dynamics in 2018.',
      sourceChunkId: 'demo-c1',
      documentId: 'demo-doc-1',
      documentName: 'ApexBio_Corporate_Overview.md',
      snippet: 'Founded in 2018 by bioengineer Dr. Arthur Pendelton...',
      isDemo: true,
    },
    {
      id: 'rel-3',
      sourceEntityId: 'e-vance',
      targetEntityId: 'e-apexbio',
      sourceEntityName: 'Dr. Elena Vance',
      targetEntityName: 'ApexBio Dynamics',
      type: 'EMPLOYED_BY',
      description: 'Dr. Elena Vance serves as Chief AI Neuroscientist leading Autonomous Neural Systems.',
      sourceChunkId: 'demo-c1',
      documentId: 'demo-doc-1',
      documentName: 'ApexBio_Corporate_Overview.md',
      snippet: '...recruited Dr. Elena Vance in November 2021 as Chief AI Neuroscientist to lead the Autonomous Neural Systems Division.',
      isDemo: true,
    },
    {
      id: 'rel-4',
      sourceEntityId: 'e-apexbio',
      targetEntityId: 'e-neuroplex',
      sourceEntityName: 'ApexBio Dynamics',
      targetEntityName: 'NeuroPlex Bridge',
      type: 'MANUFACTURES',
      description: 'NeuroPlex Bridge is the proprietary hardware flagship developed by ApexBio.',
      sourceChunkId: 'demo-c2',
      documentId: 'demo-doc-1',
      documentName: 'ApexBio_Corporate_Overview.md',
      snippet: "ApexBio's hardware flagship is the NeuroPlex Bridge, a high-density micro-electrode array implant...",
      isDemo: true,
    },
    {
      id: 'rel-5',
      sourceEntityId: 'e-apexbio',
      targetEntityId: 'e-stjude',
      sourceEntityName: 'ApexBio Dynamics',
      targetEntityName: 'St. Jude Neurological Institute',
      type: 'PARTNERED_WITH',
      description: 'ApexBio established a formal clinical research partnership with St. Jude.',
      sourceChunkId: 'demo-c2',
      documentId: 'demo-doc-1',
      documentName: 'ApexBio_Corporate_Overview.md',
      snippet: 'ApexBio Dynamics established a formal clinical research partnership with St. Jude Neurological Institute...',
      isDemo: true,
    },
    {
      id: 'rel-6',
      sourceEntityId: 'e-vance',
      targetEntityId: 'e-cerebrosync',
      sourceEntityName: 'Dr. Elena Vance',
      targetEntityName: 'CerebroSync AI',
      type: 'DEVELOPED',
      description: 'Dr. Elena Vance developed CerebroSync AI reinforcement learning model.',
      sourceChunkId: 'demo-c3',
      documentId: 'demo-doc-2',
      documentName: 'Vance_CerebroSync_AI_Whitepaper.txt',
      snippet: 'Dr. Elena Vance developed CerebroSync AI, an edge-computed deep reinforcement learning framework...',
      isDemo: true,
    },
    {
      id: 'rel-7',
      sourceEntityId: 'e-cerebrosync',
      targetEntityId: 'e-neuroplex',
      sourceEntityName: 'CerebroSync AI',
      targetEntityName: 'NeuroPlex Bridge',
      type: 'DEPLOYED_ON',
      description: 'CerebroSync AI runs on and interfaces directly with the NeuroPlex Bridge implant.',
      sourceChunkId: 'demo-c3',
      documentId: 'demo-doc-2',
      documentName: 'Vance_CerebroSync_AI_Whitepaper.txt',
      snippet: '...interfaces directly with the NeuroPlex Bridge.',
      isDemo: true,
    },
    {
      id: 'rel-8',
      sourceEntityId: 'e-cerebrosync',
      targetEntityId: 'e-parkinsons',
      sourceEntityName: 'CerebroSync AI',
      targetEntityName: "Refractory Parkinson's Disease",
      type: 'TREATS',
      description: "CerebroSync AI targets suppression of tremors in Refractory Parkinson's.",
      sourceChunkId: 'demo-c4',
      documentId: 'demo-doc-2',
      documentName: 'Vance_CerebroSync_AI_Whitepaper.txt',
      snippet: "The primary therapeutic target of CerebroSync AI is Refractory Parkinson's Disease in patients who no longer respond effectively to levodopa therapy.",
      isDemo: true,
    },
    {
      id: 'rel-9',
      sourceEntityId: 'e-thorne',
      targetEntityId: 'e-stjude',
      sourceEntityName: 'Dr. Marcus Thorne',
      targetEntityName: 'St. Jude Neurological Institute',
      type: 'AFFILIATED_WITH',
      description: 'Dr. Marcus Thorne is Chief of Clinical Neurology at St. Jude.',
      sourceChunkId: 'demo-c5',
      documentId: 'demo-doc-3',
      documentName: 'StJude_Clinical_Trial_Protocol_NCT09428.md',
      snippet: 'Dr. Marcus Thorne, Chief of Clinical Neurology at St. Jude, serves as Principal Investigator...',
      isDemo: true,
    },
    {
      id: 'rel-10',
      sourceEntityId: 'e-thorne',
      targetEntityId: 'e-nct09428',
      sourceEntityName: 'Dr. Marcus Thorne',
      targetEntityName: 'Trial NCT-09428',
      type: 'DIRECTS',
      description: 'Dr. Marcus Thorne serves as Principal Investigator for Trial NCT-09428.',
      sourceChunkId: 'demo-c5',
      documentId: 'demo-doc-3',
      documentName: 'StJude_Clinical_Trial_Protocol_NCT09428.md',
      snippet: 'Dr. Marcus Thorne... serves as Principal Investigator, supervising surgical implantation and patient telemetry.',
      isDemo: true,
    },
    {
      id: 'rel-11',
      sourceEntityId: 'e-nct09428',
      targetEntityId: 'e-cerebrosync',
      sourceEntityName: 'Trial NCT-09428',
      targetEntityName: 'CerebroSync AI',
      type: 'EVALUATES',
      description: 'Trial NCT-09428 evaluates the clinical efficacy of CerebroSync AI in human subjects.',
      sourceChunkId: 'demo-c6',
      documentId: 'demo-doc-3',
      documentName: 'StJude_Clinical_Trial_Protocol_NCT09428.md',
      snippet: 'Trial NCT-09428 evaluates the CerebroSync AI neuromodulation system embedded within the NeuroPlex Bridge...',
      isDemo: true,
    },
    {
      id: 'rel-12',
      sourceEntityId: 'e-fda',
      targetEntityId: 'e-cerebrosync',
      sourceEntityName: 'U.S. FDA',
      targetEntityName: 'CerebroSync AI',
      type: 'GRANTED_DESIGNATION',
      description: 'FDA granted Breakthrough Device Designation to the integrated CerebroSync AI system.',
      sourceChunkId: 'demo-c6',
      documentId: 'demo-doc-3',
      documentName: 'StJude_Clinical_Trial_Protocol_NCT09428.md',
      snippet: 'In October 2025, the U.S. FDA granted Breakthrough Device Designation to the integrated CerebroSync AI and NeuroPlex system.',
      isDemo: true,
    },
  ];

  return { documents, chunks, entities, relationships };
}

export const SAMPLE_MULTI_HOP_QUESTIONS = [
  {
    title: 'Multi-Hop: Dr. Vance to Dr. Thorne & St. Jude',
    question: 'How is Dr. Elena Vance connected to Dr. Marcus Thorne and St. Jude Neurological Institute?',
    expectedHops: 'Dr. Elena Vance -> DEVELOPED CerebroSync AI -> EVALUATED_IN Trial NCT-09428 -> DIRECTED_BY Dr. Marcus Thorne -> AFFILIATED_WITH St. Jude Neurological Institute',
  },
  {
    title: 'Clinical & Regulatory Path',
    question: "What medical condition does CerebroSync AI treat, and what regulatory designation did it receive?",
    expectedHops: "CerebroSync AI -> TREATS Refractory Parkinson's Disease and received BREAKTHROUGH_DEVICE designation from U.S. FDA",
  },
  {
    title: 'Hardware & Organization Dependency',
    question: 'Which hardware platform does CerebroSync AI require, and which organization manufactures it?',
    expectedHops: 'CerebroSync AI -> DEPLOYED_ON NeuroPlex Bridge -> MANUFACTURED_BY ApexBio Dynamics',
  },
  {
    title: 'Cross-Document Partnership',
    question: 'What is the institutional agreement between ApexBio Dynamics and St. Jude Neurological Institute?',
    expectedHops: 'ApexBio Dynamics -> PARTNERED_WITH St. Jude Neurological Institute for clinical trial evaluation of AI neural implants',
  },
  {
    title: 'Negative / Insufficient Evidence Test',
    question: 'What is the dosage of Levodopa prescribed to patients in Clinical Trial NCT-09428?',
    expectedHops: 'Negative test: The documents state patients no longer respond effectively to levodopa, but specific dosage amounts are NOT in the documents.',
  },
];
