# Vocational Training Management System (VTMS) - System Blueprint & Pitch

## 1. System Overview
The **Vocational Training Management System (VTMS)** is a specialized, trauma-informed digital platform designed for NGOs working with street-connected youth and vulnerable communities.

**Value Proposition:**
"To move from paper-based tracking to a secure, offline-capable digital ecosystem that ensures every trainee's journey—from mobilization to job placement—is tracked with dignity, data integrity, and accountability."

The system bridges the gap between field operations (where connectivity is low) and donor reporting (where accuracy is paramount), all while maintaining a human-centered design that protects the most sensitive child-protection data.

---

## 2. Functional Modules

### A. Trainee Lifecycle Management
*   **Key Features:** Mobilization tracking, vulnerability assessment scoring, digital registration, and status updates (Prospect -> Enrolled -> Alumnus).
*   **Users:** Field Officers, Social Workers.

### B. CBET Tracker (Competency-Based Education & Training)
*   **Key Features:** Trade-specific curriculum management, practical competency scoring (Beginner to Independent), and batch progress tracking.
*   **Users:** Trainers, M&E Officers.

### C. Case & Safeguarding (Trauma-Informed)
*   **Key Features:** Encrypted case notes, trauma healing session logs, mentorship tracking, and critical incident reporting.
*   **Users:** Counsellors, Case Workers, Senior Management.

### D. Operations & Inventory
*   **Key Features:** Tool tracking, raw material procurement, starter kit distribution, and workshop production logs.
*   **Users:** Trainers, Procurement Officer.

### E. Finance & Sales
*   **Key Features:** Workshop income tracking (sales), donor fund allocation, and expense tracking per batch.
*   **Users:** Finance Officer, Manager.

### F. Reporting & Analytics
*   **Key Features:** Real-time dashboards, donor report generation, and longitudinal impact tracking (employment rates).
*   **Users:** Directors, Donors, M&E Officers.

---

## 3. User Journeys / Flows

### Journey 1: "Selection to First Competency"
1.  **Field Officer** captures a prospect's data offline during a community outreach.
2.  The system calculates a **Vulnerability Score** to prioritize the youth most in need.
3.  Upon enrollment, the **Trainer** assigns the trainee to "Batch 5 - Tailoring".
4.  After the first week, the Trainer records the first **Competency Assessment** (e.g., "Machine Threading" - Level: Developing).

### Journey 2: "Attendance & Safeguarding Event"
1.  **Trainer** marks attendance on a tablet in the workshop.
2.  Trainee "John" is marked absent. The Trainer notes "John appeared distressed yesterday".
3.  **Case Worker** sees the flag and conducts a home visit, adding a **Case Note** (marked "Critical").
4.  The system alerts the **Counsellor** for a follow-up trauma session, ensuring John doesn't drop out.

### Journey 3: "Production to Sale"
1.  **Carpentry Batch** completes 5 dining tables as part of their practical training.
2.  Trainer logs **Production Item** and deducts timber from **Inventory**.
3.  A community member buys a table; **Finance Officer** records the **Sale**, linked to Batch 5 income.
4.  The income is partially used for trainee stipends, tracked in **Financial Transactions**.

### Journey 4: "Graduation to 6-Month Tracking"
1.  **Trainee** completes all modules and is marked as **Graduated**.
2.  System generates a **Starter Kit** checklist; Trainee signs for tools on the tablet.
3.  6 months later, **Alumni Officer** receives a push notification to follow up.
4.  Officer records John is "Self-Employed" with a monthly income of $150, updating the **Impact Dashboard**.

---

## 4. Data Model Sketch (Core Entities)
*   **Batch:** (ID, Trade, Dates, Budget, Status)
*   **Trainee:** (ID, Batch_ID, Vulnerability_Score, Status) - *Sensitive*
*   **Competency_Assessment:** (Trainee_ID, Module, Level [1-4], Assessor)
*   **Attendance:** (Trainee_ID, Date, Status, Notes)
*   **Case_Note:** (Trainee_ID, Category, Content, Critical_Flag) - *Highly Sensitive/Encrypted*
*   **Inventory_Item:** (Name, Category, Qty_on_Hand, Reorder_Level)
*   **Sale:** (Batch_ID, Amount, Item, Date)
*   **Alumni_Follow_Up:** (Trainee_ID, Employment_Status, Income, Kit_Status)

---

## 5. Offline Architecture & Sync Strategy
To accommodate low-resource settings, the system uses an **Offline-First PWA** approach.

*   **Technology:** React (Frontend) + Supabase/PostgreSQL (Backend).
*   **Local Storage:** **IndexedDB** (via Dexie.js) stores all local edits while offline.
*   **Service Worker:** Caches the application shell and static assets for zero-connectivity loading.
*   **Sync Logic:**
    *   **Outgoing:** A "Sync Queue" tracks every create/update operation. When a heartbeat detects internet, the queue processes sequentially.
    *   **Conflict Resolution:** "Last-Write-Wins" for simple data; "Merge/Manual Review" for sensitive case notes.
    *   **Bandwidth Optimization:** Payload compression and lazy-loading of non-essential images.

---

## 6. Role-Based Access & Safeguarding
Data is siloed to prevent re-traumatization and ensure child protection.

| Role | Attendance | Competency | Case Notes | Financials |
| :--- | :---: | :---: | :---: | :---: |
| **Trainer** | View/Edit | View/Edit | No Access | No Access |
| **Case Worker** | View | View | View/Edit | No Access |
| **Finance Officer** | No Access | No Access | No Access | View/Edit |
| **Director** | View | View | View (Anonymized) | View |
| **Admin** | Full | Full | System Admin Only | Full |

**Safeguarding Design:** Trauma data is encrypted at rest. Critical case notes trigger automated SMS/Email alerts to the Safeguarding Lead.

---

## 7. Reporting & Donor Accountability
*   **Efficiency Dashboard:** Attendance trends vs. dropout risks.
*   **Skill Progression:** Heatmaps of batch competency (Beginner -> Independent).
*   **Outcome Report:** % of graduates self-employed vs. employed within 6 months.
*   **Financial Integrity:** Real-time "Budget vs. Actual" for donor-funded materials.
*   **Offline Reporting:** The PWA pre-computes aggregate metrics locally, allowing field staff to see basic stats even without a connection.

---

## 8. Pitch Deck Outline
1.  **Slide 1: The Vision** - Empowering vulnerable youth through digital transformation.
2.  **Slide 2: The Problem** - Fragmented paper records, lost follow-up, and donor reporting delays.
3.  **Slide 3: The VTMS Solution** - One platform for the entire Trainee Lifecycle.
4.  **Slide 4: CBET in Action** - How we track real skills, not just time spent.
5.  **Slide 5: Trauma-Informed Care** - Integrating safeguarding into the daily workflow.
6.  **Slide 6: Built for the Field** - Offline-first PWA, simple UI, low-end device support.
7.  **Slide 7: Transparency & Impact** - Automated donor reports and longitudinal data.
8.  **Slide 8: Implementation Roadmap** - Phased rollout and sustainability.
9.  **Slide 9: The Ask** - Investment in hardware, training, and cloud infrastructure.

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Months 1-2)
*   Setup Core DB (Batches, Trainees).
*   Deploy basic Registration & Attendance modules.
*   Enable Offline Sync for core operations.

### Phase 2: CBET & Case Management (Months 3-4)
*   Build Trade Modules & Competency Assessment tools.
*   Implement secure Case Management & Safeguarding flags.

### Phase 3: Operations & Finance (Months 5-6)
*   Inventory tracking & Starter Kit distribution.
*   Workshop Sales & Production logging.

### Phase 4: Scaling & Analytics (Months 7+)
*   Alumni tracking & Push notifications.
*   Advanced Donor Dashboards & AI-driven dropout prediction.
