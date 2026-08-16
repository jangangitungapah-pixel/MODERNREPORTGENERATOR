# PRD — ReportOS Master UI/UX Overhaul

**Document ID:** REPORTOS-UI-PRD-001  
**Version:** 1.0  
**Status:** Approved source of truth for UI/UX overhaul  
**Product:** ReportOS — Incident Operations Platform  
**Repository:** `jangangitungapah-pixel/MODERNREPORTGENERATOR`  
**Primary environment:** Desktop web + responsive mobile web  
**Default theme:** Light  
**Implementation principle:** UI/UX may be radically improved, but existing production business logic, canonical data model, API contracts, persistence, Firebase identity, Cloudflare Worker runtime, D1 canonical storage, recovery behavior, parser behavior, and incident lifecycle must not be casually changed by visual work.

---

# 1. Purpose

Dokumen ini adalah **source of truth utama untuk seluruh desain UI dan UX ReportOS**. Semua overhaul visual setelah dokumen ini harus merujuk ke aturan, ukuran, hierarki, pola interaksi, responsive behavior, accessibility, density, dan acceptance criteria di sini.

PRD ini sengaja dibuat jauh lebih preskriptif daripada style guide biasa. Tujuannya adalah menghilangkan inkonsistensi antar halaman dan mencegah pola kerja “setiap halaman punya bahasa desain sendiri”.

ReportOS harus terasa sebagai satu produk operasi jaringan yang matang, bukan kumpulan tool yang kebetulan memakai warna ungu yang sama.

Target utama:

1. Membuat ReportOS terasa **ultra-modern, premium, profesional, dan operasional**.
2. Memperbesar typography secara nyata agar aplikasi nyaman dipakai selama shift panjang.
3. Mengurangi whitespace yang tidak memberikan fungsi.
4. Menjaga density tinggi tanpa membuat interface sesak.
5. Menghasilkan hierarchy visual yang mudah dipindai dalam waktu beberapa detik.
6. Menyatukan Composer, Operations, Archive, Impact Board, Fiber Lab, System Console, identity, recovery, intelligence, dan canonical sync ke dalam satu design language.
7. Menjamin responsive behavior yang benar-benar dirancang untuk desktop dan mobile, bukan sekadar mengecilkan desktop.
8. Memastikan semua perubahan visual tetap aman terhadap production business logic yang sudah berjalan.

---

# 2. Current Product Surface Inventory

PRD ini mencakup seluruh surface UI production yang saat ini terdapat di repository.

## 2.1 Main Incident Workspace

Current implementation utama berada pada:

- `app/page.tsx`
- `components/report-workspace.tsx`
- `app/globals.css`
- `app/ui-overhaul.css`
- `app/ui-overhaul-detail.css`
- `app/ui-navbar-premium.css`
- `app/ui-composer-ultra-premium.css`

Workspace utama memiliki mode:

- Composer
- Operations
- Archive / Incident Vault

## 2.2 Backbone Impact Board

Route:

- `/backbone-impact`

Implementation:

- `app/backbone-impact/page.tsx`
- `components/backbone-impact-board.tsx`

Fungsi utama:

- Backbone/B2B impact identity
- Customer/tenant impact list
- Nested service/circuit impact
- Operational status selector
- Live WAG template preview
- Copy template
- Local autosave

## 2.3 Fiber Lab / SOR to PDF

Route:

- `/sor-to-pdf`

Implementation utama:

- `app/sor-to-pdf/page.tsx`
- `components/sor-pdf-converter.tsx`
- `components/sor-analysis-panel.tsx`

Fungsi utama:

- Upload/drop `.SOR`
- Local parsing
- OTDR metadata inspection
- Trace visualization
- Event inspection
- Engineering analysis
- PDF export

## 2.4 System Console

Route:

- `/system`

Implementation:

- `app/system/page.tsx`
- `app/system/system-console.tsx`
- `app/system/system.module.css`

Fungsi utama:

- Identity status
- Workspace role
- Canonical revision
- Recovery history
- Audit trail
- Governance status
- Recovery restore confirmation

## 2.5 Global Runtime Utilities

Global UI components:

- `components/reportos-system-link.tsx`
- `components/reportos-identity.tsx`
- `components/reportos-intelligence.tsx`
- `components/reportos-canonical-sync.tsx`
- `components/firebase-cloud-recovery.tsx`
- `components/firebase-destructive-guard.tsx`
- `components/reportos-client-runtime.tsx`

Utilities ini saat ini muncul sebagai trigger/status/floating surface dan wajib diperlakukan sebagai bagian dari app shell, bukan elemen tempelan.

## 2.6 Error and System States

Surface tambahan:

- `app/error.tsx`
- `app/not-found.tsx`
- loading states di System Console
- canonical sync states
- Firestore recovery states
- identity modal states
- parser errors
- upload errors
- empty lists
- destructive confirmations

Semua state di atas termasuk scope PRD.

---

# 3. Product UI Vision

ReportOS harus terasa seperti kombinasi:

- premium operational cockpit,
- modern enterprise productivity tool,
- fast incident composer,
- dense information workspace,
- calm but high-confidence control plane.

Interface **tidak boleh terasa seperti landing page SaaS** ketika operator sedang bekerja. Hero visual boleh digunakan untuk orientation dan identity, tetapi setelah konteks sudah jelas, informasi operasional harus mengambil prioritas.

## 3.1 Keywords

Design keywords:

- precise
- calm
- premium
- dense
- readable
- structured
- confident
- operational
- contemporary
- responsive
- low-friction

## 3.2 What ReportOS Must Not Feel Like

ReportOS tidak boleh terasa:

- terlalu kosong,
- terlalu pucat,
- terlalu kecil,
- seperti dashboard demo,
- seperti landing page marketing,
- seperti spreadsheet mentah,
- seperti admin template generic,
- seperti UI glassmorphism yang mengorbankan readability,
- seperti kumpulan card tanpa hierarchy,
- seperti mobile desktop shrink.

---

# 4. Non-Negotiable Design Principles

## 4.1 Readability First

Tidak boleh ada text penting yang memerlukan zoom browser untuk dibaca.

Hard rule:

- **Tidak ada functional text di bawah 11px pada desktop.**
- **Tidak ada body/help text di bawah 12px pada desktop.**
- **Tidak ada form input text di bawah 14px desktop.**
- **Mobile input text minimal 16px.**
- Eyebrow/metadata boleh 11px hanya jika uppercase, high contrast, dan bukan informasi utama.

Existing 6–10px micro typography harus dianggap technical debt dan dihapus bertahap.

## 4.2 Dense, Not Cramped

Density ditingkatkan melalui:

- hierarchy,
- grid,
- grouping,
- compact metadata,
- adaptive columns,
- progressive disclosure,

bukan dengan mengecilkan font.

## 4.3 Every Pixel Has a Job

Whitespace harus membantu salah satu dari:

- hierarchy,
- grouping,
- scanability,
- touch target,
- breathing room di antara task group.

Whitespace besar yang hanya menghasilkan layar kosong harus dihilangkan.

## 4.4 Alignment Is Structural

Setiap halaman harus memiliki predictable alignment.

Yang harus sejajar:

- page header left edge,
- major card left/right edge,
- form labels,
- input grids,
- KPI cards,
- table/list columns,
- sticky right rail,
- action bars,
- status surfaces.

Tidak boleh ada elemen 2–5px “lari” tanpa alasan visual.

## 4.5 Surface Hierarchy Must Be Obvious

Tingkatan surface:

1. App background
2. Navigation shell
3. Major page panel
4. Section/card
5. Nested editor
6. Input / row / control
7. transient overlay

Border, shadow, tint, dan radius harus menunjukkan hierarchy ini.

## 4.6 Operational State Beats Decoration

Status harus selalu lebih mudah terlihat dibanding ornamen.

Contoh:

- DOWN harus lebih terlihat dari shadow card.
- SERVER CONNECTING harus lebih jelas daripada decorative glow.
- REVISION CONFLICT harus lebih jelas daripada background gradient.
- parser error harus langsung mengarahkan user ke tindakan.

## 4.7 One Page, One Primary Task

Composer → membuat dan memfinalisasi incident report.  
Operations → memonitor dan memperbarui active incident.  
Archive → mencari dan mengelola memory incident.  
Impact Board → menyusun customer impact list.  
Fiber Lab → membaca SOR dan membuat engineering PDF.  
System Console → audit, recovery, governance.

Secondary actions tidak boleh mengalahkan primary task.

---

# 5. Global Design Tokens

Seluruh overhaul baru harus bergerak menuju token yang reusable, walaupun implementasi saat ini masih tersebar di beberapa stylesheet.

## 5.1 Color Foundation — Light Theme

Recommended semantic palette:

### Neutral / Ink

- `--ui-ink-950: #202536`
- `--ui-ink-900: #282e41`
- `--ui-ink-800: #394156`
- `--ui-ink-700: #50596f`
- `--ui-ink-600: #687287`
- `--ui-ink-500: #7e889c`
- `--ui-ink-400: #98a1b1`
- `--ui-ink-300: #b4bbc7`

### Surface

- App background: `#F5F7FC` base with subtle blue/violet ambient tint.
- Primary panel: white 92–98% opacity.
- Secondary panel: white 78–90% opacity.
- Nested editor: neutral `#F8F9FC` / `#FAFBFD`.
- Disabled surface: `#F2F3F7`.

### Brand Violet

- primary: `#6754EA`
- strong: `#5740D9`
- hover: `#5E49E0`
- soft: `rgba(103,84,234,.08)`
- border: `rgba(103,84,234,.16)`

### Operational Green

- primary: `#239E72`
- strong: `#147956`
- soft: `rgba(35,158,114,.09)`

### Operational Amber

- primary: `#C7862E`
- strong: `#996316`
- soft: `rgba(199,134,46,.10)`

### Operational Red

- primary: `#C95151`
- strong: `#9E3636`
- soft: `rgba(201,81,81,.09)`

### Operational Blue

- primary: `#4387E5`
- soft: `rgba(67,135,229,.09)`

## 5.2 Contrast

Text penting harus memenuhi WCAG AA target minimum.

Dilarang:

- light gray 8px pada white background,
- opacity text di bawah ~0.55 untuk information-bearing copy,
- status hanya dibedakan dengan warna.

Status harus menggunakan kombinasi:

- color,
- icon/symbol,
- label,
- optional tone surface.

---

# 6. Typography System

Typography adalah prioritas terbesar overhaul.

## 6.1 Desktop Type Scale

### Display / Page

- Page title: `36–44px`, weight 740–800, line-height 0.98–1.08.
- Major hero title: `32–42px`.
- Tool standalone hero title: `36–48px`, maksimum 2–3 line.

### Section

- H2: `24–30px`.
- H3: `18–22px`.
- Card title: `16–18px`.
- Row title: `14–16px`.

### Body

- Primary body: `14–15px`, line-height 1.5–1.6.
- Secondary body: `13px`.
- Helper body: `12px`.

### Controls

- Input: `14px` minimum desktop.
- Textarea: `14px` minimum desktop.
- Button: `13px` normal, 12px compact.
- Nav primary: `14px`.
- Nav secondary: `12px`.
- Field label: `12px`.
- Metric label: `11–12px` uppercase.
- Chip: `11–12px`.
- Eyebrow: `11px`, uppercase, tracking 0.08–0.14em.

### Monospace / Operational Output

- Preview report: `12.5–13px` desktop.
- System IDs/checksum: `12px` minimum.

## 6.2 Mobile Type Scale

- Page title: 28–34px.
- Section title: 18–22px.
- Body: 14–16px.
- Input: **16px**.
- Button: 14px.
- Nav label: 11–12px.
- Helper: 12px minimum.

## 6.3 Typography Hard Ban

Tidak diperbolehkan pada final implementation:

- 5px
- 6px
- 7px
- 8px
- 9px untuk user-facing functional information
- 10px untuk paragraph/helper

11px hanya untuk eyebrow, micro badge, atau secondary metadata yang tidak critical.

---

# 7. Spacing and Density System

Gunakan base spacing 4px.

Recommended scale:

- 4
- 8
- 12
- 16
- 20
- 24
- 32
- 40
- 48
- 64

## 7.1 Page Rhythm

Desktop:

- sidebar to content gap: 20–28px
- main page top padding: 24–32px
- section vertical gap: 16–24px
- panel internal padding: 20–28px
- nested card padding: 14–18px
- field gap: 12–16px

Mobile:

- viewport side padding: 14–16px
- section gap: 12–16px
- panel padding: 16–18px

## 7.2 Density Rules

- Jangan memperbesar card hanya untuk terlihat premium.
- Premium berasal dari typography, hierarchy, border/shadow quality, bukan tinggi kosong.
- KPI card harus setinggi kontennya + ergonomic padding, bukan fixed height berlebihan.
- Archive dengan satu incident harus memanfaatkan width dengan baik.
- Operations queue harus memperlihatkan sebanyak mungkin incident tanpa mengecilkan text.

---

# 8. Radius, Borders, Shadows, Glass

## 8.1 Radius

- App shell/sidebar: 24–28px
- Major hero: 22–26px
- Major section: 20–24px
- Nested editor: 14–16px
- Input: 10–12px
- Button: 10–13px
- Chip: pill or 9–12px depending semantic role

## 8.2 Border

Normal border:

- 1px
- neutral opacity 8–13%

Focused/selected:

- semantic/brand opacity 20–32%

## 8.3 Shadow

Shadow harus subtle, lebar, dan tidak muddy.

No default black 30% shadow.

Suggested levels:

- Level 1: `0 8px 24px rgba(45,52,82,.045)`
- Level 2: `0 18px 48px rgba(45,52,82,.075)`
- Level 3 overlay: `0 28px 80px rgba(35,42,69,.14)`

## 8.4 Glassmorphism

Glass hanya boleh digunakan jika readability tidak turun.

Allowed:

- sidebar,
- top utility,
- modal/drawer,
- hero surface,
- floating status.

Tidak perlu memakai blur pada setiap nested card.

---

# 9. Responsive Breakpoints

Reference breakpoints:

- `>= 1600`: wide desktop
- `1280–1599`: standard desktop/laptop
- `1024–1279`: compact desktop
- `768–1023`: tablet
- `480–767`: mobile
- `<480`: compact mobile

Breakpoints bukan hanya CSS width change. Masing-masing boleh mengubah information architecture.

---

# 10. Global App Shell

## 10.1 Desktop Sidebar

Current navigation items:

- Composer
- Operations
- Archive
- Impact Board
- SOR → PDF

### Target

Sidebar harus menjadi premium command navigation yang tenang.

Recommended geometry standard desktop:

- width visual: 228–244px
- viewport offset: 16–20px
- top/bottom gap: 16–20px
- radius: 24–28px
- internal padding: 12–16px

### Brand Lockup

- Mark: 42–46px.
- “ReportOS”: 16–18px.
- subtitle `OPS INTELLIGENCE`: 11px.
- Brand area dipisahkan secara halus dari nav, bukan heavy divider.

### Nav Item

- min height: 56–62px.
- icon target area: 34–38px.
- label: 14px.
- helper: 11.5–12px.
- active state wajib memiliki minimal 3 cues:
  - surface tint,
  - icon treatment,
  - label color/weight.
- optional left rail hanya sebagai secondary cue.

### Hover

- 120–180ms.
- tidak boleh translate besar.
- no dramatic scale.

### Sidebar Footer

Current “Draft vault active” harus menjadi quiet persistent status.

- tidak lebih dominan dari navigation.
- minimum 12px readable label.
- status dot + label + compact explanation.

## 10.2 Compact Desktop Sidebar

Pada 1024–1279:

- collapse ke icon rail 72–84px.
- tooltip wajib tersedia.
- active cue tetap jelas.
- jangan menampilkan truncated text.

## 10.3 Mobile Navigation

Sidebar desktop tidak ditampilkan.

Target mobile:

- bottom navigation 4 primary destinations:
  - Composer
  - Operations
  - Archive
  - More
- More membuka bottom sheet untuk:
  - Impact Board
  - Fiber Lab
  - System status/actions

Bottom navigation:

- 64–72px total height termasuk safe-area.
- touch target minimal 44x44.
- active state sangat jelas.
- label 11–12px.

---

# 11. Global Topbar

Main modes Composer/Operations/Archive harus berbagi struktur topbar yang sama.

Left:

- eyebrow/context
- page title
- optional active incident context

Right:

- New draft
- local save state

Rules:

- Tidak boleh lebih tinggi dari konten yang diperlukan.
- Title align ke main content grid.
- Save state harus readable tetapi tidak seperti CTA.
- New Draft merupakan primary utility CTA, bukan hero CTA.

Mobile:

- title boleh 2 line.
- action dapat pindah ke row kedua.
- “Saved” boleh menjadi compact icon + label.

---

# 12. Global Utility / Status Dock

Current floating utilities:

- System Console
- Secure workspace
- Intelligence
- Cloud recovery
- Canonical sync / Server synced / connecting

Current pattern floating stack rawan overlap dan visual noise.

## 12.1 Target Desktop Pattern

Gunakan **single Utility Dock** bottom-right.

Dock terdiri dari:

1. canonical sync status — always visible
2. compact utility trigger group

Utility trigger group:

- System
- Identity
- Intelligence
- Recovery

Geometry:

- right: 18–24px
- bottom: 18–24px
- tidak overlap content action penting
- status toast bisa naik di atas dock, tidak menindih button

Recommended trigger:

- 38–42px height
- 12px label
- icon 14–16px

## 12.2 Mobile

Tidak boleh ada empat floating buttons.

Gunakan satu “System status” trigger.

Tap membuka bottom sheet berisi:

- canonical status
- identity
- recovery
- intelligence
- system console link

## 12.3 Sync States

States:

- connecting
- synced
- saving
- offline
- conflict
- error

Conflict/error harus lebih dominant dan persistent dibanding synced.

“SERVER SYNCED” boleh auto-collapse ke compact indicator setelah beberapa detik.

---

# 13. Composer — Product Goal

Composer adalah halaman terpenting ReportOS.

Primary goal:

> Operator harus dapat mengubah bagan/raw incident menjadi report terstruktur, memperbarui progress, memonitor completeness, dan menyiapkan closure tanpa kehilangan konteks atau berpindah tool.

Composer tidak boleh terasa seperti form panjang generic. Ia harus terasa seperti **incident assembly workspace**.

---

# 14. Composer — Desktop Information Architecture

Standard desktop menggunakan 2-column layout:

### Left column

- Smart Ingest
- Active Draft Hero
- Incident Identity
- Dispatch Context
- Link Impact Topology
- Cut Point Topology
- Update Progress
- Timeline Intelligence
- Closure Readiness

### Right sticky rail

- Report Preview
- Completion/updates/storage metrics
- Copy formatted report
- Delivery Console
- Fast Operator Flow

Recommended ratio:

- left: 58–62%
- right: 38–42%

Gap: 20–24px.

Right rail sticky tetapi tidak memaksa overflow/height aneh.

---

# 15. Composer — Smart Ingest

Current concept:

- `SMART INGEST`
- “Paste. Parse. Done.”
- raw payload textarea
- Read clipboard
- Smart Parse & Apply

## Target UI

Smart Ingest harus menjadi compact premium tool surface, bukan hero marketing.

Header:

- icon 38–42px
- kicker 11px
- title 18–20px
- help 12–13px
- parser badge 11px

Textarea:

- min 120px desktop
- monospace optional if readability bagus
- text 14px
- raw character count di top-right
- focus state brand violet

Actions:

- Read Clipboard secondary
- Smart Parse & Apply primary

Disabled primary:

- visually disabled jelas
- tetap readable

Feedback:

- parse success
- parse partial
- parse failed

Feedback harus muncul dekat input, bukan global toast saja.

---

# 16. Composer — Active Draft Hero

Hero menampilkan:

- LIVE INCIDENT / DRAFT
- incident region/title
- summary
- readiness score

Target:

- tinggi ideal 130–160px, jangan oversized.
- title 28–34px.
- summary 13–14px.
- readiness ring 82–96px.
- readiness tidak boleh lebih dominant dari incident title.

Empty title:

- “Untitled incident” tetap terlihat deliberate, bukan error.

---

# 17. Composer — Section Card Pattern

Semua section form harus berbagi pattern:

Header:

- icon
- numeric index
- title
- one-line helper
- optional contextual action / summary badge

Body:

- clear grid
- 14px inputs
- 12px labels
- 12px helper

Card:

- 20–24px padding
- 20–24px radius
- border 1px subtle

Section header tidak boleh memiliki helper text 8–9px.

---

# 18. Composer — Incident Identity

Fields:

- Region
- Trouble ticket
- Alarm / link summary

Desktop:

- Region + Ticket dalam 2 columns.
- Summary full width.

Required behavior:

- long ticket harus tidak truncate saat input.
- placeholder memiliki contrast cukup.
- summary textarea min 88–100px.

Future optional validation cues boleh ditambahkan, tetapi PRD UI tidak boleh mengubah parser/business rules.

---

# 19. Composer — Dispatch Context

Core fields:

- Occur time
- Dispatch time
- PIC

Topology groups:

- Link impact topology
- Cut point topology

## 19.1 Time Fields

- format hint terlihat dekat label.
- hint 11–12px.
- desktop input 44–48px.

## 19.2 PIC

Full row jika space memungkinkan.

## 19.3 Topology Summary

Header boleh menunjukkan:

- X impact
- Y CP

Badge harus readable 11px.

---

# 20. Composer — Link Impact Topology

Primary incident block:

- main incident identity
- marker selector
- status tag
- link/alarm readonly summary

Additional impact links:

- Region optional
- Status tag optional
- Impact headline/link
- Impact trouble ticket optional
- marker
- delete

Rules:

- nested card tidak boleh terlalu tipis atau terlalu pucat.
- destructive delete icon harus punya hover/focus red semantic.
- marker status harus readable tanpa hanya mengandalkan emoji.
- Add Impact Link harus jelas tetapi secondary.

Empty state:

- compact,
- icon + title + one sentence,
- tidak lebih tinggi dari ~90px.

---

# 21. Composer — Cut Point Topology

Modes:

- legacy single CP
- structured multi CP

UI harus membuat perbedaan mode jelas tetapi tidak membingungkan user.

Single mode:

- small contextual notice
- Cut Point
- Rootcause
- “Add CP” upgrade action

Structured CP card:

- CP label
- marker
- rootcause
- cut point location
- delete

CP card harus memakai visual accent amber/orange yang subtle untuk membedakan dari impact link blue/violet.

---

# 22. Composer — Update Progress

Update Progress harus menjadi bagian yang sangat cepat digunakan.

Prioritas:

1. timestamp
2. progress text
3. Add update
4. macro/assistant
5. timeline

## 22.1 Progress Entry

Desktop:

- date compact
- time compact
- update text flexible width
- Add Update clear CTA

Input text 14px.

## 22.2 Macros

Macros harus compact chips, bukan toolbar besar.

- readable 11–12px
- icon optional
- keyboard friendly

## 22.3 Timeline Intelligence

Controls:

- sort/order
- duplicate insight
- chronology status

Harus berada pada utility row, tidak lebih dominant dari timeline content.

## 22.4 Timeline Empty State

Jangan gunakan panel kosong terlalu tinggi.

Target 100–140px.

---

# 23. Composer — Closure Readiness

Current closure tasks mencakup:

- Statement Up WAG
- Matoa Clearance
- Status TT
- Event and Photo
- RFO
- Sent Closed Email

UI goal:

- progress status mudah scan
- parent/sub-task hierarchy jelas
- completed vs pending recognizable

Recommended layout:

- closure score card top-left
- task rows 44–54px
- sub-task grouped under Matoa Clearance

Status label:

- Pending
- In Progress
- Complete

Jangan gunakan 8px chips.

---

# 24. Composer — Report Preview

Preview adalah output monitor, bukan sekadar textarea preview.

Must-have hierarchy:

Header:

- OUTPUT MONITOR eyebrow
- Report preview title
- LIVE state

Window:

- browser/code-like header optional
- formatted report output
- monospace 12.5–13px
- line-height 1.55–1.65

Footer metrics:

- completion
- updates
- storage

CTA:

- Copy formatted report

Preview harus tetap readable pada 1366px desktop.

---

# 25. Composer — Delivery Console

Primary purpose:

- validate readiness
- guide closure delivery

Visual hierarchy:

1. status/readiness
2. validation issue
3. actionable closure output
4. disabled actions with reason

Validation warning harus menggunakan semantic amber dan memiliki action-oriented copy.

Disabled action tidak boleh terlalu faded sampai tidak terbaca.

---

# 26. Composer — Mobile UX

Mobile bukan dua column.

Gunakan pane switch:

- Composer
- Preview

Recommended behavior:

- sticky top compact header
- pane switch directly below header
- one column cards
- form fields full width
- minimum input 48px height
- input font 16px
- Add Update sticky/local CTA bila keyboard tidak aktif

Topology nested editor:

- status selector horizontal scroll bila perlu
- destructive action tetap visible
- no horizontal page overflow

Closure:

- checkbox/task row minimum 48px

Preview:

- output scroll vertical
- copy CTA sticky bottom inside pane if appropriate

---

# 27. Operations — Product Goal

Operations adalah live command center.

Primary goal:

> Dalam satu glance, operator harus tahu incident mana yang running, mana yang butuh update, mana yang closure pending, dan dapat menambahkan progress tanpa kembali ke Composer.

---

# 28. Operations — Hero and KPI

Hero:

- OPERATIONAL PULSE
- Live incident command center
- explanation
- live workspace status
- active record count

Hero tidak boleh menghabiskan terlalu banyak vertical space.

Target desktop height:

- 170–210px maximum.

KPI:

- Running TT
- Restored
- Need Attention
- Avg Running Age

KPI card:

- value 24–30px
- label 11–12px
- supporting text 12px
- icon 36–42px

---

# 29. Operations — Operational Queue

Queue adalah primary surface.

Header:

- title
- helper
- view switch Columns/List
- freshness state

Incident row needs:

- status rail
- status chip
- attention/closure chip
- ticket
- summary
- region/PIC
- age
- freshness
- update count
- last signal
- quick update
- open

## 29.1 Desktop Row

Target row height 108–140px tergantung content.

Text:

- ticket 15–16px
- summary 13px
- metadata 11.5–12px
- metric label 11px
- metric value 13–14px

## 29.2 Attention Hierarchy

Critical freshness:

- red/orange rail + chip

Update due:

- amber

Healthy:

- neutral/green

Closure pending:

- distinct violet/amber semantic, jangan sama dengan stale update.

## 29.3 Quick Update

Inline expandable panel.

Must not shift entire page unpredictably.

Contains:

- suggested macros
- custom update input
- Add now
- close

Keyboard Enter supported.

---

# 30. Operations — Mobile

No multi-column metrics inside incident row.

Mobile incident card order:

1. status + attention
2. ticket
3. summary
4. region/PIC
5. age/freshness/updates compact metric strip
6. last signal
7. Quick Update + Open

Buttons full-width or 2-up minimum 44px.

---

# 31. Archive / Incident Vault — Product Goal

Archive adalah operational memory, bukan “trash folder”.

Primary tasks:

- search
- identify current incident
- open
- archive/restore
- delete safely
- create blank draft

---

# 32. Archive — Hero

Content:

- INCIDENT MEMORY
- Every TT, one operational memory.
- helper
- Total / Active / Archived

Target hero:

- compact 150–190px desktop.
- stats integrated right.

Avoid giant empty decorative hero.

---

# 33. Archive — Search and Actions

Search row:

- search input grows
- New blank draft right

Search supports current domains:

- TT
- region
- PIC
- rootcause
- progress

Search input desktop min 48px.

Mobile:

- input full width
- New draft button below or compact trailing action

---

# 34. Archive — Incident Card/Grid

Grid must be adaptive.

Rules:

- 1 incident → may use full available width or max-width ~900px; never awkward half-page orphan.
- 2+ incident → responsive auto-fit.
- min card width desktop ~420–520px.

Card information:

- lifecycle/status
- current indicator
- region
- ticket/title
- summary
- readiness
- update count
- PIC
- updated time
- Delete
- Archive/Restore
- Open/Return to composer

Card title 16–18px.

Primary action = Open/Return.

Delete visually separated from normal actions.

---

# 35. Archive — Destructive UX

Delete incident must never be one accidental click.

Expected flow:

1. user clicks Delete
2. guard/confirm explains impact
3. optional recovery snapshot indication
4. confirm destructive action
5. feedback successful

Keyboard focus must be trapped inside modal/drawer.

---

# 36. Backbone Impact Board — Product Goal

Primary goal:

> Build WAG-ready backbone/B2B impact lists quickly while supporting both simple customers and customers with multiple services/circuits.

This is a standalone tool but still part of ReportOS visual family.

---

# 37. Impact Board — Standalone Shell

Topbar:

- back to ReportOS
- centered/clear tool identity
- Local autosave status

Desktop content max-width:

- 1280–1440px

Standalone tool must not mimic main sidebar unnecessarily.

Hero:

- clear purpose
- 36–44px title
- 14px body
- small feature badges
- decorative network visual secondary

---

# 38. Impact Board — Summary Metrics

Metrics:

- Impact Leaf
- Down
- Warning
- Pending
- Up/Clear

Card target:

- value 26–30px
- label 11–12px
- status semantic color

No 6–8px metric labels.

---

# 39. Impact Board — Editor

Main layout desktop:

Left ~65–70%:

- Backbone Identity
- Customer/Tenant list

Right ~30–35%:

- live WAG preview
- draft controls
- status guide

Customer card:

- index
- name
- delete
- status selector
- note
- nested services if any

Status selector target minimum 38px height.

Nested service row:

- service/circuit name
- compact status controls
- note
- delete

Add Customer and Add Service harus secondary but obvious.

---

# 40. Impact Board — Live Preview

Preview harus terasa seperti operational message output.

- monospace 12.5–13px
- numbered structure preserved
- copy action primary violet
- live indicator green

Right rail sticky desktop.

Mobile:

- editor/preview segmented panes atau stacked with preview collapsible.

---

# 41. Fiber Lab / SOR to PDF — Product Goal

Primary goal:

> Convert OTDR Standard Record file menjadi engineering-readable PDF sambil mempertahankan meaning dari trace, metadata, event, dan analysis.

Tool harus terasa seperti engineering instrument yang modern, bukan upload demo.

---

# 42. Fiber Lab — Idle State

Topbar:

- Back ReportOS
- Fiber Lab identity
- Local processing status

Hero:

- OTDR / SOR CONVERTER
- “SOR to PDF with the trace still meaningful.”
- explanatory copy
- capabilities badges
- restrained trace visual

Upload dropzone immediately below hero.

Dropzone:

- min height 90–120px desktop
- file icon
- strong instruction 14–15px
- helper 12px
- MAX 64 MB metadata
- drag active state obvious

---

# 43. Fiber Lab — Parsing State

During parsing:

- disable duplicate upload
- show progress/working state
- text “Parsing locally” / equivalent
- no fake percentage if actual progress unavailable

The user must always understand file remains local.

---

# 44. Fiber Lab — Error State

Errors:

- wrong extension
- file too large
- parser failure

Error panel:

- red semantic but calm
- readable explanation
- clear Retry/Choose another file

Do not rely on raw exception message alone.

---

# 45. Fiber Lab — Ready State

Recommended hierarchy:

1. file identity + export CTA
2. summary metrics
3. trace graph
4. metadata
5. event table
6. analysis panel
7. engineering appendix/export details

Trace graph harus mendapatkan width priority.

Graph:

- axis/readability
- event marker
- tooltip if implemented
- responsive horizontal behavior

Event table:

- text 12–13px
- sticky header if long
- mobile horizontal contained scroll, never entire page overflow

Primary CTA:

- Generate/Download PDF

---

# 46. System Console — Product Goal

System Console adalah control plane admin/diagnostic.

It should feel more technical than Composer but remain readable.

Primary information:

- authenticated identity
- workspace role
- canonical revision
- recovery points
- recovery history
- audit trail
- governance status

---

# 47. System Console — Layout

Desktop:

- max-width 1280–1360px
- clear topbar/back link
- intro header
- 4 summary cards
- 2-column Recovery/Audit
- full-width Governance

Summary cards:

- label 11px
- value 24–30px where numeric
- detail 12px

Recovery row:

- reason 13–14px
- timestamp/size 12px
- Restore button 12–13px

Audit row:

- action 13–14px
- actor/time 12px

Checksum and UID must wrap or use copyable monospace, never tiny font.

---

# 48. System Console — Restore Confirmation

Restore is high-risk.

Confirmation surface must communicate:

- selected snapshot
- created time
- reason
- what will happen
- current state will be safety-snapshotted first

Buttons:

- Cancel
- Restore snapshot

Restore must never use generic “OK”.

---

# 49. Identity / Secure Workspace UX

Anonymous identity trigger should communicate purpose, not technical jargon.

Trigger:

- “Secure workspace”

Dialog:

- current identity explanation
- Link this workspace
- Sign in to existing Google identity
- Not now

UID should not dominate initial copy.

Technical UID placed in secondary information block with copy affordance future-ready.

Buttons minimum 44px.

Mobile dialog becomes bottom sheet/full-height sheet.

---

# 50. Intelligence UI

Intelligence must not compete with incident content.

Collapsed trigger:

- Intelligence
- finding count

Open surface:

- grouped finding severity
- missing required data
- contradiction
- closure warning
- pending work
- generated RFO/handover tools where available

Severity levels:

- Critical
- Warning
- Advisory
- Complete/Healthy

Each finding should explain:

- what
- why
- recommended next action

Avoid AI-like vague prose; product intelligence is deterministic.

---

# 51. Recovery UI

Cloud/Firestore recovery UI harus terasa sebagai safety feature.

Collapsed state:

- Cloud protected / recovery state

Drawer:

- status
- last snapshot
- snapshot list
- restore action
- errors

Desktop drawer width 460–520px.

Mobile full-width bottom/full-height sheet.

No 5–9px recovery text.

---

# 52. Canonical Sync / Conflict UX

States should be standardized.

## Synced

- green
- quiet
- auto-collapse allowed

## Connecting

- amber/neutral
- “Resolving authenticated canonical state” readable

## Saving

- neutral/violet

## Offline

- amber
- explain local safety cache continues

## Conflict

- high priority
- explanation
- Server version vs local version
- actions:
  - Use server
  - Keep local

No destructive automatic resolution.

---

# 53. Button System

## Primary

Use for one most important action in a local context.

- violet gradient/solid
- 44–48px normal height
- 12–14px label

## Secondary

- white/subtle neutral
- 1px border

## Tertiary

- transparent/text style

## Destructive

- red semantic
- never visually identical to secondary normal action

## Icon Button

- minimum 36px desktop
- minimum 44px touch/mobile
- tooltip/title required if icon-only

---

# 54. Input System

All inputs share:

- 44–48px desktop height
- 48–52px mobile
- radius 10–12px
- clear focus ring
- 14px desktop text
- 16px mobile text

Textarea:

- minimum 84px context-dependent

Label:

- 12px
- weight 650–750

Hint:

- 12px
- visually secondary but readable

Error:

- under field
- red semantic
- icon optional
- no layout jump excessive

---

# 55. Chips and Status

Chip height:

- compact 24–28px
- standard 30–34px

Text:

- 11–12px

Statuses cannot use color only.

Examples:

- ACTIVE + green dot
- CLOSURE PENDING + icon
- CRITICAL FRESHNESS + warning icon

---

# 56. Empty States

Every list/editor needs purposeful empty state.

Empty state structure:

- icon
- title
- one sentence
- optional action

Maximum height should remain compact unless page is truly empty.

No giant illustration unless it adds real value.

---

# 57. Loading States

Avoid full screen spinner for partial loading.

Preferred:

- skeleton for cards/list
- inline status for button action
- page shell renders quickly

System Console first load may show centered status but should use branded panel, not raw text.

---

# 58. Error States

Errors must answer:

1. What failed?
2. Is user data safe?
3. What can user do now?

Examples:

- canonical API failed
- D1 unavailable
- Firebase sign-in failed
- SOR parser failed
- clipboard unavailable

Error copy must avoid raw stack trace in normal UI.

System Console can expose technical code in secondary line.

---

# 59. Notifications and Toasts

Use toast only for transient confirmation:

- copied
- saved
- restored
- parser success

Do not use toast as only container for:

- conflict
- destructive confirmation
- required validation
- long-lived offline state

Toast placement desktop:

- top-right or utility dock adjacent, but no overlap.

Mobile:

- bottom above navigation/safe area.

---

# 60. Modal, Drawer, Bottom Sheet

Desktop modal:

- max width 480–620px depending content
- padding 22–28px
- radius 20–24px

Drawer:

- 460–560px

Mobile:

- bottom sheet/full screen
- radius top 22–26px
- safe-area respected

Overlay:

- dark transparent + blur modest

Focus trap required.

ESC closes non-destructive modal.

---

# 61. Accessibility

Target WCAG 2.2 AA where practical.

Mandatory:

- keyboard navigation
- visible focus
- correct labels
- `aria-live` for save/sync status where needed
- `aria-pressed` for status selectors
- dialog roles
- touch target >=44px mobile
- contrast
- reduced motion support

No interaction may depend only on hover.

---

# 62. Motion

Motion purpose:

- explain change
- maintain spatial continuity
- feedback interaction

Allowed duration:

- hover: 120–180ms
- panel reveal: 160–240ms
- modal: 180–260ms

Avoid:

- large bouncing
- excessive spring
- card scaling everywhere

`prefers-reduced-motion` respected.

---

# 63. Desktop High-Density Rules

At 1440p/standard desktop:

- primary content should use 80–90% useful viewport width after sidebar.
- do not artificially cap content too narrow.
- avoid huge dead space below/alongside single cards.
- right rail should not exceed ~42% unless tool specifically needs preview.

At ultrawide:

- use max-width to prevent overly stretched lines.
- content may center but maintain density.

---

# 64. Mobile One-Hand UX Rules

Primary mobile actions must generally live within thumb reach.

Prefer:

- bottom nav
- sticky bottom action for task completion
- bottom sheets
- full-width buttons

Avoid:

- critical action at top-right only
- tiny icon-only actions
- hover-dependent menus

---

# 65. Copy and Language Rules

Current product uses English operational UI and Indonesian operational context may appear in data.

UI terminology must remain consistent.

Use:

- Composer
- Operations
- Archive / Incident Vault
- Impact Board
- Fiber Lab
- System Console
- New draft
- Quick update
- Closure readiness
- Recovery
- Server synced

Do not alternate randomly between synonyms.

Microcopy harus singkat dan action-oriented.

---

# 66. Visual Consistency Matrix

All major pages must share:

- same neutral palette
- same violet brand
- same typography scale
- same border family
- same radius family
- same button family
- same focus states
- same status semantics

Standalone tools boleh memiliki local accent:

- Impact Board → violet/blue network accent
- Fiber Lab → violet/indigo engineering accent
- System Console → neutral/violet control-plane accent

Tetapi bukan design system baru.

---

# 67. CSS Architecture Target

Current repository memiliki large `globals.css` plus multiple override layers.

Target jangka menengah:

1. global tokens
2. global primitives
3. shell/navigation
4. page-specific stylesheet/module
5. transient utility components

New page overhaul harus isolated.

Avoid terus menambah selector specificity tanpa kontrol.

Recommended future structure:

```text
app/styles/
  tokens.css
  primitives.css
  shell.css
  utilities.css
  composer.css
  operations.css
  archive.css
  impact-board.css
  fiber-lab.css
```

Refactor tersebut bukan requirement langsung untuk visual pass jika berisiko, tetapi arah implementasi harus menuju maintainability ini.

---

# 68. Implementation Workflow

Overhaul UI dilakukan **satu area per satu area**, bukan seluruh aplikasi dalam satu generator.

Recommended order:

1. NAV-01 Desktop sidebar
2. NAV-02 Mobile navigation
3. COMPOSER-01 shell/hero/ingest
4. COMPOSER-02 incident identity/dispatch
5. COMPOSER-03 topology
6. COMPOSER-04 progress/timeline
7. COMPOSER-05 closure/right preview/delivery
8. OPERATIONS-01 hero/KPI
9. OPERATIONS-02 queue/quick update
10. ARCHIVE-01 hero/search
11. ARCHIVE-02 incident cards/actions
12. IMPACT-01 shell/hero/metrics
13. IMPACT-02 editor/preview
14. FIBER-01 idle/upload
15. FIBER-02 parsed result/trace/event
16. SYSTEM-01 console
17. UTILITY-01 unified utility dock
18. MOBILE-QA full application
19. DESKTOP-QA full application
20. A11Y-QA

Setiap phase harus memiliki visual screenshot QA sebelum pindah phase.

---

# 69. Generator `.cjs` Change Policy

Untuk workflow manual/local:

- generator fokus pada perubahan phase terkait
- jangan memasukkan unrelated refactor
- generator dihapus setelah execution
- generated `.open-next/**` tidak boleh masuk commit
- backup temporary `.bak-*` dibersihkan
- code source dan final stylesheet yang dihasilkan harus dapat dilint/build

Recommended quality sequence:

```text
typecheck
lint
test
build
build:worker
lint after generated worker output is ignored
production dependency audit
```

Visual phase tidak boleh mengubah D1/API/Firebase logic kecuali UI benar-benar memerlukan behavioral fix dan perubahan itu ditinjau sebagai scope terpisah.

---

# 70. Per-Phase Visual QA Checklist

Setiap screenshot desktop harus diperiksa untuk:

- left alignment
- right alignment
- typography readable at 100% browser zoom
- no clipped text
- no accidental overflow
- no unintended horizontal scroll
- card padding consistency
- section spacing consistency
- icon alignment
- form label alignment
- action hierarchy
- status contrast
- empty space efficiency
- floating utility overlap

Mobile additionally:

- one-hand action placement
- bottom nav overlap
- keyboard/input behavior
- 16px input text
- touch targets
- safe-area
- no horizontal page scroll
- modal/bottom sheet usability

---

# 71. Page Acceptance Criteria — Navigation

Navigation is accepted only when:

- ReportOS brand readable.
- primary labels >=14px desktop.
- helpers >=11.5px.
- active state obvious without relying on color only.
- icon alignment exact.
- collapsed state usable.
- no content overlap.
- mobile nav present and thumb-friendly.
- keyboard focus visible.

---

# 72. Page Acceptance Criteria — Composer

Composer is accepted only when:

- raw ingest usable without zoom.
- all form inputs >=14px desktop / 16px mobile.
- no functional text below approved type scale.
- long page has strong section rhythm.
- topology hierarchy understandable in <=5 seconds.
- Progress update can be completed quickly.
- Closure checklist readable.
- Preview readable at standard laptop width.
- right rail does not overlap utilities.
- no horizontal page overflow.
- blank and populated incident both look intentional.

---

# 73. Page Acceptance Criteria — Operations

Operations is accepted only when:

- operator can identify critical/update-due incident at glance.
- KPI values readable.
- queue density remains high.
- ticket/summary/PIC/freshness readable.
- quick update does not create layout chaos.
- view switch clear.
- mobile card preserves priority order.

---

# 74. Page Acceptance Criteria — Archive

Archive is accepted only when:

- one incident does not leave awkward half-screen grid.
- many incidents adapt cleanly.
- search prominent.
- lifecycle states visible.
- destructive delete clearly differentiated.
- Return/Open is dominant action.
- archive/restore understandable.

---

# 75. Page Acceptance Criteria — Impact Board

Impact Board is accepted only when:

- customer and nested service hierarchy clear.
- status selector readable.
- editor and preview balance on desktop.
- WAG preview readable.
- Add Customer/Add Service obvious.
- local autosave status visible but quiet.
- mobile editor has no sideways page overflow.

---

# 76. Page Acceptance Criteria — Fiber Lab

Fiber Lab is accepted only when:

- upload/dropzone purpose obvious immediately.
- local processing privacy message clear.
- parsing state understandable.
- invalid file errors actionable.
- trace receives sufficient display area.
- metadata/event table readable.
- export PDF CTA obvious.
- large result works on laptop/mobile.

---

# 77. Page Acceptance Criteria — System Console

System Console is accepted only when:

- identity/role/revision/recovery immediately readable.
- recovery restore risk clearly communicated.
- audit rows readable.
- long UID/checksum does not break layout.
- error/loading states designed.
- mobile console remains operable.

---

# 78. Global Definition of Done

Master UI overhaul is complete only when:

1. All routes share one recognizable ReportOS visual system.
2. Functional typography no longer uses unreadable 5–10px patterns.
3. Desktop at 1366, 1440, 1920 widths has no critical layout issue.
4. Mobile at 360, 390, 430 widths is usable without horizontal page scroll.
5. Forms are readable at 100% zoom.
6. Navigation is coherent desktop and mobile.
7. Utility/status components do not overlap primary content.
8. All loading/error/empty/conflict states have deliberate UI.
9. Keyboard focus is visible.
10. Reduced motion is supported.
11. Existing business logic and persistence remain green.
12. Typecheck passes.
13. ESLint passes.
14. Unit tests pass.
15. Next production build passes.
16. OpenNext Cloudflare Worker build passes.
17. Production dependency audit remains green.
18. Visual QA screenshots are accepted page-by-page.

---

# 79. Priority Classification

## P0 — Must Fix

- unreadable typography
- overlaps
- horizontal overflow
- broken responsive layout
- ambiguous destructive action
- invisible focus
- status conflict/errors hidden
- mobile unusable controls

## P1 — High

- whitespace waste
- hierarchy inconsistency
- inconsistent card system
- poor preview proportions
- weak active navigation
- excessive floating utility noise

## P2 — Polish

- subtle motion
- ambient gradients
- decorative line/orbit
- premium shadow refinement
- micro alignment under 2px

P2 must never block P0/P1 usability work.

---

# 80. Final Product Experience Statement

Setelah seluruh PRD ini diterapkan, operator harus membuka ReportOS dan langsung merasakan bahwa aplikasi ini adalah **operational software yang serius**.

Tidak boleh ada kebutuhan untuk memperbesar browser hanya untuk membaca label. Tidak boleh ada card yang hanya terlihat cantik tetapi menghabiskan layar. Tidak boleh ada status penting tertutup floating widget. Tidak boleh ada perbedaan visual ekstrem antara Composer, Impact Board, Fiber Lab, dan System Console.

Premium dalam ReportOS berarti:

- cepat dipahami,
- mudah dibaca,
- rapi,
- presisi,
- konsisten,
- tenang,
- padat,
- dan dapat dipercaya selama incident nyata.

**This document is the UI/UX source of truth for subsequent ReportOS visual overhaul phases.**
