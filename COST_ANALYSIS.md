# Infrastructure Financial Model & Cost Analysis (INR)

This is a comprehensive financial model for your startup. *All costs are converted to Indian Rupees (INR) at an exchange rate of $1 = ₹100.*

---

## 1. Unit Economics (Cost per Platform)

*   **Backblaze B2:** 
    *   **Storage:** ₹600 per TB/month ($0.006/GB/mo). First 10 GB free.
    *   **Bandwidth (Egress):** **₹0** (100% free egress via Cloudflare Bandwidth Alliance).
    *   **Class B Transactions (Metadata/Downloads):** 75,000 requests/month free (2,500/day). Overages cost $0.004 per 10,000 requests (~₹0.40 per 10k). Estimated at ~₹50 per photographer/year.
    *   **Class C Transactions (Uploads/Creation):** 75,000 requests/month free (2,500/day). Overages cost $0.004 per 1,000 requests (~₹0.40 per 1k).
*   **Modal.com (AI Face Detection & Resizing):** 
    *   **Per-second Compute Billing:** CPU at $0.0000131/vCPU/sec, Memory at $0.00000222/GB/sec.
    *   **Photo Processing Cost:** Processing 100,000 photos costs ~$8.20 (₹820 total, ~₹68/month amortized).
    *   **Free Tier:** Includes a $30/month (₹3,000/month) free tier covering ~360,000 photo executions per month (free up to ~100 active photographers).
*   **Upstash QStash (Serverless Queue):** ₹100 per 100,000 messages ($1.00 per 100k). (Essentially ~₹8 per month per photographer).
*   **Supabase (Database & Auth):** 
    *   **Free Tier:** 0.5 GB database storage, 50,000 MAUs, 2 GB egress.
    *   **Pro Plan:** Flat ₹2,500/month ($25.00/mo). Includes 100,000 Monthly Active Users (MAU), 8 GB database space (holds ~4 million photos' metadata), and 50 GB egress.
    *   **Overages:** Extra Database Storage at $0.125/GB/mo (~₹12.50/GB/mo); Extra MAUs at $0.00325/MAU (~₹0.325 per extra user/mo); Extra Egress at $0.09/GB (bypassed via Cloudflare).
*   **Railway (Next.js Web Server):** 
    *   **Per-second Serverless Billing:** CPU at $0.00000772/vCPU/sec, RAM at $0.00000386/GB/sec, Egress at $0.05/GB.
    *   Because Modal and B2 handle image processing and storage, web server compute remains minimal. Baseline server (0.5 GB RAM, 0.05 vCPU, 5 GB Egress) averages ~$11.00/mo (~₹1,100/mo or ₹13,200/yr). Estimated scale ranges between ₹500 to ₹1,500/month for normal traffic.
*   **Cloudflare (CDN & Edge Routing):** 
    *   **Routing & DNS:** ₹0 for basic routing.
    *   **Workers:** Free plan includes up to 100k requests/day (3M/mo). Paid plan base is $5.00/mo (includes 10M requests), plus $0.50 per additional 1M requests.
    *   **Zone Plans:** Pro plan at ₹2,500/month ($25.00/mo) or Business plan at ₹20,000/month ($200.00/mo) as scale requires advanced security/WAF.

---

## 2. WORST-CASE Yearly Scenario (1 Terabyte per Photog)

**Core Assumptions:** Every photographer uploads a massive 1 TB (100k photos) a year. Every photographer brings 500 unique guests logging in every single month.

| Component | 1 Photographer | 10 Photographers | 100 Photographers | 500 Photographers | 1,000 Photographers |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Backblaze B2** | ₹7,800 | ₹78,000 | ₹780,000 | ₹3,900,000 | ₹7,800,000 |
| **Cloudflare** | ₹0 | ₹0 | ₹30,000 | ₹240,000 | ₹240,000 |
| **Supabase** | ₹30,000 | ₹30,000 | ₹30,000 | ₹660,000 | ₹1,620,000 |
| **Modal.com** | ₹0 | ₹0 | ₹45,600 | ₹372,000 | ₹780,000 |
| **Railway** | ₹6,000 | ₹12,000 | ₹30,000 | ₹120,000 | ₹240,000 |
| **Upstash QStash**| ₹0 | ₹1,200 | ₹9,600 | ₹48,000 | ₹96,000 |
| | | | | | |
| **TOTAL YEARLY** | **~₹43,800** | **~₹1,21,200** | **~₹9,25,200** | **~₹53,40,000** | **~₹1,07,76,000** |
| **Cost per Photog**| **₹43,800 / yr** | **₹12,120 / yr** | **₹9,252 / yr** | **₹10,680 / yr** | **₹10,776 / yr** |

---

## 3. AVERAGE-CASE Realistic Scenario (400GB per Photog)

**Core Assumptions:** A realistic Indian wedding photographer uploads roughly 400GB (40,000 photos) a year. Guests taper off naturally after the wedding, resulting in roughly 150 active guests (MAU) per photographer per month.

| Component | 1 Photographer | 10 Photographers | 100 Photographers | 500 Photographers | 1,000 Photographers |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Total Storage** | 400 GB | 4 TB | 40 TB | 200 TB | **400 TB** |
| | | | | | |
| **Backblaze B2** | ₹2,880 | ₹28,800 | ₹288,000 | ₹14,40,000 | ₹28,80,000 |
| **Cloudflare** | ₹0 | ₹0 | ₹30,000 | ₹30,000 | ₹30,000 *(Pro)* |
| **Supabase** | ₹30,000 | ₹30,000 | ₹30,000 | ₹30,000 | ₹2,25,000 *(Overage)* |
| **Modal.com** | ₹0 | ₹0 | ₹0 *(Free!)* | ₹128,000 | ₹292,000 |
| **Railway** | ₹6,000 | ₹12,000 | ₹30,000 | ₹120,000 | ₹240,000 |
| **Upstash QStash**| ₹0 | ₹0 | ₹3,800 | ₹19,200 | ₹38,400 |
| | | | | | |
| **TOTAL YEARLY** | **~₹38,880** | **~₹70,800** | **~₹3,81,800** | **~₹17,67,200** | **~₹37,05,400** |
| *(In Lakhs)* | *(~38k INR)* | *(~70k INR)* | *(~3.8 Lakhs)* | *(~17.6 Lakhs)* | **(~37 Lakhs)** |
| **Cost per Photog**| **₹38,880 / yr** | **₹7,080 / yr** | **₹3,818 / yr** | **₹3,534 / yr** | **₹3,705 / yr** |

---

## 4. Key Takeaways & Profitability

1. **Massive Margins:** 
   In a realistic, average-case scenario for 1,000 Indian wedding photographers, your total infrastructure cost drops to just **₹3,705 per photographer, per year**. If you charge them a ₹40,000 annual subscription, your business operates at a phenomenal **90% profit margin**.
2. **Modal AI is Free up to 100 Photographers:**
   Because the average photographer uploads 40k photos instead of 100k, you can support roughly **100 full-time photographers** entirely on Modal.com's $30/mo free tier. You won't pay a single Rupee for AI compute until photographer #101 joins.
3. **Storage Dominates:**
   Even in the average-case, Backblaze B2 makes up 77% of your bill at enterprise scale. Fortunately, it is still the cheapest enterprise storage option on the planet ($0.006/GB/mo with 0 egress fees via Cloudflare), making your unit economics highly sustainable.
4. **Live Monitoring Sync:**
   The Analytics Dashboard features a live **Infrastructure Cost Hub** ([InfraCostGrid.tsx](file:///Users/sarthak/EveBash/apps/analytics-dashboard/src/components/InfraCostGrid.tsx)) that fetches real-time usage metrics and applies these exact financial formulas for live operational budgeting.

