/**
 * UNIDEL HRMS — Database Seeder
 * Run: node server/utils/seeder.js
 * Clear: node server/utils/seeder.js --clear
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const User      = require('../models/User');
const Staff     = require('../models/Staff');
const Attendance = require('../models/Attendance');
const Leave     = require('../models/Leave');
const Promotion = require('../models/Promotion');
const Payroll   = require('../models/Payroll');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/unidel_hrms';

// ─── Sample Data ──────────────────────────────────────────────────────────────

const users = [
  { name: 'Super Admin',      email: 'admin@unidel.edu.ng',    password: 'password123', role: 'superadmin' },
  { name: 'Registry Officer', email: 'registry@unidel.edu.ng', password: 'password123', role: 'registrar' },
  { name: 'Bursary Officer',  email: 'bursary@unidel.edu.ng',  password: 'password123', role: 'bursary' },
  { name: 'HOD Computer Sci', email: 'hod.cs@unidel.edu.ng',   password: 'password123', role: 'hod', department: 'Computer Science' },
];

const staffRecords = [
  { firstName:'Amara',    lastName:'Ekechi',   email:'a.ekechi@unidel.edu.ng',   department:'Computer Science', category:'Academic',       gradeLevel:'GL 14', rank:'Senior Lecturer',  publications:12, dateOfEmployment:'2010-03-15', highestQualification:'Ph.D' },
  { firstName:'Ngozi',    lastName:'Okolo',    email:'n.okolo@unidel.edu.ng',    department:'Registry',         category:'Administrative', gradeLevel:'GL 10', rank:'Senior Officer',   publications:0,  dateOfEmployment:'2012-07-01', highestQualification:'M.Sc/M.A' },
  { firstName:'Usman',    lastName:'Bello',    email:'u.bello@unidel.edu.ng',    department:'Engineering',      category:'Academic',       gradeLevel:'GL 09', rank:'Lecturer II',      publications:3,  dateOfEmployment:'2017-09-01', highestQualification:'M.Sc/M.A' },
  { firstName:'Adaeze',   lastName:'Nwosu',    email:'a.nwosu@unidel.edu.ng',    department:'Medicine',         category:'Academic',       gradeLevel:'GL 13', rank:'Lecturer I',       publications:8,  dateOfEmployment:'2013-02-20', highestQualification:'Ph.D' },
  { firstName:'Tunde',    lastName:'Fabunmi',  email:'t.fabunmi@unidel.edu.ng',  department:'Library',          category:'Technical',      gradeLevel:'GL 07', rank:'Technologist I',   publications:0,  dateOfEmployment:'2019-04-10', highestQualification:'HND' },
  { firstName:'Ijeoma',   lastName:'Obi',      email:'i.obi@unidel.edu.ng',      department:'Bursary',          category:'Administrative', gradeLevel:'GL 12', rank:'Principal Officer',publications:0,  dateOfEmployment:'2014-06-01', highestQualification:'M.Sc/M.A' },
  { firstName:'Akin',     lastName:'Adeyemi',  email:'a.adeyemi@unidel.edu.ng',  department:'Computer Science', category:'Academic',       gradeLevel:'GL 15', rank:'Professor',        publications:28, dateOfEmployment:'2005-01-15', highestQualification:'Ph.D' },
  { firstName:'Emeka',    lastName:'Eze',      email:'e.eze@unidel.edu.ng',      department:'Engineering',      category:'Technical',      gradeLevel:'GL 08', rank:'Technologist II',  publications:0,  dateOfEmployment:'2018-08-20', highestQualification:'HND' },
  { firstName:'Fatima',   lastName:'Musa',     email:'f.musa@unidel.edu.ng',     department:'Medicine',         category:'Academic',       gradeLevel:'GL 13', rank:'Lecturer I',       publications:6,  dateOfEmployment:'2014-11-01', highestQualification:'Ph.D' },
  { firstName:'Grace',    lastName:'Okonkwo',  email:'g.okonkwo@unidel.edu.ng',  department:'Registry',         category:'Administrative', gradeLevel:'GL 11', rank:'Officer I',        publications:0,  dateOfEmployment:'2016-03-01', highestQualification:'B.Sc/B.A' },
  { firstName:'Chidi',    lastName:'Obi',      email:'c.obi@unidel.edu.ng',      department:'Law',              category:'Academic',       gradeLevel:'GL 13', rank:'Senior Lecturer',  publications:9,  dateOfEmployment:'2011-09-01', highestQualification:'Ph.D' },
  { firstName:'Blessing', lastName:'Udo',      email:'b.udo@unidel.edu.ng',      department:'Education',        category:'Academic',       gradeLevel:'GL 09', rank:'Lecturer II',      publications:2,  dateOfEmployment:'2020-02-15', highestQualification:'M.Sc/M.A' },
  { firstName:'Kola',     lastName:'Adeleke',  email:'k.adeleke@unidel.edu.ng',  department:'ICT',              category:'Technical',      gradeLevel:'GL 09', rank:'Technologist I',   publications:0,  dateOfEmployment:'2018-05-01', highestQualification:'B.Sc/B.A' },
  { firstName:'Chioma',   lastName:'Nwachukwu',email:'c.nwachukwu@unidel.edu.ng',department:'Sciences',         category:'Academic',       gradeLevel:'GL 10', rank:'Lecturer I',       publications:4,  dateOfEmployment:'2016-10-01', highestQualification:'Ph.D' },
  { firstName:'Hassan',   lastName:'Ibrahim',  email:'h.ibrahim@unidel.edu.ng',  department:'Agriculture',      category:'Academic',       gradeLevel:'GL 12', rank:'Senior Lecturer',  publications:7,  dateOfEmployment:'2013-07-15', highestQualification:'Ph.D' },
];

// ─── Seeder Function ──────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✔ Connected to MongoDB:', MONGO_URI);

  if (process.argv.includes('--clear')) {
    await Promise.all([
      User.deleteMany({}), Staff.deleteMany({}), Attendance.deleteMany({}),
      Leave.deleteMany({}), Promotion.deleteMany({}), Payroll.deleteMany({}),
    ]);
    console.log('✔ All collections cleared.');
    await mongoose.disconnect();
    return;
  }

  // Users
  await User.deleteMany({});
  for (const u of users) {
    const salt = await bcrypt.genSalt(10);
    u.password = await bcrypt.hash(u.password, salt);
  }
  const createdUsers = await User.insertMany(users);
  console.log(`✔ ${createdUsers.length} users seeded.`);

  // Staff
  await Staff.deleteMany({});
  const createdStaff = [];
  for (const s of staffRecords) {
    const doc = await Staff.create(s);
    createdStaff.push(doc);
  }
  console.log(`✔ ${createdStaff.length} staff records seeded.`);

  // Attendance — last 30 working days
  await Attendance.deleteMany({});
  const attRecords = [];
  const today = new Date();
  for (let day = 0; day < 30; day++) {
    const d = new Date(today);
    d.setDate(d.getDate() - day);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    d.setHours(0, 0, 0, 0);

    for (const staff of createdStaff) {
      const rand = Math.random();
      const status = rand > 0.88 ? 'Absent' : rand > 0.83 ? 'Half-Day' : 'Present';
      attRecords.push({ staff: staff._id, date: d, status });
    }
  }
  await Attendance.insertMany(attRecords, { ordered: false });
  console.log(`✔ ${attRecords.length} attendance records seeded.`);

  // Leave requests
  await Leave.deleteMany({});
  const leaveRecords = [
    { staff: createdStaff[1]._id, leaveType: 'Annual',    startDate: new Date('2026-05-10'), endDate: new Date('2026-05-17'), daysRequested: 7,  reason: 'Family vacation', status: 'Pending',  aiEligible: true,  aiScore: 88, aiReasons: ['Leave balance sufficient', 'No overlapping leave'] },
    { staff: createdStaff[2]._id, leaveType: 'Sick',      startDate: new Date('2026-05-06'), endDate: new Date('2026-05-08'), daysRequested: 3,  reason: 'Medical treatment', status: 'Pending', aiEligible: true,  aiScore: 92, aiReasons: ['Sick leave balance available'] },
    { staff: createdStaff[4]._id, leaveType: 'Study',     startDate: new Date('2026-06-01'), endDate: new Date('2026-06-21'), daysRequested: 21, reason: 'PhD coursework completion', status: 'Pending', aiEligible: false, aiScore: 45, aiReasons: ['Study leave balance insufficient (14 days remaining, 21 requested)'] },
    { staff: createdStaff[3]._id, leaveType: 'Annual',    startDate: new Date('2026-04-01'), endDate: new Date('2026-04-15'), daysRequested: 14, reason: 'Annual leave', status: 'Approved', aiEligible: true, aiScore: 90, aiReasons: ['All criteria met'] },
    { staff: createdStaff[6]._id, leaveType: 'Annual',    startDate: new Date('2026-03-10'), endDate: new Date('2026-03-15'), daysRequested: 5,  reason: 'Rest', status: 'Approved', aiEligible: true, aiScore: 95, aiReasons: ['All criteria met'] },
  ];
  await Leave.insertMany(leaveRecords);
  console.log(`✔ ${leaveRecords.length} leave records seeded.`);

  // Promotions
  await Promotion.deleteMany({});
  const promoRecords = [
    { staff: createdStaff[0]._id, fromGradeLevel:'GL 14', toGradeLevel:'GL 15', fromRank:'Senior Lecturer', toRank:'Reader',     publications:12, teachingEvalScore:88, committeeRoles:3, aiScore:91, aiDecision:'Approved',     status:'AI-Approved',  aiBreakdown:{yearsOfService:95,publications:90,teachingEvaluation:88,attendanceRecord:92,pscCompliance:100,committeeWork:80}, aiReasons:['All primary criteria satisfied'] },
    { staff: createdStaff[2]._id, fromGradeLevel:'GL 09', toGradeLevel:'GL 10', fromRank:'Lecturer II',    toRank:'Lecturer I',  publications:3,  teachingEvalScore:72, committeeRoles:1, aiScore:67, aiDecision:'Review',        status:'Under-Review', aiBreakdown:{yearsOfService:70,publications:60,teachingEvaluation:72,attendanceRecord:85,pscCompliance:100,committeeWork:60}, aiReasons:['Publications below minimum requirement'] },
    { staff: createdStaff[3]._id, fromGradeLevel:'GL 13', toGradeLevel:'GL 14', fromRank:'Lecturer I',    toRank:'Senior Lecturer',publications:8,teachingEvalScore:90, committeeRoles:4, aiScore:84, aiDecision:'Approved',     status:'AI-Approved',  aiBreakdown:{yearsOfService:85,publications:85,teachingEvaluation:90,attendanceRecord:88,pscCompliance:100,committeeWork:80} },
    { staff: createdStaff[5]._id, fromGradeLevel:'GL 12', toGradeLevel:'GL 13', fromRank:'Principal Officer',toRank:'Assistant Registrar',publications:0,teachingEvalScore:75,committeeRoles:2,aiScore:45,aiDecision:'Rejected',status:'Pending',      aiBreakdown:{yearsOfService:60,publications:80,teachingEvaluation:75,attendanceRecord:70,pscCompliance:60,committeeWork:60},  aiReasons:['PSC compliance issues noted','Insufficient years since last promotion'] },
    { staff: createdStaff[8]._id, fromGradeLevel:'GL 13', toGradeLevel:'GL 14', fromRank:'Lecturer I',    toRank:'Senior Lecturer',publications:6, teachingEvalScore:82, committeeRoles:2, aiScore:78, aiDecision:'Review',   status:'Under-Review', aiBreakdown:{yearsOfService:80,publications:75,teachingEvaluation:82,attendanceRecord:86,pscCompliance:95,committeeWork:65} },
  ];
  await Promotion.insertMany(promoRecords);
  console.log(`✔ ${promoRecords.length} promotion records seeded.`);

  // Payroll — May 2026
  await Payroll.deleteMany({});
  const SALARY_TABLE = { 'GL 07':106000,'GL 08':128000,'GL 09':155000,'GL 10':185000,'GL 11':215000,'GL 12':248000,'GL 13':285000,'GL 14':325000,'GL 15':390000 };
  const payrollDocs = createdStaff.map(s => {
    const basic     = SALARY_TABLE[s.gradeLevel] || 120000;
    const housing   = Math.round(basic * 0.25);
    const transport = Math.round(basic * 0.15);
    const medical   = Math.round(basic * 0.05);
    const research  = s.category === 'Academic' ? Math.round(basic * 0.10) : 0;
    const gross     = basic + housing + transport + medical + research;
    const pension   = Math.round(basic * 0.08);
    const nhf       = Math.round(basic * 0.025);
    const tax       = gross > 300000 ? Math.round((gross - 300000) * 0.24) : 0;
    return {
      staff: s._id, month: 5, year: 2026, cycle: 'MAY-2026',
      basicSalary: basic, housingAllowance: housing, transportAllowance: transport,
      medicalAllowance: medical, researchAllowance: research,
      pension, nhf, tax, status: 'Processed',
      flagged: s.email === 'i.obi@unidel.edu.ng', // seed one flag for demo
      flagReason: s.email === 'i.obi@unidel.edu.ng' ? 'Grade level mismatch detected by AI audit.' : null,
    };
  });
  await Payroll.insertMany(payrollDocs);
  console.log(`✔ ${payrollDocs.length} payroll records seeded.`);

  console.log('\n🎉 UNIDEL HRMS seed complete!\n');
  console.log('Demo login credentials:');
  console.log('  Super Admin : admin@unidel.edu.ng    / password123');
  console.log('  Registrar   : registry@unidel.edu.ng / password123');
  console.log('  Bursary     : bursary@unidel.edu.ng  / password123');
  console.log('  HOD (CS)    : hod.cs@unidel.edu.ng   / password123\n');

  await mongoose.disconnect();
}

seed().catch(err => { console.error('Seeder error:', err); process.exit(1); });
