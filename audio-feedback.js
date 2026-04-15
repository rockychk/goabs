// ==================== AUDIO FEEDBACK ====================
// File: audio-feedback.js
// Menggunakan Web Speech API bawaan browser (GRATIS)

class AudioFeedback {
    constructor() {
        this.speechSynthesis = window.speechSynthesis;
        this.voices = [];
        this.selectedVoice = null;
        this.isSpeaking = false;
        this.queue = [];
        this.voiceReady = false;
        this.initVoices();
    }

    initVoices() {
        if (this.speechSynthesis.getVoices().length > 0) {
            this.selectBestVoice();
        } else {
            this.speechSynthesis.addEventListener('voiceschanged', () => {
                this.selectBestVoice();
            });
        }
    }

    selectBestVoice() {
        this.voices = this.speechSynthesis.getVoices();
        
        const priorityNames = [
            'Google Bahasa Indonesia',
            'Google Indonesian', 
            'Microsoft Sari',
            'Microsoft Andika',
            'Damayanti',
            'Ayu',
            'Indonesian',
            'Bahasa Indonesia'
        ];
        
        for (const name of priorityNames) {
            const found = this.voices.find(voice => voice.name.includes(name));
            if (found) {
                this.selectedVoice = found;
                console.log('Voice:', found.name);
                this.voiceReady = true;
                break;
            }
        }
        
        if (!this.selectedVoice) {
            this.selectedVoice = this.voices.find(v => v.lang.includes('id'));
            if (this.selectedVoice) {
                console.log('Voice fallback:', this.selectedVoice.name);
                this.voiceReady = true;
            }
        }
        
        if (!this.selectedVoice && this.voices.length > 0) {
            this.selectedVoice = this.voices[0];
            this.voiceReady = true;
        }
    }

    speak(text) {
        if (!text || !this.voiceReady) return;
        
        const utterance = new SpeechSynthesisUtterance(text);
        if (this.selectedVoice) utterance.voice = this.selectedVoice;
        utterance.rate = 1.2;
        utterance.pitch = 1.0;
        
        utterance.onend = () => {
            this.isSpeaking = false;
            if (this.queue.length > 0) {
                this.speak(this.queue.shift());
            }
        };
        
        if (this.isSpeaking) {
            this.queue.push(text);
            return;
        }
        
        this.isSpeaking = true;
        this.speechSynthesis.speak(utterance);
    }

    stop() {
        this.speechSynthesis.cancel();
        this.isSpeaking = false;
        this.queue = [];
    }

    // ==================== FUNGSI YANG DIPAKAI ====================
    welcome() {
        setTimeout(() => this.speak('Selamat datang di GoAbs'), 500);
    }
    
    scanSuccess(namaSiswa) {
        this.speak(`${namaSiswa}, hadir`);
    }
    
    scanTerlambat(namaSiswa, menit) {
        this.speak(`${namaSiswa}, terlambat ${menit} menit`);
    }
    
    scanFailed() {
        this.speak('QR gagal, coba lagi');
    }
    
    alreadyAbsent(namaSiswa, namaMapel) {
        this.speak(`${namaSiswa}, sudah absen di mapel ${namaMapel}`);
    }
    
    invalidQR() {
        this.speak('QR Code tidak valid');
    }
    
    studentNotFound(namaSiswa) {
        this.speak(`Siswa ${namaSiswa} tidak ditemukan`);
    }
    
    mapelNotFound() {
        this.speak('Mata pelajaran tidak ditemukan');
    }
    
    saveFailed() {
        this.speak('Gagal menyimpan absensi');
    }
}

const audioFeedback = new AudioFeedback();
