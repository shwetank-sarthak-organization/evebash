# Infrastructure Financial Model & Cost Analysis (INR)

This is a comprehensive financial model for your startup. *All costs are converted to Indian Rupees (INR) at an exchange rate of $1 = ₹100.*

---

## 1. Unit Economics (Cost per Platform)

*   **Backblaze B2:** ₹600 per TB/month for storage. Bandwidth (Egress) is **₹0** because of the Cloudflare Bandwidth Alliance. Class B Transactions (Gallery viewing) cost ~₹50 per photographer.
*   **Modal.com (AI & Resizing):** Processing 100,000 photos costs ₹820 total (₹68/month). Modal provides a ₹3,000/month free tier.
*   **Upstash QStash:** ₹100 per 100,000 messages. (Essentially ₹8 per month per photographer).
*   **Supabase (Database & Auth):** Pro Plan is a flat ₹2,500/month. It includes 100,000 Monthly Active Users (MAU) and 8GB database space (which holds ~4 million photos' metadata). After 100k MAU, it costs ₹0.325 per extra user.
*   **Railway (Next.js Web Server):** Because Modal and B2 do the heavy lifting, your Railway server uses very little compute. Estimated at ~₹500 to ₹1,500 per month for basic traffic.
*   **Cloudflare:** ₹0 for basic routing. We will assume the ₹2,500/mo Pro plan or ₹20,000/mo Business plan as you scale for advanced security.

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
   Because the average photographer uploads 40k photos instead of 100k, you can support roughly **100 full-time photographers** entirely on Modal.com's free tier. You won't pay a single Rupee for AI compute until photographer #101 joins.
3. **Storage Dominates:**
   Even in the average-case, Backblaze B2 makes up 77% of your bill at enterprise scale. Fortunately, it is still the cheapest enterprise storage option on the planet, making your unit economics highly sustainable.
