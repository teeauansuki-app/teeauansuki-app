# QR Ordering System for Shabu Buffet

# Technical Blueprint & System Flow

Version: 1.0

---

# 1. Project Objective

พัฒนาระบบสั่งอาหารผ่าน QR Code สำหรับร้านชาบูบุฟเฟต์

ระบบนี้มีหน้าที่เพียง

* เปิดโต๊ะ
* เลือกแพ็กเกจ
* ปริ้น QR Code
* ลูกค้าสแกนและสั่งอาหาร
* ส่งออเดอร์เข้าครัวผ่านเครื่องพิมพ์
* จัดการเมนูและรูปภาพผ่านหลังบ้าน

ไม่มีระบบ

* คิดเงิน
* สมาชิก
* พนักงาน
* สต็อกสินค้า
* บัญชี

---

# 2. System Overview

## Components

### 1. Admin Backoffice

ใช้จัดการ

* เมนู
* หมวดหมู่
* รูปภาพ
* แพ็กเกจ

---

### 2. Cashier Screen

ใช้สำหรับ

* เลือกโต๊ะ
* เลือกแพ็กเกจ
* ปริ้น QR จากเครื่อง SUNMI

---

### 3. Customer Ordering

ใช้สำหรับ

* ดูเมนู
* สั่งอาหาร

---

### 4. Kitchen Printing

ใช้สำหรับ

* รับออเดอร์
* ปริ้นใบอาหาร

---

# 3. Technology Stack

## Frontend

Next.js 16.2.7

React 19.2.6

React DOM 19.2.6

Tailwind CSS 4.x

pnpm 10.x

---

## Database

Supabase PostgreSQL

---

## Storage

Supabase Storage

ใช้เก็บ

* รูปอาหาร
* รูปหมวดหมู่
* รูปแบนเนอร์

---

## Hosting

Vercel

---

## Printer

Kitchen Printer

LAN Thermal Printer

รองรับ ESC/POS

---

## SUNMI

Android Wrapper

ใช้สำหรับ

* เปิดโต๊ะ
* ปริ้น QR

---

# 4. Architecture

Owner/Admin
|
v

Admin Backoffice

|
v

Supabase

|
|
+--------------------+
|                    |
v                    v

Customer Web      Cashier SUNMI

|
v

Order API

|
v

Print Queue

|
v

Kitchen Printer

---

# 5. Table Opening Flow

Step 1

พนักงานเลือกโต๊ะ

ตัวอย่าง

Table 1

Table 2

Table 3

...

Table 18

---

Step 2

เลือก Package

ตัวอย่าง

Standard

Premium

---

Step 3

สร้าง Session

Example

SESSION_001

---

Step 4

สร้าง QR URL

Example

https://order.domain.com/s/SESSION_001

---

Step 5

SUNMI ปริ้น QR

ข้อมูลบนสลิป

* โลโก้ร้าน
* โต๊ะ
* Package
* เวลาเปิดโต๊ะ
* QR Code

---

# 6. Customer Ordering Flow

ลูกค้าสแกน QR

↓

โหลด Session

↓

ตรวจสอบ Package

↓

โหลดเมนูที่ตรงกับ Package

↓

ลูกค้าเลือกอาหาร

↓

เพิ่มเข้าตะกร้า

↓

กดยืนยัน

↓

สร้าง Order

↓

สร้าง Order Items

↓

สร้าง Print Job

---

# 7. Menu Filtering Logic

เมนูทุกตัวต้องระบุ

package_type

ตัวอย่าง

Premium Beef

package_type = PREMIUM

---

Pork Set

package_type = STANDARD

---

เมื่อ Session เป็น STANDARD

ระบบแสดงเฉพาะ

STANDARD

---

เมื่อ Session เป็น PREMIUM

ระบบแสดงทั้งหมด

STANDARD + PREMIUM

---

# 8. Kitchen Printing Flow

เมื่อลูกค้ากดสั่ง

ระบบสร้าง Print Job

---

Print Service ตรวจ Queue

---

ส่งคำสั่งไป Printer

---

Printer พิมพ์ใบอาหาร

ตัวอย่าง

====================

TABLE 5

Premium

18:32

Wagyu Beef

Qty: 2

====================

---

# 9. Admin Backoffice

## Menu Management

สามารถ

* เพิ่มเมนู
* แก้ไขเมนู
* ลบเมนู

---

## Category Management

สามารถ

* เพิ่มหมวดหมู่
* แก้ไขหมวดหมู่
* ลบหมวดหมู่

---

## Image Management

สามารถ

* อัปโหลดรูป
* เปลี่ยนรูป
* ลบรูป

---

## Package Assignment

สามารถกำหนดได้ว่า

เมนูใดอยู่ใน

* Standard
* Premium

---

# 10. Database Tables

## packages

เก็บข้อมูลแพ็กเกจ

---

## tables

เก็บข้อมูลโต๊ะ

---

## sessions

เก็บ Session ของโต๊ะ

---

## categories

เก็บหมวดหมู่

---

## menu_items

เก็บรายการอาหาร

---

## orders

เก็บหัวออเดอร์

---

## order_items

เก็บรายการอาหารที่ลูกค้าสั่ง

---

## print_jobs

เก็บ Queue งานพิมพ์

---

# 11. Image Storage

รูปทั้งหมดเก็บบน

Supabase Storage

ตัวอย่าง

/menu/beef.jpg

/menu/pork.jpg

/category/drink.jpg

---

Database เก็บเฉพาะ URL

ตัวอย่าง

image_url

---

# 12. Deployment

## Vercel

รัน

* Admin
* Customer Ordering
* API

---

## Supabase

รัน

* PostgreSQL
* Storage
* Realtime

---

## SUNMI APK

รัน

* Cashier Screen
* QR Printing

---

## Kitchen Printer

รับคำสั่งพิมพ์ผ่าน LAN

---

# 13. Final Flow

เปิดโต๊ะ

↓

เลือก Package

↓

ปริ้น QR

↓

ลูกค้าสแกน

↓

สั่งอาหาร

↓

ระบบสร้าง Order

↓

ระบบสร้าง Print Job

↓

Printer ครัวพิมพ์

↓

ครัวเตรียมอาหาร

---

# Expected Result

✓ เปิดโต๊ะได้

✓ ปริ้น QR ได้

✓ ลูกค้าสแกนสั่งอาหารได้

✓ แยกเมนูตาม Package ได้

✓ ครัวได้รับออเดอร์อัตโนมัติ

✓ จัดการเมนูและรูปภาพผ่านหลังบ้านได้

✓ ใช้งานผ่านเว็บได้ทุกอุปกรณ์

✓ รองรับการขยายจาก 18 โต๊ะเป็น 28 โต๊ะในอนาคต
