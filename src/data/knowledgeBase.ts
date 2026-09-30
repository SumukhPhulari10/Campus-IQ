import { CollegeDocument, DocumentChunk, Notice, ConflictItem, QueryLogItem, DeadlineItem, StudentProfile } from '../types';

export const INITIAL_STUDENT: StudentProfile = {
  id: 'std_sumukh_742',
  name: 'Sumukh',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  program: 'Bachelor of Technology (B.Tech)',
  department: 'Computer Science & Engineering',
  year: '4th Year',
  semester: 'Semester 7',
  rollNumber: '21CS089',
  attendancePercent: 82,
  cgpa: 8.4,
  maxCgpa: 10,
  cgpaTrend: '+0.2 this semester',
  nextClass: {
    code: 'DT',
    name: 'Design Thinking',
    time: '9:00 AM - 10:00 AM',
    room: 'G-02',
    instructor: 'Ms. R. S. Dumne',
    syllabusUrl: '#',
  },
};

export const INITIAL_NOTICES: Notice[] = [
  {
    id: 'not_aithon2',
    title: '📢 AITHON 2.0 – National Level Hackathon',
    category: 'Events',
    urgency: 'urgent',
    publishDate: 'Just Now',
    department: 'General Academic',
    actionRequiredDate: 'Oct 04, 2026',
    aiSummary: 'All UG students are encouraged to participate in AITHON 2.0. Prize Pool: ₹1,00,000/-. Registration Deadline: 4 October 2026.',
    fullContent: `📢 AITHON 2.0 – National Level Hackathon

All UG students are encouraged to participate in AITHON 2.0, organized by Amrutvahini College of Engineering, Sangamner.

🏆 Prize Pool: ₹1,00,000/-
👥 Team Size: 4–6 students
🎓 Eligibility: All UG students
💰 Registration Fee: ₹50/- per team
📅 Registration Deadline: 4 October 2026
🌐 Registration: aithon2-0.xyz

💡 23 Innovation Tracks:
• AI in Healthcare & Medicine
• Dental Science & Diagnostics
• Pharmacy & Drug Discovery
• LegalTech & AI Ethics
• FinTech
• EdTech
• Film, Animation & Storytelling
• UI/UX & Accessibility
• Robotics & Industrial Automation
• Energy & CleanTech
• Aerospace & SpaceTech
• AgriTech
• Environment & Sustainability
• E-Commerce & Retail
• Supply Chain & Logistics
• Cybersecurity & Forensics
• Smart Cities & Mobility
• Disaster Management & Public Safety
• Mental Health & Psychology AI
• Sports Analytics
• Hospitality & Tourism
• Social Good & Civic Innovation
• Open Innovation

💻 Solutions are welcome in both Software (AI-powered apps, platforms, digital solutions) and Hardware (AI-enabled devices, prototypes, smart systems).

🌟 UG students are encouraged to form teams and participate actively in this national-level innovation opportunity.

📞 Student Coordinators:
• Sudhanshu Rahane – +91 77200 92989
• Shree Ugale – +91 78418 95180
• Umesh Khairnar – +91 99752 60955`,
    sourceDocId: 'doc_aithon2',
    tags: ['Hackathon', 'AITHON', 'Innovation', 'Events', 'National'],
  },
];

export const INITIAL_DOCUMENTS: CollegeDocument[] = [
  {
    id: 'doc_aithon2',
    title: 'AITHON 2.0 – National Level Hackathon',
    department: 'General Academic',
    category: 'Events',
    academicYear: '2026-2027',
    publishedDate: 'Sep 29, 2026',
    fileType: 'pdf',
    fileSize: '1.2 MB',
    status: 'indexed',
    totalChunks: 2,
    summary: 'Details and registration information for AITHON 2.0, a National Level Hackathon with a prize pool of ₹1,00,000/-.',
    contentRaw: 'AITHON 2.0 – National Level Hackathon. All UG students are encouraged to participate. Prize Pool: ₹1,00,000/-. Team Size: 4–6 students. Eligibility: All UG students. Registration Fee: ₹50/- per team. Registration Deadline: 4 October 2026.',
    uploadedBy: 'Admin',
  },
];

export const INITIAL_CHUNKS: DocumentChunk[] = [
  {
    id: 'chk_hb_01',
    documentId: 'doc_handbook_2024',
    documentTitle: '2024 Student Handbook',
    department: 'Dean of Students',
    category: 'Handbook',
    pageNumber: 42,
    sectionHeader: '4.1 Attendance Minimums & Condonation',
    content: 'Every registered student is mandated to maintain a minimum attendance of 75% in each enrolled theory and practical course to be eligible for End-Semester Examinations. A condonation of up to 10% (allowing 65% minimum) may be granted by the Academic Dean strictly upon medical certificates.',
  },
  {
    id: 'chk_hb_02',
    documentId: 'doc_handbook_2024',
    documentTitle: '2024 Student Handbook',
    department: 'Dean of Students',
    category: 'Handbook',
    pageNumber: 43,
    sectionHeader: '7.2 Re-Evaluation & Grade Changes',
    content: 'Students dissatisfied with their evaluated semester exam answer sheets may apply for paper re-evaluation within 14 days of result declaration with a nominal processing fee of $20 per course.',
  },
  {
    id: 'chk_hb_03',
    documentId: 'doc_handbook_2024',
    documentTitle: '2024 Student Handbook',
    department: 'Campus Security & Transport',
    category: 'Handbook',
    pageNumber: 88,
    sectionHeader: '11.4 Parking Ticket Appeals & Citations',
    content: 'Students issued parking citations for unauthorized parking in faculty zones or Lot C during restricted periods have the right to file an online grievance with the Campus Transport Cell within 5 working days.',
  },
  {
    id: 'chk_cs701_01',
    documentId: 'doc_syl_cs701',
    documentTitle: 'CS701 Syllabus & Prerequisites',
    department: 'Computer Science & Engineering',
    category: 'Syllabus',
    pageNumber: 1,
    sectionHeader: 'Prerequisites & Credits Structure',
    content: 'CS701 Artificial Intelligence: 4 Credits. Prerequisite: CS301 (Data Structures) & CS204 (Probability and Statistics). Minimum passing grade in prerequisites is Grade C.',
  },
  {
    id: 'chk_cs301_01',
    documentId: 'doc_cs301_catalog',
    documentTitle: 'CS301 Course Catalog',
    department: 'Computer Science & Engineering',
    category: 'Syllabus',
    pageNumber: 2,
    sectionHeader: 'Prerequisites for CS-301 Advanced Data Structures',
    content: 'Prerequisites for CS-301 Advanced Data Structures are CS-101 (Introduction to Computer Science / Programming) and MAT-201 (Discrete Mathematical Structures). Minimum grade required is C (5.0 scale).',
  },
  {
    id: 'chk_not_midsem_01',
    documentId: 'doc_rev_exam_fall24',
    documentTitle: 'Revised Mid-Semester Exam Circular',
    department: 'Examination Cell',
    category: 'Circular',
    pageNumber: 1,
    sectionHeader: 'Rescheduled Mid-Semester Exam Dates',
    content: 'All mid-semester theory and laboratory examinations originally scheduled for Nov 05 - Nov 11 have been rescheduled. The revised examination window will now commence on Monday, November 12, 2024, and conclude on Saturday, November 18, 2024.',
  },
  {
    id: 'chk_fin_01',
    documentId: 'doc_financial_aid_protocol',
    documentTitle: 'Financial Aid & Emergency Bursar Protocol',
    department: 'Bursar Office',
    category: 'Financial Aid',
    pageNumber: 4,
    sectionHeader: 'Delayed Disbursements & Emergency Grants',
    content: 'In instances where external funding is delayed past rent/tuition deadlines, students should submit an Emergency Hardship Form. Urgent cases receive ticket creation for rapid advisor intervention and emergency bridge support.',
  }
];

export const INITIAL_CONFLICTS: ConflictItem[] = [
  {
    id: 'conf_01',
    topic: 'CS-101 Final Exam Date & Venue Conflict',
    courseOrDept: 'CS-101 Introduction to CS / Examination Cell',
    detectedAt: 'Oct 28, 2024',
    status: 'pending',
    docA: {
      title: 'Original Circular (Oct 12)',
      version: 'V1.2',
      date: 'Oct 12, 2024',
      text: 'The final examination for Introduction to Computer Science (CS-101) will be held on November 15th, 2024 at 09:00 AM in the Main Auditorium.',
      highlight: 'November 15th, 2024 at 09:00 AM in the Main Auditorium',
    },
    docB: {
      title: 'Revised Circular (Oct 28)',
      version: 'V2.0',
      date: 'Oct 28, 2024',
      text: 'The final examination for Introduction to Computer Science (CS-101) will be held on November 18th, 2024 at 14:00 PM in the Science Block, Room 402.',
      highlight: 'November 18th, 2024 at 14:00 PM in the Science Block, Room 402',
    },
    resolutionNotes: 'V2.0 supersedes V1.2 following the auditorium renovation notice. RAG pipeline configured to present V2.0 as ground truth with superseding citation note.'
  },
  {
    id: 'conf_02',
    topic: 'Project Synopsis Submission Deadline',
    courseOrDept: 'Major Project Phase 1 / CSE Dept',
    detectedAt: 'Aug 14, 2024',
    status: 'resolved',
    docA: {
      title: 'Academic Calendar 2024',
      version: 'V1.0',
      date: 'Jul 15, 2024',
      text: 'Project synopsis submission deadline is September 01, 2024.',
      highlight: 'September 01, 2024',
    },
    docB: {
      title: 'HOD Circular on Project Submissions',
      version: 'V1.1',
      date: 'Aug 10, 2024',
      text: 'Final date for 4th-year project synopsis submission has been extended to September 05, 2024 on the portal.',
      highlight: 'September 05, 2024',
    },
    resolutionNotes: 'Resolved: HOD extension to Sep 05 is officially accepted.'
  }
];

export const INITIAL_QUERY_LOGS: QueryLogItem[] = [
  {
    id: 'log_01',
    timestamp: '10:42:05 AM',
    query: 'What are the prerequisite courses for CS-301 Advanced Data Structures?',
    status: 'grounded',
    confidence: 98,
    sourceDoc: 'Course_Catalog_2024.pdf',
    studentName: 'Sumukh (21CS089)',
  },
  {
    id: 'log_02',
    timestamp: '10:41:12 AM',
    query: 'Can I appeal a parking ticket if I was parked in lot C during graduation?',
    status: 'review_needed',
    confidence: 62,
    sourceDoc: 'Student_Handbook_Sec11.pdf',
    studentName: 'Priya M. (22EC044)',
  },
  {
    id: 'log_03',
    timestamp: '10:38:55 AM',
    query: 'Where is the secondary campus health center located and what are the OPD hours?',
    status: 'grounded',
    confidence: 95,
    sourceDoc: 'Campus_Facilities_Guide.pdf',
    studentName: 'Rahul K. (23ME102)',
  },
  {
    id: 'log_04',
    timestamp: '10:35:20 AM',
    query: "I haven't received my financial aid disbursement and I have rent due tomorrow. Help.",
    status: 'escalated',
    confidence: 45,
    ticketId: 'Ticket #8942 Created',
    studentName: 'Alex Rivers (Grad)',
  },
  {
    id: 'log_05',
    timestamp: '10:20:18 AM',
    query: 'What is the minimum attendance required to appear for semester end exams?',
    status: 'grounded',
    confidence: 99,
    sourceDoc: '2024_Student_Handbook_Pg42.pdf',
    studentName: 'Sumukh (21CS089)',
  }
];

export const INITIAL_DEADLINES: DeadlineItem[] = [
  {
    id: 'dl_aithon',
    title: 'AITHON 2.0 Registration',
    dateStr: 'Oct 04',
    daysRemaining: 5,
    urgency: 'high',
    category: 'Events',
    description: 'Deadline to register for National Level Hackathon AITHON 2.0 (Prize: ₹1,00,000/-).',
  },
];
