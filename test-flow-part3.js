const fs = require('fs');
const prisma = require('./src/lib/prisma');
const jwt = require('jsonwebtoken');

(async () => {
  try {
    const parentEmail = 'ortu_test_full3@test.com'; // email dari test sebelumnya
    
    const admin = await prisma.user.findFirst({where:{role:'SUPER_ADMIN'}});
    const adminToken = jwt.sign({ id: admin.id, email: admin.email, role: admin.role, type: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    const p = await prisma.parent.findUnique({where:{email: parentEmail}});
    const reg = await prisma.registration.findFirst({where:{parentId: p.id}});
    const parentToken = jwt.sign({ id: p.id, email: p.email, role: 'PARENT', type: 'parent' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    console.log('--- 8. ADMIN VERIFY DOCUMENTS (ADMIN_PASSED) ---');
    const reviewRes = await fetch('http://localhost:5000/api/ppdb/admin/registrations/'+reg.id+'/review', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: 'ADMIN_PASSED', note: 'Lengkap dan sesuai' })
    });
    console.log('Admin Review:', (await reviewRes.json()).message);
    
    console.log('\n--- 9. PARENT DOWNLOAD CLINIC LETTER ---');
    const letterRes = await fetch('http://localhost:5000/api/ppdb/referral-letter', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + parentToken }
    });
    
    if (letterRes.ok) {
      console.log('Download Surat Pengantar Klinik: BERHASIL (PDF generated)');
    } else {
      console.log('Download Surat Pengantar Klinik: GAGAL', await letterRes.text());
    }
    
    console.log('\n--- 10. PARENT UPLOAD CLINIC CERTIFICATE ---');
    const boundary = '----WebKitFormBoundaryCLINIC123';
    const fileContent = fs.readFileSync('dummy.jpg');
    let certData = '';
    certData += '--' + boundary + '\r\nContent-Disposition: form-data; name=\"file\"; filename=\"clinic_result.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n';
    
    let certBody = Buffer.concat([ Buffer.from(certData), fileContent, Buffer.from('\r\n--' + boundary + '--\r\n') ]);
    const clinicUploadRes = await fetch('http://localhost:5000/api/ppdb/clinic-cert/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + parentToken, 'Content-Type': 'multipart/form-data; boundary=' + boundary },
      body: certBody
    });
    console.log('Upload Surat Klinik:', (await clinicUploadRes.json()).message);
    
  } catch (e) {
    console.error(e);
  } finally {
    prisma.$disconnect();
  }
})();
