const fs = require('fs');
const prisma = require('./src/lib/prisma');
const jwt = require('jsonwebtoken');

(async () => {
  try {
    const parentEmail = 'ortu_test_full3@test.com'; 
    const p = await prisma.parent.findUnique({where:{email: parentEmail}});
    const parentToken = jwt.sign({ id: p.id, email: p.email, role: 'PARENT', type: 'parent' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    console.log('--- 11. ADMIN CREATE OBSERVATION SLOT & CLASSROOM ---');
    const admin = await prisma.user.findFirst({where:{role:'SUPER_ADMIN'}});
    const adminToken = jwt.sign({ id: admin.id, email: admin.email, role: admin.role, type: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    // Check if slot exists, else create
    let slotsRes = await fetch('http://localhost:5000/api/ppdb/admin/observation-slots', { headers: { 'Authorization': 'Bearer ' + adminToken } });
    let slots = (await slotsRes.json()).data || [];
    if (slots.length === 0) {
      const activeYear = await prisma.academicYear.findFirst({where:{isActive:true}});
      await fetch('http://localhost:5000/api/ppdb/admin/observation-slots', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicYearId: activeYear.id, date: '2026-06-01', startTime: '08:00', endTime: '10:00', quota: 10 })
      });
      slotsRes = await fetch('http://localhost:5000/api/ppdb/admin/observation-slots', { headers: { 'Authorization': 'Bearer ' + adminToken } });
      slots = (await slotsRes.json()).data;
    }
    
    // Check if class exists, else create
    let classRes = await fetch('http://localhost:5000/api/ppdb/admin/classrooms', { headers: { 'Authorization': 'Bearer ' + adminToken } });
    let classes = (await classRes.json()).data || [];
    if (classes.length === 0) {
      const activeYear = await prisma.academicYear.findFirst({where:{isActive:true}});
      await fetch('http://localhost:5000/api/ppdb/admin/classrooms', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicYearId: activeYear.id, name: '1A - Abu Bakar', capacity: 30 })
      });
    }

    console.log('\n--- 12. PARENT GET OBSERVATION SLOTS ---');
    const getSlotsRes = await fetch('http://localhost:5000/api/ppdb/observation-slots', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + parentToken }
    });
    const availSlots = (await getSlotsRes.json()).data;
    if (!availSlots || availSlots.length === 0) {
      console.log('Tidak ada slot observasi tersedia.');
      return;
    }
    const slotId = availSlots[0].id; // Ambil slot pertama
    console.log(`Pilih slot ID: ${slotId} (${availSlots[0].date})`);
    
    console.log('\n--- 12. PARENT BOOK OBSERVATION SLOT ---');
    const bookRes = await fetch('http://localhost:5000/api/ppdb/observation-slots/book', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + parentToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId })
    });
    console.log('Book Slot:', (await bookRes.json()).message);
    
    console.log('\n--- 13. ADMIN RECORD OBSERVATION RESULT (ACCEPTED) ---');
    
    const reg = await prisma.registration.findFirst({where:{parentId: p.id}});
    
    const obsRes = await fetch('http://localhost:5000/api/ppdb/admin/registrations/'+reg.id+'/observation', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: 'PASSED', note: 'Calon siswa sangat kooperatif.' })
    });
    console.log('Observasi Result:', (await obsRes.json()).message);
    
    console.log('\n--- 14. ADMIN ASSIGN CLASSROOM ---');
    // Ambil kelas yang tersedia
    classRes = await fetch('http://localhost:5000/api/ppdb/admin/classrooms', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + adminToken }
    });
    classes = (await classRes.json()).data;
    if (!classes || classes.length === 0) {
      console.log('Tidak ada kelas tersedia.');
      return;
    }
    const classId = classes[0].id;
    
    const assignRes = await fetch('http://localhost:5000/api/ppdb/admin/registrations/'+reg.id+'/assign-class', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ classroomId: classId })
    });
    console.log('Assign Class:', (await assignRes.json()).message);
    
    console.log('\n--- 15. CHECK FINAL STATUS ---');
    const finalReg = await prisma.registration.findFirst({where:{parentId: p.id}});
    console.log(`Final Registration Status: ${finalReg.status}`);
    console.log(`Class ID: ${finalReg.classroomId}`);
    
  } catch (e) {
    console.error(e);
  } finally {
    prisma.$disconnect();
  }
})();
