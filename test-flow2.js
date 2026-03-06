const fs = require('fs');
const prisma = require('./src/lib/prisma');
const jwt = require('jsonwebtoken');

(async () => {
  try {
    const admin = await prisma.user.findFirst({where:{role:'SUPER_ADMIN'}});
    const adminToken = jwt.sign({ id: admin.id, email: admin.email, role: admin.role, type: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    const reg = await prisma.registration.findFirst({where:{status:'PAYMENT_UPLOADED'}});
    if (!reg) throw new Error('No registration waiting for payment verification');
    
    console.log('>>> [ADMIN] Approving payment...');
    const verifyRes = await fetch('http://localhost:5000/api/ppdb/admin/payments/'+reg.id+'/verify', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' }
    });
    console.log('Approve Res:', await verifyRes.json());
    
    const p = await prisma.parent.findUnique({where:{id: reg.parentId}});
    const parentToken = jwt.sign({ id: p.id, email: p.email, role: 'PARENT', type: 'parent' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    console.log('\n>>> [PARENT] Filling forms...');
    const studentFormRes = await fetch('http://localhost:5000/api/ppdb/form/student', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + parentToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName: 'Siswa Test 1', nickName: 'Test1', gender: 'LAKI_LAKI', birthPlace: 'Bengkulu', birthDate: '2020-01-01',
        religion: 'Islam', address: 'Jl. Test 123', hasSpecialNeeds: false
      })
    });
    console.log('Student Form Res:', await studentFormRes.json());
    
    const parentFormRes = await fetch('http://localhost:5000/api/ppdb/form/parent-info', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + parentToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fatherName: 'Ayah Test 1', fatherNik: '1234567890123456', fatherJob: 'PNS', fatherIncome: '5-10', fatherPhone: '08123', fatherAddress: 'Sama',
        motherName: 'Ibu Test 1', motherNik: '1234567890123457', motherJob: 'IRT', motherIncome: '< 2', motherPhone: '08124', motherAddress: 'Sama'
      })
    });
    console.log('Parent Form Res:', await parentFormRes.json());
    
    console.log('\n>>> [PARENT] Uploading 6 documents...');
    const boundary = '----WebKitFormBoundaryDOCS123';
    const fileContent = fs.readFileSync('dummy.jpg');
    const docs = ['docPhoto', 'docTkCert', 'docBirthCert', 'docKartuKeluarga', 'docKtpFather', 'docKtpMother'];
    
    let parts = [];
    for (const doc of docs) {
      let header = '--' + boundary + '\r\n';
      header += 'Content-Disposition: form-data; name=\"' + doc + '\"; filename=\"' + doc + '.jpg\"\r\n';
      header += 'Content-Type: image/jpeg\r\n\r\n';
      parts.push(Buffer.from(header), fileContent, Buffer.from('\r\n'));
    }
    parts.push(Buffer.from('--' + boundary + '--\r\n'));
    const body = Buffer.concat(parts);
    
    const docsRes = await fetch('http://localhost:5000/api/ppdb/form/documents', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + parentToken, 'Content-Type': 'multipart/form-data; boundary=' + boundary },
      body: body
    });
    console.log('Docs Upload Res:', await docsRes.json());
    
    console.log('\n>>> [PARENT] Submitting final form...');
    const submitRes = await fetch('http://localhost:5000/api/ppdb/form/submit', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + parentToken, 'Content-Type': 'application/json' }
    });
    console.log('Submit Final Res:', await submitRes.json());

  } catch (e) {
    console.error(e);
  } finally {
    prisma.$disconnect();
  }
})();
