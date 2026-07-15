# KokoKrunch Eligible Bot

Bot Discord untuk mengecek eligibility member komunitas Roblox **KokoKrunch Studios**
berdasarkan lama bergabung (default 14 hari), menggunakan Roblox Open Cloud API.

Command: `/eligible username:<username_roblox>`

---

## 1. Arsitektur Singkat

```
Discord (/eligible username) 
   -> Bot (Node.js, discord.js v14)
       -> users.roblox.com          : ubah username -> userId
       -> thumbnails.roblox.com     : ambil avatar
       -> apis.roblox.com (Open Cloud v2 Memberships)  : PRIMARY, ambil tanggal join
       -> apis.roblox.com (legacy audit-log)           : FALLBACK kalau primary gagal
```

Kenapa pakai **Open Cloud Memberships API** (bukan audit-log) sebagai sumber utama?
Endpoint audit-log lama (`/legacy-groups/v1/groups/{id}/audit-log`) memang bisa dipakai
dengan API Key, tapi banyak developer melaporkan endpoint ini kadang timeout/tidak stabil
kalau diakses dari server (ini kemungkinan besar penyebab bot lama Anda "lancar di VS Code,
error di VPS" — karena masalahnya ada di sisi Roblox/legacy endpoint, bukan di kode Anda).
Endpoint Membership (`/cloud/v2/groups/{id}/memberships`) lebih baru dan stabil, dan sudah
mengandung field `createTime` yang persis menunjukkan kapan user itu join.

Bot ini tetap menyediakan fallback ke audit-log kalau-kalau endpoint utama gangguan, plus
retry otomatis dengan exponential backoff di setiap request (lihat `src/httpClient.js`).

---

## 2. Persiapan Sebelum Deploy

### 2.1 Bot Discord
Anda sudah membuat bot & token — pastikan Anda juga sudah:
1. Meng-invite bot ke server dengan scope `bot` + `applications.commands`.
2. Mencatat **Application ID (Client ID)** dari halaman *General Information*.
3. (Opsional, untuk testing cepat) Mencatat **Guild ID** server Discord Anda
   (klik kanan nama server -> Copy Server ID, aktifkan Developer Mode dulu di
   Discord Settings -> Advanced kalau opsi ini belum muncul).

### 2.2 Roblox Open Cloud API Key
1. Buka https://create.roblox.com/credentials
2. Buat API Key baru. Di kolom "Cari cakupan", ketik `group` lalu centang:
   - **`group:read`** (wajib — ini yang dipakai untuk List Group Memberships/PRIMARY)
   - **`legacy-group:manage`** (opsional tapi disarankan — dipakai kalau fallback audit-log perlu jalan)

   Anda TIDAK perlu `group:write`, `group-forum:read/write` untuk bot ini karena bot hanya
   membaca data, tidak mengubah apa pun di komunitas. Roblox tidak menyediakan scope
   granular khusus "membership" — operasi List Group Memberships tercakup di scope umum
   `group:read`.
3. Restrict key ke **Group ID** komunitas Anda (625247444 untuk KokoKrunch Studios),
   jangan pilih "All Groups".
4. **Sangat disarankan**: restrict IP Address ke IP publik VPS Anda. Ini bukan cuma soal
   keamanan — kalau key Anda ke-scan bot lain / IP-nya berubah-ubah, request bisa
   ditolak Roblox tanpa pesan error yang jelas.
5. Catat API Key-nya (hanya tampil sekali).

---

## 3. Setup VPS Ubuntu 24 (dari nol)

### 3.1 Login & update sistem
```bash
ssh root@ALAMAT_IP_VPS_ANDA
apt update && apt upgrade -y
```

### 3.2 Install Node.js 20 LTS (via NodeSource)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # pastikan v20.x.x
npm -v
```

### 3.3 Buat user khusus (jangan jalankan bot sebagai root)
```bash
adduser botuser
usermod -aG sudo botuser
su - botuser
```

### 3.4 Upload project
Dari komputer lokal Anda (bukan di VPS), pakai `scp` atau `rsync`:
```bash
# dijalankan di LAPTOP/PC Anda, bukan di VPS
scp -r kokokrunch-eligible-bot botuser@ALAMAT_IP_VPS_ANDA:/home/botuser/
```
Atau kalau project ada di GitHub:
```bash
# dijalankan DI DALAM VPS
git clone <url-repo-anda> kokokrunch-eligible-bot
```

### 3.5 Install dependencies
```bash
cd ~/kokokrunch-eligible-bot
npm install
```

### 3.6 Konfigurasi environment
```bash
cp .env.example .env
nano .env
```
Isi semua variabel (`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `ROBLOX_API_KEY`, dst) sesuai
data yang sudah Anda siapkan. Simpan dengan `Ctrl+O`, `Enter`, keluar dengan `Ctrl+X`.

> ⚠️ **Jangan pernah** commit file `.env` ke Git / share ke publik — isinya token & API key.

### 3.7 Daftarkan slash command
```bash
node deploy-commands.js
```
Kalau Anda isi `DISCORD_GUILD_ID` di `.env`, command langsung muncul di server itu.
Kalau dikosongkan, command didaftarkan global (bisa butuh sampai ~1 jam untuk muncul).

### 3.8 Test jalan manual dulu (sebelum pakai PM2)
```bash
node index.js
```
Harus muncul log:
```
[Bot] Login berhasil sebagai NamaBot#1234
[Bot] Memantau komunitas Roblox group ID: 625247444
[Bot] Ambang batas eligible: 14 hari
```
Coba `/eligible username:namamu` di Discord. Kalau berhasil, tekan `Ctrl+C` lalu lanjut ke
langkah PM2 supaya bot jalan 24 jam.

---

## 4. Menjalankan Bot 24 Jam dengan PM2

PM2 = process manager yang otomatis restart bot kalau crash, dan bot tetap jalan meski Anda
logout dari SSH.

### 4.1 Install PM2 (global)
```bash
sudo npm install -g pm2
```

### 4.2 Jalankan bot
```bash
cd ~/kokokrunch-eligible-bot
pm2 start ecosystem.config.js
```

### 4.3 Perintah PM2 yang berguna
```bash
pm2 status                          # cek status bot
pm2 logs kokokrunch-eligible-bot    # lihat log real-time
pm2 restart kokokrunch-eligible-bot # restart manual
pm2 stop kokokrunch-eligible-bot    # stop bot
```

### 4.4 Auto-start setelah VPS reboot
```bash
pm2 startup
# PM2 akan menampilkan 1 baris command sudo -> copy-paste & jalankan persis seperti itu
pm2 save
```

Setelah ini, kalau VPS Anda restart (misal karena maintenance provider), bot akan otomatis
jalan lagi tanpa Anda perlu login manual.

---

## 5. Update Bot di Kemudian Hari

```bash
cd ~/kokokrunch-eligible-bot
git pull                 # atau upload ulang file yang berubah via scp
npm install               # kalau ada dependency baru
node deploy-commands.js   # HANYA kalau Anda mengubah definisi slash command
pm2 restart kokokrunch-eligible-bot
```

---

## 6. Troubleshooting "API tidak terhubung" (masalah yang Anda sebutkan sebelumnya)

Ini daftar penyebab paling umum bot "lancar di VS Code tapi error di VPS", beserta cara
ceknya:

| Gejala | Kemungkinan Penyebab | Cara Cek / Solusi |
|---|---|---|
| Error `ENOTFOUND` / `ECONNREFUSED` ke apis.roblox.com | VPS tidak bisa resolve DNS / firewall keluar (egress) diblok provider | `curl -I https://apis.roblox.com` dari VPS. Kalau gagal, hubungi provider VPS soal egress filtering. |
| Response `401 Unauthorized` dari Roblox | API Key salah, atau di-restrict ke IP yang beda dari IP VPS | Cek ulang IP publik VPS: `curl ifconfig.me`, samakan dengan IP restriction di halaman credentials Roblox. |
| Response `403 Forbidden` | Scope API Key tidak mencakup `group:read` | Edit ulang API Key di create.roblox.com/credentials, tambahkan scope `group:read`. |
| Response `429 Too Many Requests` sesekali | Rate limit Roblox | Sudah ditangani otomatis oleh retry/backoff di `src/httpClient.js` — cek log, seharusnya retry berhasil di percobaan ke-2/3. |
| Timeout hanya di endpoint audit-log, endpoint lain normal | Instabilitas dikenal pada legacy audit-log endpoint (dilaporkan banyak developer lain juga) | Bot ini sudah didesain memakai Memberships API sebagai jalur utama, audit-log cuma fallback — seharusnya jarang kena masalah ini. |
| Bot online di Discord tapi command tidak muncul | Command belum didaftarkan / masih propagate | Jalankan ulang `node deploy-commands.js`, kalau daftar global tunggu ~1 jam. |
| `.env` tidak terbaca saat pakai PM2 | Working directory PM2 berbeda | Sudah diatur via `cwd: __dirname` di `ecosystem.config.js` — pastikan Anda menjalankan `pm2 start ecosystem.config.js` dari dalam folder project. |

Kalau Anda menemukan error spesifik yang tidak ada di tabel ini, jalankan `pm2 logs` dan
kirimkan pesan errornya — biasanya penyebabnya kelihatan jelas dari situ.

---

## 7. Struktur File

```
kokokrunch-eligible-bot/
├── index.js                 # entry point bot
├── deploy-commands.js        # script daftar slash command
├── ecosystem.config.js       # config PM2
├── .env.example               # template environment variables
├── package.json
└── src/
    ├── config.js             # load & validasi .env
    ├── httpClient.js         # axios + retry/backoff otomatis
    ├── roblox.js             # semua integrasi API Roblox
    ├── embeds.js             # tampilan embed (3 kondisi eligibility)
    └── commands/
        └── eligible.js       # logic command /eligible
```
