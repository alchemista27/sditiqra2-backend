const fs = require('fs');
const prisma = require('./src/lib/prisma');
const jwt = require('jsonwebtoken');

(async () => {
  try {
    const parentEmail = 'ortu_test_full3@test.com';
    const parentPassword = 'password123';
    
    console.log('--- 1. REGISTER PARENT ---');
    const registerRes = await fetch('http://localhost:5000/api/auth/register-parent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ortu Full Test', email: parentEmail, phone: '08111222333', password: parentPassword })
    });
    const regData = await registerRes.json();
    console.log(regData.message);
    const parentToken = regData.data.token;
    
    console.log('\n--- 2. START REGISTRATION ---');
    const startRes = await fetch('http://localhost:5000/api/ppdb/start', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + parentToken, 'Content-Type': 'application/json' }
    });
    console.log((await startRes.json()).message);
    
    console.log('\n--- 3. UPLOAD PAYMENT ---');
    const boundary = '----WebKitFormBoundaryFULL123';
    const fileContent = fs.readFileSync('dummy.jpg');
    let payData = '';
    payData += '--' + boundary + '\r\nContent-Disposition: form-data; name=\"file\"; filename=\"dummy.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n';
    
    const payBody = Buffer.concat([ Buffer.from(payData), fileContent, Buffer.from('\r\n--' + boundary + '--\r\n') ]);
    const payUploadRes = await fetch('http://localhost:5000/api/ppdb/payment/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + parentToken, 'Content-Type': 'multipart/form-data; boundary=' + boundary },
      body: payBody
    });
    console.log((await payUploadRes.json()).message);
    
    console.log('\n--- 4. ADMIN APPROVE PAYMENT ---');
    const admin = await prisma.user.findFirst({where:{role:'SUPER_ADMIN'}});
    const adminToken = jwt.sign({ id: admin.id, email: admin.email, role: admin.role, type: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    const p = await prisma.parent.findUnique({where:{email: parentEmail}});
    const reg = await prisma.registration.findFirst({where:{parentId: p.id}});
    
    const verifyRes = await fetch('http://localhost:5000/api/ppdb/admin/payments/'+reg.id+'/verify', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' }
    });
    console.log((await verifyRes.json()).message);
    
    console.log('\n--- 5. PARENT FILL FORMS ---');
    const studentFormRes = await fetch('http://localhost:5000/api/ppdb/form/student', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + parentToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName: 'Siswa Test Full', nickName: 'TFULL', gender: 'L', birthPlace: 'Bengkulu', birthDate: '2020-01-01',
        religion: 'Islam', address: 'Jl. Test Full', hasSpecialNeeds: false
      })
    });
    console.log('Student:', (await studentFormRes.json()).message);
    
    const parentFormRes = await fetch('http://localhost:5000/api/ppdb/form/parent-info', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + parentToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fatherName: 'Ayah Full', fatherNik: '1234567890123456', fatherJob: 'PNS',
        motherName: 'Ibu Full', motherNik: '1234567890123457', motherJob: 'IRT'
      })
    });
    console.log('Parent:', (await parentFormRes.json()).message);
    
    console.log('\n--- 6. PARENT UPLOAD DOCS ---');
    let docBoundary = '----WebKitFormBoundaryDOCS123';
    let docParts = [];
    const docs = ['docPhoto', 'docTkCert', 'docBirthCert', 'docKartuKeluarga', 'docKtpFather', 'docKtpMother'];
    
    for (const doc of docs) {
      let header = '--' + docBoundary + '\r\n';
      header += 'Content-Disposition: form-data; name=\"' + doc + '\"; filename=\"' + doc + '.jpg\"\r\n';
      header += 'Content-Type: image/jpeg\r\n\r\n';
      docParts.push(Buffer.from(header), fileContent, Buffer.from('\r\n'));
    }
    docParts.push(Buffer.from('--' + docBoundary + '--\r\n'));
    
    const docsRes = await fetch('http://localhost:5000/api/ppdb/form/documents', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + parentToken, 'Content-Type': 'multipart/form-data; boundary=' + docBoundary },
      body: Buffer.concat(docParts)
    });
    console.log('Docs:', (await docsRes.json()).message);
    
    console.log('\n--- 7. PARENT SUBMIT FINAL FORM ---');
    const submitRes = await fetch('http://localhost:5000/api/ppdb/form/submit', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + parentToken, 'Content-Type': 'application/json' }
    });
    console.log('Submit:', (await submitRes.json()).message);
    
  } catch (e) {
    console.error(e);
  } finally {
    prisma.$disconnect();
  }
})();
