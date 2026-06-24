# Kitchen Print Agent

ตัวนี้ใช้รันบนคอมที่ต่อเครื่องพิมพ์ครัว `POS-80C`

เมื่อลูกค้าสแกน QR แล้วกดยืนยันออเดอร์ ระบบเว็บจะสร้าง `print_jobs` เป็น `pending` จากนั้น agent นี้จะดึงคิวไปพิมพ์ผ่าน Windows printer driver และอัปเดตสถานะเป็น `printed`

## ตั้งค่า

agent อ่านค่า Supabase จากไฟล์ `.env.local` ของโปรเจกต์หลักได้เลย:

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

ถ้าต้องการตั้งค่าเฉพาะเครื่องครัว ให้สร้างไฟล์ `kitchen-print-agent/.env`:

```env
KITCHEN_PRINTER_NAME=POS-80C
KITCHEN_PRINT_POLL_MS=3000
KITCHEN_PRINT_BATCH_SIZE=1
KITCHEN_RESTAURANT_NAME=ตี๋อ้วน สุกี้ชาบู
```

ห้ามนำ `SUPABASE_SERVICE_ROLE_KEY` ไปใส่ในโค้ดฝั่ง browser หรือไฟล์ที่ commit ขึ้น public repository

## ทดสอบพิมพ์

ถ้าต้องการดูชื่อ printer ที่ Windows เห็นจริงๆ:

```powershell
npm run kitchen:list-printers
```

```powershell
npm run kitchen:test-print
```

ถ้าเครื่องพิมพ์ออกใบข้อความทดสอบ แปลว่า Windows driver พร้อมใช้งาน

## รัน agent

```powershell
npm run kitchen:print-agent
```

ต้องเปิดคำสั่งนี้ค้างไว้บนคอมที่เสียบ `POS-80C` ถ้าปิด agent ออเดอร์จะยังเข้าระบบ แต่จะไม่พิมพ์ออกจนกว่า agent กลับมาทำงาน

## การทำงาน

- ดึง `print_jobs` ที่มีสถานะ `pending`
- จัดรูปแบบใบครัวเป็นข้อความ
- ส่งพิมพ์ผ่าน `Out-Printer -Name "Printer POS-80"`
- พิมพ์สำเร็จ: เปลี่ยนสถานะเป็น `printed`
- พิมพ์ไม่สำเร็จ: เปลี่ยนสถานะเป็น `failed` พร้อมข้อความ error

## พิมพ์คิวที่เคย failed ใหม่

หลังแก้ printer แล้ว ถ้าต้องการให้คิวที่ failed กลับไปพิมพ์ใหม่:

```powershell
npm run kitchen:retry-failed
```

จากนั้นเปิด agent:

```powershell
npm run kitchen:print-agent
```
