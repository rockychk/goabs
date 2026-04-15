// ==================== CETAK LAPORAN ====================

function showCetakModal() {
    document.getElementById('cetakModal').style.display = 'flex';
    updateCetakFilter();
}

function closeCetakModal() {
    document.getElementById('cetakModal').style.display = 'none';
}

function updateCetakFilter() {
    const jenis = document.getElementById('cetakJenis').value;
    const container = document.getElementById('cetakFilterContainer');
    let html = '';
    
    if (jenis === 'harian') {
        html = `
            <div class="form-group">
                <label>Tanggal</label>
                <input type="date" id="cetakTanggal" value="${new Date().toISOString().split('T')[0]}">
            </div>
        `;
    } else if (jenis === 'mingguan') {
        html = `
            <div class="form-group">
                <label>Pilih Mapel</label>
                <select id="cetakMapel">${getMapelOptions()}</select>
            </div>
            <div class="form-group">
                <label>Minggu Ke</label>
                <select id="cetakMinggu">
                    <option value="1">Minggu 1</option><option value="2">Minggu 2</option>
                    <option value="3">Minggu 3</option><option value="4">Minggu 4</option>
                    <option value="5">Minggu 5</option>
                </select>
            </div>
            <div class="form-group">
                <label>Bulan & Tahun</label>
                <input type="month" id="cetakBulanMinggu" value="${new Date().toISOString().slice(0,7)}">
            </div>
        `;
    } else if (jenis === 'bulanan') {
        html = `
            <div class="form-group">
                <label>Pilih Mapel</label>
                <select id="cetakMapel">${getMapelOptions()}</select>
            </div>
            <div class="form-group">
                <label>Bulan</label>
                <input type="month" id="cetakBulan" value="${new Date().toISOString().slice(0,7)}">
            </div>
        `;
    } else if (jenis === 'semester') {
        const tahun = new Date().getFullYear();
        html = `
            <div class="form-group">
                <label>Pilih Mapel</label>
                <select id="cetakMapel">${getMapelOptions()}</select>
            </div>
            <div class="form-group">
                <label>Semester</label>
                <select id="cetakSemester">
                    <option value="1">Ganjil (Juli - Desember)</option>
                    <option value="2">Genap (Januari - Juni)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Tahun Ajaran</label>
                <input type="number" id="cetakTahunSemester" value="${tahun}" min="2020" max="2030">
            </div>
        `;
    }
    container.innerHTML = html;
}

function getMapelOptions() {
    if (typeof mapelList === 'undefined') return '';
    return mapelList.map(m => `<option value="${m.idMapel}">${escapeHtml(m.namaMapel)}</option>`).join('');
}

async function generateLaporan() {
    const btnCetak = document.querySelector('#cetakModal .btn-save');
    const btnBatal = document.querySelector('#cetakModal .btn-cancel');

    showCetakSpinner(true); // tampilkan spinner

    if (btnCetak) btnCetak.disabled = true;
    if (btnBatal) btnBatal.disabled = true;

    try {
        const jenis = document.getElementById('cetakJenis').value;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        const now = new Date();
        const tanggalCetak = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        const jamCetak = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const footerText = 'Dicetak dari WebApp AbsensiKu';

        const applyHeaderFooter = (pageNum, total) => {
            doc.setPage(pageNum);
            doc.setFontSize(14);
            doc.text('DAFTAR HADIR PESERTA DIDIK', doc.internal.pageSize.width / 2, 15, { align: 'center' });
            doc.setFontSize(12);
            doc.text(`Kelas: ${currentUser.namaKelas || '-'}`, doc.internal.pageSize.width / 2, 22, { align: 'center' });
            doc.text(`${currentUser.sekolah || '-'}`, doc.internal.pageSize.width / 2, 29, { align: 'center' });
            doc.setFontSize(9);
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
            doc.text(`${tanggalCetak} ${jamCetak}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
            doc.text(`Halaman ${pageNum} dari ${total}`, pageWidth - 14, pageHeight - 5, { align: 'right' });
        };

        let headers, body, startY = 45;

        // ========== HARIAN ==========
        if (jenis === 'harian') {
            const tanggal = document.getElementById('cetakTanggal').value;
            const dateObj = new Date(tanggal);
            const hariNama = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dateObj.getDay()];
            const tglFormat = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            const mapelHariIni = mapelList.filter(m => m.hari === hariNama);
            if (mapelHariIni.length === 0) {
                showToast('Tidak ada mapel di hari ini');
                return;
            }

            const res = await apiCall('getAbsensi', { uidGuru: currentUser.uid });
            if (!res.success) { showToast('Gagal ambil data'); return; }
            const absensiHarian = res.data.filter(a => a.tanggal === tanggal);

            const siswaMap = new Map();
            siswaList.forEach(s => siswaMap.set(s.idSiswa, {
                nama: s.nama, nis: s.nis, statusMapel: {}, keterangan: []
            }));

            absensiHarian.forEach(a => {
                const s = siswaMap.get(a.siswaId);
                if (!s) return;
                const mapel = mapelList.find(m => m.idMapel === a.mapelId);
                if (!mapel) return;
                const statusSingkat = a.status === 'Hadir' ? 'H' : (a.status === 'Terlambat' ? 'T' : (a.status === 'Sakit' ? 'S' : (a.status === 'Izin' ? 'I' : 'A')));
                s.statusMapel[mapel.idMapel] = statusSingkat;
                if (a.status !== 'Hadir' && a.status !== 'Terlambat') {
                    s.keterangan.push(`${mapel.namaMapel}: ${a.status}`);
                }
            });

            headers = ['No', 'Nama', 'NIS', ...mapelHariIni.map(m => m.namaMapel), 'Keterangan'];
            body = [];
            let no = 1;
            for (let s of siswaMap.values()) {
                const row = [no++, s.nama, s.nis];
                mapelHariIni.forEach(m => row.push(s.statusMapel[m.idMapel] || '-'));
                row.push(s.keterangan.join(', '));
                body.push(row);
            }

            doc.setFontSize(11);
            doc.text(`Hari/Tanggal: ${hariNama}, ${tglFormat}`, 14, 40);
            startY = 45;
        }

        // ========== MINGGUAN ==========
        else if (jenis === 'mingguan') {
            const mapelId = document.getElementById('cetakMapel').value;
            const minggu = parseInt(document.getElementById('cetakMinggu').value);
            const bulanTahun = document.getElementById('cetakBulanMinggu').value;
            if (!mapelId) { showToast('Pilih mapel'); return; }

            const mapel = mapelList.find(m => m.idMapel === mapelId);
            const [tahun, bulan] = bulanTahun.split('-').map(Number);

            const firstDay = new Date(tahun, bulan-1, 1);
            const firstMonday = new Date(firstDay);
            firstMonday.setDate(1 + (8 - firstDay.getDay()) % 7);
            const start = new Date(firstMonday);
            start.setDate(firstMonday.getDate() + (minggu - 1) * 7);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];

            doc.setFontSize(11);
            doc.text(`Mapel: ${mapel.namaMapel}`, 14, 40);
            doc.text(`Minggu ke-${minggu} (${startStr} s/d ${endStr})`, 14, 47);

            const res = await apiCall('getAbsensi', { uidGuru: currentUser.uid });
            if (!res.success) { showToast('Gagal ambil data'); return; }
            const absensi = res.data.filter(a => a.mapelId === mapelId && a.tanggal >= startStr && a.tanggal <= endStr);

            const siswaMap = new Map();
            siswaList.forEach(s => siswaMap.set(s.idSiswa, { nama: s.nama, nis: s.nis, status: '-', ket: '' }));
            absensi.forEach(a => {
                const s = siswaMap.get(a.siswaId);
                if (!s) return;
                const singkat = a.status === 'Hadir' ? 'H' : (a.status === 'Terlambat' ? 'T' : (a.status === 'Sakit' ? 'S' : (a.status === 'Izin' ? 'I' : 'A')));
                s.status = singkat;
                if (a.status !== 'Hadir' && a.status !== 'Terlambat') s.ket = a.status;
            });

            headers = ['No', 'Nama', 'NIS', 'Kehadiran', 'Keterangan'];
            body = [];
            let no = 1;
            for (let s of siswaMap.values()) {
                body.push([no++, s.nama, s.nis, s.status, s.ket]);
            }
            startY = 52;
        }

        // ========== BULANAN ==========
        else if (jenis === 'bulanan') {
            const mapelId = document.getElementById('cetakMapel').value;
            const bulanTahun = document.getElementById('cetakBulan').value;
            if (!mapelId) { showToast('Pilih mapel'); return; }

            const mapel = mapelList.find(m => m.idMapel === mapelId);
            const [tahun, bulan] = bulanTahun.split('-').map(Number);
            const namaBulan = new Date(tahun, bulan-1).toLocaleDateString('id-ID', { month: 'long' });

            const startDate = `${tahun}-${String(bulan).padStart(2,'0')}-01`;
            const endDate = `${tahun}-${String(bulan).padStart(2,'0')}-${new Date(tahun, bulan, 0).getDate()}`;

            doc.setFontSize(11);
            doc.text(`Mapel: ${mapel.namaMapel}`, 14, 40);
            doc.text(`Bulan: ${namaBulan} ${tahun}`, 14, 47);

            const res = await apiCall('getAbsensi', { uidGuru: currentUser.uid });
            if (!res.success) { showToast('Gagal ambil data'); return; }
            const absensi = res.data.filter(a => a.mapelId === mapelId && a.tanggal >= startDate && a.tanggal <= endDate);

            const siswaMap = new Map();
            siswaList.forEach(s => siswaMap.set(s.idSiswa, {
                nama: s.nama, nis: s.nis,
                w1: '-', w2: '-', w3: '-', w4: '-', w5: '-',
                h:0, s:0, i:0, a:0
            }));

            absensi.forEach(a => {
                const s = siswaMap.get(a.siswaId);
                if (!s) return;
                const tgl = new Date(a.tanggal);
                const mingguKe = Math.ceil(tgl.getDate() / 7);
                const status = a.status === 'Hadir' ? 'H' : (a.status === 'Terlambat' ? 'T' : (a.status === 'Sakit' ? 'S' : (a.status === 'Izin' ? 'I' : 'A')));
                if (mingguKe === 1) s.w1 = status;
                else if (mingguKe === 2) s.w2 = status;
                else if (mingguKe === 3) s.w3 = status;
                else if (mingguKe === 4) s.w4 = status;
                else if (mingguKe === 5) s.w5 = status;

                if (status === 'H' || status === 'T') s.h++;
                else if (status === 'S') s.s++;
                else if (status === 'I') s.i++;
                else if (status === 'A') s.a++;
            });

            const lastDate = new Date(tahun, bulan, 0).getDate();
            const maxMinggu = Math.ceil(lastDate / 7);
            const mingguHeaders = [];
            for (let i = 1; i <= maxMinggu; i++) mingguHeaders.push(`M${i}`);
            headers = ['No', 'Nama', 'NIS', ...mingguHeaders, 'H', 'S', 'I', 'A'];
            body = [];
            let no = 1;
            for (let s of siswaMap.values()) {
                const row = [no++, s.nama, s.nis];
                if (maxMinggu >= 1) row.push(s.w1);
                if (maxMinggu >= 2) row.push(s.w2);
                if (maxMinggu >= 3) row.push(s.w3);
                if (maxMinggu >= 4) row.push(s.w4);
                if (maxMinggu >= 5) row.push(s.w5);
                row.push(s.h, s.s, s.i, s.a);
                body.push(row);
            }
            startY = 52;
        }

        // ========== SEMESTER ==========
        else if (jenis === 'semester') {
            const mapelId = document.getElementById('cetakMapel').value;
            const semester = parseInt(document.getElementById('cetakSemester').value);
            const tahun = parseInt(document.getElementById('cetakTahunSemester').value);
            if (!mapelId) { showToast('Pilih mapel'); return; }

            const mapel = mapelList.find(m => m.idMapel === mapelId);
            let startMonth, endMonth, bulanList;
            if (semester === 1) {
                startMonth = 7; endMonth = 12;
                bulanList = ['Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
            } else {
                startMonth = 1; endMonth = 6;
                bulanList = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'];
            }

            const startDate = `${tahun}-${String(startMonth).padStart(2,'0')}-01`;
            const lastDay = new Date(tahun, endMonth, 0).getDate();
            const endDate = `${tahun}-${String(endMonth).padStart(2,'0')}-${lastDay}`;

            doc.setFontSize(11);
            doc.text(`Mapel: ${mapel.namaMapel}`, 14, 40);
            doc.text(`Semester: ${semester === 1 ? 'Ganjil' : 'Genap'} ${tahun}/${tahun+1}`, 14, 47);

            const res = await apiCall('getAbsensi', { uidGuru: currentUser.uid });
            if (!res.success) { showToast('Gagal ambil data'); return; }
            const absensi = res.data.filter(a => a.mapelId === mapelId && a.tanggal >= startDate && a.tanggal <= endDate);

            const siswaMap = new Map();
            siswaList.forEach(s => siswaMap.set(s.idSiswa, {
                nama: s.nama, nis: s.nis,
                bulan: {}, h:0, s:0, i:0, a:0
            }));

            absensi.forEach(a => {
                const s = siswaMap.get(a.siswaId);
                if (!s) return;
                const tgl = new Date(a.tanggal);
                const blnKey = tgl.toLocaleDateString('id-ID', { month: 'short' });
                const status = a.status === 'Hadir' ? 'H' : (a.status === 'Terlambat' ? 'T' : (a.status === 'Sakit' ? 'S' : (a.status === 'Izin' ? 'I' : 'A')));
                s.bulan[blnKey] = status;
                if (status === 'H' || status === 'T') s.h++;
                else if (status === 'S') s.s++;
                else if (status === 'I') s.i++;
                else if (status === 'A') s.a++;
            });

            headers = ['No', 'Nama', 'NIS', ...bulanList, 'H', 'S', 'I', 'A'];
            body = [];
            let no = 1;
            for (let s of siswaMap.values()) {
                const row = [no++, s.nama, s.nis];
                bulanList.forEach(bln => row.push(s.bulan[bln] || '-'));
                row.push(s.h, s.s, s.i, s.a);
                body.push(row);
            }
            startY = 52;
        }

        if (headers && body) {
            doc.autoTable({
                head: [headers],
                body: body,
                startY: startY,
                styles: { fontSize: 8 },
                margin: { top: 40 }
            });

            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                applyHeaderFooter(i, totalPages);
            }
        }

        doc.save(`laporan_absensi_${jenis}.pdf`);
        closeCetakModal();
        showToast('PDF berhasil dibuat');
    }catch (error) {
        console.error(error);
        showToast('Gagal membuat PDF: ' + error.message);
    } finally {
        showCetakSpinner(false); // sembunyikan spinner
        if (btnCetak) btnCetak.disabled = false;
        if (btnBatal) btnBatal.disabled = false;
    }
}

// ==================== EXPORT CSV ====================
async function generateLaporanCSV() {
    const jenis = document.getElementById('cetakJenis').value;
    showCetakSpinner(true);
    const btnCSV = document.querySelector('#cetakModal .btn-save[onclick="generateLaporanCSV()"]');
    const btnPDF = document.querySelector('#cetakModal .btn-save[onclick="generateLaporan()"]');
    const btnBatal = document.querySelector('#cetakModal .btn-cancel');
    if (btnCSV) btnCSV.disabled = true;
    if (btnPDF) btnPDF.disabled = true;
    if (btnBatal) btnBatal.disabled = true;

    try {
        let csvRows = [];
        const delimiter = ';'; // Sesuai Excel Indonesia

        // Header umum
        csvRows.push(`"DAFTAR HADIR PESERTA DIDIK"`);
        csvRows.push(`"Kelas: ${currentUser.namaKelas || '-'}"`);
        csvRows.push(`"${currentUser.sekolah || '-'}"`);
        csvRows.push('');

        // ========== HARIAN ==========
        if (jenis === 'harian') {
            const tanggal = document.getElementById('cetakTanggal').value;
            const dateObj = new Date(tanggal);
            const hariNama = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dateObj.getDay()];
            const tglFormat = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            csvRows.push(`"Hari/Tanggal: ${hariNama}, ${tglFormat}"`);
            csvRows.push('');

            const mapelHariIni = mapelList.filter(m => m.hari === hariNama);
            if (mapelHariIni.length === 0) {
                showToast('Tidak ada mapel di hari ini');
                return;
            }

            const res = await apiCall('getAbsensi', { uidGuru: currentUser.uid });
            if (!res.success) { showToast('Gagal ambil data'); return; }
            const absensiHarian = res.data.filter(a => a.tanggal === tanggal);

            const siswaMap = new Map();
            siswaList.forEach(s => siswaMap.set(s.idSiswa, {
                nama: s.nama, nis: s.nis, statusMapel: {}, keterangan: []
            }));

            absensiHarian.forEach(a => {
                const s = siswaMap.get(a.siswaId);
                if (!s) return;
                const mapel = mapelList.find(m => m.idMapel === a.mapelId);
                if (!mapel) return;
                const statusSingkat = a.status === 'Hadir' ? 'H' : (a.status === 'Terlambat' ? 'T' : (a.status === 'Sakit' ? 'S' : (a.status === 'Izin' ? 'I' : 'A')));
                s.statusMapel[mapel.idMapel] = statusSingkat;
                if (a.status !== 'Hadir' && a.status !== 'Terlambat') {
                    s.keterangan.push(`${mapel.namaMapel}: ${a.status}`);
                }
            });

            const headers = ['No', 'Nama', 'NIS', ...mapelHariIni.map(m => m.namaMapel), 'Keterangan'];
            csvRows.push(headers.map(h => `"${h}"`).join(delimiter));

            let no = 1;
            for (let s of siswaMap.values()) {
                const row = [no++, s.nama, s.nis];
                mapelHariIni.forEach(m => row.push(s.statusMapel[m.idMapel] || '-'));
                row.push(s.keterangan.join(', '));
                csvRows.push(row.map(cell => `"${cell}"`).join(delimiter));
            }
        }

        // ========== MINGGUAN ==========
        else if (jenis === 'mingguan') {
            const mapelId = document.getElementById('cetakMapel').value;
            const minggu = parseInt(document.getElementById('cetakMinggu').value);
            const bulanTahun = document.getElementById('cetakBulanMinggu').value;
            if (!mapelId) { showToast('Pilih mapel'); return; }

            const mapel = mapelList.find(m => m.idMapel === mapelId);
            const [tahun, bulan] = bulanTahun.split('-').map(Number);

            const firstDay = new Date(tahun, bulan-1, 1);
            const firstMonday = new Date(firstDay);
            firstMonday.setDate(1 + (8 - firstDay.getDay()) % 7);
            const start = new Date(firstMonday);
            start.setDate(firstMonday.getDate() + (minggu - 1) * 7);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];

            csvRows.push(`"Mapel: ${mapel.namaMapel}"`);
            csvRows.push(`"Minggu ke-${minggu} (${startStr} s/d ${endStr})"`);
            csvRows.push('');

            const res = await apiCall('getAbsensi', { uidGuru: currentUser.uid });
            if (!res.success) { showToast('Gagal ambil data'); return; }
            const absensi = res.data.filter(a => a.mapelId === mapelId && a.tanggal >= startStr && a.tanggal <= endStr);

            const siswaMap = new Map();
            siswaList.forEach(s => siswaMap.set(s.idSiswa, { nama: s.nama, nis: s.nis, status: '-', ket: '' }));
            absensi.forEach(a => {
                const s = siswaMap.get(a.siswaId);
                if (!s) return;
                const singkat = a.status === 'Hadir' ? 'H' : (a.status === 'Terlambat' ? 'T' : (a.status === 'Sakit' ? 'S' : (a.status === 'Izin' ? 'I' : 'A')));
                s.status = singkat;
                if (a.status !== 'Hadir' && a.status !== 'Terlambat') s.ket = a.status;
            });

            const headers = ['No', 'Nama', 'NIS', 'Kehadiran', 'Keterangan'];
            csvRows.push(headers.map(h => `"${h}"`).join(delimiter));

            let no = 1;
            for (let s of siswaMap.values()) {
                const row = [no++, s.nama, s.nis, s.status, s.ket];
                csvRows.push(row.map(cell => `"${cell}"`).join(delimiter));
            }
        }

        // ========== BULANAN ==========
        else if (jenis === 'bulanan') {
            const mapelId = document.getElementById('cetakMapel').value;
            const bulanTahun = document.getElementById('cetakBulan').value;
            if (!mapelId) { showToast('Pilih mapel'); return; }

            const mapel = mapelList.find(m => m.idMapel === mapelId);
            const [tahun, bulan] = bulanTahun.split('-').map(Number);
            const namaBulan = new Date(tahun, bulan-1).toLocaleDateString('id-ID', { month: 'long' });

            const startDate = `${tahun}-${String(bulan).padStart(2,'0')}-01`;
            const endDate = `${tahun}-${String(bulan).padStart(2,'0')}-${new Date(tahun, bulan, 0).getDate()}`;

            csvRows.push(`"Mapel: ${mapel.namaMapel}"`);
            csvRows.push(`"Bulan: ${namaBulan} ${tahun}"`);
            csvRows.push('');

            const res = await apiCall('getAbsensi', { uidGuru: currentUser.uid });
            if (!res.success) { showToast('Gagal ambil data'); return; }
            const absensi = res.data.filter(a => a.mapelId === mapelId && a.tanggal >= startDate && a.tanggal <= endDate);

            const siswaMap = new Map();
            siswaList.forEach(s => siswaMap.set(s.idSiswa, {
                nama: s.nama, nis: s.nis,
                w1: '-', w2: '-', w3: '-', w4: '-', w5: '-',
                h:0, s:0, i:0, a:0
            }));

            absensi.forEach(a => {
                const s = siswaMap.get(a.siswaId);
                if (!s) return;
                const tgl = new Date(a.tanggal);
                const mingguKe = Math.ceil(tgl.getDate() / 7);
                const status = a.status === 'Hadir' ? 'H' : (a.status === 'Terlambat' ? 'T' : (a.status === 'Sakit' ? 'S' : (a.status === 'Izin' ? 'I' : 'A')));
                if (mingguKe === 1) s.w1 = status;
                else if (mingguKe === 2) s.w2 = status;
                else if (mingguKe === 3) s.w3 = status;
                else if (mingguKe === 4) s.w4 = status;
                else if (mingguKe === 5) s.w5 = status;

                if (status === 'H' || status === 'T') s.h++;
                else if (status === 'S') s.s++;
                else if (status === 'I') s.i++;
                else if (status === 'A') s.a++;
            });

            const lastDate = new Date(tahun, bulan, 0).getDate();
            const maxMinggu = Math.ceil(lastDate / 7);
            const mingguHeaders = [];
            for (let i = 1; i <= maxMinggu; i++) mingguHeaders.push(`M${i}`);
            const headers = ['No', 'Nama', 'NIS', ...mingguHeaders, 'H', 'S', 'I', 'A'];
            csvRows.push(headers.map(h => `"${h}"`).join(delimiter));

            let no = 1;
            for (let s of siswaMap.values()) {
                const row = [no++, s.nama, s.nis];
                if (maxMinggu >= 1) row.push(s.w1);
                if (maxMinggu >= 2) row.push(s.w2);
                if (maxMinggu >= 3) row.push(s.w3);
                if (maxMinggu >= 4) row.push(s.w4);
                if (maxMinggu >= 5) row.push(s.w5);
                row.push(s.h, s.s, s.i, s.a);
                csvRows.push(row.map(cell => `"${cell}"`).join(delimiter));
            }
        }

        // ========== SEMESTER ==========
        else if (jenis === 'semester') {
            const mapelId = document.getElementById('cetakMapel').value;
            const semester = parseInt(document.getElementById('cetakSemester').value);
            const tahun = parseInt(document.getElementById('cetakTahunSemester').value);
            if (!mapelId) { showToast('Pilih mapel'); return; }

            const mapel = mapelList.find(m => m.idMapel === mapelId);
            let startMonth, endMonth, bulanList;
            if (semester === 1) {
                startMonth = 7; endMonth = 12;
                bulanList = ['Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
            } else {
                startMonth = 1; endMonth = 6;
                bulanList = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'];
            }

            const startDate = `${tahun}-${String(startMonth).padStart(2,'0')}-01`;
            const lastDay = new Date(tahun, endMonth, 0).getDate();
            const endDate = `${tahun}-${String(endMonth).padStart(2,'0')}-${lastDay}`;

            csvRows.push(`"Mapel: ${mapel.namaMapel}"`);
            csvRows.push(`"Semester: ${semester === 1 ? 'Ganjil' : 'Genap'} ${tahun}/${tahun+1}"`);
            csvRows.push('');

            const res = await apiCall('getAbsensi', { uidGuru: currentUser.uid });
            if (!res.success) { showToast('Gagal ambil data'); return; }
            const absensi = res.data.filter(a => a.mapelId === mapelId && a.tanggal >= startDate && a.tanggal <= endDate);

            const siswaMap = new Map();
            siswaList.forEach(s => siswaMap.set(s.idSiswa, {
                nama: s.nama, nis: s.nis,
                bulan: {}, h:0, s:0, i:0, a:0
            }));

            absensi.forEach(a => {
                const s = siswaMap.get(a.siswaId);
                if (!s) return;
                const tgl = new Date(a.tanggal);
                const blnKey = tgl.toLocaleDateString('id-ID', { month: 'short' });
                const status = a.status === 'Hadir' ? 'H' : (a.status === 'Terlambat' ? 'T' : (a.status === 'Sakit' ? 'S' : (a.status === 'Izin' ? 'I' : 'A')));
                s.bulan[blnKey] = status;
                if (status === 'H' || status === 'T') s.h++;
                else if (status === 'S') s.s++;
                else if (status === 'I') s.i++;
                else if (status === 'A') s.a++;
            });

            const headers = ['No', 'Nama', 'NIS', ...bulanList, 'H', 'S', 'I', 'A'];
            csvRows.push(headers.map(h => `"${h}"`).join(delimiter));

            let no = 1;
            for (let s of siswaMap.values()) {
                const row = [no++, s.nama, s.nis];
                bulanList.forEach(bln => row.push(s.bulan[bln] || '-'));
                row.push(s.h, s.s, s.i, s.a);
                csvRows.push(row.map(cell => `"${cell}"`).join(delimiter));
            }
        }

        // Gabungkan dan download
        const csvString = '\uFEFF' + csvRows.join('\r\n'); // BOM UTF-8
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `laporan_absensi_${jenis}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);

        closeCetakModal();
        showToast('CSV berhasil dibuat');
    } catch (error) {
        console.error(error);
        showToast('Gagal membuat CSV: ' + error.message);
    } finally {
        showCetakSpinner(false);
        if (btnCSV) btnCSV.disabled = false;
        if (btnPDF) {
            const pdfBtn = document.querySelector('#cetakModal .btn-save[onclick="generateLaporan()"]');
            if (pdfBtn) pdfBtn.disabled = false;
        }
        if (btnBatal) btnBatal.disabled = false;
    }
}



////////// FUNGSI BACKUP ////////////
async function backupData() {
    showToast('Mengambil data untuk backup...');
    try {
        // Ambil semua data
        const [mapelRes, siswaRes, absensiRes] = await Promise.all([
            apiCall('getMapel', { uidGuru: currentUser.uid }),
            apiCall('getSiswa', { uidGuru: currentUser.uid }),
            apiCall('getAbsensi', { uidGuru: currentUser.uid })
        ]);

        if (!mapelRes.success || !siswaRes.success || !absensiRes.success) {
            showToast('Gagal mengambil data dari server');
            return;
        }

        const backupData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            uid: currentUser.uid,
            mapel: mapelRes.data,
            siswa: siswaRes.data,
            absensi: absensiRes.data
        };

        // Enkripsi dengan password (opsional, bisa pakai password default atau minta user)
        const password = currentUser.uid.slice(0,8); // contoh sederhana
        const encrypted = await encryptBackup(JSON.stringify(backupData), password);
        
        // Buat blob dan download
        const blob = new Blob([encrypted], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `goabsku_backup_${currentUser.name.replace(/\s/g,'_')}_${new Date().toISOString().slice(0,10)}.goabsku`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('✅ Backup berhasil diunduh');
    } catch (e) {
        console.error(e);
        showToast('❌ Gagal membuat backup');
    }
}

// Fungsi enkripsi sederhana (gunakan Web Crypto API)
async function encryptBackup(text, password) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: enc.encode('goabsku-salt'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(text)
    );
    // Gabungkan iv + encrypted
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
}

////////// FUNGSI RESTORE ////////////
async function restoreData(file) {
    if (!file) return;
    
    // Cek ekstensi file
    if (!file.name.endsWith('.goabsku')) {
        showToast('❌ File harus berekstensi .goabsku');
        document.getElementById('restoreFileInput').value = '';
        return;
    }
    
    showToast('Memproses file restore...');
    
    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                // Baca file sebagai teks (encrypted base64)
                const encryptedBase64 = e.target.result;
                const password = currentUser.uid.slice(0, 8);
                
                // Dekripsi file
                const decryptedText = await decryptBackup(encryptedBase64, password);
                const backup = JSON.parse(decryptedText);
                
                // Validasi
                if (!backup.version || !backup.uid || backup.uid !== currentUser.uid) {
                    showToast('❌ File backup tidak valid atau bukan milik akun ini');
                    return;
                }
                
                showConfirm(
                    '⚠️ Data yang ada akan diganti dengan data dari backup. Lanjutkan?',
                    'Konfirmasi Restore',
                    async () => {
                        showToast('Mengembalikan data...');
                        
                        // Kirim data ke server (dalam bentuk plain JSON, bukan terenkripsi)
                        const res = await apiCall('restoreBackup', {
                            uid: currentUser.uid,
                            backup: backup
                        });
                        
                        if (res.success) {
                            showToast('✅ Data berhasil dipulihkan. Memuat ulang...');
                            // Hapus cache
                            localStorage.removeItem(CACHE_KEY_MAPEL);
                            localStorage.removeItem(CACHE_KEY_SISWA);
                            setTimeout(() => location.reload(), 1500);
                        } else {
                            showToast('❌ Gagal: ' + res.message);
                        }
                    }
                );
            } catch (err) {
                console.error('Restore error:', err);
                showToast('❌ File rusak, password salah, atau format tidak valid');
            }
        };
        reader.readAsText(file);
    } catch (e) {
        showToast('❌ Gagal membaca file');
    }
    
    // Reset input
    document.getElementById('restoreFileInput').value = '';
}

async function decryptBackup(encryptedBase64, password) {
    const enc = new TextEncoder();
    
    // Konversi Base64 ke Uint8Array
    const binaryString = atob(encryptedBase64);
    const combined = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        combined[i] = binaryString.charCodeAt(i);
    }
    
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: enc.encode('goabsku-salt'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
    );
    
    return new TextDecoder().decode(decrypted);
}

function showCetakSpinner(show) {
    const spinner = document.getElementById('cetakSpinner');
    if (spinner) spinner.style.display = show ? 'block' : 'none';
}

